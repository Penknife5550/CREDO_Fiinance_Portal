/**
 * Generiert Muster-PDFs für Reisekosten und Erstattung
 * Ausführung: npx tsx scripts/generate-muster-pdfs.ts
 */

import path from 'path';
import { erstelleGesamtPdf, erstelleKlassenfahrtPdf } from '../src/services/pdf.js';
import { berechneKlassenfahrt } from '../src/lib/klassenfahrt.js';

const OUTPUT_DIR = path.resolve(import.meta.dirname, '../../muster_pdfs');

async function main() {
  // ── Muster 1: Reisekostenabrechnung ──────────────────
  const reisekostenPfad = path.join(OUTPUT_DIR, 'MUSTER_Reisekosten_RK-2026-00001.pdf');

  await erstelleGesamtPdf(
    {
      typ: 'REISEKOSTEN',
      belegNr: 'RK-2026-00001',
      mandantName: 'CREDO Grundschule St. Martin',
      mandantNr: 10,
      kostenstelleNr: '4100',
      kostenstelleBezeichnung: 'Verwaltung',
      vorname: 'Anna',
      nachname: 'Müller',
      personalNr: '10042',
      iban: 'DE89370400440532013000',
      kontoinhaber: 'Anna Müller',
      reiseanlass: 'Fortbildung Digitale Medien im Unterricht — Landesinstitut für Schulentwicklung',
      reiseziel: 'Stuttgart',
      abfahrtOrt: 'WOHNUNG',
      abfahrtZeit: '2026-03-23T07:30:00',
      rueckkehrZeit: '2026-03-25T18:45:00',
      verkehrsmittel: 'BAHN',
      kmGefahren: 0,
      kmBetrag: 0,
      vmaNetto: 42,
      weitereKostenSumme: 67.5,
      gesamtbetrag: 109.5,
      reisetage: [
        {
          datum: '2026-03-23',
          typ: 'ANREISE',
          vmaNetto: 14,
          fruehstueckGestellt: false,
          mittagGestellt: false,
          abendGestellt: false,
        },
        {
          datum: '2026-03-24',
          typ: 'GANZTAG',
          vmaNetto: 28,
          fruehstueckGestellt: true,
          mittagGestellt: true,
          abendGestellt: false,
        },
        {
          datum: '2026-03-25',
          typ: 'ABREISE',
          vmaNetto: 0,
          fruehstueckGestellt: true,
          mittagGestellt: false,
          abendGestellt: false,
        },
      ],
      weitereKosten: [
        { typ: 'Bahnticket', beschreibung: 'Hin- und Rückfahrt München–Stuttgart', betrag: 52.5 },
        { typ: 'Parkgebühr', beschreibung: 'Parkhaus Hauptbahnhof München', betrag: 15.0 },
      ],
    },
    [], // keine Beleg-Dateien für das Muster
    reisekostenPfad,
  );

  console.log(`✓ Reisekosten-Muster erstellt: ${reisekostenPfad}`);

  // ── Muster 2: Kostenerstattung ───────────────────────
  const erstattungPfad = path.join(OUTPUT_DIR, 'MUSTER_Erstattung_KE-2026-00001.pdf');

  await erstelleGesamtPdf(
    {
      typ: 'ERSTATTUNG',
      belegNr: 'KE-2026-00001',
      mandantName: 'CREDO Gymnasium am See',
      mandantNr: 20,
      kostenstelleNr: '5200',
      kostenstelleBezeichnung: 'Fachschaft Naturwissenschaften',
      vorname: 'Thomas',
      nachname: 'Becker',
      personalNr: '20118',
      iban: 'DE27100777770209299700',
      kontoinhaber: 'Thomas Becker',
      gesamtbetrag: 187.43,
      positionen: [
        { beschreibung: 'Experimentierkasten Optik (Klasse 8)', kategorie: 'ARBEITSMITTEL', datum: '2026-03-10', betrag: 89.95 },
        { beschreibung: 'Kopierpapier A4, 5 Pakete', kategorie: 'BUEROMATERIAL', datum: '2026-03-12', betrag: 24.99 },
        { beschreibung: 'Fachbuch: Moderne Physikdidaktik', kategorie: 'FACHLITERATUR', datum: '2026-03-15', betrag: 42.50 },
        { beschreibung: 'Getränke & Snacks Elternabend NaWi', kategorie: 'LEBENSMITTEL', datum: '2026-03-18', betrag: 29.99 },
      ],
    },
    [],
    erstattungPfad,
  );

  console.log(`✓ Erstattung-Muster erstellt: ${erstattungPfad}`);

  // ── Muster 3: Klassenfahrt (3-Klassen-Beispiel = 281,80 €) ─────────
  const klassenfahrtPfad = path.join(OUTPUT_DIR, 'MUSTER_Klassenfahrt_KF-2026-00001.pdf');

  type MusterRow = { oberkategorie: string; bezeichnung: string; modus: 'PROPORTIONAL' | 'DIREKT'; betrag: number; anteile?: number[] };
  const kfKlassenInput = [
    { schueler: 27, begleiter: 2 },
    { schueler: 25, begleiter: 2 },
    { schueler: 24, begleiter: 2 },
  ];
  const rows: MusterRow[] = [
    { oberkategorie: 'FAHRTKOSTEN', bezeichnung: 'Bus (Maranatha GmbH)', modus: 'PROPORTIONAL', betrag: 580 },
    { oberkategorie: 'UNTERKUNFT', bezeichnung: 'Christl. Gästehäuser Willingen', modus: 'PROPORTIONAL', betrag: 4793.2 },
    { oberkategorie: 'AKTIVITAETEN', bezeichnung: 'Sommerrodelbahn', modus: 'DIREKT', betrag: 450, anteile: [250, 0, 200] },
    { oberkategorie: 'AKTIVITAETEN', bezeichnung: 'Bogenschießen', modus: 'DIREKT', betrag: 510, anteile: [270, 0, 240] },
    { oberkategorie: 'AKTIVITAETEN', bezeichnung: 'Kartfahren', modus: 'DIREKT', betrag: 528.94, anteile: [285.6, 0, 243.34] },
    { oberkategorie: 'AKTIVITAETEN', bezeichnung: 'Bowling', modus: 'DIREKT', betrag: 147, anteile: [83.7, 0, 63.3] },
    { oberkategorie: 'AKTIVITAETEN', bezeichnung: 'Schwimmbad', modus: 'PROPORTIONAL', betrag: 171 },
    { oberkategorie: 'AKTIVITAETEN', bezeichnung: 'Ettelsberg-Seilbahn', modus: 'PROPORTIONAL', betrag: 36 },
    { oberkategorie: 'AKTIVITAETEN', bezeichnung: 'Klettern', modus: 'PROPORTIONAL', betrag: 500 },
  ];
  const kfErgebnis = berechneKlassenfahrt(
    kfKlassenInput,
    rows.map(r => ({ modus: r.modus, betrag: r.betrag, anteile: r.anteile })),
  );
  const kfKonten = [
    { bezeichnung: 'Klasse 6a', empfaenger: 'Klassenkasse 6a', iban: 'DE12500105170648489890' },
    { bezeichnung: 'Klasse 6b', empfaenger: 'Klassenkasse 6b', iban: 'DE02120300000000202051' },
    { bezeichnung: 'Klasse 6c', empfaenger: 'Klassenkasse 6c', iban: 'DE89370400440532013000' },
  ];

  await erstelleKlassenfahrtPdf(
    {
      belegNr: 'KF-2026-00001',
      mandantName: 'Christlicher Schulverein Minden e.V.',
      mandantNr: 40,
      anlass: 'Jahrgangsfahrt Klasse 6',
      ziel: 'Willingen (Sauerland)',
      zeitraumVon: '2026-05-12',
      zeitraumBis: '2026-05-14',
      einreicherName: 'J. Pulverich',
      klassen: kfKlassenInput.map((k, i) => ({
        bezeichnung: kfKonten[i].bezeichnung,
        schueler: k.schueler,
        begleiter: k.begleiter,
        empfaenger: kfKonten[i].empfaenger,
        iban: kfKonten[i].iban,
        kostenanteil: kfErgebnis.klassen[i].kostenanteil,
        zuschuss: kfErgebnis.klassen[i].zuschuss,
      })),
      kostenzeilen: rows.map((r, i) => ({ oberkategorie: r.oberkategorie, bezeichnung: r.bezeichnung, modus: r.modus, betrag: r.betrag, anteileJeKlasse: kfErgebnis.verteilung[i] })),
      gesamtZuschuss: kfErgebnis.gesamtZuschuss,
    },
    [],
    klassenfahrtPfad,
  );

  console.log(`✓ Klassenfahrt-Muster erstellt: ${klassenfahrtPfad} (Gesamt-Zuschuss ${kfErgebnis.gesamtZuschuss.toFixed(2)} €)`);
  console.log(`\nAlle Muster-PDFs liegen in: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
