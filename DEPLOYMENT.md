# DEPLOYMENT — CREDO Finanzportal

GoLive-Schritte fuer Produktion (`finance.fes-credo.de`).

---

## 1. Voraussetzungen

- Server mit Docker + Docker Compose v2
- Bestehende Caddy-Instanz mit externem Netzwerk `reverse_proxy`
- DNS: `finance.fes-credo.de` → Server-IP
- n8n-Instanz erreichbar (z.B. `https://n8n.fes-minden.de`) mit zwei Webhooks (Reisekosten + Erstattung + Sammelfahrt — siehe Punkt 7)

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
| `MAIL_FROM_NAME` | `CREDO Finanzportal` |
| `MAIL_FROM_EMAIL` | `finanzportal@credo.de` |
| `ADMIN_INITIAL_PASSWORD` | Initial-Passwort, **muss nach erstem Login geaendert werden** |
| `APP_URL` | `https://finance.fes-credo.de` |

SMTP-Felder (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) bleiben Platzhalter, solange Versand ueber Webhook + n8n laeuft.

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

**Migrationen 0000–0006 laufen idempotent.** Migration `0006_sammelfahrt.sql` enthaelt `ALTER TYPE ADD VALUE IF NOT EXISTS` — funktioniert mit PostgreSQL ≥ 12 (Repo nutzt 16).

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

## 7. n8n-Webhook(s) einrichten

Versandmethode steht per Default auf `WEBHOOK`. Fuer jeden Vorgangstyp (Reisekosten, Erstattung, Sammelfahrt) einen n8n-Workflow vorbereiten oder pro Typ einen einzigen mit Filter.

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

1. https://finance.fes-credo.de oeffnen → 3 Karten sichtbar
2. **Reisekostenabrechnung** einreichen (1 Tag, PKW 50 km, 1 Beleg) → Erfolgsseite mit `RK-2026-00001`
3. **Kostenerstattung** einreichen (1 Position, 1 Beleg) → `KE-2026-00001`
4. **Sammelfahrt** einreichen (3 Fahrten, PKW) → `SF-2026-00001`
5. Pruefen: drei E-Mails im DMS angekommen, jeweils mit PDF-Anhang

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

## Notfall-Kontakte

- Server-Admin: (eintragen)
- Anwendungs-Owner: dimitri.riesen@fes-minden.de
- DMS-Support (Docubit): (eintragen)
- n8n-Instanz: https://n8n.fes-minden.de
