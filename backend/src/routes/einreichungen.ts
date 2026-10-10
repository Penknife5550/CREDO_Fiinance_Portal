import { Router, type Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ERSTATTUNG_KATEGORIE_DEFAULT_KEYS, FALLBACK_LAND_KEY, RESERVIERTE_LAND_KEYS } from '../lib/constants.js';
import { upload, berechneHash, validateMimeType } from '../services/upload.js';
import { generateBelegNr } from '../services/belegNummer.js';
import { erstelleGesamtPdf, erstelleKlassenfahrtPdf } from '../services/pdf.js';
import { resolveAndValidateBelegPfade as resolveBelegPfadeImpl } from '../services/uploadResolve.js';
import { erstelleReisekostenEmailText, erstelleErstattungEmailText, erstelleSammelfahrtEmailText, erstelleKlassenfahrtEmailText } from '../services/emailTexte.js';
import { versendeEinreichung } from '../services/versand.js';
import { pruefeAnhangGroesse } from '../services/email-utils.js';
import { kmSatzAlsDecimal, berechneKmBetrag, rundeAufCent } from '../lib/kmSaetze.js';
import { berechneKlassenfahrt, KlassenfahrtBerechnungsfehler, rundeAufCent as rundeAufCentKf } from '../lib/klassenfahrt.js';
import { vmaTag } from '../lib/vma.js';
import { bildeReisetage, bestimmeTageslaender, satzLandKey, waehleTagesSatz, ReisetageFehler, type ReisetagSoll, type Satzstand } from '../lib/reisetage.js';
import { ordneTageZu, landBezeichnung, reiselandFolge, quellenVermerk, ueberschneidungsVermerke, type Ueberschneidung } from '../lib/reiseangaben.js';
import path from 'path';
import fs from 'fs';

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

/** Erkennt eine PostgreSQL-Unique-Verletzung (z.B. paralleler Idempotenz-Zweitversand). */
function istUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err
    && (err as { code?: string }).code === '23505';
}

/** Wrapper, bindet die in services/uploadResolve.ts implementierte Logik an UPLOAD_DIR. */
function resolveAndValidateBelegPfade(dateiIds: string[]): Promise<string[]> {
  return resolveBelegPfadeImpl(dateiIds, UPLOAD_DIR);
}

/**
 * Prüft die fertige PDF gegen die SMTP-Nachrichtengrenze VOR dem Commit (Audit #8).
 * Ist der Anhang zu groß, wird 400 gesendet und `false` zurückgegeben — der Nutzer
 * erfährt es sofort, statt einen Datensatz zu committen, der beim Versand permanent
 * scheitert (der einzige Anhang der Mail ist diese PDF, Belege sind darin eingebettet).
 */
function pdfPasstInMailOderAntworte(res: Response, pdfPfad: string): boolean {
  const check = pruefeAnhangGroesse(fs.statSync(pdfPfad).size);
  if (!check.ok) {
    res.status(400).json({ error: check.fehler });
    return false;
  }
  return true;
}

/**
 * Frühere Reisekostenabrechnungen derselben Person mit gemeinsamem Reisetag.
 * Person = Personalnr. + Nachname, wenn eine Personalnr. angegeben ist (Personalnummern werden je
 * Mandant vergeben und frei eingetippt — die Nummer allein träfe fremde Personen), sonst
 * Nachname + Vorname + IBAN; jeweils ohne Groß-/Kleinschreibung.
 */
async function findeUeberschneidungen(
  person: { vorname: string; nachname: string; personalNr: string; iban: string },
  tage: ReadonlyArray<{ datum: string; typ: string }>,
): Promise<Ueberschneidung[]> {
  const e = schema.einreichungen;
  const personalNr = person.personalNr.trim();
  const gleicherNachname = sql`lower(btrim(${e.mitarbeiterNachname})) = lower(${person.nachname.trim()})`;
  const gleichePerson = personalNr
    ? and(sql`lower(btrim(${e.mitarbeiterPersonalNr})) = lower(${personalNr})`, gleicherNachname)
    : and(
        gleicherNachname,
        sql`lower(btrim(${e.mitarbeiterVorname})) = lower(${person.vorname.trim()})`,
        sql`upper(${e.bankIban}) = upper(${person.iban})`,
      );
  const treffer = await db
    .select({
      belegNr: e.belegNr,
      datum: sql<string>`to_char(${schema.reisetage.datum}, 'YYYY-MM-DD')`,
      typ: schema.reisetage.typ,
    })
    .from(schema.reisetage)
    .innerJoin(e, eq(schema.reisetage.einreichungId, e.id))
    .where(and(eq(e.typ, 'REISEKOSTEN'), gleichePerson, inArray(sql`${schema.reisetage.datum}::date`, tage.map(t => t.datum))));
  const typJeDatum = new Map(tage.map(t => [t.datum, t.typ]));
  return treffer.map(t => ({
    belegNr: t.belegNr,
    datum: t.datum,
    beideEintaegig: t.typ === 'EINTAEGIG' && typJeDatum.get(t.datum) === 'EINTAEGIG',
  }));
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

// Datums-String, der tatsächlich parsebar ist (Audit #12) — sonst schlägt ein
// ungültiges Datum erst beim Timestamp-Insert als unklares 500 fehl statt als 400.
const isoDatum = z.string().refine(s => !Number.isNaN(Date.parse(s)), 'Ungültiges Datum');
// Obergrenzen passend zur DB-Spaltenpräzision (Audit #13) → sauberes 400 statt numeric-overflow-500.
const MAX_BETRAG = 99999999.99; // decimal(10,2)
const MAX_KM = 999999.99;       // decimal(8,2)
// Verpflegungspauschale je Tag: großzügiger Deckel (realer Höchstsatz 24h-Ausland ~75 €).
// Interim-Schutz gegen client-manipulierte VMA (Audit #2), bis der Server sie selbst neu rechnet.
const MAX_VMA_TAG = 200;

const persoenlichSchema = z.object({
  vorname: z.string().min(1).max(100),
  nachname: z.string().min(1).max(100),
  personalNr: z.string().max(20).optional().default(''),
  iban: z.string().regex(/^DE\d{20}$/),
  kontoinhaber: z.string().min(1).max(200),
  mandantId: z.string().uuid(),
  kostenstelleId: z.string().uuid().optional().or(z.literal('')),
});

// datetime-local-Wert (Wanduhrzeit) ohne 'Z'/Offset: Die Tagesbildung rechnet mit den
// String-Teilen — mit Offset liefen Reisetage und gespeicherter Zeitpunkt auseinander.
// Unmögliche Kalenderzeitpunkte (30.02., 24:00) weist bildeReisetage mit 400 ab.
const wanduhrZeit = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:[0-5]\d)?$/, 'Ungültiger Zeitpunkt');
// Landangabe je Reisetag: Land-Key, 'INLAND', 'ANDERES' oder 'SEETAG'; leer/null = keine Angabe.
const tagesLandAngabe = z.string().max(100).nullable().optional();

const reisekostenBody = z.object({
  typ: z.literal('REISEKOSTEN'),
  persoenlich: persoenlichSchema,
  reiseanlass: z.string().min(3).max(500),
  reiseziel: z.string().min(1).max(500),
  abfahrtOrt: z.enum(['WOHNUNG', 'TAETIGKEIT']),
  abfahrtZeit: wanduhrZeit,
  rueckkehrZeit: wanduhrZeit,
  land: z.string().max(100).nullable().optional(), // Hauptland; null = Inlandsreise
  // Auswärtige Übernachtung — Pflicht nur bei < 24 h über zwei Kalendertage; ab 24 h über zwei
  // Kalendertage zählt false (ein Ganztag), null = mit Übernachtung; sonst ohne Bedeutung.
  uebernachtung: z.boolean().nullable().optional(),
  verkehrsmittel: z.enum(['PKW', 'MOTORRAD', 'OEPNV', 'BAHN', 'FLUG', 'SONSTIGE']),
  kmGefahren: z.number().min(0).max(MAX_KM),
  kmBetrag: z.number().min(0).max(MAX_BETRAG),
  // Datum, Typ und Beträge bestimmt der Server; je Tag zählen nur Mahlzeiten und Landangaben.
  reisetage: z.array(z.object({
    datum: isoDatum,
    typ: z.enum(['ANREISE', 'GANZTAG', 'ABREISE', 'EINTAEGIG']),
    fruehstueckGestellt: z.boolean(),
    mittagGestellt: z.boolean(),
    abendGestellt: z.boolean(),
    vmaBrutto: z.number().min(0).max(MAX_VMA_TAG),
    vmaKuerzung: z.number().min(0).max(MAX_VMA_TAG),
    vmaNetto: z.number().min(0).max(MAX_VMA_TAG),
    land24uhr: tagesLandAngabe,
    letzterTaetigkeitsort: tagesLandAngabe,
    landFreitext: tagesLandAngabe,
  })).max(60),
  vmaNetto: z.number().min(0).max(MAX_BETRAG),
  weitereKosten: z.array(z.object({
    typ: z.string().max(50),
    beschreibung: z.string().max(500),
    betrag: z.number().positive().max(MAX_BETRAG),
  })).max(50),
  weitereKostenSumme: z.number().min(0).max(MAX_BETRAG),
  gesamtbetrag: z.number().positive().max(MAX_BETRAG),
  unterschriftBild: z.string().optional(),
  belegDateipfade: z.array(z.string()).max(20),
});

const erstattungBody = z.object({
  typ: z.literal('ERSTATTUNG'),
  persoenlich: persoenlichSchema,
  positionen: z.array(z.object({
    beschreibung: z.string().min(5).max(500),
    // Kategorie ist jetzt pro Mandant konfigurierbar — der erlaubte Wertebereich
    // wird nach dem Laden des Mandanten gegen `erstattung_kategorien` geprueft.
    kategorie: z.string().min(1).max(50),
    datum: isoDatum,
    betrag: z.number().positive().max(MAX_BETRAG),
  })).min(1).max(100),
  gesamtbetrag: z.number().positive().max(MAX_BETRAG),
  unterschriftBild: z.string().optional(),
  belegDateipfade: z.array(z.string()).max(20),
});

const sammelfahrtBody = z.object({
  typ: z.literal('SAMMELFAHRT'),
  persoenlich: persoenlichSchema,
  reiseanlass: z.string().min(3),
  verkehrsmittel: z.enum(['PKW', 'MOTORRAD']),
  fahrten: z.array(z.object({
    datum: isoDatum,
    startOrt: z.string().min(1).max(500),
    ziel: z.string().min(1).max(500),
    km: z.number().positive().max(MAX_KM),
    kmBetrag: z.number().nonnegative().max(MAX_BETRAG),
  })).min(2).max(50),
  kmSumme: z.number().positive().max(MAX_BETRAG),
  gesamtbetrag: z.number().positive().max(MAX_BETRAG),
  unterschriftBild: z.string().optional(),
  belegDateipfade: z.array(z.string()).max(20),
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
    schueler: z.number().int().min(0).max(9999),
    begleiter: z.number().min(1).max(999), // Pflicht >= 1, Dezimal erlaubt (z.B. 1,5)
    empfaenger: z.string().min(1).max(200),
    iban: z.string().regex(/^DE\d{20}$/),
  })).min(1).max(5),
  kostenzeilen: z.array(z.object({
    oberkategorie: z.enum(['FAHRTKOSTEN', 'UNTERKUNFT', 'AKTIVITAETEN', 'SONSTIGES']),
    bezeichnung: z.string().min(1).max(200),
    modus: z.enum(['PROPORTIONAL', 'DIREKT']),
    betrag: z.number().min(-MAX_BETRAG).max(MAX_BETRAG),
    anteile: z.array(z.number().min(-MAX_BETRAG).max(MAX_BETRAG)).max(5).optional(),
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

      // Server-Recompute (autoritativ): km + VMA je Tag aus den Roh-Inputs NEU berechnen — die
      // vom Client gelieferten VMA-Beträge werden ignoriert, sonst wäre der Auszahlungsbetrag
      // client-manipulierbar (Audit #2). Fachliche Fehler (ReisetageFehler) → 400 im catch unten.
      const serverKmBetrag = berechneKmBetrag(parsed.kmGefahren, parsed.verkehrsmittel);
      const hauptland = parsed.land || null;

      // Reisetage serverseitig aus Abfahrt/Rückkehr (+ Übernachtung) bilden, zeitzonenunabhängig.
      // Die Client-Tage werden nur per Datum zugeordnet (Mahlzeiten + Landangaben); Anzahl,
      // Datum und Typ bestimmt der Server.
      let sollTage: ReisetagSoll[];
      try {
        sollTage = bildeReisetage(parsed.abfahrtZeit, parsed.rueckkehrZeit, parsed.uebernachtung ?? null);
      } catch (err) {
        // Ein noch geöffnetes altes Formular kennt die Übernachtungsfrage nicht (sendet das Feld
        // gar nicht, das neue sendet immer null oder true/false) → Hinweis auf Neuladen.
        if (err instanceof ReisetageFehler && err.code === 'UEBERNACHTUNG_FEHLT' && parsed.uebernachtung === undefined) {
          res.status(400).json({
            error: 'Das Formular wurde aktualisiert. Bitte laden Sie die Seite neu und geben Sie an, ob Sie auswärts übernachtet haben.',
          });
          return;
        }
        throw err;
      }
      const paare = ordneTageZu(sollTage, parsed.reisetage);
      if (!paare) {
        res.status(400).json({ error: 'Die Reisetage passen nicht zum Reisezeitraum. Bitte laden Sie die Seite neu und prüfen Sie Ihre Angaben.' });
        return;
      }
      const tage = paare.map(({ soll, client }) => ({
        ...soll,
        fruehstueckGestellt: client.fruehstueckGestellt,
        mittagGestellt: client.mittagGestellt,
        abendGestellt: client.abendGestellt,
        land24uhr: client.land24uhr || null,
        letzterTaetigkeitsort: client.letzterTaetigkeitsort || null,
        landFreitext: client.landFreitext ?? null,
      }));

      // Maßgebendes Land je Tag (§ 9 Abs. 4a S. 5 EStG); alter Client ohne Tagesfelder → Hauptland bzw. Inland.
      const laender = bestimmeTageslaender(tage, hauptland);
      const landNamen = laender.map(landBezeichnung);

      // Gespeichert werden auch nicht maßgebende Angaben (z. B. Ort um 24 Uhr neben der Tätigkeit) —
      // daher jede Landangabe auf einen bekannten Land-Key prüfen, nicht nur das maßgebende Land.
      const angegebeneLaender = tage
        .flatMap(t => [t.land24uhr, t.letzterTaetigkeitsort])
        .filter((k): k is string => !!k && !RESERVIERTE_LAND_KEYS.includes(k));

      // Satzstände aller benötigten Länder (inkl. Hauptland) in EINER Abfrage — 24 h = Ganztag,
      // 8 h = An-/Abreise bzw. eintägig > 8 h (BMF-Endbeträge); ANDERES/SEETAG → Luxemburg,
      // Inland 28/14. Je Tag gilt der Stand seines Kalenderjahres (waehleTagesSatz). Luxemburg
      // immer mitladen: sein Stand zeigt, ob das Reisejahr überhaupt hinterlegt ist (passende Meldung).
      const auslandsKeys = [hauptland, ...angegebeneLaender, ...laender.map(l => satzLandKey(l.landKey))]
        .filter((k): k is string => k !== null);
      const satzKeys = auslandsKeys.length > 0 ? [...new Set([...auslandsKeys, FALLBACK_LAND_KEY])] : [];
      const satzZeilen = satzKeys.length > 0
        ? await db.select({
            landKey: schema.pauschalenAusland.landKey,
            gueltigVon: schema.pauschalenAusland.gueltigVon,
            quelle: schema.pauschalenAusland.quelle,
            tagessatz24h: schema.pauschalenAusland.tagessatz24h,
            tagessatz8h: schema.pauschalenAusland.tagessatz8h,
          }).from(schema.pauschalenAusland).where(inArray(schema.pauschalenAusland.landKey, satzKeys))
        : [];
      const staende: Satzstand[] = satzZeilen.map(z => ({
        landKey: z.landKey,
        gueltigVon: z.gueltigVon,
        quelle: z.quelle,
        satz24h: Number(z.tagessatz24h),
        satz8h: Number(z.tagessatz8h),
      }));
      const bekannteLaender = new Set(staende.map(s => s.landKey));
      const unbekanntesLand = [hauptland, ...angegebeneLaender].find(k => k && !bekannteLaender.has(k));
      if (unbekanntesLand) {
        res.status(400).json({ error: `Unbekanntes Reiseland: ${unbekanntesLand}` });
        return;
      }

      const serverReisetage = tage.map((t, i) => {
        const satz = waehleTagesSatz(laender[i].landKey, t.datum, staende);
        return {
          ...t,
          landKey: laender[i].landKey,
          landFreitext: laender[i].landFreitext,
          satz,
          // Eintägig: Anspruch nur bei strikt MEHR als 8 h — aus Abfahrt/Rückkehr (bildeReisetage).
          ...vmaTag(
            {
              typ: t.typ,
              fruehstueckGestellt: t.fruehstueckGestellt,
              mittagGestellt: t.mittagGestellt,
              abendGestellt: t.abendGestellt,
              eintaegigUeber8h: t.eintaegigUeber8h,
            },
            satz,
          ),
        };
      });
      const pauschalenQuellen = quellenVermerk(serverReisetage.map(t => ({ datum: t.datum, landKey: t.landKey, satzQuelle: t.satz.quelle })));

      // Überschneidung mit früheren Reisekosten derselben Person (nur die höhere Pauschale bzw.
      // bei zwei eintägigen Reisen Zeiten zusammenrechnen) → Prüfvermerk in PDF und Mail, keine
      // Blockade/Verrechnung.
      const ueberschneidungen = await findeUeberschneidungen(parsed.persoenlich, tage);
      const pruefvermerke = ueberschneidungsVermerke(ueberschneidungen);
      const ueberschneidungsTage = new Set(ueberschneidungen.map(u => u.datum));

      const serverVmaBrutto = rundeAufCent(serverReisetage.reduce((s, t) => s + t.vmaBrutto, 0));
      const serverVmaKuerzung = rundeAufCent(serverReisetage.reduce((s, t) => s + t.vmaKuerzung, 0));
      const serverVmaNetto = rundeAufCent(serverReisetage.reduce((s, t) => s + t.vmaNetto, 0));
      const serverWeitereKostenSumme = rundeAufCent(parsed.weitereKosten.reduce((s, k) => s + k.betrag, 0));
      const serverGesamtbetrag = rundeAufCent(serverKmBetrag + serverVmaNetto + serverWeitereKostenSumme);

      // ── Belegnummer + PDF VOR dem Commit (Audit #10): schlägt das Rendern fehl
      //    (z.B. nicht-WinAnsi-Zeichen, Datei-I/O), bricht der Vorgang ab, OHNE einen
      //    unzustellbaren Datensatz zu committen — ein Retry läuft sauber neu durch. ──
      const belegNr = await generateBelegNr('REISEKOSTEN');
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
        reiseland: reiselandFolge(laender),
        reisetage: serverReisetage.map((t, i) => ({
          datum: t.datum,
          typ: t.typ,
          landKey: t.landKey,
          land: landNamen[i],
          vmaBrutto: t.vmaBrutto,
          vmaKuerzung: t.vmaKuerzung,
          vmaNetto: t.vmaNetto,
          fruehstueckGestellt: t.fruehstueckGestellt,
          mittagGestellt: t.mittagGestellt,
          abendGestellt: t.abendGestellt,
          ueberschneidung: ueberschneidungsTage.has(t.datum),
        })),
        pruefvermerke,
        pauschalenQuellen,
        weitereKosten: parsed.weitereKosten,
        unterschriftBild: parsed.unterschriftBild,
      }, validatedBelegPfade, pdfPfad);

      // Anhang-Größencheck VOR dem Commit (Audit #8): zu große PDF → 400 statt totem Datensatz.
      if (!pdfPasstInMailOderAntworte(res, pdfPfad)) return;

      // Belege hashen (Datei-I/O außerhalb der Transaktion).
      const belegBasis = await baueBelegBasisRows(validatedBelegPfade);

      // ── Atomarer Insert: Kopf (inkl. pdfDateipfad, ohne Biometrie) + Reisetage +
      //    weitere Kosten + Belege. Die Biometrie-Unterschrift wird nie persistiert
      //    (DSGVO — sie ist bereits im PDF enthalten). ──
      const einreichungId = await db.transaction(async (tx) => {
        const [einreichung] = await tx.insert(schema.einreichungen).values({
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
          land: hauptland,
          uebernachtung: parsed.uebernachtung ?? null,
          verkehrsmittel: parsed.verkehrsmittel,
          kmGefahren: String(parsed.kmGefahren),
          kmPauschaleSatz: kmSatzAlsDecimal(parsed.verkehrsmittel),
          kmBetrag: String(serverKmBetrag),
          vmaBrutto: String(serverVmaBrutto),
          vmaKuerzung: String(serverVmaKuerzung),
          vmaNetto: String(serverVmaNetto),
          weitereKostenSumme: String(serverWeitereKostenSumme),
          gesamtbetrag: String(serverGesamtbetrag),
          pdfDateipfad: pdfPfad,
          unterschriftBild: null,
          status: 'EINGEREICHT',
        }).returning();

        if (serverReisetage.length > 0) {
          await tx.insert(schema.reisetage).values(
            serverReisetage.map(tag => ({
              einreichungId: einreichung.id,
              datum: new Date(tag.datum),
              typ: tag.typ,
              fruehstueckGestellt: tag.fruehstueckGestellt,
              mittagGestellt: tag.mittagGestellt,
              abendGestellt: tag.abendGestellt,
              vmaBrutto: String(tag.vmaBrutto),
              vmaKuerzung: String(tag.vmaKuerzung),
              vmaNetto: String(tag.vmaNetto),
              land24uhr: tag.land24uhr,
              letzterTaetigkeitsort: tag.letzterTaetigkeitsort,
              landKey: tag.landKey,
              landFreitext: tag.landFreitext,
              satz24h: String(tag.satz.satz24h),
              satz8h: String(tag.satz.satz8h),
              satzQuelle: tag.satz.quelle,
            })),
          );
        }

        if (parsed.weitereKosten.length > 0) {
          await tx.insert(schema.weitereKosten).values(
            parsed.weitereKosten.map(k => ({
              einreichungId: einreichung.id,
              typ: k.typ,
              beschreibung: k.beschreibung,
              betrag: String(k.betrag),
            })),
          );
        }

        if (belegBasis.length > 0) {
          await tx.insert(schema.belege).values(
            belegBasis.map(b => ({ ...b, einreichungId: einreichung.id })),
          );
        }

        return einreichung.id;
      });

      const webhookData = {
        id: einreichungId,
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
        einreichungId,
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
          land: hauptland,
          reiseland: reiselandFolge(laender),
          gesamtbetrag: serverGesamtbetrag,
          iban: parsed.persoenlich.iban,
          kontoinhaber: parsed.persoenlich.kontoinhaber,
          reisetage: serverReisetage.map((t, i) => ({
            datum: t.datum,
            land: landNamen[i],
            fruehstueckGestellt: t.fruehstueckGestellt,
            mittagGestellt: t.mittagGestellt,
            abendGestellt: t.abendGestellt,
          })),
          pruefvermerke,
          pauschalenQuellen,
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

      // ── Belegnummer + PDF VOR dem Commit (Audit #10): schlägt das Rendern fehl
      //    (z.B. nicht-WinAnsi-Zeichen, Datei-I/O), bricht der Vorgang ab, OHNE einen
      //    unzustellbaren Datensatz zu committen — ein Retry läuft sauber neu durch. ──
      const belegNr = await generateBelegNr('ERSTATTUNG');
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

      // Anhang-Größencheck VOR dem Commit (Audit #8): zu große PDF → 400 statt totem Datensatz.
      if (!pdfPasstInMailOderAntworte(res, pdfPfad)) return;

      // Belege hashen (Datei-I/O außerhalb der Transaktion).
      const belegBasis = await baueBelegBasisRows(validatedBelegPfade);

      // ── Atomarer Insert: Kopf (inkl. pdfDateipfad, ohne Biometrie) + Positionen + Belege. ──
      const einreichungId = await db.transaction(async (tx) => {
        const [einreichung] = await tx.insert(schema.einreichungen).values({
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
          pdfDateipfad: pdfPfad,
          unterschriftBild: null,
          status: 'EINGEREICHT',
        }).returning();

        if (parsed.positionen.length > 0) {
          await tx.insert(schema.positionen).values(
            parsed.positionen.map(pos => ({
              einreichungId: einreichung.id,
              beschreibung: pos.beschreibung,
              kategorie: pos.kategorie,
              datum: new Date(pos.datum),
              betrag: String(pos.betrag),
            })),
          );
        }

        if (belegBasis.length > 0) {
          await tx.insert(schema.belege).values(
            belegBasis.map(b => ({ ...b, einreichungId: einreichung.id })),
          );
        }

        return einreichung.id;
      });

      const webhookDataE = {
        id: einreichungId,
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
        einreichungId,
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

      // ── Belegnummer + PDF VOR dem Commit (Audit #10): schlägt das Rendern fehl,
      //    wird kein unzustellbarer Datensatz angelegt; ein Retry läuft sauber neu durch. ──
      const belegNr = await generateBelegNr('SAMMELFAHRT');
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

      // Anhang-Größencheck VOR dem Commit (Audit #8): zu große PDF → 400 statt totem Datensatz.
      if (!pdfPasstInMailOderAntworte(res, pdfPfad)) return;

      // Belege hashen (Datei-I/O außerhalb der Transaktion).
      const belegBasis = await baueBelegBasisRows(validatedBelegPfade);

      // ── Atomarer Insert: Kopf (inkl. pdfDateipfad, ohne Biometrie) + Fahrten + Belege. ──
      const einreichungId = await db.transaction(async (tx) => {
        const [einreichung] = await tx.insert(schema.einreichungen).values({
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
          pdfDateipfad: pdfPfad,
          unterschriftBild: null,
          status: 'EINGEREICHT',
        }).returning();

        if (serverFahrten.length > 0) {
          await tx.insert(schema.fahrten).values(
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

        if (belegBasis.length > 0) {
          await tx.insert(schema.belege).values(
            belegBasis.map(b => ({ ...b, einreichungId: einreichung.id })),
          );
        }

        return einreichung.id;
      });

      const webhookDataS = {
        id: einreichungId,
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
        einreichungId,
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

      // Anhang-Größencheck VOR dem Commit (Audit #8): zu große PDF → 400 statt totem Datensatz.
      if (!pdfPasstInMailOderAntworte(res, pdfPfad)) return;

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
    } else if (error instanceof ReisetageFehler) {
      // Reisekosten: Tagesbildung/Landangaben/Satz fachlich ungültig (deutsche Meldung).
      res.status(400).json({ error: error.message });
    } else {
      console.error('Fehler bei Einreichung:', error instanceof Error ? error.stack : String(error));
      res.status(500).json({
        error: 'Einreichung konnte nicht verarbeitet werden',
      });
    }
  }
});
