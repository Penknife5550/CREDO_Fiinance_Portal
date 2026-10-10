/**
 * Erzeugt aus der BMF-Ländertabelle (CSV) die Migration 0014, die Prüfabfrage und den
 * BMF-Satzblock der VMA-Nachkorrektur (backend/scripts/vma-nachkorrektur-2026.sql).
 *
 * Quelle: BMF-Schreiben vom 05.12.2025 (Anlage), als CSV in
 *   src/db/data/bmf-auslandspauschalen-2026.csv (land_key;tagessatz_24h;tagessatz_8h;uebernachtung)
 * Verweisstaaten aus dem Text des Schreibens (Satz eines anderen Staates, z. B. Mikronesien =
 * Philippinen) stehen in src/db/data/bmf-auslandspauschalen-2026-verweise.csv (land_key;wie_land_key)
 * und erhalten die Werte ihres Bezugsstaates.
 *
 * Ausführung (Repo-Root): npx tsx backend/scripts/bmf-csv-zu-sql.ts [--neu-schreiben]
 *
 * Ausgabe ist deterministisch: ein zweiter Lauf erzeugt byte-identische Dateien.
 * Würde sich die Migration ändern, bricht der Lauf ab — eine bereits eingespielte Migration
 * führt Drizzle nie erneut aus (Repo und DB liefen still auseinander). Nach dem Deploy von
 * 0014 Korrekturen daher als NEUE Migration anlegen; --neu-schreiben nur vor dem ersten Deploy.
 * Alte Seed-Werte und Sortierung der 19 Bestandszeilen kommen aus Migration 0008 (nie umbenennen).
 */

import fs from 'fs';
import path from 'path';

const BACKEND = path.resolve(import.meta.dirname, '..');
const CSV_DATEI = path.join(BACKEND, 'src/db/data/bmf-auslandspauschalen-2026.csv');
const VERWEIS_DATEI = path.join(BACKEND, 'src/db/data/bmf-auslandspauschalen-2026-verweise.csv');
const BESTAND_MIGRATION = path.join(BACKEND, 'src/db/migrations/0008_pauschalen_ausland.sql');
const ZIEL_MIGRATION = path.join(BACKEND, 'src/db/migrations/0014_pauschalen_ausland_bmf2026.sql');
const ZIEL_PRUEFUNG = path.join(BACKEND, 'scripts/pruefe-auslandspauschalen.sql');
const ZIEL_NACHKORREKTUR = path.join(BACKEND, 'scripts/vma-nachkorrektur-2026.sql');
const NACHKORREKTUR_ANFANG = '-- BMF-SAETZE ANFANG';
const NACHKORREKTUR_ENDE = '-- BMF-SAETZE ENDE';

const CSV_KOPF = 'land_key;tagessatz_24h;tagessatz_8h;uebernachtung';
const VERWEIS_KOPF = 'land_key;wie_land_key';
const BESTAND_ANZAHL = 19;
const REIHENFOLGE_START = 1000; // Bestand < 1000 = „Häufige Ziele"
const BREAKPOINT = '\n--> statement-breakpoint\n';

interface Satz {
  landKey: string;
  satz24h: number;
  satz8h: number;
  uebernachtung: number;
}

interface BestandSatz extends Satz {
  reihenfolge: number;
}

function fehler(meldung: string): never {
  throw new Error(meldung);
}

function leseZeilen(datei: string, kopf: string): string[] {
  const zeilen = fs
    .readFileSync(datei, 'utf8')
    .split(/\r?\n/)
    .filter((z) => z.trim() !== '');
  if (zeilen[0] !== kopf) fehler(`${path.basename(datei)}: unerwarteter Kopf „${zeilen[0]}"`);
  return zeilen;
}

function leseCsv(): Satz[] {
  const zeilen = leseZeilen(CSV_DATEI, CSV_KOPF);

  const keys = new Set<string>();
  return zeilen.slice(1).map((zeile, i) => {
    const nr = i + 2;
    const felder = zeile.split(';');
    if (felder.length !== 4) fehler(`CSV-Zeile ${nr}: 4 Felder erwartet`);
    const [landKey, ...werte] = felder;
    if (!landKey || landKey !== landKey.trim() || landKey.length > 100) {
      fehler(`CSV-Zeile ${nr}: ungültiger land_key „${landKey}"`);
    }
    if (keys.has(landKey)) fehler(`CSV-Zeile ${nr}: land_key „${landKey}" doppelt`);
    keys.add(landKey);
    const [satz24h, satz8h, uebernachtung] = werte.map((w) => {
      if (!/^\d+(\.\d{1,2})?$/.test(w)) fehler(`CSV-Zeile ${nr}: ungültiger Betrag „${w}"`);
      return Number(w);
    });
    if (satz8h > satz24h) fehler(`CSV-Zeile ${nr}: 8-h-Satz größer als 24-h-Satz`);
    return { landKey, satz24h, satz8h, uebernachtung };
  });
}

/** Verweisstaaten: Werte des Bezugsstaates aus der Haupt-CSV übernehmen. */
function leseVerweise(csv: Satz[]): Satz[] {
  const nachKey = new Map(csv.map((s) => [s.landKey, s]));
  const keys = new Set<string>();
  return leseZeilen(VERWEIS_DATEI, VERWEIS_KOPF)
    .slice(1)
    .map((zeile, i) => {
      const nr = i + 2;
      const [landKey, wieLandKey, ...rest] = zeile.split(';');
      if (!landKey || !wieLandKey || rest.length > 0) fehler(`Verweis-Zeile ${nr}: 2 Felder erwartet`);
      if (nachKey.has(landKey) || keys.has(landKey)) fehler(`Verweis-Zeile ${nr}: land_key „${landKey}" doppelt`);
      keys.add(landKey);
      const bezug = nachKey.get(wieLandKey) ?? fehler(`Verweis-Zeile ${nr}: „${wieLandKey}" fehlt in der CSV`);
      return { ...bezug, landKey };
    });
}

function leseBestand(): BestandSatz[] {
  const sql = fs.readFileSync(BESTAND_MIGRATION, 'utf8');
  const muster = /\('([^']+)',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*(\d+)\)/g;
  const bestand = [...sql.matchAll(muster)].map((m) => ({
    landKey: m[1],
    satz24h: Number(m[2]),
    satz8h: Number(m[3]),
    uebernachtung: Number(m[4]),
    reihenfolge: Number(m[5]),
  }));
  if (bestand.length !== BESTAND_ANZAHL) {
    fehler(`0008: ${BESTAND_ANZAHL} Bestandszeilen erwartet, ${bestand.length} gefunden`);
  }
  return bestand;
}

const text = (s: string) => `'${s.replace(/'/g, "''")}'`;
const betrag = (n: number) => n.toFixed(2);

/** VALUES-Zeilen mit ausgerichteten Spalten (wie in 0008). */
function valuesZeilen(saetze: Satz[], zusatz?: (s: Satz, i: number) => string): string {
  const breite = Math.max(...saetze.map((s) => text(s.landKey).length)) + 1;
  return saetze
    .map((s, i) => {
      const spalten = [
        (text(s.landKey) + ',').padEnd(breite),
        betrag(s.satz24h).padStart(6) + ',',
        betrag(s.satz8h).padStart(6) + ',',
        betrag(s.uebernachtung).padStart(7) + (zusatz ? ',' : ''),
      ];
      if (zusatz) spalten.push(zusatz(s, i).padStart(5));
      return `  (${spalten.join(' ')})`;
    })
    .join(',\n');
}

function erzeugeMigration(csv: Satz[], anzahlVerweise: number, bestand: BestandSatz[]): string {
  const nachKey = new Map(csv.map((s) => [s.landKey, s]));
  const bestandKeys = new Set(bestand.map((s) => s.landKey));

  const statements: string[] = [];
  const unveraendert: string[] = [];
  for (const alt of bestand) {
    const neu =
      nachKey.get(alt.landKey) ?? fehler(`Bestands-Key „${alt.landKey}" fehlt in der CSV`);
    const key = text(alt.landKey);
    const vmaNeu = neu.satz24h !== alt.satz24h || neu.satz8h !== alt.satz8h;
    const uebNeu = neu.uebernachtung !== alt.uebernachtung;
    if (!vmaNeu && !uebNeu) unveraendert.push(alt.landKey);
    if (vmaNeu) {
      statements.push(
        `-- ${alt.landKey}: Verpflegung ${betrag(alt.satz24h)}/${betrag(alt.satz8h)} → ${betrag(neu.satz24h)}/${betrag(neu.satz8h)}\n` +
          `UPDATE pauschalen_ausland SET tagessatz_24h = ${betrag(neu.satz24h)}, tagessatz_8h = ${betrag(neu.satz8h)}, updated_at = NOW()\n` +
          `WHERE land_key = ${key} AND tagessatz_24h = ${betrag(alt.satz24h)} AND tagessatz_8h = ${betrag(alt.satz8h)};`,
      );
    }
    if (uebNeu) {
      statements.push(
        `-- ${alt.landKey}: Übernachtung ${betrag(alt.uebernachtung)} → ${betrag(neu.uebernachtung)}\n` +
          `UPDATE pauschalen_ausland SET uebernachtung = ${betrag(neu.uebernachtung)}, updated_at = NOW()\n` +
          `WHERE land_key = ${key} AND uebernachtung = ${betrag(alt.uebernachtung)};`,
      );
    }
  }

  // b) Bestandszeilen (alte Sortierung, BMF-Werte) — falls im AdminCenter gelöscht — und
  //    alle übrigen Zeilen (ab REIHENFOLGE_START alphabetisch) anlegen, sofern sie fehlen.
  const collator = new Intl.Collator('de');
  const reihenfolge = new Map(bestand.map((s) => [s.landKey, s.reihenfolge]));
  const bestandBmf = bestand.map((alt) => nachKey.get(alt.landKey) as Satz);
  const neue = csv
    .filter((s) => !bestandKeys.has(s.landKey))
    .sort((a, b) => collator.compare(a.landKey, b.landKey) || (a.landKey < b.landKey ? -1 : 1));
  neue.forEach((s, i) => reihenfolge.set(s.landKey, REIHENFOLGE_START + i));
  statements.push(
    `-- b) Fehlende Zeilen anlegen: ${bestand.length} Bestandszeilen (falls gelöscht; Sortierung aus 0008) und\n` +
      `--    ${neue.length} weitere BMF-Zeilen (reihenfolge ab ${REIHENFOLGE_START}, alphabetisch)\n` +
      'INSERT INTO pauschalen_ausland (land_key, tagessatz_24h, tagessatz_8h, uebernachtung, reihenfolge) VALUES\n' +
      valuesZeilen([...bestandBmf, ...neue], (s) => String(reihenfolge.get(s.landKey))) +
      '\nON CONFLICT (land_key) DO NOTHING;',
  );

  const kopf = [
    `-- Auslandspauschalen 2026 vollständig nach BMF-Schreiben vom 05.12.2025: ${csv.length - anzahlVerweise} Zeilen der`,
    `-- Anlage plus ${anzahlVerweise} Verweisstaaten aus dem Text des Schreibens (Satz des Bezugsstaates, siehe`,
    '-- backend/src/db/data/bmf-auslandspauschalen-2026-verweise.csv).',
    '-- GENERIERT von backend/scripts/bmf-csv-zu-sql.ts aus backend/src/db/data/bmf-auslandspauschalen-2026*.csv',
    '-- (nicht von Hand ändern: CSV anpassen und Generator erneut ausführen).',
    '--',
    `-- a) Die ${BESTAND_ANZAHL} Bestandszeilen aus 0008 werden nur korrigiert, solange noch der alte Seed-Wert`,
    '--    steht (Verpflegungspaar und Übernachtung getrennt). Im AdminCenter gepflegte Werte bleiben',
    '--    unberührt; Abweichungen zur CSV zeigt backend/scripts/pruefe-auslandspauschalen.sql.',
    `--    Unverändert (Seed = BMF): ${unveraendert.join(', ') || '–'}.`,
    '-- b) Fehlende Zeilen werden angelegt (ON CONFLICT DO NOTHING) — auch Bestandszeilen, die im',
    '--    AdminCenter gelöscht wurden (z. B. Luxemburg, der gesetzliche Ersatzsatz).',
    '--',
    "-- Key-Konvention: Staat = Name (Satz „im Übrigen“), Stadt = 'Staat — Stadt'. Bestands-Keys, die",
    "-- vom BMF-Namen abweichen: 'USA' = Vereinigte Staaten von Amerika (USA), 'Großbritannien' =",
    "-- Vereinigtes Königreich von Großbritannien und Nordirland, 'Tschechien' = Tschechische Republik,",
    "-- 'Frankreich — Paris' = Paris sowie die Departments 77, 78, 91 bis 95.",
    '-- Idempotent: ein zweiter Lauf ändert nichts.',
    '',
  ].join('\n');

  return kopf + '\n-- a) Bestandszeilen\n' + statements.join(BREAKPOINT) + '\n';
}

function erzeugePruefung(csv: Satz[]): string {
  return [
    '-- Prüfabfrage Auslandspauschalen: listet Zeilen, in denen pauschalen_ausland von der BMF-CSV abweicht.',
    '-- GENERIERT von backend/scripts/bmf-csv-zu-sql.ts aus backend/src/db/data/bmf-auslandspauschalen-2026*.csv',
    '-- (nicht von Hand ändern). Nur lesend. Leeres Ergebnis = DB entspricht der CSV.',
    '--',
    '-- Aufruf (Server, Repo-Verzeichnis):',
    '--   docker exec -i credo-finanz-db psql -U credo -d finanzportal < backend/scripts/pruefe-auslandspauschalen.sql',
    '--',
    "-- Befund: 'abweichend' (z. B. im AdminCenter geändert), 'fehlt in DB', 'nicht in CSV' (im AdminCenter angelegt).",
    'WITH soll (land_key, tagessatz_24h, tagessatz_8h, uebernachtung) AS (',
    '  VALUES',
    valuesZeilen(csv).replace(/^/gm, '  '),
    ')',
    'SELECT',
    '  COALESCE(s.land_key, p.land_key) AS land_key,',
    "  CASE WHEN p.land_key IS NULL THEN 'fehlt in DB'",
    "       WHEN s.land_key IS NULL THEN 'nicht in CSV'",
    "       ELSE 'abweichend' END AS befund,",
    '  p.tagessatz_24h AS ist_24h, s.tagessatz_24h AS soll_24h,',
    '  p.tagessatz_8h AS ist_8h, s.tagessatz_8h AS soll_8h,',
    '  p.uebernachtung AS ist_uebernachtung, s.uebernachtung AS soll_uebernachtung',
    'FROM soll s',
    'FULL OUTER JOIN pauschalen_ausland p ON p.land_key = s.land_key',
    'WHERE p.land_key IS NULL OR s.land_key IS NULL',
    '   OR (p.tagessatz_24h, p.tagessatz_8h, p.uebernachtung)',
    '      IS DISTINCT FROM (s.tagessatz_24h, s.tagessatz_8h, s.uebernachtung)',
    'ORDER BY 1;',
    '',
  ].join('\n');
}

/** Ersetzt in der Nachkorrektur nur den Block zwischen den Markierungen (Soll = BMF-Werte, nicht DB). */
function erzeugeNachkorrektur(csv: Satz[]): string {
  const sql = fs.readFileSync(ZIEL_NACHKORREKTUR, 'utf8');
  const anfang = sql.indexOf(NACHKORREKTUR_ANFANG);
  const ende = sql.indexOf(NACHKORREKTUR_ENDE);
  if (anfang < 0 || ende < anfang) fehler(`${path.basename(ZIEL_NACHKORREKTUR)}: Markierungen fehlen`);
  const zeilenEnde = sql.indexOf('\n', anfang) + 1;
  const einzug = sql.slice(sql.lastIndexOf('\n', ende) + 1, ende);
  return (
    sql.slice(0, zeilenEnde) +
    `${einzug}VALUES\n` +
    valuesZeilen(csv).replace(/^/gm, einzug) +
    '\n' +
    sql.slice(sql.lastIndexOf('\n', ende) + 1)
  );
}

const csvAnlage = leseCsv();
const verweise = leseVerweise(csvAnlage);
const csv = [...csvAnlage, ...verweise];
const bestand = leseBestand();

const migration = erzeugeMigration(csv, verweise.length, bestand);
const bisher = fs.existsSync(ZIEL_MIGRATION) ? fs.readFileSync(ZIEL_MIGRATION, 'utf8') : null;
if (bisher !== null && bisher !== migration && !process.argv.includes('--neu-schreiben')) {
  fehler(
    `${path.basename(ZIEL_MIGRATION)} würde sich ändern. Ist sie schon auf einem Server eingespielt, ` +
      'die Korrektur als neue Migration anlegen; sonst mit --neu-schreiben erneut ausführen.',
  );
}
fs.writeFileSync(ZIEL_MIGRATION, migration);
fs.writeFileSync(ZIEL_PRUEFUNG, erzeugePruefung(csv));
fs.writeFileSync(ZIEL_NACHKORREKTUR, erzeugeNachkorrektur(csv));
process.stdout.write(
  `${csvAnlage.length} CSV-Zeilen + ${verweise.length} Verweisstaaten → ` +
    [ZIEL_MIGRATION, ZIEL_PRUEFUNG, ZIEL_NACHKORREKTUR].map((d) => path.relative(BACKEND, d)).join(', ') +
    '\n',
);
