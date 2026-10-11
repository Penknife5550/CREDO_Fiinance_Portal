import { describe, it, expect } from 'vitest';
import {
  ordneTageZu, landBezeichnung, reiselandFolge, quellenVermerk, ueberschneidungsVermerke, datumDe, ohneSteuerzeichen,
  bereiteReisekostenVor, berechneReisekostenVma, QUELLE_KEIN_ANSPRUCH,
  type ReisekostenAngaben, type ReisekostenVorbereitung,
} from '../reiseangaben.js';
import { bildeReisetage, ReisetageFehler, type ReisetageFehlerCode, type Satzstand, type TagesLand } from '../reisetage.js';

// Satzstand 2026 (BMF-Schreiben vom 05.12.2025)
const STAENDE: readonly Satzstand[] = [
  { landKey: 'Belgien', satz24h: 59, satz8h: 40 },
  { landKey: 'Niederlande', satz24h: 58, satz8h: 39 },
  { landKey: 'Luxemburg', satz24h: 63, satz8h: 42 },
  { landKey: 'Polen', satz24h: 34, satz8h: 23 },
].map(s => ({ ...s, gueltigVon: '2026-01-01', quelle: 'BMF-Schreiben vom 05.12.2025' }));

interface ClientTag {
  datum: string;
  typ: string;
  fruehstueckGestellt: boolean;
  land24uhr?: string | null;
  letzterTaetigkeitsort?: string | null;
  landFreitext?: string | null;
}

const clientTag = (datum: string, over: Partial<ClientTag> = {}): ClientTag => ({
  datum, typ: 'GANZTAG', fruehstueckGestellt: false, ...over,
});

/** Satzstände wie die Route sie lädt: die Satz-Keys der Vorbereitung bzw. alle Länder (WHERE land_key IN …). */
function geladeneStaende(v: ReisekostenVorbereitung, alle: readonly Satzstand[] = STAENDE): Satzstand[] {
  if (v.satzKeys.length === 0) return [];
  return v.alleLaender ? [...alle] : alle.filter(s => v.satzKeys.includes(s.landKey));
}

/** Rechenkette der Route (bereiteReisekostenVor → Satzstände laden → berechneReisekostenVma). */
function routenKette(angaben: ReisekostenAngaben, alle: readonly Satzstand[] = STAENDE) {
  const v = bereiteReisekostenVor(angaben);
  return berechneReisekostenVma(v, geladeneStaende(v, alle));
}

/** Client-Tage zum Zeitraum (wie das Formular), Mahlzeiten und Landangaben je Datum. */
function clientTage(abfahrt: string, rueckkehr: string, uebernachtung: boolean | null, je: Record<string, Partial<ClientTag>> = {}) {
  return bildeReisetage(abfahrt, rueckkehr, uebernachtung).map(t => ({
    ...clientTag(t.datum, { typ: t.typ, ...je[t.datum] }),
    mittagGestellt: false,
    abendGestellt: false,
  }));
}

/** Erwartet einen ReisetageFehler mit Code und Meldung. */
function erwarteFehler(fn: () => unknown, code: ReisetageFehlerCode, meldung: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ReisetageFehler);
    expect({ code: (err as ReisetageFehler).code, meldung: (err as ReisetageFehler).message }).toEqual({ code, meldung });
    return;
  }
  throw new Error(`ReisetageFehler ${code} erwartet, aber kein Fehler geworfen`);
}

describe('ordneTageZu (Client-Tage per Datum)', () => {
  const soll = bildeReisetage('2026-03-16T08:00', '2026-03-18T18:00', null);

  it('ordnet per Datum zu — Reihenfolge und Typ des Clients zählen nicht', () => {
    const client = [clientTag('2026-03-18', { typ: 'GANZTAG' }), clientTag('2026-03-16'), clientTag('2026-03-17', { typ: 'ABREISE' })];
    const paare = ordneTageZu(soll, client);
    expect(paare?.map(p => [p.soll.datum, p.soll.typ, p.client.datum])).toEqual([
      ['2026-03-16', 'ANREISE', '2026-03-16'],
      ['2026-03-17', 'GANZTAG', '2026-03-17'],
      ['2026-03-18', 'ABREISE', '2026-03-18'],
    ]);
  });

  it('zusätzlicher, fehlender, doppelter oder fremder Client-Tag → null', () => {
    const basis = ['2026-03-16', '2026-03-17', '2026-03-18'].map(d => clientTag(d));
    expect(ordneTageZu(soll, [...basis, clientTag('2026-03-19')])).toBeNull();
    expect(ordneTageZu(soll, basis.slice(0, 2))).toBeNull();
    expect(ordneTageZu(soll, [...basis.slice(0, 2), clientTag('2026-03-17')])).toBeNull();
    expect(ordneTageZu(soll, [...basis.slice(0, 2), clientTag('2026-03-15')])).toBeNull();
  });

  it('16:00 → 02:00 ohne Übernachtung: nur EIN Tag erwartet (der erste) — zwei Client-Tage → null', () => {
    const einTag = bildeReisetage('2026-03-16T16:00', '2026-03-17T02:00', false);
    expect(ordneTageZu(einTag, [clientTag('2026-03-16')])?.map(p => p.soll.typ)).toEqual(['EINTAEGIG']);
    expect(ordneTageZu(einTag, [clientTag('2026-03-16'), clientTag('2026-03-17')])).toBeNull();
  });
});

describe('Rechenkette der Route (bereiteReisekostenVor → berechneReisekostenVma)', () => {
  const zeitraum = { abfahrtZeit: '2026-03-16T08:00', rueckkehrZeit: '2026-03-18T18:00', uebernachtung: null };

  it('BE → NL → LU, Frühstück Tag 2–4, Tag 4 ohne Angabe erbt LU = 166,20 (Reihenfolge und Typ des Clients zählen nicht)', () => {
    const reisetage = [
      clientTag('2026-03-19', { fruehstueckGestellt: true }),
      clientTag('2026-03-16', { land24uhr: 'Belgien' }),
      clientTag('2026-03-17', { land24uhr: 'Niederlande', fruehstueckGestellt: true }),
      clientTag('2026-03-18', { land24uhr: 'Luxemburg', fruehstueckGestellt: true }),
    ].map(t => ({ ...t, mittagGestellt: false, abendGestellt: false }));
    const r = routenKette({ abfahrtZeit: '2026-03-16T08:00', rueckkehrZeit: '2026-03-19T18:00', uebernachtung: null, land: 'Belgien', reisetage });
    expect(r.tage.map(t => [t.datum, t.typ, t.landKey])).toEqual([
      ['2026-03-16', 'ANREISE', 'Belgien'],
      ['2026-03-17', 'GANZTAG', 'Niederlande'],
      ['2026-03-18', 'GANZTAG', 'Luxemburg'],
      ['2026-03-19', 'ABREISE', 'Luxemburg'],
    ]);
    expect(r.tage.map(t => t.vmaNetto)).toEqual([40, 46.4, 50.4, 29.4]);
    expect(r.tage.map(t => [t.satz?.satz24h, t.satz?.satz8h])).toEqual([[59, 40], [58, 39], [63, 42], [63, 42]]);
    expect({ brutto: r.vmaBrutto, kuerzung: r.vmaKuerzung, netto: r.vmaNetto }).toEqual({ brutto: 203, kuerzung: 36.8, netto: 166.2 });
    expect(r.pauschalenQuellen).toBe('Pauschalen: BMF-Schreiben vom 05.12.2025');
  });

  it('manipulierte Client-Beträge (vmaNetto 199 je Tag, falscher Typ) werden ignoriert', () => {
    const reisetage = clientTage('2026-03-16T08:00', '2026-03-18T18:00', null)
      .map(t => ({ ...t, typ: 'GANZTAG', vmaBrutto: 199, vmaKuerzung: 0, vmaNetto: 199 }));
    const r = routenKette({ ...zeitraum, land: 'Belgien', reisetage });
    expect(r.tage.map(t => [t.typ, t.vmaNetto])).toEqual([['ANREISE', 40], ['GANZTAG', 59], ['ABREISE', 40]]);
    expect(r.vmaNetto).toBe(139);
  });

  it('alter Client ohne Tagesfelder: alle Tage = Hauptland bzw. Inland', () => {
    const reisetage = ['2026-03-16', '2026-03-17', '2026-03-18']
      .map(datum => ({ datum, fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false }));
    const ausland = routenKette({ ...zeitraum, land: 'Belgien', reisetage });
    expect(ausland.tage.map(t => t.landKey)).toEqual(['Belgien', 'Belgien', 'Belgien']);
    expect(ausland.vmaNetto).toBe(40 + 59 + 40);
    const inland = bereiteReisekostenVor({ ...zeitraum, land: null, reisetage });
    expect(inland.satzKeys).toEqual([]); // reine Inlandsreise lädt keine Satzstände
    expect(berechneReisekostenVma(inland, []).vmaNetto).toBe(56);
  });

  it('alter Client ohne Übernachtungsfeld (unter 24 h über Mitternacht) → Hinweis auf Neuladen; neues Formular ohne Angabe → Pflichtfrage', () => {
    const reisetage = [clientTag('2026-03-16'), clientTag('2026-03-17')].map(t => ({ ...t, mittagGestellt: false, abendGestellt: false }));
    const angaben = { abfahrtZeit: '2026-03-16T17:00', rueckkehrZeit: '2026-03-17T00:30', land: null, reisetage };
    erwarteFehler(
      () => bereiteReisekostenVor(angaben),
      'UEBERNACHTUNG_FEHLT',
      'Das Formular wurde aktualisiert. Bitte laden Sie die Seite neu und geben Sie an, ob Sie auswärts übernachtet haben.',
    );
    erwarteFehler(
      () => bereiteReisekostenVor({ ...angaben, uebernachtung: null }),
      'UEBERNACHTUNG_FEHLT',
      'Bitte geben Sie an, ob Sie auswärts übernachtet haben (Reise unter 24 Stunden über zwei Kalendertage).',
    );
  });

  it('Client-Tage passen nicht zum Zeitraum (ordneTageZu = null) → Fehler mit Hinweis auf Neuladen', () => {
    const meldung = 'Die Reisetage passen nicht zum Reisezeitraum. Bitte laden Sie die Seite neu und prüfen Sie Ihre Angaben.';
    const basis = clientTage('2026-03-16T08:00', '2026-03-18T18:00', null);
    for (const reisetage of [basis.slice(0, 2), [...basis, { ...basis[0], datum: '2026-03-19' }], [...basis.slice(0, 2), basis[1]], []]) {
      erwarteFehler(() => bereiteReisekostenVor({ ...zeitraum, land: 'Belgien', reisetage }), 'TAGE_PASSEN_NICHT', meldung);
    }
  });

  it('Satz-Keys: Hauptland, alle Angaben und Satz-Keys der Tage, immer samt Luxemburg; alle Länder nur bei Freitext', () => {
    const v = bereiteReisekostenVor({
      ...zeitraum, land: 'Belgien',
      reisetage: clientTage('2026-03-16T08:00', '2026-03-18T18:00', null, {
        '2026-03-16': { land24uhr: 'INLAND', letzterTaetigkeitsort: 'Niederlande' },
        '2026-03-17': { land24uhr: 'SEETAG' },
      }),
    });
    expect([...v.satzKeys].sort()).toEqual(['Belgien', 'Luxemburg', 'Niederlande']);
    expect(v.alleLaender).toBe(false);
    const mitFreitext = bereiteReisekostenVor({
      ...zeitraum, land: 'Belgien',
      reisetage: clientTage('2026-03-16T08:00', '2026-03-18T18:00', null, { '2026-03-17': { land24uhr: 'ANDERES', landFreitext: 'Nauru' } }),
    });
    expect(mitFreitext.alleLaender).toBe(true);
  });

  it('unbekannte Landangabe — auch eine nicht maßgebende (Ort um 24 Uhr am Abreisetag) → „Unbekanntes Reiseland“', () => {
    erwarteFehler(() => routenKette({ ...zeitraum, land: 'Atlantis', reisetage: clientTage('2026-03-16T08:00', '2026-03-18T18:00', null) }),
      'UNBEKANNTES_LAND', 'Unbekanntes Reiseland: Atlantis');
    const reisetage = clientTage('2026-03-16T08:00', '2026-03-18T18:00', null, {
      '2026-03-18': { land24uhr: 'Atlantis', letzterTaetigkeitsort: 'Belgien' },
    });
    erwarteFehler(() => routenKette({ ...zeitraum, land: 'Belgien', reisetage }), 'UNBEKANNTES_LAND', 'Unbekanntes Reiseland: Atlantis');
  });

  it('Tagesreise bis 8 h ohne Satzstand des Reisejahres (Januar 2027) → 0,00 ohne Satz statt Fehler', () => {
    const angaben = {
      abfahrtZeit: '2027-01-14T08:00', rueckkehrZeit: '2027-01-14T15:00', uebernachtung: null, land: 'Niederlande',
      reisetage: [{ datum: '2027-01-14', fruehstueckGestellt: true, mittagGestellt: false, abendGestellt: false }],
    };
    const r = routenKette(angaben);
    expect(r.tage).toHaveLength(1);
    expect(r.tage[0]).toMatchObject({ typ: 'EINTAEGIG', eintaegigUeber8h: false, landKey: 'Niederlande', satz: null, vmaNetto: 0 });
    expect(r.vmaNetto).toBe(0);
    expect(r.pauschalenQuellen).toBe(`Pauschalen: ${QUELLE_KEIN_ANSPRUCH}`);
    // über 8 h braucht der Tag den Satz → Stand 2027 fehlt → Fehler wie bisher
    erwarteFehler(
      () => routenKette({ ...angaben, rueckkehrZeit: '2027-01-14T16:01' }),
      'SATZSTAND_FEHLT',
      'Die Auslandspauschalen für 2027 sind noch nicht hinterlegt. Bitte reichen Sie die Abrechnung später ein oder wenden Sie sich an die Buchhaltung.',
    );
    // Inland bis 8 h: ebenfalls kein Satz
    const inland = routenKette({ ...angaben, land: null }, []);
    expect(inland.tage[0]).toMatchObject({ landKey: 'INLAND', satz: null, vmaNetto: 0 });
  });

  it('„Staat nicht in der Liste“ mit einem Staat aus der Liste → Fehler (sonst Satz Luxemburg statt Satz Polen)', () => {
    const mit = (landFreitext: string) => ({
      ...zeitraum, land: 'Belgien',
      reisetage: clientTage('2026-03-16T08:00', '2026-03-18T18:00', null, { '2026-03-17': { land24uhr: 'ANDERES', landFreitext } }),
    });
    erwarteFehler(() => routenKette(mit('Polen')), 'FREITEXT_IN_LISTE', '„Polen“ steht in der Liste – bitte dort auswählen.');
    erwarteFehler(() => routenKette(mit(' holland ')), 'FREITEXT_IN_LISTE', '„Niederlande“ steht in der Liste – bitte dort auswählen.');
    // nicht aufgeführter Staat → Satz Luxemburg
    const nauru = routenKette(mit('Nauru'));
    expect(nauru.tage.map(t => [t.landKey, t.landFreitext, t.vmaNetto])).toEqual([['Belgien', null, 40], ['ANDERES', 'Nauru', 63], ['ANDERES', 'Nauru', 42]]);
    // Staat ohne Stand im Reisejahr (z. B. im BMF-Schreiben gestrichen) bleibt erlaubt
    const nurPolen2025 = STAENDE.map(s => (s.landKey === 'Polen' ? { ...s, gueltigVon: '2025-01-01' } : s));
    expect(routenKette(mit('Polen'), nurPolen2025).vmaNetto).toBe(40 + 63 + 42);
  });

  it('Tag ohne Anspruch: kein Satz, also auch keine Freitextprüfung', () => {
    const r = routenKette({
      abfahrtZeit: '2026-03-16T08:00', rueckkehrZeit: '2026-03-16T14:00', uebernachtung: null, land: 'Belgien',
      reisetage: [{ datum: '2026-03-16', fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false, letzterTaetigkeitsort: 'ANDERES', landFreitext: 'Polen' }],
    });
    expect(r.tage[0]).toMatchObject({ landKey: 'ANDERES', landFreitext: 'Polen', satz: null, vmaNetto: 0 });
  });
});

describe('ohneSteuerzeichen (Freitexte im Mailtext, SEC-m3)', () => {
  it('ersetzt CR, LF, TAB und andere Steuerzeichen durch Leerzeichen, lässt Umlaute und Zeichen wie „–“ stehen', () => {
    expect(ohneSteuerzeichen('Nauru\r\nGesamtbetrag: 999,00 EUR')).toBe('Nauru  Gesamtbetrag: 999,00 EUR');
    expect(ohneSteuerzeichen('A\tB\u0000C\u007fD\u0085E')).toBe('A B C D E');
    expect(ohneSteuerzeichen('Côte d’Ivoire – Südkorea')).toBe('Côte d’Ivoire – Südkorea');
  });

  it('ersetzt auch Unicode-Zeilentrenner (U+2028/U+2029), Bidi-Steuerzeichen und Null-Breiten-Zeichen', () => {
    expect(ohneSteuerzeichen('Nauru\u2028Prüfvermerk: keiner')).toBe('Nauru Prüfvermerk: keiner');
    expect(ohneSteuerzeichen('Nauru\u2029X')).toBe('Nauru X');
    expect(ohneSteuerzeichen('A\u202EB\u202AC\u2066D\u2069E\u200BF\u200EG\uFEFFH')).toBe('A B C D E F G H');
    expect(ohneSteuerzeichen('Bosnien und Herzegowina')).toBe('Bosnien und Herzegowina'); // normale Leerzeichen bleiben
  });
});

describe('landBezeichnung / reiselandFolge', () => {
  const l = (landKey: string, landFreitext: string | null = null): TagesLand => ({ landKey, landFreitext });

  it('Anzeigenamen für reservierte Werte und Länder', () => {
    expect(landBezeichnung(l('INLAND'))).toBe('Inland');
    expect(landBezeichnung(l('SEETAG'))).toBe('Seetag');
    expect(landBezeichnung(l('ANDERES', 'Kosovo'))).toBe('Kosovo');
    expect(landBezeichnung(l('ANDERES'))).toBe('Staat nicht in der Liste');
    expect(landBezeichnung(l('Frankreich — Paris'))).toBe('Frankreich — Paris');
  });

  it('Länderfolge ohne direkte Wiederholung, Rückkehr in ein Land wird erneut gelistet', () => {
    expect(reiselandFolge([l('Belgien'), l('Niederlande'), l('Luxemburg'), l('Luxemburg')])).toEqual(['Belgien', 'Niederlande', 'Luxemburg']);
    expect(reiselandFolge([l('INLAND'), l('Belgien'), l('Belgien')])).toEqual(['Inland', 'Belgien']);
    expect(reiselandFolge([l('Belgien'), l('Niederlande'), l('Belgien')])).toEqual(['Belgien', 'Niederlande', 'Belgien']);
    expect(reiselandFolge([l('INLAND'), l('INLAND')])).toEqual(['Inland']);
  });
});

describe('quellenVermerk (Fußnote PDF/Mail)', () => {
  const BMF_2026 = 'BMF-Schreiben vom 05.12.2025';
  const BMF_2027 = 'BMF-Schreiben vom 01.12.2026';
  const KORREKTUR = 'Korrektur ab 01.07.2026';
  const EStG = '§ 9 Abs. 4a EStG';
  // Tage ab `start` (lückenlos, wie bildeReisetage) mit [Land, Quelle]
  const tage = (start: string, ...liste: Array<[string, string]>) => {
    const [j, m, t] = start.split('-').map(Number);
    return liste.map(([landKey, satzQuelle], i) => ({
      datum: new Date(Date.UTC(j, m - 1, t + i)).toISOString().slice(0, 10),
      landKey,
      satzQuelle,
    }));
  };

  it('Auslandsreise mit Inlandstag: Auslandsquelle, dann Inland (eine Quelle: ohne Tage)', () => {
    expect(quellenVermerk(tage('2026-03-16', ['INLAND', EStG], ['Belgien', BMF_2026], ['SEETAG', BMF_2026])))
      .toBe(`Pauschalen: ${BMF_2026}; Inland: ${EStG}`);
  });

  it('reine Inlands- bzw. Auslandsreise: nur die eine Quelle', () => {
    expect(quellenVermerk(tage('2026-03-16', ['INLAND', EStG], ['INLAND', EStG]))).toBe(`Pauschalen: ${EStG}`);
    expect(quellenVermerk(tage('2026-03-16', ['Belgien', BMF_2026]))).toBe(`Pauschalen: ${BMF_2026}`);
  });

  it('Jahreswechsel: jedes Schreiben mit den Tagen, an denen es galt (Reihenfolge der Tage)', () => {
    expect(quellenVermerk(tage('2026-12-30',
      ['Belgien', BMF_2026], ['ANDERES', BMF_2026], ['Belgien', BMF_2027], ['Belgien', BMF_2027],
    ))).toBe(`Pauschalen: ${BMF_2026} (30.12.–31.12.2026); ${BMF_2027} (01.01.–02.01.2027)`);
  });

  it('Korrekturstand mitten in der Reise, nicht zusammenhängende Tage und Inlandstag', () => {
    expect(quellenVermerk(tage('2026-06-30',
      ['Belgien', BMF_2026], ['Frankreich', KORREKTUR], ['Belgien', BMF_2026], ['INLAND', EStG], ['Belgien', BMF_2026],
    ))).toBe(`Pauschalen: ${BMF_2026} (30.06.2026, 02.07.2026, 04.07.2026); ${KORREKTUR} (01.07.2026); Inland: ${EStG}`);
  });

  it('gleiche Quelle über den Jahreswechsel hinweg: Zeitraum mit beiden Jahreszahlen', () => {
    expect(quellenVermerk(tage('2026-12-31', ['Belgien', BMF_2026], ['Belgien', BMF_2026], ['Niederlande', KORREKTUR])))
      .toBe(`Pauschalen: ${BMF_2026} (31.12.2026–01.01.2027); ${KORREKTUR} (02.01.2027)`);
  });
});

describe('ueberschneidungsVermerke', () => {
  const MAHLZEITEN = 'gestellte Mahlzeiten beider Abrechnungen sind vom 24-h-Satz des Landes mit der höheren Pauschale zu kürzen (BMF 05.12.2025). Bitte prüfen.';

  it('ein gemeinsamer Tag → nur die höhere Pauschale, Kürzung beider Abrechnungen (BMF 05.12.2025)', () => {
    expect(ueberschneidungsVermerke([{ belegNr: 'RK-2026-00007', datum: '2026-03-16', beideEintaegig: false }])).toEqual([
      `Überschneidung mit RK-2026-00007 am 16.03.2026: für diesen Tag ist nur die höhere Pauschale zulässig; ${MAHLZEITEN}`,
    ]);
  });

  it('mehrere Tage je Beleg zusammengefasst (aufsteigend, ohne Dubletten), Belege sortiert', () => {
    expect(ueberschneidungsVermerke([
      { belegNr: 'RK-2026-00009', datum: '2026-03-18', beideEintaegig: false },
      { belegNr: 'RK-2026-00007', datum: '2026-03-17', beideEintaegig: false },
      { belegNr: 'RK-2026-00009', datum: '2026-03-16', beideEintaegig: false },
      { belegNr: 'RK-2026-00009', datum: '2026-03-17', beideEintaegig: false },
      { belegNr: 'RK-2026-00009', datum: '2026-03-16', beideEintaegig: false },
    ])).toEqual([
      `Überschneidung mit RK-2026-00007 am 17.03.2026: für diesen Tag ist nur die höhere Pauschale zulässig; ${MAHLZEITEN}`,
      `Überschneidung mit RK-2026-00009 am 16.03.2026, 17.03.2026 und 18.03.2026: für diese Tage ist jeweils nur die höhere Pauschale zulässig; ${MAHLZEITEN}`,
    ]);
  });

  it('zwei eintägige Reisen am selben Tag → Abwesenheitszeiten zusammenrechnen (BMF 25.11.2020 Rz. 47)', () => {
    expect(ueberschneidungsVermerke([
      { belegNr: 'RK-2026-00011', datum: '2026-03-20', beideEintaegig: true },
      { belegNr: 'RK-2026-00010', datum: '2026-03-20', beideEintaegig: false },
    ])).toEqual([
      `Überschneidung mit RK-2026-00010 am 20.03.2026: für diesen Tag ist nur die höhere Pauschale zulässig; ${MAHLZEITEN}`,
      'Überschneidung mit RK-2026-00011 am 20.03.2026: zwei eintägige Reisen am selben Tag – Abwesenheitszeiten zusammenrechnen, höchstens eine Pauschale für den Tag (BMF 25.11.2020 Rz. 47). Bitte prüfen.',
    ]);
  });

  it('keine Treffer → keine Vermerke', () => {
    expect(ueberschneidungsVermerke([])).toEqual([]);
  });

  it('datumDe', () => {
    expect(datumDe('2027-01-02')).toBe('02.01.2027');
  });
});
