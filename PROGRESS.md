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
| 12.6 | ReisekostenFormular umgestellt: nutzt Hook statt Code-Konstante `AUSLANDSPAUSCHALEN`. Konstante in `vma.ts` bleibt als Default-Seed-Quelle für Tests/Fallback | ✅ | 2026-05-09 |
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

### Phase 15: Klassenfahrt-Abrechnung — Teil 3 (in Umsetzung, ab 14.07.2026)

Neuer Vorgangstyp `KLASSENFAHRT` (nur Mandant 40 = Christlicher Schulverein Minden e.V.). Lehrkräfte rechnen ab; berechnet wird der **FV-Zuschuss je Klasse** (= 1 Personen-Quote), Auszahlung getrennt je Klassenkonto.

| # | Aufgabe | Status | Datum |
|---|---|---|---|
| 15.1 | Plandokument (CREDO-CI-Artifact, Mockups + durchgerechnetes Beispiel) + adversariale Lückenprüfung gegen echten Code (40/40 Befunde bestätigt) | ✅ | 2026-07-14 |
| 15.2 | Berechnungsmodul `backend/src/lib/klassenfahrt.ts` (proportional/direkt, Zuschuss = K/(S+B) je Klasse cent-gerundet ≥ 0, Div-0-Guard) + **Golden-Master** gegen 3 Excel-Dateien (**281,80 €**) | ✅ | 2026-07-14 |
| 15.3 | DB-Fundament: `KLASSENFAHRT`-Enum + Migration `0011_klassenfahrt`; Tabellen `klassenfahrt_klassen`/`_kostenzeilen`/`_kostenzeile_anteil`; `bank_iban/bank_kontoinhaber` nullable; `idempotenz_key` (unique); belegNummer `KF`/Offset 4 | ✅ | 2026-07-14 |
| 15.4 | KF-PDF-Renderer `erstelleKlassenfahrtPdf` (Deckblatt: DMS-QR, Eckdaten, Auszahlungstabelle je Konto, Zeichnungsfelder Geprüft/Freigegeben/Überwiesen) + Muster `MUSTER_Klassenfahrt_KF-2026-00001.pdf`; Belege-Einbettung in gemeinsamen Helfer extrahiert | ✅ | 2026-07-15 |
| 15.5 | **Backend-Route:** KF-Branch in `einreichungen.ts` — M40-Gate, Server-Recompute über das Modul, Idempotenz-Check, Multi-Tabellen-Insert in einer Transaktion, Beleg-Pflicht serverseitig | ⏳ | offen |
| 15.6 | **Frontend-Wizard** (6 Schritte) + Berechnungs-Zwilling `frontend/src/lib/klassenfahrt.ts`, `IbanFeld`-Komponente je Klasse, `DezimalInput allowNegative`, Ganzzahl-Schüler, 4. Startseiten-Kachel (M40-only, CREDO-Rot), Erfolg-Seite parametrisiert, DSGVO-Art.13-Hinweis | ⏳ | offen |
| 15.7 | Querschnitt-Bestands-Bugs (betreffen alle Vorgänge): HEIC in `ALLOWED_MIME_TYPES`, Unterschrift-Biometrie bei ERSTATTUNG/SAMMELFAHRT löschen | ⏳ | offen |

**Getroffene Entscheidungen:** Gesamt = **281,80 €** (Summe der cent-gerundeten Auszahlungen, nicht Excel-Anzeige 281,79); `bankIban/bankKontoinhaber` nullable + Konten je Klasse in eigener Tabelle; Startseiten-Kachel immer sichtbar, Mandant im KF-Formular fest auf M40 + harter Server-Gate; QR = reine DMS-Zuordnung über die Belegnummer (kein Swiss-QR/CHF); Freigabe offline über leere Zeichnungsfelder aufs Deckblatt.

**Verifikation (bis 15.4):** Backend-tsc grün, 147 Vitest (inkl. 15 Golden-Master). Commits `8761627`, `d0ffbd1`, `edeb8e3`.

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
