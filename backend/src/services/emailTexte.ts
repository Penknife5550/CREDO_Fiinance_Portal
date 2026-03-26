interface Reisetag {
  datum: string;
  typ: string;
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
  gesamtbetrag: number;
  iban: string;
  kontoinhaber: string;
  reisetage: Reisetag[];
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
    return `  ${formatiereDatum(t.datum)}: ${mahlzeiten.join(', ')} gestellt`;
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
    `Reisezeitraum: ${formatiereDatumZeit(data.abfahrtZeit)} \u2013 ${formatiereDatumZeit(data.rueckkehrZeit)}`,
    `Gesamtbetrag: ${formatiereBetrag(data.gesamtbetrag)} EUR`,
    '',
  ];

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
    '\u2022 Die Verpflegungspauschalen betragen 14 EUR (>8h/An-Abreisetag) bzw. 28 EUR (Ganztag).',
    '\u2022 K\u00fcrzungen bei gestellten Mahlzeiten: Fr\u00fchst\u00fcck 5,60 EUR, Mittag/Abend je 11,20 EUR.',
    '\u2022 Die K\u00fcrzung bezieht sich immer auf den vollen Tagessatz (28 EUR), auch am An-/Abreisetag.',
    '\u2022 Kilometerpauschale: PKW 0,30 EUR/km, Motorrad 0,20 EUR/km \u2014 kein Vorsteuerabzug.',
    '\u2022 Bei Hotelrechnungen mit Fr\u00fchst\u00fcck bitte USt trennen: \u00dcbernachtung 7%, Fr\u00fchst\u00fcck 19%.',
    '\u2022 Verpflegungspauschalen sind nach 3 Monaten am selben Einsatzort nicht mehr steuerfrei.',
    '\u2022 Rechtsgrundlage: \u00a7 9 Abs. 4a EStG, BMF-Schreiben 05.12.2025.',
    '',
    'Das PDF mit allen Belegen ist als Anhang beigef\u00fcgt.',
    'Diese E-Mail wurde automatisch vom CREDO Finanzportal erstellt.',
  );

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
