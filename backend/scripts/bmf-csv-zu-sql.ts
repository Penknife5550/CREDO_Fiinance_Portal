/**
 * Erzeugt aus der BMF-Ländertabelle (CSV) die Migration der Auslandspauschalen und die Prüfabfrage.
 *
 * Quelle: BMF-Schreiben (Anlage), als CSV in
 *   src/db/data/bmf-auslandspauschalen-JJJJ.csv (land_key;tagessatz_24h;tagessatz_8h;uebernachtung)
 * Verweisstaaten aus dem Text des Schreibens (Satz eines anderen Staates, z. B. Mikronesien =
 * Philippinen) stehen in src/db/data/bmf-auslandspauschalen-JJJJ-verweise.csv (land_key;wie_land_key)
 * und erhalten die Werte ihres Bezugsstaates.
 *
 * Zwei Modi (Ausführung im Repo-Root):
 * 1. Stand 2026 (BMF-Schreiben vom 05.12.2025):
 *      npx tsx backend/scripts/bmf-csv-zu-sql.ts [--neu-schreiben]
 *    → Migration 0014, Prüfabfrage scripts/pruefe-auslandspauschalen.sql und BMF-Satzblock der
 *    VMA-Nachkorrektur (scripts/vma-nachkorrektur-2026.sql). Alte Seed-Werte und Sortierung der
 *    19 Bestandszeilen kommen aus Migration 0008 (nie umbenennen).
 * 2. Neuer Satzstand eines Jahres (Release 1c, jährlich nach dem BMF-Schreiben im Dezember):
 *      npx tsx backend/scripts/bmf-csv-zu-sql.ts --jahr 2027 --quelle 'BMF-Schreiben vom TT.MM.2026' \
 *        --migration 00NN_pauschalen_ausland_bmf2027 [--neu-schreiben]
 *    → Migration src/db/migrations/00NN_….sql (INSERT aller Zeilen mit gueltig_von = 2027-01-01,
 *    ON CONFLICT (land_key, gueltig_von) DO NOTHING; Sortierung vom Vorgängerstand des Landes,
 *    neue Länder ab 1000 alphabetisch), Journal-Eintrag (falls fehlend) und Prüfabfrage
 *    scripts/pruefe-auslandspauschalen-2027.sql. Keys müssen denen des Vorjahres entsprechen
 *    (der Lauf listet fehlende und neue Keys gegenüber der Vorjahres-CSV). Die Verweis-CSV ist
 *    jedes Jahr Pflicht (ohne Verweisstaaten: nur Kopfzeile), Luxemburg muss in der CSV stehen.
 *
 * Ausgabe ist deterministisch: ein zweiter Lauf erzeugt byte-identische Dateien.
 * Würde sich eine Migration ändern, bricht der Lauf ab — eine bereits eingespielte Migration
 * führt Drizzle nie erneut aus (Repo und DB liefen still auseinander). Nach dem Deploy
 * Korrekturen daher als NEUE Migration bzw. im AdminCenter; --neu-schreiben nur, solange die
 * Migration weder committet noch eingespielt ist. Modus 2 überschreibt außerdem nur die jüngste
 * Migration im Journal, und nur, wenn sie ein generierter Satzstand desselben Jahres ist.
 */

import fs from 'fs';
import path from 'path';

const BACKEND = path.resolve(import.meta.dirname, '..');
const csvDatei = (jahr: number) => path.join(BACKEND, `src/db/data/bmf-auslandspauschalen-${jahr}.csv`);
const verweisDatei = (jahr: number) => path.join(BACKEND, `src/db/data/bmf-auslandspauschalen-${jahr}-verweise.csv`);
const MIGRATIONEN = path.join(BACKEND, 'src/db/migrations');
const JOURNAL = path.join(MIGRATIONEN, 'meta/_journal.json');
const BESTAND_MIGRATION = path.join(MIGRATIONEN, '0008_pauschalen_ausland.sql');
const ZIEL_MIGRATION = path.join(MIGRATIONEN, '0014_pauschalen_ausland_bmf2026.sql');
const ZIEL_PRUEFUNG = path.join(BACKEND, 'scripts/pruefe-auslandspauschalen.sql');
const ZIEL_NACHKORREKTUR = path.join(BACKEND, 'scripts/vma-nachkorrektur-2026.sql');
const NACHKORREKTUR_ANFANG = '-- BMF-SAETZE ANFANG';
const NACHKORREKTUR_ENDE = '-- BMF-SAETZE ENDE';

const CSV_KOPF = 'land_key;tagessatz_24h;tagessatz_8h;uebernachtung';
const VERWEIS_KOPF = 'land_key;wie_land_key';
const BESTAND_ANZAHL = 19;
const REIHENFOLGE_START = 1000; // Bestand < 1000 = „Häufige Ziele"
const BREAKPOINT = '\n--> statement-breakpoint\n';
const STAND_2026 = 2026; // Modus 1: Bestand aus 0008/0014 (gueltig_von 2026-01-01 seit 0017)

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

function leseCsv(datei: string): Satz[] {
  const zeilen = leseZeilen(datei, CSV_KOPF);

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
function leseVerweise(datei: string, csv: Satz[]): Satz[] {
  const nachKey = new Map(csv.map((s) => [s.landKey, s]));
  const keys = new Set<string>();
  return leseZeilen(datei, VERWEIS_KOPF)
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

function erzeugePruefung(csv: Satz[], jahr: number, ziel: string): string {
  return [
    `-- Prüfabfrage Auslandspauschalen: listet Zeilen des Satzstands ${jahr}-01-01, in denen pauschalen_ausland`,
    '-- von der BMF-CSV abweicht.',
    `-- GENERIERT von backend/scripts/bmf-csv-zu-sql.ts aus backend/src/db/data/bmf-auslandspauschalen-${jahr}*.csv`,
    '-- (nicht von Hand ändern). Nur lesend. Leeres Ergebnis = DB entspricht der CSV.',
    '--',
    '-- Aufruf (Server, Repo-Verzeichnis):',
    `--   docker exec -i credo-finanz-db psql -U credo -d finanzportal < backend/scripts/${path.basename(ziel)}`,
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
    // DEPLOYMENT verlangt den Lauf auch VOR dem Deploy von 0017 — daher to_jsonb statt Spaltenname.
    '-- Satzstand über to_jsonb: läuft auch vor Migration 0017 (ohne gueltig_von; Bestand = Stand 2026).',
    'FULL OUTER JOIN (',
    '  SELECT * FROM pauschalen_ausland pa',
    `  WHERE COALESCE(to_jsonb(pa) ->> 'gueltig_von', '${STAND_2026}-01-01') = '${jahr}-01-01'`,
    ') p ON p.land_key = s.land_key',
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

/** Wert eines Kommandozeilenparameters (--name wert); undefined = Parameter fehlt. */
function argument(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const wert = process.argv[i + 1];
  return wert && !wert.startsWith('--') ? wert : fehler(`--${name}: Wert fehlt`);
}

/**
 * CSV + Verweisstaaten eines Jahres. Die Verweis-CSV ist jedes Jahr Pflicht (Verweise stehen in
 * jedem BMF-Schreiben; ohne sie fehlten die Staaten still im neuen Stand) — ohne Verweise nur
 * die Kopfzeile.
 */
function leseJahr(jahr: number): { anlage: Satz[]; verweise: Satz[] } {
  const anlage = leseCsv(csvDatei(jahr));
  if (!fs.existsSync(verweisDatei(jahr))) {
    fehler(`${path.relative(BACKEND, verweisDatei(jahr))} fehlt (Verweisstaaten aus dem Text des BMF-Schreibens; ohne Verweise nur die Kopfzeile „${VERWEIS_KOPF}“)`);
  }
  return { anlage, verweise: leseVerweise(verweisDatei(jahr), anlage) };
}

/** Schreibt eine Migration; bricht ab, wenn sie schon existiert und sich ändern würde. */
function schreibeMigration(datei: string, inhalt: string): void {
  const bisher = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : null;
  if (bisher !== null && bisher !== inhalt && !process.argv.includes('--neu-schreiben')) {
    fehler(
      `${path.basename(datei)} würde sich ändern. Ist sie schon committet oder auf einem Server eingespielt, ` +
        'nie überschreiben: Korrektur im AdminCenter bzw. als neue Migration. Nur eine noch nicht ' +
        'committete Migration darf mit --neu-schreiben neu erzeugt werden.',
    );
  }
  fs.writeFileSync(datei, inhalt);
}

// ── Modus 2: neuer Satzstand eines Jahres ─────────────────────────────────────

interface JournalEintrag {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

/**
 * Drizzle-Journal mit Eintrag für die Migration (ohne Eintrag führt der Migrator sie nie aus);
 * null = schon eingetragen. Prüft Nummer und Ziel, bevor irgendetwas geschrieben wird: Eine schon
 * eingetragene Migration darf nur erneut erzeugt werden, wenn sie die JÜNGSTE im Journal und ein
 * generierter Satzstand desselben Jahres ist — nie eine ältere oder fremde (z. B. 0017 mit der
 * Spaltenänderung, wenn nur --jahr angepasst, --migration aber vom Vorjahr kopiert wurde).
 */
function journalMitEintrag(tag: string, jahr: number, datei: string): string | null {
  const journal = JSON.parse(fs.readFileSync(JOURNAL, 'utf8')) as { entries: JournalEintrag[] };
  const letzter = journal.entries[journal.entries.length - 1];
  if (journal.entries.some((e) => e.tag === tag)) {
    const bisher = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : '';
    if (tag !== letzter.tag || !bisher.startsWith(`-- Auslandspauschalen ${jahr}:`)) {
      fehler(
        `--migration ${tag}: steht schon im Journal und ist nicht die jüngste Satzstand-Migration für ${jahr} — ` +
          `nie überschreiben. Neuer Stand: nächste freie Nummer ${String(letzter.idx + 1).padStart(4, '0')}.`,
      );
    }
    return null;
  }
  const nr = Number(tag.slice(0, 4));
  if (nr !== letzter.idx + 1) {
    fehler(`--migration ${tag}: nächste freie Nummer ist ${String(letzter.idx + 1).padStart(4, '0')}`);
  }
  // `when` streng steigend: der Migrator führt nur Migrationen aus, die jünger als die letzte eingespielte sind.
  journal.entries.push({ idx: nr, version: letzter.version, when: letzter.when + 86_400_000, tag, breakpoints: true });
  return JSON.stringify(journal, null, '\t');
}

function erzeugeSatzstand(csv: Satz[], anzahlVerweise: number, jahr: number, quelle: string, tag: string): string {
  const gueltigVon = `DATE '${jahr}-01-01'`;
  const collator = new Intl.Collator('de');
  const sortiert = [...csv].sort((a, b) => collator.compare(a.landKey, b.landKey) || (a.landKey < b.landKey ? -1 : 1));
  return [
    `-- Auslandspauschalen ${jahr}: neuer Satzstand ab ${jahr}-01-01 nach ${quelle} — ${csv.length - anzahlVerweise} Zeilen`,
    `-- der Anlage plus ${anzahlVerweise} Verweisstaaten aus dem Text des Schreibens (Satz des Bezugsstaates).`,
    `-- GENERIERT von backend/scripts/bmf-csv-zu-sql.ts --jahr ${jahr} aus`,
    `-- backend/src/db/data/bmf-auslandspauschalen-${jahr}*.csv (nicht von Hand ändern: CSV anpassen und`,
    `-- Generator mit --migration ${tag} erneut ausführen,`,
    '-- solange die Migration noch auf keinem Server eingespielt ist).',
    '--',
    `-- Legt je Land einen Satzstand mit gueltig_von = ${jahr}-01-01 an (Reisetage ab ${jahr}-01-01). Bestehende`,
    '-- Stände (Vorjahre, im AdminCenter schon angelegte Stände dieses Datums) bleiben unberührt.',
    '-- Sortierung (reihenfolge, < 1000 = „Häufige Ziele“) vom Vorgängerstand des Landes; neue Länder',
    `-- ab ${REIHENFOLGE_START} alphabetisch. Länder/Städte ohne Zeile in der CSV erhalten keinen Stand ${jahr}: Sie`,
    `-- fehlen ab ${jahr} in der Länderauswahl; für Reisetage ab ${jahr} verweist das Portal auf den Staat`,
    '-- (übrige Orte) bzw. „Staat nicht in der Liste“ (Satz Luxemburg).',
    `-- Prüfabfrage nach dem Deploy: backend/scripts/pruefe-auslandspauschalen-${jahr}.sql (muss leer sein).`,
    '-- Idempotent: ein zweiter Lauf ändert nichts.',
    'INSERT INTO pauschalen_ausland (land_key, gueltig_von, quelle, tagessatz_24h, tagessatz_8h, uebernachtung, reihenfolge)',
    `SELECT v.land_key, ${gueltigVon}, ${text(quelle)}, v.tagessatz_24h, v.tagessatz_8h, v.uebernachtung,`,
    '       COALESCE((SELECT p.reihenfolge FROM pauschalen_ausland p',
    `                 WHERE p.land_key = v.land_key AND p.gueltig_von < ${gueltigVon}`,
    '                 ORDER BY p.gueltig_von DESC LIMIT 1), v.reihenfolge)',
    'FROM (VALUES',
    valuesZeilen(sortiert, (_s, i) => String(REIHENFOLGE_START + i)),
    ') AS v (land_key, tagessatz_24h, tagessatz_8h, uebernachtung, reihenfolge)',
    'ON CONFLICT (land_key, gueltig_von) DO NOTHING;',
    '',
  ].join('\n');
}

function neuerSatzstand(jahrText: string): void {
  const jahr = /^20\d{2}$/.test(jahrText) && Number(jahrText) > STAND_2026 ? Number(jahrText) : fehler(`--jahr ${jahrText}: Jahr nach ${STAND_2026} erwartet`);
  const quelle = argument('quelle')?.trim() ?? fehler('--quelle fehlt (z. B. \'BMF-Schreiben vom 01.12.2026\')');
  if (quelle.length > 200) fehler('--quelle: höchstens 200 Zeichen');
  const tag = argument('migration') ?? fehler('--migration fehlt (z. B. 0018_pauschalen_ausland_bmf2027)');
  // Jahr im Namen: fängt einen vom Vorjahr kopierten Befehl ab, in dem nur --jahr angepasst wurde.
  if (!/^\d{4}_[a-z0-9_]+$/.test(tag) || !tag.includes(`bmf${jahr}`)) {
    fehler(`--migration ${tag}: Name wie 00NN_pauschalen_ausland_bmf${jahr} erwartet (mit „bmf${jahr}“)`);
  }

  const { anlage, verweise } = leseJahr(jahr);
  const csv = [...anlage, ...verweise];
  // Luxemburg = gesetzlicher Ersatzsatz und Maßstab, ob ein Jahr hinterlegt ist (lib/reisetage.ts).
  if (!csv.some((s) => s.landKey === 'Luxemburg')) fehler(`CSV ${jahr}: Zeile „Luxemburg“ fehlt (gesetzlicher Ersatzsatz)`);
  const zielMigration = path.join(MIGRATIONEN, `${tag}.sql`);
  const zielPruefung = path.join(BACKEND, `scripts/pruefe-auslandspauschalen-${jahr}.sql`);
  const journal = journalMitEintrag(tag, jahr, zielMigration);
  schreibeMigration(zielMigration, erzeugeSatzstand(csv, verweise.length, jahr, quelle, tag));
  if (journal !== null) fs.writeFileSync(JOURNAL, journal);
  fs.writeFileSync(zielPruefung, erzeugePruefung(csv, jahr, zielPruefung));

  // Vier-Augen-Abgleich: Keys müssen über die Jahre gleich bleiben (Sortierung, Häufige Ziele).
  const ausgabe = [`${anlage.length} CSV-Zeilen + ${verweise.length} Verweisstaaten → ${path.relative(BACKEND, zielMigration)}, ${path.relative(BACKEND, zielPruefung)}, Journal`];
  if (fs.existsSync(csvDatei(jahr - 1))) {
    const vorjahr = leseJahr(jahr - 1);
    const alt = new Set([...vorjahr.anlage, ...vorjahr.verweise].map((s) => s.landKey));
    const neu = new Set(csv.map((s) => s.landKey));
    const fehlend = [...alt].filter((k) => !neu.has(k));
    const hinzu = [...neu].filter((k) => !alt.has(k));
    ausgabe.push(`Gegenüber ${jahr - 1} fehlend (${fehlend.length}): ${fehlend.join(', ') || '–'}`);
    ausgabe.push(`Gegenüber ${jahr - 1} neu (${hinzu.length}): ${hinzu.join(', ') || '–'}`);
  }
  process.stdout.write(ausgabe.join('\n') + '\n');
}

// ── Modus 1: Stand 2026 (Migration 0014) ──────────────────────────────────────

function stand2026(): void {
  const { anlage: csvAnlage, verweise } = leseJahr(STAND_2026);
  const csv = [...csvAnlage, ...verweise];
  const bestand = leseBestand();

  schreibeMigration(ZIEL_MIGRATION, erzeugeMigration(csv, verweise.length, bestand));
  fs.writeFileSync(ZIEL_PRUEFUNG, erzeugePruefung(csv, STAND_2026, ZIEL_PRUEFUNG));
  fs.writeFileSync(ZIEL_NACHKORREKTUR, erzeugeNachkorrektur(csv));
  process.stdout.write(
    `${csvAnlage.length} CSV-Zeilen + ${verweise.length} Verweisstaaten → ` +
      [ZIEL_MIGRATION, ZIEL_PRUEFUNG, ZIEL_NACHKORREKTUR].map((d) => path.relative(BACKEND, d)).join(', ') +
      '\n',
  );
}

const jahrArgument = argument('jahr');
if (jahrArgument === undefined) stand2026();
else neuerSatzstand(jahrArgument);
