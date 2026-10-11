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

#### Bekannte Lücke (entdeckt 11.05.2026)

- **`land`-Feld nicht im Webhook-Payload**: Bei einer Reisekosten-Auslandsabrechnung speichert das Backend das gewählte Land (z.B. „Frankreich — Paris") in der DB (`einreichungen.ts:202`), gibt es aber nicht im Webhook-`webhookData` weiter (`einreichungen.ts:291–312`). Die DMS-E-Mail enthält daher keinen Hinweis auf Auslandsreise. Buchhaltung sieht nur „Reiseziel: Paris" — nicht „Frankreich — Paris (Tagessatz 53 €/8h, 36 €)".
  - **Fix-Skizze:** `land: parsed.land || null` in `webhookData` aufnehmen + `WebhookEinreichungData`-Type erweitern + `HTML Reisekosten`-Node im n8n-Workflow um Auslandshinweis ergänzen. ~20 min, ein Commit.
  - **Status:** im Backlog, kein akuter Bug — PDF-Anhang enthält die Info.

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

### Phase 9: Komma-Eingabe in Dezimal-Feldern (07.05.2026)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 9.1 | Bug: In allen 4 Dezimal-Inputs (Erstattung Betrag, RK kmGefahren, RK Weitere Kosten, SF km Desktop+Mobile) konnte kein Komma eingegeben werden | ✅ | 2026-05-07 |
| 9.2 | Ursache: controlled input + Number-State — `parseGermanDecimal("66,")` = 66, render `"66"` löschte das gerade getippte Komma sofort wieder | ✅ | 2026-05-07 |
| 9.3 | Neue Komponente `frontend/src/components/forms/DezimalInput.tsx` mit lokalem String-State + Focus-Tracking | ✅ | 2026-05-07 |
| 9.4 | Eingesetzt in `ErstattungFormular.tsx`, `ReisekostenFormular.tsx` (2x), `FahrtenListe.tsx` (Desktop + Mobile) | ✅ | 2026-05-07 |

### Phase 12: Auslandspauschalen DB-gepflegt im AdminCenter (09.05.2026)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 12.1 | DB-Schema: dedizierte `pauschalen_ausland`-Tabelle (eine Row pro Land/Stadt-Variante mit `landKey`, `tagessatz_24h/8h`, `uebernachtung`, `reihenfolge`) | ✅ | 2026-05-09 |
| 12.2 | Migration `0008_pauschalen_ausland.sql` mit Initial-INSERT der 19 BMF-2026-Werte (Belgien, Dänemark, Frankreich/Paris, GB/London, Italien/Rom, Luxemburg, Niederlande, Österreich, Polen, Schweiz/Genf, Spanien/Barcelona/Madrid, Tschechien, USA) | ✅ | 2026-05-09 |
| 12.3 | Public-Endpoint `GET /api/pauschalen/ausland` für Reisekosten-Wizard | ✅ | 2026-05-09 |
| 12.4 | Admin-Endpoints `GET/POST/PUT/DELETE /api/admin/pauschalen-ausland[/:landKey]` mit Zod-Validation | ✅ | 2026-05-09 |
| 12.5 | Frontend-Hook `useAuslandsPauschalen` (analog `useMandanten`) — liefert sowohl Liste als auch Lookup-Map | ✅ | 2026-05-09 |
| 12.6 | ReisekostenFormular umgestellt: nutzt Hook statt Code-Konstante `AUSLANDSPAUSCHALEN`. Konstante in `vma.ts` bleibt als Default-Seed-Quelle für Tests/Fallback — **überholt (Phase 17):** Konstante (falsche Werte) entfernt, Sätze nur noch aus der DB | ✅ | 2026-05-09 |
| 12.7 | AdminCenter PauschalenTab: editierbare Liste mit Inline-Editor pro Zeile (24h/8h/Übernachtung/Reihenfolge), Plus-Button für neuen Eintrag, Delete pro Eintrag, optimistic-via-reload | ✅ | 2026-05-09 |
| 12.8 | Hinweis-Box im Tab klarer formuliert: "Inland im Code, Ausland in der Datenbank" | ✅ | 2026-05-09 |

**Was sich für Admins ändert:** Bei neuem BMF-Schreiben (Dezember jährlich) Werte direkt im AdminCenter unter „Pauschalen → Auslandspauschalen" editieren — kein Code-Deploy mehr nötig. Bestehender Reisekosten-Wizard zieht die Werte beim nächsten Aufruf aus der DB.

**Bewusst NICHT umgesetzt:** Inland-Pauschalen (PKW/Motorrad/VMA) bleiben im Code — sie ändern sich praktisch nie (14/28 € seit 2020 unverändert, km-Pauschale 0,30 € seit 1991). Eine DB-Migration dort wäre Over-Engineering ohne Nutzen.

**Verifikation:** Frontend-tsc grün, Backend-tsc grün, Vitest 104/104 grün.

### Phase 13: Konfigurierbare Erstattungs-Kategorien pro Mandant (13.07.2026)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 13.1 | DB: neue Tabelle `erstattung_kategorien` (`mandantId` FK, `key`, `label`, `reihenfolge`, `active`) + Unique-Index (mandant_id, key) | ✅ | 2026-07-13 |
| 13.2 | Migration `0009_erstattung_kategorien.sql`: Spalte `positionen.kategorie` von pgEnum → varchar(50) (Bestandswerte bleiben), `DROP TYPE erstattung_kategorie`, Seed der 6 Standards für alle Mandanten + „Schulleiterbudget" für M40 | ✅ | 2026-07-13 |
| 13.3 | Öffentlicher Endpoint `GET /api/kategorien/:mandantId` (aktive Kategorien, nach `reihenfolge`) für den Erstattungs-Wizard | ✅ | 2026-07-13 |
| 13.4 | Admin-CRUD `GET/POST/PUT/DELETE /api/admin/kategorien` (Key wird serverseitig aus Bezeichnung abgeleitet, bleibt stabil; 409 bei Duplikat) | ✅ | 2026-07-13 |
| 13.5 | Einreichungs-Validierung: statisches Zod-Enum → dynamische Prüfung gegen die Mandanten-Kategorien (Fallback auf Standards) | ✅ | 2026-07-13 |
| 13.6 | Frontend-Hook `useKategorien(mandantId)` (analog `useKostenstellen`); `ErstattungFormular` lädt Dropdown dynamisch, Fallback auf 6 Standards | ✅ | 2026-07-13 |
| 13.7 | AdminCenter: neuer Tab „Kategorien" mit Mandant-Auswahl + Inline-Row-Editor (Anlegen/Bearbeiten/Ein-Ausblenden/Löschen) | ✅ | 2026-07-13 |
| 13.8 | Seed `seed.ts` seedet Kategorien idempotent (deckt frische Installationen ab, da Mandanten dort erst nach den Migrationen entstehen) | ✅ | 2026-07-13 |

**Was sich für Admins ändert:** Kategorien der Kostenerstattung sind jetzt pro Mandant im AdminCenter unter „Kategorien" pflegbar (kein Code-Deploy mehr). Mandant 40 (Förderverein) hat zusätzlich „Schulleiterbudget".

**Bewusst so gelöst:** Die Kategorie-Spalte bleibt der interne `key` (z.B. `SCHULLEITERBUDGET`); die Anzeige nutzt das `label`. Bestehende Positionen behalten ihre gespeicherte Kategorie. Migration ist rückwärtskompatibel (gleiche Enum-Werte als Strings).

**Verifikation:** Backend-tsc grün, Frontend-tsc grün, Vitest 104/104 grün, ESLint 0 Fehler. Migration gegen echte DB steht noch aus (Docker lokal nicht gestartet) — läuft beim nächsten `npm run db:migrate` / Deploy.

### Phase 14: Eigener SMTP-Versand statt n8n — Teil 2 (14.07.2026)

Ziel: SMTP wird der primäre (und einzige reguläre) Versandweg; n8n/Webhook bleibt nur optionaler Notnagel. Zuvor war die AdminCenter-`email_config` eine Fassade — `email.ts` las ausschließlich ENV.

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 14.1 | `email.ts` DB-getrieben: liest `email_config` (ENV nur Fallback), Passwort via `crypto.ts` entschlüsselt; gecachter Pool-Transporter mit harten Timeouts; Pure-Helper in `services/email-utils.ts` (testbar) | ✅ | 2026-07-14 |
| 14.2 | TLS-Härtung: `rejectUnauthorized` standardmäßig streng, `requireTLS` bei Port ≠ 465, Abschwächung nur via `SMTP_ALLOW_SELF_SIGNED`; env-Validierung (`SMTP_PORT`, `MAIL_FROM_*`) | ✅ | 2026-07-14 |
| 14.3 | Admin-`PUT /email-config` persistiert **alle** SMTP-Felder (Passwort verschlüsselt, `'***'`-Sentinel); `POST /email-config/test` (Verbindungstest) | ✅ | 2026-07-14 |
| 14.4 | Neue Tabelle `email_log` (Versandprotokoll SENT/FAILED/SKIPPED, Kanal-übergreifend) + Migration `0010_smtp_email_log`; Admin `GET /email-log` | ✅ | 2026-07-14 |
| 14.5 | Manueller Requeue: `GET /versand/fehlgeschlagen` (frische in-flight-`AUSSTEHEND` < 10 min ausgeschlossen) + `POST /einreichungen/:id/resend` (atomarer CAS-Claim, kanalbewusst) | ✅ | 2026-07-14 |
| 14.6 | `fehlerEmail`-Alarm bei endgültigem Fehler, Status-Guard (GESENDET nicht überschreibbar), Attachment-Größenlimit (25 MB, base64-bewusst) | ✅ | 2026-07-14 |
| 14.7 | MS365 (toter Code) aus Enum/UI entfernt (Legacy → SMTP migriert); Frontend `VersandTab` voll verdrahtet inkl. Cutover-Sicherung (SMTP vorab konfigurier-/testbar) | ✅ | 2026-07-14 |
| 14.8 | Adversariale 4-Linsen-Prüfung (7/7 bestätigt) → Fixes: Requeue-Race, kanal-blinder Requeue, Cutover-Falle, TLS-Default | ✅ | 2026-07-14 |
| 14.9 | `/code-review`-Fixes: `sendeWebhook` liefert Zustell-Bilanz (kein Falsch-„gesendet"), permanente Fehler brechen Retry ab; **Seed-Default `versandMethode` → SMTP** | ✅ | 2026-07-14 |

**Verifikation:** Backend+Frontend-tsc grün, 132 Vitest, ESLint 0 Fehler. Commits `cfa5beb`, `f9872f4`.

**Offen:** Prod-DB steht noch auf `WEBHOOK` (Migration 0004) → im AdminCenter auf SMTP umschalten (Config + Test zuerst). Retention/Löschjob für `email_log` (Klarnamen im Betreff) — mit dem Teil-3-Löschjob koppeln.

### Phase 15: Klassenfahrt-Abrechnung — Teil 3 (abgeschlossen 15.07.2026, ab 14.07.2026)

Neuer Vorgangstyp `KLASSENFAHRT` (nur Mandant 40 = Christlicher Schulverein Minden e.V.). Lehrkräfte rechnen ab; berechnet wird der **FV-Zuschuss je Klasse** (= 1 Personen-Quote), Auszahlung getrennt je Klassenkonto.

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 15.1 | Plandokument (CREDO-CI-Artifact, Mockups + durchgerechnetes Beispiel) + adversariale Lückenprüfung gegen echten Code (40/40 Befunde bestätigt) | ✅ | 2026-07-14 |
| 15.2 | Berechnungsmodul `backend/src/lib/klassenfahrt.ts` (proportional/direkt, Zuschuss = K/(S+B) je Klasse cent-gerundet ≥ 0, Div-0-Guard) + **Golden-Master** gegen 3 Excel-Dateien (**281,80 €**) | ✅ | 2026-07-14 |
| 15.3 | DB-Fundament: `KLASSENFAHRT`-Enum + Migration `0011_klassenfahrt`; Tabellen `klassenfahrt_klassen`/`_kostenzeilen`/`_kostenzeile_anteil`; `bank_iban/bank_kontoinhaber` nullable; `idempotenz_key` (unique); belegNummer `KF`/Offset 4 | ✅ | 2026-07-14 |
| 15.4 | KF-PDF-Renderer `erstelleKlassenfahrtPdf` (Deckblatt: DMS-QR, Eckdaten, Auszahlungstabelle je Konto, Zeichnungsfelder Geprüft/Freigegeben/Überwiesen) + Muster `MUSTER_Klassenfahrt_KF-2026-00001.pdf`; Belege-Einbettung in gemeinsamen Helfer extrahiert | ✅ | 2026-07-15 |
| 15.5 | **Backend-Route:** KF-Branch in `einreichungen.ts` — M40-Gate (mandantNr 40 serverseitig aufgelöst), Server-Recompute über das Modul (Inputs cent-normalisiert), Idempotenz (Vorprüfung + Unique-Index-Guard), **PDF vor dem Commit** → Multi-Tabellen-Insert in einer Transaktion (Kopf+Klassen+Kostenzeilen+Anteile+Belege), Beleg-Pflicht serverseitig; `erstelleKlassenfahrtEmailText` | ✅ | 2026-07-15 |
| 15.6 | **Frontend-Wizard** (5 Schritte: Eckdaten · Klassen&Konten · Kosten · Belege · Ergebnis+Unterschrift) + Berechnungs-Zwilling `frontend/src/lib/klassenfahrt.ts` (inkl. verteilung, Golden-Master 281,80), `IbanFeld` (Live-mod-97) je Klasse, `DezimalInput allowNegative`, Ganzzahl-Schüler, 4. Startseiten-Kachel (immer sichtbar, CREDO-Rot), Erfolg-Seite parametrisiert (Förderverein-Text), DSGVO-Art.13-Hinweis vor Bankdaten, Live-Auszahlungsliste **+ volle Aufteilungsmatrix** (Parität zum PDF) | ✅ | 2026-07-15 |
| 15.7 | Querschnitt-Bestands-Bugs (betreffen alle Vorgänge): HEIC/HEIF in `ALLOWED_MIME_TYPES` (+ `.heif` im Extension-Filter, Fehlermeldung angeglichen); Unterschrift-Biometrie bei ERSTATTUNG/SAMMELFAHRT nach PDF-Erstellung gelöscht (DSGVO, wie REISEKOSTEN) | ✅ | 2026-07-15 |

**Getroffene Entscheidungen:** Gesamt = **281,80 €** (Summe der cent-gerundeten Auszahlungen, nicht Excel-Anzeige 281,79); `bankIban/bankKontoinhaber` nullable + Konten je Klasse in eigener Tabelle; Startseiten-Kachel immer sichtbar, Mandant im KF-Formular fest auf M40 + harter Server-Gate; QR = reine DMS-Zuordnung über die Belegnummer (kein Swiss-QR/CHF); Freigabe offline über leere Zeichnungsfelder aufs Deckblatt.

**Verifikation (bis 15.4):** Backend-tsc grün, 147 Vitest (inkl. 15 Golden-Master). Commits `8761627`, `d0ffbd1`, `edeb8e3`.

**Verifikation 15.5:** Backend-tsc grün, Frontend-tsc n/a, 147 Vitest grün, ESLint 0. Adversariale 4-Linsen-Prüfung (correctness/security/edge-cases/CREDO-Konsistenz, je Befund einzeln verifiziert) → **8 bestätigte Befunde (4 distinkt)**, alle behoben:
- **(MAJOR) Idempotenz maskierte Nicht-Zustellung:** Kopf wurde MIT `idempotenzKey` VOR der PDF-Erzeugung committet → PDF-Fehler (nicht-WinAnsi-Zeichen im Freitext, Platte voll, Neustart) ergab eine committete, aber nie versendete Zeile, die ein Retry als Erfolg meldete und die per Requeue (kein PDF) nicht heilbar war. **Fix:** PDF wird jetzt VOR der Transaktion erzeugt; der Kopf wird nur mit gesetztem `pdfDateipfad` committet (Biometrie-Unterschrift landet nie in der DB), sodass ein PDF-Fehler abbricht ohne Commit und jede committete Zeile requeue-fähig ist.
- **(MINOR) DIREKT-Anteile roh gespeichert** (decimal(10,2)-Rundung) → `SUM(Anteile)` divergierte vom Zeilen-/Auszahlbetrag. **Fix:** alle Geldwerte + `begleiter` werden vorab cent-normalisiert (Recompute, Speicherung, PDF, Mail nutzen dieselben Werte → IKS-konsistent).
- **(MINOR) `belegDateipfade` ohne Längenlimit** → Hash/PDF-Amplifikation. **Fix:** `.max(20)` (= `upload.array('belege', 20)`).
- **(MINOR) Unparsebare `zeitraum`-Daten** umgingen die Plausibilitätsprüfung → 500 statt 400. **Fix:** Zod-`refine` auf beide Datumsfelder.

**Bewusst akzeptiert (LOW):** belegNr-Kollisionsfenster ist durch „PDF vor Commit" breiter (Verlierer bekommt heilbares 500; pre-existing Eigenschaft von `generateBelegNr`, KF-Volumen minimal, echter Fix gehört mandantenübergreifend in den Nummerngenerator). Verwaiste PDF-Datei auf dem Rollback-Verlierer-Pfad → vom geplanten Retention-Job mit abgeräumt.

**Verifikation 15.7:** Backend-tsc grün, 147 Vitest grün, ESLint 0. HEIC-Fix end-to-end geprüft (gecraftete HEIC-Magic-Bytes werden erkannt und NICHT gelöscht; JPEG ok; Garbage weiter gelöscht + Fehler). Bug 2 (Biometrie-Löschung ERSTATTUNG/SAMMELFAHRT) identisch zum bewährten REISEKOSTEN-Pfad.

**End-to-End-Test 15.5 gegen echte DB (15.07.2026):** Dev-DB `credo-finanz-db` von Migration 0000 auf 0011 gebracht (0001–0011 laufen sauber durch; Enum/`klassenfahrt_*`/`idempotenz_key`/`bank_iban` nullable verifiziert). Realer HTTP-Durchlauf der KF-Route:
- POST 3-Klassen-Golden-Master → **201, KF-2026-00001, gesamt=281,80**; DB: Kopf (pdf gesetzt, `unterschrift_bild` NULL, `bank_iban` NULL, idempotenz-Key), 3 Klassen (Zuschuss 105,15/74,08/102,57 + IBAN je Konto), 9 Kostenzeilen, 12 Anteil-Rows, 1 Beleg. **DIREKT-Rekonstruktion:** `SUM(anteile)==kostenzeile.betrag` für alle 4 DIREKT-Zeilen.
- Idempotenz: gleicher Key → **200 `idempotent:true`**, weiterhin genau 1 KF-Zeile.
- M40-Gate fremder Mandant → **403**; ungültiges Datum → **400**; leere Belege → **400**.
- Route-PDF visuell = Muster (Aufteilungsmatrix korrekt).

**Querschnitt-Bug beim E2E gefunden + behoben (betrifft ALLE Vorgänge): PNG-Belege wurden nie eingebettet.** In `pdf.ts:haengeBelegeAn` wurde ein `.png`-Beleg von sharp nach JPEG konvertiert, aber via `embedPng` eingebettet → warf → statt des Belegs landete eine „Beleg konnte nicht eingebettet werden"-Fehlerseite im DMS-PDF. Fix: Embed richtet sich nach dem erzeugten Format (heic/heif→PNG, sonst JPEG); zusätzlich `flatten({background:'#ffffff'})` (transparente PNGs → weiß). E2E gegengeprüft: PNG **und** JPEG betten jetzt korrekt ein, keine Fehlerseite.

**Verifikation 15.6 (Frontend-Wizard):** Frontend-tsc grün, ESLint 0, **156 Vitest** (147 Backend + 9 neue Zwilling-Tests inkl. Golden-Master 281,80). **Echter End-to-End-Durchlauf im (headless) Browser** gegen den laufenden Dev-Stack: kompletter 5-Schritte-Wizard (IbanFeld/DezimalInput/Modus-Toggle/DIREKT-Anteile/Beleg-Upload/Signatur-Canvas) → Submit → **KF-2026-00003** in der DB (gesamt 23,72; Zuschuss je Klasse 11,90/11,82; PDF erzeugt; `unterschrift_bild` NULL). Live-Auszahlungsmatrix rendert mit Parität zum PDF (Screenshot geprüft). Adversariale Review des Frontend-Deltas: **kein CRITICAL/MAJOR** (Kontrakt Frontend↔Backend-Zod deckungsgleich, Anteil↔Klassen-Sync korrekt, ≥0-Guard hält). MINOR-Fixes umgesetzt: Zwilling-Vorschau **cent-normalisiert wie der Server** (Vorschau == Auszahlung auch bei >2 Nachkommastellen), `maxLength` an allen Textfeldern (Server-Caps), Idempotenz-Key lazy-init. Bewusst belassen (nicht-korrumpierend): Index-Listen-Keys; Erfolg-Variante nach F5-Reload generisch.

**Nachtrag 15.4 (Wunsch Dimitri, 15.07.2026): PDF-Aufteilungsmatrix.** Das KF-Deckblatt zeigt jetzt eine Sektion „KOSTENAUFTEILUNG JE KLASSE": je Kostenzeile der auf jede Klasse entfallende Anteil (proportional aus Schülerzahl bzw. direkt erfasst; DIREKT-Null als „–"), darunter die Herleitung Spaltensumme = Kostenanteil K → ÷ Personen (S+B) → = FV-Zuschuss je Klasse. Damit ist auf einen Blick nachvollziehbar, wie sich der Zuschuss ergibt (ersetzt die frühere flache „Kostendetails"-Liste). Datenquelle: `berechneKlassenfahrt` liefert neu die Matrix `verteilung[zeile][klasse]` (Single Source; Golden-Master um Matrix-Zellen + Spaltensummen-Konsistenz erweitert). Dynamische Spaltenbreiten (1–5 Klassen), negative Gutschriften und dezimale Begleiter visuell verifiziert (3- und 5-Klassen-Muster gerendert). Backend-tsc grün, 147 Vitest grün, ESLint 0.

### Phase 16: Gesamt-Audit + Tier-1-Härtung (16.07.2026)

Auslöser: Wunsch Dimitri — gründliche Prüfung (Korrektheit/Sicherheit/Performance/UI-UX/Resilienz/SMTP) mit Ziel Stabilität + Speed, plus funktionaler Nachweis des SMTP-Versands **inkl. Belege**.

**SMTP-Versand end-to-end verifiziert:** lokaler SMTP-Sink (STARTTLS, self-signed) → KF-Submit mit Beleg → **Mail zugestellt mit PDF-Anhang, der den eingebetteten Beleg enthält** (DB GESENDET + `email_log` SENT). IPv6-Fehlversuch (`::1` vs. `127.0.0.1`) → korrekt Status FEHLER + n8n-`fehler`-Fallback + Requeue-Fähigkeit.

**Audit:** 6-Linsen-Workflow (32 Agenten, je Befund adversarial verifiziert) → **25 bestätigte Befunde** (0 CRITICAL, 11 MAJOR, 14 MINOR).

**Tier 1 behoben (16.07.2026):**
- **(#6/#11)** `versendeEinreichung` (fire-and-forget) in try/catch gekapselt + globale `unhandledRejection`/`uncaughtException`-Handler in `index.ts` → ein DB-Schluckauf nach dem 201 crasht den Prozess nicht mehr.
- **(#4/#7/#13)** Array-Caps (`reisetage` 60 / `weitereKosten` 50 / `positionen` 100 / `belegDateipfade` 20) + numerische Obergrenzen (DB-Präzision) auf allen Vorgangstypen → DoS/OOM entschärft, sauberes 400 statt Overflow-500.
- **(#12)** Datums-`refine` (Date.parse) auf RK/KE/SF → 400 statt unklarem 500.
- **(#2 Interim)** VMA je Tag ≤ 200 € gedeckelt (voller Server-Recompute = Tier 2).
- **(#10 Mitigation)** PDF `winAnsiSafe`: nicht-CP1252-Zeichen (Emoji/Kyrillisch) → „?", kein WinAnsi-Throw mehr → keine hängenden, unzustellbaren Zeilen aus dieser Ursache. **E2E mit Emoji/Kyrillisch verifiziert** (Umlaute bleiben erhalten).
- **(#9)** AdminCenter-Mandanten-Tabelle `overflow-hidden`→`overflow-x-auto`.
- **(#21)** BelegUpload: `input.value`-Reset → entfernte Datei wieder hinzufügbar; zusätzlich HEIF ergänzt.
- **(#3 Teil)** SSRF-Guard: IPv6-`[]`-Klammern entfernt, IPv4-mapped (dotted + normalisiert-hex) + Loopback-Formen blockiert. **E2E-verifiziert.**

**Tier 2 (offen, mit Dimitri abzustimmen):** #2 voller Server-VMA-Recompute · #1 belegNr-Race (Zähler-Tabelle/Sequence) · #10 volle Transaktions-Backport RK/KE/SF (PDF-vor-Commit) · #5 PDF vom Request-Thread nehmen · #8 Anhang-Budget vs. 25-MB-Grenze · #3 DNS-Rebind-Schutz · MINOR: #14 Login-Timing, #19 SMTP-Duplikat, #22 IBAN-Caret (Hauptformulare), #24 Signatur-a11y, #15–18 Perf, #20/#23/#25.

**Tier-2-Fortschritt (16.07.2026):**
- ✅ **#1/#15 belegNr-Race behoben:** neue Tabelle `beleg_counter(typ,jahr,last_num)` + Migration 0012; `generateBelegNr` per atomarem `INSERT … ON CONFLICT DO UPDATE … RETURNING` (kein Advisory-Lock/SELECT-MAX mehr). Verifiziert: 50 parallele Vergaben → 50 eindeutige Nummern. Commit `02afb0f`.
- ✅ **#2 Server-VMA-Recompute behoben:** neues `backend/src/lib/vma.ts` (Spiegel des Frontends, 16 Tests); REISEKOSTEN rechnet VMA je Tag serverseitig neu (Typ+Mahlzeiten+Land), ignoriert Client-Beträge. Verifiziert: Client 180/Tag → Server 14/28/14. Commit `0410684`.
- ✅ **#10 Transaktions-Umbau RK/KE/SF behoben:** alle drei Branches folgen jetzt dem KF-Muster — **PDF wird VOR dem Commit** erzeugt; Kopf (inkl. `pdfDateipfad`, Biometrie-Unterschrift = `null`) + Kinderzeilen (Reisetage/Fahrten/Positionen/weitere Kosten) + Belege landen in **einer `db.transaction`**. Der frühere Ablauf (Insert → PDF → nachträgliches `db.update`) ist entfernt; schlägt das PDF-Rendern fehl, wird kein unzustellbarer Datensatz mehr committet (Retry läuft sauber). Belegnummer wird erst nach bestandener Validierung gezogen (weniger Nummern-Lücken). Toter Helfer `speichereBelege` entfernt.
- ✅ **#8 Anhang-Größencheck VOR dem Commit behoben:** neuer Helfer `pdfPasstInMailOderAntworte` prüft die fertige PDF gegen die 25-MB-SMTP-Grenze (`pruefeAnhangGroesse`) und liefert **400 statt totem Datensatz**; in allen vier Branches (RK/KE/SF **und KF**) direkt vor der Transaktion eingehängt.
- **Übriges Tier 2 (offen):** #5 (PDF vom Request-Thread), #3 (DNS-Rebind), MINOR #14/#19/#22/#24/#15–18/#20/#23/#25.

**Verifikation Tier-2:** Backend-tsc grün, **172 Vitest** (156 + 16 VMA), ESLint 0 Fehler. Migration 0012 gegen Dev-DB angewandt. **Dev-DB-E2E #10/#8:** je ein KE/SF/RK-Submit → 201 + fortlaufende Belegnr (KE-…7/SF-…51/RK-…4); DB-Prüfung: `pdfDateipfad` gesetzt, `unterschrift_bild = NULL`, Kinderzeilen + Belege atomar committet; PDF-Dateien real erzeugt (`%PDF-`, Beleg eingebettet). Versand-Wiring unverändert (Mailer erhält korrekten PDF-Pfad; scheitert nur an bewusst deaktiviertem Dev-SMTP — kein Crash).

**Verifikation:** Backend+Frontend-tsc grün, **156 Vitest**, ESLint 0 Fehler. Dev-DB-E2E: KF-Submit (inkl. Emoji/Kyrillisch) → GESENDET + PDF-Anhang mit Beleg; SSRF-Bypässe blockiert. Nebenbei: Startseiten-Hero-Logo entfernt (nur „Finanzportal" + Frage).

**Nachtrag (Wunsch Dimitri): DIREKT-Kostenverteilung mit Auto-Rest.** Bei „direkt"-Kostenzeilen im KF-Wizard gibt man jetzt einen **Gesamtbetrag** ein und verteilt ihn je Klasse; die **letzte Klasse ist der automatische Rest** (= Gesamtbetrag − Summe der übrigen), fest im State gehalten (bleibt beim Hinzufügen/Entfernen von Klassen erhalten). **Über-Verteilungs-Check:** es kann nie mehr als der Gesamtbetrag verteilt werden — Live-Warnung + „Weiter"/„Einreichen" blockiert. Rein Frontend (`KlassenfahrtFormular.tsx`); der Server rechnet ohnehin autoritativ neu. Verifiziert im Browser (250 → Rest 250; ändern → Rest passt sich an; Über-Verteilung 600/500 blockiert; Klasse-Hinzufügen erhält Verteilung) + Backend-Calc (500 → [200, 300] → Zuschuss 9,52/27,27, gesamt 36,79 €). Frontend-tsc/ESLint grün.

### Phase 17: VMA-Fix Ausland — Release 1a (10.10.2026)

Auslöser: Kritische Bewertung 10/2026 — die Auslands-VMA rechnete die BMF-Endbeträge zusätzlich × 1,2 / × 0,8 (rund 20 % zu hoch, 8-h-Spalte ignoriert), eintägig genau 8:00 h wurde vergütet, und die Tagesbildung im Browser hing von der Zeitzone ab (Zeitumstellung, Abfahrt vor 02:00 Uhr).

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 17.1 | `backend/src/lib/vma.ts`: `vmaTag(tag, { satz24h, satz8h })` mit BMF-Endbeträgen (24 h = Ganztag, 8 h = An-/Abreise bzw. eintägig > 8 h), Kürzung 20/40/40 % vom 24-h-Satz, auf die Pauschale gedeckelt (§ 9 Abs. 4a S. 8 EStG); REISEKOSTEN lädt beide Sätze | ✅ | 2026-10-10 |
| 17.2 | Eintägig nur bei strikt mehr als 8 h (> 480 min), Frontend und Backend; Feld `Reisetag.eintaegigUeber8h` | ✅ | 2026-10-10 |
| 17.3 | Tagesbildung zeitzonenunabhängig (String-Teile + `Date.UTC`); Server prüft Datum + Typ jedes Client-Tages gegen Abfahrt/Rückkehr (sonst 400 „Die Reisetage passen nicht zum Reisezeitraum …“) | ✅ | 2026-10-10 |
| 17.4 | Formular: Land bei Auslandsreise Pflicht, Länderauswahl „Häufige Ziele“ (Sortierung < 1000) / „Alle Länder A–Z“, Hinweis bei Ladefehler, Kürzungstext je Inland/Ausland; tote Konstante `AUSLANDSPAUSCHALEN` entfernt | ✅ | 2026-10-10 |
| 17.5 | Migration `0014_pauschalen_ausland_bmf2026.sql`: vollständige BMF-Tabelle (214 Zeilen + 9 Verweisstaaten, z. B. Mikronesien = Philippinen), bedingte UPDATEs nur auf alte Seed-Werte, fehlende Zeilen per `INSERT … ON CONFLICT DO NOTHING`; generiert aus `backend/src/db/data/bmf-auslandspauschalen-2026*.csv` mit `backend/scripts/bmf-csv-zu-sql.ts`; Prüfabfrage `backend/scripts/pruefe-auslandspauschalen.sql` | ✅ | 2026-10-10 |
| 17.6 | Admin: Schlüssel INLAND/ANDERES/SEETAG gesperrt (400), Luxemburg (gesetzlicher Ersatzsatz) nicht löschbar, neue Einträge mit Sortierung 9999 | ✅ | 2026-10-10 |
| 17.7 | Mail an die Buchhaltung: Inlands-Kürzungsbeträge (5,60/11,20 €) nur noch bei Inlandsreisen | ✅ | 2026-10-10 |
| 17.8 | `backend/scripts/vma-nachkorrektur-2026.sql`: Ist/Soll je Tag und Beleg seit 01.01.2026 (Soll aus Abfahrt/Rückkehr und BMF-Sätzen, nicht aus DB/Tagesliste); Überzahlung geteilt in pauschalierbar (≤ 100 % der ungekürzten Pauschale, BMF 25.11.2020 Rz. 58) und individuell; Ausgabe außerhalb des Repos (`.gitignore`) | ✅ | 2026-10-10 |
| 17.9 | Paritätstest `tests/vma-paritaet.test.ts` (Beträge + Tagesbildung inkl. Zeitumstellung, typgeprüft über `tests/tsconfig.json`); CI `.github/workflows/ci.yml` mit TZ-Matrix UTC / Europe/Berlin | ✅ | 2026-10-10 |

**Release 1b (Land je Reisetag) — siehe unten.**

**Verifikation:** Backend-tsc und Tests-tsc grün, Frontend-Build grün, **218 Vitest** unter TZ=UTC und TZ=Europe/Berlin, ESLint 0 Fehler. Migrationen 0000–0014 + Seed auf frischer PG-16-DB: 223 Auslandszeilen (19 „Häufige Ziele“), Prüfabfrage leer; Altbestand-Szenario (alte Seed-Werte, im AdminCenter geänderter Satz, gelöschtes Luxemburg) und zweiter Lauf von 0014 geprüft. Nachkorrektur gegen 13 Testbelege geprüft (u. a. BMF-Beispiel 51: 14 € pauschal, 16 € individuell).

### Phase 17: VMA-Fix Ausland — Release 1b: Land je Reisetag (10.10.2026)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 17.10 | `backend/src/lib/reisetage.ts` (Zwilling `frontend/src/lib/reisetage.ts`): Server bildet die Reisetage selbst aus Abfahrt/Rückkehr (`bildeReisetage`); über Mitternacht unter 24 h Pflichtfrage „Auswärtige Übernachtung?“ (ohne Übernachtung höchstens EIN eintägiger Tag auf dem Tag mit dem größeren Zeitanteil); zwei Kalendertage ab 24 h ohne Übernachtung = EIN Ganztag mit 24-h-Satz (BMF 25.11.2020 Bsp. 31) | ✅ | 2026-10-10 |
| 17.11 | Maßgebendes Land je Tag (`bestimmeTageslaender`, § 9 Abs. 4a S. 5 EStG): An-/Zwischentag Ort um 24 Uhr, im Inland → letzter Tätigkeitsort im Ausland; Abreisetag/eintägig letzter Tätigkeitsort im Ausland; Seetag und „Staat nicht in der Liste“ → Satz Luxemburg; Satzauswahl `waehleTagesSatz` | ✅ | 2026-10-10 |
| 17.12 | Migration `0015_reisetage_land.sql`: `reisetage.land_24uhr/letzter_taetigkeitsort/land_key/land_freitext`, `einreichungen.uebernachtung` (nullable, kein Backfill) | ✅ | 2026-10-10 |
| 17.13 | Route REISEKOSTEN: Client-Tage nur per Datum zugeordnet, jede Landangabe gegen die Ländertabelle geprüft, Sätze in einer Abfrage; alter Browser-Tab ohne Übernachtungsfeld bekommt den Hinweis „Seite neu laden“ | ✅ | 2026-10-10 |
| 17.14 | Überschneidung mit früheren Reisekosten derselben Person (Personalnr. + Nachname, sonst Name + Vorname + IBAN) → Prüfvermerk in PDF und Mail (höhere Pauschale + Kürzung beider Abrechnungen; zwei eintägige Reisen: Zeiten zusammenrechnen, Rz. 47) | ✅ | 2026-10-10 |
| 17.15 | PDF: Reiseland-Zeile, VMA-Tabelle aller Tage (Datum/Art/Land/Pauschale/Kürzung/Betrag), Fußnoten Seetag/„Staat nicht in der Liste“/Überschneidung, lange Wörter gekürzt; Mail: Reiseland, Land je Mahlzeitenzeile, FAQ-Zeile „Frühstück 19 %“ entfernt | ✅ | 2026-10-10 |
| 17.16 | Wizard: Länderauswahl je Tag (Hilfetexte Flug inkl. Zwischenlandung/„Österreich“, Schiff, Übersee), Übernachtungsfrage (ab 24 h mit „Ja“ vorbelegt), Eingaben bleiben bei Änderung des Zeitraums und beim Wechsel Inland/Ausland erhalten, „Staat nicht in der Liste“ gilt für die Folgetage, Freitext-Abgleich mit der Liste („Südkorea“ → „Korea, Republik“), Barrierefreiheit (fieldset/legend je Tag, aria-describedby/-invalid) | ✅ | 2026-10-10 |
| 17.17 | `vma-nachkorrektur-2026.sql` schließt Belege ab 1b (mit `land_key`) aus; Paritätstest um Tagesbildung, Landbestimmung, Satzauswahl, Gesamtkette und Anzeige (Landname, Länderfolge) erweitert | ✅ | 2026-10-10 |
| 17.18 | Migration `0016_haeufige_ziele_staedte.sql`: Städte mit eigenem BMF-Satz der „Häufigen Ziele“ (Mailand, Breslau, Warschau, Bern, Kanaren, Palma de Mallorca, 9 US-Städte) direkt unter ihren Staat sortiert (nur wenn noch Sortierung ≥ 1000); Länderauswahl zeigt Staaten mit Stadtsätzen als „… (übrige Orte)“ | ✅ | 2026-10-10 |

**Bewusste Vereinfachung:** Dauer = Differenz der Wanduhrzeiten (zeitzonenunabhängig); in den beiden Nächten der Zeitumstellung weicht sie um eine Stunde von der tatsächlichen Abwesenheit ab.

**Steuerberater klären:** Abreisetag — BMF-Wortlaut „letzter Tätigkeitsort“, Gesetz „letzter Tätigkeitsort im Ausland“; das Portal fragt nach dem Ausland (auch Vortag).

**Offen (Release 1c):** Sätze nach Reisedatum (Satzstände je Jahr), Länder-Dropdown ohne Dubletten, Seed legt bei jedem Start Inlandspauschalen-Duplikate an, Muster-PDFs neu erzeugen.

**Verifikation:** Backend-tsc grün, Frontend-Build grün, **348 Vitest** unter TZ=UTC und TZ=Europe/Berlin, ESLint 0 Fehler. Migrationen 0000–0015 + Seed auf frischer PG-16-DB (16 Migrationen, 5 neue Spalten nullable). API-E2E gegen die Test-DB: 33/33 (u. a. BE → NL → LU 166,20; 26 h ohne Übernachtung Belgien 59,00; alter Client; unbekannte Landangabe 400; Überschneidungsvermerke). Nachkorrektur lesend: nur Altbelege, keine 1b-Belege.

### Phase 17: VMA-Fix Ausland — Release 1c: Sätze nach Reisedatum (10.10.2026)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 17.19 | Migration `0017_pauschalen_gueltigkeit.sql`: `pauschalen_ausland.gueltig_von` (date, Default 2026-01-01) + `quelle` (Default „BMF-Schreiben vom 05.12.2025“), Primärschlüssel `(land_key, gueltig_von)`; `reisetage.satz_24h/satz_8h/satz_quelle` (angewandter Satz je Tag, nullable) | ✅ | 2026-10-10 |
| 17.20 | `backend/src/lib/reisetage.ts`: `waehleSatzstand` (größtes `gueltigVon` ≤ Reisetag im selben Kalenderjahr) und `waehleTagesSatz(landKey, datum, staende)` mit Quelle; Inland 28/14 „§ 9 Abs. 4a EStG“ unabhängig vom Jahr, ANDERES/SEETAG → Luxemburg des Reisejahres; ohne Stand des Reisejahres 400 „Die Auslandspauschalen für JJJJ sind noch nicht hinterlegt …“ | ✅ | 2026-10-10 |
| 17.21 | Route REISEKOSTEN: Satzstände aller benötigten Länder in einer Abfrage, Satz je Tag nach Datum, `satz_*` je Reisetag gespeichert; PDF (unter der VMA-Tabelle) und Mail: „Pauschalen: BMF-Schreiben vom …; Inland: § 9 Abs. 4a EStG“ statt fest eingetragenem BMF-Datum | ✅ | 2026-10-10 |
| 17.22 | `GET /api/pauschalen/ausland` liefert alle Satzstände (`gueltigVon`, `quelle`); Admin-CRUD auf `(landKey, gueltigVon)`: `PUT/DELETE /api/admin/pauschalen-ausland/:landKey/:gueltigVon`, neuer Stand ohne Sortierung übernimmt die des Vorgängerstands, letzter Luxemburg-Stand eines Jahres nicht löschbar | ✅ | 2026-10-10 |
| 17.23 | Generator `bmf-csv-zu-sql.ts --jahr … --quelle … --migration …`: Migration für einen neuen Jahresstand (INSERT `ON CONFLICT (land_key, gueltig_von) DO NOTHING`, Sortierung vom Vorgängerstand), Journal-Eintrag, Prüfabfrage je Jahr, Abgleich der Keys mit der Vorjahres-CSV; Modus 2026 erzeugt 0014 byte-identisch; Prüfabfrage 2026 und Nachkorrektur vergleichen nur den Stand 2026; `DEPLOYMENT.md` Abschnitt 14 „Jährliches Pauschalen-Update“ | ✅ | 2026-10-10 |
| 17.24 | Review-Fixes 1c: eigene Meldungen statt „später einreichen“ — Land/Stadt fehlt nur im Jahresstand (`LAND_OHNE_SATZSTAND`: Staat bzw. „Staat nicht in der Liste“ wählen), Reisejahr vor dem ersten Stand (Buchhaltung); Maßstab „Jahr hinterlegt“ = Luxemburg-Stand (Server lädt Luxemburg immer mit); Länderauswahl je Reisetag nur mit Ländern, für die an dem Tag ein Stand gilt; Luxemburg-Löschschutz atomar (früherer Stand im Jahr bleibt oder Jahr ohne andere Länder; Button gesperrt mit Begründung); PDF-Quellen je Quelle mit Tagen, ANDERES-Fußnote ohne festes BMF-Datum; Admin: Tagessätze > 0 (Client und Server), leeres Formular ohne „0“, Bezeichnungen unter 1024 px, Jahresfilter fängt gelöschtes Jahr ab, Hinweistext in Klartext; Generator: Verweis-CSV jedes Jahr Pflicht, Luxemburg Pflicht, `--migration` muss `bmf<Jahr>` enthalten, `--neu-schreiben` nur für die jüngste Satzstand-Migration desselben Jahres; Prüfabfrage läuft auch vor 0017 (`to_jsonb`); 0017 entfernt die Defaults nach dem Backfill | ✅ | 2026-10-11 |

**Befund Inlandspauschalen:** Der Seed legt die Tabelle `pauschalen` (KM/VMA Inland) bei jedem Lauf erneut an (`onConflictDoNothing` ohne Unique-Constraint: frische DB 8 Zeilen, nach zweitem Seed 16); gelesen wird die Tabelle nirgends. Inland bleibt daher bewusst Konstante im Code (`INLAND_SATZ` 28/14, Quelle `INLAND_QUELLE` „§ 9 Abs. 4a EStG“); Tabelle und Seed unverändert.

**Verifikation (Backend):** Backend-tsc grün, ESLint 0 Fehler, Backend-Vitest 192/192 unter TZ=UTC und TZ=Europe/Berlin (u. a. Jahreswechsel 30.12.2026–02.01.2027 mit Stand 2026 + Test-Stand 2027 = 40 + 59 + 61 + 41; ohne Stand 2027 Fehler; Korrekturstand ab 01.07.; Luxemburg des Reisejahres; Inland jahresunabhängig). Migrationen 0000–0017 + Seed auf frischer PG-16-DB: 223 Stände 2026, Prüfabfrage leer. Generator-Modus mit Test-CSV 2027 (nicht committet): Migration idempotent und byte-identisch reproduzierbar, Sortierung inkl. im AdminCenter geänderter Werte übernommen, Prüfabfrage 2027 leer. API-E2E gegen die Test-DB: 42/42 (Jahreswechsel, Korrekturstand, Admin-CRUD, Luxemburg-Löschschutz, ohne Stand 2027 → 400).

**Verifikation Review-Fixes (11.10.2026):** Backend-tsc grün, Frontend-Build grün, ESLint 0 Fehler (nur bestehende Warnungen), **408 Vitest** unter TZ=UTC und TZ=Europe/Berlin (Parität u. a. gestrichene/neue Keys, Stadt → Staat, Reisejahr vor dem ersten Stand). Upgrade 0000–0016 → 0017 auf eigener DB: Prüfabfrage vor und nach 0017 lauffähig (Abweichung wird gemeldet), Defaults entfernt, `INSERT` ohne `gueltig_von` scheitert; frische DB 0000–0017 + Seed: 223 Stände 2026, Prüfabfrage leer. Generator in einer Kopie: fehlende Verweis-CSV, fehlendes Luxemburg, kopierter Vorjahresbefehl (`--migration …bmf2027` bei `--jahr 2028`), Ziel 0017 und eine nicht mehr jüngste Satzstand-Migration werden abgelehnt; 0014 und Nachkorrektur byte-identisch. API-E2E gegen die Test-DB: 32/32 (0-€-Sätze 400, gestrichenes Land/Stadt und 2025 mit passender Meldung, Jahreswechsel mit „Staat nicht in der Liste“ = Luxemburg 2027 samt PDF-Quellen je Tag, Luxemburg-Löschschutz inkl. parallelem Löschen und Tippfehler-Jahr).

### Phase 17: Code-Review-Fixes (11.10.2026)

Auslöser: Code-Review des VMA-Branches (`CODE-REVIEW_2026-10-11_VMA.md`, 7 Spezial-Agenten, Checkliste B) und dessen Verifikation.

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 17.25 | Rechenkette der Route als reine Funktionen (`bereiteReisekostenVor` → Satzstände laden → `berechneReisekostenVma`, `lib/reiseangaben.ts`); Einzeltests und Paritätstest prüfen den echten Serverpfad statt eines Nachbaus (CQ-M1/M1) | ✅ | 2026-10-11 |
| 17.26 | Tage ohne Anspruch (eintägig bis 8 h): kein Satz, `satz_*` NULL, Quelle „kein Anspruch (bis 8 h)“ — keine Ablehnung mehr ohne Jahresstand; Formular sendet für so einen Tag keine ausgeblendeten Landangaben, Hinweis „noch nicht hinterlegt“ in Schritt 2 nur bei Satzbedarf; PDF-Fußnote „Satz Luxemburg“ nur für Tage mit Satz (EH-M1) | ✅ | 2026-10-11 |
| 17.27 | „Staat nicht in der Liste“: Server prüft den Freitext gegen die Liste (`pruefeLandFreitext`, Zwilling), auch Städte mit eigenem Satz unter üblichen Namen (Palma, Hong Kong, Sankt Petersburg, NYC, Washington DC); „Mallorca“, „New York“, „Washington“ nennen Staat und Stadt, Übernahme per Klick für beide (SEC-m1) | ✅ | 2026-10-11 |
| 17.28 | Admin-Satzstände: neuer Stand nur in Jahren mit eingespieltem Jahresstand, atomar (A-M1); Sätze > 0 und höchstens `MAX_TAGESSATZ` 200 (eine Konstante, zugleich Deckel der Einreichung), 8 h ≤ 24 h auch im PUT; Duplikat per Fehlercode 23505; kein doppeltes URL-Decoding; Land und Quelle ohne Steuer-, Format- und Zeilentrennzeichen; Fehlertexte je Feld (EH-m1–m4, SEC-m4) | ✅ | 2026-10-11 |
| 17.29 | Überschneidungsvermerk nur im selben Mandanten (SEC-m2); Freitext im Mailtext ohne Steuer-, Bidi- und Zeilentrennzeichen wie U+2028/U+2029 (SEC-m3); Formel-Injection im Nachkorrektur-Export entschärft (SEC-m5) | ✅ | 2026-10-11 |
| 17.30 | Lösch-Moratorium nur für den Reisekosten-Altbestand (ohne Land je Reisetag = genau die Belege der Nachkorrektur), Enddatum 31.03.2027 im Code (`RETENTION_MORATORIUM_BIS` überschreibt), danach automatisch normale Frist, Warnung im Log ab 30 Tage vorher; Frist `RETENTION_FRIST_TAGE` (90) fail-closed; `RETENTION_TAGE` in Compose fest 3650 nur für ältere Images; Minimierung (IBAN/Kontoinhaber, Belege, PDF) löscht die Dateien zuerst, bei Fehler bleibt der Verweis für den nächsten Lauf; `DEPLOYMENT.md` §13 mit Prüftermin 01.03.2027 und offener Entscheidung L11 (SEC-M1, EH-M2, m5) | ✅ | 2026-10-11 |
| 17.31 | UX: Infobox und Hinweise zugeklappt bzw. nur bei Bedarf (UX-MAJOR-1), Fokus auf das erste Fehlerfeld nach „Weiter“ (auch Schritt 1), Schrittmeldung beim Ändern zurückgesetzt, Übernachtungsfrage für Screenreader ausgezeichnet, abgelehnte Einreichung nennt Feld und Schritt; Zusammenfassung bei 375 px mit Abstand zwischen Bezeichnung und Betrag | ✅ | 2026-10-11 |
| 17.32 | CI-Zeitzonen-Matrix um America/New_York erweitert; reine Datumswerte string-basiert (Mail, `formatDate`) (M2) | ✅ | 2026-10-11 |
| 17.33 | Schritt „Verpflegung“ (Ausland): kompakte Tageszeilen (Vorschlag 5 aus UX-MAJOR-1) — der Kopf „Datum · Typ / Land · ändern / Betrag“ ist ein Button (≥ 44 px, `AuslandsTageskopf`), der die Landfelder auf- und zuklappt. Regel als reine Funktion `landfelderVorgabe` (`lib/landfelder.ts`, 14 Tests): immer offen ohne Vorschau und bei „Staat nicht in der Liste“ ohne Staat; von selbst offen am Anreisetag (Abfahrt am Abend, Durchreise), bei Land ≠ Hauptland (Mehrländer, Vorbelegung vom Vortag, Seetag), bei eigener abweichender Angabe und am Abreisetag nach einem Seetag; sonst zu (Zwischentage, Abreisetag im Hauptland). Eine Landangabe hebt das Zuklappen der Folgetage auf (`landOffenNachAenderung`, Hinweise am Abreisetag bleiben sichtbar); offen heißt der Kopf „ausblenden“; nach „… übernehmen“ Fokus auf der Auswahl; Mahlzeit-Buttons und Infobox-Leiste ≥ 44 px; Kürzungsbetrag `text-red-600` (4,83:1). Höhe der Schritt-Karte bei 375 px, 2bb23d4 → jetzt (Entwurf mit zugeklapptem Anreisetag): Österreich 5 Tage „Nein“ 1444 → 1042 px (956), Abfahrt 20 Uhr 1480 → 1078 (1078), Belgien 5 Tage „Ja“ 1654 → 1342 (1226), Rundreise BE → NL → LU 1480 → 1440 (1354) | ✅ | 2026-10-11 |

**Entschieden 11.10.2026 (Analyse L11):** Ohne Archivquittung aus DokuBit (P03) würde der Job nach 90 Tagen Belege löschen, deren Archivierung nicht nachgewiesen ist. Variante (a): `RETENTION_FRIST_TAGE` ist in `docker-compose.prod.yml`/`docker-compose.yml` standardmäßig 3650 — bis zur Quittung wird nichts gelöscht (`DEPLOYMENT.md` §13, mit dem Datenschutzbeauftragten abzustimmen). UX-MAJOR-1: Schritt „Verpflegung“ bei 375 px, Österreich 5 Tage = 1951 px Seitenhöhe gegenüber 932 px vor dem Branch (56aac48, eine Summenkarte); die Tagesliste ist laut Plan 1.9 gewollt; seit 17.33 kompakte Tageszeilen (Vorschlag 5, Anreisetag bleibt offen): 1549 px Seitenhöhe.

**Verifikation:** Backend-tsc und Tests-tsc grün, Frontend-Build grün, **516 Vitest** unter TZ=UTC, Europe/Berlin und America/New_York (Parität u. a. Staat + Stadt zum Freitext und Satzstände mit Städten), ESLint 0 Fehler (36 Warnungen wie vorher). Frische PG-16-DB 0000–0017 + Seed: 223 Stände, Prüfabfrage leer. API-E2E gegen die Test-DB: 33/33 (Tagesreise bis 8 h 2027 = 0,00 ohne Satz; PDF ohne Luxemburg-Fußnote bei Tag ohne Anspruch, mit Fußnote bei Anspruch; Mallorca/Palma/New York/Washington/Hong Kong/Sankt Petersburg → 400 mit Staat und Stadt; U+2028/U+202E/U+200B im Freitext ersetzt; Client-Tagesbetrag 200 ja, 200,01 nein; Admin lehnt Zeilentrenner und Bidi-Zeichen in Land und Quelle ab). Retention gegen die Test-DB: Erstattung und Reisekosten mit Land je Tag gelöscht, Altbestand minimiert (Datensatz, Reisetage, `email_log` bleiben), gesperrtes PDF behält den Verweis und wird im nächsten Lauf entfernt, idempotent, ab 31.03.2027 normale Frist; Startlog fail-closed bei `3.650` bzw. 30.02. Retention-Änderung isoliert auf `53f3c16`: tsc und Tests grün, Abfrage auch ohne Spalte `land_key` lauffähig. Browser 375 px: Fokus auf Vorname nach „Weiter“, kein Hinweis „nicht hinterlegt“ bei 7 h in 2027, nach Kürzen auf höchstens 8 h kein gesperrtes „Weiter“ mehr.

---

## Produktivsetzung (Vorbereitung, 16.07.2026)

Richtung nach Abschluss von Teil 3 + Audit-Härtung: GoLive vorbereiten. Reihenfolge: (1) Doku + Migrations-Check, (2) 90-Tage-Löschjob.

**(1) Migrations-Check — Prod-Tauglichkeit verifiziert.** Kompletter Lauf `migrate` (0000–0012) + `seed` gegen eine **frische PostgreSQL-16-DB** (Wegwerf-Container) fehlerfrei: 20 Tabellen, `einreichung_typ`-Enum mit `KLASSENFAHRT`, Seed 7 Mandanten / 43 Erstattungs-Kategorien (6×7 + Schulleiterbudget M40) / `beleg_counter` leer / 1 Admin, 13 Migrationen im Drizzle-Tracking. `0009`/`0011` mit `ALTER TYPE ADD VALUE`/`ALTER COLUMN` und leeren Seed-Selects auf frischer DB unkritisch (PG ≥ 12).

**(1) Doku aktualisiert.** `DEPLOYMENT.md` + `README.md` auf Ist-Stand: **SMTP** als primärer Versandweg (statt n8n/Webhook, das jetzt optional ist), SMTP-Felder als Pflicht-Env, 4 Vorgangstypen inkl. Klassenfahrt (nur Mandant 40), Migrationen 0007–0012 dokumentiert, Smoke-Test um KF ergänzt, Schema-/Status-/Backlog-Abschnitte nachgezogen.

**(2) 90-Tage-Löschjob (DSGVO) gebaut** — Entscheidung Dimitri: *ganzen Vorgang hart löschen*, *in-process täglich*, *nur GESENDET*. Neuer Service `backend/src/services/retention.ts`:
- `loescheAbgelaufeneVorgaenge(maxAlterTage=90)`: löscht Vorgänge mit `status='GESENDET'` UND `created_at < heute−90 T` vollständig — `einreichungen`-Zeile (Cascade räumt Reisetage/Positionen/Fahrten/Klassen/Kostenzeilen/Anteile/Belege), zugehörige `email_log`-Zeilen (FK ist `ON DELETE SET NULL` → sonst bliebe der **Klarname im `betreff`** zurück; daher explizit vor der Einreichung gelöscht) sowie Beleg-Dateien + PDF von der Platte (Guard: nur innerhalb `UPLOAD_DIR`). DB-Löschung in **einer Transaktion**, Datei-Löschung danach (Fehler unkritisch, nur geloggt).
- `starteRetentionScheduler()`: Catch-up-Lauf ~1 min nach Start, danach alle 24 h; **nur** bei `NODE_ENV=production` oder `RETENTION_ENABLED=true` (kein versehentliches Löschen von Dev-Daten). Verdrahtet in `index.ts` (`app.listen`). `RETENTION_TAGE`-Env überschreibt die Frist.
- **Verifiziert (Dev-DB-Integrationstest, 11 Assertions):** alter GESENDET-Vorgang → Zeile + Cascade-Belege + `email_log` + beide Dateien entfernt; junger GESENDET-Vorgang und alter EINGEREICHT-Vorgang bleiben; Ergebnis `{geloescht:1, dateienGeloescht:2, dateiFehler:0}`.

**Verifikation Produktivsetzung:** Backend-tsc grün, **100 Vitest** grün, ESLint 0 Fehler. Fresh-PG16 migrate+seed grün. Retention-Integrationstest grün.

**Offen für GoLive (braucht Dimitris Hände / Live-Infra):** Prod-SMTP-Zugangsdaten + Secrets (`ENCRYPTION_KEY`/`JWT_SECRET`/Passwörter) in `.env.production`, Deployment auf dem Server (`deploy.sh`, DNS, Caddy). Optional-offen: CREDO-Rot-Hex + DSGVO-Art.-13-Text final freigeben; allgemeine `email_log`-Retention unabhängig vom Vorgang.

### Phase 11: Steuerexperten-Audit + UX-Hardening + Apple-like Startseite (09.05.2026)

Auslöser: Feedback Schulleiter zum Verpflegungs-Schritt im Reisekosten-Wizard. Steuerexperten-Audit mit 3 parallelen Spezial-Agenten (Steuerrecht-Aktualität, UX-Vergleich Markttools, lokales UX-Audit) ergab: kritische Lücke bei Auslandspauschalen + UX-Reibung im VerpflegungStep für 80 % der Lehrer-Reisen.

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 11.1 | **Auslandspauschalen 2026** auf BMF-Schreiben v. 05.12.2025 aktualisiert (Dänemark 58→75, Niederlande 47→58, Belgien 52→59, Österreich 40→50, Schweiz 64→68, Spanien 38→42 etc.) | ✅ | 2026-05-09 |
| 11.2 | **Stadt-Differenzierung** als separate Einträge: Paris/Rom/London/Genf/Barcelona/Madrid mit eigenen Sätzen | ✅ | 2026-05-09 |
| 11.3 | **VerpflegungStep Master-Toggle** "Wurde Verpflegung gestellt?" — Default "Nein", bei "Nein" verschwindet die Tabelle, bei "Ja" klappt sie auf. Eliminiert kognitive Last für 80 % der Tagesreisen ohne Buffet | ✅ | 2026-05-09 |
| 11.4 | **VerpflegungStep <8h-Hinweis** prominent — bei eintägiger Reise unter 8 h nur amber Hinweis-Box, keine Tabelle, direkt "Weiter" | ✅ | 2026-05-09 |
| 11.5 | **VerpflegungStep mobile Cards** statt 7-Spalten-Tabelle: pro Tag eine Card mit drei großen Pill-Toggles (analog FahrtenListe-Pattern) | ✅ | 2026-05-09 |
| 11.6 | **Anlass-Mindestlänge 10 → 3 Zeichen** in Reisekosten + Sammelfahrt + Backend-Zod (blockierte zuvor "Praktikum", "Konferenz") | ✅ | 2026-05-09 |
| 11.7 | **Validierungs-Loch geschlossen**: `validateBisAktuell()` re-validiert in allen 3 Wizards alle Steps bis aktuell + springt zum ersten Fehler. `setErrors({})` aus Zurück-Klick entfernt | ✅ | 2026-05-09 |
| 11.8 | **Beleg-Pflicht in ErstattungFormular** (mind. 1 Datei) — fachlich korrekt, weniger Rückfragen aus Buchhaltung | ✅ | 2026-05-09 |
| 11.9 | **Startseite Apple-like Redesign** im CREDO-CI: zentrale Hero-Frage, Cards mit dünnem Akzentstrich (Gelb/Grün/Blau), monochrome Icons in Primärgrau, dezente Schatten + Hover-Lift, Beispielzeilen pro Card, Entscheidungshilfe unter den Cards | ✅ | 2026-05-09 |
| 11.10 | **Sammelfahrt-Kachel-Text präzisiert**: "Mehrere wiederkehrende Tagesfahrten zusammenfassen — z.B. wöchentliche Praktikumsbesuche. Mind. 2 Fahrten." Verhindert Falsch-Erwartung "die einfachere Variante" | ✅ | 2026-05-09 |
| 11.11 | **Tests**: 6 neue Cases für AUSLANDSPAUSCHALEN (Vollständigkeit, Stadt-Diff, plausible Verhältnisse, Werte-Verifikation Dänemark/Österreich) | ✅ | 2026-05-09 |

**Steuerrechts-Aktualität:** Inland 14/28 EUR weiter gültig (Wachstumschancengesetz 2024 Erhöhung wurde gestrichen). Mahlzeitenkürzung 20/40/40 vom 24h-Satz weiter korrekt. Pendlerpauschale 0,38 EUR ab 2026 betrifft nicht Dienstreisen (App nicht relevant).

**Bewusst NICHT umgesetzt:** Default-Umkehrung (steuerlich falsch — Default volle Pauschale ist gesetzlich), 4. Kachel "Tagesreise" (Architektur-Schaden — Master-Toggle erreicht dasselbe), Sammelfahrt-Aufweichung (semantischer Schaden), 3-Monats-Frist-Tracking (eigenes Feature im Backlog), Pauschalen aus DB (4h-Refactor, im Backlog).

**Antwort an Schulleiter-Feedback:** Sein Vorschlag (Default = keine Pauschale, Haken = "Erstattung an") wurde **nicht** umgesetzt — wäre steuerrechtlich falsch und marktfremd (alle 7 verglichenen Tools nutzen das aktuelle Pattern). Stattdessen Master-Toggle: bei "Nein, alles selbst bezahlt" verschwindet die Tabelle komplett. Sein eigentlicher Pain ist damit gelöst, gesetzlicher Default bleibt korrekt.

**Verifikation:** Frontend-tsc grün, Backend-tsc grün, Vitest 104/104 grün (98 + 6 neu).

### Phase 10: Sammelfahrt-Webhook + Versand-Refactor + Härtung (08.05.2026)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 10.1 | n8n: dritter Webhook-Trigger `credo-sammelfahrt` + HTML-Code-Node + Outlook-Branch (mit/ohne PDF) | ✅ | 2026-05-08 |
| 10.2 | HTML Sammelfahrt: Fahrtkostensammelantrag-Layout, blaue Akzentlinie (#009AC6), Einzelfahrten-Tabelle mit GESAMT-Zeile, feste Spaltenbreiten | ✅ | 2026-05-08 |
| 10.3 | AdminCenter: Filter-Option „Nur Sammelfahrten", `TypFilter`-Type-Alias eliminiert 4-fach Union-Duplikation, Dropdown aus `TYP_FILTER_LABELS`-Map generiert | ✅ | 2026-05-08 |
| 10.4 | Backend: `EINREICHUNG_TYPEN` als Single Source of Truth in `lib/constants.ts`; Zod-Schemas in `admin.ts` und Webhook-Types darauf umgestellt | ✅ | 2026-05-08 |
| 10.5 | Backend-Refactor: 3× identische ~50-Zeilen Versand-Logik aus `einreichungen.ts` in neue `services/versand.ts` extrahiert (Datei 738 → 583 LoC) | ✅ | 2026-05-08 |
| 10.6 | Backend-Refactor: pure Helpers (`matchesTypFilter`, `assertSafeWebhookUrl`, `isPrivateOrLoopbackHost`) in `services/webhook-utils.ts` ohne DB-Side-Effects → testbar ohne DB-Mock | ✅ | 2026-05-08 |
| 10.7 | n8n-Härtung in allen 3 HTML-Code-Nodes: `esc()`-Helper für User-Felder, PDF-Magic-Bytes-Check + try/catch, `rawBelegNr`-Fallback statt `[undefined].pdf` | ✅ | 2026-05-08 |
| 10.8 | UI-Polish: HTML Reisekosten Hinweis-Box-Akzent #dadada → #FBC900 (gelb), HTML Sammelfahrt Spaltenbreiten 14/28/28/13/17 % | ✅ | 2026-05-08 |
| 10.9 | Tests: neu `services/__tests__/webhook.test.ts` mit 23 Cases (typFilter ALLE/exakt/Mismatch + SSRF-Schutz für loopback/private/non-http) | ✅ | 2026-05-08 |
| 10.10 | Dokumentation: `n8n/WEBHOOK_DATENSTRUKTUR.md` erweitert (Webhook-Pfade-Tabelle, Setup-Anleitung pro Vorgangstyp, Härtungs-Patterns) | ✅ | 2026-05-08 |

**Code-Review:** 7 parallele Spezial-Agenten (Security, UI/UX, Performance, Architecture, Testing, Error Handling, Code Quality) haben den Branch geprüft. 1 CRITICAL (PDF Magic-Bytes), 11 MAJOR, 22 MINOR identifiziert — alle CRITICAL/MAJOR umgesetzt, MINOR/INFO selektiv soweit sinnvoll.

**Verifikation:** Backend-tsc grün, Frontend-tsc grün, vitest 98/98 Tests grün (vorher 75 + 23 neu), n8n-JSON-Smoke-Test mit XSS-Payload bestanden.

**Bewusst out of scope:** HMAC-Signatur-Verify in n8n (eigenes Topic mit Secret-Distribution), n8n-Filename-Versionierung (Bestandsschuld), Supertest-Integration-Tests (kein Express-Test-Setup vorhanden).

### Phase 8: n8n Workflow Fix — PDF-Anhang (07.05.2026)

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 8.1 | Bug identifiziert: n8n Code-Nodes lasen `pdfBase64`/`pdfDateiname` aus `d` (Einreichung), die Felder liegen aber auf Root-Ebene des Webhook-Payloads | ✅ | 2026-05-07 |
| 8.2 | Folge: `hasPdf=false`, IF-Node leitete zum „kein Anhang"-Outlook-Pfad → DMS-PDF mit QR-Code wurde nie als Anhang versendet | ✅ | 2026-05-07 |
| 8.3 | Patch in beiden Code-Nodes (`HTML Reisekosten` + `HTML Erstattung`): `_root.pdfBase64 \|\| d.pdfBase64` (Fallback bleibt für Robustheit) | ✅ | 2026-05-07 |
| 8.4 | Neue Datei `n8n/CREDO Finanzportal — E-Mail Versand (PDF-Fix).json` erstellt, Original (1).json zur Referenz behalten | ✅ | 2026-05-07 |
| 8.5 | Test-Einreichung mit Beleg-Upload: PDF (Hauptdokument mit Swiss QR-Code + eingebettete Belege) kommt korrekt als Anhang in der DMS-Mail an | ✅ | 2026-05-07 |

**Backend war nicht betroffen** — `erstelleGesamtPdf()` und `sendeWebhook()` arbeiteten korrekt; das PDF wurde erstellt und als Base64 im Webhook-Payload gesendet. Bug war ausschließlich im n8n-Mapping.

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
| 2026-05-07 | n8n Code-Nodes lesen `pdfBase64` von `_root` (Webhook-Payload-Wurzel) | Backend sendet PDF auf Root-Ebene, nicht in `einreichung` |
| 2026-05-08 | Eigener n8n-Webhook `credo-sammelfahrt` statt Erstattung-Pfad zu teilen | Saubere Trennung pro Vorgangstyp; eigenes HTML-Layout mit Fahrten-Tabelle und blauer Akzentlinie; `typFilter`-Routing im Backend |
| 2026-05-08 | Versand-Pipeline in `services/versand.ts` extrahiert | 3× identische ~50-Zeilen-Blöcke ergaben 1× Funktion; künftige Bug-Fixes nur an einer Stelle; `einreichungen.ts` von 738 auf 583 LoC |
| 2026-05-08 | `webhook-utils.ts` mit pure Functions, getrennt von `webhook.ts` | DB-freier Modul-Load → Unit-Tests ohne DB-Mock möglich |
| 2026-05-08 | Härtung der n8n-Code-Nodes (esc, Magic-Bytes, belegNr-Fallback) | Defense in depth: HTML-Injection bei intern eingespielten Feldern + kein Versand kaputter PDFs + nie `[undefined].pdf` |
| 2026-05-09 | Verpflegungs-Master-Toggle statt Default-Umkehrung | Schulleiter-Feedback wollte Default umkehren (steuerlich falsch). Master-Toggle "Verpflegung gestellt? Ja/Nein" mit Default "Nein" eliminiert die Tabelle für 80 % der Lehrer-Reisen ohne Buffet — gesetzlicher Default volle Pauschale bleibt. |
| 2026-05-09 | Auslandspauschalen mit Stadt-Differenzierung als flat keys | "Frankreich — Paris" als separater Eintrag im Dropdown statt nested-object-Refactor. Pragmatisch, transparent für User, kompatibel mit bestehender Auswahl-Logik. |
| 2026-05-09 | Apple-like Startseite im CREDO-CI | Monochrome Icons (Primärgrau) statt bunter Backgrounds. Akzent über dünnen Strich oben pro Card in CREDO-Farbe (Gelb/Grün/Blau analog HTML-Mail). Entkoppelt visuelle Hierarchie von Farbsignalen. |
| 2026-07-13 | Erstattungs-Kategorien pro Mandant konfigurierbar (DB statt Enum) | Wunsch: Kategorien von Dimitri pflegbar, pro Mandant. pgEnum blockierte neue Werte → Migration auf `varchar` + Tabelle `erstattung_kategorien`. Muster kombiniert aus Auslandspauschalen-CRUD + Kostenstellen-Mandant-Scoping. Key stabil (aus Bezeichnung abgeleitet), Label editierbar. Mandant 40 erhält „Schulleiterbudget". |
| 2026-07-13 | Plan „PLAN_Aenderungen_2026-07.md" in 3 Teilen (Kategorien → SMTP → Klassenfahrt) | Reihenfolge nach Nutzen/Abhängigkeit. Teil 1 zuerst (kleinster Block, sofort nutzbar). HTML-Prozessdokumente als Abstimmungsgrundlage, adversariale Lückenprüfung vor Umsetzung. |

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
