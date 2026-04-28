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

### Phase 5: Qualitätssicherung (QA-Review 27.03.2026)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 5.1 | ESLint + Prettier eingerichtet (eslint.config.js, .prettierrc) | ✅ | 2026-03-27 |
| 5.2 | Vitest Test-Framework + vitest.config.ts | ✅ | 2026-03-27 |
| 5.3 | 37 Unit-Tests (IBAN, VMA, Formatierung, Reisetage, km) | ✅ | 2026-03-27 |
| 5.4 | Accessibility: Skip-Link, aria-labels, scope auf Tabellen | ✅ | 2026-03-27 |
| 5.5 | Toast-Benachrichtigungen statt browser alert() | ✅ | 2026-03-27 |
| 5.6 | Datenverlust-Warnung (beforeunload) in beiden Formularen | ✅ | 2026-03-27 |
| 5.7 | Verpflegungstabelle responsiv (overflow-x-auto) | ✅ | 2026-03-27 |
| 5.8 | 404-Seite (NotFound.tsx + Catch-All Route) | ✅ | 2026-03-27 |
| 5.9 | Backend: Error-Details nicht mehr im Response exponiert | ✅ | 2026-03-27 |
| 5.10 | Backend: `as any` Casts entfernt (belegNummer, einreichungen, upload) | ✅ | 2026-03-27 |
| 5.11 | npm Scripts: lint, format, test | ✅ | 2026-03-27 |

#### Bekannte offene Punkte aus QA-Review (nicht kritisch für internes Netz):
- [ ] CI/CD-Pipeline (CI/ Ordner ist leer — GitHub Actions Workflow fehlt)
- [ ] PostgreSQL-Backups automatisieren
- [ ] Redis für Session-Persistenz (aktuell nur RAM — bei Restart weg)
- [ ] Admin-Route-Protection (PrivateRoute)
- [ ] E2E-Tests (Playwright/Cypress)
- [ ] Pauschalen aus DB laden statt hardcodiert im Frontend (vma.ts)
- [ ] Admin-Tab-State mit URL synchronisieren (/admin?tab=...)
- [ ] Weitere Accessibility: fieldset/legend bei Radio-Gruppen, aria-describedby bei Fehlern
- [ ] React Query/SWR für API-Caching
- [ ] Log-Rotation + Monitoring für Production

### Phase A: Kostenstellen-Sichtbarkeit pro Mandant + Vorgangstyp (28.04.2026)

| # | Aufgabe | Status |
|---|---|---|
| A.1 | Migration 0005: 3 Boolean-Spalten in `mandanten` (Default true) | ✅ |
| A.2 | `VORGANGSTYP_META` als Single Source of Truth in `lib/types.ts` | ✅ |
| A.3 | `MandantBase` + `MandantAdmin extends MandantBase` (Interface-Dedupe) | ✅ |
| A.4 | `istKstAn()`-Helper, `KST_DEFAULTS` aus META abgeleitet | ✅ |
| A.5 | `KstPills`-Component im AdminCenter (Read- + Edit-Mode) | ✅ |
| A.6 | `PersoenlicheDatenStep` rendert KST-Feld konditional, useEffect-Reset bei Flag-Wechsel | ✅ |
| A.7 | PDF-Service: KST-Zeile nur rendern wenn vorhanden | ✅ |
| A.8 | Optimistic Update + Toast-Migration (alert raus) | ✅ |
| A.9 | `useToast` in MandantenTab, KostenstellenTab, PauschalenTab | ✅ |
| A.10 | Optimistic Rollback via authoritative `loadMandanten()` bei Fehler | ✅ |

### Phase B: Fahrtkostensammelantrag (28.04.2026)

| # | Aufgabe | Status |
|---|---|---|
| B.1 | Migration 0006: `SAMMELFAHRT`-Enum, `fahrten`-Tabelle, ON DELETE CASCADE | ✅ |
| B.2 | Schema: `fahrten`-Drizzle-Tabelle exportiert | ✅ |
| B.3 | `belegNummer.ts`: SF-Praefix, Lock-Key year×10+3 | ✅ |
| B.4 | `kmSaetze.ts` Backend-Helper (Single Source) | ✅ |
| B.5 | `sammelfahrtBody`-Zod-Schema, min(2)/max(50) | ✅ |
| B.6 | Sammelfahrt-Branch in `einreichungen.ts` mit Server-Recompute | ✅ |
| B.7 | PDF-Layout `SAMMELFAHRT` (Anlass, Fahrten-Tabelle) | ✅ |
| B.8 | `erstelleSammelfahrtEmailText` | ✅ |
| B.9 | Frontend-Types `Fahrt`, `SammelfahrtFormData`, `SammelfahrtVerkehrsmittel` | ✅ |
| B.10 | Frontend `lib/sammelfahrt.ts` mit Helper-Funktionen | ✅ |
| B.11 | API-Funktion `einreichenSammelfahrt` | ✅ |
| B.12 | `FahrtenListe`-Component (Desktop-Tabelle / Mobile-Cards) | ✅ |
| B.13 | `SammelfahrtFormular` (3-Step Wizard) | ✅ |
| B.14 | Startseite mit dritter Karte (CREDO-Grau, MapPin) | ✅ |
| B.15 | Route `/sammelfahrt` in `main.tsx` | ✅ |
| B.16 | 15 neue Vitest-Tests in `sammelfahrt.test.ts` (52 gesamt) | ✅ |

### Haerten + Code-Review (28.04.2026)

| # | Aufgabe | Status |
|---|---|---|
| H.1 | Server-Recompute kmBetrag/vmaNetto/gesamtbetrag in allen 3 Branches | ✅ |
| H.2 | Bulk-Insert fuer alle 5 Kindrecord-Typen | ✅ |
| H.3 | `aktualisiereVersandStatus`-Helper mit awaited DB-Updates | ✅ |
| H.4 | finally-Reset `setSubmitting(false)` in allen 3 Wizards | ✅ |
| H.5 | `pdf.ts`: `} else if (data.typ === 'SAMMELFAHRT') {` (Compiler-Schutz) | ✅ |
| H.6 | Redundanter `useEffect` raus, `fahrtenMitBetrag` durchgereicht | ✅ |
| H.7 | FahrtenListe Mobile-Cards bis `lg:`, scrollable Tabelle, aria-labels | ✅ |
| H.8 | Focus-Ring auf Verkehrsmittel-Radio-Cards | ✅ |
| H.9 | helmet HSTS deaktiviert (Caddy uebernimmt in Production) | ✅ |
| H.10 | CSP erweitert um Google Fonts (`fonts.googleapis.com` + `fonts.gstatic.com`) | ✅ |

### Phase 7: GoLive

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 7.1 | DEPLOYMENT.md mit Schritt-fuer-Schritt-Anleitung | ✅ | 2026-04-28 |
| 7.2 | n8n WEBHOOK_DATENSTRUKTUR.md erweitert um Sammelfahrt | ✅ | 2026-04-28 |
| 7.3 | README.md aktualisiert | ✅ | 2026-04-28 |
| 7.4 | Lokaler Docker-Smoke-Test ueber `docker-compose.local.yml` | ✅ | 2026-04-28 |
| 7.5 | GitHub Push | ⏳ | |
| 7.6 | Production-Deployment auf finance.fes-credo.de | ⏳ | |

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
| 2026-03-27 | QA-Review: Sicherheitsfixes zurückgestellt | App nur intern erreichbar (Firewall) |
| 2026-03-27 | ESLint Flat Config (v9) statt .eslintrc | Zukunftssicher, empfohlen ab ESLint 9 |
| 2026-03-27 | Vitest statt Jest | Schneller, native ESM/Vite-Unterstützung |
| 2026-03-27 | Eigene Toast-Komponente statt Radix Toast | Leichtgewichtiger, keine Extra-Dependency |

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
├── eslint.config.js              # ESLint Flat Config (TS + React)
├── .prettierrc                   # Prettier Formatierung
├── vitest.config.ts              # Vitest Test-Konfiguration
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
│   │   │   ├── utils.ts          # Hilfsfunktionen (IBAN, Format)
│   │   │   ├── types.ts          # TypeScript-Typen
│   │   │   ├── __tests__/
│   │   │   │   ├── utils.test.ts # Tests: IBAN, Formatierung (14 Tests)
│   │   │   │   └── vma.test.ts   # Tests: VMA, Reisetage, km (23 Tests)
│   │   │   ├── hooks.ts          # useMandanten, useKostenstellen
│   │   │   ├── vma.ts            # VMA-Berechnungslogik
│   │   │   └── api.ts            # API-Calls (Upload + Submit)
│   │   ├── components/
│   │   │   ├── Layout.tsx        # Header + Footer + Skip-Link
│   │   │   ├── Toast.tsx         # Toast-Benachrichtigungen (Context + Provider)
│   │   │   └── forms/
│   │   │       ├── PersoenlicheDatenStep.tsx
│   │   │       ├── VerpflegungStep.tsx
│   │   │       └── BelegUpload.tsx
│   │   └── pages/
│   │       ├── Startseite.tsx    # Typenauswahl
│   │       ├── ReisekostenFormular.tsx  # 6-Step Wizard
│   │       ├── ErstattungFormular.tsx   # 3-Step Wizard
│   │       ├── Erfolg.tsx        # Belegnummer-Anzeige
│   │       ├── NotFound.tsx      # 404-Seite
│   │       └── AdminCenter.tsx   # 4-Tab Admin
```
