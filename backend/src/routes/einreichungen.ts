import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { upload, berechneHash, validateMimeType } from '../services/upload.js';
import { generateBelegNr } from '../services/belegNummer.js';
import { erstelleGesamtPdf } from '../services/pdf.js';
import { sendeAnDmsMitRetry } from '../services/email.js';
import { resolveAndValidateBelegPfade as resolveBelegPfadeImpl } from '../services/uploadResolve.js';
import { erstelleReisekostenEmailText, erstelleErstattungEmailText, erstelleSammelfahrtEmailText } from '../services/emailTexte.js';
import { sendeWebhook } from '../services/webhook.js';
import { kmSatzAlsDecimal, berechneKmBetrag, rundeAufCent } from '../lib/kmSaetze.js';
import path from 'path';
import fs from 'fs';

export const einreichungenRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads');

/** Schreibt einen Status-Patch und loggt Fehler robust. Bewusst nicht-throwend,
 *  weil dies in fire-and-forget Promise-Ketten nach dem 201-Response läuft. */
async function aktualisiereVersandStatus(
  einreichungId: string,
  belegNr: string,
  patch: Partial<typeof schema.einreichungen.$inferInsert>,
): Promise<void> {
  try {
    await db
      .update(schema.einreichungen)
      .set(patch)
      .where(eq(schema.einreichungen.id, einreichungId));
  } catch (err) {
    console.error(`[${belegNr}] Status-Update fehlgeschlagen:`, err);
  }
}

/** Speichert hochgeladene Beleg-Dateien für eine Einreichung als Bulk-Insert. */
async function speichereBelege(einreichungId: string, validatedBelegPfade: string[]): Promise<void> {
  if (validatedBelegPfade.length === 0) return;
  const rows = await Promise.all(
    validatedBelegPfade.map(async pfad => ({
      einreichungId,
      dateiname: path.basename(pfad),
      dateityp: path.extname(pfad).replace('.', '').toUpperCase(),
      dateigroesse: 0,
      dateipfad: pfad,
      sha256Hash: await berechneHash(pfad),
    })),
  );
  await db.insert(schema.belege).values(rows);
}

/** Wrapper, bindet die in services/uploadResolve.ts implementierte Logik an UPLOAD_DIR. */
function resolveAndValidateBelegPfade(dateiIds: string[]): Promise<string[]> {
  return resolveBelegPfadeImpl(dateiIds, UPLOAD_DIR);
}

// ── Beleg-Upload (vorab, vor Einreichung) ──────────────

einreichungenRouter.post('/belege', upload.array('belege', 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'Keine Dateien hochgeladen' });
      return;
    }

    // MIME-Type via Magic Bytes validieren (löscht ungültige Dateien)
    for (const f of files) {
      await validateMimeType(f.path);
    }

    const belege = await Promise.all(files.map(async f => ({
      originalname: f.originalname,
      dateiId: path.basename(f.path),
      dateipfad: path.basename(f.path),
      dateityp: path.extname(f.originalname).replace('.', '').toUpperCase(),
      dateigroesse: f.size,
      sha256: await berechneHash(f.path),
    })));

    res.json({ belege });
  } catch (error) {
    console.error('Upload-Fehler:', error);
    res.status(500).json({ error: 'Belege konnten nicht hochgeladen werden' });
  }
});

// ── Validierung ────────────────────────────────────────

const persoenlichSchema = z.object({
  vorname: z.string().min(1).max(100),
  nachname: z.string().min(1).max(100),
  personalNr: z.string().max(20).optional().default(''),
  iban: z.string().regex(/^DE\d{20}$/),
  kontoinhaber: z.string().min(1).max(200),
  mandantId: z.string().uuid(),
  kostenstelleId: z.string().uuid().optional().or(z.literal('')),
});

const reisekostenBody = z.object({
  typ: z.literal('REISEKOSTEN'),
  persoenlich: persoenlichSchema,
  reiseanlass: z.string().min(10),
  reiseziel: z.string().min(1),
  abfahrtOrt: z.enum(['WOHNUNG', 'TAETIGKEIT']),
  abfahrtZeit: z.string(),
  rueckkehrZeit: z.string(),
  land: z.string().nullable().optional(),
  verkehrsmittel: z.enum(['PKW', 'MOTORRAD', 'OEPNV', 'BAHN', 'FLUG', 'SONSTIGE']),
  kmGefahren: z.number().min(0),
  kmBetrag: z.number().min(0),
  reisetage: z.array(z.object({
    datum: z.string(),
    typ: z.enum(['ANREISE', 'GANZTAG', 'ABREISE', 'EINTAEGIG']),
    fruehstueckGestellt: z.boolean(),
    mittagGestellt: z.boolean(),
    abendGestellt: z.boolean(),
    vmaBrutto: z.number(),
    vmaKuerzung: z.number(),
    vmaNetto: z.number(),
  })),
  vmaNetto: z.number().min(0),
  weitereKosten: z.array(z.object({
    typ: z.string(),
    beschreibung: z.string(),
    betrag: z.number().positive(),
  })),
  weitereKostenSumme: z.number().min(0),
  gesamtbetrag: z.number().positive(),
  unterschriftBild: z.string().optional(),
  belegDateipfade: z.array(z.string()),
});

const erstattungBody = z.object({
  typ: z.literal('ERSTATTUNG'),
  persoenlich: persoenlichSchema,
  positionen: z.array(z.object({
    beschreibung: z.string().min(5),
    kategorie: z.enum(['BUEROMATERIAL', 'FACHLITERATUR', 'LEBENSMITTEL', 'ARBEITSMITTEL', 'FORTBILDUNG', 'SONSTIGES']),
    datum: z.string(),
    betrag: z.number().positive(),
  })).min(1),
  gesamtbetrag: z.number().positive(),
  unterschriftBild: z.string().optional(),
  belegDateipfade: z.array(z.string()),
});

const sammelfahrtBody = z.object({
  typ: z.literal('SAMMELFAHRT'),
  persoenlich: persoenlichSchema,
  reiseanlass: z.string().min(10),
  verkehrsmittel: z.enum(['PKW', 'MOTORRAD']),
  fahrten: z.array(z.object({
    datum: z.string(),
    startOrt: z.string().min(1).max(500),
    ziel: z.string().min(1).max(500),
    km: z.number().positive(),
    kmBetrag: z.number().nonnegative(),
  })).min(2).max(50),
  kmSumme: z.number().positive(),
  gesamtbetrag: z.number().positive(),
  unterschriftBild: z.string().optional(),
  belegDateipfade: z.array(z.string()),
});

// ── POST /api/einreichungen — Neue Einreichung ────────

einreichungenRouter.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.typ === 'REISEKOSTEN') {
      const parsed = reisekostenBody.parse(body);

      // Path Traversal Schutz: Beleg-Pfade validieren und auflösen
      const validatedBelegPfade = await resolveAndValidateBelegPfade(parsed.belegDateipfade);

      const belegNr = await generateBelegNr('REISEKOSTEN');

      // Mandant + Kostenstelle laden
      const [mandant] = await db.select().from(schema.mandanten).where(eq(schema.mandanten.id, parsed.persoenlich.mandantId));
      const [kostenstelle] = parsed.persoenlich.kostenstelleId
        ? await db.select().from(schema.kostenstellen).where(eq(schema.kostenstellen.id, parsed.persoenlich.kostenstelleId))
        : [undefined];

      if (!mandant) {
        res.status(400).json({ error: 'Mandant nicht gefunden' });
        return;
      }
      if (parsed.persoenlich.kostenstelleId && !kostenstelle) {
        res.status(400).json({ error: 'Kostenstelle nicht gefunden' });
        return;
      }

      // Server-Recompute: km-Beträge und VMA-Summen aus den Roh-Inputs berechnen,
      // damit ein manipulierter Client keine fremden Beträge auszahlen kann.
      const serverKmBetrag = berechneKmBetrag(parsed.kmGefahren, parsed.verkehrsmittel);
      const serverVmaBrutto = rundeAufCent(parsed.reisetage.reduce((s, t) => s + t.vmaBrutto, 0));
      const serverVmaKuerzung = rundeAufCent(parsed.reisetage.reduce((s, t) => s + t.vmaKuerzung, 0));
      const serverVmaNetto = rundeAufCent(parsed.reisetage.reduce((s, t) => s + t.vmaNetto, 0));
      const serverWeitereKostenSumme = rundeAufCent(parsed.weitereKosten.reduce((s, k) => s + k.betrag, 0));
      const serverGesamtbetrag = rundeAufCent(serverKmBetrag + serverVmaNetto + serverWeitereKostenSumme);

      // In DB speichern
      const [einreichung] = await db.insert(schema.einreichungen).values({
        typ: 'REISEKOSTEN',
        belegNr,
        mandantId: parsed.persoenlich.mandantId,
        kostenstelleId: parsed.persoenlich.kostenstelleId || null,
        mitarbeiterVorname: parsed.persoenlich.vorname,
        mitarbeiterNachname: parsed.persoenlich.nachname,
        mitarbeiterPersonalNr: parsed.persoenlich.personalNr || '',
        bankIban: parsed.persoenlich.iban,
        bankKontoinhaber: parsed.persoenlich.kontoinhaber,
        reiseanlass: parsed.reiseanlass,
        reiseziel: parsed.reiseziel,
        abfahrtOrt: parsed.abfahrtOrt,
        abfahrtZeit: new Date(parsed.abfahrtZeit),
        rueckkehrZeit: new Date(parsed.rueckkehrZeit),
        land: parsed.land || null,
        verkehrsmittel: parsed.verkehrsmittel,
        kmGefahren: String(parsed.kmGefahren),
        kmPauschaleSatz: kmSatzAlsDecimal(parsed.verkehrsmittel),
        kmBetrag: String(serverKmBetrag),
        vmaBrutto: String(serverVmaBrutto),
        vmaKuerzung: String(serverVmaKuerzung),
        vmaNetto: String(serverVmaNetto),
        weitereKostenSumme: String(serverWeitereKostenSumme),
        gesamtbetrag: String(serverGesamtbetrag),
        unterschriftBild: parsed.unterschriftBild,
        status: 'EINGEREICHT',
      }).returning();

      // Reisetage als Bulk-Insert
      if (parsed.reisetage.length > 0) {
        await db.insert(schema.reisetage).values(
          parsed.reisetage.map(tag => ({
            einreichungId: einreichung.id,
            datum: new Date(tag.datum),
            typ: tag.typ,
            fruehstueckGestellt: tag.fruehstueckGestellt,
            mittagGestellt: tag.mittagGestellt,
            abendGestellt: tag.abendGestellt,
            vmaBrutto: String(tag.vmaBrutto),
            vmaKuerzung: String(tag.vmaKuerzung),
            vmaNetto: String(tag.vmaNetto),
          })),
        );
      }

      // Weitere Kosten als Bulk-Insert
      if (parsed.weitereKosten.length > 0) {
        await db.insert(schema.weitereKosten).values(
          parsed.weitereKosten.map(k => ({
            einreichungId: einreichung.id,
            typ: k.typ,
            beschreibung: k.beschreibung,
            betrag: String(k.betrag),
          })),
        );
      }

      // Belege als Bulk-Insert (Hashes parallel berechnen)
      await speichereBelege(einreichung.id, validatedBelegPfade);

      // PDF generieren (Hauptdokument + Belege in einer PDF)
      const pdfPfad = path.join(UPLOAD_DIR, 'pdfs', `${belegNr}.pdf`);
      await erstelleGesamtPdf({
        typ: 'REISEKOSTEN',
        belegNr,
        mandantName: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelleNr: kostenstelle?.nummer || '',
        kostenstelleBezeichnung: kostenstelle?.bezeichnung || '',
        vorname: parsed.persoenlich.vorname,
        nachname: parsed.persoenlich.nachname,
        personalNr: parsed.persoenlich.personalNr,
        iban: parsed.persoenlich.iban,
        kontoinhaber: parsed.persoenlich.kontoinhaber,
        reiseanlass: parsed.reiseanlass,
        reiseziel: parsed.reiseziel,
        abfahrtOrt: parsed.abfahrtOrt,
        abfahrtZeit: parsed.abfahrtZeit,
        rueckkehrZeit: parsed.rueckkehrZeit,
        verkehrsmittel: parsed.verkehrsmittel,
        kmGefahren: parsed.kmGefahren,
        kmBetrag: serverKmBetrag,
        vmaNetto: serverVmaNetto,
        weitereKostenSumme: serverWeitereKostenSumme,
        gesamtbetrag: serverGesamtbetrag,
        reisetage: parsed.reisetage.map(t => ({
          datum: t.datum,
          typ: t.typ,
          vmaNetto: t.vmaNetto,
          fruehstueckGestellt: t.fruehstueckGestellt,
          mittagGestellt: t.mittagGestellt,
          abendGestellt: t.abendGestellt,
        })),
        weitereKosten: parsed.weitereKosten,
        unterschriftBild: parsed.unterschriftBild,
      }, validatedBelegPfade, pdfPfad);

      // PDF-Pfad in DB speichern, Unterschrift-Biometrie nach erfolgreicher
      // PDF-Erstellung loeschen (DSGVO — sie ist im PDF persistiert).
      await db.update(schema.einreichungen)
        .set({ pdfDateipfad: pdfPfad, unterschriftBild: null })
        .where(eq(schema.einreichungen.id, einreichung.id));

      // Versandmethode aus DB lesen
      const [emailConf] = await db.select().from(schema.emailConfig).limit(1);
      const versandMethode = emailConf?.versandMethode || 'WEBHOOK';
      console.log(`[${belegNr}] Versandmethode: ${versandMethode}, PDF: ${pdfPfad}, existiert: ${fs.existsSync(pdfPfad)}`);

      const webhookData = {
        id: einreichung.id,
        belegNr,
        typ: 'REISEKOSTEN' as const,
        status: 'EINGEREICHT',
        mandant: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelle: kostenstelle?.bezeichnung || '',
        mitarbeiter: {
          vorname: parsed.persoenlich.vorname,
          nachname: parsed.persoenlich.nachname,
          personalNr: parsed.persoenlich.personalNr || '',
        },
        gesamtbetrag: String(serverGesamtbetrag),
        iban: parsed.persoenlich.iban,
        kontoinhaber: parsed.persoenlich.kontoinhaber,
        reiseziel: parsed.reiseziel,
        reiseanlass: parsed.reiseanlass,
        verkehrsmittel: parsed.verkehrsmittel,
        kmGefahren: String(parsed.kmGefahren),
        vmaNetto: String(serverVmaNetto),
      };

      if (versandMethode === 'WEBHOOK') {
        // Nur Webhook an n8n — n8n übernimmt den E-Mail-Versand
        sendeWebhook('eingereicht', webhookData, mandant.dmsEmail, pdfPfad)
          .then(() => aktualisiereVersandStatus(einreichung.id, belegNr, { emailStatus: 'GESENDET', status: 'GESENDET' }))
          .catch(async err => {
            console.error(`[${belegNr}] Webhook-Versand fehlgeschlagen:`, err);
            await aktualisiereVersandStatus(einreichung.id, belegNr, {
              emailStatus: 'FEHLER',
              status: 'FEHLER',
              emailLetzterFehler: String(err),
            });
          });
      } else {
        // Direkter SMTP-Versand
        sendeAnDmsMitRetry({
          an: mandant.dmsEmail,
          betreff: `[${belegNr}] ${parsed.persoenlich.vorname} ${parsed.persoenlich.nachname} - ${mandant.name}`,
          text: erstelleReisekostenEmailText({
            vorname: parsed.persoenlich.vorname,
            nachname: parsed.persoenlich.nachname,
            personalNr: parsed.persoenlich.personalNr,
            mandantName: mandant.name,
            mandantNr: String(mandant.mandantNr),
            reiseziel: parsed.reiseziel,
            abfahrtZeit: parsed.abfahrtZeit,
            rueckkehrZeit: parsed.rueckkehrZeit,
            gesamtbetrag: serverGesamtbetrag,
            iban: parsed.persoenlich.iban,
            kontoinhaber: parsed.persoenlich.kontoinhaber,
            reisetage: parsed.reisetage,
          }),
          pdfDateipfad: pdfPfad,
          pdfDateiname: `${belegNr}.pdf`,
        }).then(async emailResult => {
          const newStatus = emailResult.erfolg ? 'GESENDET' : 'FEHLER';
          await aktualisiereVersandStatus(einreichung.id, belegNr, {
            emailStatus: emailResult.erfolg ? 'GESENDET' : 'FEHLER',
            emailVersuche: emailResult.versuche,
            emailLetzterFehler: emailResult.fehler || null,
            status: newStatus,
          });

          if (!emailResult.erfolg) {
            await sendeWebhook('fehler', webhookData, mandant.dmsEmail, pdfPfad).catch(err =>
              console.error(`[${belegNr}] Fehler-Webhook fehlgeschlagen:`, err),
            );
          }
        }).catch(err => console.error(`[${belegNr}] SMTP-Pipeline-Fehler:`, err));
      }

      res.status(201).json({
        success: true,
        belegNr,
      });

    } else if (body.typ === 'ERSTATTUNG') {
      const parsed = erstattungBody.parse(body);

      // Path Traversal Schutz: Beleg-Pfade validieren und auflösen
      const validatedBelegPfade = await resolveAndValidateBelegPfade(parsed.belegDateipfade);

      const belegNr = await generateBelegNr('ERSTATTUNG');

      const [mandant] = await db.select().from(schema.mandanten).where(eq(schema.mandanten.id, parsed.persoenlich.mandantId));
      const [kostenstelle] = parsed.persoenlich.kostenstelleId
        ? await db.select().from(schema.kostenstellen).where(eq(schema.kostenstellen.id, parsed.persoenlich.kostenstelleId))
        : [undefined];

      if (!mandant) {
        res.status(400).json({ error: 'Mandant nicht gefunden' });
        return;
      }
      if (parsed.persoenlich.kostenstelleId && !kostenstelle) {
        res.status(400).json({ error: 'Kostenstelle nicht gefunden' });
        return;
      }

      // Server-Recompute: Gesamtbetrag aus Positions-Summen, Frontend-Wert wird ignoriert.
      const serverGesamtbetragE = rundeAufCent(parsed.positionen.reduce((s, p) => s + p.betrag, 0));

      // In DB speichern
      const [einreichung] = await db.insert(schema.einreichungen).values({
        typ: 'ERSTATTUNG',
        belegNr,
        mandantId: parsed.persoenlich.mandantId,
        kostenstelleId: parsed.persoenlich.kostenstelleId || null,
        mitarbeiterVorname: parsed.persoenlich.vorname,
        mitarbeiterNachname: parsed.persoenlich.nachname,
        mitarbeiterPersonalNr: parsed.persoenlich.personalNr || '',
        bankIban: parsed.persoenlich.iban,
        bankKontoinhaber: parsed.persoenlich.kontoinhaber,
        gesamtbetrag: String(serverGesamtbetragE),
        unterschriftBild: parsed.unterschriftBild || null,
        status: 'EINGEREICHT',
      }).returning();

      // Positionen als Bulk-Insert
      if (parsed.positionen.length > 0) {
        await db.insert(schema.positionen).values(
          parsed.positionen.map(pos => ({
            einreichungId: einreichung.id,
            beschreibung: pos.beschreibung,
            kategorie: pos.kategorie,
            datum: new Date(pos.datum),
            betrag: String(pos.betrag),
          })),
        );
      }

      // Belege als Bulk-Insert
      await speichereBelege(einreichung.id, validatedBelegPfade);

      // PDF generieren
      const pdfPfad = path.join(UPLOAD_DIR, 'pdfs', `${belegNr}.pdf`);
      await erstelleGesamtPdf({
        typ: 'ERSTATTUNG',
        belegNr,
        mandantName: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelleNr: kostenstelle?.nummer || '',
        kostenstelleBezeichnung: kostenstelle?.bezeichnung || '',
        vorname: parsed.persoenlich.vorname,
        nachname: parsed.persoenlich.nachname,
        personalNr: parsed.persoenlich.personalNr,
        iban: parsed.persoenlich.iban,
        kontoinhaber: parsed.persoenlich.kontoinhaber,
        gesamtbetrag: serverGesamtbetragE,
        positionen: parsed.positionen,
        unterschriftBild: parsed.unterschriftBild,
      }, validatedBelegPfade, pdfPfad);

      await db.update(schema.einreichungen)
        .set({ pdfDateipfad: pdfPfad })
        .where(eq(schema.einreichungen.id, einreichung.id));

      // Versandmethode aus DB lesen
      const [emailConfE] = await db.select().from(schema.emailConfig).limit(1);
      const versandMethodeE = emailConfE?.versandMethode || 'WEBHOOK';
      console.log(`[${belegNr}] Versandmethode: ${versandMethodeE}, PDF: ${pdfPfad}, existiert: ${fs.existsSync(pdfPfad)}`);

      const webhookDataE = {
        id: einreichung.id,
        belegNr,
        typ: 'ERSTATTUNG' as const,
        status: 'EINGEREICHT',
        mandant: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelle: kostenstelle?.bezeichnung || '',
        mitarbeiter: {
          vorname: parsed.persoenlich.vorname,
          nachname: parsed.persoenlich.nachname,
          personalNr: parsed.persoenlich.personalNr || '',
        },
        gesamtbetrag: String(serverGesamtbetragE),
        iban: parsed.persoenlich.iban,
        kontoinhaber: parsed.persoenlich.kontoinhaber,
        anzahlPositionen: parsed.positionen.length,
      };

      if (versandMethodeE === 'WEBHOOK') {
        // Nur Webhook an n8n — n8n übernimmt den E-Mail-Versand
        sendeWebhook('eingereicht', webhookDataE, mandant.dmsEmail, pdfPfad)
          .then(() => aktualisiereVersandStatus(einreichung.id, belegNr, { emailStatus: 'GESENDET', status: 'GESENDET' }))
          .catch(async err => {
            console.error(`[${belegNr}] Webhook-Versand fehlgeschlagen:`, err);
            await aktualisiereVersandStatus(einreichung.id, belegNr, {
              emailStatus: 'FEHLER',
              status: 'FEHLER',
              emailLetzterFehler: String(err),
            });
          });
      } else {
        // Direkter SMTP-Versand
        sendeAnDmsMitRetry({
          an: mandant.dmsEmail,
          betreff: `[${belegNr}] ${parsed.persoenlich.vorname} ${parsed.persoenlich.nachname} - ${mandant.name}`,
          text: erstelleErstattungEmailText({
            vorname: parsed.persoenlich.vorname,
            nachname: parsed.persoenlich.nachname,
            mandantName: mandant.name,
            mandantNr: String(mandant.mandantNr),
            anzahlPositionen: parsed.positionen.length,
            gesamtbetrag: serverGesamtbetragE,
            iban: parsed.persoenlich.iban,
            kontoinhaber: parsed.persoenlich.kontoinhaber,
          }),
          pdfDateipfad: pdfPfad,
          pdfDateiname: `${belegNr}.pdf`,
        }).then(async emailResult => {
          const newStatus = emailResult.erfolg ? 'GESENDET' : 'FEHLER';
          await aktualisiereVersandStatus(einreichung.id, belegNr, {
            emailStatus: emailResult.erfolg ? 'GESENDET' : 'FEHLER',
            emailVersuche: emailResult.versuche,
            emailLetzterFehler: emailResult.fehler || null,
            status: newStatus,
          });

          if (!emailResult.erfolg) {
            await sendeWebhook('fehler', webhookDataE, mandant.dmsEmail, pdfPfad).catch(err =>
              console.error(`[${belegNr}] Fehler-Webhook fehlgeschlagen:`, err),
            );
          }
        }).catch(err => console.error(`[${belegNr}] SMTP-Pipeline-Fehler:`, err));
      }

      res.status(201).json({
        success: true,
        belegNr,
      });

    } else if (body.typ === 'SAMMELFAHRT') {
      const parsed = sammelfahrtBody.parse(body);

      // Path Traversal Schutz: Beleg-Pfade validieren
      const validatedBelegPfade = await resolveAndValidateBelegPfade(parsed.belegDateipfade);

      const belegNr = await generateBelegNr('SAMMELFAHRT');

      const [mandant] = await db.select().from(schema.mandanten).where(eq(schema.mandanten.id, parsed.persoenlich.mandantId));
      const [kostenstelle] = parsed.persoenlich.kostenstelleId
        ? await db.select().from(schema.kostenstellen).where(eq(schema.kostenstellen.id, parsed.persoenlich.kostenstelleId))
        : [undefined];

      if (!mandant) {
        res.status(400).json({ error: 'Mandant nicht gefunden' });
        return;
      }
      if (parsed.persoenlich.kostenstelleId && !kostenstelle) {
        res.status(400).json({ error: 'Kostenstelle nicht gefunden' });
        return;
      }

      // Server-Recompute: kmBetrag pro Fahrt aus km × satz, Summen aus den Server-Werten.
      const serverFahrten = parsed.fahrten.map(f => ({
        ...f,
        kmBetrag: berechneKmBetrag(f.km, parsed.verkehrsmittel),
      }));
      const serverKmSumme = rundeAufCent(serverFahrten.reduce((s, f) => s + f.km, 0));
      const serverGesamtbetragS = rundeAufCent(serverFahrten.reduce((s, f) => s + f.kmBetrag, 0));

      // Einreichung speichern (Sammelfahrt nutzt km-Felder, kein VMA)
      const [einreichung] = await db.insert(schema.einreichungen).values({
        typ: 'SAMMELFAHRT',
        belegNr,
        mandantId: parsed.persoenlich.mandantId,
        kostenstelleId: parsed.persoenlich.kostenstelleId || null,
        mitarbeiterVorname: parsed.persoenlich.vorname,
        mitarbeiterNachname: parsed.persoenlich.nachname,
        mitarbeiterPersonalNr: parsed.persoenlich.personalNr || '',
        bankIban: parsed.persoenlich.iban,
        bankKontoinhaber: parsed.persoenlich.kontoinhaber,
        reiseanlass: parsed.reiseanlass,
        verkehrsmittel: parsed.verkehrsmittel,
        kmGefahren: String(serverKmSumme),
        kmPauschaleSatz: kmSatzAlsDecimal(parsed.verkehrsmittel),
        kmBetrag: String(serverGesamtbetragS),
        gesamtbetrag: String(serverGesamtbetragS),
        unterschriftBild: parsed.unterschriftBild || null,
        status: 'EINGEREICHT',
      }).returning();

      // Einzelfahrten als Bulk-Insert
      if (serverFahrten.length > 0) {
        await db.insert(schema.fahrten).values(
          serverFahrten.map((f, i) => ({
            einreichungId: einreichung.id,
            datum: new Date(f.datum),
            startOrt: f.startOrt,
            ziel: f.ziel,
            km: String(f.km),
            kmBetrag: String(f.kmBetrag),
            reihenfolge: i,
          })),
        );
      }

      // Belege als Bulk-Insert
      await speichereBelege(einreichung.id, validatedBelegPfade);

      // PDF generieren
      const pdfPfad = path.join(UPLOAD_DIR, 'pdfs', `${belegNr}.pdf`);
      await erstelleGesamtPdf({
        typ: 'SAMMELFAHRT',
        belegNr,
        mandantName: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelleNr: kostenstelle?.nummer || '',
        kostenstelleBezeichnung: kostenstelle?.bezeichnung || '',
        vorname: parsed.persoenlich.vorname,
        nachname: parsed.persoenlich.nachname,
        personalNr: parsed.persoenlich.personalNr,
        iban: parsed.persoenlich.iban,
        kontoinhaber: parsed.persoenlich.kontoinhaber,
        reiseanlass: parsed.reiseanlass,
        verkehrsmittel: parsed.verkehrsmittel,
        kmSumme: serverKmSumme,
        gesamtbetrag: serverGesamtbetragS,
        fahrten: serverFahrten,
        unterschriftBild: parsed.unterschriftBild,
      }, validatedBelegPfade, pdfPfad);

      await db.update(schema.einreichungen)
        .set({ pdfDateipfad: pdfPfad })
        .where(eq(schema.einreichungen.id, einreichung.id));

      // Versandmethode aus DB lesen
      const [emailConfS] = await db.select().from(schema.emailConfig).limit(1);
      const versandMethodeS = emailConfS?.versandMethode || 'WEBHOOK';
      console.log(`[${belegNr}] Versandmethode: ${versandMethodeS}, PDF: ${pdfPfad}, existiert: ${fs.existsSync(pdfPfad)}`);

      const webhookDataS = {
        id: einreichung.id,
        belegNr,
        typ: 'SAMMELFAHRT' as const,
        status: 'EINGEREICHT',
        mandant: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelle: kostenstelle?.bezeichnung || '',
        mitarbeiter: {
          vorname: parsed.persoenlich.vorname,
          nachname: parsed.persoenlich.nachname,
          personalNr: parsed.persoenlich.personalNr || '',
        },
        gesamtbetrag: String(serverGesamtbetragS),
        iban: parsed.persoenlich.iban,
        kontoinhaber: parsed.persoenlich.kontoinhaber,
        reiseanlass: parsed.reiseanlass,
        verkehrsmittel: parsed.verkehrsmittel,
        kmGefahren: String(serverKmSumme),
        anzahlFahrten: serverFahrten.length,
        fahrten: serverFahrten,
      };

      if (versandMethodeS === 'WEBHOOK') {
        sendeWebhook('eingereicht', webhookDataS, mandant.dmsEmail, pdfPfad)
          .then(() => aktualisiereVersandStatus(einreichung.id, belegNr, { emailStatus: 'GESENDET', status: 'GESENDET' }))
          .catch(async err => {
            console.error(`[${belegNr}] Webhook-Versand fehlgeschlagen:`, err);
            await aktualisiereVersandStatus(einreichung.id, belegNr, {
              emailStatus: 'FEHLER',
              status: 'FEHLER',
              emailLetzterFehler: String(err),
            });
          });
      } else {
        sendeAnDmsMitRetry({
          an: mandant.dmsEmail,
          betreff: `[${belegNr}] ${parsed.persoenlich.vorname} ${parsed.persoenlich.nachname} - ${mandant.name}`,
          text: erstelleSammelfahrtEmailText({
            vorname: parsed.persoenlich.vorname,
            nachname: parsed.persoenlich.nachname,
            personalNr: parsed.persoenlich.personalNr,
            mandantName: mandant.name,
            mandantNr: String(mandant.mandantNr),
            reiseanlass: parsed.reiseanlass,
            verkehrsmittel: parsed.verkehrsmittel,
            kmSumme: serverKmSumme,
            gesamtbetrag: serverGesamtbetragS,
            iban: parsed.persoenlich.iban,
            kontoinhaber: parsed.persoenlich.kontoinhaber,
            fahrten: serverFahrten,
          }),
          pdfDateipfad: pdfPfad,
          pdfDateiname: `${belegNr}.pdf`,
        }).then(async emailResult => {
          const newStatus = emailResult.erfolg ? 'GESENDET' : 'FEHLER';
          await aktualisiereVersandStatus(einreichung.id, belegNr, {
            emailStatus: emailResult.erfolg ? 'GESENDET' : 'FEHLER',
            emailVersuche: emailResult.versuche,
            emailLetzterFehler: emailResult.fehler || null,
            status: newStatus,
          });

          if (!emailResult.erfolg) {
            await sendeWebhook('fehler', webhookDataS, mandant.dmsEmail, pdfPfad).catch(err =>
              console.error(`[${belegNr}] Fehler-Webhook fehlgeschlagen:`, err),
            );
          }
        }).catch(err => console.error(`[${belegNr}] SMTP-Pipeline-Fehler:`, err));
      }

      res.status(201).json({
        success: true,
        belegNr,
      });

    } else {
      res.status(400).json({ error: 'Ungültiger Typ. Erlaubt: REISEKOSTEN, ERSTATTUNG, SAMMELFAHRT' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else {
      console.error('Fehler bei Einreichung:', error instanceof Error ? error.stack : String(error));
      res.status(500).json({
        error: 'Einreichung konnte nicht verarbeitet werden',
      });
    }
  }
});
