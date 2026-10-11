/**
 * DSGVO-Löschfrist (90 Tage): vollständiges, hartes Löschen abgelaufener Vorgänge.
 *
 * Das Portal ist ein Einreichungs-Trichter — das DMS/Fibu ist das führende System.
 * Personenbezogene Zahlungsdaten (Klartext-IBAN, Name, hochgeladene Belege) sollen
 * daher nicht länger als nötig im Portal liegen. Ein Vorgang wird gelöscht, sobald er
 *
 *   1. erfolgreich zugestellt ist (`status = 'GESENDET'`) — nie etwas Unzugestelltes
 *      löschen, sonst ginge der einzige Nachweis verloren, und
 *   2. älter als die Frist ist (`created_at < heute − 90 Tage`).
 *
 * Gelöscht wird der komplette Vorgang: die `einreichungen`-Zeile (Cascade räumt
 * Reisetage/Positionen/Fahrten/Klassen/Kostenzeilen/Anteile/Belege-Zeilen), die
 * zugehörigen `email_log`-Zeilen (deren `betreff` den Mitarbeiter-Klarnamen enthält
 * und deren FK sonst nur auf NULL gesetzt würde) sowie die Beleg-Dateien und das PDF
 * auf der Platte.
 *
 * Lösch-Moratorium (VMA-Nachkorrektur 2026, DEPLOYMENT.md §13): Solange das heutige
 * Datum (UTC) vor dem Enddatum liegt (`RETENTION_MORATORIUM_BIS`, ohne Wert
 * STANDARD_MORATORIUM_BIS), werden abgelaufene REISEKOSTEN des Altbestands — ohne Land je
 * Reisetag, also vor Release 1b, genau die Belege, die `vma-nachkorrektur-2026.sql` liest —
 * NICHT gelöscht, sondern nur minimiert: IBAN und Kontoinhaber auf NULL, Beleg-Dateien und
 * PDF gelöscht (samt `belege`-Zeilen und `pdf_dateipfad`). Der übrige Datensatz bleibt.
 * Alle anderen Vorgänge laufen normal ab; ab dem Enddatum gilt die Frist wieder für alle.
 *
 * Die Frist steht in `RETENTION_FRIST_TAGE` (Standard 90). `RETENTION_TAGE` liest nur noch
 * älterer Code ohne Moratorium im Löschjob (Rückweg auf ein älteres Image): Compose setzt es
 * fest auf 3650, damit ein solches Image nichts löscht.
 *
 * Ausführung: in-process, täglich (siehe `starteRetentionScheduler`), aber nur in
 * Produktion bzw. mit `RETENTION_ENABLED=true`, damit in Dev keine Testdaten stillt
 * verschwinden. Die Kernfunktion `loescheAbgelaufeneVorgaenge` ist unabhängig davon
 * direkt aufrufbar (Tests, manueller Lauf). Die Regeln (Konfiguration, Löschbedingung)
 * sind reine Funktionen und ohne DB testbar.
 */

import fs from 'fs';
import path from 'path';
import { and, eq, lt, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

const STANDARD_TAGE = 90;
/**
 * Ende des Moratoriums ohne Umgebungswert. Steht im Code, damit das Moratorium nicht allein an
 * einem Compose-Default hängt (fehlt die Variable, gilt trotzdem dieses Datum). Früher beenden:
 * `RETENTION_MORATORIUM_BIS` auf ein vergangenes Datum setzen.
 */
export const STANDARD_MORATORIUM_BIS = '2027-03-31';
/** Ab so vielen Tagen vor dem Enddatum warnt jeder Lauf im Log (Prüftermin, DEPLOYMENT.md §13). */
const WARNUNG_VOR_ENDE_TAGE = 30;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const EIN_TAG_MS = 24 * 60 * 60 * 1000;

export interface RetentionKonfig {
  /** Frist in Tagen nach Einreichung (ganze Zahl ≥ 1). */
  tage: number;
  /** Ende des Moratoriums für den REISEKOSTEN-Altbestand ('JJJJ-MM-TT', ab diesem Tag gilt die Frist wieder). */
  moratoriumBis: string;
}

export type RetentionKonfigErgebnis =
  | { ok: true; konfig: RetentionKonfig }
  | { ok: false; fehler: string };

function istKalenderdatum(wert: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const d = new Date(`${wert}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === wert;
}

/**
 * Liest RETENTION_FRIST_TAGE und RETENTION_MORATORIUM_BIS streng. Fehlend oder leer: 90 Tage
 * bzw. STANDARD_MORATORIUM_BIS. Jeder andere Wert muss exakt passen — kein stilles Zurückfallen
 * auf einen Standard („3.650“ wäre sonst 3,65 Tage, „-1“ löschte alles Zugestellte).
 */
export function leseRetentionKonfig(env: Record<string, string | undefined>): RetentionKonfigErgebnis {
  const rohTage = env.RETENTION_FRIST_TAGE;
  let tage = STANDARD_TAGE;
  if (rohTage !== undefined && rohTage !== '') {
    tage = /^\d+$/.test(rohTage) ? Number(rohTage) : NaN;
    if (!Number.isSafeInteger(tage) || tage < 1) {
      return { ok: false, fehler: `RETENTION_FRIST_TAGE „${rohTage}“ ist ungültig (erwartet: ganze Zahl ab 1)` };
    }
  }
  const rohBis = env.RETENTION_MORATORIUM_BIS;
  let moratoriumBis = STANDARD_MORATORIUM_BIS;
  if (rohBis !== undefined && rohBis !== '') {
    if (!istKalenderdatum(rohBis)) {
      return { ok: false, fehler: `RETENTION_MORATORIUM_BIS „${rohBis}“ ist ungültig (erwartet: Datum JJJJ-MM-TT)` };
    }
    moratoriumBis = rohBis;
  }
  return { ok: true, konfig: { tage, moratoriumBis } };
}

/** Ganze Tage von heute (UTC, wie der Container) bis zum Enddatum des Moratoriums; ≤ 0 = beendet. */
export function tageBisMoratoriumsende(konfig: RetentionKonfig, jetzt: Date): number {
  const heute = Date.parse(`${jetzt.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((Date.parse(`${konfig.moratoriumBis}T00:00:00Z`) - heute) / EIN_TAG_MS);
}

/** Moratorium aktiv, solange das heutige Datum (UTC) vor dem Enddatum liegt. */
export function moratoriumAktiv(konfig: RetentionKonfig, jetzt: Date): boolean {
  return tageBisMoratoriumsende(konfig, jetzt) > 0;
}

/**
 * Warnung für das Log in den letzten WARNUNG_VOR_ENDE_TAGE Tagen vor dem Enddatum — eine
 * Verlängerung muss vor dem Ende entschieden sein (danach ist der Altbestand endgültig gelöscht).
 */
export function moratoriumWarnung(konfig: RetentionKonfig, jetzt: Date): string | null {
  const rest = tageBisMoratoriumsende(konfig, jetzt);
  if (rest < 1 || rest > WARNUNG_VOR_ENDE_TAGE) return null;
  return `Moratorium REISEKOSTEN endet am ${konfig.moratoriumBis} (in ${rest} ${rest === 1 ? 'Tag' : 'Tagen'}): `
    + 'danach löscht der Job auch den Reisekosten-Altbestand endgültig. Verlängern nur nach Prüfung mit dem '
    + 'Datenschutzbeauftragten (RETENTION_MORATORIUM_BIS, DEPLOYMENT.md §13).';
}

/** Vorgänge, die vor diesem Zeitpunkt eingereicht wurden, sind abgelaufen. */
export function fristGrenze(konfig: RetentionKonfig, jetzt: Date): Date {
  return new Date(jetzt.getTime() - konfig.tage * EIN_TAG_MS);
}

export type RetentionAktion = 'BEHALTEN' | 'LOESCHEN' | 'MINIMIEREN';

/**
 * Löschbedingung je Vorgang: Nur zugestellte (GESENDET) Vorgänge älter als die Frist laufen
 * ab — nie etwas Unzugestelltes. Während des Moratoriums werden abgelaufene REISEKOSTEN des
 * Altbestands nur minimiert statt gelöscht. Altbestand = ohne Land je Reisetag (`landJeTag`,
 * ab Release 1b immer gesetzt): genau die Belege der VMA-Nachkorrektur (vma-nachkorrektur-2026.sql
 * schließt Belege mit `reisetage.land_key` aus).
 */
export function retentionAktion(
  vorgang: { typ: string; status: string; createdAt: Date; landJeTag: boolean },
  konfig: RetentionKonfig,
  jetzt: Date,
): RetentionAktion {
  if (vorgang.status !== 'GESENDET') return 'BEHALTEN';
  if (vorgang.createdAt.getTime() >= fristGrenze(konfig, jetzt).getTime()) return 'BEHALTEN';
  const altbestand = vorgang.typ === 'REISEKOSTEN' && !vorgang.landJeTag;
  return altbestand && moratoriumAktiv(konfig, jetzt) ? 'MINIMIEREN' : 'LOESCHEN';
}

export interface RetentionErgebnis {
  geloescht: number;
  belegNrs: string[];
  /** Im Moratorium minimierte REISEKOSTEN (IBAN/Kontoinhaber, Belege und PDF entfernt). */
  minimiert: number;
  minimiertBelegNrs: string[];
  dateienGeloescht: number;
  dateiFehler: number;
}

interface Dateibilanz {
  geloescht: number;
  fehler: number;
}

/**
 * Löscht eine Datei im Upload-Verzeichnis. true = entfernt oder schon weg (ENOENT); false = nicht
 * gelöscht — als Fehler mit Belegnummer protokolliert und gezählt.
 */
async function loescheUploadDatei(datei: string, belegNr: string, bilanz: Dateibilanz): Promise<boolean> {
  const resolved = path.resolve(datei);
  // Defense-in-depth: nur innerhalb des Upload-Verzeichnisses löschen.
  if (resolved !== UPLOAD_DIR && !resolved.startsWith(UPLOAD_DIR + path.sep)) {
    console.error(`[Retention] ${belegNr}: Datei außerhalb UPLOAD_DIR nicht gelöscht: ${resolved}`);
    bilanz.fehler++;
    return false;
  }
  try {
    await fs.promises.unlink(resolved);
    bilanz.geloescht++;
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return true;
    console.error(`[Retention] ${belegNr}: Datei nicht löschbar: ${resolved} (${(err as Error).message})`);
    bilanz.fehler++;
    return false;
  }
}

/**
 * Löscht alle abgelaufenen Vorgänge (`retentionAktion` = LOESCHEN) vollständig (DB inkl.
 * Cascade-Kinder + email_log + Beleg-Dateien + PDF) und minimiert den im Moratorium
 * zurückgehaltenen REISEKOSTEN-Altbestand. Gibt eine Bilanz zurück.
 */
export async function loescheAbgelaufeneVorgaenge(
  konfig: RetentionKonfig,
  jetzt: Date = new Date(),
): Promise<RetentionErgebnis> {
  const e = schema.einreichungen;

  // 1) Kandidaten: erfolgreich zugestellt UND älter als die Frist. Die Entscheidung je
  //    Vorgang trifft retentionAktion; die IBAN selbst wird dafür nicht gelesen.
  //    landJeTag wie in vma-nachkorrektur-2026.sql über to_jsonb — der Code läuft so auch vor
  //    Migration 0015 (ohne Spalte land_key; dann ist jeder Reisekosten-Vorgang Altbestand).
  //    `einreichungen.id` ausdrücklich qualifiziert: Drizzle schreibt Spalten in der Select-Liste
  //    ohne Tabellennamen, im Unterabfrage-Kontext träfe "id" sonst reisetage.id.
  const kandidaten = await db
    .select({
      id: e.id,
      typ: e.typ,
      status: e.status,
      createdAt: e.createdAt,
      belegNr: e.belegNr,
      pdfDateipfad: e.pdfDateipfad,
      hatBankdaten: sql<boolean>`(${e.bankIban} IS NOT NULL OR ${e.bankKontoinhaber} IS NOT NULL)`,
      landJeTag: sql<boolean>`EXISTS (SELECT 1 FROM ${schema.reisetage} r WHERE r.einreichung_id = einreichungen.id AND to_jsonb(r) ->> 'land_key' IS NOT NULL)`,
    })
    .from(e)
    .where(and(
      eq(e.status, 'GESENDET'),
      lt(e.createdAt, fristGrenze(konfig, jetzt)),
    ));

  const loeschen = kandidaten.filter(k => retentionAktion(k, konfig, jetzt) === 'LOESCHEN');
  const zurueckgehalten = kandidaten.filter(k => retentionAktion(k, konfig, jetzt) === 'MINIMIEREN');
  const leer: RetentionErgebnis = {
    geloescht: 0, belegNrs: [], minimiert: 0, minimiertBelegNrs: [], dateienGeloescht: 0, dateiFehler: 0,
  };
  if (loeschen.length === 0 && zurueckgehalten.length === 0) return leer;

  // 2) Beleg-Dateipfade einsammeln, BEVOR die Zeilen verschwinden.
  const belegDateien = await db
    .select({ id: schema.belege.id, einreichungId: schema.belege.einreichungId, dateipfad: schema.belege.dateipfad })
    .from(schema.belege)
    .where(inArray(schema.belege.einreichungId, [...loeschen, ...zurueckgehalten].map(k => k.id)));
  const belegeVon = (id: string) => belegDateien.filter(b => b.einreichungId === id);

  // Bereits minimierte Vorgänge (nichts mehr zu entfernen) nicht täglich erneut anfassen.
  const mitBelegen = new Set(belegDateien.map(b => b.einreichungId));
  const minimieren = zurueckgehalten.filter(k => k.hatBankdaten || k.pdfDateipfad || mitBelegen.has(k.id));
  if (loeschen.length === 0 && minimieren.length === 0) return leer;

  const loeschIds = loeschen.map(k => k.id);
  const minimierIds = minimieren.map(k => k.id);
  const bilanz: Dateibilanz = { geloescht: 0, fehler: 0 };

  // 3) Minimieren: Dateien ZUERST löschen und nur die Verweise auf tatsächlich entfernte Dateien
  //    aus der DB nehmen. Scheitert eine Datei, bleibt ihr Verweis — der nächste Lauf versucht es
  //    erneut (Filter oben), statt ein PDF mit Klartext-IBAN ohne DB-Verweis zurückzulassen.
  const belegeEntfernt: string[] = [];
  const pdfEntfernt: string[] = [];
  for (const k of minimieren) {
    for (const b of belegeVon(k.id)) {
      if (await loescheUploadDatei(b.dateipfad, k.belegNr, bilanz)) belegeEntfernt.push(b.id);
    }
    if (k.pdfDateipfad && await loescheUploadDatei(k.pdfDateipfad, k.belegNr, bilanz)) pdfEntfernt.push(k.id);
  }

  // 4) DB-Änderungen in einer Transaktion. Löschen: email_log zuerst explizit — der FK ist
  //    ON DELETE SET NULL, sonst bliebe die Log-Zeile mit dem Klarnamen im Betreff zurück.
  //    Danach die Einreichung; ihr Cascade räumt alle Kindtabellen.
  //    Minimieren: Bankdaten leeren, Verweise auf die entfernten Belege und PDFs löschen.
  await db.transaction(async (tx) => {
    if (loeschIds.length > 0) {
      await tx.delete(schema.emailLog).where(inArray(schema.emailLog.einreichungId, loeschIds));
      await tx.delete(e).where(inArray(e.id, loeschIds));
    }
    if (minimierIds.length > 0) {
      await tx.update(e)
        .set({ bankIban: null, bankKontoinhaber: null })
        .where(and(inArray(e.id, minimierIds), eq(e.typ, 'REISEKOSTEN')));
    }
    if (pdfEntfernt.length > 0) {
      await tx.update(e).set({ pdfDateipfad: null }).where(inArray(e.id, pdfEntfernt));
    }
    if (belegeEntfernt.length > 0) {
      await tx.delete(schema.belege).where(inArray(schema.belege.id, belegeEntfernt));
    }
  });

  // 5) Dateien der gelöschten Vorgänge NACH dem Commit — die personenbezogenen DB-Daten sind
  //    dann schon weg; eine nicht löschbare Datei wird mit Belegnummer protokolliert.
  for (const k of loeschen) {
    for (const b of belegeVon(k.id)) await loescheUploadDatei(b.dateipfad, k.belegNr, bilanz);
    if (k.pdfDateipfad) await loescheUploadDatei(k.pdfDateipfad, k.belegNr, bilanz);
  }

  return {
    geloescht: loeschen.length,
    belegNrs: loeschen.map(k => k.belegNr),
    minimiert: minimieren.length,
    minimiertBelegNrs: minimieren.map(k => k.belegNr),
    dateienGeloescht: bilanz.geloescht,
    dateiFehler: bilanz.fehler,
  };
}

let retentionTimer: NodeJS.Timeout | null = null;

/**
 * Startet den täglichen In-Process-Lauf. Erster (Catch-up-)Lauf ~1 min nach Start,
 * danach alle 24 h. Läuft nur in Produktion oder mit `RETENTION_ENABLED=true`, damit
 * in der Entwicklung keine Vorgänge automatisch verschwinden. Idempotent gegen
 * Doppelstart. Bei mehreren App-Instanzen liefe der Job je Instanz — Prod betreibt
 * genau einen App-Container. Fail-closed: Bei ungültiger Konfiguration startet der
 * Scheduler nicht (lieber gar nicht löschen als mit falsch gelesener Frist).
 */
export function starteRetentionScheduler(): void {
  const aktiv = process.env.NODE_ENV === 'production' || process.env.RETENTION_ENABLED === 'true';
  if (!aktiv) {
    console.log('[Retention] Scheduler inaktiv (nur Produktion / RETENTION_ENABLED=true).');
    return;
  }
  if (retentionTimer) return;

  const gelesen = leseRetentionKonfig(process.env);
  if (!gelesen.ok) {
    console.error(`[Retention] ${gelesen.fehler} — Scheduler NICHT gestartet, es wird nichts gelöscht.`);
    return;
  }
  const konfig = gelesen.konfig;

  const lauf = async () => {
    try {
      const warnung = moratoriumWarnung(konfig, new Date());
      if (warnung) console.warn(`[Retention] ${warnung}`);
      const r = await loescheAbgelaufeneVorgaenge(konfig);
      if (r.geloescht > 0 || r.minimiert > 0) {
        console.log(
          `[Retention] ${r.geloescht} abgelaufene Vorgänge gelöscht, ${r.minimiert} Reisekosten im Moratorium minimiert `
          + `(${r.dateienGeloescht} Dateien, ${r.dateiFehler} Datei-Fehler). `
          + `Gelöscht: ${r.belegNrs.join(', ') || '–'}; minimiert: ${r.minimiertBelegNrs.join(', ') || '–'}`,
        );
      }
    } catch (err) {
      console.error('[Retention] Lauf fehlgeschlagen:', err);
    }
  };

  const catchUp = setTimeout(lauf, 60 * 1000);
  retentionTimer = setInterval(lauf, EIN_TAG_MS);
  // Die Timer sollen einen sauberen Prozess-Exit nicht blockieren.
  catchUp.unref?.();
  retentionTimer.unref?.();

  const moratorium = moratoriumAktiv(konfig, new Date())
    ? ` Moratorium REISEKOSTEN aktiv, endet am ${konfig.moratoriumBis}: Altbestand ohne Land je Reisetag nicht löschen, nach Fristablauf nur IBAN/Kontoinhaber, Belege und PDF entfernen.`
    : ` Moratorium REISEKOSTEN am ${konfig.moratoriumBis} abgelaufen: normale Frist für alle Vorgänge.`;
  console.log(`[Retention] Scheduler aktiv (${konfig.tage}-Tage-Frist, täglich, nur GESENDET).${moratorium}`);
}
