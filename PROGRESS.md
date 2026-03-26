# CREDO Finanzportal — Fortschrittsdokumentation

> **Projekt:** CREDO Finanzportal (Reisekosten + Kostenerstattungen)
> **Plan genehmigt:** 2026-03-21
> **Plan-Version:** 1.1

---

## Fortschritt nach Phase

### Phase 1: Foundation + CREDO CI (Wochen 1–3)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 1.1 | Projekt-Setup: Monorepo | ✅ | 2026-03-21 |
| 1.2 | Docker-Struktur (wie HR-Portal: single app + db) | ✅ | 2026-03-21 |
| 1.3 | docker-compose.yml + docker-compose.prod.yml | ✅ | 2026-03-21 |
| 1.4 | Unified Dockerfile (Frontend + Backend in 1 Container) | ✅ | 2026-03-21 |
| 1.5 | Backend: Express + TypeScript (Port 3000) | ✅ | 2026-03-21 |
| 1.6 | Datenbank-Schema (Drizzle ORM) — alle Tabellen | ✅ | 2026-03-21 |
| 1.7 | Seed-Daten (7 Mandanten, Kostenstellen, Pauschalen) | ✅ | 2026-03-21 |
| 1.8 | Frontend: React + Tailwind + CREDO CI Theme | ✅ | 2026-03-21 |
| 1.9 | Startseite: Typenauswahl (Reisekosten / Erstattung) | ✅ | 2026-03-21 |
| 1.10 | AdminCenter: 4 Tabs (Mandanten, Pauschalen, Versand, Protokoll) | ✅ | 2026-03-21 |

### Phase 2: Kernfunktion — Wizard-Formular (Wochen 4–7)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 2.1 | Reisekosten-Wizard (6 Steps) mit State + Validierung | ✅ | 2026-03-21 |
| 2.2 | Erstattungs-Wizard (3 Steps) mit Positionen + Summe | ✅ | 2026-03-21 |
| 2.3 | PersoenlicheDatenStep (Shared Component) | ✅ | 2026-03-21 |
| 2.4 | IBAN-Validierung + Formatierung | ✅ | 2026-03-21 |
| 2.5 | Mandanten-Dropdown (gruppiert, dynamisch) | ✅ | 2026-03-21 |
| 2.6 | Kostenstellen (dynamisch nach Mandantenwahl) | ✅ | 2026-03-21 |
| 2.7 | VMA-Berechnung (tagesweise, Mahlzeitenkürzung) | ✅ | 2026-03-21 |
| 2.8 | VerpflegungStep (Tagesansicht mit Checkboxen) | ✅ | 2026-03-21 |
| 2.9 | Kilometerpauschale (PKW/Motorrad, live) | ✅ | 2026-03-21 |
| 2.10 | BelegUpload (Drag & Drop, Validierung, Vorschau) | ✅ | 2026-03-21 |
| 2.11 | Zusammenfassung + Einreichen | ✅ | 2026-03-21 |
| 2.12 | Erfolgsseite mit Belegnummer | ✅ | 2026-03-21 |

### Phase 3+4: Backend-Pipeline (PDF + E-Mail)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 3.1 | Beleg-Upload Route (Multer, lokal) | ✅ | 2026-03-21 |
| 3.2 | Belegnummer-Generierung (RK-/KE-YYYY-NNNNN) | ✅ | 2026-03-21 |
| 3.3 | Einreichung DB-Speicherung (Reisekosten + Erstattung) | ✅ | 2026-03-21 |
| 3.4 | PDF-Generierung (Hauptdokument + Belege in einer PDF) | ✅ | 2026-03-21 |
| 3.5 | E-Mail-Versand an DMS (Nodemailer + Retry) | ✅ | 2026-03-21 |
| 3.6 | Frontend → API Anbindung (Upload + Submit) | ✅ | 2026-03-21 |
| 3.7 | Digitale Unterschrift (Canvas) | ⬚ Offen | | |
| 3.8 | QR-Code auf PDF | ⬚ Offen | | |

### Deployment-Vorbereitung

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| D.1 | `.dockerignore` erstellt | ✅ | 2026-03-21 |
| D.2 | `docker-entrypoint.sh` (Auto-Migration + Seed beim Start) | ✅ | 2026-03-21 |
| D.3 | Dockerfile umgebaut für npm Workspaces | ✅ | 2026-03-21 |
| D.4 | `.env.production` Template erstellt | ✅ | 2026-03-21 |
| D.5 | `deploy.sh` Deployment-Script | ✅ | 2026-03-21 |
| D.6 | `Caddyfile.example` für Reverse Proxy | ✅ | 2026-03-21 |
| D.7 | `.gitignore` erweitert (.env.production, uploads/) | ✅ | 2026-03-21 |
| D.8 | Git-Repository initialisiert + GitHub Push | ✅ | 2026-03-21 |
| D.9 | Docker-Build erfolgreich getestet | ✅ | 2026-03-21 |
| D.10 | TypeScript Build-Fehler gefixt (kostenstelleId, tsconfig) | ✅ | 2026-03-21 |

### Phase 5: Erweiterung
_Noch nicht gestartet_

### Phase 6: Testing & Go-Live
_Noch nicht gestartet_

---

## Entscheidungslog

| Datum | Entscheidung | Begründung |
|---|---|---|
| 2026-03-21 | Plan v1.1 genehmigt | Dimitri |
| 2026-03-21 | E-Mail-Versand direkt im Backend (n8n optional) | Weniger Abhängigkeiten |
| 2026-03-21 | Kein Login, reiner Self-Service | Internes Netz, maximale Einfachheit |
| 2026-03-21 | IBAN + Kontoinhaber pro Einreichung | Keine Stammdaten nötig |
| 2026-03-21 | Zwei Formularpfade: Reisekosten + Erstattung | Erstattungen = eigenes Kurzformular |
| 2026-03-21 | Docker-Struktur wie HR-Portal | Single app container, reverse_proxy + internal Netzwerk |
| 2026-03-21 | Lokale Uploads statt MinIO | Konsistent mit HR-Portal, uploads_data Volume |
| 2026-03-21 | Alle Dokumente in einer PDF an DMS | Hauptdokument + Belege = ein Anhang |
| 2026-03-21 | Deployment-Setup analog HR-Portal | Gleiche Docker/Caddy-Struktur |
| 2026-03-21 | Auto-Migration via docker-entrypoint.sh | Keine manuelle DB-Setup nötig |
| 2026-03-21 | GitHub: Penknife5550/CREDO_Fiinance_Portal | Zentrale Code-Verwaltung |

---

## Dateistruktur

```
Finance_Portal/
├── Dockerfile                    # Multi-Stage Build (npm Workspaces)
├── docker-compose.yml            # Base Config (app + db)
├── docker-compose.dev.yml        # Dev: nur DB (App läuft lokal)
├── docker-compose.prod.yml       # Prod (Caddy reverse_proxy)
├── docker-entrypoint.sh          # Auto-Migration + Seed + Start
├── deploy.sh                     # Deployment-Script (deploy/logs/stop/health)
├── Caddyfile.example             # Caddy-Konfiguration Vorlage
├── .dockerignore                 # Build-Context Optimierung
├── .env.example                  # Umgebungsvariablen-Template
├── .env.production               # Produktions-Geheimnisse (nicht committed)
├── package.json                  # Monorepo root (npm Workspaces)
├── PLAN.md                       # Implementierungsplan v1.1
├── PROGRESS.md                   # Diese Datei
│
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express Server (Port 3000)
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle ORM Schema
│   │   │   ├── index.ts          # DB-Verbindung
│   │   │   ├── migrate.ts        # Migrationen
│   │   │   └── seed.ts           # Testdaten
│   │   ├── routes/
│   │   │   ├── mandanten.ts      # GET aktive Mandanten
│   │   │   ├── kostenstellen.ts  # GET Kostenstellen pro Mandant
│   │   │   ├── einreichungen.ts  # POST Einreichung + Beleg-Upload
│   │   │   └── admin.ts          # CRUD Mandanten, Kostenstellen, Config
│   │   └── services/
│   │       ├── upload.ts         # Multer (lokaler Upload)
│   │       ├── belegNummer.ts    # RK-/KE-Nummern-Generator
│   │       ├── pdf.ts            # PDF-Generierung (pdf-lib + sharp)
│   │       └── email.ts          # E-Mail-Versand (Nodemailer + Retry)
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # React Router
│   │   ├── index.css             # Tailwind + CREDO CI
│   │   ├── lib/
│   │   │   ├── utils.ts          # Hilfsfunktionen
│   │   │   ├── types.ts          # TypeScript-Typen
│   │   │   ├── hooks.ts          # useMandanten, useKostenstellen
│   │   │   ├── vma.ts            # VMA-Berechnungslogik
│   │   │   └── api.ts            # API-Calls (Upload + Submit)
│   │   ├── components/
│   │   │   ├── Layout.tsx        # Header + Footer
│   │   │   └── forms/
│   │   │       ├── PersoenlicheDatenStep.tsx
│   │   │       ├── VerpflegungStep.tsx
│   │   │       └── BelegUpload.tsx
│   │   └── pages/
│   │       ├── Startseite.tsx    # Typenauswahl
│   │       ├── ReisekostenFormular.tsx  # 6-Step Wizard
│   │       ├── ErstattungFormular.tsx   # 3-Step Wizard
│   │       ├── Erfolg.tsx        # Belegnummer-Anzeige
│   │       └── AdminCenter.tsx   # 4-Tab Admin
```
