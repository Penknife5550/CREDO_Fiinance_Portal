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
| `ENCRYPTION_KEY` | **Genau 32 Zeichen**, einmalig generieren: `openssl rand -hex 16` |
| `JWT_SECRET` | Beliebiger 48+ Zeichen-String, einmalig generieren: `openssl rand -hex 24` |
| `SMTP_HOST` | SMTP-Server, z.B. `smtp.office365.com` |
| `SMTP_PORT` | `587` (STARTTLS) bzw. `465` (implizites TLS) |
| `SMTP_USER` | Postfach-Benutzer, z.B. `finanzportal@credo.de` |
| `SMTP_PASS` | Postfach-Passwort / App-Passwort |
| `MAIL_FROM_NAME` | `CREDO Finanzportal` |
| `MAIL_FROM_EMAIL` | `finanzportal@credo.de` |
| `ADMIN_INITIAL_PASSWORD` | Initial-Passwort, **muss nach erstem Login geaendert werden** |
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

**Migrationen 0000–0016 laufen automatisch** über `docker-entrypoint.sh` (Drizzle-Migrator, jede Migration genau einmal). `0006_sammelfahrt.sql` und `0011_klassenfahrt.sql` nutzen `ALTER TYPE ADD VALUE IF NOT EXISTS` — funktioniert mit PostgreSQL ≥ 12 (Repo nutzt 16). Der komplette Lauf 0000–0012 + Seed wurde gegen eine **frische PG-16-DB verifiziert** (20 Tabellen, 7 Mandanten, 43 Erstattungs-Kategorien, leerer `beleg_counter`), 0000–0014 erneut am 10.10.2026, 0000–0015 ebenfalls am 10.10.2026. Neu seit 0006: `erstattung_kategorien` (0009), `email_log` + SMTP-Versand (0010), Klassenfahrt-Tabellen + `KLASSENFAHRT`-Enum (0011), `beleg_counter` für race-freie Belegnummern (0012), `email_config` als Singleton (0013), vollständige BMF-Auslandspauschalen 2026 (0014), Land je Reisetag + Übernachtungsangabe (0015), Städte mit eigenem Satz unter „Häufige Ziele“ (0016).

**0014 (Auslandspauschalen nach BMF-Schreiben vom 05.12.2025):** legt alle Länder/Städte an (223 Zeilen inkl. 9 Verweisstaaten) und korrigiert die 19 Bestandszeilen nur dort, wo noch der alte Seed-Wert steht — im AdminCenter gepflegte Werte bleiben unberührt. Vor und nach dem Deploy prüfen:

```bash
docker exec -i credo-finanz-db psql -U credo -d finanzportal < backend/scripts/pruefe-auslandspauschalen.sql
```

Vorher zeigt die Abfrage die anstehenden Korrekturen und fehlende Länder, nachher muss sie **leer** sein. Bleibt eine Zeile `abweichend`, wurde der Satz im AdminCenter geändert — bewusst klären und dort auf den BMF-Wert setzen. Die Migration wird aus `backend/src/db/data/bmf-auslandspauschalen-2026*.csv` erzeugt (`npx tsx backend/scripts/bmf-csv-zu-sql.ts`); nach dem Deploy Korrekturen nur noch als **neue** Migration, nie 0014 neu schreiben. Für die lohnsteuerliche Nachkorrektur siehe `backend/scripts/vma-nachkorrektur-2026.sql` (Kopfkommentar) und Abschnitt 13.

**0015 (Land je Reisetag, Release 1b):** fünf neue, nullable Spalten ohne Backfill und ohne Fremdschlüssel — `reisetage.land_24uhr`, `reisetage.letzter_taetigkeitsort` (Angaben des Mitarbeiters), `reisetage.land_key` (maßgebendes Land, vom Server bestimmt: `INLAND`, `ANDERES`, `SEETAG` oder Land-Key), `reisetage.land_freitext` (Staat bei „Staat nicht in der Liste“) und `einreichungen.uebernachtung`. Reine Metadaten: Altbelege behalten `NULL` (maßgebend war dort `einreichungen.land`), Beträge ändern sich nicht. Ab 1b bildet der Server die Reisetage selbst aus Abfahrt/Rückkehr; ein noch geöffneter alter Browser-Tab bekommt bei Reisen unter 24 h über Mitternacht die Meldung, die Seite neu zu laden. Die Nachkorrektur (`vma-nachkorrektur-2026.sql`) schließt Belege mit gesetztem `land_key` aus — sie sind bereits je Tag richtig gerechnet.

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

Der 90-Tage-Loeschjob (`services/retention.ts`) ist ausgesetzt: `docker-compose.prod.yml` setzt
`RETENTION_TAGE` standardmaessig auf **3650**. Grund: Die Auslands-VMA wurden bis zum VMA-Fix
um rund 20 % zu hoch berechnet; Reisetage und Reiseland werden fuer die lohnsteuerliche
Nachkorrektur 2026 gebraucht (Art. 17 Abs. 3 lit. b/e DSGVO). **Pruefermin: 31.03.2027** —
danach mit Datenschutzbeauftragtem neu entscheiden (Aufhebung erst mit Archivquittung aus DokuBit).

Aktivieren bzw. aendern (NICHT `./deploy.sh restart` — das uebernimmt geaenderte Umgebungswerte nicht):

```bash
git pull
# optional abweichender Wert in .env.production: RETENTION_TAGE=3650
docker compose -f docker-compose.prod.yml --env-file .env.production up -d app
docker exec credo-finanz-app printenv RETENTION_TAGE        # erwartet: 3650
docker logs credo-finanz-app 2>&1 | grep Retention           # "Scheduler aktiv (3650-Tage-Frist ..."
```

---

## Notfall-Kontakte

- Server-Admin: (eintragen)
- Anwendungs-Owner: dimitri.riesen@fes-minden.de
- DMS-Support (Docubit): (eintragen)
- n8n-Instanz: https://n8n.fes-minden.de
