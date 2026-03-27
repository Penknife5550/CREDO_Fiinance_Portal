import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { upload, berechneHash, validateMimeType } from '../services/upload.js';
import { generateBelegNr } from '../services/belegNummer.js';
import { erstelleGesamtPdf } from '../services/pdf.js';
import { sendeAnDmsMitRetry } from '../services/email.js';
import { erstelleReisekostenEmailText, erstelleErstattungEmailText } from '../services/emailTexte.js';
import { sendeWebhook } from '../services/webhook.js';
import path from 'path';
import fs from 'fs';

export const einreichungenRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads');

/** Resolve Beleg-Datei-IDs zu absoluten Pfaden und validiere gegen Path Traversal */
function resolveAndValidateBelegPfade(dateiIds: string[]): string[] {
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  return dateiIds.map(id => {
    // Nur den Dateinamen akzeptieren (keine Pfadbestandteile)
    const basename = path.basename(id);

    // In monatlichen Unterordnern suchen
    const subdirs = fs.readdirSync(resolvedUploadDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name));

    for (const subdir of subdirs) {
      const candidate = path.resolve(resolvedUploadDir, subdir.name, basename);
      if (candidate.startsWith(resolvedUploadDir) && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // Fallback: direkt im UPLOAD_DIR
    const directPath = path.resolve(resolvedUploadDir, basename);
    if (!directPath.startsWith(resolvedUploadDir)) {
      throw new Error('Ungültiger Dateipfad: Path Traversal erkannt');
    }
    if (!fs.existsSync(directPath)) {
      throw new Error(`Datei nicht gefunden: ${basename}`);
    }
    return directPath;
  });
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

// ── POST /api/einreichungen — Neue Einreichung ────────

einreichungenRouter.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.typ === 'REISEKOSTEN') {
      const parsed = reisekostenBody.parse(body);

      // Path Traversal Schutz: Beleg-Pfade validieren und auflösen
      const validatedBelegPfade = resolveAndValidateBelegPfade(parsed.belegDateipfade);

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
        kmPauschaleSatz: parsed.verkehrsmittel === 'PKW' ? '0.30' : parsed.verkehrsmittel === 'MOTORRAD' ? '0.20' : '0',
        kmBetrag: String(parsed.kmBetrag),
        vmaBrutto: String(parsed.reisetage.reduce((s, t) => s + t.vmaBrutto, 0)),
        vmaKuerzung: String(parsed.reisetage.reduce((s, t) => s + t.vmaKuerzung, 0)),
        vmaNetto: String(parsed.vmaNetto),
        weitereKostenSumme: String(parsed.weitereKostenSumme),
        gesamtbetrag: String(parsed.gesamtbetrag),
        unterschriftBild: parsed.unterschriftBild,
        status: 'EINGEREICHT',
      }).returning();

      // Reisetage speichern
      for (const tag of parsed.reisetage) {
        await db.insert(schema.reisetage).values({
          einreichungId: einreichung.id,
          datum: new Date(tag.datum),
          typ: tag.typ,
          fruehstueckGestellt: tag.fruehstueckGestellt,
          mittagGestellt: tag.mittagGestellt,
          abendGestellt: tag.abendGestellt,
          vmaBrutto: String(tag.vmaBrutto),
          vmaKuerzung: String(tag.vmaKuerzung),
          vmaNetto: String(tag.vmaNetto),
        });
      }

      // Weitere Kosten speichern
      for (const k of parsed.weitereKosten) {
        await db.insert(schema.weitereKosten).values({
          einreichungId: einreichung.id,
          typ: k.typ,
          beschreibung: k.beschreibung,
          betrag: String(k.betrag),
        });
      }

      // Belege in DB registrieren (validierte Pfade verwenden)
      for (const pfad of validatedBelegPfade) {
        const hash = await berechneHash(pfad);
        await db.insert(schema.belege).values({
          einreichungId: einreichung.id,
          dateiname: path.basename(pfad),
          dateityp: path.extname(pfad).replace('.', '').toUpperCase(),
          dateigroesse: 0,
          dateipfad: pfad,
          sha256Hash: hash,
        });
      }

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
        kmBetrag: parsed.kmBetrag,
        vmaNetto: parsed.vmaNetto,
        weitereKostenSumme: parsed.weitereKostenSumme,
        gesamtbetrag: parsed.gesamtbetrag,
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

      // PDF-Pfad in DB speichern
      await db.update(schema.einreichungen)
        .set({ pdfDateipfad: pdfPfad })
        .where(eq(schema.einreichungen.id, einreichung.id));

      // Webhook an n8n senden (fire-and-forget) — inkl. PDF als Base64
      sendeWebhook('eingereicht', {
        id: einreichung.id,
        belegNr,
        typ: 'REISEKOSTEN',
        status: 'EINGEREICHT',
        mandant: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelle: kostenstelle?.bezeichnung || '',
        mitarbeiter: {
          vorname: parsed.persoenlich.vorname,
          nachname: parsed.persoenlich.nachname,
          personalNr: parsed.persoenlich.personalNr || '',
        },
        gesamtbetrag: String(parsed.gesamtbetrag),
        iban: parsed.persoenlich.iban,
        kontoinhaber: parsed.persoenlich.kontoinhaber,
        reiseziel: parsed.reiseziel,
        reiseanlass: parsed.reiseanlass,
        verkehrsmittel: parsed.verkehrsmittel,
        kmGefahren: String(parsed.kmGefahren),
        vmaNetto: String(parsed.vmaNetto),
      }, mandant.dmsEmail, pdfPfad).catch(console.error);

      // E-Mail an DMS senden (fire-and-forget — blockiert nicht den Response)
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
          gesamtbetrag: parsed.gesamtbetrag,
          iban: parsed.persoenlich.iban,
          kontoinhaber: parsed.persoenlich.kontoinhaber,
          reisetage: parsed.reisetage,
        }),
        pdfDateipfad: pdfPfad,
        pdfDateiname: `${belegNr}.pdf`,
      }).then(emailResult => {
        const newStatus = emailResult.erfolg ? 'GESENDET' : 'FEHLER';
        db.update(schema.einreichungen)
          .set({
            emailStatus: emailResult.erfolg ? 'GESENDET' : 'FEHLER',
            emailVersuche: emailResult.versuche,
            emailLetzterFehler: emailResult.fehler || null,
            status: newStatus,
          })
          .where(eq(schema.einreichungen.id, einreichung.id));

        // Webhook bei Statusänderung oder Fehler
        if (!emailResult.erfolg) {
          sendeWebhook('fehler', {
            id: einreichung.id,
            belegNr,
            typ: 'REISEKOSTEN',
            status: 'FEHLER',
            mandant: mandant.name,
            mandantNr: mandant.mandantNr,
            kostenstelle: kostenstelle?.bezeichnung || '',
            mitarbeiter: { vorname: parsed.persoenlich.vorname, nachname: parsed.persoenlich.nachname, personalNr: parsed.persoenlich.personalNr || '' },
            gesamtbetrag: String(parsed.gesamtbetrag),
            iban: parsed.persoenlich.iban,
            kontoinhaber: parsed.persoenlich.kontoinhaber,
          }, mandant.dmsEmail).catch(console.error);
        }
      }).catch(console.error);

      res.status(201).json({
        success: true,
        belegNr,
      });

    } else if (body.typ === 'ERSTATTUNG') {
      const parsed = erstattungBody.parse(body);

      // Path Traversal Schutz: Beleg-Pfade validieren und auflösen
      const validatedBelegPfade = resolveAndValidateBelegPfade(parsed.belegDateipfade);

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
        gesamtbetrag: String(parsed.gesamtbetrag),
        unterschriftBild: parsed.unterschriftBild || null,
        status: 'EINGEREICHT',
      }).returning();

      // Positionen speichern
      for (const pos of parsed.positionen) {
        await db.insert(schema.positionen).values({
          einreichungId: einreichung.id,
          beschreibung: pos.beschreibung,
          kategorie: pos.kategorie,
          datum: new Date(pos.datum),
          betrag: String(pos.betrag),
        });
      }

      // Belege registrieren (validierte Pfade verwenden)
      for (const pfad of validatedBelegPfade) {
        const hash = await berechneHash(pfad);
        await db.insert(schema.belege).values({
          einreichungId: einreichung.id,
          dateiname: path.basename(pfad),
          dateityp: path.extname(pfad).replace('.', '').toUpperCase(),
          dateigroesse: 0,
          dateipfad: pfad,
          sha256Hash: hash,
        });
      }

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
        gesamtbetrag: parsed.gesamtbetrag,
        positionen: parsed.positionen,
        unterschriftBild: parsed.unterschriftBild,
      }, validatedBelegPfade, pdfPfad);

      await db.update(schema.einreichungen)
        .set({ pdfDateipfad: pdfPfad })
        .where(eq(schema.einreichungen.id, einreichung.id));

      // Webhook an n8n senden (fire-and-forget) — inkl. PDF als Base64
      sendeWebhook('eingereicht', {
        id: einreichung.id,
        belegNr,
        typ: 'ERSTATTUNG',
        status: 'EINGEREICHT',
        mandant: mandant.name,
        mandantNr: mandant.mandantNr,
        kostenstelle: kostenstelle?.bezeichnung || '',
        mitarbeiter: {
          vorname: parsed.persoenlich.vorname,
          nachname: parsed.persoenlich.nachname,
          personalNr: parsed.persoenlich.personalNr || '',
        },
        gesamtbetrag: String(parsed.gesamtbetrag),
        iban: parsed.persoenlich.iban,
        kontoinhaber: parsed.persoenlich.kontoinhaber,
        anzahlPositionen: parsed.positionen.length,
      }, mandant.dmsEmail, pdfPfad).catch(console.error);

      // E-Mail an DMS (fire-and-forget — blockiert nicht den Response)
      sendeAnDmsMitRetry({
        an: mandant.dmsEmail,
        betreff: `[${belegNr}] ${parsed.persoenlich.vorname} ${parsed.persoenlich.nachname} - ${mandant.name}`,
        text: erstelleErstattungEmailText({
          vorname: parsed.persoenlich.vorname,
          nachname: parsed.persoenlich.nachname,
          mandantName: mandant.name,
          mandantNr: String(mandant.mandantNr),
          anzahlPositionen: parsed.positionen.length,
          gesamtbetrag: parsed.gesamtbetrag,
          iban: parsed.persoenlich.iban,
          kontoinhaber: parsed.persoenlich.kontoinhaber,
        }),
        pdfDateipfad: pdfPfad,
        pdfDateiname: `${belegNr}.pdf`,
      }).then(emailResult => {
        const newStatus = emailResult.erfolg ? 'GESENDET' : 'FEHLER';
        db.update(schema.einreichungen)
          .set({
            emailStatus: emailResult.erfolg ? 'GESENDET' : 'FEHLER',
            emailVersuche: emailResult.versuche,
            emailLetzterFehler: emailResult.fehler || null,
            status: newStatus,
          })
          .where(eq(schema.einreichungen.id, einreichung.id));

        if (!emailResult.erfolg) {
          sendeWebhook('fehler', {
            id: einreichung.id,
            belegNr,
            typ: 'ERSTATTUNG',
            status: 'FEHLER',
            mandant: mandant.name,
            mandantNr: mandant.mandantNr,
            kostenstelle: kostenstelle?.bezeichnung || '',
            mitarbeiter: { vorname: parsed.persoenlich.vorname, nachname: parsed.persoenlich.nachname, personalNr: parsed.persoenlich.personalNr || '' },
            gesamtbetrag: String(parsed.gesamtbetrag),
            iban: parsed.persoenlich.iban,
            kontoinhaber: parsed.persoenlich.kontoinhaber,
          }, mandant.dmsEmail).catch(console.error);
        }
      }).catch(console.error);

      res.status(201).json({
        success: true,
        belegNr,
      });

    } else {
      res.status(400).json({ error: 'Ungültiger Typ. Erlaubt: REISEKOSTEN, ERSTATTUNG' });
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
