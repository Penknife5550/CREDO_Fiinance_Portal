# Webhook-Datenstruktur (App → n8n)

## Webhook-Pfade

Der n8n-Workflow `n8n/CREDO Finanzportal — E-Mail Versand (3).json` exposiert
**drei** Webhook-Endpunkte, einen pro Vorgangstyp. Backend-seitig werden sie
ueber den `typFilter` der `webhook_config`-Eintraege adressiert.

| Pfad | typFilter (DB) | Akzentlinie | Empfaenger |
|------|---------------|-------------|------------|
| `POST /webhook/credo-reisekosten` | `REISEKOSTEN` (oder `ALLE`) | gelb (#FBC900) | DMS (Mandant.dmsEmail) |
| `POST /webhook/credo-erstattung`  | `ERSTATTUNG`  (oder `ALLE`) | gruen (#6BAA24) | DMS (Mandant.dmsEmail) |
| `POST /webhook/credo-sammelfahrt` | `SAMMELFAHRT` (oder `ALLE`) | blau (#009AC6) | DMS (Mandant.dmsEmail) |

**Auth (n8n-Seite):** alle drei Endpunkte verwenden dasselbe HTTP-Basic-Auth
Credential `CREDOFinance_2`. Falls kompromittiert → in n8n rotieren und im
AdminCenter (Tab "Versand") in allen drei Webhook-Eintraegen aktualisieren.

## Setup beim ersten Deployment

1. **Workflow importieren:** in n8n → Import → `n8n/CREDO Finanzportal — E-Mail Versand (3).json`. Outlook-OAuth2-Credential setzen, Workflow aktivieren.
2. **Pro Vorgangstyp je einen Eintrag im AdminCenter** anlegen (Tab "Versand"):
   - URL: `https://<n8n-host>/webhook/credo-{reisekosten|erstattung|sammelfahrt}`
   - Auth: Basic, User/Pass aus dem n8n-Credential
   - typFilter: `Nur Reisekosten` / `Nur Erstattungen` / `Nur Sammelfahrten`
   - Events: `eingereicht` (Pflicht), `fehler` (empfohlen fuer SMTP-Fallback-Pfad)
3. **Alternativ** ein einziger Eintrag mit `typFilter='Alle Einreichungen'` und einer URL — empfaengt aber dann nur eine der drei (z.B. `credo-reisekosten`) und rendert dort fuer alle Typen, was kaputt aussieht. **Nicht empfohlen.**
4. **Test:** im AdminCenter → "Test-Webhook" pro Eintrag.

## Payload-Aufbau

Die App sendet Webhooks mit folgender **verschachtelter** Struktur:

```json
{
  "event": "eingereicht | status_geaendert | fehler",
  "timestamp": "2026-03-27T12:18:34.579Z",
  "an": "buchhaltung@example.de",
  "pdfBase64": "JVBERi0xLjcK...",
  "pdfDateiname": "RK-2026-00001.pdf",
  "einreichung": {
    "id": "uuid",
    "belegNr": "RK-2026-00001",
    "typ": "REISEKOSTEN | ERSTATTUNG | SAMMELFAHRT",
    "status": "EINGEREICHT | GESENDET | FEHLER",
    "mandant": "Grundschule Haddenhausen",
    "mandantNr": 10,
    "kostenstelle": "",
    "mitarbeiter": {
      "vorname": "Max",
      "nachname": "Mustermann",
      "personalNr": "12345"
    },
    "gesamtbetrag": "142.80",
    "iban": "DE89370400440532013000",
    "kontoinhaber": "Max Mustermann",
    "reiseziel": "Berlin",
    "verkehrsmittel": "BAHN",
    "anzahlPositionen": 3,
    "anzahlFahrten": 5,
    "fahrten": [
      { "datum": "2026-04-14", "startOrt": "Wohnung Minden", "ziel": "Kita Stemwede", "km": 42, "kmBetrag": 12.6 }
    ]
  }
}
```

## Felder pro Vorgangstyp

### REISEKOSTEN
- `reiseziel`, `reiseanlass`, `verkehrsmittel`, `kmGefahren`, `vmaNetto`

### ERSTATTUNG
- `anzahlPositionen`

### SAMMELFAHRT (NEU Phase B)
- `reiseanlass`, `verkehrsmittel` (`PKW` | `MOTORRAD`), `kmGefahren` (Summe)
- `anzahlFahrten`
- `fahrten[]` — Array mit `{datum, startOrt, ziel, km, kmBetrag}` pro Einzelfahrt

> **Wichtig:** `gesamtbetrag`, `kmBetrag` und `kmGefahren` werden vom **Server**
> aus den Roh-Inputs (`km`, `verkehrsmittel`) berechnet. Frontend-Werte werden
> ignoriert (Schutz vor Auszahlungs-Manipulation).

## Wichtige Regeln

### Top-Level-Felder
| Feld | Beschreibung |
|------|-------------|
| `event` | Art des Events |
| `timestamp` | ISO-Zeitstempel |
| `an` | E-Mail-Empfaenger (= `dmsEmail` des Mandanten) |
| `pdfBase64` | PDF des Antrags als Base64 (kann mehrere MB sein) |
| `pdfDateiname` | z.B. `RK-2026-00042.pdf` / `KE-...` / `SF-...` |

### Verschachtelung
- Alle Einreichungsdaten liegen unter `einreichung`
- Mitarbeiterdaten liegen unter `einreichung.mitarbeiter`
- Der Mandantname heisst `einreichung.mandant` (NICHT `mandantName`)

### n8n Code-Node: Flattening
Die n8n Code-Nodes muessen die verschachtelte Struktur am Anfang flach mappen:

```js
const _root = _raw.body || _raw;
var _e = _root.einreichung || _root;
var _m = _e.mitarbeiter || {};
var d = Object.assign({}, _e, _m, {
  an: _root.an || '',
  mandantName: _e.mandant || ''
});
```

Danach sind alle Felder direkt auf `d` verfuegbar:
- `d.an` — E-Mail-Empfaenger
- `d.vorname`, `d.nachname`, `d.personalNr` — aus mitarbeiter
- `d.mandantName` — umgemappt von `mandant`
- `d.belegNr`, `d.mandantNr`, `d.gesamtbetrag`, `d.iban`, etc.

## Quelle der Daten

| Feld im Webhook | Quelle im Backend |
|-----------------|-------------------|
| `an` | `mandant.dmsEmail` (aus DB-Tabelle `mandanten`) |
| `einreichung.*` | zusammengebaut in `einreichungen.ts` |
| `einreichung.mitarbeiter.*` | aus dem Einreichungsformular |

## Haertung im Code-Node (seit Mai 2026)

Alle drei HTML-Code-Nodes (`HTML Reisekosten`, `HTML Erstattung`, `HTML Sammelfahrt`)
folgen demselben Haertungs-Pattern. Bei Aenderungen **bitte konsistent** in
allen drei Nodes spiegeln.

### 1. HTML-Escape von User-Feldern
```js
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var rawBelegNr=String(d.belegNr||'UNBEKANNT');
['vorname','nachname','personalNr','kontoinhaber','iban','reiseanlass','reiseziel','mandantName'].forEach(function(k){d[k]=esc(d[k]);});
d.belegNr=esc(rawBelegNr);
if(Array.isArray(d.fahrten)){d.fahrten=d.fahrten.map(function(f){return Object.assign({},f,{startOrt:esc(f.startOrt),ziel:esc(f.ziel)});});}
if(Array.isArray(d.positionen)){d.positionen=d.positionen.map(function(p){return Object.assign({},p,{beschreibung:esc(p.beschreibung)});});}
```

Schuetzt vor HTML-Injection (z.B. `<script>` im `reiseanlass`). `rawBelegNr`
bleibt unescaped fuer die Verwendung in `betreff` und `pdfDateiname`.

### 2. PDF-Magic-Bytes-Check + try/catch
```js
if(pdfBase64){
  try{
    var buf=Buffer.from(pdfBase64,'base64');
    if(buf.length>=4 && buf.slice(0,4).toString('ascii')==='%PDF'){
      out.binary={attachment_0:await this.helpers.prepareBinaryData(buf,pdfDateiname,'application/pdf')};
    }else{
      out.json.hasPdf=false;
      out.json.pdfFehler='Ungueltige PDF-Base64 (Magic-Bytes fehlen)';
    }
  }catch(e){
    out.json.hasPdf=false;
    out.json.pdfFehler=String(e&&e.message||e);
  }
}
```

Verhindert, dass beschaedigte Base64-Daten als scheinbar gueltiges PDF
versendet werden. Bei Fehler routet der `IF * hasPdf`-Node sauber auf den
"Outlook ohne Anhang"-Branch — **die E-Mail geht trotzdem raus**.

### 3. belegNr-Fallback
`pdfDateiname` und `betreff` nutzen `rawBelegNr` (mit Fallback `'UNBEKANNT'`)
statt `d.belegNr`. Vermeidet `[undefined].pdf` / `[undefined] ...`-E-Mails
bei fehlerhaftem Backend-Payload.

## Haeufige Fehlerquelle

> **Wenn `an` leer ist, schlaegt der Outlook-Versand in n8n fehl!**
> Ursache: Der Mandant hat keine `dmsEmail` in der Datenbank hinterlegt.
> Loesung: Im AdminCenter sicherstellen, dass jeder Mandant eine gueltige `dmsEmail` hat.
