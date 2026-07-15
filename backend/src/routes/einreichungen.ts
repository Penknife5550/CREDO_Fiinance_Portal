import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { ERSTATTUNG_KATEGORIE_DEFAULT_KEYS } from '../lib/constants.js';
import { upload, berechneHash, validateMimeType } from '../services/upload.js';
import { generateBelegNr } from '../services/belegNummer.js';
import { erstelleGesamtPdf, erstelleKlassenfahrtPdf } from '../services/pdf.js';
import { resolveAndValidateBelegPfade as resolveBelegPfadeImpl } from '../services/uploadResolve.js';
import { erstelleReisekostenEmailText, erstelleErstattungEmailText, erstelleSammelfahrtEmailText, erstelleKlassenfahrtEmailText } from '../services/emailTexte.js';
import { versendeEinreichung } from '../services/versand.js';
import { kmSatzAlsDecimal, berechneKmBetrag, rundeAufCent } from '../lib/kmSaetze.js';
import { berechneKlassenfahrt, KlassenfahrtBerechnungsfehler, rundeAufCent as rundeAufCentKf } from '../lib/klassenfahrt.js';
import path from 'path';

export const einreichungenRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads');

/** Baut die Beleg-Insert-Zeilen (inkl. SHA256-Hash) ohne einreichungId. Das Hashen
 *  ist Datei-I/O und laeuft daher bewusst VOR einer DB-Transaktion, damit die
 *  Transaktion (Klassenfahrt) die Verbindung nicht waehrend des Lesens haelt. */
async function baueBelegBasisRows(validatedBelegPfade: string[]) {
  return Promise.all(
    validatedBelegPfade.map(async pfad => ({
      dateiname: path.basename(pfad),
      dateityp: path.extname(pfad).replace('.', '').toUpperCase(),
      dateigroesse: 0,
      dateipfad: pfad,
      sha256Hash: await berechneHash(pfad),
    })),
  );
}

/** Speichert hochgeladene Beleg-Dateien für eine Einreichung als Bulk-Insert. */
async function speichereBelege(einreichungId: string, validatedBelegPfade: string[]): Promise<void> {
  if (validatedBelegPfade.length === 0) return;
  const basis = await baueBelegBasisRows(validatedBelegPfade);
  await db.insert(schema.belege).values(basis.map(b => ({ ...b, einreichungId })));
}

/** Erkennt eine PostgreSQL-Unique-Verletzung (z.B. paralleler Idempotenz-Zweitversand). */
function istUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err
    && (err as { code?: string }).code === '23505';
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
  reiseanlass: z.string().min(3),
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
    // Kategorie ist jetzt pro Mandant konfigurierbar — der erlaubte Wertebereich
    // wird nach dem Laden des Mandanten gegen `erstattung_kategorien` geprueft.
    kategorie: z.string().min(1).max(50),
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
  reiseanlass: z.string().min(3),
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

// Klassenfahrt (nur Mandant 40). Betraege duerfen negativ sein (Gutschriften/Rabatte);
// der Server rechnet den FV-Zuschuss je Klasse ueber lib/klassenfahrt.ts neu und traut
// keinem Client-Wert. `anteile` ist bei DIREKT die Betragsverteilung je Klasse.
const klassenfahrtBody = z.object({
  typ: z.literal('KLASSENFAHRT'),
  mandantId: z.string().uuid(),
  einreicher: z.object({
    vorname: z.string().min(1).max(100),
    nachname: z.string().min(1).max(100),
    personalNr: z.string().max(20).optional().default(''),
  }),
  anlass: z.string().min(3).max(500),
  ziel: z.string().max(500).optional().or(z.literal('')),
  // Datum-Strings serverseitig auf Parsebarkeit pruefen — sonst schluegen ungueltige
  // Werte ("", "2026-13-45") erst beim Timestamp-Insert als unklares 500 fehl.
  zeitraumVon: z.string().refine(s => !Number.isNaN(Date.parse(s)), 'Ungültiges Datum'),
  zeitraumBis: z.string().refine(s => !Number.isNaN(Date.parse(s)), 'Ungültiges Datum'),
  klassen: z.array(z.object({
    bezeichnung: z.string().max(100).optional().or(z.literal('')),
    schueler: z.number().int().min(0),
    begleiter: z.number().min(1).max(999), // Pflicht >= 1, Dezimal erlaubt (z.B. 1,5)
    empfaenger: z.string().min(1).max(200),
    iban: z.string().regex(/^DE\d{20}$/),
  })).min(1).max(5),
  kostenzeilen: z.array(z.object({
    oberkategorie: z.enum(['FAHRTKOSTEN', 'UNTERKUNFT', 'AKTIVITAETEN', 'SONSTIGES']),
    bezeichnung: z.string().min(1).max(200),
    modus: z.enum(['PROPORTIONAL', 'DIREKT']),
    betrag: z.number(),
    anteile: z.array(z.number()).max(5).optional(),
  })).min(1).max(50),
  unterschriftBild: z.string().optional(),
  belegDateipfade: z.array(z.string()).max(20), // wie upload.array('belege', 20) — verhindert Hash/PDF-Amplifikation
  idempotenzKey: z.string().min(8).max(64).optional(),
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

      void versendeEinreichung({
        einreichungId: einreichung.id,
        belegNr,
        dmsEmail: mandant.dmsEmail,
        pdfPfad,
        webhookData,
        smtpBetreff: `[${belegNr}] ${parsed.persoenlich.vorname} ${parsed.persoenlich.nachname} - ${mandant.name}`,
        smtpText: erstelleReisekostenEmailText({
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
      });

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

      // Kategorie-Validierung: gegen die fuer den Mandanten hinterlegten Kategorien.
      // Fallback auf die Standard-Kategorien, falls der Mandant noch keine gepflegt hat.
      const mandantKategorien = await db
        .select({ key: schema.erstattungKategorien.key })
        .from(schema.erstattungKategorien)
        .where(and(
          eq(schema.erstattungKategorien.mandantId, parsed.persoenlich.mandantId),
          eq(schema.erstattungKategorien.active, true),
        ));
      const erlaubteKategorien = mandantKategorien.length > 0
        ? new Set(mandantKategorien.map(k => k.key))
        : new Set(ERSTATTUNG_KATEGORIE_DEFAULT_KEYS);
      const ungueltigeKategorie = parsed.positionen.find(p => !erlaubteKategorien.has(p.kategorie));
      if (ungueltigeKategorie) {
        res.status(400).json({ error: `Ungültige Kategorie: ${ungueltigeKategorie.kategorie}` });
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

      // pdfDateipfad speichern + Unterschrift-Biometrie löschen (DSGVO — sie ist im PDF persistiert).
      await db.update(schema.einreichungen)
        .set({ pdfDateipfad: pdfPfad, unterschriftBild: null })
        .where(eq(schema.einreichungen.id, einreichung.id));

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

      void versendeEinreichung({
        einreichungId: einreichung.id,
        belegNr,
        dmsEmail: mandant.dmsEmail,
        pdfPfad,
        webhookData: webhookDataE,
        smtpBetreff: `[${belegNr}] ${parsed.persoenlich.vorname} ${parsed.persoenlich.nachname} - ${mandant.name}`,
        smtpText: erstelleErstattungEmailText({
          vorname: parsed.persoenlich.vorname,
          nachname: parsed.persoenlich.nachname,
          mandantName: mandant.name,
          mandantNr: String(mandant.mandantNr),
          anzahlPositionen: parsed.positionen.length,
          gesamtbetrag: serverGesamtbetragE,
          iban: parsed.persoenlich.iban,
          kontoinhaber: parsed.persoenlich.kontoinhaber,
        }),
      });

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

      // pdfDateipfad speichern + Unterschrift-Biometrie löschen (DSGVO — sie ist im PDF persistiert).
      await db.update(schema.einreichungen)
        .set({ pdfDateipfad: pdfPfad, unterschriftBild: null })
        .where(eq(schema.einreichungen.id, einreichung.id));

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

      void versendeEinreichung({
        einreichungId: einreichung.id,
        belegNr,
        dmsEmail: mandant.dmsEmail,
        pdfPfad,
        webhookData: webhookDataS,
        smtpBetreff: `[${belegNr}] ${parsed.persoenlich.vorname} ${parsed.persoenlich.nachname} - ${mandant.name}`,
        smtpText: erstelleSammelfahrtEmailText({
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
      });

      res.status(201).json({
        success: true,
        belegNr,
      });

    } else if (body.typ === 'KLASSENFAHRT') {
      const parsed = klassenfahrtBody.parse(body);

      // ── M40-Gate: Klassenfahrt-Abrechnung ist ausschliesslich fuer Mandant 40 (Foerderverein).
      //    Der Mandant wird serverseitig ueber die feste Nummer 40 aufgeloest — ein manipulierter
      //    mandantId im Body kann den Vorgang nicht auf einen anderen Mandanten umlenken.
      const [mandant] = await db.select().from(schema.mandanten).where(eq(schema.mandanten.mandantNr, 40));
      if (!mandant) {
        res.status(500).json({ error: 'Mandant 40 (Förderverein) ist nicht konfiguriert.' });
        return;
      }
      if (parsed.mandantId !== mandant.id) {
        res.status(403).json({ error: 'Die Klassenfahrt-Abrechnung ist nur für den Förderverein (Mandant 40) möglich.' });
        return;
      }

      // Zeitraum-Plausibilität (Rückkehr nicht vor Abfahrt).
      if (new Date(parsed.zeitraumBis) < new Date(parsed.zeitraumVon)) {
        res.status(400).json({ error: 'Das Rückkehrdatum darf nicht vor dem Abfahrtdatum liegen.' });
        return;
      }

      // ── Idempotenz-Vorprüfung: identischer Zweitversand (verlorene Response) liefert
      //    denselben Beleg zurück, statt einen zweiten Vorgang (Doppel-DMS/Doppel-Überweisung) anzulegen.
      if (parsed.idempotenzKey) {
        const [vorhanden] = await db.select({ belegNr: schema.einreichungen.belegNr })
          .from(schema.einreichungen)
          .where(eq(schema.einreichungen.idempotenzKey, parsed.idempotenzKey))
          .limit(1);
        if (vorhanden) {
          res.status(200).json({ success: true, belegNr: vorhanden.belegNr, idempotent: true });
          return;
        }
      }

      // ── Beleg-Pflicht (serverseitig): ohne mindestens einen validen Beleg kein Absenden.
      const validatedBelegPfade = await resolveAndValidateBelegPfade(parsed.belegDateipfade);
      if (validatedBelegPfade.length === 0) {
        res.status(400).json({ error: 'Mindestens ein Beleg ist erforderlich.' });
        return;
      }

      // ── DIREKT-Kostenzeilen brauchen je Klasse einen Anteil (Länge = Anzahl Klassen),
      //    sonst ist der Server-Recompute der Verteilung nicht rekonstruierbar.
      const anzahlKlassen = parsed.klassen.length;
      for (const [i, z] of parsed.kostenzeilen.entries()) {
        if (z.modus === 'DIREKT' && (!z.anteile || z.anteile.length !== anzahlKlassen)) {
          res.status(400).json({ error: `Kostenzeile ${i + 1} (direkt): Für jede Klasse muss ein Betrag angegeben werden.` });
          return;
        }
      }

      // ── Geldwerte + Begleiter-Divisor auf DB-Spaltenpräzision (2 Nachkommastellen)
      //    normalisieren. So stimmen berechneter Zuschuss, gespeicherte Anteile und die
      //    Auszahlungstabelle exakt überein (IKS: eine Neuberechnung aus den gespeicherten
      //    Werten ergibt wieder die ausgezahlten Beträge — keine stille DB-Rundungsdivergenz).
      const normKlassen = parsed.klassen.map(k => ({ ...k, begleiter: rundeAufCentKf(k.begleiter) }));
      const normKostenzeilen = parsed.kostenzeilen.map(z => ({
        ...z,
        betrag: rundeAufCentKf(z.betrag),
        anteile: z.anteile?.map(a => rundeAufCentKf(a)),
      }));

      // ── Server-Recompute (autoritativ): Zuschuss je Klasse + Gesamt aus den Roh-Inputs.
      let ergebnis;
      try {
        ergebnis = berechneKlassenfahrt(
          normKlassen.map(k => ({ schueler: k.schueler, begleiter: k.begleiter })),
          normKostenzeilen.map(z => ({
            modus: z.modus,
            betrag: z.betrag,
            anteile: z.modus === 'DIREKT' ? z.anteile : undefined,
          })),
        );
      } catch (err) {
        if (err instanceof KlassenfahrtBerechnungsfehler) {
          res.status(400).json({ error: err.message });
          return;
        }
        throw err;
      }

      // Zeilen-Gesamtbetrag für Speicherung/PDF: DIREKT = Summe der (gerundeten) Anteile,
      // PROPORTIONAL = gerundeter Gesamtbetrag der Zeile.
      const zeilenBetrag = (z: (typeof normKostenzeilen)[number]): number =>
        z.modus === 'DIREKT' ? rundeAufCentKf((z.anteile ?? []).reduce((s, a) => s + a, 0)) : z.betrag;

      const belegNr = await generateBelegNr('KLASSENFAHRT');
      const pdfPfad = path.join(UPLOAD_DIR, 'pdfs', `${belegNr}.pdf`);

      // ── PDF VOR dem Commit erzeugen (Deckblatt + Auszahlungstabelle je Konto + Belege). ──
      //    Schlägt das Rendern fehl (z.B. nicht-WinAnsi-Zeichen in Freitext, Datei-I/O), bricht
      //    der Vorgang ab, OHNE eine unzustellbare Zeile zu committen — ein Retry (auch mit
      //    Idempotenz-Key) läuft sauber neu durch. Nach dem Commit ist die Zeile dank
      //    vorhandenem pdfDateipfad immer per Admin-Requeue nachversendbar.
      await erstelleKlassenfahrtPdf({
        belegNr,
        mandantName: mandant.name,
        mandantNr: mandant.mandantNr,
        anlass: parsed.anlass,
        ziel: parsed.ziel || undefined,
        zeitraumVon: parsed.zeitraumVon,
        zeitraumBis: parsed.zeitraumBis,
        einreicherName: `${parsed.einreicher.vorname} ${parsed.einreicher.nachname}`,
        klassen: normKlassen.map((k, i) => ({
          bezeichnung: k.bezeichnung || undefined,
          schueler: k.schueler,
          begleiter: k.begleiter,
          empfaenger: k.empfaenger,
          iban: k.iban,
          kostenanteil: ergebnis.klassen[i].kostenanteil,
          zuschuss: ergebnis.klassen[i].zuschuss,
        })),
        kostenzeilen: normKostenzeilen.map((z, i) => ({
          oberkategorie: z.oberkategorie,
          bezeichnung: z.bezeichnung,
          modus: z.modus,
          betrag: zeilenBetrag(z),
          anteileJeKlasse: ergebnis.verteilung[i],
        })),
        gesamtZuschuss: ergebnis.gesamtZuschuss,
        unterschriftBild: parsed.unterschriftBild,
      }, validatedBelegPfade, pdfPfad);

      // Belege hashen (Datei-I/O außerhalb der Transaktion).
      const belegBasis = await baueBelegBasisRows(validatedBelegPfade);

      // ── Atomarer Multi-Tabellen-Insert: Kopf + Klassen + Kostenzeilen + Anteile + Belege.
      //    Der Kopf trägt pdfDateipfad von Anfang an — die Biometrie-Unterschrift wird nie in der
      //    DB abgelegt (DSGVO: sie ist bereits im PDF persistiert). ──
      let einreichungId: string;
      try {
        einreichungId = await db.transaction(async (tx) => {
          const [einreichung] = await tx.insert(schema.einreichungen).values({
            typ: 'KLASSENFAHRT',
            belegNr,
            mandantId: mandant.id,
            mitarbeiterVorname: parsed.einreicher.vorname,
            mitarbeiterNachname: parsed.einreicher.nachname,
            mitarbeiterPersonalNr: parsed.einreicher.personalNr || '',
            bankIban: null,
            bankKontoinhaber: null,
            reiseanlass: parsed.anlass,
            reiseziel: parsed.ziel || null,
            abfahrtZeit: new Date(parsed.zeitraumVon),
            rueckkehrZeit: new Date(parsed.zeitraumBis),
            gesamtbetrag: String(ergebnis.gesamtZuschuss),
            pdfDateipfad: pdfPfad,
            unterschriftBild: null,
            idempotenzKey: parsed.idempotenzKey || null,
            status: 'EINGEREICHT',
          }).returning();

          await tx.insert(schema.klassenfahrtKlassen).values(
            normKlassen.map((k, i) => ({
              einreichungId: einreichung.id,
              reihenfolge: i,
              bezeichnung: k.bezeichnung || null,
              schueler: k.schueler,
              begleiter: String(k.begleiter),
              empfaenger: k.empfaenger,
              iban: k.iban,
              zuschuss: String(ergebnis.klassen[i].zuschuss),
            })),
          );

          const zeilenRows = await tx.insert(schema.klassenfahrtKostenzeilen).values(
            normKostenzeilen.map((z, i) => ({
              einreichungId: einreichung.id,
              reihenfolge: i,
              oberkategorie: z.oberkategorie,
              bezeichnung: z.bezeichnung,
              modus: z.modus,
              betrag: String(zeilenBetrag(z)),
            })),
          ).returning({ id: schema.klassenfahrtKostenzeilen.id });

          const anteilRows = normKostenzeilen.flatMap((z, i) =>
            z.modus === 'DIREKT' && z.anteile
              ? z.anteile.map((betrag, klasseIdx) => ({
                  kostenzeileId: zeilenRows[i].id,
                  klasseReihenfolge: klasseIdx,
                  betrag: String(betrag),
                }))
              : [],
          );
          if (anteilRows.length > 0) {
            await tx.insert(schema.klassenfahrtKostenzeileAnteil).values(anteilRows);
          }

          if (belegBasis.length > 0) {
            await tx.insert(schema.belege).values(
              belegBasis.map(b => ({ ...b, einreichungId: einreichung.id })),
            );
          }

          return einreichung.id;
        });
      } catch (err) {
        // Paralleler Idempotenz-Zweitversand: Unique-Verletzung → bereits angelegten Beleg zurückgeben.
        if (parsed.idempotenzKey && istUniqueViolation(err)) {
          const [vorhanden] = await db.select({ belegNr: schema.einreichungen.belegNr })
            .from(schema.einreichungen)
            .where(eq(schema.einreichungen.idempotenzKey, parsed.idempotenzKey))
            .limit(1);
          if (vorhanden) {
            res.status(200).json({ success: true, belegNr: vorhanden.belegNr, idempotent: true });
            return;
          }
        }
        throw err;
      }

      const webhookDataK = {
        id: einreichungId,
        belegNr,
        typ: 'KLASSENFAHRT' as const,
        status: 'EINGEREICHT',
        mandant: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelle: '',
        mitarbeiter: {
          vorname: parsed.einreicher.vorname,
          nachname: parsed.einreicher.nachname,
          personalNr: parsed.einreicher.personalNr || '',
        },
        gesamtbetrag: String(ergebnis.gesamtZuschuss),
        // KF hat kein persönliches Auszahlungskonto — die Konten liegen je Klasse (siehe PDF/SMTP-Text).
        iban: '',
        kontoinhaber: '',
        reiseanlass: parsed.anlass,
      };

      void versendeEinreichung({
        einreichungId,
        belegNr,
        dmsEmail: mandant.dmsEmail,
        pdfPfad,
        webhookData: webhookDataK,
        smtpBetreff: `[${belegNr}] ${parsed.einreicher.vorname} ${parsed.einreicher.nachname} - ${mandant.name}`,
        smtpText: erstelleKlassenfahrtEmailText({
          einreicherName: `${parsed.einreicher.vorname} ${parsed.einreicher.nachname}`,
          personalNr: parsed.einreicher.personalNr || '',
          mandantName: mandant.name,
          mandantNr: String(mandant.mandantNr),
          anlass: parsed.anlass,
          ziel: parsed.ziel || '',
          zeitraumVon: parsed.zeitraumVon,
          zeitraumBis: parsed.zeitraumBis,
          gesamtZuschuss: ergebnis.gesamtZuschuss,
          klassen: parsed.klassen.map((k, i) => ({
            bezeichnung: k.bezeichnung || '',
            empfaenger: k.empfaenger,
            iban: k.iban,
            zuschuss: ergebnis.klassen[i].zuschuss,
          })),
        }),
      });

      res.status(201).json({
        success: true,
        belegNr,
      });

    } else {
      res.status(400).json({ error: 'Ungültiger Typ. Erlaubt: REISEKOSTEN, ERSTATTUNG, SAMMELFAHRT, KLASSENFAHRT' });
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
