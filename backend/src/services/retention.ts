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
 * Ausführung: in-process, täglich (siehe `starteRetentionScheduler`), aber nur in
 * Produktion bzw. mit `RETENTION_ENABLED=true`, damit in Dev keine Testdaten stillt
 * verschwinden. Die Kernfunktion `loescheAbgelaufeneVorgaenge` ist unabhängig davon
 * direkt aufrufbar (Tests, manueller Lauf).
 */

import fs from 'fs';
import path from 'path';
import { and, eq, lt, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

const RETENTION_TAGE = Number(process.env.RETENTION_TAGE) || 90;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const EIN_TAG_MS = 24 * 60 * 60 * 1000;

export interface RetentionErgebnis {
  geloescht: number;
  belegNrs: string[];
  dateienGeloescht: number;
  dateiFehler: number;
}

/**
 * Löscht alle zugestellten Vorgänge, die älter als `maxAlterTage` sind, vollständig
 * (DB inkl. Cascade-Kinder + email_log + Beleg-Dateien + PDF). Gibt eine Bilanz zurück.
 */
export async function loescheAbgelaufeneVorgaenge(
  maxAlterTage = RETENTION_TAGE,
): Promise<RetentionErgebnis> {
  const grenze = new Date(Date.now() - maxAlterTage * EIN_TAG_MS);

  // 1) Kandidaten: erfolgreich zugestellt UND älter als die Frist.
  const kandidaten = await db
    .select({
      id: schema.einreichungen.id,
      belegNr: schema.einreichungen.belegNr,
      pdfDateipfad: schema.einreichungen.pdfDateipfad,
    })
    .from(schema.einreichungen)
    .where(and(
      eq(schema.einreichungen.status, 'GESENDET'),
      lt(schema.einreichungen.createdAt, grenze),
    ));

  if (kandidaten.length === 0) {
    return { geloescht: 0, belegNrs: [], dateienGeloescht: 0, dateiFehler: 0 };
  }

  const ids = kandidaten.map(k => k.id);

  // 2) Beleg-Dateipfade einsammeln, BEVOR die Zeilen (per Cascade) verschwinden.
  const belegDateien = await db
    .select({ dateipfad: schema.belege.dateipfad })
    .from(schema.belege)
    .where(inArray(schema.belege.einreichungId, ids));

  // 3) Harte DB-Löschung in einer Transaktion. email_log zuerst explizit löschen —
  //    der FK ist ON DELETE SET NULL, sonst bliebe die Log-Zeile mit dem Klarnamen im
  //    Betreff zurück. Danach die Einreichung; ihr Cascade räumt alle Kindtabellen.
  await db.transaction(async (tx) => {
    await tx.delete(schema.emailLog).where(inArray(schema.emailLog.einreichungId, ids));
    await tx.delete(schema.einreichungen).where(inArray(schema.einreichungen.id, ids));
  });

  // 4) Dateien NACH dem Commit löschen. Ein Fehler hier ist unkritisch (die
  //    personenbezogenen DB-Daten sind bereits weg) und wird nur protokolliert.
  const dateien = [
    ...belegDateien.map(b => b.dateipfad),
    ...kandidaten.map(k => k.pdfDateipfad).filter((p): p is string => !!p),
  ];

  let dateienGeloescht = 0;
  let dateiFehler = 0;
  for (const datei of dateien) {
    const resolved = path.resolve(datei);
    // Defense-in-depth: nur innerhalb des Upload-Verzeichnisses löschen.
    if (resolved !== UPLOAD_DIR && !resolved.startsWith(UPLOAD_DIR + path.sep)) {
      console.warn(`[Retention] Datei außerhalb UPLOAD_DIR übersprungen: ${resolved}`);
      dateiFehler++;
      continue;
    }
    try {
      await fs.promises.unlink(resolved);
      dateienGeloescht++;
    } catch (err) {
      // Bereits gelöschte Datei (ENOENT) ist kein Fehler.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[Retention] Datei nicht löschbar: ${resolved} (${(err as Error).message})`);
        dateiFehler++;
      }
    }
  }

  return {
    geloescht: kandidaten.length,
    belegNrs: kandidaten.map(k => k.belegNr),
    dateienGeloescht,
    dateiFehler,
  };
}

let retentionTimer: NodeJS.Timeout | null = null;

/**
 * Startet den täglichen In-Process-Lauf. Erster (Catch-up-)Lauf ~1 min nach Start,
 * danach alle 24 h. Läuft nur in Produktion oder mit `RETENTION_ENABLED=true`, damit
 * in der Entwicklung keine Vorgänge automatisch verschwinden. Idempotent gegen
 * Doppelstart. Bei mehreren App-Instanzen liefe der Job je Instanz — Prod betreibt
 * genau einen App-Container.
 */
export function starteRetentionScheduler(): void {
  const aktiv = process.env.NODE_ENV === 'production' || process.env.RETENTION_ENABLED === 'true';
  if (!aktiv) {
    console.log('[Retention] Scheduler inaktiv (nur Produktion / RETENTION_ENABLED=true).');
    return;
  }
  if (retentionTimer) return;

  const lauf = async () => {
    try {
      const r = await loescheAbgelaufeneVorgaenge();
      if (r.geloescht > 0) {
        console.log(
          `[Retention] ${r.geloescht} abgelaufene Vorgänge gelöscht `
          + `(${r.dateienGeloescht} Dateien, ${r.dateiFehler} Datei-Fehler): ${r.belegNrs.join(', ')}`,
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
  console.log(`[Retention] Scheduler aktiv (${RETENTION_TAGE}-Tage-Frist, täglich, nur GESENDET).`);
}
