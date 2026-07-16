# CREDO Finanzportal

Internes Self-Service-Portal fuer Reisekosten- und Kostenerstattungen der CREDO Gruppe (Freie Evangelische Schulen).

**Domain:** `finance.fes-credo.de`
**Repository:** `github.com/Penknife5550/CREDO_Fiinance_Portal`

---

## Uebersicht

Das Finanzportal ermoeglicht 400-1000 Mitarbeitenden die eigenstaendige Einreichung von:

- **Reisekosten** (6-Schritt-Wizard): Reisedaten, Verkehrsmittel, Verpflegungspauschalen (VMA), Belege, digitale Unterschrift
- **Kostenerstattungen** (3-Schritt-Wizard): Positionen mit Kategorien, Belege, Unterschrift
- **Fahrtkosten-Sammelantraege** (3-Schritt-Wizard): Mehrere Einzelfahrten in einem Antrag — nur Kilometerpauschale, ohne VMA. Fuer Mitarbeiter, die regelmaessig zu Praktikumsbesuchen, Aussenterminen o.ae. fahren
- **Klassenfahrt-Abrechnungen** (Wizard, nur Mandant 40 / Förderverein): Zuschuss-Verteilung je Klasse mit eigenem Auszahlungskonto, Kostenaufteilung (proportional oder direkt), Belege, Unterschrift

Eingereichte Formulare werden als PDF generiert und **direkt per SMTP** an das DMS (Docubit) zugestellt (Default-Versandweg). Alternativ kann der Versand im AdminCenter auf **Webhook/n8n** umgestellt werden.

---

## Architektur

```
Browser → Caddy (SSL) → Express (Port 3000) → PostgreSQL
                              ↓
                         PDF-Generierung
                              ↓
                     E-Mail an DMS (SMTP)
```

| Komponente | Technologie |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS, Radix UI |
| Backend | Express 5, TypeScript, Node.js 22 |
| Datenbank | PostgreSQL 16 (Drizzle ORM) |
| PDF | pdf-lib + sharp |
| E-Mail | Nodemailer (SMTP) |
| Container | Docker (Multi-Stage Build) |
| Reverse Proxy | Caddy (extern, automatisches SSL) |

---

## Projektstruktur

```
Finance_Portal/
├── backend/
│   └── src/
│       ├── index.ts                # Express Server
│       ├── config/env.ts           # Umgebungsvariablen (Zod)
│       ├── db/
│       │   ├── schema.ts           # 12 Tabellen (Drizzle ORM)
│       │   ├── migrate.ts          # Migrationen
│       │   └── seed.ts             # Stammdaten (7 Mandanten, Pauschalen)
│       ├── middleware/
│       │   └── adminAuth.ts        # Token-basierte Admin-Auth
│       ├── routes/
│       │   ├── einreichungen.ts    # Einreichungen + Beleg-Upload
│       │   ├── mandanten.ts        # Mandanten-API
│       │   ├── kostenstellen.ts    # Kostenstellen-API
│       │   ├── pauschalen.ts       # Pauschalen-API
│       │   └── admin.ts            # Admin-CRUD
│       └── services/
│           ├── pdf.ts              # PDF-Generierung
│           ├── email.ts            # E-Mail + Retry-Logik
│           ├── belegNummer.ts      # RK-/KE-YYYY-NNNNN
│           └── upload.ts           # Multer (lokaler Upload)
│
├── frontend/
│   └── src/
│       ├── main.tsx                # React Router
│       ├── pages/
│       │   ├── Startseite.tsx      # Typenauswahl (4 Karten)
│       │   ├── ReisekostenFormular.tsx   # 6-Step Wizard
│       │   ├── ErstattungFormular.tsx    # 3-Step Wizard
│       │   ├── SammelfahrtFormular.tsx   # 3-Step Wizard (km-Pauschale)
│       │   ├── KlassenfahrtFormular.tsx  # Wizard (nur Mandant 40)
│       │   ├── Erfolg.tsx          # Bestaetigung
│       │   └── AdminCenter.tsx     # 5-Tab Admin
│       ├── components/forms/       # PersoenlicheDaten, VerpflegungStep, FahrtenListe, BelegUpload, SignaturPad
│       └── lib/                    # API, Typen, VMA + Sammelfahrt-Berechnung
│
├── Dockerfile                      # Multi-Stage Build
├── docker-compose.prod.yml         # Produktion (hinter Caddy)
├── docker-compose.dev.yml          # Entwicklung (nur DB)
├── docker-compose.local.yml        # Lokaler Voll-Stack-Test (Port direkt exponiert)
├── docker-entrypoint.sh            # Auto-Migration + Start
├── deploy.sh                       # Deployment-Script
├── Caddyfile.example               # Caddy-Konfiguration
├── DEPLOYMENT.md                   # GoLive-Schritte
├── .env.example                    # Umgebungsvariablen-Template
└── .env.production                 # Produktions-Geheimnisse (nicht committed)
```

---

## Lokale Entwicklung

### Voraussetzungen

- Node.js 22+
- Docker (fuer PostgreSQL)

### Setup

```bash
# Dependencies installieren
npm install

# Datenbank starten
docker compose -f docker-compose.dev.yml up -d

# Datenbank migrieren + Seed-Daten
DATABASE_URL="postgresql://credo:credo_dev_2026@localhost:5432/finanzportal" npm run db:migrate
DATABASE_URL="postgresql://credo:credo_dev_2026@localhost:5432/finanzportal" npm run db:seed

# App starten (Backend :3001, Frontend :3000)
npm run dev
```

### Einzeln starten

```bash
npm run dev:backend     # Backend auf Port 3001
npm run dev:frontend    # Frontend auf Port 3000 (Proxy → 3001)
```

### Admin-Zugang (lokal)

- URL: `http://localhost:3000/admin`
- E-Mail: `admin@credo.de`
- Passwort: `admin123` (oder ADMIN_INITIAL_PASSWORD aus .env)

---

## Produktion

### Voraussetzungen

- Server mit Docker + Docker Compose
- Caddy Reverse Proxy mit externem Netzwerk `reverse_proxy`
- DNS: `finance.fes-credo.de` zeigt auf den Server

### 1. Repository klonen

```bash
git clone https://github.com/Penknife5550/CREDO_Fiinance_Portal.git
cd CREDO_Fiinance_Portal
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env.production
```

Alle Werte in `.env.production` anpassen:

| Variable | Beschreibung | Beispiel |
|---|---|---|
| `DB_PASSWORD` | PostgreSQL-Passwort (stark!) | `kF9$mP2xQ...` |
| `ENCRYPTION_KEY` | 32 Zeichen fuer AES-256 | `a1B2c3D4e5F6g7H8...` |
| `SMTP_HOST` | SMTP-Server | `smtp.office365.com` |
| `SMTP_PORT` | SMTP-Port | `587` |
| `SMTP_USER` | SMTP-Benutzername | `finanzportal@credo.de` |
| `SMTP_PASS` | SMTP-Passwort | `...` |
| `MAIL_FROM_NAME` | Absendername | `CREDO Finanzportal` |
| `MAIL_FROM_EMAIL` | Absender-E-Mail | `finanzportal@credo.de` |
| `ADMIN_INITIAL_PASSWORD` | Admin-Passwort | `...` |
| `APP_URL` | Oeffentliche URL | `https://finance.fes-credo.de` |

### 3. Caddy konfigurieren

Den folgenden Block in die bestehende Caddyfile einfuegen (neben `hr.fes-credo.de`):

```
finance.fes-credo.de {
    reverse_proxy credo-finanz-app:3000
}
```

Caddy neu laden:

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### 4. Deployment

```bash
./deploy.sh
```

Das Script:
1. Prueft ob `.env.production` existiert und keine Platzhalter enthaelt
2. Baut das Docker-Image (Multi-Stage: Frontend + Backend)
3. Startet die Container (App + PostgreSQL)
4. Fuehrt automatisch DB-Migrationen + Seed aus
5. Prueft den Health-Check

### Deploy-Script Befehle

```bash
./deploy.sh              # Bauen + Starten
./deploy.sh logs         # Live-Logs anzeigen
./deploy.sh stop         # Container stoppen
./deploy.sh restart      # Neustart (ohne Neubauen)
./deploy.sh health       # Status + Health-Check
```

---

## Docker-Architektur

### Container

| Container | Image | Port | Netzwerk |
|---|---|---|---|
| `credo-finanz-app` | Multi-Stage Build | 3000 (intern) | `reverse_proxy` + `internal` |
| `credo-finanz-db` | postgres:16-alpine | 5432 (intern) | `internal` |

### Volumes

| Volume | Zweck |
|---|---|
| `postgres_data` | Datenbank-Persistenz |
| `uploads_data` | Hochgeladene Belege |

### Netzwerke

| Netzwerk | Typ | Zweck |
|---|---|---|
| `reverse_proxy` | extern | Caddy → App |
| `internal` | intern | App → DB (kein externer Zugriff) |

### Startup-Reihenfolge

```
1. PostgreSQL startet + Health-Check (pg_isready)
2. App wartet auf gesunde DB (depends_on: condition: service_healthy)
3. docker-entrypoint.sh:
   a. Migrationen ausfuehren (Drizzle)
   b. Seed-Daten pruefen (idempotent)
   c. Express-Server starten (Port 3000)
4. App Health-Check (wget → http://localhost:3000/)
```

---

## API-Endpunkte

### Oeffentlich (kein Login)

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/health` | Health-Check |
| `GET` | `/api/mandanten` | Aktive Mandanten |
| `GET` | `/api/kostenstellen?mandantId=...` | Kostenstellen pro Mandant |
| `GET` | `/api/pauschalen?datum=...` | Pauschalen fuer Datum |
| `POST` | `/api/einreichungen/belege` | Beleg-Upload (Rate-Limited) |
| `POST` | `/api/einreichungen` | Einreichung (typ: `REISEKOSTEN` / `ERSTATTUNG` / `SAMMELFAHRT` / `KLASSENFAHRT`) |

### Admin (Token erforderlich)

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/api/admin/login` | Anmeldung (Rate-Limited: 5/15min) |
| `POST` | `/api/admin/logout` | Abmeldung |
| `GET` | `/api/admin/check` | Session pruefen |
| `GET/POST/PUT/DELETE` | `/api/admin/*` | CRUD fuer Mandanten, Kostenstellen, Config |

### Rate-Limiting

| Endpunkt | Limit |
|---|---|
| Login | 5 Versuche / 15 Minuten |
| Upload | 20 Uploads / 15 Minuten |
| Allgemeine API | 100 Anfragen / 15 Minuten |

---

## Sicherheit

- **Helmet.js** mit Content Security Policy (CSP)
- **CORS** beschraenkt auf `APP_URL`
- **Rate-Limiting** auf Login, Upload und allgemeine API
- **bcrypt** (Kostenfaktor 12) fuer Admin-Passwoerter
- **Zod-Validierung** fuer alle Eingaben + Umgebungsvariablen
- **Path-Traversal-Schutz** bei Beleg-Uploads
- **SHA-256 Hashes** fuer hochgeladene Dateien
- **Audit-Log** (GoBD-konform) fuer alle Admin-Aktionen
- **Internes Netzwerk** — DB nicht von aussen erreichbar

---

## Datenbank-Schema

20 Tabellen mit PostgreSQL 16 + Drizzle ORM (Auszug):

| Tabelle | Beschreibung |
|---|---|
| `mandanten` | CREDO-Einrichtungen (7 Schulen/Verwaltung), inkl. KST-Sichtbarkeits-Flags pro Vorgangstyp |
| `kostenstellen` | Kostenstellen pro Mandant |
| `einreichungen` | Haupttabelle (Reisekosten + Erstattungen + Sammelfahrt + Klassenfahrt) |
| `reisetage` | Tageseintraege fuer VMA-Berechnung (nur Reisekosten) |
| `positionen` | Einzelpositionen bei Erstattungen |
| `erstattung_kategorien` | Konfigurierbare Erstattungs-Kategorien pro Mandant (ersetzt festes Enum) |
| `fahrten` | Einzelfahrten bei Sammelantraegen (mit ON DELETE CASCADE) |
| `klassenfahrt_klassen` | Klassen je Klassenfahrt (Konto + Zuschuss pro Klasse) |
| `klassenfahrt_kostenzeilen` | Kostenzeilen je Klassenfahrt (proportional/direkt) |
| `klassenfahrt_kostenzeile_anteil` | Betragsanteile je Klasse bei direkter Verteilung |
| `belege` | Hochgeladene Nachweise (Dateien) |
| `weitere_kosten` | Zusatzkosten bei Reisen |
| `pauschalen` | Kilometerpauschalen, VMA-Saetze (Inland) |
| `pauschalen_ausland` | Auslands-Tagessaetze (24h) je Land |
| `beleg_counter` | Atomarer Belegnummern-Zähler je (Typ, Jahr) — race-frei |
| `email_config` | SMTP-/Webhook-Konfiguration |
| `email_log` | Versandprotokoll je Zustellversuch (SMTP + Webhook, IKS) |
| `webhook_config` | Webhook-Endpunkte (n8n, optional) |
| `admins` | Admin-Konten |
| `audit_log` | GoBD-konformes Protokoll |

### Migrationen (Drizzle)

| # | Tag | Inhalt |
|---|---|---|
| 0000 | exotic_tony_stark | Initiales Schema |
| 0001 | webhook_auth | Webhook BASIC/HEADER Auth-Felder |
| 0002 | webhook_typ_filter | Webhook-Filter pro Vorgangstyp |
| 0003 | kostenstelle_nullable | `kostenstelle_id` optional |
| 0004 | versand_methode_webhook | (historisch) Default WEBHOOK — inzwischen wieder SMTP (0010) |
| 0005 | kostenstelle_anzeige | KST-Sichtbarkeits-Flags pro Vorgangstyp |
| 0006 | sammelfahrt | Sammelfahrt-Enum + `fahrten`-Tabelle + Cascade-Deletes |
| 0007 | add_indexes_and_cascade | Performance-Indizes + Cascade-Härtung |
| 0008 | pauschalen_ausland | Auslands-Tagessätze-Tabelle |
| 0009 | erstattung_kategorien | Konfigurierbare Erstattungs-Kategorien pro Mandant |
| 0010 | smtp_email_log | SMTP als Default-Versand + `email_log` (MS365 entfernt) |
| 0011 | klassenfahrt | Klassenfahrt-Tabellen + `KLASSENFAHRT`-Enum + Idempotenz-Key |
| 0012 | beleg_counter | Atomarer Belegnummern-Zähler (race-frei) |

---

## Mandanten (Seed-Daten)

| Nr | Name | Kategorie | DMS-E-Mail |
|---|---|---|---|
| 10 | Grundschule Haddenhausen | Grundschulen | fibu-gs-haddenhausen@docubit.credo.de |
| 11 | Grundschule Stemwede | Grundschulen | fibu-gs-stemwede@docubit.credo.de |
| 12 | Grundschule Minderheide | Grundschulen | fibu-gs-minderheide@docubit.credo.de |
| 30 | Gesamtschule | Weiterfuehrende Schulen | fibu-gesamtschule@docubit.credo.de |
| 31 | Gymnasium | Weiterfuehrende Schulen | fibu-gymnasium@docubit.credo.de |
| 32 | Berufskolleg | Weiterfuehrende Schulen | fibu-berufskolleg@docubit.credo.de |
| 40 | CREDO Verwaltung | Verwaltung | fibu-verwaltung@docubit.credo.de |

---

## Status

- [x] Phase 1-4: Foundation, Wizards, PDF, E-Mail-Pipeline
- [x] Phase 5: QA-Review, ESLint/Prettier, Unit-Tests, Accessibility, Toasts
- [x] Phase A: Kostenstellen-Sichtbarkeit pro Mandant + Vorgangstyp (Migration 0005)
- [x] Phase B: Fahrtkostensammelantrag als 3. Vorgangstyp (Migration 0006)
- [x] Teil 1: Konfigurierbare Erstattungs-Kategorien pro Mandant (Migration 0009)
- [x] Teil 2: SMTP als primärer Versandweg + Versandprotokoll `email_log` (Migration 0010)
- [x] Teil 3: Klassenfahrt-Abrechnung (nur Mandant 40) — Wizard, PDF mit Auszahlungstabelle + Kostenaufteilungsmatrix, DIREKT-Verteilung mit Auto-Rest (Migration 0011)
- [x] Audit-Härtung: race-freie Belegnummern (0012), server-autoritative VMA-Neuberechnung, PDF-vor-Commit in **einer** DB-Transaktion (RK/KE/SF/KF), Anhang-Größencheck
- [x] Server-Recompute aller Auszahlungsbetraege (kein Trust auf Client-Werte)
- [x] Bulk-Inserts fuer Kindrecords + ON DELETE CASCADE
- [x] 100 Backend-Unit-Tests grün (inkl. VMA, Klassenfahrt-Golden-Master, email-utils)

### Backlog

- [ ] 90-Tage-Löschjob (DSGVO): abgelaufene Vorgänge inkl. Belege/PDF automatisch entfernen
- [ ] Frontend km-Saetze zentralisieren (Backend-Pendant existiert bereits)
- [ ] WizardLayout-Component (Duplikat in den Wizards)
- [ ] React Testing Library (Frontend-Test-Setup)
- [ ] PostgreSQL-Backups automatisieren
- [ ] CI/CD-Pipeline (GitHub Actions)
