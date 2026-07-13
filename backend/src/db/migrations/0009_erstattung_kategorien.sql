-- Konfigurierbare Erstattungs-Kategorien pro Mandant.
-- Ersetzt das feste Enum `erstattung_kategorie` durch eine DB-gepflegte Tabelle.

CREATE TABLE IF NOT EXISTS "erstattung_kategorien" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandant_id" uuid NOT NULL REFERENCES "mandanten"("id") ON DELETE CASCADE,
	"key" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"reihenfolge" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "erstattung_kategorien_mandant_active_idx" ON "erstattung_kategorien" ("mandant_id","active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "erstattung_kategorien_mandant_key_uidx" ON "erstattung_kategorien" ("mandant_id","key");
--> statement-breakpoint
-- Positionen-Kategorie von Enum auf varchar umstellen (Bestandswerte bleiben, gleiche Strings)
ALTER TABLE "positionen" ALTER COLUMN "kategorie" SET DATA TYPE varchar(50) USING "kategorie"::text;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."erstattung_kategorie";
--> statement-breakpoint
-- Seed: 6 Standard-Kategorien fuer alle bereits vorhandenen Mandanten (idempotent).
-- Bei frischen Installationen erfolgt das Seeding zusaetzlich in seed.ts, da die
-- Mandanten dort erst NACH den Migrationen angelegt werden.
INSERT INTO "erstattung_kategorien" ("mandant_id","key","label","reihenfolge")
SELECT m."id", k."key", k."label", k."reihenfolge"
FROM "mandanten" m
CROSS JOIN (VALUES
	('BUEROMATERIAL','Büromaterial',10),
	('FACHLITERATUR','Fachliteratur',20),
	('LEBENSMITTEL','Lebensmittel',30),
	('ARBEITSMITTEL','Arbeitsmittel',40),
	('FORTBILDUNG','Fortbildung',50),
	('SONSTIGES','Sonstiges',60)
) AS k("key","label","reihenfolge")
ON CONFLICT ("mandant_id","key") DO NOTHING;
--> statement-breakpoint
-- Zusaetzlich fuer Mandant 40 (Foerderverein): Schulleiterbudget
INSERT INTO "erstattung_kategorien" ("mandant_id","key","label","reihenfolge")
SELECT "id", 'SCHULLEITERBUDGET', 'Schulleiterbudget', 55
FROM "mandanten" WHERE "mandant_nr" = 40
ON CONFLICT ("mandant_id","key") DO NOTHING;
