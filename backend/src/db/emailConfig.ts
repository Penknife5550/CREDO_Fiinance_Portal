import { asc, desc, sql } from 'drizzle-orm';
import { db, schema } from './index.js';

/**
 * Liest die kanonische `email_config`-Zeile.
 *
 * `email_config` ist ein Singleton — Migration 0013 erzwingt das per Unique-Index.
 * Die Sortierung ist eine Absicherung fuer den (transienten) Mehrzeilen-Fall — vor
 * dem ersten Migrationslauf, nach einem Backup-Restore oder in einer Dev-DB: sie ist
 * eine TOTALORDNUNG und spiegelt exakt die Auswahl der Dedup-Migration 0013.
 * Bevorzugt eine vollstaendig konfigurierte Zeile (Server UND Passwort gesetzt), dann
 * die juengste (`updated_at`), dann kleinste `id`. So lesen ALLE Aufrufer dieselbe
 * Zeile, die auch die Migration behalten wuerde — nie eine leere Platzhalter-Zeile
 * (das war die Ursache des ENV-Fallbacks auf Outlook → 535). Gibt `null` zurueck,
 * wenn (noch) keine Zeile existiert.
 */
export async function ladeEmailConfigRow() {
  const [row] = await db
    .select()
    .from(schema.emailConfig)
    .orderBy(
      // Gleiche Praeferenz wie Migration 0013: vollstaendig konfigurierte Zeile zuerst.
      sql`(nullif(btrim(${schema.emailConfig.smtpServer}), '') is not null and ${schema.emailConfig.smtpPasswortEncrypted} is not null) desc`,
      desc(schema.emailConfig.updatedAt),
      asc(schema.emailConfig.id),
    )
    .limit(1);
  return row ?? null;
}
