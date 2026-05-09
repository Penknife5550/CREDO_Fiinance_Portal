-- Auslandspauschalen 2026 (BMF-Schreiben v. 05.12.2025)
-- Editierbar im AdminCenter (PauschalenTab).

CREATE TABLE IF NOT EXISTS pauschalen_ausland (
  land_key VARCHAR(100) PRIMARY KEY,
  tagessatz_24h DECIMAL(8,2) NOT NULL,
  tagessatz_8h DECIMAL(8,2) NOT NULL,
  uebernachtung DECIMAL(8,2) NOT NULL,
  reihenfolge INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO pauschalen_ausland (land_key, tagessatz_24h, tagessatz_8h, uebernachtung, reihenfolge) VALUES
  ('Belgien',                  59.00, 40.00, 141.00,  10),
  ('Dänemark',                 75.00, 50.00, 152.00,  20),
  ('Frankreich',               53.00, 36.00, 148.00,  30),
  ('Frankreich — Paris',       58.00, 39.00, 158.00,  31),
  ('Großbritannien',           52.00, 35.00, 150.00,  40),
  ('Großbritannien — London',  66.00, 44.00, 220.00,  41),
  ('Italien',                  42.00, 28.00, 138.00,  50),
  ('Italien — Rom',            48.00, 32.00, 160.00,  51),
  ('Luxemburg',                63.00, 42.00, 130.00,  60),
  ('Niederlande',              58.00, 39.00, 125.00,  70),
  ('Österreich',               50.00, 33.00, 108.00,  80),
  ('Polen',                    30.00, 20.00,  73.00,  90),
  ('Schweiz',                  68.00, 46.00, 180.00, 100),
  ('Schweiz — Genf',           70.00, 47.00, 200.00, 101),
  ('Spanien',                  42.00, 28.00, 115.00, 110),
  ('Spanien — Barcelona',      34.00, 23.00, 130.00, 111),
  ('Spanien — Madrid',         42.00, 28.00, 140.00, 112),
  ('Tschechien',               32.00, 21.00,  83.00, 120),
  ('USA',                      51.00, 34.00, 190.00, 130)
ON CONFLICT (land_key) DO NOTHING;
