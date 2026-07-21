-- Fix: email_config zum echten Singleton machen.
-- Ursache des Bugs: seed.ts fuegte bei JEDEM Container-Start eine weitere Zeile ein
-- (onConflictDoNothing griff mangels Unique-Constraint nie), waehrend alle Leser
-- `SELECT ... LIMIT 1` OHNE ORDER BY nutzten und so nicht-deterministisch mal eine
-- leere Platzhalter-Zeile lasen → ENV-Fallback (Outlook) → 535-Auth-Fehler.

-- 1) Duplikate entfernen: genau EINE Zeile behalten. Bevorzugt eine vollstaendig
--    konfigurierte (Server UND Passwort gesetzt), dann die juengste, dann kleinste id.
--    Sicher bei 0, 1 oder vielen Zeilen.
DELETE FROM "email_config"
WHERE "id" NOT IN (
  SELECT "id" FROM "email_config"
  ORDER BY
    (NULLIF(btrim("smtp_server"), '') IS NOT NULL AND "smtp_passwort_encrypted" IS NOT NULL) DESC,
    "updated_at" DESC,
    "id" ASC
  LIMIT 1
);
--> statement-breakpoint
-- 2) Singleton hart erzwingen: Unique-Index auf konstantem Ausdruck erlaubt nur 1 Zeile.
--    Damit greift kuenftig auch das vorhandene onConflictDoNothing im Seed.
CREATE UNIQUE INDEX IF NOT EXISTS "email_config_singleton" ON "email_config" ((true));
