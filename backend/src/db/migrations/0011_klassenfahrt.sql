-- Teil 3: Klassenfahrt-Abrechnung (nur Mandant 40 = Christlicher Schulverein Minden e.V.).

-- Neuer Vorgangstyp. ADD VALUE wird nicht in derselben Migration verwendet (nur Struktur), daher unkritisch.
ALTER TYPE "einreichung_typ" ADD VALUE IF NOT EXISTS 'KLASSENFAHRT';
--> statement-breakpoint
-- Persoenliches Auszahlungskonto ist bei KF leer (Konten liegen je Klasse) → nullable.
ALTER TABLE "einreichungen" ALTER COLUMN "bank_iban" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "einreichungen" ALTER COLUMN "bank_kontoinhaber" DROP NOT NULL;
--> statement-breakpoint
-- Idempotenz gegen Doppel-Submit (verlorene Response). NULLs sind erlaubt (mehrfach), nur echte Keys sind eindeutig.
ALTER TABLE "einreichungen" ADD COLUMN IF NOT EXISTS "idempotenz_key" varchar(64);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "einreichungen_idempotenz_key_uidx" ON "einreichungen" ("idempotenz_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "klassenfahrt_klassen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"einreichung_id" uuid NOT NULL REFERENCES "einreichungen"("id") ON DELETE CASCADE,
	"reihenfolge" integer DEFAULT 0 NOT NULL,
	"bezeichnung" varchar(100),
	"schueler" integer NOT NULL,
	"begleiter" numeric(5, 2) NOT NULL,
	"empfaenger" varchar(200) NOT NULL,
	"iban" varchar(34) NOT NULL,
	"zuschuss" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "klassenfahrt_klassen_einreichung_idx" ON "klassenfahrt_klassen" ("einreichung_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "klassenfahrt_kostenzeilen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"einreichung_id" uuid NOT NULL REFERENCES "einreichungen"("id") ON DELETE CASCADE,
	"reihenfolge" integer DEFAULT 0 NOT NULL,
	"oberkategorie" varchar(30) NOT NULL,
	"bezeichnung" varchar(200) NOT NULL,
	"modus" varchar(12) NOT NULL,
	"betrag" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "klassenfahrt_kostenzeilen_einreichung_idx" ON "klassenfahrt_kostenzeilen" ("einreichung_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "klassenfahrt_kostenzeile_anteil" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kostenzeile_id" uuid NOT NULL REFERENCES "klassenfahrt_kostenzeilen"("id") ON DELETE CASCADE,
	"klasse_reihenfolge" integer NOT NULL,
	"betrag" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "klassenfahrt_anteil_kostenzeile_idx" ON "klassenfahrt_kostenzeile_anteil" ("kostenzeile_id");
