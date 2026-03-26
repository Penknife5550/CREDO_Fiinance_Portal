CREATE TYPE "public"."abfahrt_ort" AS ENUM('WOHNUNG', 'TAETIGKEIT');--> statement-breakpoint
CREATE TYPE "public"."einreichung_status" AS ENUM('EINGEREICHT', 'GESENDET', 'FEHLER');--> statement-breakpoint
CREATE TYPE "public"."einreichung_typ" AS ENUM('REISEKOSTEN', 'ERSTATTUNG');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('AUSSTEHEND', 'GESENDET', 'FEHLER');--> statement-breakpoint
CREATE TYPE "public"."erstattung_kategorie" AS ENUM('BUEROMATERIAL', 'FACHLITERATUR', 'LEBENSMITTEL', 'ARBEITSMITTEL', 'FORTBILDUNG', 'SONSTIGES');--> statement-breakpoint
CREATE TYPE "public"."reisetag_typ" AS ENUM('ANREISE', 'GANZTAG', 'ABREISE', 'EINTAEGIG');--> statement-breakpoint
CREATE TYPE "public"."verkehrsmittel" AS ENUM('PKW', 'MOTORRAD', 'OEPNV', 'BAHN', 'FLUG', 'SONSTIGE');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"passwort_hash" varchar(255) NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"aktion" varchar(50) NOT NULL,
	"entitaet" varchar(50) NOT NULL,
	"entitaet_id" varchar(50),
	"alte_werte" text,
	"neue_werte" text,
	"zeitstempel" timestamp DEFAULT now() NOT NULL,
	"ip_adresse" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "belege" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"einreichung_id" uuid NOT NULL,
	"dateiname" varchar(255) NOT NULL,
	"dateityp" varchar(10) NOT NULL,
	"dateigroesse" integer NOT NULL,
	"dateipfad" varchar(500) NOT NULL,
	"sha256_hash" varchar(64) NOT NULL,
	"upload_zeit" timestamp DEFAULT now() NOT NULL,
	"beschreibung" varchar(500),
	"betrag" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "einreichungen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"typ" "einreichung_typ" NOT NULL,
	"beleg_nr" varchar(20) NOT NULL,
	"mandant_id" uuid NOT NULL,
	"kostenstelle_id" uuid NOT NULL,
	"status" "einreichung_status" DEFAULT 'EINGEREICHT' NOT NULL,
	"mitarbeiter_vorname" varchar(100) NOT NULL,
	"mitarbeiter_nachname" varchar(100) NOT NULL,
	"mitarbeiter_personal_nr" varchar(20) NOT NULL,
	"bank_iban" varchar(34) NOT NULL,
	"bank_kontoinhaber" varchar(200) NOT NULL,
	"reiseanlass" text,
	"reiseziel" text,
	"abfahrt_ort" "abfahrt_ort",
	"abfahrt_zeit" timestamp,
	"rueckkehr_zeit" timestamp,
	"land" varchar(100),
	"verkehrsmittel" "verkehrsmittel",
	"km_gefahren" numeric(8, 2),
	"km_berechnet" numeric(8, 2),
	"km_pauschale_satz" numeric(4, 2),
	"km_betrag" numeric(10, 2),
	"vma_brutto" numeric(10, 2),
	"vma_kuerzung" numeric(10, 2),
	"vma_netto" numeric(10, 2),
	"weitere_kosten_summe" numeric(10, 2),
	"gesamtbetrag" numeric(10, 2) NOT NULL,
	"unterschrift_bild" text,
	"unterschrift_zeit" timestamp,
	"pdf_dateipfad" varchar(500),
	"email_status" "email_status" DEFAULT 'AUSSTEHEND' NOT NULL,
	"email_versuche" integer DEFAULT 0 NOT NULL,
	"email_letzter_fehler" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "einreichungen_beleg_nr_unique" UNIQUE("beleg_nr")
);
--> statement-breakpoint
CREATE TABLE "email_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"versand_methode" varchar(10) DEFAULT 'SMTP' NOT NULL,
	"smtp_server" varchar(255),
	"smtp_port" integer,
	"smtp_user" varchar(255),
	"smtp_passwort_encrypted" text,
	"ms365_tenant_id" varchar(255),
	"ms365_client_id" varchar(255),
	"ms365_client_secret_encrypted" text,
	"absender_name" varchar(255) DEFAULT 'CREDO Finanzportal' NOT NULL,
	"absender_email" varchar(255) NOT NULL,
	"max_versuche" integer DEFAULT 3 NOT NULL,
	"fehler_email" varchar(255),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kostenstellen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandant_id" uuid NOT NULL,
	"bezeichnung" varchar(255) NOT NULL,
	"nummer" varchar(20) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mandanten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandant_nr" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"kategorie" varchar(100) NOT NULL,
	"dms_email" varchar(255) NOT NULL,
	"primaerfarbe" varchar(7) DEFAULT '#6B7280' NOT NULL,
	"logo" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mandanten_mandant_nr_unique" UNIQUE("mandant_nr")
);
--> statement-breakpoint
CREATE TABLE "pauschalen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"typ" varchar(30) NOT NULL,
	"land" varchar(100),
	"ort" varchar(100),
	"betrag" numeric(10, 2) NOT NULL,
	"gueltig_von" timestamp NOT NULL,
	"gueltig_bis" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positionen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"einreichung_id" uuid NOT NULL,
	"beschreibung" varchar(500) NOT NULL,
	"kategorie" "erstattung_kategorie" NOT NULL,
	"datum" timestamp NOT NULL,
	"betrag" numeric(10, 2) NOT NULL,
	"beleg_id" uuid
);
--> statement-breakpoint
CREATE TABLE "reisetage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"einreichung_id" uuid NOT NULL,
	"datum" timestamp NOT NULL,
	"typ" "reisetag_typ" NOT NULL,
	"fruehstueck_gestellt" boolean DEFAULT false NOT NULL,
	"mittag_gestellt" boolean DEFAULT false NOT NULL,
	"abend_gestellt" boolean DEFAULT false NOT NULL,
	"vma_brutto" numeric(10, 2) NOT NULL,
	"vma_kuerzung" numeric(10, 2) DEFAULT '0' NOT NULL,
	"vma_netto" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aktiv" boolean DEFAULT false NOT NULL,
	"url" varchar(500),
	"secret" varchar(255),
	"event_eingereicht" boolean DEFAULT true NOT NULL,
	"event_status_geaendert" boolean DEFAULT true NOT NULL,
	"event_fehler" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weitere_kosten" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"einreichung_id" uuid NOT NULL,
	"typ" varchar(50) NOT NULL,
	"beschreibung" varchar(500),
	"betrag" numeric(10, 2) NOT NULL,
	"beleg_id" uuid
);
--> statement-breakpoint
ALTER TABLE "belege" ADD CONSTRAINT "belege_einreichung_id_einreichungen_id_fk" FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einreichungen" ADD CONSTRAINT "einreichungen_mandant_id_mandanten_id_fk" FOREIGN KEY ("mandant_id") REFERENCES "public"."mandanten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einreichungen" ADD CONSTRAINT "einreichungen_kostenstelle_id_kostenstellen_id_fk" FOREIGN KEY ("kostenstelle_id") REFERENCES "public"."kostenstellen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kostenstellen" ADD CONSTRAINT "kostenstellen_mandant_id_mandanten_id_fk" FOREIGN KEY ("mandant_id") REFERENCES "public"."mandanten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positionen" ADD CONSTRAINT "positionen_einreichung_id_einreichungen_id_fk" FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reisetage" ADD CONSTRAINT "reisetage_einreichung_id_einreichungen_id_fk" FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weitere_kosten" ADD CONSTRAINT "weitere_kosten_einreichung_id_einreichungen_id_fk" FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weitere_kosten" ADD CONSTRAINT "weitere_kosten_beleg_id_belege_id_fk" FOREIGN KEY ("beleg_id") REFERENCES "public"."belege"("id") ON DELETE no action ON UPDATE no action;