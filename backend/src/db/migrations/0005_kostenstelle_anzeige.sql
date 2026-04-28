-- Pro Mandant konfigurierbar, ob das Kostenstellen-Feld
-- im jeweiligen Vorgangstyp angezeigt wird. Default true = bisheriges Verhalten.
ALTER TABLE "mandanten" ADD COLUMN "kst_reisekosten_an" boolean DEFAULT true NOT NULL;
ALTER TABLE "mandanten" ADD COLUMN "kst_erstattung_an" boolean DEFAULT true NOT NULL;
ALTER TABLE "mandanten" ADD COLUMN "kst_sammelfahrt_an" boolean DEFAULT true NOT NULL;
