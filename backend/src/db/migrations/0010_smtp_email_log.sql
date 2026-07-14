-- Teil 2 (SMTP statt n8n): Versandprotokoll + Aufraeumen der Versandmethode.
--
-- 1) email_log: protokolliert jeden Zustellversuch (SMTP wie Webhook) fuer
--    Nachvollziehbarkeit (IKS) und die Admin-Ansicht. FK auf die Einreichung ist
--    optional (ON DELETE SET NULL); beleg_nr wird denormalisiert mitgeschrieben.
-- 2) Legacy 'MS365' (toter Code, kein OAuth-Versand) auf 'SMTP' migrieren, damit
--    versand.ts nur noch WEBHOOK|SMTP kennt.

CREATE TABLE IF NOT EXISTS "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"einreichung_id" uuid REFERENCES "einreichungen"("id") ON DELETE SET NULL,
	"beleg_nr" varchar(20),
	"kanal" varchar(10) NOT NULL,
	"status" varchar(10) NOT NULL,
	"empfaenger" varchar(255),
	"betreff" varchar(500),
	"message_id" varchar(255),
	"fehler" text,
	"versuche" integer DEFAULT 0 NOT NULL,
	"ist_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_log_einreichung_idx" ON "email_log" ("einreichung_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_log_created_at_idx" ON "email_log" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_log_status_idx" ON "email_log" ("status");
--> statement-breakpoint
-- MS365 war toter Code: kein OAuth-Versand implementiert, versand.ts fiel still in SMTP.
UPDATE "email_config" SET "versand_methode" = 'SMTP' WHERE "versand_methode" = 'MS365';
