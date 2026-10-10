-- Release 1c: Auslandspauschalen nach Reisedatum (Satzstände je Kalenderjahr).
--
-- pauschalen_ausland: eine Zeile je Land UND Satzstand. Ein Stand gilt ab gueltig_von bis zum
-- nächsten Stand desselben Kalenderjahres; für einen Reisetag zählt nur ein Stand aus dessen
-- Kalenderjahr (fehlt er, lehnt das Portal die Abrechnung mit Hinweis ab). Der Bestand
-- (Migrationen 0008/0014/0016, ggf. im AdminCenter gepflegt) wird zum Stand 01.01.2026 nach
-- BMF-Schreiben vom 05.12.2025. Neue Jahresstände: Generator backend/scripts/bmf-csv-zu-sql.ts
-- (--jahr …) als neue Migration; Einzelstände im AdminCenter. Die Defaults dienen nur dem
-- Backfill und werden danach entfernt: Jeder neue Stand muss Datum und Quelle ausdrücklich
-- nennen (sonst landete ein INSERT ohne gueltig_von still im Stand 2026).
--
-- reisetage.satz_24h / satz_8h / satz_quelle: am Tag angewandter Satz (Nachvollziehbarkeit),
-- nullable, kein Backfill (Altbestand: Satz ergibt sich aus Land und Stand 2026).
ALTER TABLE "pauschalen_ausland" ADD COLUMN IF NOT EXISTS "gueltig_von" date DEFAULT '2026-01-01' NOT NULL;
--> statement-breakpoint
ALTER TABLE "pauschalen_ausland" ADD COLUMN IF NOT EXISTS "quelle" varchar(200) DEFAULT 'BMF-Schreiben vom 05.12.2025' NOT NULL;
--> statement-breakpoint
ALTER TABLE "pauschalen_ausland" ALTER COLUMN "gueltig_von" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "pauschalen_ausland" ALTER COLUMN "quelle" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "pauschalen_ausland" DROP CONSTRAINT IF EXISTS "pauschalen_ausland_pkey";
--> statement-breakpoint
ALTER TABLE "pauschalen_ausland" ADD CONSTRAINT "pauschalen_ausland_land_key_gueltig_von_pk" PRIMARY KEY ("land_key", "gueltig_von");
--> statement-breakpoint
ALTER TABLE "reisetage" ADD COLUMN IF NOT EXISTS "satz_24h" numeric(8, 2);
--> statement-breakpoint
ALTER TABLE "reisetage" ADD COLUMN IF NOT EXISTS "satz_8h" numeric(8, 2);
--> statement-breakpoint
ALTER TABLE "reisetage" ADD COLUMN IF NOT EXISTS "satz_quelle" varchar(200);
