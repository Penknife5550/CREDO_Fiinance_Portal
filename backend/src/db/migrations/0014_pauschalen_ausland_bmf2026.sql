-- Auslandspauschalen 2026 vollständig nach BMF-Schreiben vom 05.12.2025: 214 Zeilen der
-- Anlage plus 9 Verweisstaaten aus dem Text des Schreibens (Satz des Bezugsstaates, siehe
-- backend/src/db/data/bmf-auslandspauschalen-2026-verweise.csv).
-- GENERIERT von backend/scripts/bmf-csv-zu-sql.ts aus backend/src/db/data/bmf-auslandspauschalen-2026*.csv
-- (nicht von Hand ändern: CSV anpassen und Generator erneut ausführen).
--
-- a) Die 19 Bestandszeilen aus 0008 werden nur korrigiert, solange noch der alte Seed-Wert
--    steht (Verpflegungspaar und Übernachtung getrennt). Im AdminCenter gepflegte Werte bleiben
--    unberührt; Abweichungen zur CSV zeigt backend/scripts/pruefe-auslandspauschalen.sql.
--    Unverändert (Seed = BMF): Belgien.
-- b) Fehlende Zeilen werden angelegt (ON CONFLICT DO NOTHING) — auch Bestandszeilen, die im
--    AdminCenter gelöscht wurden (z. B. Luxemburg, der gesetzliche Ersatzsatz).
--
-- Key-Konvention: Staat = Name (Satz „im Übrigen“), Stadt = 'Staat — Stadt'. Bestands-Keys, die
-- vom BMF-Namen abweichen: 'USA' = Vereinigte Staaten von Amerika (USA), 'Großbritannien' =
-- Vereinigtes Königreich von Großbritannien und Nordirland, 'Tschechien' = Tschechische Republik,
-- 'Frankreich — Paris' = Paris sowie die Departments 77, 78, 91 bis 95.
-- Idempotent: ein zweiter Lauf ändert nichts.

-- a) Bestandszeilen
-- Dänemark: Übernachtung 152.00 → 183.00
UPDATE pauschalen_ausland SET uebernachtung = 183.00, updated_at = NOW()
WHERE land_key = 'Dänemark' AND uebernachtung = 152.00;
--> statement-breakpoint
-- Frankreich: Übernachtung 148.00 → 105.00
UPDATE pauschalen_ausland SET uebernachtung = 105.00, updated_at = NOW()
WHERE land_key = 'Frankreich' AND uebernachtung = 148.00;
--> statement-breakpoint
-- Frankreich — Paris: Übernachtung 158.00 → 159.00
UPDATE pauschalen_ausland SET uebernachtung = 159.00, updated_at = NOW()
WHERE land_key = 'Frankreich — Paris' AND uebernachtung = 158.00;
--> statement-breakpoint
-- Großbritannien: Übernachtung 150.00 → 99.00
UPDATE pauschalen_ausland SET uebernachtung = 99.00, updated_at = NOW()
WHERE land_key = 'Großbritannien' AND uebernachtung = 150.00;
--> statement-breakpoint
-- Großbritannien — London: Übernachtung 220.00 → 163.00
UPDATE pauschalen_ausland SET uebernachtung = 163.00, updated_at = NOW()
WHERE land_key = 'Großbritannien — London' AND uebernachtung = 220.00;
--> statement-breakpoint
-- Italien: Übernachtung 138.00 → 150.00
UPDATE pauschalen_ausland SET uebernachtung = 150.00, updated_at = NOW()
WHERE land_key = 'Italien' AND uebernachtung = 138.00;
--> statement-breakpoint
-- Italien — Rom: Übernachtung 160.00 → 150.00
UPDATE pauschalen_ausland SET uebernachtung = 150.00, updated_at = NOW()
WHERE land_key = 'Italien — Rom' AND uebernachtung = 160.00;
--> statement-breakpoint
-- Luxemburg: Übernachtung 130.00 → 139.00
UPDATE pauschalen_ausland SET uebernachtung = 139.00, updated_at = NOW()
WHERE land_key = 'Luxemburg' AND uebernachtung = 130.00;
--> statement-breakpoint
-- Niederlande: Übernachtung 125.00 → 167.00
UPDATE pauschalen_ausland SET uebernachtung = 167.00, updated_at = NOW()
WHERE land_key = 'Niederlande' AND uebernachtung = 125.00;
--> statement-breakpoint
-- Österreich: Übernachtung 108.00 → 117.00
UPDATE pauschalen_ausland SET uebernachtung = 117.00, updated_at = NOW()
WHERE land_key = 'Österreich' AND uebernachtung = 108.00;
--> statement-breakpoint
-- Polen: Verpflegung 30.00/20.00 → 34.00/23.00
UPDATE pauschalen_ausland SET tagessatz_24h = 34.00, tagessatz_8h = 23.00, updated_at = NOW()
WHERE land_key = 'Polen' AND tagessatz_24h = 30.00 AND tagessatz_8h = 20.00;
--> statement-breakpoint
-- Polen: Übernachtung 73.00 → 124.00
UPDATE pauschalen_ausland SET uebernachtung = 124.00, updated_at = NOW()
WHERE land_key = 'Polen' AND uebernachtung = 73.00;
--> statement-breakpoint
-- Schweiz: Verpflegung 68.00/46.00 → 70.00/47.00
UPDATE pauschalen_ausland SET tagessatz_24h = 70.00, tagessatz_8h = 47.00, updated_at = NOW()
WHERE land_key = 'Schweiz' AND tagessatz_24h = 68.00 AND tagessatz_8h = 46.00;
--> statement-breakpoint
-- Schweiz: Übernachtung 180.00 → 195.00
UPDATE pauschalen_ausland SET uebernachtung = 195.00, updated_at = NOW()
WHERE land_key = 'Schweiz' AND uebernachtung = 180.00;
--> statement-breakpoint
-- Schweiz — Genf: Übernachtung 200.00 → 197.00
UPDATE pauschalen_ausland SET uebernachtung = 197.00, updated_at = NOW()
WHERE land_key = 'Schweiz — Genf' AND uebernachtung = 200.00;
--> statement-breakpoint
-- Spanien: Verpflegung 42.00/28.00 → 34.00/23.00
UPDATE pauschalen_ausland SET tagessatz_24h = 34.00, tagessatz_8h = 23.00, updated_at = NOW()
WHERE land_key = 'Spanien' AND tagessatz_24h = 42.00 AND tagessatz_8h = 28.00;
--> statement-breakpoint
-- Spanien: Übernachtung 115.00 → 103.00
UPDATE pauschalen_ausland SET uebernachtung = 103.00, updated_at = NOW()
WHERE land_key = 'Spanien' AND uebernachtung = 115.00;
--> statement-breakpoint
-- Spanien — Barcelona: Übernachtung 130.00 → 144.00
UPDATE pauschalen_ausland SET uebernachtung = 144.00, updated_at = NOW()
WHERE land_key = 'Spanien — Barcelona' AND uebernachtung = 130.00;
--> statement-breakpoint
-- Spanien — Madrid: Übernachtung 140.00 → 131.00
UPDATE pauschalen_ausland SET uebernachtung = 131.00, updated_at = NOW()
WHERE land_key = 'Spanien — Madrid' AND uebernachtung = 140.00;
--> statement-breakpoint
-- Tschechien: Übernachtung 83.00 → 77.00
UPDATE pauschalen_ausland SET uebernachtung = 77.00, updated_at = NOW()
WHERE land_key = 'Tschechien' AND uebernachtung = 83.00;
--> statement-breakpoint
-- USA: Verpflegung 51.00/34.00 → 59.00/40.00
UPDATE pauschalen_ausland SET tagessatz_24h = 59.00, tagessatz_8h = 40.00, updated_at = NOW()
WHERE land_key = 'USA' AND tagessatz_24h = 51.00 AND tagessatz_8h = 34.00;
--> statement-breakpoint
-- USA: Übernachtung 190.00 → 182.00
UPDATE pauschalen_ausland SET uebernachtung = 182.00, updated_at = NOW()
WHERE land_key = 'USA' AND uebernachtung = 190.00;
--> statement-breakpoint
-- b) Fehlende Zeilen anlegen: 19 Bestandszeilen (falls gelöscht; Sortierung aus 0008) und
--    204 weitere BMF-Zeilen (reihenfolge ab 1000, alphabetisch)
INSERT INTO pauschalen_ausland (land_key, tagessatz_24h, tagessatz_8h, uebernachtung, reihenfolge) VALUES
  ('Belgien',                                59.00,  40.00,  141.00,    10),
  ('Dänemark',                               75.00,  50.00,  183.00,    20),
  ('Frankreich',                             53.00,  36.00,  105.00,    30),
  ('Frankreich — Paris',                     58.00,  39.00,  159.00,    31),
  ('Großbritannien',                         52.00,  35.00,   99.00,    40),
  ('Großbritannien — London',                66.00,  44.00,  163.00,    41),
  ('Italien',                                42.00,  28.00,  150.00,    50),
  ('Italien — Rom',                          48.00,  32.00,  150.00,    51),
  ('Luxemburg',                              63.00,  42.00,  139.00,    60),
  ('Niederlande',                            58.00,  39.00,  167.00,    70),
  ('Österreich',                             50.00,  33.00,  117.00,    80),
  ('Polen',                                  34.00,  23.00,  124.00,    90),
  ('Schweiz',                                70.00,  47.00,  195.00,   100),
  ('Schweiz — Genf',                         70.00,  47.00,  197.00,   101),
  ('Spanien',                                34.00,  23.00,  103.00,   110),
  ('Spanien — Barcelona',                    34.00,  23.00,  144.00,   111),
  ('Spanien — Madrid',                       42.00,  28.00,  131.00,   112),
  ('Tschechien',                             32.00,  21.00,   77.00,   120),
  ('USA',                                    59.00,  40.00,  182.00,   130),
  ('Ägypten',                                50.00,  33.00,  112.00,  1000),
  ('Albanien',                               33.00,  22.00,  116.00,  1001),
  ('Algerien',                               47.00,  32.00,  120.00,  1002),
  ('Andorra',                                45.00,  30.00,  135.00,  1003),
  ('Angola',                                 40.00,  27.00,  368.00,  1004),
  ('Antigua und Barbuda',                    66.00,  44.00,  203.00,  1005),
  ('Äquatorialguinea',                       42.00,  28.00,  166.00,  1006),
  ('Argentinien',                            42.00,  28.00,  119.00,  1007),
  ('Armenien',                               29.00,  20.00,  107.00,  1008),
  ('Aserbaidschan',                          44.00,  29.00,   88.00,  1009),
  ('Äthiopien',                              44.00,  29.00,  159.00,  1010),
  ('Australien',                             57.00,  38.00,  173.00,  1011),
  ('Australien — Canberra',                  74.00,  49.00,  186.00,  1012),
  ('Australien — Sydney',                    57.00,  38.00,  173.00,  1013),
  ('Bahrain',                                48.00,  32.00,  153.00,  1014),
  ('Bangladesch',                            46.00,  31.00,  189.00,  1015),
  ('Barbados',                               54.00,  36.00,  206.00,  1016),
  ('Benin',                                  40.00,  27.00,  168.00,  1017),
  ('Bhutan',                                 27.00,  18.00,  176.00,  1018),
  ('Bolivien',                               46.00,  31.00,  108.00,  1019),
  ('Bosnien und Herzegowina',                32.00,  21.00,  109.00,  1020),
  ('Botsuana',                               40.00,  27.00,  105.00,  1021),
  ('Brasilien',                              46.00,  31.00,   88.00,  1022),
  ('Brasilien — Brasilia',                   51.00,  34.00,   88.00,  1023),
  ('Brasilien — Rio de Janeiro',             69.00,  46.00,  140.00,  1024),
  ('Brasilien — Sao Paulo',                  46.00,  31.00,  151.00,  1025),
  ('Brunei',                                 45.00,  30.00,  110.00,  1026),
  ('Bulgarien',                              38.00,  25.00,  109.00,  1027),
  ('Burkina Faso',                           39.00,  26.00,  230.00,  1028),
  ('Burundi',                                58.00,  39.00,  102.00,  1029),
  ('Chile',                                  44.00,  29.00,  154.00,  1030),
  ('China',                                  48.00,  32.00,  142.00,  1031),
  ('China — Hongkong',                       83.00,  56.00,  209.00,  1032),
  ('China — Peking',                         57.00,  38.00,  184.00,  1033),
  ('China — Shanghai',                       48.00,  32.00,  142.00,  1034),
  ('Costa Rica',                             60.00,  40.00,  127.00,  1035),
  ('Côte d’Ivoire',                          60.00,  40.00,  171.00,  1036),
  ('Dominica',                               66.00,  44.00,  203.00,  1037),
  ('Dominikanische Republik',                50.00,  33.00,  167.00,  1038),
  ('Dschibuti',                              77.00,  52.00,  255.00,  1039),
  ('Ecuador',                                27.00,  18.00,  103.00,  1040),
  ('El Salvador',                            65.00,  44.00,  161.00,  1041),
  ('Eritrea',                                46.00,  31.00,   78.00,  1042),
  ('Estland',                                39.00,  26.00,  125.00,  1043),
  ('Fidschi',                                32.00,  21.00,  183.00,  1044),
  ('Finnland',                               54.00,  36.00,  171.00,  1045),
  ('Gabun',                                  64.00,  43.00,  263.00,  1046),
  ('Gambia',                                 40.00,  27.00,  161.00,  1047),
  ('Georgien',                               45.00,  30.00,   87.00,  1048),
  ('Ghana',                                  46.00,  31.00,  203.00,  1049),
  ('Grenada',                                66.00,  44.00,  203.00,  1050),
  ('Griechenland',                           36.00,  24.00,  150.00,  1051),
  ('Griechenland — Athen',                   40.00,  27.00,  139.00,  1052),
  ('Guatemala',                              46.00,  31.00,  124.00,  1053),
  ('Guinea',                                 59.00,  40.00,  140.00,  1054),
  ('Guinea-Bissau',                          32.00,  21.00,  113.00,  1055),
  ('Guyana',                                 66.00,  44.00,  203.00,  1056),
  ('Honduras',                               57.00,  38.00,  198.00,  1057),
  ('Indien',                                 22.00,  15.00,   80.00,  1058),
  ('Indien — Bangalore',                     42.00,  28.00,  155.00,  1059),
  ('Indien — Chennai',                       22.00,  15.00,   80.00,  1060),
  ('Indien — Kalkutta',                      32.00,  21.00,  167.00,  1061),
  ('Indien — Mumbai',                        53.00,  36.00,  218.00,  1062),
  ('Indien — Neu Delhi',                     46.00,  31.00,  211.00,  1063),
  ('Indonesien',                             45.00,  30.00,  179.00,  1064),
  ('Iran',                                   33.00,  22.00,  196.00,  1065),
  ('Irland',                                 64.00,  43.00,  164.00,  1066),
  ('Island',                                 62.00,  41.00,  187.00,  1067),
  ('Israel',                                 59.00,  40.00,  268.00,  1068),
  ('Italien — Mailand',                      42.00,  28.00,  191.00,  1069),
  ('Jamaika',                                39.00,  26.00,  171.00,  1070),
  ('Japan',                                  33.00,  22.00,  141.00,  1071),
  ('Japan — Osaka',                          33.00,  22.00,  141.00,  1072),
  ('Japan — Tokio',                          50.00,  33.00,  285.00,  1073),
  ('Jordanien',                              57.00,  38.00,  134.00,  1074),
  ('Kambodscha',                             42.00,  28.00,  108.00,  1075),
  ('Kamerun',                                56.00,  37.00,  275.00,  1076),
  ('Kanada',                                 54.00,  36.00,  214.00,  1077),
  ('Kanada — Ottawa',                        62.00,  41.00,  214.00,  1078),
  ('Kanada — Toronto',                       54.00,  36.00,  392.00,  1079),
  ('Kanada — Vancouver',                     63.00,  42.00,  304.00,  1080),
  ('Kap Verde',                              38.00,  25.00,   90.00,  1081),
  ('Kasachstan',                             33.00,  22.00,  108.00,  1082),
  ('Katar',                                  81.00,  54.00,  128.00,  1083),
  ('Kenia',                                  48.00,  32.00,  217.00,  1084),
  ('Kirgisistan',                            35.00,  24.00,   80.00,  1085),
  ('Kolumbien',                              34.00,  23.00,  123.00,  1086),
  ('Kongo, Demokratische Republik',          65.00,  44.00,  337.00,  1087),
  ('Kongo, Republik',                        53.00,  36.00,  215.00,  1088),
  ('Korea, Republik',                        39.00,  26.00,  130.00,  1089),
  ('Kosovo',                                 24.00,  16.00,   71.00,  1090),
  ('Kroatien',                               46.00,  31.00,  191.00,  1091),
  ('Kuba',                                   51.00,  34.00,  170.00,  1092),
  ('Kuwait',                                 63.00,  42.00,  224.00,  1093),
  ('Laos',                                   35.00,  24.00,   71.00,  1094),
  ('Lesotho',                                28.00,  19.00,  104.00,  1095),
  ('Lettland',                               46.00,  31.00,  119.00,  1096),
  ('Libanon',                                69.00,  46.00,  146.00,  1097),
  ('Liberia',                                65.00,  44.00,  173.00,  1098),
  ('Liechtenstein',                          57.00,  38.00,  234.00,  1099),
  ('Litauen',                                48.00,  32.00,  124.00,  1100),
  ('Madagaskar',                             33.00,  22.00,  116.00,  1101),
  ('Malawi',                                 41.00,  28.00,  109.00,  1102),
  ('Malaysia',                               36.00,  24.00,   86.00,  1103),
  ('Malediven',                              70.00,  47.00,  200.00,  1104),
  ('Mali',                                   42.00,  28.00,  141.00,  1105),
  ('Malta',                                  59.00,  40.00,  191.00,  1106),
  ('Marokko',                                41.00,  28.00,   87.00,  1107),
  ('Marshall Inseln',                        45.00,  30.00,  112.00,  1108),
  ('Mauretanien',                            35.00,  24.00,   86.00,  1109),
  ('Mauritius',                              44.00,  29.00,  172.00,  1110),
  ('Mexiko',                                 40.00,  27.00,  337.00,  1111),
  ('Mikronesien',                            41.00,  28.00,  140.00,  1112),
  ('Moldau, Republik',                       26.00,  17.00,   73.00,  1113),
  ('Monaco',                                 52.00,  35.00,  187.00,  1114),
  ('Mongolei',                               23.00,  16.00,   92.00,  1115),
  ('Montenegro',                             32.00,  21.00,   85.00,  1116),
  ('Mosambik',                               51.00,  34.00,  208.00,  1117),
  ('Myanmar',                                23.00,  16.00,  103.00,  1118),
  ('Namibia',                                28.00,  19.00,  146.00,  1119),
  ('Nepal',                                  33.00,  22.00,  125.00,  1120),
  ('Neuseeland',                             58.00,  39.00,  148.00,  1121),
  ('Nicaragua',                              46.00,  31.00,  105.00,  1122),
  ('Niger',                                  42.00,  28.00,  131.00,  1123),
  ('Nigeria',                                52.00,  35.00,  202.00,  1124),
  ('Nordmazedonien',                         27.00,  18.00,   89.00,  1125),
  ('Norwegen',                               75.00,  50.00,  139.00,  1126),
  ('Oman',                                   64.00,  43.00,  141.00,  1127),
  ('Pakistan',                               41.00,  28.00,  199.00,  1128),
  ('Palau',                                  51.00,  34.00,  193.00,  1129),
  ('Panama',                                 41.00,  28.00,   82.00,  1130),
  ('Papua-Neuguinea',                        59.00,  40.00,  159.00,  1131),
  ('Paraguay',                               39.00,  26.00,  124.00,  1132),
  ('Peru',                                   52.00,  35.00,  128.00,  1133),
  ('Philippinen',                            41.00,  28.00,  140.00,  1134),
  ('Polen — Breslau',                        34.00,  23.00,  124.00,  1135),
  ('Polen — Warschau',                       40.00,  27.00,  143.00,  1136),
  ('Portugal',                               32.00,  21.00,  111.00,  1137),
  ('Ruanda',                                 44.00,  29.00,  117.00,  1138),
  ('Rumänien',                               38.00,  25.00,  103.00,  1139),
  ('Russische Föderation',                   28.00,  19.00,  133.00,  1140),
  ('Russische Föderation — Moskau',          30.00,  20.00,  235.00,  1141),
  ('Russische Föderation — St. Petersburg',  28.00,  19.00,  133.00,  1142),
  ('Sambia',                                 38.00,  25.00,  105.00,  1143),
  ('Samoa',                                  39.00,  26.00,  105.00,  1144),
  ('San Marino',                             34.00,  23.00,   79.00,  1145),
  ('São Tomé – Príncipe',                    36.00,  24.00,  147.00,  1146),
  ('Saudi-Arabien',                          56.00,  37.00,  181.00,  1147),
  ('Saudi-Arabien — Djidda',                 57.00,  38.00,  181.00,  1148),
  ('Saudi-Arabien — Riad',                   56.00,  37.00,  186.00,  1149),
  ('Schweden',                               66.00,  44.00,  140.00,  1150),
  ('Schweiz — Bern',                         82.00,  55.00,  195.00,  1151),
  ('Senegal',                                48.00,  32.00,  160.00,  1152),
  ('Serbien',                                27.00,  18.00,   97.00,  1153),
  ('Sierra Leone',                           57.00,  38.00,  145.00,  1154),
  ('Simbabwe',                               63.00,  42.00,  198.00,  1155),
  ('Singapur',                               71.00,  48.00,  277.00,  1156),
  ('Slowakische Republik',                   33.00,  22.00,  121.00,  1157),
  ('Slowenien',                              38.00,  25.00,  126.00,  1158),
  ('Spanien — Kanarische Inseln',            36.00,  24.00,  103.00,  1159),
  ('Spanien — Palma de Mallorca',            44.00,  29.00,  142.00,  1160),
  ('Sri Lanka',                              36.00,  24.00,  112.00,  1161),
  ('St. Kitts und Nevis',                    66.00,  44.00,  203.00,  1162),
  ('St. Lucia',                              66.00,  44.00,  203.00,  1163),
  ('St. Vincent und Grenadinen',             66.00,  44.00,  203.00,  1164),
  ('Südafrika',                              29.00,  20.00,  109.00,  1165),
  ('Südafrika — Johannesburg',               36.00,  24.00,  129.00,  1166),
  ('Südafrika — Kapstadt',                   33.00,  22.00,  130.00,  1167),
  ('Südsudan',                               51.00,  34.00,  159.00,  1168),
  ('Suriname',                               66.00,  44.00,  203.00,  1169),
  ('Tadschikistan',                          27.00,  18.00,   85.00,  1170),
  ('Taiwan',                                 51.00,  34.00,  174.00,  1171),
  ('Tansania',                               44.00,  29.00,   97.00,  1172),
  ('Thailand',                               36.00,  24.00,  114.00,  1173),
  ('Togo',                                   36.00,  24.00,  144.00,  1174),
  ('Tonga',                                  29.00,  20.00,  102.00,  1175),
  ('Trinidad und Tobago',                    66.00,  44.00,  203.00,  1176),
  ('Tschad',                                 42.00,  28.00,  155.00,  1177),
  ('Tunesien',                               40.00,  27.00,  144.00,  1178),
  ('Türkei',                                 24.00,  16.00,  107.00,  1179),
  ('Türkei — Ankara',                        32.00,  21.00,  110.00,  1180),
  ('Türkei — Izmir',                         44.00,  29.00,  120.00,  1181),
  ('Turkmenistan',                           28.00,  19.00,  135.00,  1182),
  ('Uganda',                                 45.00,  30.00,  207.00,  1183),
  ('Ukraine',                                33.00,  22.00,  180.00,  1184),
  ('Ungarn',                                 32.00,  21.00,   85.00,  1185),
  ('Uruguay',                                40.00,  27.00,  113.00,  1186),
  ('USA — Atlanta',                          77.00,  52.00,  182.00,  1187),
  ('USA — Boston',                           63.00,  42.00,  333.00,  1188),
  ('USA — Chicago',                          65.00,  44.00,  233.00,  1189),
  ('USA — Houston',                          62.00,  41.00,  204.00,  1190),
  ('USA — Los Angeles',                      64.00,  43.00,  262.00,  1191),
  ('USA — Miami',                            65.00,  44.00,  256.00,  1192),
  ('USA — New York City',                    66.00,  44.00,  308.00,  1193),
  ('USA — San Francisco',                    59.00,  40.00,  327.00,  1194),
  ('USA — Washington, D. C.',                66.00,  44.00,  203.00,  1195),
  ('Usbekistan',                             32.00,  21.00,  133.00,  1196),
  ('Vatikanstaat',                           48.00,  32.00,  150.00,  1197),
  ('Venezuela',                              51.00,  34.00,  178.00,  1198),
  ('Vereinigte Arabische Emirate',           81.00,  54.00,  169.00,  1199),
  ('Vietnam',                                36.00,  24.00,  111.00,  1200),
  ('Weißrussland',                           21.00,  14.00,  148.00,  1201),
  ('Zentralafrikanische Republik',           53.00,  36.00,  210.00,  1202),
  ('Zypern',                                 42.00,  28.00,  125.00,  1203)
ON CONFLICT (land_key) DO NOTHING;
