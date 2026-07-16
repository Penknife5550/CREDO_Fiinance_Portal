-- Audit #1/#15: race-freie, atomare Belegnummern-Vergabe statt SELECT MAX + Advisory-Lock.
CREATE TABLE IF NOT EXISTS "beleg_counter" (
	"typ" "einreichung_typ" NOT NULL,
	"jahr" integer NOT NULL,
	"last_num" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "beleg_counter_typ_jahr_pk" PRIMARY KEY("typ","jahr")
);
--> statement-breakpoint
-- Zähler aus dem bisherigen Höchststand je (typ, jahr) seeden, damit bestehende
-- Belegnummern respektiert werden und die Vergabe lückenlos fortgesetzt wird.
INSERT INTO "beleg_counter" ("typ", "jahr", "last_num")
SELECT typ, split_part(beleg_nr, '-', 2)::int AS jahr, MAX(split_part(beleg_nr, '-', 3)::int) AS last_num
FROM "einreichungen"
WHERE beleg_nr ~ '^[A-Z]{2}-[0-9]{4}-[0-9]{5}$'
GROUP BY typ, split_part(beleg_nr, '-', 2)::int
ON CONFLICT ("typ", "jahr") DO NOTHING;
