-- Sammelfahrt-Vorgangstyp + Tabelle für Einzelfahrten innerhalb einer Sammelabrechnung
ALTER TYPE "einreichung_typ" ADD VALUE IF NOT EXISTS 'SAMMELFAHRT';

CREATE TABLE IF NOT EXISTS "fahrten" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "einreichung_id" uuid NOT NULL,
    "datum" timestamp NOT NULL,
    "start_ort" varchar(500) NOT NULL,
    "ziel" varchar(500) NOT NULL,
    "km" numeric(8, 2) NOT NULL,
    "km_betrag" numeric(10, 2) NOT NULL,
    "reihenfolge" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "fahrten"
    ADD CONSTRAINT "fahrten_einreichung_id_einreichungen_id_fk"
    FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "idx_fahrten_einreichung" ON "fahrten" ("einreichung_id");

-- Bestehende Kind-FKs auf ON DELETE CASCADE umstellen, damit das Löschen einer
-- Einreichung die Kind-Datensätze nicht mit FK-Fehler abbricht.
ALTER TABLE "reisetage"
    DROP CONSTRAINT IF EXISTS "reisetage_einreichung_id_einreichungen_id_fk",
    ADD CONSTRAINT "reisetage_einreichung_id_einreichungen_id_fk"
    FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "weitere_kosten"
    DROP CONSTRAINT IF EXISTS "weitere_kosten_einreichung_id_einreichungen_id_fk",
    ADD CONSTRAINT "weitere_kosten_einreichung_id_einreichungen_id_fk"
    FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "belege"
    DROP CONSTRAINT IF EXISTS "belege_einreichung_id_einreichungen_id_fk",
    ADD CONSTRAINT "belege_einreichung_id_einreichungen_id_fk"
    FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "positionen"
    DROP CONSTRAINT IF EXISTS "positionen_einreichung_id_einreichungen_id_fk",
    ADD CONSTRAINT "positionen_einreichung_id_einreichungen_id_fk"
    FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
