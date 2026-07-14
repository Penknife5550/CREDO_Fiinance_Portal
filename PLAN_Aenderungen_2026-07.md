# Plan: Drei Änderungen am CREDO Finanzportal (Juli 2026)

> **Erstellt:** 2026-07-13
> **Status:** Kern-Entscheidungen getroffen (2026-07-13) — bereit zur Detail-Ausarbeitung
> **Basis:** Code-Stand `main` @ `739b062` (identisch mit GitHub, geprüft am 2026-07-13)

> ### ✅ Getroffene Entscheidungen (2026-07-13)
> 1. **Klassenfahrten-Scope:** Nur die **Lehrer-Abrechnung**, **Zielgröße = FV-Zuschuss** (nicht Kosten pro Schüler). **1 kombiniertes Formular**, **1–5 Klassen**, **Belege Pflicht**, **kein Sonderzuschuss**, Versand an DMS-Adresse M40, **PDF-Deckblatt** mit QR + Auszahlungstabelle. Der Eltern-/BuT-Prozess bleibt außerhalb.
> 2. **FV-Grundzuschuss:** Bestätigt — **der Förderverein trägt die Kosten für max. 1 Begleitperson pro Klasse**. Das entspricht exakt der Excel-Formel `P × Anzahl Klassen` (Kosten einer Begleitperson = `P`).
> 3. **SMTP-Konfig-Ebene:** **Global** — ein Absender-Postfach für alle Mandanten; nur die Ziel-DMS-Adresse bleibt pro Mandant. Kein `mandantId` in `email_config`.
> 4. **n8n-Zukunft:** **Fallback behalten** — SMTP wird Standard, n8n-Pfad bleibt als optionaler Zusatzkanal.
> 5. **Kategorien-Rollout:** Volles Konfig-Feature **pro Mandant** für alle Mandanten (explizit gewünscht: „die Kategorie soll von mir bestückt werden können, pro Mandant"). „Schulleiterbudget" wird dabei als M40-Eintrag geseedet.

Dieses Dokument beschreibt drei geplante Änderungen. Es enthält **noch keinen Code**. Ziel ist, dass wir gemeinsam die Anforderungen schärfen und ich zeige, dass ich insb. die Klassenfahrten-Berechnung korrekt verstanden habe.

---

## Teil 1 — Konfigurierbare Kategorien in der Kostenerstattung (pro Mandant)

> **✅ UMGESETZT am 2026-07-13** (siehe PROGRESS.md Phase 13). Backend-tsc/Frontend-tsc/Vitest 104 grün, ESLint 0 Fehler. Migration `0009` läuft beim nächsten `npm run db:migrate`.

### Was du willst
- Im Kostenerstattungs-Formular (Schritt 2, Dropdown „Kategorie") sollen die Kategorien **pro Mandant** von dir pflegbar sein.
- Konkret zuerst: Mandant 40 soll zusätzlich **„Schulleiterbudget"** zur Auswahl haben.

### Ist-Zustand (im Code gefunden)
Die Kategorien sind heute **an drei Stellen hart codiert und dupliziert** — es gibt keine Konfigurierbarkeit:

| Ort | Datei | Was |
|---|---|---|
| Frontend-Konstante | `frontend/src/lib/types.ts:138` | `ERSTATTUNG_KATEGORIEN` (Büromaterial, Fachliteratur, Lebensmittel, Arbeitsmittel, Fortbildung, Sonstiges) |
| Backend-Validierung | `backend/src/routes/einreichungen.ts:121` | `z.enum([...])` mit denselben 6 Werten |
| Datenbank | `backend/src/db/schema.ts:11` | Postgres-`pgEnum` `erstattung_kategorie`, benutzt in Spalte `positionen.kategorie` (`schema.ts:136`) |

Der harte Blocker: Die DB-Spalte ist ein **Enum**. Jeder neue Wert (auch „Schulleiterbudget") wird von der Datenbank abgelehnt, solange das Enum nicht geändert wird.

Ein **Mandanten-Login/Kontext existiert nicht** — die App ist öffentliches Self-Service, der Mandant wird pro Einreichung im Dropdown gewählt (`PersoenlicheDatenStep.tsx`). Der gewählte `mandantId` steht ab Schritt 1 fest und wandert in den Request.

### Vorbild-Pattern (schon im Repo vorhanden)
Wir kombinieren zwei existierende, bewährte Muster:
1. **CRUD-Aufbau** wie bei den Auslandspauschalen (`backend/src/routes/admin.ts:187–297` + öffentlicher Read-Endpoint `backend/src/routes/pauschalen.ts`): zentrales Zod-Schema, `GET/POST/PUT/DELETE`, Sortierung über `reihenfolge`, Inline-Row-Editor im AdminCenter.
2. **Mandanten-Scoping** wie bei den Kostenstellen (`kostenstellen`-Tabelle mit FK `mandantId`, Admin-Route `GET /api/admin/kostenstellen/:mandantId`, Mandant-Auswahl-Dropdown im Tab).

### Geplantes Vorgehen
1. **DB:** Neue Tabelle `erstattung_kategorien` (`id`, `mandantId` FK, `key`, `label`, `reihenfolge`, `active`). Migration, die
   - die Spalte `positionen.kategorie` von `pgEnum` auf `varchar` umstellt (Bestandsdaten bleiben, da die Werte gleich heißen),
   - für **alle** aktiven Mandanten die 6 Standard-Kategorien seedet,
   - für **Mandant 40** zusätzlich „Schulleiterbudget" seedet.
2. **Backend:**
   - Admin-CRUD `GET/POST/PUT/DELETE /api/admin/kategorien/:mandantId`.
   - Öffentlicher Read `GET /api/kategorien?mandantId=…` für den Wizard.
   - Zod-Validierung in `einreichungen.ts`: statt statischem Enum → Prüfung, dass jede eingereichte Kategorie zu den **für diesen Mandanten hinterlegten** Kategorien gehört.
3. **Frontend:**
   - Neuer Hook `useKategorien(mandantId)` (analog `useAuslandsPauschalen`), lädt beim Mandantenwechsel.
   - `ErstattungFormular.tsx` nutzt den Hook statt der Konstante; Fallback auf die 6 Standardwerte, falls (noch) keine gepflegt sind.
   - Neuer AdminCenter-Bereich „Kategorien" (Mandant-Auswahl + Inline-Editor pro Zeile, wie PauschalenTab).

### Aufwand & Risiko
- Mittel. Der einzige heikle Schritt ist die **Enum→varchar-Migration** (einmalig, rückwärtskompatibel, da gleiche Werte). Alles andere folgt exakt bestehenden Mustern.

---

## Teil 2 — Eigener SMTP-Versand statt n8n (kritische Prüfung des vorhandenen Codes)

> **✅ UMGESETZT am 2026-07-14.** Backend+Frontend `tsc` grün, `vite build` grün, **132 Vitest** (davon ~28 neu), ESLint 0 Fehler. Migration `0010_smtp_email_log` (+ Journal-Eintrag) läuft beim nächsten `npm run db:migrate`.
>
> **Entscheidungen dieser Session:** MS365 aus Enum/UI entfernt (Legacy → SMTP migriert) · Requeue **manuell** (Admin-Button, kein Cron) · eigene **`email_log`**-Tabelle (Versandprotokoll, wie HR) · Extras = Attachment-Limit + `env`-Validierung; **CC/BCC & QR-Swiss→EPC bewusst NICHT** (QR/CI = Teil 3).
>
> **Umgesetzt:** A (email.ts liest DB, ENV-Fallback, Passwort entschlüsselt) · E/I (gecachter Pool-Transporter, harte Timeouts, secure aus Port) · B/C (Kanal eindeutig `WEBHOOK\|SMTP`, Default SMTP) · G (email_log + Admin-Sektionen „Fehlgeschlagene Versände"/„Versandprotokoll", manuelles Resend) · H (fehlerEmail-Alarm) · J (Status-Guard). **Neu ggü. A–M gefunden:** Admin-PUT persistierte nur `versandMethode` + Frontend-SMTP-Felder waren tote Platzhalter → beides voll verdrahtet inkl. Test-Endpoint. Pure-Helper in `services/email-utils.ts`.
>
> **Adversariale Lückenprüfung (4 Linsen + Verify, 7/7 bestätigt) → behoben:** (R1) Requeue-Race gegen laufenden Erstversand → atomarer CAS-Claim + frische `AUSSTEHEND` (< 10 min) aus der Liste ausgeschlossen; (R2) Requeue war kanal-blind (immer SMTP) → jetzt kanalbewusst (WEBHOOK requeued via n8n); (C) Cutover-Falle → SMTP-Konfig/Test jetzt auch im WEBHOOK-Modus vorab konfigurier-/testbar; (B1) TLS `rejectUnauthorized` jetzt Default-streng + `requireTLS` bei Port ≠ 465, Abschwächung nur via `SMTP_ALLOW_SELF_SIGNED`.
>
> **Offen/dokumentiert (bewusst nicht gebaut):** `email_log.betreff` enthält Mitarbeiter-Klarnamen — **Retention/Löschjob** (analog Teil-3-90-Tage-Job) nachziehen und beim künftigen Einreichungs-Löschpfad die `email_log`-Zeilen mitlöschen (FK ist `ON DELETE SET NULL`). MS365-DB-Spalten bleiben ungenutzt liegen (Datenerhalt). QR-Swiss→EPC/GiroCode + Mandanten-CI im PDF = Teil 3.

### Was du willst
- Weg von der n8n-Abhängigkeit, hin zu eigenem SMTP-Versand — so wie im **HR-Portal** umgesetzt.
- Anhänge (PDF mit Belegen), QR-Code und CREDO-CI sollen wie bisher mitgehen.
- **Ebenso konfigurierbar** wie die n8n-Workflows.
- Der bereits geschriebene Versand-Code soll kritisch auf blinde Flecken und Fehler geprüft werden.

### Ist-Zustand (im Code gefunden)
Die Versand-Pipeline ist heute ein **Umschalter** zwischen n8n-Webhook und SMTP:
```
routes/einreichungen.ts  →  services/pdf.ts (PDF + Swiss-QR + Belege)
                         →  services/versand.ts   (fire-and-forget)
                              ├─ WEBHOOK → services/webhook.ts  → n8n
                              └─ SMTP    → services/email.ts    → nodemailer
```
`versand.ts` liest `email_config.versandMethode` (Default fällt auf `WEBHOOK`) und entscheidet pro Request. nodemailer ist bereits vorhanden (`backend/package.json`). PDF via `pdf-lib`, QR via `qrcode` (aktuell **Swiss QR / CHF** — siehe Befund K).

### 🔴 Kritische Prüfung: Blinde Flecken & Fehler im vorhandenen Versand-Code
Das ist der Kern deiner Bitte. Gefunden wurden folgende Punkte (nach Schwere):

| # | Schweregrad | Befund | Datei |
|---|---|---|---|
| **A** | 🔴 Gravierend | **Die DB-`email_config` ist eine Fassade.** `email.ts` liest **ausschließlich** `process.env.SMTP_*` / `MAIL_FROM_*`. Was der Admin im AdminCenter einträgt (SMTP-Server, Absender, `maxVersuche`, `fehlerEmail`, das **verschlüsselte** Passwort), hat **keine Wirkung**. Der Versand hängt real an ENV-Variablen, nicht an der DB. | `email.ts:15–27` |
| **B** | 🔴 Gravierend | **MS365 ist toter Code.** `versandMethode` erlaubt `'MS365'`, aber `versand.ts` prüft nur `=== 'WEBHOOK'` — alles andere landet im SMTP-Zweig. Wählt ein Admin „MS365", passiert stillschweigend normaler SMTP-Versand. Kein OAuth. | `admin.ts:326`, `versand.ts:42` |
| **C** | 🟠 Mittel | Default-Inkonsistenz: DB-Default `'SMTP'`, Code-Fallback `'WEBHOOK'`. Fehlt die `email_config`-Zeile, geht alles an n8n. | `schema.ts:203`, `versand.ts:39` |
| **D** | 🟠 Mittel | **Keine echte Pro-Mandant-Konfigurierbarkeit.** Weder `email_config` noch `webhook_config` haben `mandantId`. Absender, SMTP-Zugang, Fehler-Empfänger sind für **alle** Mandanten identisch. Einziges mandantenspezifisches Element: die Ziel-`dmsEmail`. | `schema.ts:201,220` |
| **E** | 🟠 Mittel | Kein Connection-Pool: `createTransport` wird bei **jedem** Versuch neu gebaut (bei 3 Retries = 3 Verbindungen). Office365 hat Verbindungslimits. | `email.ts:14` |
| **F** | 🟠 Mittel | Kein Attachment-Größenlimit. Beim Webhook-Weg wird das PDF komplett als Base64 in den JSON-Body geladen (+33 %), pro Config erneut. Große Belege können 25-MB-Mailgrenzen sprengen. | `webhook.ts:133`, `email.ts:24` |
| **G** | 🟠 Mittel | **Kein Requeue/Dead-Letter.** `void versendeEinreichung(...)` läuft fire-and-forget. Schlägt der Versand endgültig fehl, bleibt `emailStatus` auf `FEHLER`/`AUSSTEHEND` — es gibt keinen Cron/Job, der es erneut versucht. Ein SMTP-Ausfall = dauerhaft verlorene Zustellung. | `einreichungen.ts:314,441,583` |
| **H** | 🟠 Mittel | **`fehlerEmail` wird nie benachrichtigt.** Bei endgültigem Fehler wird nur ein `fehler`-Webhook gefeuert. Ohne n8n gäbe es dann **gar keine** Fehlerbenachrichtigung. | `versand.ts:79` |
| **I** | 🟡 Klein | Retry-Wartezeiten `[0, 30s, 60s]` blockieren das Hintergrund-Promise bis zu 90 s; kein Jitter, kein Circuit-Breaker. | `email.ts:45` |
| **J** | 🟡 Klein | `aktualisiereVersandStatus` überschreibt Status bedingungslos (kein optimistic locking) → theoretisch kann `GESENDET` durch einen späteren Pfad überschrieben werden. | `versand.ts:24` |
| **K** | 🟡 Klein | Hartkodiert: `secure:false`, QR fest auf **Swiss-QR/CHF** trotz EUR-Beträgen, Titel „CREDO" fix, **kein Mandanten-Logo/-Farbe** im PDF (obwohl `mandanten.logo`/`primaerfarbe` existieren), Betreff hart in der Route. | `email.ts:16`, `pdf.ts:132`, `pdf.ts:155` |
| **L** | 🟡 Klein | Env-Validierungslücke: `SMTP_PORT`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` werden in `config/env.ts` nicht validiert, obwohl `email.ts` sie nutzt. | `config/env.ts` |
| **M** | 🟡 Klein | `an` akzeptiert nur einen String — kein CC/BCC (z.B. Kopie an Buchhaltung), keine Prüfung ob `dmsEmail` gesetzt/gültig ist. | `email.ts:6` |

### Referenz HR-Portal (das saubere Zielmuster)
Das HR-Portal macht genau das richtige, DB-getriebene Muster (`HR_Portal_CREDO/src/lib/mailer.ts`):
- **SMTP-Config in der DB** (`SmtpConfig`, Singleton `id:"default"`), im Admin-Portal editierbar, Passwort verschlüsselt und erst beim Transporter-Bau entschlüsselt.
- **Harte Timeouts** (connection/greeting/socket) statt Blockade; TLS `rejectUnauthorized` nur in Production.
- **`sendEmailDetailed()` wirft nie** → liefert `{ok, messageId}` oder `{ok:false, error}`.
- **`EmailLog`-Tabelle** protokolliert jeden Versuch (SENT/FAILED/SKIPPED + messageId).
- **CI-Renderer** `email-layout.ts` (`renderCredoEmail`) mit Inline-CSS, Logo, CREDO-4-Farb-Linie, XSS-Escaping.
- **Anhänge** als Buffer mit sanitisiertem Dateinamen + `contentType`.
- **Idempotenz** über fachliche Einmal-Marker (Nachweis erst bei echtem `SENT` setzen).

### Geplantes Vorgehen (Reihenfolge nach Wirkung)
1. **`email.ts` mit der DB verdrahten** (schließt A): SMTP-Server/Port/User/Passwort (entschlüsselt), Absender, `maxVersuche`, `fehlerEmail` aus `email_config` lesen statt aus ENV. ENV bleibt als Fallback.
2. **Transporter cachen** + bei Config-Änderung invalidieren, mit Pool + harten Timeouts (schließt E, I).
3. **`versandMethode` bereinigen** (schließt B, C): Entweder MS365 sauber implementieren (OAuth) **oder** das Enum auf `WEBHOOK`/`SMTP` reduzieren und den Default eindeutig setzen.
4. **Fehler-Benachrichtigung** an `fehlerEmail` bei endgültigem Fehlversuch (schließt H).
5. **Requeue** (schließt G): kleiner Cron/Endpoint, der `emailStatus IN ('AUSSTEHEND','FEHLER')` erneut versendet; Idempotenz über Status-Guard (schließt J).
6. **Attachment-Größenlimit** + Warnung (schließt F, M): CC/BCC-Feld optional.
7. **CI ins PDF & in die Mail** (schließt K): Mandanten-Logo/-Farbe nutzen; QR-Code-Typ prüfen (Swiss-QR/CHF ist für EUR-DMS vermutlich falsch — klären).
8. **Env-Validierung** vervollständigen (schließt L).
9. **n8n bleibt als Fallback** — der Webhook-Pfad wird nicht entfernt; SMTP wird nur der Standard-/Vorzugskanal. So gibt es ein Rückfallnetz.

### Konfig-Ebene (entschieden: global)
Entscheidung 2026-07-13: Die SMTP-Config bleibt **global** — ein Absender-Postfach für alle Mandanten (analog der heutigen n8n-Config). Nur die Ziel-DMS-Adresse bleibt pro Mandant (`mandant.dmsEmail`, existiert bereits). Kein `mandantId` in `email_config` nötig. Die verbleibende Arbeit ist damit vor allem: die **DB-Config tatsächlich lesen** (Befund A) statt ENV, plus die Härtungen B–M.

---

## Teil 3 — Klassenfahrten-Abrechnung im Portal (nur Mandant 40)

### Ziel
Der Prozess soll von **Lehrern** im Finanzportal ausgefüllt werden. Das Portal bildet die Excel-Abrechnung ab: Kosten erfassen → auf Klassen verteilen → **Förderverein-Zuschuss berechnen** (= Kosten für 1 Begleitperson je Klasse) → PDF/Versand.

> **Wichtige Präzisierungen (2026-07-13):**
> - **Zielgröße = FV-Zuschuss**, nicht „Kosten pro Schüler". Letztere werden **nicht** ausgewiesen. Es interessiert nur der Betrag, den der Förderverein zahlt (die Begleitpersonen-Quote je Klasse).
> - **Anzahl Klassen variabel (1 bis 5)** — bis zu fünf Klassen können gleichzeitig fahren. Je Klasse eigene **Schüler- und Begleitpersonenzahl**; gemeinsame Kosten werden über alle teilnehmenden Klassen verteilt.
> - **Ein kombiniertes Formular** deckt Einzel- (1 Klasse) und Gruppenbuchung (2–5 Klassen) ab.
> - **Auszahlung auf mehrere Klassenkonten:** So viele Bankverbindungen mit Empfänger wie Klassen (bis zu 5). Der FV-Zuschuss jeder Klasse geht auf das jeweils eigene Klassenkonto (Datenmodell: eine `klasse`-Zeile mit `empfaenger` + `iban`, verschlüsselt).
> - **Kein Sonderzuschuss** für bedürftige Kinder im Portal (nicht benötigt).
> - **Belege sind Pflicht:** Ohne mindestens einen Beleg lässt sich der Antrag nicht absenden (Frontend + Server-Check).
> - **E-Mail-Ziel = die für Mandant 40 konfigurierte DMS-Adresse** (`mandant.dmsEmail`).
> - **PDF-Deckblatt (Seite 1):** alle relevanten Infos auf einen Blick — Belegnummer, QR-Code, Fahrt-Eckdaten, Gesamt-Zuschuss und Auszahlungstabelle je Klassenkonto; danach Kostendetails + eingebettete Belege.

### ⚙️ Die Berechnung — so habe ich sie aus den 3 Excel-Dateien verstanden

Es gibt **zwei Modi**:

#### Modus A — Einzelbuchung (eine Klasse)
Eine Klasse fährt allein. Alle Kosten gehören dieser Klasse. Keine Aufteilung nötig.

#### Modus B — Gruppenbuchung (mehrere Klassen zusammen)
Mehrere Klassen fahren zusammen und teilen sich Kosten. **Jede Kostenzeile wird auf eine von zwei Arten auf die Klassen verteilt:**

- **(A) Proportional nach Schülerzahl** — für gemeinsame Kosten (Bus, Unterkunft, Eintritte):
  ```
  Klassenanteil = Gesamtbetrag / Gesamtschülerzahl × Schüler dieser Klasse
  ```
- **(B) Direkt pro Klasse eingetragen** — für Aktivitäten, die jede Klasse einzeln gebucht/bezahlt hat (Kartfahren, Bowling …): der Betrag wird je Klasse manuell erfasst; der Gesamtbetrag ist die Summe.

#### Kern-Formel pro Klasse (in beiden Modi identisch)
Gegeben je Klasse: `S` = Schüler, `B` = Begleitpersonen, `K` = Summe der Kostenanteile dieser Klasse.

1. **Kosten pro Person** (Schüler **und** Begleitpersonen zählen mit):
   ```
   P = K / (S + B)
   ```
2. **Förderverein-Grundzuschuss** = `P × Anzahl Klassen` (in den Vorlagen ist „Anzahl Klassen" je Spalte = 1, also faktisch **eine Personen-Quote pro Klasse**).
3. *(nur in der neuesten Vorlage)* **Sonderzuschuss für bedürftige Schüler** — manuell erfasster Betrag, kommt oben drauf:
   ```
   FV-Gesamt = (P + Sonderzuschuss) × Anzahl Klassen
   ```
4. **Kosten pro Schüler** (der Betrag, den jede Familie zahlt):
   ```
   Kosten pro Schüler = (K − FV-Gesamt) / S
   ```

**Was das effektiv bewirkt:** Die Gesamtkosten werden auf **alle** Personen (Schüler + Begleiter) verteilt. Die Begleitpersonen zahlen nicht selbst — ihr Anteil wird auf die Schüler umgelegt. Der Förderverein nimmt den Schülern aber **eine Personen-Quote pro Klasse** wieder ab. Als Formel zusammengefasst:
```
Kosten pro Schüler = (K / S) × (S + B − 1) / (S + B)
```

#### Durchgerechnetes Beispiel (echte Zahlen, Datei „KF 1 Klasse4", Klasse 1)
- Schüler `S = 27`, Begleitpersonen `B = 2`, Klassen `= 1`
- Beispiel-Kostenzeilen dieser Klasse:
  - Fahrtkosten (proportional): `580 € / 76 Schüler × 27 = 206,05 €`  *(76 = 27+25+24 Schüler aller 3 Klassen)*
  - Unterkunft (proportional): `4.793,20 € / 76 × 27 = 1.702,85 €`
  - Sommerrodelbahn (direkt): `250,00 €`  *(Klasse 1 hat direkt 250 € bezahlt)*
  - … usw.
  - **Summe Klasse 1: `K = 3.049,37 €`**
- Kosten pro Person: `P = 3.049,37 / (27 + 2) = 105,15 €`
- **FV-Zuschuss Klasse 1: `105,15 €`** (= 1 Begleitperson)

**Gesamter 3-Klassen-Antrag (Zielgröße):**

| | Klasse 1 | Klasse 2 | Klasse 3 |
|---|---|---|---|
| Schüler S | 27 | 25 | 24 |
| Begleiter B | 2 | 2 | 2 |
| Gesamtkosten K | 3.049,37 | 2.000,07 | 2.666,70 |
| Kosten/Person P | 105,15 | 74,08 | 102,57 |
| **FV-Zuschuss** | **105,15 €** | **74,08 €** | **102,57 €** |

→ **Gesamt-Zuschuss Förderverein = 105,15 + 74,08 + 102,57 = `281,79 €`** ✅ (stimmt exakt mit Excel-Zelle G23 „Gesamtbeitrag des Fördervereins").

Die Auszahlung erfolgt **getrennt je Klasse** auf das jeweilige Klassenkonto (105,15 € → Konto Klasse 1, 74,08 € → Konto Klasse 2, 102,57 € → Konto Klasse 3).

*(„Kosten pro Schüler" — in der Excel `(K − FV)/S` — wird im Portal bewusst nicht ausgewiesen.)*

### Der fachliche Gesamt-Prozess (aus `Klassenfahrt.txt`)
Neben der reinen Abrechnung beschreibt die Textdatei den **Eltern-Prozess** (ein **anderer Akteur** als der abrechnende Lehrer):
1. **Eigenbeteiligung:** Eltern tragen grundsätzlich einen Teil selbst — außer die Kosten sind vollständig durch **BuT** (Bildung & Teilhabe) gedeckt.
2. **BuT-Prüfung:** Eltern prüfen Anspruch, stellen ggf. Antrag bei der Behörde (kann die Fahrt komplett bezuschussen).
3. **Förderverein-Antrag (Eltern):** Falls kein/zu wenig BuT → schriftliche Anfrage an den FV-Vorstand. FV gewährt **max. die Hälfte der Kosten, höchstens 100 €** pro Kind.
4. **Auszahlung:** FV überweist auf das **Klassenkonto** des Lehrers.
5. **Restzahlung:** Lehrer informiert Eltern über Zuschuss + Restbetrag; Eltern zahlen den Rest aufs Klassenkonto.

> ⚠️ **Wichtige Beobachtung — zwei verschiedene „Förderverein-Zuschüsse":**
> - In der **Excel** gibt es einen **automatischen** FV-Grundzuschuss (eine Personen-Quote pro Klasse, Schritt 2 oben) — der gilt für alle Klassen.
> - Im **Text** geht es um einen **individuellen** FV-Zuschuss pro bedürftigem Kind (max. 100 €, auf Antrag) — das entspricht dem „Sonderzuschuss bedürftiger Schüler" in der neuesten Vorlage.
>
> Diese beiden Dinge halten wir im Portal sauber auseinander. **Bestätigt (2026-07-13):** Der automatische Grundzuschuss = **der Förderverein trägt die Kosten für max. 1 Begleitperson pro Klasse**. Da die Kosten einer Begleitperson genau `P` (Kosten pro Person) betragen, ist das identisch mit der Excel-Formel `P × Anzahl Klassen`. Der individuelle Zuschuss für bedürftige Kinder (max. 100 €) ist davon getrennt und wird — falls relevant — als optionaler „Sonderzuschuss" pro Fahrt erfasst.

### Kleine Beobachtungen zu den Excel-Vorlagen (zeigt, dass ich sie gelesen habe)
- Die Prüf-Zelle `G20 = IF(D20+E20+F20 = SUMME; F20+D20; "Fehler")` gibt bei 3 Klassen fälschlich `F20+D20` (ohne `E20`) zurück — ein **Anzeige-Bug** in der Vorlage; die eigentliche Summenprüfung stimmt. Im Portal machen wir das sauber.
- Begleitpersonen können **anteilig** sein (z.B. `1,5`, wenn sich zwei Klassen einen Begleiter teilen).
- Die Datei „KF 3 Klassen2" enthält im Einzelbuchungs-Blatt **echte Bankdaten** (Name + Kontonummer). Das sind alte Beispieldaten — im Portal werden Kontodaten natürlich pro Einreichung erfasst und verschlüsselt (bestehendes Muster).

### Geplantes Vorgehen (Grobskizze — Details nach Freigabe)
1. **DB:** Neuer Vorgangstyp `KLASSENFAHRT` (nur für Mandant 40 sichtbar, analog KST-Sichtbarkeits-Flags). Tabellen für Fahrt-Kopf, **Klassen (S/B + `empfaenger` + `iban` verschlüsselt, 1–5 pro Fahrt)**, Kostenzeilen (mit Verteil-Modus proportional/direkt). Kein Sonderzuschuss.
2. **Frontend-Wizard (ein kombiniertes Formular):** Stammdaten (Anlass, Zeitraum, Einreicher) → **Anzahl Klassen (1–5)** + je Klasse **Schüler-/Begleiterzahl und eigene Bankverbindung (Empfänger + IBAN)** → Kostenzeilen (je Zeile: Modus proportional/direkt) → **Belege (Pflicht, blockiert Absenden)** → **Live-Ergebnis** (FV-Zuschuss je Klasse + Gesamt, Auszahlungs-Liste je Konto) → Einreichen.
3. **Backend:** Server-seitige Neuberechnung aller Werte (wie bei den bestehenden Formularen, Härtung H.1) — Client-Zahlen werden nie vertraut. Server-Check auf mind. 1 Beleg.
4. **Ausgabe:** PDF mit **Deckblatt (Seite 1: QR + Belegnummer + Eckdaten + Gesamt-Zuschuss + Auszahlungstabelle je Konto)**, danach Kostendetails + eingebettete Belege. Versand an **`mandant.dmsEmail` (Mandant 40)** über dieselbe (künftig SMTP-)Pipeline.
5. **Startseite:** Vierte Karte „Klassenfahrt" nur für Mandant 40.

### Aus meiner Sicht noch zu klären (Lückenprüfung)

**Entschieden (2026-07-13):**
- **Begleitpersonen = Pflichtfeld ≥ 1** je Klasse (der Fall „0 Begleitpersonen" kommt nicht vor).
- **Anteilige Begleitpersonen erlaubt** — Dezimalwerte wie `1,5` (wie in der Excel).
- **Negative Kostenzeilen erlaubt** — Gutschriften/Rabatte/Erstattungen als negative Beträge.

**Vorschlag — setze ich so um, falls kein Widerspruch:**
- **Rundung:** je Klasse auf Cent, dann summieren (ergibt exakt die 281,79 €).
- **Belege:** pauschal zur Fahrt (nicht je Kostenzeile); Formate/Größe wie bestehend.
- **IBAN-Validierung + Kontoinhaber-Pflicht** je Klassenkonto (bestehendes Muster).
- **Einreicher ≠ Empfänger:** einreichende Lehrkraft (Name/E-Mail) getrennt von Konto-Empfängern.
- **QR = DMS-Zuordnung** über Belegnummer (kein Zahlungs-QR; Swiss-QR/CHF-Befund K wäre hier falsch).
- **Belegnummer** `KF-YYYY-NNNNN` mit Lock-Key (analog RK/KE/SF).

**Entschieden:** proportionale Verteilung nach Schülerzahl (Begleiter zählen nicht mit); Freigabe-Workflow bleibt offline; Tabelle/PDF stellen bis zu 5 Klassen dar.

### Prozessketten-Prüfung Teil 3 — Ergebnis & Entscheidungen (2026-07-13)

Die Klassenfahrt-Prozesskette (13 Schritte, Startseite → Auszahlung) wurde adversarial durch 5 unabhängige Prüf-Agenten gegengelesen (2 davon gegen den echten Code). Visualisierung: HTML-Artifact „Klassenfahrt-Prozesskette".

**Getroffene Entscheidungen:**
- **Mandant 40 IST der Förderverein** — im System heißt er noch „CREDO Verwaltung" (DMS `fibu-verwaltung@docubit.credo.de`); **Name + DMS-Adresse werden auf den FV korrigiert** (kein neuer Mandant). Serverseitig `mandantNr 40 → UUID` auflösen.
- **Bis zu 5 Klassen** (statt 3), variabel; **ein kombiniertes Formular**.
- **Mit Unterschrift** — SignaturPad der einreichenden Lehrkraft, Einreichen-Button gegatet, Signatur ins PDF (wie die 3 bestehenden Wizards).
- **Nach-Fahrt-Abrechnung** (Ist-Kosten + Belege).
- **Keine IBAN-Verschlüsselung** — Klartext wie im gesamten Bestand (interner Betrieb), Spalte `varchar(34)`.
- **Kein Restbetrag / keine „Kosten pro Schüler"** — nirgends ausgewiesen, nur der FV-Zuschuss.

**Als Default umzusetzen (kritische Funde aus der Prüfung):**
- **`DezimalInput` blockiert das Minuszeichen** → Prop `allowNegative` nötig, sonst sind die zugesagten negativen Kostenzeilen nicht eingebbar. (Blocker)
- **Negativ-Guard:** FV-Zuschuss je Klasse muss ≥ 0 bleiben (negative Kosten dürfen keine negative Auszahlung erzeugen), sonst Absenden blockieren.
- **HEIC wird vom Magic-Bytes-Check gelöscht** (fehlt in `ALLOWED_MIME_TYPES`) → `image/heic`/`image/heif` ergänzen (betrifft alle Vorgänge).
- **DIREKT-Kostenzeilen** brauchen eine **Anteils-Ablage je Klasse** (Join-Tabelle `klassenfahrt_kostenzeile_anteil`) — sonst Server-Recompute nicht rekonstruierbar.
- **Eigener PDF-Zweig** (Deckblatt mit Auszahlungstabelle je Konto) + **reiner DMS-QR** statt Swiss-QR/CHF; `erstelleGesamtPdf` ist single-account.
- **Eigener Stammdaten-Step** (PersoenlicheDatenStep nicht wiederverwendbar) + **`IbanFeld`-Komponente** (IBAN-Live-Validierung je Klasse); **`validateEmail`-Helper** ergänzen.
- **Geteiltes Berechnungsmodul** (`lib/klassenfahrt.ts`) für Client + Server + **Golden-Master-Test** gegen die 3 Excel-Dateien (281,79/281,80 €).
- **Rundungsregel:** ausgewiesener Gesamt = Summe der cent-gerundeten Auszahlungen (Deckblatt in sich konsistent).
- **Idempotenz-Key** gegen Doppelversand (verlorene Response → doppelte DMS-Mail/Überweisung).
- **Lösch-/Aufbewahrungs-Job** (90 Tage, PLAN dokumentiert, nichts gebaut) für DB/PDF/Belege.
- **DSGVO-Hinweis** (Art. 13) vor der Bankdaten-Erfassung.
- **Erfolg-Seite parametrisieren** (fest verdrahteter „Buchhaltung/5 Werktage"-Text ist für KF falsch).
- **Schüler = Ganzzahl** (Begleiter dürfen dezimal sein); Reduzieren der Klassenzahl darf keine Geister-Werte hinterlassen (Bestätigung + Trimmen).
- **KF-Registrierung:** pgEnum `KLASSENFAHRT` + Migration, `EINREICHUNG_TYPEN`, Belegnummer-PREFIX `KF`/LOCK_OFFSET 4, neuer POST-Branch, Route `/klassenfahrt`, Tabellen-Präfix `klassenfahrten` (Kollision mit bestehender `fahrten` vermeiden), DB-Insert in `db.transaction`.

**Offen/optional:** Zeichnungsfelder „Geprüft/Freigegeben/Überwiesen" aufs Deckblatt (Vereins-4-Augen); IBAN-Maskierung im E-Mail-Body (optional, da Klartext ohnehin akzeptiert).

### Aufwand & Risiko
- Größter der drei Blöcke (neuer Vorgangstyp end-to-end). Scope ist auf **nur Lehrer-Abrechnung** festgelegt — das begrenzt den Aufwand deutlich (kein Eltern-/BuT-Prozess im Portal).

---

## Noch zu klären (kleinere Detailfragen, blockieren den Start nicht)

- **Klassenfahrten-Kostenzeilen:** Feste Oberkategorien (Fahrtkosten, Unterkunft, Aktivitäten, Sonstiges) mit freier Bezeichnung je Zeile — so wie in der Excel? (Mein Vorschlag: ja.)
- **Freigabe-Workflow:** Die Excel-Felder „Geprüft / Freigegeben / Überwiesen" im Portal als Status-Tracking abbilden oder offline lassen? (Mein Vorschlag: vorerst offline — nur Abrechnung + Versand.)
- **QR-Code-Typ:** Der aktuelle PDF-QR ist ein **Swiss-QR (CHF)** — für EUR-DMS vermutlich unpassend. Auf EPC/GiroCode (EUR) umstellen? (Betrifft Teil 2.)

Diese Punkte kläre ich beim jeweiligen Umsetzungs-Start — sie ändern die Architektur nicht.

---

## Vorgeschlagene Reihenfolge der Umsetzung
1. **Teil 1 (Kategorien)** — kleinster Block, klares Muster, schneller Nutzen (Schulleiterbudget sofort verfügbar).
2. **Teil 2 (SMTP)** — mittlere Größe, schließt echte Fehler; Voraussetzung für sauberen Versand von Teil 3.
3. **Teil 3 (Klassenfahrten)** — größter Block, baut auf dem SMTP-Versand auf.
