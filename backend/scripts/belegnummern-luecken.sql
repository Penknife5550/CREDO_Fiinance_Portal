-- Belegnummern, die es in der DB nicht (mehr) gibt: Lücken je Präfix und Jahr bis zur höchsten
-- vergebenen Nummer (RK-, KE-, SF-, KF-JJJJ-NNNNN). Zweck: gelöschte Vorgänge rekonstruieren, wenn
-- die Logs des Löschjobs nicht mehr vorliegen (DEPLOYMENT.md §13, Vorfall 13.10.2026).
-- Obergrenze: Lücken entstehen auch durch von Hand gelöschte Test-Vorgänge oder abgebrochene
-- Einreichungen. Maßgeblich ist der Abgleich mit DokuBit.
-- Aufruf: docker exec -i credo-finanz-db psql -U credo -d finanzportal < backend/scripts/belegnummern-luecken.sql
WITH b AS (
  SELECT split_part(beleg_nr, '-', 1) AS p, split_part(beleg_nr, '-', 2) AS j,
         split_part(beleg_nr, '-', 3)::int AS n
  FROM einreichungen
  WHERE beleg_nr ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'
), m AS (
  SELECT p, j, max(n) AS mx FROM b GROUP BY p, j
)
SELECT m.p || '-' || m.j || '-' || lpad(g::text, 5, '0') AS fehlt_in_db
FROM m CROSS JOIN LATERAL generate_series(1, m.mx) AS g
WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.p = m.p AND b.j = m.j AND b.n = g)
ORDER BY m.p, m.j, g;
