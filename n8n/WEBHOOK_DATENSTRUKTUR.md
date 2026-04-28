# Webhook-Datenstruktur (App → n8n)

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

## Haeufige Fehlerquelle

> **Wenn `an` leer ist, schlaegt der Outlook-Versand in n8n fehl!**
> Ursache: Der Mandant hat keine `dmsEmail` in der Datenbank hinterlegt.
> Loesung: Im AdminCenter sicherstellen, dass jeder Mandant eine gueltige `dmsEmail` hat.
