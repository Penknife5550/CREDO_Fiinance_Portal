// Satzstände der Auslandspauschalen (Admin-API): Eingabeprüfung und reine Helfer.
// Ohne DB- und Express-Abhängigkeit, damit sie ohne Datenbank testbar sind.
// Das AdminCenter (frontend/src/pages/AdminCenter.tsx, PauschaleZeile) prüft vor dem Absenden
// dasselbe mit denselben Grenzen und Meldungen — Änderungen dort mitziehen.
import { z } from 'zod';

/**
 * Höchster zulässiger Tagessatz (24 h und 8 h) in €. Die Einreichungsroute (routes/einreichungen.ts)
 * nutzt diese Konstante als Deckel der Tagesbeträge — ein höherer Satz ließe dort sonst jede
 * Einreichung für das Land scheitern. Höchster BMF-Satz 2026: 83 € — die Grenze fängt Tippfehler wie 830
 * statt 83,0 ab. Kopie im AdminCenter (frontend/src/pages/AdminCenter.tsx) gleich halten.
 */
export const MAX_TAGESSATZ = 200;
/** Höchster zulässiger Übernachtungsbetrag in €. */
export const MAX_UEBERNACHTUNG = 9999;

/**
 * Keine Steuer-, Format- oder Zeilentrennzeichen (CR/LF, TAB, NUL, Bidi-Overrides wie U+202E,
 * U+2028/U+2029 …): Quelle und Land stehen in PDF und Mail jedes Belegs. Wie ohneSteuerzeichen
 * (reiseangaben.ts); Kopie im AdminCenter gleich halten.
 */
const OHNE_STEUERZEICHEN = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]*$/u;
/** Land: zusätzlich kein „%“ (Schlüssel steht kodiert in der Admin-URL). */
const LAND_ZEICHEN = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}%]*$/u;

export const MELDUNG_8H_UEBER_24H = 'Der 8-h-Satz darf nicht größer als der 24-h-Satz sein.';

/** Neuer Stand in einem Jahr ohne Luxemburg-Stand (= ohne eingespielten Jahresstand). */
export function meldungOhneJahresstand(jahr: string): string {
  return `Für ${jahr} ist noch kein Jahresstand eingespielt. Neue Jahresstände werden zentral per BMF-Import eingespielt; hier nur Korrekturen in bereits eingespielten Jahren.`;
}

// Erster Gültigkeitstag 'JJJJ-MM-TT' — nur echte Kalenderdaten (kein 30.02.), sonst 500 statt 400.
export const satzstandDatum = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/, 'Datum im Format JJJJ-MM-TT').refine(d => {
  const ms = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === d;
}, 'Ungültiges Datum');

// Tagessätze > 0: das BMF kennt keine 0-€-Sätze (vergessenes Feld würde 0,00 € VMA auszahlen).
const tagessatz = z.number()
  .positive('Muss größer als 0 € sein')
  .max(MAX_TAGESSATZ, `Höchstens ${MAX_TAGESSATZ} €`);

const satzstandFelder = z.object({
  landKey: z.string().trim()
    .min(1, 'Bitte ein Land angeben')
    .max(100, 'Höchstens 100 Zeichen')
    .regex(LAND_ZEICHEN, 'Ungültige Zeichen im Land (keine Steuerzeichen, kein %)'),
  gueltigVon: satzstandDatum,
  quelle: z.string().trim()
    .min(1, 'Bitte eine Quelle angeben')
    .max(200, 'Höchstens 200 Zeichen')
    .regex(OHNE_STEUERZEICHEN, 'Ungültige Zeichen in der Quelle (keine Zeilenumbrüche oder Steuerzeichen)'),
  tagessatz24h: tagessatz,
  tagessatz8h: tagessatz,
  uebernachtung: z.number()
    .nonnegative('Darf nicht negativ sein')
    .max(MAX_UEBERNACHTUNG, 'Höchstens 9.999 €'),
  // Ohne Angabe: Sortierung des Vorgängerstands (bleibt unter „Häufige Ziele“), neues Land 9999.
  reihenfolge: z.number().int('Ganze Zahl erwartet').nonnegative('Darf nicht negativ sein').optional(),
});

/** POST: neuer Satzstand. 8 h ≤ 24 h (wie der Generator bmf-csv-zu-sql.ts). */
export const auslandspauschaleSchema = satzstandFelder.refine(p => p.tagessatz8h <= p.tagessatz24h, {
  message: MELDUNG_8H_UEBER_24H,
  path: ['tagessatz8h'],
});

/**
 * PUT: Teilupdate ohne Schlüssel (Land + gültig ab stehen in der URL). 8 h ≤ 24 h prüft die Route
 * gegen den gespeicherten Wert, weil hier auch nur einer der beiden Sätze kommen kann.
 */
export const auslandspauschaleUpdateSchema = satzstandFelder.omit({ landKey: true, gueltigVon: true }).partial();

/**
 * Schlüssel eines Satzstands aus der URL (/:landKey/:gueltigVon); null = ungültiges Datum.
 * Express 5 dekodiert req.params bereits — kein zweites decodeURIComponent (sonst wirft „Land 100%“
 * einen URIError, und „A%41“ träfe den Stand „AA“).
 */
export function satzstandSchluessel(params: { landKey: string; gueltigVon: string }) {
  const gueltigVon = satzstandDatum.safeParse(params.gueltigVon);
  if (!gueltigVon.success) return null;
  return { landKey: params.landKey, gueltigVon: gueltigVon.data };
}

/**
 * PostgreSQL-Unique-Verletzung (23505), hier: Satzstand (land_key, gueltig_von) existiert schon.
 * Per Fehlercode statt Meldungstext (Sprache/lc_messages); auch wenn der Treiber-Fehler als
 * `cause` verpackt ist (DrizzleQueryError ab drizzle 0.44).
 */
export function istUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) => (typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined);
  const cause = typeof err === 'object' && err !== null ? (err as { cause?: unknown }).cause : undefined;
  return code(err) === '23505' || code(cause) === '23505';
}
