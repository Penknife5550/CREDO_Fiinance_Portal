# CREDO Finanzportal

Internes Self-Service-Portal fuer Reisekosten- und Kostenerstattungen der CREDO Gruppe (Freie Evangelische Schulen).

**Domain:** `finance.fes-credo.de`
**Repository:** `github.com/Penknife5550/CREDO_Fiinance_Portal`

---

## Uebersicht

Das Finanzportal ermoeglicht 400-1000 Mitarbeitenden die eigenstaendige Einreichung von:

- **Reisekosten** (6-Schritt-Wizard): Reisedaten, Verkehrsmittel, Verpflegungspauschalen (VMA), Belege, digitale Unterschrift
- **Kostenerstattungen** (3-Schritt-Wizard): Positionen mit Kategorien, Belege, Unterschrift

Eingereichte Formulare werden als PDF generiert und per E-Mail an das DMS (Docubit) gesendet.

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
│       │   ├── Startseite.tsx      # Typenauswahl
│       │   ├── ReisekostenFormular.tsx  # 6-Step Wizard
│       │   ├── ErstattungFormular.tsx   # 3-Step Wizard
│       │   ├── Erfolg.tsx          # Bestaetigung
│       │   └── AdminCenter.tsx     # 4-Tab Admin
│       ├── components/forms/       # Shared Form-Komponenten
│       └── lib/                    # API, Typen, VMA-Berechnung
│
├── Dockerfile                      # Multi-Stage Build
├── docker-compose.prod.yml         # Produktion
├── docker-compose.dev.yml          # Entwicklung (nur DB)
├── docker-entrypoint.sh            # Auto-Migration + Start
├── deploy.sh                       # Deployment-Script
├── Caddyfile.example               # Caddy-Konfiguration
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
| `POST` | `/api/einreichungen/reisekosten` | Reisekosten einreichen |
| `POST` | `/api/einreichungen/erstattung` | Erstattung einreichen |

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

12 Tabellen mit PostgreSQL 16 + Drizzle ORM:

| Tabelle | Beschreibung |
|---|---|
| `mandanten` | CREDO-Einrichtungen (7 Schulen/Verwaltung) |
| `kostenstellen` | Kostenstellen pro Mandant |
| `einreichungen` | Haupttabelle (Reisekosten + Erstattungen) |
| `reisetage` | Tageseintraege fuer VMA-Berechnung |
| `positionen` | Einzelpositionen bei Erstattungen |
| `belege` | Hochgeladene Nachweise (Dateien) |
| `weitere_kosten` | Zusatzkosten bei Reisen |
| `pauschalen` | Kilometerpauschalen, VMA-Saetze |
| `email_config` | SMTP-/MS365-Konfiguration |
| `webhook_config` | Webhook-Integration |
| `admins` | Admin-Konten |
| `audit_log` | GoBD-konformes Protokoll |

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

## Offene Punkte

- [ ] Digitale Unterschrift (Canvas-Komponente)
- [ ] QR-Code auf generierter PDF
- [ ] Phase 5: Erweiterte Features (Dreimonatsfrist, Auslandspauschalen)
- [ ] Phase 6: End-to-End Testing + Go-Live
