-- Cascade-Constraints anpassen: Bestehende FKs droppen und mit ON DELETE-Regel neu setzen
ALTER TABLE "belege" DROP CONSTRAINT "belege_einreichung_id_einreichungen_id_fk";--> statement-breakpoint
ALTER TABLE "kostenstellen" DROP CONSTRAINT "kostenstellen_mandant_id_mandanten_id_fk";--> statement-breakpoint
ALTER TABLE "positionen" DROP CONSTRAINT "positionen_einreichung_id_einreichungen_id_fk";--> statement-breakpoint
ALTER TABLE "reisetage" DROP CONSTRAINT "reisetage_einreichung_id_einreichungen_id_fk";--> statement-breakpoint
ALTER TABLE "weitere_kosten" DROP CONSTRAINT "weitere_kosten_einreichung_id_einreichungen_id_fk";--> statement-breakpoint
ALTER TABLE "weitere_kosten" DROP CONSTRAINT "weitere_kosten_beleg_id_belege_id_fk";--> statement-breakpoint
ALTER TABLE "belege" ADD CONSTRAINT "belege_einreichung_id_einreichungen_id_fk" FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kostenstellen" ADD CONSTRAINT "kostenstellen_mandant_id_mandanten_id_fk" FOREIGN KEY ("mandant_id") REFERENCES "public"."mandanten"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positionen" ADD CONSTRAINT "positionen_einreichung_id_einreichungen_id_fk" FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reisetage" ADD CONSTRAINT "reisetage_einreichung_id_einreichungen_id_fk" FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weitere_kosten" ADD CONSTRAINT "weitere_kosten_einreichung_id_einreichungen_id_fk" FOREIGN KEY ("einreichung_id") REFERENCES "public"."einreichungen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weitere_kosten" ADD CONSTRAINT "weitere_kosten_beleg_id_belege_id_fk" FOREIGN KEY ("beleg_id") REFERENCES "public"."belege"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Indexe auf häufig gefilterten Spalten
CREATE INDEX IF NOT EXISTS "belege_einreichung_idx" ON "belege" USING btree ("einreichung_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "einreichungen_mandant_idx" ON "einreichungen" USING btree ("mandant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "einreichungen_status_idx" ON "einreichungen" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "einreichungen_email_status_idx" ON "einreichungen" USING btree ("email_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "einreichungen_created_at_idx" ON "einreichungen" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kostenstellen_mandant_active_idx" ON "kostenstellen" USING btree ("mandant_id","active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mandanten_active_idx" ON "mandanten" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "positionen_einreichung_idx" ON "positionen" USING btree ("einreichung_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reisetage_einreichung_idx" ON "reisetage" USING btree ("einreichung_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weitere_kosten_einreichung_idx" ON "weitere_kosten" USING btree ("einreichung_id");
