import { datumDe } from '../lib/reiseangaben.js';

interface Reisetag {
  datum: string;
  /** Maßgebendes Land des Tags (Anzeigename, z. B. 'Belgien', 'Inland'). */
  land: string;
  fruehstueckGestellt: boolean;
  mittagGestellt: boolean;
  abendGestellt: boolean;
}

interface ReisekostenEmailDaten {
  vorname: string;
  nachname: string;
  personalNr: string;
  mandantName: string;
  mandantNr: string;
  reiseziel: string;
  abfahrtZeit: string;
  rueckkehrZeit: string;
  /** Reiseland (landKey aus pauschalen_ausland); null/leer = Inland. */
  land?: string | null;
  /** Länderfolge der Reise (maßgebende Länder, ohne direkte Wiederholung). */
  reiseland: string[];
  gesamtbetrag: number;
  iban: string;
  kontoinhaber: string;
  reisetage: Reisetag[];
  /** Prüfvermerke (z. B. Überschneidung mit einer früheren Abrechnung). */
  pruefvermerke: string[];
  /** Quellen der angewandten Pauschalen (lib/reiseangaben.ts quellenVermerk). */
  pauschalenQuellen: string;
}

interface ErstattungEmailDaten {
  vorname: string;
  nachname: string;
  mandantName: string;
  mandantNr: string;
  anzahlPositionen: number;
  gesamtbetrag: number;
  iban: string;
  kontoinhaber: string;
}

function formatiereDatum(isoString: string): string {
  // Reines Datum (Reisetag, Klassenfahrt-Zeitraum) string-basiert: new Date('JJJJ-MM-TT') ist
  // UTC-Mitternacht, lokale Getter ergäben westlich von UTC den Vortag.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return datumDe(isoString);
  const d = new Date(isoString);
  const tag = String(d.getDate()).padStart(2, '0');
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  const jahr = d.getFullYear();
  return `${tag}.${monat}.${jahr}`;
}

function formatiereDatumZeit(isoString: string): string {
  const d = new Date(isoString);
  const tag = String(d.getDate()).padStart(2, '0');
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  const jahr = d.getFullYear();
  const stunde = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${tag}.${monat}.${jahr} ${stunde}:${minute}`;
}

function formatiereBetrag(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',');
}

function erstelleMahlzeitenInfo(reisetage: Reisetag[]): string {
  const tageMitMahlzeiten = reisetage.filter(
    t => t.fruehstueckGestellt || t.mittagGestellt || t.abendGestellt
  );

  if (tageMitMahlzeiten.length === 0) {
    return '';
  }

  const zeilen = tageMitMahlzeiten.map(t => {
    const mahlzeiten: string[] = [];
    if (t.fruehstueckGestellt) mahlzeiten.push('F');
    if (t.mittagGestellt) mahlzeiten.push('M');
    if (t.abendGestellt) mahlzeiten.push('A');
    return `  ${formatiereDatum(t.datum)} (${t.land}): ${mahlzeiten.join(', ')} gestellt`;
  });

  return [
    'Mahlzeiten-Info (Kennzeichen "M"):',
    ...zeilen,
    '\u2192 Bitte Gro\u00dfbuchstabe "M" im Lohnkonto eintragen.',
  ].join('\n');
}

export function erstelleReisekostenEmailText(data: ReisekostenEmailDaten): string {
  const mahlzeitenInfo = erstelleMahlzeitenInfo(data.reisetage);

  const zeilen = [
    'Neue Reisekostenabrechnung eingereicht.',
    '',
    `Mitarbeiter: ${data.vorname} ${data.nachname} (Personal-Nr.: ${data.personalNr})`,
    `Mandant: ${data.mandantName} (${data.mandantNr})`,
    `Reiseziel: ${data.reiseziel}`,
    `Reiseland: ${data.reiseland.join(' \u2192 ')}`,
    `Reisezeitraum: ${formatiereDatumZeit(data.abfahrtZeit)} \u2013 ${formatiereDatumZeit(data.rueckkehrZeit)}`,
    `Gesamtbetrag: ${formatiereBetrag(data.gesamtbetrag)} EUR`,
    data.pauschalenQuellen,
    '',
  ];

  if (data.pruefvermerke.length > 0) {
    zeilen.push('Pr\u00fcfvermerk:', ...data.pruefvermerke.map(v => `  ${v}`), '');
  }

  if (mahlzeitenInfo) {
    zeilen.push(mahlzeitenInfo, '');
  }

  zeilen.push(
    `IBAN: ${data.iban}`,
    `Kontoinhaber: ${data.kontoinhaber}`,
    '',
    '---',
    '',
    'Kurzinfo Reisekosten (FAQ)',
    '',
    // Inlandsbeträge nur bei Inlandsreisen — im Ausland gilt der Satz des Reiselandes.
    ...(data.land
      ? [
          `\u2022 Auslandsreise (${data.land}): Verpflegungspauschalen nach dem BMF-Schreiben des Reisejahres (siehe \u201ePauschalen\u201c oben; 24-h-Satz Ganztag, 8-h-Satz An-/Abreisetag bzw. eint\u00e4gig >8h).`,
          '\u2022 K\u00fcrzungen bei gestellten Mahlzeiten: Fr\u00fchst\u00fcck 20 %, Mittag/Abend je 40 % vom 24-h-Satz des f\u00fcr den Tag ma\u00dfgebenden Landes (Inlandstag: 28 EUR), auch am An-/Abreisetag.',
        ]
      : [
          '\u2022 Die Verpflegungspauschalen betragen 14 EUR (>8h/An-Abreisetag) bzw. 28 EUR (Ganztag).',
          '\u2022 K\u00fcrzungen bei gestellten Mahlzeiten: Fr\u00fchst\u00fcck 5,60 EUR, Mittag/Abend je 11,20 EUR.',
          '\u2022 Die K\u00fcrzung bezieht sich immer auf den vollen Tagessatz (28 EUR), auch am An-/Abreisetag.',
        ]),
    '\u2022 Kilometerpauschale: PKW 0,30 EUR/km, Motorrad 0,20 EUR/km \u2014 kein Vorsteuerabzug.',
    '\u2022 Verpflegungspauschalen sind nach 3 Monaten am selben Einsatzort nicht mehr steuerfrei.',
    '\u2022 Rechtsgrundlage: \u00a7 9 Abs. 4a EStG; Auslandspauschalen nach dem BMF-Schreiben des Reisejahres.',
    '',
    'Das PDF mit allen Belegen ist als Anhang beigef\u00fcgt.',
    'Diese E-Mail wurde automatisch vom CREDO Finanzportal erstellt.',
  );

  return zeilen.join('\n');
}

import { kmSatzAlsString } from '../lib/kmSaetze.js';

interface FahrtSummary {
  datum: string;
  startOrt: string;
  ziel: string;
  km: number;
  kmBetrag: number;
}

interface SammelfahrtEmailDaten {
  vorname: string;
  nachname: string;
  personalNr: string;
  mandantName: string;
  mandantNr: string;
  reiseanlass: string;
  verkehrsmittel: 'PKW' | 'MOTORRAD';
  kmSumme: number;
  gesamtbetrag: number;
  iban: string;
  kontoinhaber: string;
  fahrten: FahrtSummary[];
}

export function erstelleSammelfahrtEmailText(data: SammelfahrtEmailDaten): string {
  const zeilen = [
    'Neuer Fahrtkostensammelantrag eingereicht.',
    '',
    `Mitarbeiter: ${data.vorname} ${data.nachname} (Personal-Nr.: ${data.personalNr})`,
    `Mandant: ${data.mandantName} (${data.mandantNr})`,
    `Anlass: ${data.reiseanlass}`,
    `Verkehrsmittel: ${data.verkehrsmittel} — ${kmSatzAlsString(data.verkehrsmittel)} EUR/km`,
    `Anzahl Fahrten: ${data.fahrten.length}`,
    `Gesamt-Kilometer: ${formatiereBetrag(data.kmSumme)} km`,
    `Gesamtbetrag: ${formatiereBetrag(data.gesamtbetrag)} EUR`,
    '',
    `IBAN: ${data.iban}`,
    `Kontoinhaber: ${data.kontoinhaber}`,
    '',
    'Das PDF mit der Fahrten-Übersicht ist als Anhang beigefügt.',
    'Diese E-Mail wurde automatisch vom CREDO Finanzportal erstellt.',
  ];
  return zeilen.join('\n');
}

export function erstelleErstattungEmailText(data: ErstattungEmailDaten): string {
  return [
    'Neue Kostenerstattung eingereicht.',
    '',
    `Mitarbeiter: ${data.vorname} ${data.nachname}`,
    `Mandant: ${data.mandantName} (${data.mandantNr})`,
    `Positionen: ${data.anzahlPositionen}`,
    `Gesamtbetrag: ${formatiereBetrag(data.gesamtbetrag)} EUR`,
    '',
    `IBAN: ${data.iban}`,
    `Kontoinhaber: ${data.kontoinhaber}`,
    '',
    'Das PDF mit allen Belegen ist als Anhang beigef\u00fcgt.',
    'Diese E-Mail wurde automatisch vom CREDO Finanzportal erstellt.',
  ].join('\n');
}

interface KlassenfahrtEmailKlasse {
  bezeichnung: string;
  empfaenger: string;
  iban: string;
  zuschuss: number;
}

interface KlassenfahrtEmailDaten {
  einreicherName: string;
  personalNr: string;
  mandantName: string;
  mandantNr: string;
  anlass: string;
  ziel: string;
  zeitraumVon: string;
  zeitraumBis: string;
  gesamtZuschuss: number;
  klassen: KlassenfahrtEmailKlasse[];
}

export function erstelleKlassenfahrtEmailText(data: KlassenfahrtEmailDaten): string {
  const zeilen = [
    'Neue Klassenfahrt-Abrechnung eingereicht.',
    '',
    `Einreicher: ${data.einreicherName}${data.personalNr ? ` (Personal-Nr.: ${data.personalNr})` : ''}`,
    `Mandant: ${data.mandantName} (${data.mandantNr})`,
    `Anlass: ${data.anlass}`,
  ];
  if (data.ziel) zeilen.push(`Ziel: ${data.ziel}`);
  zeilen.push(
    `Zeitraum: ${formatiereDatum(data.zeitraumVon)} \u2013 ${formatiereDatum(data.zeitraumBis)}`,
    `Klassen: ${data.klassen.length}`,
    `Gesamt-Zuschuss F\u00f6rderverein: ${formatiereBetrag(data.gesamtZuschuss)} EUR`,
    '',
    'Auszahlung je Klassenkonto:',
  );
  data.klassen.forEach((k, i) => {
    const label = k.bezeichnung || `Klasse ${i + 1}`;
    zeilen.push(`  ${label}: ${formatiereBetrag(k.zuschuss)} EUR \u2192 ${k.empfaenger}, IBAN ${k.iban}`);
  });
  zeilen.push(
    '',
    'Die Auszahlung erfolgt getrennt je Klassenkonto (eine \u00dcberweisung je Klasse).',
    'Das PDF mit Deckblatt (QR + Auszahlungstabelle) und allen Belegen ist als Anhang beigef\u00fcgt.',
    'Diese E-Mail wurde automatisch vom CREDO Finanzportal erstellt.',
  );
  return zeilen.join('\n');
}
