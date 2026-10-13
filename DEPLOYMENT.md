# DEPLOYMENT — CREDO Finanzportal

GoLive-Schritte fuer Produktion (`finance.fes-credo.de`).

---

## 1. Voraussetzungen

- Server mit Docker + Docker Compose v2
- Bestehende Caddy-Instanz mit externem Netzwerk `reverse_proxy`
- DNS: `finance.fes-credo.de` → Server-IP
- **SMTP-Postfach** (z.B. Office365, `smtp.office365.com:587`) für den E-Mail-Versand ans DMS — **primärer Versandweg** (Default `versand_methode = SMTP`)
- *Optional:* n8n-Instanz mit Webhooks, falls der Versand statt per SMTP über n8n laufen soll (siehe Punkt 7)

> **Vier Vorgangstypen:** Reisekosten, Kostenerstattung, Sammelfahrt und Klassenfahrt (Letztere nur für Mandant 40 / Förderverein).

---

## 2. Repository klonen

```bash
git clone https://github.com/Penknife5550/CREDO_Fiinance_Portal.git
cd CREDO_Fiinance_Portal
git checkout main
```

---

## 3. Umgebungsvariablen

```bash
cp .env.example .env.production
nano .env.production
```

Pflichtfelder:

| Variable | Wert |
|---|---|
| `DB_PASSWORD` | Starkes Passwort, min. 16 Zeichen |
| `ENCRYPTION_KEY` | **Genau 64 Hex-Zeichen** (32 Byte, AES-256-GCM), einmalig generieren: `openssl rand -hex 32`. Ein anderes Format bricht den App-Start ab. **Nie wechseln**, sobald im AdminCenter Zugangsdaten gespeichert sind — sie wären sonst nicht mehr lesbar |
| `JWT_SECRET` | Beliebiger 48+ Zeichen-String, einmalig generieren: `openssl rand -hex 24` |
| `SMTP_HOST` | SMTP-Server, z.B. `smtp.office365.com` |
| `SMTP_PORT` | `587` (STARTTLS) bzw. `465` (implizites TLS) |
| `SMTP_USER` | Postfach-Benutzer, z.B. `finanzportal@credo.de` |
| `SMTP_PASS` | Postfach-Passwort / App-Passwort |
| `MAIL_FROM_NAME` | `CREDO Finanzportal` |
| `MAIL_FROM_EMAIL` | `finanzportal@credo.de` |
| `ADMIN_INITIAL_PASSWORD` | Initial-Passwort, **min. 12 Zeichen**, muss nach erstem Login geaendert werden. **Eintrag stehen lassen:** Der Seed laeuft bei jedem Container-Start und bricht ohne gueltigen Wert ab (App startet dann nicht) |
| `APP_URL` | `https://finance.fes-credo.de` |

Die **SMTP-Felder sind Pflicht** — SMTP ist der Default-Versandweg. Nur wenn stattdessen n8n/Webhook genutzt werden soll, im AdminCenter auf `WEBHOOK` umstellen (siehe Punkt 7); dann dürfen die SMTP-Felder leer bleiben.

```bash
chmod 600 .env.production
```

---

## 4. Caddyfile ergaenzen

In der bestehenden Caddyfile auf dem Server hinzufuegen:

```
finance.fes-credo.de {
    reverse_proxy credo-finanz-app:3000

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }

    encode gzip
    log
}
```

Caddy neu laden:

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## 5. Stack starten

```bash
./deploy.sh
```

Das Script:
1. Prueft `.env.production` (kein `HIER_` Platzhalter)
2. Baut Multi-Stage-Image (Frontend + Backend)
3. Startet `credo-finanz-db` und `credo-finanz-app`
4. Wartet auf DB-Health, fuehrt automatisch alle Migrationen aus (`docker-entrypoint.sh`)
5. Seedet 7 Mandanten + Pauschalen + Admin-Konto

**Migrationen 0000–0017 laufen automatisch** über `docker-entrypoint.sh` (Drizzle-Migrator, jede Migration genau einmal). `0006_sammelfahrt.sql` und `0011_klassenfahrt.sql` nutzen `ALTER TYPE ADD VALUE IF NOT EXISTS` — funktioniert mit PostgreSQL ≥ 12 (Repo nutzt 16). Der komplette Lauf 0000–0012 + Seed wurde gegen eine **frische PG-16-DB verifiziert** (20 Tabellen, 7 Mandanten, 43 Erstattungs-Kategorien, leerer `beleg_counter`), 0000–0014 erneut am 10.10.2026, 0000–0015 und 0000–0017 ebenfalls am 10.10.2026. Neu seit 0006: `erstattung_kategorien` (0009), `email_log` + SMTP-Versand (0010), Klassenfahrt-Tabellen + `KLASSENFAHRT`-Enum (0011), `beleg_counter` für race-freie Belegnummern (0012), `email_config` als Singleton (0013), vollständige BMF-Auslandspauschalen 2026 (0014), Land je Reisetag + Übernachtungsangabe (0015), Städte mit eigenem Satz unter „Häufige Ziele“ (0016), Auslandspauschalen je Satzstand/Jahr + angewandter Satz je Reisetag (0017).

**0014 (Auslandspauschalen nach BMF-Schreiben vom 05.12.2025):** legt alle Länder/Städte an (223 Zeilen inkl. 9 Verweisstaaten) und korrigiert die 19 Bestandszeilen nur dort, wo noch der alte Seed-Wert steht — im AdminCenter gepflegte Werte bleiben unberührt. Vor und nach dem Deploy prüfen:

```bash
docker exec -i credo-finanz-db psql -U credo -d finanzportal < backend/scripts/pruefe-auslandspauschalen.sql
```

Vorher zeigt die Abfrage die anstehenden Korrekturen und fehlende Länder, nachher muss sie **leer** sein. Die Abfrage läuft vor und nach Migration 0017 (sie liest `gueltig_von` über `to_jsonb`), also auch beim gemeinsamen Deploy von 0014–0017. Bleibt eine Zeile `abweichend`, wurde der Satz im AdminCenter geändert — bewusst klären und dort auf den BMF-Wert setzen. Die Migration wird aus `backend/src/db/data/bmf-auslandspauschalen-2026*.csv` erzeugt (`npx tsx backend/scripts/bmf-csv-zu-sql.ts`); nach dem Deploy Korrekturen nur noch als **neue** Migration, nie 0014 neu schreiben. Für die lohnsteuerliche Nachkorrektur siehe `backend/scripts/vma-nachkorrektur-2026.sql` (Kopfkommentar) und Abschnitt 13.

**0015 (Land je Reisetag, Release 1b):** fünf neue, nullable Spalten ohne Backfill und ohne Fremdschlüssel — `reisetage.land_24uhr`, `reisetage.letzter_taetigkeitsort` (Angaben des Mitarbeiters), `reisetage.land_key` (maßgebendes Land, vom Server bestimmt: `INLAND`, `ANDERES`, `SEETAG` oder Land-Key), `reisetage.land_freitext` (Staat bei „Staat nicht in der Liste“) und `einreichungen.uebernachtung`. Reine Metadaten: Altbelege behalten `NULL` (maßgebend war dort `einreichungen.land`), Beträge ändern sich nicht. Ab 1b bildet der Server die Reisetage selbst aus Abfahrt/Rückkehr; ein noch geöffneter alter Browser-Tab bekommt bei Reisen unter 24 h über Mitternacht die Meldung, die Seite neu zu laden. Die Nachkorrektur (`vma-nachkorrektur-2026.sql`) schließt Belege mit gesetztem `land_key` aus — sie sind bereits je Tag richtig gerechnet.

**0017 (Sätze nach Reisedatum, Release 1c):** `pauschalen_ausland` bekommt `gueltig_von` (date) und `quelle`; der Primärschlüssel wird `(land_key, gueltig_von)`. Der Bestand wird zum Satzstand **01.01.2026 / „BMF-Schreiben vom 05.12.2025“** (Spalten-Default nur für den Backfill, danach entfernt — jeder neue Stand nennt Datum und Quelle ausdrücklich; keine Wertänderung). Der Server nimmt je Reisetag den Stand mit dem größten `gueltig_von` ≤ Datum **im selben Kalenderjahr**; fehlt er, wird die Abrechnung mit einem passenden Hinweis abgelehnt (Jahresstand fehlt noch → später einreichen; nur dieses Land fehlt → Staat bzw. „Staat nicht in der Liste“ wählen; Jahr vor 2026 → Buchhaltung). Neu in `reisetage`: `satz_24h`, `satz_8h`, `satz_quelle` (angewandter Satz je Tag, nullable, kein Backfill); PDF und Mail nennen die Quelle(n) („Pauschalen: …“, bei mehreren je Quelle die Tage). Die Prüfabfrage `pruefe-auslandspauschalen.sql` vergleicht nur den Stand 2026.

**Nach dem Deploy von 0017** die Prüfabfrage (oben) erneut ausführen: 0017 kennzeichnet **jede** Bestandszeile als „BMF-Schreiben vom 05.12.2025“, auch im AdminCenter abweichend gepflegte oder angelegte. Für jede Zeile `abweichend` bzw. `nicht in CSV` im AdminCenter (Pauschalen → Stand 2026 → Bearbeiten) entweder den BMF-Wert eintragen oder die **Quelle** berichtigen, z. B. „AdminCenter, abweichend von BMF 05.12.2025“ — die Quelle steht ab jetzt je Reisetag im Beleg. Jährliches Update: Abschnitt 14.

Nach erfolgreichem Start:

```bash
./deploy.sh health
./deploy.sh logs   # zum Live-Mitlesen
```

---

## 6. Erste Anmeldung im AdminCenter

1. https://finance.fes-credo.de/admin oeffnen
2. Login: `admin@credo.de` / Wert aus `ADMIN_INITIAL_PASSWORD`
3. Passwort sofort aendern (TODO: aktuell nicht im UI — direkt in DB ueber `bcrypt`-gehashtes Passwort + `UPDATE admins SET passwort_hash=... WHERE email='admin@credo.de'`)

---

## 7. (Optional) n8n-Webhook(s) statt SMTP

**Standard ist SMTP-Direktversand** (`versand_methode = SMTP`) — dieser Abschnitt ist nur nötig, wenn der Versand stattdessen über n8n laufen soll. Dann im AdminCenter → Versand & Integration die Methode auf `WEBHOOK` stellen und für jeden Vorgangstyp (Reisekosten, Erstattung, Sammelfahrt, Klassenfahrt) einen n8n-Workflow vorbereiten oder pro Typ einen einzigen mit Filter.

### Webhook-URL im AdminCenter eintragen

**AdminCenter → Versand & Integration → n8n Webhooks → Webhook anlegen:**
- URL z.B. `https://n8n.fes-minden.de/webhook/credo-reisekosten`
- Authentifizierung: Basic Auth (Empfehlung) oder Header
- Einreichungstyp: `Alle` ODER `Nur Reisekosten` / `Nur Erstattungen` / `Nur Sammelfahrt`
- Events: alle drei aktiv (Eingereicht, Statusaenderung, Fehler)
- "Testen"-Button drueckt einen Test-Payload an die URL — Response sollte `200` sein

### Webhook-Payload-Struktur

Detail siehe `n8n/WEBHOOK_DATENSTRUKTUR.md`. Kurz:

```json
{
  "event": "eingereicht",
  "timestamp": "2026-04-28T...",
  "an": "fibu-gymnasium@docubit.credo.de",
  "pdfBase64": "JVBERi0xLjcK...",
  "pdfDateiname": "RK-2026-00042.pdf",
  "einreichung": {
    "id": "uuid",
    "belegNr": "RK-2026-00042",
    "typ": "REISEKOSTEN" | "ERSTATTUNG" | "SAMMELFAHRT",
    "mandant": "...", "mandantNr": 31,
    "mitarbeiter": { "vorname": "...", "nachname": "...", "personalNr": "..." },
    "gesamtbetrag": "37.50",
    "iban": "DE...", "kontoinhaber": "...",
    /* typspezifische Felder */
  }
}
```

Bei Sammelfahrten enthaelt `einreichung.fahrten` ein Array mit `{datum, startOrt, ziel, km, kmBetrag}`.

---

## 8. Mandanten konfigurieren

Im AdminCenter → Mandanten:
- Pro Mandant pruefen: Name, Mandanten-Nr, DMS-E-Mail, Primaerfarbe, Aktiv
- KST-Sichtbarkeit pro Vorgangstyp (Pills `RK / KE / SF` direkt klickbar)

---

## 9. Smoke-Test

1. https://finance.fes-credo.de oeffnen → **4 Karten** sichtbar
2. **Reisekostenabrechnung** einreichen (1 Tag, PKW 50 km, 1 Beleg) → Erfolgsseite mit `RK-2026-00001`
3. **Kostenerstattung** einreichen (1 Position, 1 Beleg) → `KE-2026-00001`
4. **Sammelfahrt** einreichen (3 Fahrten, PKW) → `SF-2026-00001`
5. **Klassenfahrt** (nur Mandant 40 / Förderverein) einreichen (2 Klassen, 1 Kostenzeile, 1 Beleg) → `KF-2026-00001`
6. Pruefen: **vier** E-Mails im DMS angekommen, jeweils mit PDF-Anhang (bei Klassenfahrt: Deckblatt + Auszahlungstabelle je Klasse + Kostenaufteilungsmatrix)

---

## 10. Monitoring

```bash
./deploy.sh logs              # Live-Logs der App
docker logs credo-finanz-db   # DB-Logs
```

Im AdminCenter → Protokoll: Versand-Log mit Status pro Einreichung.

---

## 11. Rollback

Bei Problemen vor dem ersten echten Vorgang:

```bash
./deploy.sh stop                        # Stack runter
docker compose -f docker-compose.prod.yml --env-file .env.production down -v  # ACHTUNG: -v loescht DB-Volume
git checkout <vorheriger-commit>
./deploy.sh                             # Vorherige Version starten
```

Nach echten Vorgaengen: KEIN `down -v` — DB-Migration zurueckrollen ueber manuelles SQL (Phase B = Migration 0006).

**Rollback-SQL fuer 0006:**

```sql
DROP TABLE IF EXISTS fahrten;
-- ALTER TYPE einreichung_typ DROP VALUE 'SAMMELFAHRT' geht in PG nicht;
-- Workaround: TYPE neu erstellen ohne SAMMELFAHRT, dann Spalte umbiegen.
-- Falls noetig: separates Rollback-Skript.
```

---

## 12. Updates / neue Releases

```bash
cd CREDO_Fiinance_Portal
git pull
./deploy.sh   # Image neu bauen + Container neu starten
```

`docker-entrypoint.sh` fuehrt automatisch neue Migrationen aus.

---

## 13. Loesch-Moratorium (VMA-Nachkorrektur 2026)

Der Loeschjob (`services/retention.ts`) loescht zugestellte Vorgaenge (`GESENDET`) `RETENTION_FRIST_TAGE`
nach der Einreichung (Standard **90** Tage, Wert im Code). Ausgenommen ist bis zum **31.03.2027** der
**Reisekosten-Altbestand**: Reisekosten ohne Land je Reisetag, also eingereicht vor Release 1b — genau die
Belege, die `backend/scripts/vma-nachkorrektur-2026.sql` liest. Das Enddatum steht im Code
(`STANDARD_MORATORIUM_BIS`), `RETENTION_MORATORIUM_BIS` in `.env.production` ueberschreibt es. Grund: Die
Auslands-VMA wurden bis zum VMA-Fix um rund 20 % zu hoch berechnet; Reisetage und Reiseland werden fuer die
lohnsteuerliche Nachkorrektur 2026 gebraucht (Art. 17 Abs. 3 lit. b/e DSGVO). Datenminimierung
(Art. 5 Abs. 1 lit. c/e DSGVO): IBAN, Belege und PDF braucht die Nachkorrektur nicht.

| Nach Ablauf der Frist | Was passiert |
|---|---|
| Erstattung, Sammelfahrt, Klassenfahrt, Reisekosten ab Release 1b | komplett geloescht (Datensatz, Belege, PDF, `email_log`) |
| Reisekosten-Altbestand — wird entfernt (minimiert) | IBAN, Kontoinhaber, Beleg-Dateien und PDF (samt Verweisen in der DB) |
| Reisekosten-Altbestand — bleibt erhalten | Name, Personalnr., Mandant, Reiseanlass und -ziel, Abfahrt/Rueckkehr, Reiseland, Verkehrsmittel/km, Reisetage mit Mahlzeiten und Betraegen, weitere Kosten (Art, Beschreibung, Betrag), Versandprotokoll (`email_log`: Betreff mit Name, Message-ID, Fehlertext) |

Die Nachkorrektur liest davon nur Name, Personalnr., Mandant, Abfahrt/Rueckkehr, Reiseland und Reisetage; der
uebrige Datensatz wird nicht weiter gekuerzt. Laesst sich eine Datei nicht loeschen, bleibt ihr Verweis in der
DB und der naechste Lauf versucht es erneut (Log: `[Retention] RK-…: Datei nicht loeschbar`).
Das Skript `vma-nachkorrektur-2026.sql` kommt mit dem VMA-Fix (Release 1a–1c); wird dieser Abschnitt vorab
einzeln auf `main` uebernommen, gibt es das Skript dort erst nach dem Merge.

> **Offene Entscheidung VOR dem Deploy (Analyse L11/P03, Code-Review SEC-M1):** Bisher galt: Aufhebung des
> Moratoriums erst mit **Archivquittung aus DokuBit**. Diese Quittung gibt es noch nicht (P03 offen) —
> `GESENDET` heisst nur, dass SMTP die Mail angenommen hat. Mit diesem Stand loescht der Job ab dem ersten Lauf
> (60 s nach dem Start; produktiv seit ca. 16.07.2026, also ab ca. 14.10.2026 relevant) Erstattungen, Sammel-
> und Klassenfahrten sowie neue Reisekosten nach 90 Tagen vollstaendig und beim Reisekosten-Altbestand PDF und
> Belege. Ging eine Mail im DMS verloren, ist der Buchungsbeleg dann endgueltig weg (GoBD Rz. 142; es gibt noch
> kein Backup, Analyse S6). Mit dem Datenschutzbeauftragten entscheiden und hier eintragen:
>
> - **(a) Bis zur Archivquittung nichts loeschen:** `RETENTION_FRIST_TAGE=3650` in `.env.production`. Fail-closed-
>   Pruefung und Moratorium bleiben; kein Code-Eingriff noetig.
> - **(b) Loeschen nach 90 Tagen, aber nur nach DokuBit-Abgleich:** Vor dem Deploy die Belegnummern der Liste
>   unten in DokuBit pruefen (jede muss dort archiviert sein; fehlende neu senden, bevor sie faellig werden),
>   danach monatlich wiederholen. Die Liste enthaelt alles, was in den naechsten 30 Tagen faellig wird.
>
> **Entscheidung:** 11.10.2026, **Variante (a)**, Dimitri Riesen. Umgesetzt als Compose-Default
> `RETENTION_FRIST_TAGE: ${RETENTION_FRIST_TAGE:-3650}` (`docker-compose.prod.yml`, `docker-compose.yml`) — auf dem
> Server ist kein Eintrag noetig. Folge: Bis zur Archivquittung wird nichts geloescht und auch der
> Reisekosten-Altbestand nicht minimiert (IBAN/PDF bleiben). Mit dem Datenschutzbeauftragten dokumentieren
> (Aufbewahrung, bis die Archivierung im DMS nachgewiesen ist). Aufheben: Archivquittung (P03) umsetzen, dann
> den Default wieder entfernen bzw. `RETENTION_FRIST_TAGE=90` setzen.

```bash
docker exec credo-finanz-db psql -U credo -d finanzportal -c "SELECT beleg_nr, typ, created_at::date FROM einreichungen WHERE status = 'GESENDET' AND created_at < now() - interval '60 days' ORDER BY created_at;"
```

Das Moratorium endet automatisch: **Ab dem 31.03.2027** loescht der Job auch den Reisekosten-Altbestand nach
der normalen Frist, ohne Eingriff. Ab dem 01.03.2027 warnt jeder Lauf im Log (`Moratorium REISEKOSTEN endet
am …`). **Prueftermin: 01.03.2027** — Kalendertermin mit dem Datenschutzbeauftragten anlegen: Ist die
Nachkorrektur abgeschlossen? Falls nicht, das Enddatum **vor dem 31.03.2027** begruendet in `.env.production`
verlaengern (`RETENTION_MORATORIUM_BIS=JJJJ-MM-TT`) und wie unten aktivieren. Vorzeitig beenden: ein
vergangenes Datum eintragen.

Fail-closed: Ist `RETENTION_FRIST_TAGE` keine ganze Zahl ab 1 (z. B. `3.650`, `-1`, `10 Jahre`) oder
`RETENTION_MORATORIUM_BIS` kein gueltiges Datum `JJJJ-MM-TT`, startet der Loeschjob gar nicht
(Log: `Scheduler NICHT gestartet`) und loescht nichts — Wert korrigieren und neu aktivieren.

Aeltere Images (z. B. ein getaggtes Vorgaenger-Image als Rueckweg oder `up -d` ohne `--build`) lesen
`RETENTION_TAGE` und kennen kein Moratorium. `docker-compose.prod.yml` setzt `RETENTION_TAGE` deshalb fest auf
`3650` — ein solches Image loescht mit dieser Compose-Datei nichts. Der aktuelle Code liest `RETENTION_TAGE`
nicht mehr; ein alter Eintrag in `.env.production` ist wirkungslos.

Aktivieren bzw. aendern (NICHT `./deploy.sh restart` — das uebernimmt geaenderte Umgebungswerte nicht):

```bash
git pull
grep RETENTION .env.production       # leer lassen = Variante (a); nur RETENTION_FRIST_TAGE / RETENTION_MORATORIUM_BIS wirken
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build app
docker logs credo-finanz-app 2>&1 | grep Retention
# erwartet (Variante a, ohne eigene Eintraege): "Scheduler aktiv (3650-Tage-Frist, täglich, nur GESENDET). Moratorium REISEKOSTEN aktiv, endet am 2027-03-31: ..."
```

Kontrolle am Folgetag (Variante b: aelter als 90 Tage nur noch Reisekosten-Altbestand, ohne IBAN und PDF):

```bash
docker exec credo-finanz-db psql -U credo -d finanzportal -c "SELECT typ, count(*), count(bank_iban) AS mit_iban, count(pdf_dateipfad) AS mit_pdf FROM einreichungen WHERE status = 'GESENDET' AND created_at < now() - interval '90 days' GROUP BY typ;"
```

---

## 14. Jährliches Pauschalen-Update (Auslandspauschalen)

Die Auslandspauschalen gelten je Kalenderjahr (Satzstand mit `gueltig_von` = 01.01.). Fehlt der Stand des Reisejahres, lehnt das Portal Auslandsabrechnungen mit Reisetagen in diesem Jahr ab („Die Auslandspauschalen für 2027 sind noch nicht hinterlegt. Bitte reichen Sie die Abrechnung später ein …“) — es rechnet nie still mit dem Vorjahressatz weiter. Ob ein Jahr hinterlegt ist, entscheidet der **Luxemburg-Stand** (gesetzlicher Ersatzsatz, steht in jedem Schreiben; der Generator verlangt ihn). Inland (28/14 €, § 9 Abs. 4a EStG) steht im Code und braucht kein Update.

Das BMF-Schreiben erscheint i. d. R. **Anfang Dezember** (Sätze 2026: Schreiben vom 05.12.2025). Ablauf, Deploy spätestens zum **31.12.** — verantwortlich für Termin und Abgleich: (eintragen):

1. **PDF → CSV:** Schreiben samt Anlage herunterladen, `backend/scripts/bmf-pdf-zu-csv.py` anpassen (Titelprüfung „Auslandsreisen ab 1. Januar 2027“, Seitenbereich der Anlage, ggf. Spaltengrenzen, Namenszuordnung `STAAT_KEY`/`STADT_KEY`) und `backend/src/db/data/bmf-auslandspauschalen-2027.csv` erzeugen (`land_key;tagessatz_24h;tagessatz_8h;uebernachtung`). Verweisstaaten aus dem Text des Schreibens (z. B. „Mikronesien: wie Philippinen“) in `bmf-auslandspauschalen-2027-verweise.csv` (`land_key;wie_land_key`). Die Verweis-CSV ist jedes Jahr Pflicht (ohne Verweisstaaten: nur die Kopfzeile) — fehlt sie, bricht der Generator ab. Keys exakt wie im Vorjahr (Staat = Name, Stadt = „Staat — Stadt“) — nie umbenennen. Gelten laut BMF die Vorjahressätze unverändert fort, trotzdem einen eigenen Stand mit der neuen Quelle anlegen (**beide** CSV-Dateien des Vorjahres kopieren).
2. **Generator** (Repo-Root, `00NN` = nächste freie Migrationsnummer):

   ```bash
   npx tsx backend/scripts/bmf-csv-zu-sql.ts --jahr 2027 \
     --quelle 'BMF-Schreiben vom TT.MM.2026' --migration 00NN_pauschalen_ausland_bmf2027
   ```

   Erzeugt die Migration (alle Zeilen mit `gueltig_von` = 2027-01-01, `ON CONFLICT (land_key, gueltig_von) DO NOTHING`; Sortierung und damit „Häufige Ziele“ vom Vorgängerstand des Landes, neue Länder ab 1000), den Journal-Eintrag und `backend/scripts/pruefe-auslandspauschalen-2027.sql`. Die Ausgabe listet Keys, die gegenüber der Vorjahres-CSV **fehlen** oder **neu** sind — jeden klären:
   - **Umbenennung** im BMF (gleicher Staat/Ort, neuer Name) → CSV-Key an den Bestand anpassen, damit Sortierung und „Häufige Ziele“ erhalten bleiben.
   - **Gestrichen** (Staat bzw. Stadt nicht mehr im Schreiben) → kein Stand 2027. Für Reisetage ab 2027 fehlt der Key in der Länderauswahl; wer ihn noch gewählt hat (z. B. Reise über den Jahreswechsel), erhält den Hinweis, den Staat (übrige Orte) bzw. „Staat nicht in der Liste“ (Satz Luxemburg) zu wählen. Reisetage 2026 rechnen weiter mit dem Stand 2026.
   - **Neu** aufgenommen → Sortierung ab 1000 (alphabetisch), wählbar nur für Reisetage ab 2027; bei Bedarf im AdminCenter die Sortierung unter 1000 setzen („Häufige Ziele“).

   Der Name muss `bmf2027` enthalten (fängt einen vom Vorjahr kopierten Befehl ab). Eine committete oder eingespielte Migration **nie** neu schreiben: `--neu-schreiben` nur für die jüngste, noch nicht committete Satzstand-Migration desselben Jahres — der Generator verweigert alles andere (Korrektur danach im AdminCenter bzw. als neue, handgeschriebene Migration; ein erneuter Generatorlauf korrigiert wegen `DO NOTHING` keine vorhandenen Zeilen).
3. **Vier-Augen-Abgleich:** Eine zweite Person vergleicht die CSV mit der BMF-Anlage (Zeilenzahl, alle „Häufigen Ziele“, Stichproben je Seite, Verweisstaaten, Datum des Schreibens in `--quelle`) und prüft die Migration (nur `INSERT`). Danach Tests und Migration gegen eine frische Test-DB (`npm run db:migrate`, `npm run db:seed`).
4. **Deploy vor dem 01.01.** (`./deploy.sh`, Migration läuft automatisch), danach die Prüfabfrage — sie muss **leer** sein:

   ```bash
   docker exec -i credo-finanz-db psql -U credo -d finanzportal < backend/scripts/pruefe-auslandspauschalen-2027.sql
   ```

5. CSV-Dateien, Migration, Journal und Prüfabfrage committen.

**Einzelkorrekturen** (Berichtigung, Satz ab einem Stichtag im Jahr) im AdminCenter unter „Pauschalen“ als **neuen Satzstand** mit eigenem „gültig ab“ und **eigener Quelle** anlegen (bei gleicher Quelle sind die Stände im PDF nicht zu unterscheiden): Reisetage ab diesem Datum (im selben Jahr) erhalten den neuen Satz, frühere den bisherigen. „Gültig ab“ ist der erste Tag, ab dem der Satz gilt — für einen Jahresstand der 01.01., nie das Datum des Schreibens. Eingereichte Belege bleiben unverändert (angewandter Satz je Tag in `reisetage.satz_24h/satz_8h/satz_quelle`, im PDF je Quelle mit den Tagen). Luxemburg (gesetzlicher Ersatzsatz für nicht aufgeführte Staaten und Seetage): Den **ersten** Luxemburg-Stand eines Jahres sperren AdminCenter und Server gegen Löschen, solange andere Länder Stände in diesem Jahr haben; spätere Korrekturstände und Stände eines sonst leeren Jahres (z. B. Tippfehler im Datum) lassen sich löschen. **Ein neues Jahr nie von Hand im AdminCenter beginnen:** Schon ein einzelner Luxemburg-Stand schaltet das Jahr frei — die Länderauswahl zeigt dann nur Länder mit Stand in diesem Jahr, und für alle übrigen verweist das Portal auf „Staat nicht in der Liste“ (Satz Luxemburg). Ganze Jahresstände daher nur per Generator-Migration (alle Länder in einem `INSERT`).

Kommt das Schreiben erst nach dem 01.01., werden Auslandsabrechnungen mit Reisetagen im neuen Jahr bis zum Deploy abgelehnt; Inlandsabrechnungen laufen weiter. Einen Massenweg im AdminCenter („Jahresstand übernehmen“) gibt es noch nicht — bis dahin hängt das Update an diesem Ablauf.

---

## Notfall-Kontakte

- Server-Admin: (eintragen)
- Anwendungs-Owner: dimitri.riesen@fes-minden.de
- DMS-Support (Docubit): (eintragen)
- n8n-Instanz: https://n8n.fes-minden.de
