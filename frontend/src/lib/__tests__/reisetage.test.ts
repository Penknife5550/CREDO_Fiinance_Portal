import { describe, it, expect } from 'vitest';
import {
  berechneVmaVorschau,
  bildeReisetage,
  laenderfolge,
  landBezeichnung,
  landKeyZuFreitext,
  ReisetageFehler,
  setzeOrt24MitFolgetagen,
  uebernachtungsfrage,
  uebernehmeTagesangaben,
  type ReisetageFehlerCode,
  type VmaVorschau,
} from '../reisetage';
import type { ReisetagEingabe } from '../types';
import type { VmaSatz } from '../vma';

// BMF-Schreiben vom 05.12.2025 (Endbeträge 24 h / 8 h)
const SAETZE: ReadonlyMap<string, VmaSatz> = new Map([
  ['Belgien', { tagessatz24h: 59, tagessatz8h: 40 }],
  ['Niederlande', { tagessatz24h: 58, tagessatz8h: 39 }],
  ['Luxemburg', { tagessatz24h: 63, tagessatz8h: 42 }],
]);

/** Code des geworfenen ReisetageFehlers, null = kein Fehler. */
function fehlerCode(fn: () => unknown): ReisetageFehlerCode | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (err instanceof ReisetageFehler) return err.code;
    throw err;
  }
}

/** Tage bilden und wie im Formular in Eingaben überführen; `angaben` je Datum ergänzen. */
function eingaben(
  abfahrt: string,
  rueckkehr: string,
  angaben: Record<string, Partial<ReisetagEingabe>> = {},
  uebernachtung: boolean | null = null,
): ReisetagEingabe[] {
  return uebernehmeTagesangaben(bildeReisetage(abfahrt, rueckkehr, uebernachtung), []).map(t => ({ ...t, ...angaben[t.datum] }));
}

const summe = (v: VmaVorschau) => Math.round(v.tage.reduce((s, t) => s + t.vmaNetto, 0) * 100) / 100;

describe('bildeReisetage (Frontend-Zwilling)', () => {
  it('leere oder ungültige Eingabe → FORMAT', () => {
    expect(fehlerCode(() => bildeReisetage('', '', null))).toBe('FORMAT');
    expect(fehlerCode(() => bildeReisetage('2026-02-30T08:00', '2026-03-01T08:00', null))).toBe('FORMAT');
    expect(fehlerCode(() => bildeReisetage('2026-03-15T24:00', '2026-03-16T08:00', null))).toBe('FORMAT');
  });

  it('Rückkehr nicht nach Abfahrt → Fehler', () => {
    expect(fehlerCode(() => bildeReisetage('2026-03-15T10:00', '2026-03-15T08:00', null))).toBe('RUECKKEHR_NICHT_NACH_ABFAHRT');
    expect(fehlerCode(() => bildeReisetage('2026-03-15T10:00', '2026-03-15T10:00', null))).toBe('RUECKKEHR_NICHT_NACH_ABFAHRT');
  });

  it('eintägig: Anspruch nur bei strikt mehr als 8 h', () => {
    expect(bildeReisetage('2026-03-15T09:00', '2026-03-15T14:00', null)).toEqual([
      { datum: '2026-03-15', typ: 'EINTAEGIG', eintaegigUeber8h: false },
    ]);
    expect(bildeReisetage('2026-03-15T08:00', '2026-03-15T16:00', null)[0].eintaegigUeber8h).toBe(false);
    expect(bildeReisetage('2026-03-15T08:00', '2026-03-15T16:01', null)[0].eintaegigUeber8h).toBe(true);
  });

  it('mehrtägig: Anreise / Ganztag / Abreise', () => {
    expect(bildeReisetage('2026-03-15T08:00', '2026-03-17T18:00', null).map(t => t.typ)).toEqual(['ANREISE', 'GANZTAG', 'ABREISE']);
  });

  it('mehr als 60 Kalendertage → Fehler, genau 60 erlaubt', () => {
    expect(bildeReisetage('2026-01-01T08:00', '2026-03-01T18:00', null)).toHaveLength(60);
    expect(fehlerCode(() => bildeReisetage('2026-01-01T08:00', '2026-03-02T18:00', null))).toBe('ZU_VIELE_TAGE');
  });

  it('unter 24 h über Mitternacht: Übernachtung Pflicht; ohne Übernachtung EIN Tag (größerer Zeitanteil)', () => {
    expect(fehlerCode(() => bildeReisetage('2026-10-12T17:00', '2026-10-13T00:30', null))).toBe('UEBERNACHTUNG_FEHLT');
    expect(bildeReisetage('2026-10-12T17:00', '2026-10-13T00:30', false)).toEqual([
      { datum: '2026-10-12', typ: 'EINTAEGIG', eintaegigUeber8h: false },
    ]);
    expect(bildeReisetage('2026-10-12T16:00', '2026-10-13T02:00', false)).toEqual([
      { datum: '2026-10-12', typ: 'EINTAEGIG', eintaegigUeber8h: true },
    ]);
    // Gleichstand (6 h / 6 h) → Abreisetag
    expect(bildeReisetage('2026-10-12T18:00', '2026-10-13T06:00', false)).toEqual([
      { datum: '2026-10-13', typ: 'EINTAEGIG', eintaegigUeber8h: true },
    ]);
    expect(bildeReisetage('2026-10-12T17:00', '2026-10-13T00:30', true).map(t => t.typ)).toEqual(['ANREISE', 'ABREISE']);
  });

  it('ab 24 h über zwei Kalendertage ohne Übernachtung: EIN Ganztag (größerer Zeitanteil), ohne Angabe An- und Abreisetag', () => {
    expect(bildeReisetage('2026-05-04T06:00', '2026-05-05T08:00', false)).toEqual([
      { datum: '2026-05-04', typ: 'GANZTAG', eintaegigUeber8h: false },
    ]);
    expect(bildeReisetage('2026-05-04T20:00', '2026-05-05T22:00', false)).toEqual([
      { datum: '2026-05-05', typ: 'GANZTAG', eintaegigUeber8h: false },
    ]);
    expect(bildeReisetage('2026-05-04T06:00', '2026-05-05T08:00', null).map(t => t.typ)).toEqual(['ANREISE', 'ABREISE']);
    // ab drei Kalendertagen zählt die Angabe nicht
    expect(bildeReisetage('2026-05-04T06:00', '2026-05-06T08:00', false).map(t => t.typ)).toEqual(['ANREISE', 'GANZTAG', 'ABREISE']);
  });
});

describe('uebernachtungsfrage', () => {
  it('Pflicht unter 24 h über zwei Kalendertage, vorbelegt ab 24 h über zwei Kalendertage, sonst keine Frage', () => {
    expect(uebernachtungsfrage('2026-10-12T17:00', '2026-10-13T00:30')).toBe('pflicht');
    expect(uebernachtungsfrage('2026-10-12T08:00', '2026-10-13T07:59')).toBe('pflicht');
    expect(uebernachtungsfrage('2026-10-12T08:00', '2026-10-13T08:00')).toBe('vorbelegt'); // genau 24 h
    expect(uebernachtungsfrage('2026-10-12T00:00', '2026-10-13T23:59')).toBe('vorbelegt');
    expect(uebernachtungsfrage('2026-10-12T08:00', '2026-10-14T08:00')).toBeNull(); // drei Kalendertage
    expect(uebernachtungsfrage('2026-10-12T08:00', '2026-10-12T18:00')).toBeNull(); // gleicher Tag
    expect(uebernachtungsfrage('2026-10-13T08:00', '2026-10-12T08:00')).toBeNull(); // Rückkehr vor Abfahrt
    expect(uebernachtungsfrage('', '2026-10-13T00:30')).toBeNull();
  });
});

describe('uebernehmeTagesangaben', () => {
  const tag = (over: Partial<ReisetagEingabe> & Pick<ReisetagEingabe, 'datum' | 'typ'>): ReisetagEingabe => ({
    fruehstueckGestellt: false,
    mittagGestellt: false,
    abendGestellt: false,
    land24uhr: null,
    letzterTaetigkeitsort: null,
    landFreitext: null,
    ...over,
  });
  const bisher: ReisetagEingabe[] = [
    tag({ datum: '2026-10-12', typ: 'ANREISE', mittagGestellt: true, land24uhr: 'INLAND', letzterTaetigkeitsort: 'Niederlande' }),
    tag({ datum: '2026-10-13', typ: 'GANZTAG', fruehstueckGestellt: true, land24uhr: 'SEETAG' }),
    tag({ datum: '2026-10-14', typ: 'ABREISE', abendGestellt: true, letzterTaetigkeitsort: 'ANDERES', landFreitext: 'Nauru' }),
  ];
  const kurz = (t: ReisetagEingabe) =>
    [t.datum, t.typ, t.fruehstueckGestellt, t.mittagGestellt, t.abendGestellt, t.land24uhr, t.letzterTaetigkeitsort, t.landFreitext];

  it('gleicher Zeitraum: alles bleibt erhalten', () => {
    const neu = uebernehmeTagesangaben(bildeReisetage('2026-10-12T09:00', '2026-10-14T17:00', null), bisher);
    expect(neu.map(kurz)).toEqual(bisher.map(kurz));
  });

  it('Rückkehr einen Tag später: Mahlzeiten je Datum, Land nur bei gleicher Frage', () => {
    const neu = uebernehmeTagesangaben(bildeReisetage('2026-10-12T08:00', '2026-10-15T18:00', null), bisher);
    expect(neu.map(kurz)).toEqual([
      ['2026-10-12', 'ANREISE', false, true, false, 'INLAND', 'Niederlande', null],
      ['2026-10-13', 'GANZTAG', true, false, false, 'SEETAG', null, null],
      // war Abreisetag (letzte Tätigkeit) — jetzt Ganztag (Ort um 24 Uhr): Land verworfen
      ['2026-10-14', 'GANZTAG', false, false, true, null, null, null],
      ['2026-10-15', 'ABREISE', false, false, false, null, null, null],
    ]);
  });

  it('Seetag nur, wenn der Tag Ganztag bleibt', () => {
    const neu = uebernehmeTagesangaben(bildeReisetage('2026-10-13T08:00', '2026-10-14T18:00', null), bisher);
    expect(neu.map(kurz)).toEqual([
      ['2026-10-13', 'ANREISE', true, false, false, null, null, null],
      ['2026-10-14', 'ABREISE', false, false, true, null, 'ANDERES', 'Nauru'],
    ]);
  });

  it('ohne Übernachtung: der eine Tag behält die Angaben seines Datums', () => {
    const neu = uebernehmeTagesangaben(bildeReisetage('2026-10-12T16:00', '2026-10-13T02:00', false), bisher);
    expect(neu).toEqual([
      { datum: '2026-10-12', typ: 'EINTAEGIG', eintaegigUeber8h: true, fruehstueckGestellt: false, mittagGestellt: true,
        abendGestellt: false, land24uhr: null, letzterTaetigkeitsort: null, landFreitext: null },
    ]);
  });
});

describe('setzeOrt24MitFolgetagen („Staat nicht in der Liste“ für mehrere Tage)', () => {
  const tage = eingaben('2026-10-12T08:00', '2026-10-16T18:00'); // An, 3 Zwischentage, Ab
  const kurz = (t: ReisetagEingabe) => [t.land24uhr ?? null, t.landFreitext ?? null];
  const setze = (liste: ReisetagEingabe[], i: number, aenderung: Partial<ReisetagEingabe>) =>
    setzeOrt24MitFolgetagen(liste, i, { ...liste[i], ...aenderung });

  it('ANDERES am Anreisetag: Zwischentage ohne Angabe ziehen mit, der Staat ebenso; Abreisetag bleibt (erbt beim Rechnen)', () => {
    const gewaehlt = setze(tage, 0, { land24uhr: 'ANDERES' });
    expect(gewaehlt.map(kurz)).toEqual([['ANDERES', null], ['ANDERES', null], ['ANDERES', null], ['ANDERES', null], [null, null]]);
    const getippt = setze(gewaehlt, 0, { land24uhr: 'ANDERES', landFreitext: 'Nauru' });
    expect(getippt.map(kurz)).toEqual([['ANDERES', 'Nauru'], ['ANDERES', 'Nauru'], ['ANDERES', 'Nauru'], ['ANDERES', 'Nauru'], [null, null]]);
    const v = berechneVmaVorschau(getippt, 'Luxemburg', SAETZE);
    expect(v.fehler).toBeNull();
    expect(laenderfolge(v.tage.map(t => t.land))).toBe('Nauru');
  });

  it('endet am ersten Folgetag mit eigener Angabe; Wechsel weg von ANDERES nimmt die Mitläufer mit', () => {
    const mitEigenem = tage.map((t, i) => (i === 2 ? { ...t, land24uhr: 'Belgien' } : t));
    const r = setze(mitEigenem, 0, { land24uhr: 'ANDERES', landFreitext: 'Nauru' });
    expect(r.map(kurz)).toEqual([['ANDERES', 'Nauru'], ['ANDERES', 'Nauru'], ['Belgien', null], [null, null], [null, null]]);
    // „Südkorea“ steht doch in der Liste → Mitläufer übernehmen das Land
    expect(setze(r, 0, { land24uhr: 'Korea, Republik', landFreitext: null }).map(kurz))
      .toEqual([['Korea, Republik', null], ['Korea, Republik', null], ['Belgien', null], [null, null], [null, null]]);
    // „Inland“ wird nicht weitergegeben: Mitläufer wieder ohne Angabe (= Hauptland)
    expect(setze(r, 0, { land24uhr: 'INLAND', landFreitext: null }).map(kurz))
      .toEqual([['INLAND', null], [null, null], ['Belgien', null], [null, null], [null, null]]);
  });

  it('ohne ANDERES oder ohne Änderung der 24-Uhr-Angabe: nur der Tag selbst', () => {
    expect(setze(tage, 0, { land24uhr: 'Belgien' }).map(kurz)).toEqual([['Belgien', null], [null, null], [null, null], [null, null], [null, null]]);
    const anderes = setze(tage, 0, { land24uhr: 'ANDERES', landFreitext: 'Nauru' }).map((t, i) => (i === 1 ? { ...t, land24uhr: null, landFreitext: null } : t));
    expect(setze(anderes, 0, { fruehstueckGestellt: true }).map(kurz)).toEqual(anderes.map(kurz));
  });
});

describe('landKeyZuFreitext', () => {
  const KEYS = ['Korea, Republik', 'Weißrussland', 'Côte d’Ivoire', 'Moldau, Republik', 'Großbritannien', 'Niederlande', 'Tschechien',
    'Spanien', 'Spanien — Kanarische Inseln', 'China — Hongkong', 'Dänemark', 'Luxemburg'];

  it('findet Listennamen ohne Groß-/Kleinschreibung, Akzente und Apostroph sowie übliche andere Namen', () => {
    expect(landKeyZuFreitext(' südkorea ', KEYS)).toBe('Korea, Republik');
    expect(landKeyZuFreitext('Belarus', KEYS)).toBe('Weißrussland');
    expect(landKeyZuFreitext('Elfenbeinküste', KEYS)).toBe('Côte d’Ivoire');
    expect(landKeyZuFreitext("cote d'ivoire", KEYS)).toBe('Côte d’Ivoire');
    expect(landKeyZuFreitext('Moldawien', KEYS)).toBe('Moldau, Republik');
    expect(landKeyZuFreitext('England', KEYS)).toBe('Großbritannien');
    expect(landKeyZuFreitext('Holland', KEYS)).toBe('Niederlande');
    expect(landKeyZuFreitext('Tschechische Republik', KEYS)).toBe('Tschechien');
    expect(landKeyZuFreitext('Teneriffa', KEYS)).toBe('Spanien — Kanarische Inseln');
    expect(landKeyZuFreitext('Hongkong', KEYS)).toBe('China — Hongkong');
    expect(landKeyZuFreitext('Grönland', KEYS)).toBe('Dänemark');
    expect(landKeyZuFreitext('LUXEMBURG', KEYS)).toBe('Luxemburg');
  });

  it('nicht aufgeführte Staaten und leere Eingaben → null; Alias nur, wenn das Ziel in der Liste steht', () => {
    expect(landKeyZuFreitext('Nauru', KEYS)).toBeNull();
    expect(landKeyZuFreitext('Nordkorea', KEYS)).toBeNull();
    expect(landKeyZuFreitext('   ', KEYS)).toBeNull();
    expect(landKeyZuFreitext('Russland', KEYS)).toBeNull(); // Russische Föderation fehlt in KEYS
  });
});

describe('berechneVmaVorschau (gleiche reine Funktionen wie der Server)', () => {
  it('Inland 3 Tage = 56,00', () => {
    const v = berechneVmaVorschau(eingaben('2026-03-15T08:00', '2026-03-17T18:00'), null, SAETZE);
    expect(v.fehler).toBeNull();
    expect(v.tage.map(t => t.land.landKey)).toEqual(['INLAND', 'INLAND', 'INLAND']);
    expect(summe(v)).toBe(56);
  });

  it('BE → NL → LU, Frühstück Tag 2–4 = 166,20 (Tag 4 ohne Angabe erbt LU)', () => {
    const tage = eingaben('2026-10-12T08:00', '2026-10-15T18:00', {
      '2026-10-13': { land24uhr: 'Niederlande', fruehstueckGestellt: true },
      '2026-10-14': { land24uhr: 'Luxemburg', fruehstueckGestellt: true },
      '2026-10-15': { fruehstueckGestellt: true },
    });
    const v = berechneVmaVorschau(tage, 'Belgien', SAETZE);
    expect(v.fehler).toBeNull();
    expect(v.tage.map(t => t.vmaNetto)).toEqual([40, 46.4, 50.4, 29.4]);
    expect(summe(v)).toBe(166.2);
    expect(laenderfolge(v.tage.map(t => t.land))).toBe('Belgien → Niederlande → Luxemburg');
  });

  it('„Staat nicht in der Liste“ ohne Freitext: Beträge (Satz Luxemburg) bleiben, Meldung wie der Server', () => {
    const tage = eingaben('2026-10-12T08:00', '2026-10-14T18:00', { '2026-10-13': { land24uhr: 'ANDERES' } });
    const ohne = berechneVmaVorschau(tage, 'Belgien', SAETZE);
    expect(ohne.fehler).toBe('Bitte geben Sie für den 13.10.2026 an, in welchem Staat Sie waren (Staat nicht in der Liste).');
    expect(ohne.tage.map(t => t.vmaNetto)).toEqual([40, 63, 42]);
    expect(ohne.tage.map(t => t.land)).toEqual([
      { landKey: 'Belgien', landFreitext: null },
      { landKey: 'ANDERES', landFreitext: null },
      { landKey: 'ANDERES', landFreitext: null },
    ]);

    const mit = berechneVmaVorschau(
      tage.map(t => (t.datum === '2026-10-13' ? { ...t, landFreitext: ' Nauru ' } : t)),
      'Belgien',
      SAETZE,
    );
    expect(mit.fehler).toBeNull();
    expect(mit.tage[2].land).toEqual({ landKey: 'ANDERES', landFreitext: 'Nauru' });
    expect(laenderfolge(mit.tage.map(t => t.land))).toBe('Belgien → Nauru');
  });

  it('anderer Fehler: keine Beträge, nur die Meldung', () => {
    expect(berechneVmaVorschau(eingaben('2026-10-12T08:00', '2026-10-13T18:00'), 'Atlantis', SAETZE))
      .toEqual({ tage: [], fehler: 'Unbekanntes Reiseland: Atlantis' });
    const inland = berechneVmaVorschau(
      eingaben('2026-10-12T08:00', '2026-10-13T18:00', { '2026-10-13': { letzterTaetigkeitsort: 'Belgien' } }),
      null,
      SAETZE,
    );
    expect(inland.tage).toEqual([]);
    expect(inland.fehler).toBe(
      'Bei einer Inlandsreise kann kein Reisetag im Ausland liegen (13.10.2026). Bitte wählen Sie „Ausland“ und ein Reiseland.',
    );
  });
});

describe('landBezeichnung / laenderfolge', () => {
  it('Anzeigenamen', () => {
    expect(landBezeichnung({ landKey: 'INLAND', landFreitext: null })).toBe('Inland');
    expect(landBezeichnung({ landKey: 'SEETAG', landFreitext: null })).toBe('Seetag');
    expect(landBezeichnung({ landKey: 'ANDERES', landFreitext: 'Nauru' })).toBe('Nauru');
    expect(landBezeichnung({ landKey: 'ANDERES', landFreitext: null })).toBe('Staat nicht in der Liste');
    expect(landBezeichnung({ landKey: 'Frankreich — Paris', landFreitext: null })).toBe('Frankreich — Paris');
  });

  it('aufeinanderfolgend gleiche Länder einmal, Rückkehr ins selbe Land erneut', () => {
    expect(laenderfolge([
      { landKey: 'INLAND', landFreitext: null },
      { landKey: 'Belgien', landFreitext: null },
      { landKey: 'Belgien', landFreitext: null },
      { landKey: 'SEETAG', landFreitext: null },
      { landKey: 'Belgien', landFreitext: null },
    ])).toBe('Inland → Belgien → Seetag → Belgien');
    expect(laenderfolge([])).toBe('');
  });
});
