-- Release 1b: Land je Reisetag + Übernachtungsangabe (§ 9 Abs. 4a S. 5 EStG, BMF 05.12.2025).
-- Alle Spalten nullable, kein Backfill (Altbestand: maßgebend war einreichungen.land), keine FKs
-- (Land-Keys können im AdminCenter gepflegt werden; der Beleg hält den Stand der Einreichung fest).
--
-- reisetage.land_24uhr             Angabe: Land des Ortes, der vor 24 Uhr erreicht wird (Anreise-/Zwischentag)
-- reisetage.letzter_taetigkeitsort Angabe: Land der letzten beruflichen Tätigkeit an diesem Tag
-- reisetage.land_key               maßgebendes Land (vom Server bestimmt): 'INLAND', 'ANDERES', 'SEETAG' oder Land-Key
-- reisetage.land_freitext          Staat bei 'ANDERES' (nicht in der BMF-Übersicht)
-- einreichungen.uebernachtung      Auswärtige Übernachtung (Pflicht nur bei < 24 h über zwei Kalendertage)
ALTER TABLE "reisetage" ADD COLUMN IF NOT EXISTS "land_24uhr" varchar(100);
--> statement-breakpoint
ALTER TABLE "reisetage" ADD COLUMN IF NOT EXISTS "letzter_taetigkeitsort" varchar(100);
--> statement-breakpoint
ALTER TABLE "reisetage" ADD COLUMN IF NOT EXISTS "land_key" varchar(100);
--> statement-breakpoint
ALTER TABLE "reisetage" ADD COLUMN IF NOT EXISTS "land_freitext" varchar(100);
--> statement-breakpoint
ALTER TABLE "einreichungen" ADD COLUMN IF NOT EXISTS "uebernachtung" boolean;
