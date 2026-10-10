-- Städte mit eigenem BMF-Satz der „Häufigen Ziele“ direkt unter ihren Staat sortieren
-- (reihenfolge < 1000 = Gruppe „Häufige Ziele“ in der Länderauswahl). Sonst wählt man für
-- Mallorca leicht „Spanien“ (34/23) statt „Spanien — Palma de Mallorca“ (44/29).
-- Nur Zeilen, die noch die Sortierung aus 0014 (>= 1000) haben — im AdminCenter
-- umsortierte Einträge bleiben unverändert.
UPDATE pauschalen_ausland AS p SET reihenfolge = v.reihenfolge, updated_at = NOW()
FROM (VALUES
  ('Italien — Mailand',            52),
  ('Polen — Breslau',              91),
  ('Polen — Warschau',             92),
  ('Schweiz — Bern',              102),
  ('Spanien — Kanarische Inseln', 113),
  ('Spanien — Palma de Mallorca', 114),
  ('USA — Atlanta',               131),
  ('USA — Boston',                132),
  ('USA — Chicago',               133),
  ('USA — Houston',               134),
  ('USA — Los Angeles',           135),
  ('USA — Miami',                 136),
  ('USA — New York City',         137),
  ('USA — San Francisco',         138),
  ('USA — Washington, D. C.',     139)
) AS v(land_key, reihenfolge)
WHERE p.land_key = v.land_key AND p.reihenfolge >= 1000;
