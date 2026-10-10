-- =============================================================================
-- VMA-Nachkorrektur 2026 — Ist/Soll je Reisetag und je Beleg
-- =============================================================================
--
-- ZWECK
--   Bis Release 1a hat das Portal die Auslands-VMA falsch berechnet (BMF-Endbeträge
--   zusätzlich × 1,2 bzw. × 0,8, 8-h-Spalte ignoriert) und eintägige Reisen mit genau
--   8:00 h bereits vergütet (Gesetz: strikt MEHR als 8 h). Außerdem war die Tagesliste
--   im Browser zeitzonenabhängig (Zeitumstellung, Abfahrt vor 02:00 Uhr). Das Skript stellt
--   für alle Reisekosten-Belege seit 01.01.2026 die ausgezahlte VMA (Ist) der gesetzlichen
--   VMA (Soll) gegenüber — je Kalendertag und je Beleg. Es ändert nichts an der Datenbank.
--
-- VORAUSSETZUNG
--   Tabellenstand VOR Release 1c (pauschalen_ausland mit Primärschlüssel land_key); läuft vor
--   und nach Migration 0015 (Release 1b).
--   Das Soll rechnet mit den BMF-Sätzen 2026 aus der CTE `bmf` (generiert aus
--   backend/src/db/data/bmf-auslandspauschalen-2026*.csv), NICHT mit dem DB-Inhalt von
--   pauschalen_ausland. Im AdminCenter abweichend gepflegte Sätze fließen also nicht ins
--   Soll, sie erscheinen als Prüfhinweis.
--
-- SOLL-REGELN (§ 9 Abs. 4a EStG, BMF-Schreiben vom 05.12.2025)
--   Die Tage werden aus Abfahrt/Rückkehr NEU gebildet, nicht aus der gespeicherten
--   Tagesliste: gleicher Kalendertag = eintägig (8-h-Satz nur bei Abwesenheit > 480 min),
--   sonst Anreisetag (8 h) / Ganztage (24 h) / Abreisetag (8 h).
--   Über Mitternacht unter 24 h ist ohne Angabe zur Übernachtung nicht eindeutig (mit
--   Übernachtung An- und Abreisetag je 8-h-Satz, ohne höchstens EIN 8-h-Satz bei mehr als
--   8 h) → Soll leer, Prüfhinweis.
--   Inland 28/14 €, Ausland BMF-Satz des Belegs (einreichungen.land).
--   Kürzung: Frühstück 20 %, Mittag 40 %, Abend 40 % vom 24-h-Satz; höchstens bis 0 €.
--   Mahlzeiten werden je Datum aus der gespeicherten Tagesliste übernommen.
--   Bis Release 1b gibt es nur ein Land je Beleg — bei Mehrländerreisen das Soll je Tag
--   von Hand anpassen.
--   Belege ab Release 1b (mindestens ein Reisetag mit reisetage.land_key) sind AUSGESCHLOSSEN:
--   Der Server hat sie bereits je Tag mit dem maßgebenden Land und der Übernachtungsangabe
--   gerechnet; das Soll dieses Skripts (ein Land je Beleg, Übernachtung unbekannt) wiese dort
--   falsche Differenzen aus.
--
-- AUSGABE (eine Ergebnismenge, nach Beleg sortiert)
--   zeile = 'TAG'   : je Kalendertag Ist (gespeichert) / Soll / Differenz
--   zeile = 'BELEG' : Summen je Beleg, Aufteilung der Überzahlung, Prüfhinweise
--   typ_ist / typ_soll : gespeicherter bzw. gesetzlicher Tagtyp (Abweichung = Tagesliste falsch)
--   ungekuerzt = Pauschale OHNE Mahlzeitenkürzung (Tag bzw. Summe je Beleg)
--   differenz  = Ist − Soll  (> 0 = Überzahlung → steuerpflichtig; < 0 = zu wenig erstattet)
--   ueberzahlung          = GREATEST(differenz, 0)
--   pauschalierbar_betrag = LEAST(ueberzahlung, ungekuerzt) → § 40 Abs. 2 S. 1 Nr. 4 EStG (25 %)
--   individuell_betrag    = ueberzahlung − pauschalierbar_betrag → individuell (ggf. § 41c EStG)
--     Grundlage BMF-Schreiben vom 25.11.2020, Rz. 58: pauschalierbar, „soweit“ die Vergütung die
--     Pauschalen OHNE Kürzung für Mahlzeiten (§ 9 Abs. 4a S. 8–10 EStG) um nicht mehr als 100 %
--     übersteigt; Beispiel 51: gekürzte Pauschale 0 €, Erstattung 30 € → 14 € pauschal (100 %
--     der ungekürzten Pauschale), 16 € individuell. Die Entscheidung trifft der Steuerberater.
--   Leere Werte (NULL) = nicht eindeutig berechenbar → Prüfhinweis lesen.
--   Zeitstempel: Die App speichert UTC; der App-Container läuft ohne TZ (= UTC), damit
--   entspricht abfahrt/rueckkehr der eingegebenen Uhrzeit. Kontrolle vor dem Export:
--   `docker exec credo-finanz-app date` muss UTC zeigen.
--
-- PRÜFHINWEISE (Spalte pruefhinweise) — diese Belege einzeln nachrechnen
--   Land nicht in der BMF-Tabelle, Satz in pauschalen_ausland weicht vom BMF ab, keine
--   Reisetage gespeichert, Tagesliste passt nicht zum Reisezeitraum, eintägig am Tag der
--   Zeitumstellung (29.03./25.10.2026), eintägig genau 8:00 h, über Mitternacht unter 24 h,
--   Auslandsreise mit Abfahrt ab 18:00 Uhr (Land um 24 Uhr am Anreisetag: noch im Inland →
--   Inlandssatz 14 €), Reisebeginn vor 2026 (dann gelten die BMF-Sätze 2025).
--
-- AUFRUF (nur lesend; Ergebnis AUSSERHALB des Repos und außerhalb von iCloud/OneDrive)
--   ZIEL="$(mktemp -d)/vma-nachkorrektur-2026.csv"
--   docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' credo-finanz-db \
--     psql -U credo -d finanzportal -v ON_ERROR_STOP=1 --csv \
--     < backend/scripts/vma-nachkorrektur-2026.sql > "$ZIEL" && echo "$ZIEL"
--
-- DATENSCHUTZ
--   Die Ausgabe ist personenbezogen (Name, Personalnummer, Beträge). Nur an den
--   Steuerberater bzw. die Lohnbuchhaltung weitergeben und nur verschlüsselt
--   (z. B. age/gpg oder AES-Archiv, Passwort über einen anderen Kanal). Nicht in
--   synchronisierten Ordnern (iCloud, OneDrive) und nie im Repo ablegen; nach der
--   Übergabe löschen.
-- =============================================================================

WITH bmf (land_key, satz_24h, satz_8h, uebernachtung) AS (
  -- BMF-SAETZE ANFANG (generiert von backend/scripts/bmf-csv-zu-sql.ts — nicht von Hand ändern)
  VALUES
    ('Ägypten',                                50.00,  33.00,  112.00),
    ('Äthiopien',                              44.00,  29.00,  159.00),
    ('Äquatorialguinea',                       42.00,  28.00,  166.00),
    ('Albanien',                               33.00,  22.00,  116.00),
    ('Algerien',                               47.00,  32.00,  120.00),
    ('Andorra',                                45.00,  30.00,  135.00),
    ('Angola',                                 40.00,  27.00,  368.00),
    ('Argentinien',                            42.00,  28.00,  119.00),
    ('Armenien',                               29.00,  20.00,  107.00),
    ('Aserbaidschan',                          44.00,  29.00,   88.00),
    ('Australien — Canberra',                  74.00,  49.00,  186.00),
    ('Australien — Sydney',                    57.00,  38.00,  173.00),
    ('Australien',                             57.00,  38.00,  173.00),
    ('Bahrain',                                48.00,  32.00,  153.00),
    ('Bangladesch',                            46.00,  31.00,  189.00),
    ('Barbados',                               54.00,  36.00,  206.00),
    ('Belgien',                                59.00,  40.00,  141.00),
    ('Benin',                                  40.00,  27.00,  168.00),
    ('Bhutan',                                 27.00,  18.00,  176.00),
    ('Bolivien',                               46.00,  31.00,  108.00),
    ('Bosnien und Herzegowina',                32.00,  21.00,  109.00),
    ('Botsuana',                               40.00,  27.00,  105.00),
    ('Brasilien — Brasilia',                   51.00,  34.00,   88.00),
    ('Brasilien — Rio de Janeiro',             69.00,  46.00,  140.00),
    ('Brasilien — Sao Paulo',                  46.00,  31.00,  151.00),
    ('Brasilien',                              46.00,  31.00,   88.00),
    ('Brunei',                                 45.00,  30.00,  110.00),
    ('Bulgarien',                              38.00,  25.00,  109.00),
    ('Burkina Faso',                           39.00,  26.00,  230.00),
    ('Burundi',                                58.00,  39.00,  102.00),
    ('Chile',                                  44.00,  29.00,  154.00),
    ('China — Hongkong',                       83.00,  56.00,  209.00),
    ('China — Peking',                         57.00,  38.00,  184.00),
    ('China — Shanghai',                       48.00,  32.00,  142.00),
    ('China',                                  48.00,  32.00,  142.00),
    ('Costa Rica',                             60.00,  40.00,  127.00),
    ('Côte d’Ivoire',                          60.00,  40.00,  171.00),
    ('Dänemark',                               75.00,  50.00,  183.00),
    ('Dominikanische Republik',                50.00,  33.00,  167.00),
    ('Dschibuti',                              77.00,  52.00,  255.00),
    ('Ecuador',                                27.00,  18.00,  103.00),
    ('El Salvador',                            65.00,  44.00,  161.00),
    ('Eritrea',                                46.00,  31.00,   78.00),
    ('Estland',                                39.00,  26.00,  125.00),
    ('Fidschi',                                32.00,  21.00,  183.00),
    ('Finnland',                               54.00,  36.00,  171.00),
    ('Frankreich — Paris',                     58.00,  39.00,  159.00),
    ('Frankreich',                             53.00,  36.00,  105.00),
    ('Gabun',                                  64.00,  43.00,  263.00),
    ('Gambia',                                 40.00,  27.00,  161.00),
    ('Georgien',                               45.00,  30.00,   87.00),
    ('Ghana',                                  46.00,  31.00,  203.00),
    ('Griechenland — Athen',                   40.00,  27.00,  139.00),
    ('Griechenland',                           36.00,  24.00,  150.00),
    ('Guatemala',                              46.00,  31.00,  124.00),
    ('Guinea',                                 59.00,  40.00,  140.00),
    ('Guinea-Bissau',                          32.00,  21.00,  113.00),
    ('Honduras',                               57.00,  38.00,  198.00),
    ('Indien — Bangalore',                     42.00,  28.00,  155.00),
    ('Indien — Chennai',                       22.00,  15.00,   80.00),
    ('Indien — Kalkutta',                      32.00,  21.00,  167.00),
    ('Indien — Mumbai',                        53.00,  36.00,  218.00),
    ('Indien — Neu Delhi',                     46.00,  31.00,  211.00),
    ('Indien',                                 22.00,  15.00,   80.00),
    ('Indonesien',                             45.00,  30.00,  179.00),
    ('Iran',                                   33.00,  22.00,  196.00),
    ('Irland',                                 64.00,  43.00,  164.00),
    ('Island',                                 62.00,  41.00,  187.00),
    ('Israel',                                 59.00,  40.00,  268.00),
    ('Italien — Mailand',                      42.00,  28.00,  191.00),
    ('Italien — Rom',                          48.00,  32.00,  150.00),
    ('Italien',                                42.00,  28.00,  150.00),
    ('Jamaika',                                39.00,  26.00,  171.00),
    ('Japan — Tokio',                          50.00,  33.00,  285.00),
    ('Japan — Osaka',                          33.00,  22.00,  141.00),
    ('Japan',                                  33.00,  22.00,  141.00),
    ('Jordanien',                              57.00,  38.00,  134.00),
    ('Kambodscha',                             42.00,  28.00,  108.00),
    ('Kamerun',                                56.00,  37.00,  275.00),
    ('Kanada — Ottawa',                        62.00,  41.00,  214.00),
    ('Kanada — Toronto',                       54.00,  36.00,  392.00),
    ('Kanada — Vancouver',                     63.00,  42.00,  304.00),
    ('Kanada',                                 54.00,  36.00,  214.00),
    ('Kap Verde',                              38.00,  25.00,   90.00),
    ('Kasachstan',                             33.00,  22.00,  108.00),
    ('Katar',                                  81.00,  54.00,  128.00),
    ('Kenia',                                  48.00,  32.00,  217.00),
    ('Kirgisistan',                            35.00,  24.00,   80.00),
    ('Kolumbien',                              34.00,  23.00,  123.00),
    ('Kongo, Republik',                        53.00,  36.00,  215.00),
    ('Kongo, Demokratische Republik',          65.00,  44.00,  337.00),
    ('Korea, Republik',                        39.00,  26.00,  130.00),
    ('Kosovo',                                 24.00,  16.00,   71.00),
    ('Kroatien',                               46.00,  31.00,  191.00),
    ('Kuba',                                   51.00,  34.00,  170.00),
    ('Kuwait',                                 63.00,  42.00,  224.00),
    ('Laos',                                   35.00,  24.00,   71.00),
    ('Lesotho',                                28.00,  19.00,  104.00),
    ('Lettland',                               46.00,  31.00,  119.00),
    ('Libanon',                                69.00,  46.00,  146.00),
    ('Liberia',                                65.00,  44.00,  173.00),
    ('Liechtenstein',                          57.00,  38.00,  234.00),
    ('Litauen',                                48.00,  32.00,  124.00),
    ('Luxemburg',                              63.00,  42.00,  139.00),
    ('Madagaskar',                             33.00,  22.00,  116.00),
    ('Malawi',                                 41.00,  28.00,  109.00),
    ('Malaysia',                               36.00,  24.00,   86.00),
    ('Malediven',                              70.00,  47.00,  200.00),
    ('Mali',                                   42.00,  28.00,  141.00),
    ('Malta',                                  59.00,  40.00,  191.00),
    ('Marokko',                                41.00,  28.00,   87.00),
    ('Marshall Inseln',                        45.00,  30.00,  112.00),
    ('Mauretanien',                            35.00,  24.00,   86.00),
    ('Mauritius',                              44.00,  29.00,  172.00),
    ('Mexiko',                                 40.00,  27.00,  337.00),
    ('Moldau, Republik',                       26.00,  17.00,   73.00),
    ('Monaco',                                 52.00,  35.00,  187.00),
    ('Mongolei',                               23.00,  16.00,   92.00),
    ('Montenegro',                             32.00,  21.00,   85.00),
    ('Mosambik',                               51.00,  34.00,  208.00),
    ('Myanmar',                                23.00,  16.00,  103.00),
    ('Namibia',                                28.00,  19.00,  146.00),
    ('Nepal',                                  33.00,  22.00,  125.00),
    ('Neuseeland',                             58.00,  39.00,  148.00),
    ('Nicaragua',                              46.00,  31.00,  105.00),
    ('Niederlande',                            58.00,  39.00,  167.00),
    ('Niger',                                  42.00,  28.00,  131.00),
    ('Nigeria',                                52.00,  35.00,  202.00),
    ('Nordmazedonien',                         27.00,  18.00,   89.00),
    ('Norwegen',                               75.00,  50.00,  139.00),
    ('Österreich',                             50.00,  33.00,  117.00),
    ('Oman',                                   64.00,  43.00,  141.00),
    ('Pakistan',                               41.00,  28.00,  199.00),
    ('Palau',                                  51.00,  34.00,  193.00),
    ('Panama',                                 41.00,  28.00,   82.00),
    ('Papua-Neuguinea',                        59.00,  40.00,  159.00),
    ('Paraguay',                               39.00,  26.00,  124.00),
    ('Peru',                                   52.00,  35.00,  128.00),
    ('Philippinen',                            41.00,  28.00,  140.00),
    ('Polen — Breslau',                        34.00,  23.00,  124.00),
    ('Polen — Warschau',                       40.00,  27.00,  143.00),
    ('Polen',                                  34.00,  23.00,  124.00),
    ('Portugal',                               32.00,  21.00,  111.00),
    ('Ruanda',                                 44.00,  29.00,  117.00),
    ('Rumänien',                               38.00,  25.00,  103.00),
    ('Russische Föderation — Moskau',          30.00,  20.00,  235.00),
    ('Russische Föderation — St. Petersburg',  28.00,  19.00,  133.00),
    ('Russische Föderation',                   28.00,  19.00,  133.00),
    ('Sambia',                                 38.00,  25.00,  105.00),
    ('Samoa',                                  39.00,  26.00,  105.00),
    ('San Marino',                             34.00,  23.00,   79.00),
    ('São Tomé – Príncipe',                    36.00,  24.00,  147.00),
    ('Saudi-Arabien — Djidda',                 57.00,  38.00,  181.00),
    ('Saudi-Arabien — Riad',                   56.00,  37.00,  186.00),
    ('Saudi-Arabien',                          56.00,  37.00,  181.00),
    ('Schweden',                               66.00,  44.00,  140.00),
    ('Schweiz — Bern',                         82.00,  55.00,  195.00),
    ('Schweiz — Genf',                         70.00,  47.00,  197.00),
    ('Schweiz',                                70.00,  47.00,  195.00),
    ('Senegal',                                48.00,  32.00,  160.00),
    ('Serbien',                                27.00,  18.00,   97.00),
    ('Sierra Leone',                           57.00,  38.00,  145.00),
    ('Simbabwe',                               63.00,  42.00,  198.00),
    ('Singapur',                               71.00,  48.00,  277.00),
    ('Slowakische Republik',                   33.00,  22.00,  121.00),
    ('Slowenien',                              38.00,  25.00,  126.00),
    ('Spanien — Barcelona',                    34.00,  23.00,  144.00),
    ('Spanien — Kanarische Inseln',            36.00,  24.00,  103.00),
    ('Spanien — Madrid',                       42.00,  28.00,  131.00),
    ('Spanien — Palma de Mallorca',            44.00,  29.00,  142.00),
    ('Spanien',                                34.00,  23.00,  103.00),
    ('Sri Lanka',                              36.00,  24.00,  112.00),
    ('Südafrika — Kapstadt',                   33.00,  22.00,  130.00),
    ('Südafrika — Johannesburg',               36.00,  24.00,  129.00),
    ('Südafrika',                              29.00,  20.00,  109.00),
    ('Südsudan',                               51.00,  34.00,  159.00),
    ('Tadschikistan',                          27.00,  18.00,   85.00),
    ('Taiwan',                                 51.00,  34.00,  174.00),
    ('Tansania',                               44.00,  29.00,   97.00),
    ('Thailand',                               36.00,  24.00,  114.00),
    ('Togo',                                   36.00,  24.00,  144.00),
    ('Tonga',                                  29.00,  20.00,  102.00),
    ('Trinidad und Tobago',                    66.00,  44.00,  203.00),
    ('Tschad',                                 42.00,  28.00,  155.00),
    ('Tschechien',                             32.00,  21.00,   77.00),
    ('Türkei — Ankara',                        32.00,  21.00,  110.00),
    ('Türkei — Izmir',                         44.00,  29.00,  120.00),
    ('Türkei',                                 24.00,  16.00,  107.00),
    ('Tunesien',                               40.00,  27.00,  144.00),
    ('Turkmenistan',                           28.00,  19.00,  135.00),
    ('Uganda',                                 45.00,  30.00,  207.00),
    ('Ukraine',                                33.00,  22.00,  180.00),
    ('Ungarn',                                 32.00,  21.00,   85.00),
    ('Uruguay',                                40.00,  27.00,  113.00),
    ('Usbekistan',                             32.00,  21.00,  133.00),
    ('Vatikanstaat',                           48.00,  32.00,  150.00),
    ('Venezuela',                              51.00,  34.00,  178.00),
    ('Vereinigte Arabische Emirate',           81.00,  54.00,  169.00),
    ('USA — Atlanta',                          77.00,  52.00,  182.00),
    ('USA — Boston',                           63.00,  42.00,  333.00),
    ('USA — Chicago',                          65.00,  44.00,  233.00),
    ('USA — Houston',                          62.00,  41.00,  204.00),
    ('USA — Los Angeles',                      64.00,  43.00,  262.00),
    ('USA — Miami',                            65.00,  44.00,  256.00),
    ('USA — New York City',                    66.00,  44.00,  308.00),
    ('USA — San Francisco',                    59.00,  40.00,  327.00),
    ('USA — Washington, D. C.',                66.00,  44.00,  203.00),
    ('USA',                                    59.00,  40.00,  182.00),
    ('Großbritannien — London',                66.00,  44.00,  163.00),
    ('Großbritannien',                         52.00,  35.00,   99.00),
    ('Vietnam',                                36.00,  24.00,  111.00),
    ('Weißrussland',                           21.00,  14.00,  148.00),
    ('Zentralafrikanische Republik',           53.00,  36.00,  210.00),
    ('Zypern',                                 42.00,  28.00,  125.00),
    ('Mikronesien',                            41.00,  28.00,  140.00),
    ('Antigua und Barbuda',                    66.00,  44.00,  203.00),
    ('Dominica',                               66.00,  44.00,  203.00),
    ('Grenada',                                66.00,  44.00,  203.00),
    ('Guyana',                                 66.00,  44.00,  203.00),
    ('St. Kitts und Nevis',                    66.00,  44.00,  203.00),
    ('St. Lucia',                              66.00,  44.00,  203.00),
    ('St. Vincent und Grenadinen',             66.00,  44.00,  203.00),
    ('Suriname',                               66.00,  44.00,  203.00)
  -- BMF-SAETZE ENDE
),
rk AS (
  SELECT
    e.id,
    e.beleg_nr,
    m.mandant_nr,
    m.name                                                     AS mandant,
    e.mitarbeiter_personal_nr                                  AS personal_nr,
    e.mitarbeiter_nachname                                     AS nachname,
    e.mitarbeiter_vorname                                      AS vorname,
    e.abfahrt_zeit,
    e.rueckkehr_zeit,
    e.land IS NOT NULL                                         AS ausland,
    COALESCE(e.land, 'Inland')                                 AS land,
    COALESCE(e.vma_netto, 0)                                   AS ist_beleg,
    EXTRACT(EPOCH FROM (e.rueckkehr_zeit - e.abfahrt_zeit)) / 60 AS dauer_min,
    -- Über Mitternacht unter 24 h: ohne Angabe zur Übernachtung kein eindeutiges Soll
    e.rueckkehr_zeit::date > e.abfahrt_zeit::date
      AND e.rueckkehr_zeit - e.abfahrt_zeit < INTERVAL '24 hours' AS soll_unklar,
    -- Inland gesetzlich 28/14 €; Ausland BMF-Satz 2026 (NULL = Land nicht in der BMF-Tabelle)
    CASE WHEN e.land IS NULL THEN 28.00 ELSE bmf.satz_24h END   AS satz_24h,
    CASE WHEN e.land IS NULL THEN 14.00 ELSE bmf.satz_8h  END   AS satz_8h,
    bmf.land_key IS NOT NULL AND (pa.tagessatz_24h, pa.tagessatz_8h)
      IS DISTINCT FROM (bmf.satz_24h, bmf.satz_8h)             AS db_satz_abweichend
  FROM einreichungen e
  JOIN mandanten m ON m.id = e.mandant_id
  LEFT JOIN bmf ON bmf.land_key = e.land
  LEFT JOIN pauschalen_ausland pa ON pa.land_key = e.land
  WHERE e.typ = 'REISEKOSTEN'
    AND (e.created_at >= DATE '2026-01-01' OR e.abfahrt_zeit >= DATE '2026-01-01')
    -- ab Release 1b je Tag korrekt gerechnet (land_key ist dann an jedem Tag gesetzt, auch INLAND);
    -- über to_jsonb, damit das Skript auch vor Migration 0015 (ohne Spalte land_key) läuft
    AND NOT EXISTS (SELECT 1 FROM reisetage r1b WHERE r1b.einreichung_id = e.id AND to_jsonb(r1b) ->> 'land_key' IS NOT NULL)
),
-- Gespeicherte Tage je Kalenderdatum (doppelte Daten zusammengefasst)
ist_tag AS (
  SELECT
    r.einreichung_id                                           AS id,
    r.datum::date                                              AS datum,
    string_agg(r.typ::text, '+' ORDER BY r.typ::text)          AS typ_ist,
    BOOL_OR(r.fruehstueck_gestellt)                            AS f,
    BOOL_OR(r.mittag_gestellt)                                 AS mi,
    BOOL_OR(r.abend_gestellt)                                  AS a,
    SUM(r.vma_netto)                                           AS ist
  FROM reisetage r
  JOIN rk ON rk.id = r.einreichung_id
  GROUP BY r.einreichung_id, r.datum::date
),
-- Gesetzliche Tage aus Abfahrt/Rückkehr (Kalenderdaten, keine Zeitzonenrechnung)
soll_tag AS (
  SELECT
    rk.id,
    d::date                                                    AS datum,
    CASE WHEN rk.abfahrt_zeit::date = rk.rueckkehr_zeit::date THEN 'EINTAEGIG'
         WHEN d::date = rk.abfahrt_zeit::date                 THEN 'ANREISE'
         WHEN d::date = rk.rueckkehr_zeit::date               THEN 'ABREISE'
         ELSE 'GANZTAG' END                                    AS typ_soll
  FROM rk
  CROSS JOIN LATERAL generate_series(rk.abfahrt_zeit::date, rk.rueckkehr_zeit::date, INTERVAL '1 day') AS d
  WHERE rk.rueckkehr_zeit > rk.abfahrt_zeit
),
tag AS (
  SELECT
    COALESCE(s.id, i.id)                                       AS id,
    COALESCE(s.datum, i.datum)                                 AS datum,
    i.typ_ist,
    s.typ_soll,
    concat_ws('+',
      CASE WHEN i.f  THEN 'F' END,
      CASE WHEN i.mi THEN 'M' END,
      CASE WHEN i.a  THEN 'A' END)                             AS mahlzeiten,
    COALESCE(i.ist, 0.00)                                      AS ist,
    -- ungekürzte Pauschale; NULL = nicht eindeutig (Land unbekannt, Übernachtung offen)
    CASE WHEN rk.soll_unklar OR rk.satz_24h IS NULL THEN NULL
         WHEN s.typ_soll IS NULL      THEN 0.00               -- gespeicherter Tag außerhalb des Zeitraums
         WHEN s.typ_soll = 'GANZTAG'  THEN rk.satz_24h
         WHEN s.typ_soll = 'EINTAEGIG' THEN CASE WHEN rk.dauer_min > 480 THEN rk.satz_8h ELSE 0.00 END
         ELSE rk.satz_8h END                                   AS ungekuerzt,
    ROUND(rk.satz_24h * (
        CASE WHEN i.f  THEN 0.20 ELSE 0 END
      + CASE WHEN i.mi THEN 0.40 ELSE 0 END
      + CASE WHEN i.a  THEN 0.40 ELSE 0 END), 2)              AS kuerzung
  FROM soll_tag s
  FULL OUTER JOIN ist_tag i ON i.id = s.id AND i.datum = s.datum
  JOIN rk ON rk.id = COALESCE(s.id, i.id)
),
tag_soll AS (
  SELECT
    tag.*,
    -- GREATEST/LEAST übergehen NULL — daher NULL (nicht eindeutig) ausdrücklich durchreichen
    CASE WHEN ungekuerzt IS NOT NULL THEN GREATEST(0.00, ungekuerzt - kuerzung) END AS soll
  FROM tag
),
beleg AS (
  SELECT
    rk.*,
    COUNT(t.typ_ist)                                           AS anzahl_ist_tage,
    BOOL_OR(t.typ_ist IS DISTINCT FROM t.typ_soll)             AS tagesliste_falsch,
    CASE WHEN rk.soll_unklar OR rk.satz_24h IS NULL THEN NULL
         ELSE COALESCE(SUM(t.soll), 0.00) END                 AS soll_beleg,
    CASE WHEN rk.soll_unklar OR rk.satz_24h IS NULL THEN NULL
         ELSE COALESCE(SUM(t.ungekuerzt), 0.00) END           AS ungekuerzt_beleg
  FROM rk
  LEFT JOIN tag_soll t ON t.id = rk.id
  GROUP BY rk.id, rk.beleg_nr, rk.mandant_nr, rk.mandant, rk.personal_nr, rk.nachname, rk.vorname,
           rk.abfahrt_zeit, rk.rueckkehr_zeit, rk.ausland, rk.land, rk.ist_beleg, rk.dauer_min,
           rk.soll_unklar, rk.satz_24h, rk.satz_8h, rk.db_satz_abweichend
),
beleg_hinweise AS (
  SELECT
    b.*,
    b.ist_beleg - b.soll_beleg                                 AS differenz,
    CASE WHEN b.soll_beleg IS NOT NULL
         THEN GREATEST(b.ist_beleg - b.soll_beleg, 0.00) END  AS ueberzahlung,
    NULLIF(concat_ws('; ',
      CASE WHEN b.ausland AND b.satz_24h IS NULL
           THEN 'Land nicht in der BMF-Tabelle 2026: Satz von Hand bestimmen' END,
      CASE WHEN b.db_satz_abweichend
           THEN 'Satz in pauschalen_ausland weicht vom BMF ab (Soll mit BMF-Satz gerechnet)' END,
      CASE WHEN b.anzahl_ist_tage = 0
           THEN 'keine Reisetage gespeichert' END,
      CASE WHEN b.anzahl_ist_tage > 0 AND b.tagesliste_falsch
           THEN 'Tagesliste passt nicht zum Reisezeitraum (Soll aus Abfahrt/Rückkehr)' END,
      CASE WHEN b.abfahrt_zeit::date = b.rueckkehr_zeit::date
            AND b.abfahrt_zeit::date IN (DATE '2026-03-29', DATE '2026-10-25')
           THEN 'eintägig am Tag der Zeitumstellung: tatsächliche Dauer prüfen (± 1 h)' END,
      CASE WHEN b.dauer_min = 480
           THEN 'eintägig genau 8:00 h' END,
      CASE WHEN b.soll_unklar
           THEN 'über Mitternacht unter 24 h: Übernachtung prüfen (mit: An- und Abreisetag je 8-h-Satz; '
             || 'ohne: höchstens ein 8-h-Satz bei mehr als 8 h)' END,
      CASE WHEN b.ausland AND b.rueckkehr_zeit::date > b.abfahrt_zeit::date
            AND b.abfahrt_zeit::time >= TIME '18:00'
           THEN 'Abfahrt ab 18:00 Uhr: Land um 24 Uhr am Anreisetag prüfen (noch im Inland → 14 €)' END,
      CASE WHEN b.abfahrt_zeit::date < DATE '2026-01-01'
           THEN 'Reisetage vor 2026: BMF-Sätze 2025 anwenden' END
    ), '')                                                     AS pruefhinweise
  FROM beleg b
)
SELECT
  zeile, beleg_nr, mandant_nr, mandant, personal_nr, nachname, vorname,
  abfahrt, rueckkehr, dauer_min, land, datum, typ_ist, typ_soll, mahlzeiten,
  satz_24h, satz_8h, ist, ungekuerzt, soll, differenz,
  ueberzahlung, pauschalierbar_betrag, individuell_betrag, pruefhinweise
FROM (
  SELECT
    'TAG'                       AS zeile,
    1                           AS sortierung,
    b.beleg_nr, b.mandant_nr, b.mandant, b.personal_nr, b.nachname, b.vorname,
    b.abfahrt_zeit              AS abfahrt,
    b.rueckkehr_zeit            AS rueckkehr,
    ROUND(b.dauer_min)          AS dauer_min,
    b.land,
    t.datum,
    t.typ_ist,
    t.typ_soll,
    t.mahlzeiten,
    b.satz_24h, b.satz_8h,
    t.ist,
    t.ungekuerzt,
    t.soll,
    t.ist - t.soll              AS differenz,
    NULL::numeric               AS ueberzahlung,
    NULL::numeric               AS pauschalierbar_betrag,
    NULL::numeric               AS individuell_betrag,
    NULL::text                  AS pruefhinweise
  FROM tag_soll t
  JOIN beleg_hinweise b ON b.id = t.id

  UNION ALL

  SELECT
    'BELEG',
    2,
    b.beleg_nr, b.mandant_nr, b.mandant, b.personal_nr, b.nachname, b.vorname,
    b.abfahrt_zeit,
    b.rueckkehr_zeit,
    ROUND(b.dauer_min),
    b.land,
    NULL::date,
    NULL::text,
    NULL::text,
    NULL::text,
    b.satz_24h, b.satz_8h,
    b.ist_beleg,
    b.ungekuerzt_beleg,
    b.soll_beleg,
    b.differenz,
    b.ueberzahlung,
    CASE WHEN b.ueberzahlung IS NOT NULL THEN LEAST(b.ueberzahlung, b.ungekuerzt_beleg) END,
    CASE WHEN b.ueberzahlung IS NOT NULL THEN b.ueberzahlung - LEAST(b.ueberzahlung, b.ungekuerzt_beleg) END,
    b.pruefhinweise
  FROM beleg_hinweise b
) x
ORDER BY beleg_nr, sortierung, datum;
