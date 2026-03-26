# CREDO Finanzportal — Implementierungsplan

> **Version:** 1.1 | **Datum:** 2026-03-21 | **Status:** Freigegeben zur Umsetzung
>
> **Änderungen v1.1:** E-Mail-Versand direkt im Backend (n8n wird optional), neues AdminCenter-Modul "Versand & Integration", UI/UX-Designprinzipien (Circula-inspiriert), Docker-Architektur vereinfacht, CREDO CI durchgängig verankert

---

## 1. Projektübersicht

### 1.1 Vision
Ein atemberaubend schönes, intuitives Finanzportal im CREDO Corporate Design, das 400–1000 Mitarbeitern die Erfassung von Dienstreise-Fahrkostenabrechnungen und Erstattungen so einfach macht, dass sie es **gerne** nutzen.

### 1.2 Architektur-Überblick

```
┌──────────────────────────────────────────────────────────┐
│                    CREDO Finanzportal                     │
│            (React + Tailwind CSS + CREDO CI)             │
│                                                          │
│  ┌─────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Portal   │  │ AdminCenter  │  │ Mitarbeiter-Portal  │ │
│  │ Zugang   │  │ (Verwaltung) │  │ (Abrechnungen)      │ │
│  │ (intern) │  │              │  │                     │ │
│  └─────────┘  └──────┬───────┘  └─────────────────────┘ │
│                       │                                   │
│               ┌───────┴────────┐                         │
│               │ Versand &      │                         │
│               │ Integration    │                         │
│               │ (Admin-UI)     │                         │
│               └────────────────┘                         │
└──────────────────────┬───────────────────────────────────┘
                       │ REST API
┌──────────────────────┴───────────────────────────────────┐
│                    Backend (Node.js)                      │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Auth     │ │ Abrech-  │ │ PDF-     │ │ QR-Code-   │  │
│  │ Service  │ │ nungs-   │ │ Generator│ │ Generator  │  │
│  │          │ │ Engine   │ │ (PDF/A)  │ │ (Swiss QR) │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ Beleg-   │ │ E-Mail-  │ │ Config-  │                 │
│  │ Manager  │ │ Service  │ │ Service  │                 │
│  │          │ │ (direkt) │ │ (Pausch.)│                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
│  ┌──────────┐                                            │
│  │ Webhook- │  ← Optional: für n8n oder externe Systeme  │
│  │ Service  │                                            │
│  └──────────┘                                            │
└──────────────────────┬───────────────────────────────────┘
                       │ E-Mail (direkt via SMTP / MS Graph)
                       │ + Optional: Webhook (POST) → n8n
┌──────────────────────┴───────────────────────────────────┐
│                    DMS Docubit                            │
│          (Swiss QR-Code auslesen → Fibu)                 │
└──────────────────────────────────────────────────────────┘
```

---

## 2. UI/UX-Designprinzipien (CREDO CI + Circula-Inspiration)

### 2.1 Design-Philosophie
Inspiriert von Circula's klarer, moderner Oberfläche — umgesetzt im CREDO Corporate Design.
Das Portal soll so einfach sein, dass eine Lehrkraft ohne Schulung eine Reisekostenabrechnung einreichen kann.

### 2.2 Designprinzipien

| Prinzip | Umsetzung |
|---|---|
| **Klarheit** | Große, lesbare Typografie. Ein Schritt pro Bildschirm. Keine überladenen Formulare |
| **Führung** | Schritt-für-Schritt-Wizard (nicht ein langes Formular). Fortschrittsbalken oben |
| **Feedback** | Sofortige Validierung, Live-Vorschau des Betrags, Erfolgs-Animationen |
| **Mobile First** | Touch-optimiert, große Buttons, Kamera-Upload für Belege |
| **Barrierefreiheit** | WCAG 2.1 AA, Tastaturnavigation, Screenreader-kompatibel |

### 2.3 CREDO Corporate Design

| Element | Spezifikation |
|---|---|
| **Primärfarbe (Verwaltung)** | Grau (#6B7280) — Default, wenn kein Mandant gewählt |
| **Mandantenfarben** | Jede Einrichtung hat eigene Primärfarbe (im AdminCenter konfigurierbar) |
| **Schriftart** | System-Font-Stack (Inter als Fallback) — oder CREDO-Hausschrift wenn vorhanden |
| **Logo** | CREDO-Logo oben links, Mandanten-Logo kontextabhängig |
| **Radius** | Abgerundete Ecken (8px) — modern, freundlich |
| **Schatten** | Subtile Schatten für Karten und Modals (shadow-sm/shadow-md) |
| **Farbschema** | Hell (Standard) mit optionalem Dark Mode für Admins |

### 2.4 Komponenten-Design (shadcn/ui + CREDO)

| Komponente | Stil |
|---|---|
| **Formulare** | Card-basiert, ein Thema pro Card, sanfte Übergänge |
| **Buttons** | Primär: Mandantenfarbe, Sekundär: Grau, Gefahr: Rot |
| **Tabellen** | Zebra-Streifen, sortierbar, suchbar, paginiert |
| **Benachrichtigungen** | Toast-Notifications oben rechts (Erfolg: Grün, Fehler: Rot, Info: Blau) |
| **Beleg-Upload** | Drag & Drop Zone mit Kamera-Icon (Mobile), Vorschau-Thumbnails |
| **Wizard** | Horizontal-Stepper: Reisedaten → Fahrkosten → Verpflegung → Belege → Zusammenfassung |

### 2.5 Responsive Breakpoints
| Breakpoint | Zielgerät | Layout |
|---|---|---|
| < 640px | Smartphone | Einspaltiges Layout, Bottom-Navigation |
| 640–1024px | Tablet | Zweispaltiges Layout für Formulare |
| > 1024px | Desktop | Sidebar + Content, AdminCenter Vollansicht |

---

## 3. Tech-Stack

| Komponente | Technologie | Begründung |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Tailwind CSS + shadcn/ui | Schnelle Entwicklung, CREDO CI umsetzbar, komponenten-basiert |
| **Backend** | Node.js + Express + TypeScript | Gleiche Sprache wie Frontend, große Ökosystem |
| **Datenbank** | PostgreSQL | Relational, ACID-konform, GoBD-geeignet |
| **Dateispeicher** | S3-kompatibler Object Store (MinIO self-hosted oder AWS S3) | Skalierbar für 600.000+ Belege in 5 Jahren |
| **PDF-Engine** | pdf-lib (Open Source) + sharp (Bildoptimierung) | PDF/A-Erzeugung, keine Lizenzkosten |
| **QR-Code** | swissqrbill (npm) | Swiss QR Standard, validiert |
| **E-Mail-Versand** | Nodemailer (SMTP) + @microsoft/microsoft-graph-client (MS Graph API) | Direkter Versand ohne externe Abhängigkeit, Retry-Logik im Backend |
| **Webhook (optional)** | Express-Webhook-Endpunkt | Für n8n oder andere externe Systeme — im AdminCenter konfigurierbar |
| **Auth** | Kein Login — Portal nur im internen Netz erreichbar. Kein Account, kein Passwort. Mitarbeiter gibt Name + Personalnr. + IBAN direkt im Formular ein. Reine Self-Service-Einreichung → DMS übernimmt Weiterverarbeitung | Maximale Einfachheit für 400–1000 Mitarbeiter |
| **Hosting** | Docker Container (self-hosted oder Cloud EU) | DSGVO-konform, skalierbar |

---

## 3. Module & Features

### 3.1 Modul: Mitarbeiter-Portal (Self-Service)

> **Konzept:** Kein Login, kein Passwort. Das Portal ist nur aus dem internen CREDO-Netz erreichbar. Der Mitarbeiter öffnet die URL, gibt seine Daten ein, reicht ein — fertig. Kein Account, kein Dashboard, kein Status-Tracking. Das Portal ist ein **digitaler Briefkasten**: Einwerfen und fertig. Die Weiterverarbeitung erfolgt ausschließlich im DMS Docubit.

#### 3.1.1 Startseite — Typenauswahl

Der Mitarbeiter wird direkt begrüßt und wählt, was er einreichen möchte:

```
┌──────────────────────────────────────────────────────┐
│  [CREDO Logo]                                        │
│                                                      │
│  Willkommen im CREDO Finanzportal                    │
│                                                      │
│  Was möchten Sie einreichen?                         │
│                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐   │
│  │  🚗                 │  │  🧾                 │   │
│  │  Reisekosten-       │  │  Kosten-            │   │
│  │  abrechnung         │  │  erstattung         │   │
│  │                     │  │                     │   │
│  │  Dienstreisen mit   │  │  Auslagen für       │   │
│  │  Fahrtkosten, VMA,  │  │  Material, Büro-    │   │
│  │  Übernachtung       │  │  bedarf, Sonstiges  │   │
│  └─────────────────────┘  └─────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.1.2 Formular: Reisekostenabrechnung

**Step 1 — Persönliche Daten (Pflicht):**
| Feld | Typ | Hinweis |
|---|---|---|
| Vorname + Nachname | Textfelder | Pflicht |
| Personalnummer | Zahl | Pflicht — wird auf PDF + QR-Code gedruckt |
| IBAN | IBAN-Feld (formatiert, validiert) | Pflicht — DE-IBAN-Validierung (22 Stellen) |
| Kontoinhaber | Textfeld | Pflicht — kann abweichen vom Mitarbeiternamen |
| Mandant | Dropdown (aus AdminCenter) | Pflicht — bestimmt DMS-Ziel-E-Mail + QR-Code |
| Kostenstelle | Dropdown (mandantenabhängig) | Pflicht — lädt dynamisch nach Mandantenwahl |

**Step 2 — Reisedaten (Pflicht):**
| Feld | Typ | Validierung |
|---|---|---|
| Dienstreiseanlass | Textfeld (min. 10 Zeichen) | Pflicht — konkreter Grund, nicht nur "Dienstreise" |
| Reiseziel | Adresse (Autocomplete) | Pflicht |
| Abfahrtsort | Radio: "Wohnung" / "Erste Tätigkeitsstätte" | Pflicht — steuerrechtlich relevant! |
| Datum + Uhrzeit Abfahrt | DateTime-Picker | Pflicht |
| Datum + Uhrzeit Rückkehr | DateTime-Picker | Pflicht, muss nach Abfahrt liegen |
| Inland / Ausland | Toggle + Länderauswahl | Pflicht — bestimmt Pauschalen |

**Step 3 — Fahrkosten (Pflicht):**
| Feld | Typ | Berechnung |
|---|---|---|
| Verkehrsmittel | Dropdown: PKW / Motorrad / ÖPNV / Bahn / Flug / Sonstige | Pflicht |
| Gefahrene km (bei PKW/Motorrad) | Zahl | Auto-Vorschlag via Routenberechnung |
| Strecke (Start → Ziel) | Adressfelder mit Routenberechnung | Plausibilitätsprüfung |
| Ticketkosten (bei ÖPNV/Bahn/Flug) | Betrag + Beleg-Upload | Pflicht bei öffentl. Verkehrsmitteln |
| **Automatische Berechnung** | km × Pauschale | PKW: 0,30 EUR/km, Motorrad: 0,20 EUR/km |

**Step 4 — Verpflegungsmehraufwand (automatisch berechnet):**

Berechnungslogik:
| Logik | Inland | Ausland |
|---|---|---|
| > 8h eintägig | 14 EUR | Ländersatz (BMF-Tabelle) |
| An-/Abreisetag mit Übernachtung | je 14 EUR | je Ländersatz |
| Voller Kalendertag (24h) | 28 EUR | Ländersatz |
| **Kürzung Frühstück** | -5,60 EUR (20% von 28 EUR) | -20% vom Ländersatz |
| **Kürzung Mittagessen** | -11,20 EUR (40% von 28 EUR) | -40% vom Ländersatz |
| **Kürzung Abendessen** | -11,20 EUR (40% von 28 EUR) | -40% vom Ländersatz |
| **Minimum** | 0 EUR (nie negativ) | 0 EUR |

**Tagesweise Erfassung bei mehrtägigen Reisen:**
Das System berechnet aus Abfahrt/Rückkehr automatisch die Reisetage und zeigt pro Tag eine Zeile:

```
┌──────────────────────────────────────────────────────────────────┐
│  Verpflegungsmehraufwand                                         │
│                                                                  │
│  Tag        │ Typ          │ Frühst. │ Mittag │ Abend │ Betrag  │
│  ─────────────────────────────────────────────────────────────── │
│  Mo 19.03.  │ Anreisetag   │  □      │  ☑     │  □    │  2,80 € │
│  Di 20.03.  │ Ganztag      │  ☑      │  □     │  □    │ 22,40 € │
│  Mi 21.03.  │ Ganztag      │  ☑      │  □     │  □    │ 22,40 € │
│  Do 22.03.  │ Abreisetag   │  ☑      │  □     │  □    │  8,40 € │
│  ─────────────────────────────────────────────────────────────── │
│  Gesamt Verpflegungsmehraufwand:                        56,00 € │
└──────────────────────────────────────────────────────────────────┘
```

> Checkboxen = "Mahlzeit wurde gestellt" (Haken = Kürzung). Bei Auslandsreisen wird der Ländersatz automatisch eingesetzt.

**Step 5 — Weitere Kosten + Belege:**
| Feld | Typ |
|---|---|
| Übernachtungskosten | Betrag + Beleg-Upload |
| Parkgebühren | Betrag + Beleg-Upload |
| Maut | Betrag + Beleg-Upload |
| Sonstige Nebenkosten | Betrag + Beschreibung + Beleg-Upload |

**Step 6 — Zusammenfassung + Einreichen:**
- Live-Vorschau der Gesamtabrechnung (alle Positionen auf einen Blick)
- Bankdaten-Anzeige (IBAN + Kontoinhaber — aus Step 1)
- Mandant + Kostenstelle (aus Step 1)
- Digitale Unterschrift (Canvas-basiert, Finger/Maus/Stift)
- Button: **"Verbindlich einreichen"**

> Nach dem Einreichen: Erfolgsseite mit Beleg-Nummer und Hinweis "Ihre Abrechnung wurde an die Buchhaltung weitergeleitet." Keine weitere Statusverfolgung — das DMS übernimmt.

---

#### 3.1.3 Formular: Kostenerstattung (Auslagen)

Einfaches, kurzes Formular für Sachkosten ohne Reisebezug (Büromaterial, Fachliteratur, Arbeitsmittel etc.).

**Step 1 — Persönliche Daten + Zuordnung (Pflicht):**
| Feld | Typ | Hinweis |
|---|---|---|
| Vorname + Nachname | Textfelder | Pflicht |
| Personalnummer | Zahl | Pflicht |
| IBAN | IBAN-Feld (formatiert, validiert) | Pflicht — DE-IBAN-Validierung (22 Stellen) |
| Kontoinhaber | Textfeld | Pflicht — kann abweichen vom Mitarbeiternamen |
| Mandant | Dropdown (aus AdminCenter) | Pflicht — bestimmt DMS-Ziel-E-Mail |
| Kostenstelle | Dropdown (mandantenabhängig) | Pflicht |

**Step 2 — Positionen (eine oder mehrere):**

Der Mitarbeiter kann **mehrere Positionen** in einer Erstattung erfassen:

| Feld | Typ | Hinweis |
|---|---|---|
| Beschreibung | Textfeld (min. 5 Zeichen) | Was wurde gekauft/bezahlt? |
| Kategorie | Dropdown | Büromaterial / Fachliteratur / Lebensmittel / Arbeitsmittel / Fortbildung / Sonstiges |
| Datum | Date-Picker | Kaufdatum |
| Betrag (brutto) | Betrag | Pflicht |
| Beleg | Upload (PDF/JPG/PNG/HEIC) | Pflicht — mindestens ein Beleg pro Position |

Button: **"+ Weitere Position hinzufügen"**

```
┌──────────────────────────────────────────────────────────────┐
│  Ihre Positionen                                              │
│                                                               │
│  1. Bastelmaterial Kunstunterricht      │  23,50 € │ ✓ Beleg │
│  2. Druckerpatronen Lehrerzimmer        │  45,99 € │ ✓ Beleg │
│  3. Fachbuch "Medienpädagogik"          │  29,90 € │ ✓ Beleg │
│  ──────────────────────────────────────────────────────────── │
│  Gesamt:                                │  99,39 € │         │
│                                                               │
│  [+ Weitere Position hinzufügen]                              │
└──────────────────────────────────────────────────────────────┘
```

**Step 3 — Zusammenfassung + Einreichen:**
- Alle Positionen mit Belegen auf einen Blick
- Bankdaten-Anzeige (IBAN + Kontoinhaber)
- Mandant + Kostenstelle
- Gesamtbetrag
- Digitale Unterschrift
- Button: **"Verbindlich einreichen"**

> § 14 UStG Hinweis wird bei jedem Beleg-Upload angezeigt (wie bei Reisekosten).

#### 3.1.3 Beleg-Upload
- Drag & Drop oder Kamera-Aufnahme (Mobile)
- Akzeptierte Formate: PDF, JPG, PNG, HEIC
- Max. Dateigröße: 10 MB pro Beleg
- Bildoptimierung: Automatisches Zuschneiden, Perspektivkorrektur
- **§ 14 UStG Hinweis-Banner** bei jedem Beleg-Upload:

> **Hinweis zur ordnungsgemäßen Rechnung (§ 14 UStG):**
> Bitte stellen Sie sicher, dass Ihr Beleg folgende Angaben enthält:
> - Name und Anschrift des Rechnungsstellers
> - Rechnungsdatum
> - Menge und Art der Leistung
> - Bruttobetrag inkl. Steuersatz
>
> **Bei Beträgen über 250 EUR zusätzlich:**
> - Steuernummer oder USt-IdNr.
> - Fortlaufende Rechnungsnummer
> - Separater Steuerausweis (Netto + USt)
> - Name und Anschrift des Leistungsempfängers (CREDO)

#### 3.1.4 Duplikaterkennung
- Hash-Vergleich hochgeladener Belege (SHA-256)
- Abgleich: Datum + Betrag + Belegtyp (abrechnungsübergreifend)
- Warnung bei Verdacht: "Dieser Beleg wurde möglicherweise bereits eingereicht am [Datum]."

#### 3.1.5 Plausibilitätsprüfungen
- km-Angabe vs. Routenberechnung: Warnung bei > 20% Abweichung
- Verpflegungsmehraufwand: Automatische Dreimonats-Warnung bei Wiederholungsreisen zum selben Ort
- Gesamtbetrag: Warnung bei ungewöhnlich hohen Beträgen (Schwellenwert konfigurierbar)
- Zeitliche Konsistenz: Abfahrt < Rückkehr, keine überlappenden Reisen

---

### 3.2 Modul: AdminCenter

#### 3.2.1 Mandantenverwaltung
- Mandanten anlegen / bearbeiten / deaktivieren (nie löschen — historische Daten!)
- **Mandantennummer** (z.B. 10, 11, 12, 30, 31, 32) — frei wählbar, unique
- **Kategorie** zur Gruppierung (z.B. "Grundschulen", "Weiterführende Schulen", "Kitas", "Verwaltung")
- **Pro Mandant: DMS-E-Mail-Adresse hinterlegen** (z.B. fibu-gs-haddenhausen@docubit.credo.de)
- Kostenstellen pro Mandant pflegen
- Primärfarbe pro Mandant (CREDO CI — jede Einrichtung hat eigene Farbe)
- Logo und Bezeichnung pro Mandant
- Übersicht: Alle Mandanten mit DMS-E-Mail und Anzahl eingegangener Einreichungen
- **Mandanten-Dropdown im Self-Service:** Der Mitarbeiter wählt bei jeder Einreichung selbst den Mandanten aus der Liste aller aktiven Mandanten

#### 3.2.2 Pauschalen-Verwaltung
- **Inlandspauschalen** mit Gültigkeitszeitraum (von–bis)
  - Kilometerpauschale PKW, Motorrad
  - Verpflegungsmehraufwand (8h / 24h / An-/Abreisetag)
  - Kürzungssätze (Frühstück %, Mittag %, Abend %)
- **Auslandspauschalen-Tabelle (BMF)**
  - Land, Ort (bei abweichenden Sätzen)
  - Tagessatz 24h, Tagessatz >8h
  - Übernachtungspauschale
  - Gültigkeitsjahr
  - Import-Funktion (CSV) für jährliche BMF-Aktualisierung

#### 3.2.3 Admin-Zugang
- Das AdminCenter ist durch ein Passwort geschützt (nur für Verwaltungsmitarbeiter)
- **Keine Mitarbeiter-Accounts** — das Self-Service-Portal braucht keinen Login
- Admin-Passwort wird beim Erstsetup gesetzt und ist im AdminCenter änderbar
- Optional: Mehrere Admin-Zugänge mit E-Mail + Passwort

#### 3.2.4 Versand & Integration (NEU in v1.1)

Zentrales Admin-Modul für E-Mail-Versand und externe Anbindungen — **kein technisches Wissen nötig**.

**E-Mail-Konfiguration:**
| Feld | Typ | Beschreibung |
|---|---|---|
| Versandmethode | Dropdown | **Microsoft 365** (Graph API) / **SMTP** (beliebiger Mailserver) |
| MS 365: Tenant-ID | Text (verschlüsselt) | Azure AD Tenant für Graph API |
| MS 365: Client-ID | Text (verschlüsselt) | App-Registration Client-ID |
| MS 365: Client-Secret | Text (verschlüsselt) | App-Registration Secret |
| SMTP: Server | Text | z.B. smtp.office365.com |
| SMTP: Port | Zahl | z.B. 587 (TLS) |
| SMTP: Benutzer | Text (verschlüsselt) | SMTP-Login |
| SMTP: Passwort | Text (verschlüsselt) | SMTP-Passwort |
| Absender-Name | Text | z.B. "CREDO Finanzportal" |
| Absender-E-Mail | E-Mail | z.B. finanzportal@credo.de |
| **Test-E-Mail senden** | Button | Sendet Test-PDF an Admin-E-Mail zur Verifizierung |

> **Sicherheit:** Alle Credentials werden AES-256-verschlüsselt in der Datenbank gespeichert. Klartext ist nur im Arbeitsspeicher während des Versands sichtbar.

**Retry & Fehlerbehandlung:**
| Einstellung | Default | Beschreibung |
|---|---|---|
| Max. Versuche | 3 | Anzahl Wiederholungsversuche bei Fehlschlag |
| Wartezeit (Backoff) | 30s / 60s / 120s | Exponentiell steigende Wartezeit |
| Fehler-E-Mail | (Admin-E-Mail) | Benachrichtigung bei endgültigem Fehlschlag |
| Auto-Retry aktiv | Toggle (Standard: AN) | Automatische Wiederholung ein/aus |

**Webhook-Konfiguration (optional):**
| Feld | Typ | Beschreibung |
|---|---|---|
| Webhook aktiv | Toggle | Ein/Aus — standardmäßig AUS |
| Webhook-URL | URL | z.B. https://n8n.credo.de/webhook/abrechnung |
| Webhook-Secret | Text (auto-generiert) | HMAC-Secret für Signaturprüfung (kopierbar) |
| Webhook-Events | Checkboxen | "Abrechnung eingereicht" / "Status geändert" / "Fehler" |
| **Webhook testen** | Button | Sendet Test-Payload an URL, zeigt Response |

> **Hinweis:** Webhooks sind für zukünftige Erweiterungen gedacht (z.B. n8n-Workflows, externe Benachrichtigungen). Der Kern-E-Mail-Versand funktioniert ohne Webhooks.

**DMS-E-Mail pro Mandant:**
- Bereits in Mandantenverwaltung (3.2.1) konfiguriert
- Hier: Übersichtstabelle aller Mandanten mit DMS-E-Mail + letzter Versandstatus
- Bulk-Test: "Alle DMS-E-Mails testen" — sendet leere Test-E-Mail an jede Adresse

#### 3.2.5 System-Konfiguration
- Schwellenwerte für Plausibilitätswarnungen
- QR-Code-Feldkonfiguration (welche Daten codiert werden)
- Firmenlogo + CI-Farben für PDF (CREDO CI)

#### 3.2.6 Protokoll & Monitoring
- **Versand-Log:** Welche Abrechnung wann an welche E-Mail gesendet (Erfolg/Fehler/Retry)
- **Webhook-Log:** Payload, Response-Code, Dauer — nur wenn Webhook aktiv
- **E-Mail-Warteschlange:** Aktuelle Warteschlange mit Status (Ausstehend/Gesendet/Fehlgeschlagen)
- **Audit-Trail:** Alle Änderungen an Konfiguration und Abrechnungen

---

### 3.3 Modul: PDF-Generierung

#### 3.3.1 Hauptdokument (Seite 1–n)
```
┌──────────────────────────────────────────────────────┐
│  [CREDO Logo]              REISEKOSTENABRECHNUNG     │
│                                                      │
│  ┌────────────┐                                      │
│  │  Swiss QR  │  Mandant: FES Gymnasium              │
│  │   Code     │  Datum: 2026-03-19                   │
│  │            │  Beleg-Nr: RK-2026-00142             │
│  └────────────┘  Mitarbeiter: Max Mustermann         │
│                  Personal-Nr: 12345                   │
│                                                      │
│  ─── REISEDATEN ──────────────────────────────────── │
│  Anlass:     Fortbildung Medienkompetenz             │
│  Ziel:       Köln, Messehalle 5                      │
│  Abfahrt:    19.03.2026, 07:00 Uhr (Wohnung)        │
│  Rückkehr:   19.03.2026, 19:30 Uhr                  │
│  Abwesenheit: 12h 30min                              │
│                                                      │
│  ─── FAHRKOSTEN ─────────────────────────────────── │
│  Verkehrsmittel: PKW                                 │
│  Strecke:    Düsseldorf → Köln → Düsseldorf          │
│  Entfernung: 86 km (Routenberechnung: 84 km)        │
│  Pauschale:  86 km × 0,30 EUR = 25,80 EUR           │
│                                                      │
│  ─── VERPFLEGUNGSMEHRAUFWAND ────────────────────── │
│  Abwesenheit > 8h:           14,00 EUR               │
│  Kürzung Mittagessen (40%): - 11,20 EUR              │
│  Verpflegung gesamt:          2,80 EUR               │
│                                                      │
│  ─── WEITERE KOSTEN ────────────────────────────── │
│  Parkgebühr (Beleg 1):        8,50 EUR               │
│                                                      │
│  ═══════════════════════════════════════════════════ │
│  GESAMTBETRAG:              37,10 EUR                │
│  ═══════════════════════════════════════════════════ │
│                                                      │
│  Kostenstelle: 4200 (Gymnasium)                      │
│                                                      │
│  ─── BANKVERBINDUNG ──────────────────────────── │
│  Kontoinhaber: Max Mustermann                        │
│  IBAN:         DE89 3704 0044 0532 0130 00           │
│                                                      │
│  ─── DIGITALE UNTERSCHRIFT ─────────────────────── │
│  [Unterschrift-Bild]                                 │
│  Max Mustermann, 19.03.2026 19:45 Uhr               │
│                                                      │
│  ─── ANLAGEN ───────────────────────────────────── │
│  1. Parkquittung_Koeln.pdf                           │
│  ─────────────────────────────────────────────────── │
│  Erstellt am 19.03.2026 19:45 | Beleg-Nr RK-2026-00142 │
│  Hinweis: Dieses Dokument wurde digital erstellt.    │
│  Die Unveränderbarkeit wird durch das DMS sichergest.│
└──────────────────────────────────────────────────────┘
```

#### 3.3.2 PDF-Template: Kostenerstattung
```
┌──────────────────────────────────────────────────────┐
│  [CREDO Logo]              KOSTENERSTATTUNG          │
│                                                      │
│  ┌────────────┐                                      │
│  │  Swiss QR  │  Mandant: FES Gymnasium              │
│  │   Code     │  Datum: 21.03.2026                   │
│  │            │  Beleg-Nr: KE-2026-00143             │
│  └────────────┘  Mitarbeiter: Anna Schmidt           │
│                  Personal-Nr: 67890                   │
│                                                      │
│  ─── POSITIONEN ─────────────────────────────────── │
│  #  │ Beschreibung              │ Datum    │ Betrag  │
│  ───┼───────────────────────────┼──────────┼──────── │
│  1  │ Bastelmaterial Kunst      │ 18.03.26 │ 23,50 € │
│  2  │ Druckerpatronen           │ 19.03.26 │ 45,99 € │
│  3  │ Fachbuch Medienpädagogik  │ 20.03.26 │ 29,90 € │
│                                                      │
│  ═══════════════════════════════════════════════════ │
│  GESAMTBETRAG:              99,39 EUR                │
│  ═══════════════════════════════════════════════════ │
│                                                      │
│  Kostenstelle: 4200 (Gymnasium)                      │
│                                                      │
│  ─── BANKVERBINDUNG ──────────────────────────── │
│  Kontoinhaber: Anna Schmidt                          │
│  IBAN:         DE02 1234 5678 9012 3456 78           │
│                                                      │
│  ─── DIGITALE UNTERSCHRIFT ─────────────────────── │
│  [Unterschrift-Bild]                                 │
│  Anna Schmidt, 21.03.2026 14:30 Uhr                 │
│                                                      │
│  ─── ANLAGEN ───────────────────────────────────── │
│  1. Kassenbon_Bastelmaterial.jpg                     │
│  2. Rechnung_Druckerpatronen.pdf                     │
│  3. Rechnung_Fachbuch.pdf                            │
│  ─────────────────────────────────────────────────── │
│  Erstellt am 21.03.2026 14:30 | Beleg-Nr KE-2026-00143│
│  Hinweis: Dieses Dokument wurde digital erstellt.    │
└──────────────────────────────────────────────────────┘
```

#### 3.3.3 Anlagen (ab Seite n+1) — Alles in EINER PDF

> **Wichtig:** Der Versand an das DMS erfolgt als **eine einzige zusammengefasste PDF-Datei**.
> Es werden KEINE separaten Anhänge versendet. Das Hauptdokument (Abrechnung/Erstattung)
> und alle Belege werden zu einem einzigen PDF/A-Dokument zusammengeführt.

Aufbau der zusammengefassten PDF:
1. **Seite 1–n:** Hauptdokument (Reisekosten- oder Erstattungsformular mit QR-Code)
2. **Ab Seite n+1:** Alle hochgeladenen Belege als Folgeseiten
   - Jeder Beleg mit Seitennummer und Zuordnung ("Anlage 1: Parkquittung")
   - Bilder werden auf A4 skaliert, PDF-Belege werden direkt eingebettet
   - Bildqualität optimiert (≥ 150 DPI, max. 300 DPI)
3. **Letzte Seite:** Inhaltsverzeichnis der Anlagen (optional)

Die E-Mail an das DMS enthält genau **einen** Anhang: die zusammengefasste PDF.

#### 3.3.3 Swiss QR-Code — Inhalt
```
Codierte Felder:
- Mandant-ID / Mandant-Name
- Beleg-Nummer (eindeutig, fortlaufend)
- Gesamtbetrag
- Datum der Einreichung
- Mitarbeiter-Personalnummer
- Kostenstelle
- Dokumenttyp: "REISEKOSTEN" oder "ERSTATTUNG"
```
→ Docubit liest den QR-Code und ordnet den Vorgang automatisch zu

#### 3.3.4 PDF/A-Konformität
- Format: **PDF/A-3b** (ISO 19005-3) — langzeitarchivfähig
- Eingebettete Fonts (kein Verweis auf System-Fonts)
- Eingebettetes Farbprofil (sRGB)
- Keine Transparenzen, keine JavaScript, keine externen Links

---

### 3.4 Modul: E-Mail-Versand & DMS-Anbindung (v1.1 — ersetzt n8n-Pflicht)

#### 3.4.1 Ablauf (direkt im Backend)
```
Portal (Backend)                                          DMS Docubit
  │                                                          │
  │  1. Abrechnung eingereicht                               │
  │  2. PDF/A generieren (mit Swiss QR-Code)                 │
  │  3. Mandant → DMS-E-Mail nachschlagen                    │
  │  4. E-Mail zusammenbauen:                                │
  │     - An: fibu-gs-haddenhausen@docubit.credo.de          │
  │     - Betreff: [RK-2026-00142] Max Mustermann - Gym       │
  │       (oder [KE-2026-00143] bei Kostenerstattung)       │
  │     - Anhang: PDF + Belege                               │
  │  5. Senden via SMTP oder MS Graph API                    │
  │ ────────────────────────────────────────────────────────> │
  │                                                          │
  │  6. Status → GESENDET                                    │
  │     (bei Fehler: Retry → FEHLER → Admin-Alert)           │
  │                                                          │
  │  7. Optional: Webhook an n8n/externe Systeme             │
  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ > │
```

#### 3.4.2 E-Mail-Service (Node.js)
- **Primär:** Nodemailer (SMTP) oder @microsoft/microsoft-graph-client (MS Graph)
- **Konfiguration:** Über AdminCenter "Versand & Integration" (3.2.4) — kein Code nötig
- **Queue:** Bull/BullMQ mit Redis — asynchrone Verarbeitung, keine Blockierung der API
- **Retry-Logik:** Konfigurierbar im AdminCenter (Default: 3x mit exponentiellem Backoff)
- **Logging:** Jeder Versandversuch wird protokolliert (Zeitstempel, Status, Fehlerdetails)
- **Admin-Alert:** Bei endgültigem Fehlschlag E-Mail an konfigurierte Admin-Adresse

> **Azure AD Setup:** Für MS Graph wird eine App-Registration benötigt mit `Mail.Send`-Berechtigung. Tenant-ID, Client-ID und Client-Secret werden verschlüsselt im AdminCenter hinterlegt.

#### 3.4.3 Webhook-Service (optional)
- Konfigurierbar im AdminCenter (3.2.4) — standardmäßig deaktiviert
- Events: "Abrechnung eingereicht", "Status geändert", "Versand fehlgeschlagen"
- HMAC-SHA256-Signatur im Header `X-CREDO-Signature`
- Payload enthält: beleg_nr, mandant_id, status, zeitstempel
- Anwendungsfälle: n8n-Workflows, externe Benachrichtigungen, Drittanbieter-Integration

#### 3.4.4 Sicherheit
- E-Mail-Credentials AES-256-verschlüsselt in der Datenbank
- Webhook-Secret auto-generiert, HMAC-signiert
- Alle Versand-Logs revisionssicher (INSERT-only)
- TLS-Pflicht für SMTP und Graph API

---

## 4. Datenmodell (Kernentitäten)

### Mandanten-Struktur (CREDO Gruppe)

Die Mandanten folgen einem numerischen Schema. Neue Mandanten werden im AdminCenter angelegt:

| Nr. | Mandant | Kategorie | DMS-E-Mail |
|---|---|---|---|
| 10 | Grundschule Haddenhausen | Grundschulen | (im Admin konfigurierbar) |
| 11 | Grundschule Stemwede | Grundschulen | (im Admin konfigurierbar) |
| 12 | Grundschule Minderheide | Grundschulen | (im Admin konfigurierbar) |
| 30 | Gesamtschule | Weiterführende Schulen | (im Admin konfigurierbar) |
| 31 | Gymnasium | Weiterführende Schulen | (im Admin konfigurierbar) |
| 32 | Berufskolleg | Weiterführende Schulen | (im Admin konfigurierbar) |
| ... | (erweiterbar im AdminCenter) | | |

> **Hinweis:** Mandantennummern und Kategorien sind frei wählbar im AdminCenter. Das System erzwingt kein Nummernschema, ermöglicht aber die Gruppierung nach Kategorie für Filter und Reporting.
>
> **Regel:** Jede Abrechnung gehört immer zu genau **einem** Mandanten. Der Mandant bestimmt die DMS-Ziel-E-Mail und wird im QR-Code codiert. Ein Mitarbeiter, der für mehrere Mandanten arbeitet, erstellt pro Mandant eine separate Abrechnung.

```
┌──────────────────────┐     ┌──────────────────┐
│  Mandant              │────<│  Kostenstelle    │
│──────────────────────│     │──────────────────│
│ id                    │     │ id               │
│ mandant_nr (unique)   │     │ mandant_id (FK)  │
│ name                  │     │ bezeichnung      │
│ kategorie             │     │ nummer           │
│ dms_email             │     └──────────────────┘
│ primaerfarbe (CI)     │
│ active                │
│ created_at            │
│ updated_at            │
└──────────────────────┘

> **Kein User-Stammdaten-Modell nötig.** Da es kein Login gibt, werden
> persönliche Daten (Name, Personalnummer, IBAN, Kontoinhaber) direkt
> pro Einreichung erfasst. Es gibt keine Benutzerkonten.

┌──────────────────────────────────────────┐
│  Einreichung                              │
│──────────────────────────────────────────│
│ id                                        │
│ **typ (REISEKOSTEN / ERSTATTUNG)**        │  ← NEU: bestimmt Formularpfad + PDF-Template
│ beleg_nr (unique, fortlaufend)            │  ← RK-2026-00142 oder KE-2026-00143
│ mandant_id (FK)                           │
│ kostenstelle_id (FK)                      │
│ status (EINGEREICHT / GESENDET / FEHLER)  │  ← Kein ENTWURF (Self-Service = sofort einreichen)
│                                           │
│ -- Persönliche Daten (pro Einreichung) -- │
│ mitarbeiter_vorname                       │
│ mitarbeiter_nachname                      │
│ mitarbeiter_personal_nr                   │
│ bank_iban                                 │  ← Pflicht, DE-validiert
│ bank_kontoinhaber                         │  ← Pflicht, kann vom Namen abweichen
│                                           │
│ -- Nur bei typ = REISEKOSTEN ----------- │
│ reiseanlass                               │
│ reiseziel                                 │
│ abfahrt_ort (WOHNUNG/TAETIGKEIT)          │
│ abfahrt_zeit                              │
│ rueckkehr_zeit                            │
│ land (NULL = Inland)                      │
│ verkehrsmittel                            │
│ km_gefahren                               │
│ km_berechnet (Route)                      │
│ km_pauschale_satz                         │
│ km_betrag                                 │
│ vma_brutto                                │
│ vma_kuerzung                              │
│ vma_netto                                 │
│ weitere_kosten_summe                      │
│                                           │
│ -- Gemeinsame Felder -------------------- │
│ gesamtbetrag                              │
│ unterschrift_bild (S3 ref)                │
│ unterschrift_zeit                         │
│ pdf_url (S3 ref)                          │
│ email_status (AUSSTEHEND/GESENDET/FEHLER) │
│ email_versuche                            │
│ email_letzter_fehler                      │
│ created_at                                │
│ submitted_at                              │
└──────────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Reisetag (nur bei REISEKOSTEN)      │  ← NEU: tagesweise VMA-Erfassung
│──────────────────────────────────────│
│ id                                    │
│ einreichung_id (FK)                   │
│ datum                                 │
│ typ (ANREISE / GANZTAG / ABREISE)     │
│ fruehstueck_gestellt (bool)           │
│ mittag_gestellt (bool)                │
│ abend_gestellt (bool)                 │
│ vma_brutto                            │
│ vma_kuerzung                          │
│ vma_netto                             │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Position (nur bei ERSTATTUNG)        │  ← NEU: Einzelpositionen einer Erstattung
│──────────────────────────────────────│
│ id                                    │
│ einreichung_id (FK)                   │
│ beschreibung                          │
│ kategorie                             │
│ datum                                 │
│ betrag                                │
│ beleg_id (FK)                         │
└──────────────────────────────────────┘

┌─────────────────────────────┐     ┌──────────────────────────┐
│  Beleg (Anlage)             │     │  Pauschale               │
│─────────────────────────────│     │──────────────────────────│
│ id                           │     │ id                       │
│ abrechnung_id (FK)           │     │ typ (KM_PKW/KM_MOTO/    │
│ dateiname                    │     │      VMA_8H/VMA_24H/...) │
│ dateityp (PDF/JPG/PNG)       │     │ land (NULL = Inland)     │
│ dateigroesse                 │     │ ort (optional)           │
│ s3_key                       │     │ betrag                   │
│ sha256_hash                  │     │ gueltig_von              │
│ upload_zeit                  │     │ gueltig_bis              │
│ beschreibung                 │     │ erstellt_von (admin)     │
│ betrag (optional, manuell)   │     └──────────────────────────┘
└─────────────────────────────┘
                                     ┌──────────────────────────┐
┌─────────────────────────────┐     │  Audit_Log               │
│  Weitere_Kosten             │     │──────────────────────────│
│─────────────────────────────│     │ id                       │
│ id                           │     │ user_id                  │
│ abrechnung_id (FK)           │     │ aktion                   │
│ typ (UEBERNACHTUNG/PARKEN/  │     │ entitaet                 │
│     MAUT/SONSTIGE)           │     │ entitaet_id              │
│ beschreibung                 │     │ alte_werte (JSON)        │
│ betrag                       │     │ neue_werte (JSON)        │
│ beleg_id (FK)                │     │ zeitstempel              │
└─────────────────────────────┘     │ ip_adresse               │
                                     └──────────────────────────┘
```

---

## 5. GoBD-Konformität

### 5.1 Unveränderbarkeit
- Nach Status "EINGEREICHT" → keine Änderung mehr möglich
- Korrektur nur durch: Storno + Neuanlage (mit Verweis auf stornierte Beleg-Nr.)
- Storno wird im Audit-Log protokolliert

### 5.2 Audit-Trail
- Jede Aktion wird in `Audit_Log` geschrieben (INSERT-only, kein UPDATE/DELETE)
- Felder: Wer, Wann, Was, Alte Werte, Neue Werte
- Audit-Log ist für Nicht-Admins read-only, für Admins nicht löschbar

### 5.3 Verfahrensdokumentation
- Wird als lebendes Dokument im Projekt mitgeführt
- Beschreibt: Erfassungsprozess, Berechtigungen, Archivierung, Schnittstellen
- Muss vor Go-Live fertiggestellt sein

---

## 6. DSGVO-Maßnahmen

| Maßnahme | Umsetzung |
|---|---|
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO (Arbeitsvertrag) + Art. 6 Abs. 1 lit. c (steuerliche Pflicht) |
| Verarbeitungsverzeichnis | Wird erstellt und beim DSB hinterlegt |
| Datensparsamkeit | Nur erforderliche Felder, keine Überschussdaten |
| Löschkonzept | Daten im Portal nach erfolgreicher DMS-Übermittlung: max. 90 Tage, dann Löschung. Langzeitarchiv = DMS |
| Verschlüsselung | TLS 1.3 (in transit), AES-256 (at rest für S3-Objekte) |
| Zugriffskontrolle | Rollenbasiert (Mitarbeiter sieht nur eigene Daten) |
| Hosting | EU-Rechenzentrum oder Self-Hosted |

---

## 7. Sicherheitskonzept

| Risiko | Maßnahme |
|---|---|
| Unbefugter Zugriff | Nur internes Netz + Mitarbeiter-Identifikation per Personalnummer |
| Datenmanipulation | Audit-Trail, Unveränderbarkeit nach Einreichung |
| Doppelte Abrechnungen | SHA-256 Hash-Duplikaterkennung auf Belegen |
| Falsche km-Angaben | Routenberechnung als Plausibilitätscheck (Warnung, kein Block) |
| Webhook-Missbrauch | HMAC-Signatur, Token-Auth |
| PDF-Download-Hijacking | Signed URLs mit 15 Min. Gültigkeit |
| E-Mail-Zustellung | Backend Retry-Logik (3x Backoff), Fehler-Logging, Admin-Alert |

---

## 8. Docker-Architektur & Deployment

### 8.1 Container-Struktur
```yaml
# docker-compose.yml (Übersicht)
# Alle Services laufen im CREDO-Netzwerk, CREDO CI wird über
# Umgebungsvariablen (CI_PRIMARY_COLOR, CI_LOGO_URL etc.) konfiguriert.

services:
  frontend:        # React App (nginx) — CREDO CI    → Port 3000
    image: credo/finanzportal-frontend:latest
    environment:
      - CREDO_CI_PRIMARY=#6B7280    # Verwaltungs-Grau (Default)
      - CREDO_CI_LOGO_URL=/assets/credo-logo.svg
    volumes:
      - ./frontend/public/assets:/usr/share/nginx/html/assets  # CI-Assets

  backend:         # Node.js API + E-Mail-Service     → Port 4000
    image: credo/finanzportal-backend:latest
    environment:
      - DATABASE_URL=postgres://...
      - REDIS_URL=redis://redis:6379
      - S3_ENDPOINT=http://minio:9000
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}  # Für Credential-Verschlüsselung
    depends_on:
      - postgres
      - redis
      - minio

  postgres:        # PostgreSQL 16                   → Port 5432
    image: postgres:16-alpine
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./backups:/backups

  minio:           # S3-kompatibler Storage          → Port 9000
    image: minio/minio:latest
    volumes:
      - minio_data:/data

  redis:           # E-Mail-Queue (BullMQ) + Cache   → Port 6379
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  pg_data:
  minio_data:
  redis_data:
```

> **Kein n8n-Container nötig** — der E-Mail-Versand läuft direkt im Backend. n8n kann optional extern angebunden werden über die Webhook-Konfiguration im AdminCenter.

### 8.2 CREDO CI im Docker-Setup
| Aspekt | Umsetzung |
|---|---|
| **CI-Farben** | Umgebungsvariablen (`CREDO_CI_PRIMARY`, `CREDO_CI_SECONDARY`) — im AdminCenter überschreibbar pro Mandant |
| **Logo** | Als Volume gemountet (`/assets/credo-logo.svg`) — austauschbar ohne Rebuild |
| **Fonts** | In Frontend-Image eingebettet (CREDO-Schriftart) |
| **PDF-CI** | Backend liest Logo + Farben aus der DB (AdminCenter-Konfiguration) |
| **E-Mail-CI** | Absendername + Signatur konfigurierbar im AdminCenter |

### 8.3 Skalierung
- **Frontend:** Stateless → horizontal skalierbar (2+ Replicas)
- **Backend:** Stateless → horizontal skalierbar (2+ Replicas)
- **PostgreSQL:** Single Primary + Read Replica bei Bedarf
- **MinIO:** Cluster-Mode ab 1000 Usern
- **Redis:** Für E-Mail-Queue (BullMQ) und Session-Cache
- **Load Balancer:** Traefik oder nginx als Reverse Proxy

### 8.4 Deployment-Strategie
- `docker compose up` für Entwicklung + Staging
- Docker Swarm oder Kubernetes für Produktion (je nach Infrastruktur)
- CI/CD: GitHub Actions → Build → Test → Push Image → Deploy
- Rolling Updates (Zero Downtime)
- Health Checks für alle Container
- Automatische Backups: PostgreSQL (täglich) + MinIO (inkrementell)
- **CREDO CI-Assets:** Als separates Volume — Design-Updates ohne Code-Deployment

### 8.5 Umgebungen
| Umgebung | Zweck | Infrastruktur |
|---|---|---|
| Development | Lokale Entwicklung | docker compose up |
| Staging | Test mit anonymisierten Daten | Interner Server |
| Production | Live-Betrieb | CREDO Server (EU, DSGVO-konform) |

---

## 9. Implementierungsphasen

### Phase 1: Foundation + CREDO CI (Wochen 1–3)
- [ ] Projekt-Setup: React 18 + TypeScript + Tailwind + shadcn/ui + Docker Compose
- [ ] Node.js Backend + Express + TypeScript
- [ ] PostgreSQL 16 + Datenbank-Schema + Migrationen
- [ ] MinIO (S3) + Redis Setup
- [ ] **CREDO CI:** Tailwind-Theme mit Mandantenfarben, Logo-System, Basis-Komponenten
- [ ] Mitarbeiter-Identifikation (Personalnummer-Auswahl, kein Login — internes Netz)
- [ ] AdminCenter: Mandantenverwaltung + Kostenstellen

### Phase 2: Kernfunktion — Wizard-Formular (Wochen 4–7)
- [ ] **Wizard-UI:** Schritt-für-Schritt-Formular (Circula-inspiriert)
  - Step 1: Reisedaten (Anlass, Ziel, Datum, Zeiten)
  - Step 2: Fahrkosten (Verkehrsmittel, km, Strecke)
  - Step 3: Verpflegung (automatische Berechnung + Mahlzeitenkürzung)
  - Step 4: Weitere Kosten + Beleg-Upload
  - Step 5: Zusammenfassung + Unterschrift + Einreichen
- [ ] Verpflegungsmehraufwand-Berechnung (Inland)
- [ ] Mahlzeitenkürzung (korrekte Logik: immer vom Volltagessatz!)
- [ ] Beleg-Upload mit S3-Speicherung (Drag & Drop + Kamera)
- [ ] Duplikaterkennung (SHA-256)
- [ ] § 14 UStG Hinweis-System
- [ ] Entwurfs-Modus (Auto-Save)
- [ ] Live-Betrag-Vorschau während der Eingabe

### Phase 3: PDF & QR (Wochen 8–9)
- [ ] PDF/A-3b Generierung im CREDO CI (Logo, Farben, Schrift)
- [ ] Anlagen-Integration in PDF
- [ ] Swiss QR-Code Generierung + Validierung
- [ ] Digitale Unterschrift (Canvas)
- [ ] PDF-Vorschau im Portal

### Phase 4: E-Mail-Versand & AdminCenter "Versand & Integration" (Wochen 10–11)
- [ ] E-Mail-Service im Backend (Nodemailer SMTP + MS Graph API)
- [ ] BullMQ Queue für asynchronen Versand
- [ ] Retry-Logik mit exponentiellem Backoff
- [ ] **AdminCenter "Versand & Integration":**
  - [ ] E-Mail-Konfiguration (SMTP / MS 365) mit verschlüsselter Credential-Speicherung
  - [ ] Test-E-Mail-Button
  - [ ] Retry-Einstellungen
  - [ ] Fehler-Benachrichtigungs-Adresse
- [ ] **Webhook-Konfiguration (optional):**
  - [ ] URL + Secret + Events konfigurierbar
  - [ ] Webhook-Test-Button
  - [ ] HMAC-SHA256-Signatur
- [ ] Versand-Log + E-Mail-Warteschlange im AdminCenter

### Phase 5: Erweiterung (Wochen 12–14)
- [ ] Auslandspauschalen-Tabelle + AdminCenter-Pflege + CSV-Import
- [ ] Routenberechnung (OpenRouteService)
- [ ] Plausibilitätsprüfungen (km, Dreimonatsfrist, Schwellenwerte)
- [ ] Audit-Trail + GoBD-Protokollierung
- [ ] Responsive Design / Mobile-Optimierung
- [ ] Dashboard: Übersicht eigener Abrechnungen mit Statusfilter

### Phase 6: Testing & Go-Live (Wochen 15–16)
- [ ] Steuerrechtliche Testfälle (Mahlzeitenkürzung, Ausland, Grenzfälle)
- [ ] E-Mail-Versand End-to-End-Test (SMTP + Graph API)
- [ ] Penetrationstest / Sicherheitsreview
- [ ] Verfahrensdokumentation fertigstellen
- [ ] Docker Compose Production-Config finalisieren
- [ ] Staging-Umgebung mit Testdaten
- [ ] Pilotgruppe (20–30 Mitarbeiter)
- [ ] Go-Live + Monitoring

---

## 10. Steuerrechtliche Testfälle (müssen alle bestanden werden)

| # | Testfall | Erwartetes Ergebnis |
|---|---|---|
| 1 | Eintägige Reise, 9h, keine Mahlzeit gestellt | VMA = 14,00 EUR |
| 2 | Eintägige Reise, 9h, Mittagessen gestellt | VMA = 14,00 - 11,20 = 2,80 EUR |
| 3 | Eintägige Reise, 9h, alle Mahlzeiten gestellt | VMA = 14,00 - 5,60 - 11,20 - 11,20 = 0 EUR (nicht negativ!) |
| 4 | Zweitägige Reise mit Übernachtung | Tag 1: 14 EUR (Anreisetag), Tag 2: 14 EUR (Abreisetag) |
| 5 | Dreitägige Reise, Frühstück im Hotel | Tag 1: 14 EUR, Tag 2: 28 - 5,60 = 22,40 EUR, Tag 3: 14 - 5,60 = 8,40 EUR |
| 6 | PKW 150 km | 150 × 0,30 = 45,00 EUR |
| 7 | Motorrad 80 km | 80 × 0,20 = 16,00 EUR |
| 8 | Auslandsreise Schweiz, 24h | Ländersatz aus BMF-Tabelle |
| 9 | Reise < 8h | VMA = 0 EUR |
| 10 | Duplikat-Beleg hochladen | Warnung wird angezeigt |

---

## 11. Entscheidungen (alle geklärt)

| # | Entscheidung | Status |
|---|---|---|
| 1 | **Kein Login nötig** — Portal nur im internen Netz erreichbar | Geklärt |
| 2 | **Self-Hosted Docker** auf CREDO Server (EU) | Geklärt |
| 3 | **Kein OCR** — OCR wird im DMS Docubit erledigt | Geklärt |
| 4 | **Bankverbindung im Portal** — Mitarbeiter pflegt selbst | Geklärt |
| 5 | **n8n Outlook Node** für E-Mail-Versand | Geklärt |
| 6 | **Fallback-Prozess** — PDF-Formular zum Download bereitstellen | Geklärt |

---

## 12. Risiko-Matrix

| Risiko | Wahrscheinlichkeit | Auswirkung | Maßnahme |
|---|---|---|---|
| Steuerrecht ändert sich | Hoch (jährlich) | Mittel | Konfigurierbare Pauschalen mit Gültigkeitszeitraum |
| E-Mail-Zustellung fehlschlägt | Mittel | Hoch | n8n Retry + Monitoring + Admin-Alert |
| QR-Code nicht lesbar | Niedrig | Hoch | Validierung vor PDF-Erzeugung + Fallback-Felder im E-Mail-Betreff |
| Datenverlust | Niedrig | Kritisch | Tägliche DB-Backups, S3-Replikation |
| Skalierungsprobleme | Mittel (in 3-5 Jahren) | Mittel | API-First, Stateless Backend, DB-Partitionierung |
| Portalausfall | Niedrig | Hoch | Fallback: PDF-Formular zum Download auf internem Fileshare |
