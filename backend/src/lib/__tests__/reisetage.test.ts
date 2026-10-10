import { describe, it, expect } from 'vitest';
import {
  bildeReisetage,
  bestimmeTageslaender,
  waehleTagesSatz,
  waehleSatzstand,
  satzLandKey,
  ReisetageFehler,
  type ReisetageFehlerCode,
  type Satzstand,
  type TagesLandAngabe,
} from '../reisetage.js';
import { vmaTag, INLAND_SATZ } from '../vma.js';

const BMF_2026 = 'BMF-Schreiben vom 05.12.2025';
const stand = (landKey: string, gueltigVon: string, satz24h: number, satz8h: number, quelle = BMF_2026): Satzstand =>
  ({ landKey, gueltigVon, quelle, satz24h, satz8h });

// Satzstand 2026: BMF-Schreiben vom 05.12.2025 (Endbeträge 24 h / 8 h)
const STAENDE: readonly Satzstand[] = [
  stand('Belgien', '2026-01-01', 59, 40),
  stand('Niederlande', '2026-01-01', 58, 39),
  stand('Luxemburg', '2026-01-01', 63, 42),
  stand('USA', '2026-01-01', 59, 40),
];
// Fiktiver Test-Stand 2027 (Werte frei gewählt, nur zur Unterscheidung)
const TEST_2027 = 'Test-Stand 2027';
const STAENDE_2027: readonly Satzstand[] = [
  ...STAENDE,
  stand('Belgien', '2027-01-01', 61, 41, TEST_2027),
  stand('Luxemburg', '2027-01-01', 65, 44, TEST_2027),
];

type TagesEingabe = Partial<Pick<TagesLandAngabe, 'land24uhr' | 'letzterTaetigkeitsort' | 'landFreitext'>> & {
  fruehstueck?: boolean;
  mittag?: boolean;
  abend?: boolean;
};

/** Komplette Kette wie in der Route: Tage bilden → Angaben per Datum zuordnen → Land → Satz → VMA. */
function rechne(
  abfahrt: string,
  rueckkehr: string,
  opts: {
    uebernachtung?: boolean | null;
    hauptland?: string | null;
    tage?: Record<string, TagesEingabe>;
    staende?: readonly Satzstand[];
  } = {},
) {
  const tage = bildeReisetage(abfahrt, rueckkehr, opts.uebernachtung ?? null);
  const angaben = tage.map(t => ({ ...t, ...opts.tage?.[t.datum] }));
  const laender = bestimmeTageslaender(angaben, opts.hauptland ?? null);
  const betraege = angaben.map(
    (t, i) =>
      vmaTag(
        {
          typ: t.typ,
          eintaegigUeber8h: t.eintaegigUeber8h,
          fruehstueckGestellt: !!t.fruehstueck,
          mittagGestellt: !!t.mittag,
          abendGestellt: !!t.abend,
        },
        waehleTagesSatz(laender[i].landKey, t.datum, opts.staende ?? STAENDE),
      ).vmaNetto,
  );
  const summe = Math.round(betraege.reduce((a, b) => a + b, 0) * 100) / 100;
  return { tage, laender: laender.map(l => l.landKey), betraege, summe };
}

/** Erwartet einen ReisetageFehler mit Code (und optional Meldungsteil). */
function erwarteFehler(fn: () => unknown, code: ReisetageFehlerCode, meldung?: RegExp) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ReisetageFehler);
    expect((err as ReisetageFehler).code).toBe(code);
    if (meldung) expect((err as ReisetageFehler).message).toMatch(meldung);
    return;
  }
  throw new Error(`ReisetageFehler ${code} erwartet, aber kein Fehler geworfen`);
}

const kurz = (t: { datum: string; typ: string; eintaegigUeber8h: boolean }) =>
  t.typ === 'EINTAEGIG' ? `${t.datum} EINTAEGIG ${t.eintaegigUeber8h ? '>8h' : '≤8h'}` : `${t.datum} ${t.typ}`;

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// ── 1. Tagesbildung ───────────────────────────────────────────────────────────

describe(`bildeReisetage (TZ=${TZ})`, () => {
  it('gleicher Kalendertag → EINTAEGIG, Anspruch nur bei strikt > 8 h', () => {
    expect(bildeReisetage('2026-03-16T08:00', '2026-03-16T16:00', null).map(kurz)).toEqual(['2026-03-16 EINTAEGIG ≤8h']);
    expect(bildeReisetage('2026-03-16T08:00', '2026-03-16T16:01', null).map(kurz)).toEqual(['2026-03-16 EINTAEGIG >8h']);
  });

  it('Übernachtungsangabe ist am gleichen Kalendertag und ab drei Kalendertagen ohne Bedeutung', () => {
    for (const u of [null, true, false]) {
      expect(bildeReisetage('2026-03-16T08:00', '2026-03-16T18:00', u)).toHaveLength(1);
      expect(bildeReisetage('2026-03-16T08:00', '2026-03-18T08:00', u).map(kurz))
        .toEqual(['2026-03-16 ANREISE', '2026-03-17 GANZTAG', '2026-03-18 ABREISE']);
    }
  });

  describe('ab 24 h über zwei Kalendertage', () => {
    it('mit Übernachtung oder ohne Angabe (alter Client) → An- und Abreisetag', () => {
      for (const u of [null, true]) {
        expect(bildeReisetage('2026-03-16T08:00', '2026-03-17T08:00', u).map(kurz)) // genau 24 h
          .toEqual(['2026-03-16 ANREISE', '2026-03-17 ABREISE']);
      }
    });

    it('ohne Übernachtung → EIN Ganztag (24-h-Satz) auf dem Tag mit dem größeren Zeitanteil (BMF 25.11.2020 Bsp. 31)', () => {
      expect(bildeReisetage('2026-03-16T08:00', '2026-03-17T08:00', false).map(kurz)).toEqual(['2026-03-16 GANZTAG']);
      expect(bildeReisetage('2026-03-16T20:00', '2026-03-17T22:00', false).map(kurz)).toEqual(['2026-03-17 GANZTAG']);
      // Gleichstand (12 h / 12 h) → Abreisetag
      expect(bildeReisetage('2026-03-16T12:00', '2026-03-17T12:00', false).map(kurz)).toEqual(['2026-03-17 GANZTAG']);
    });

    it('Befund: 2026-05-04T06:00 → 2026-05-05T08:00 (26 h) ohne Übernachtung, Belgien = 59,00 statt 2 × 40,00', () => {
      const r = rechne('2026-05-04T06:00', '2026-05-05T08:00', { uebernachtung: false, hauptland: 'Belgien' });
      expect(r.tage.map(kurz)).toEqual(['2026-05-04 GANZTAG']);
      expect(r.summe).toBe(59);
    });

    it('Befund: Inland mit Mittag und Abend = 28 − 22,40 = 5,60 (Kürzung einmal, nicht je Tag gedeckelt)', () => {
      const r = rechne('2026-05-04T06:00', '2026-05-05T08:00', {
        uebernachtung: false,
        tage: { '2026-05-04': { mittag: true, abend: true } },
      });
      expect(r.betraege).toEqual([5.6]);
    });
  });

  it('DST Herbst: 2026-10-23T08:00 → 2026-10-27T18:00 = 5 Tage, Inland 112,00', () => {
    const r = rechne('2026-10-23T08:00', '2026-10-27T18:00');
    expect(r.tage.map(kurz)).toEqual([
      '2026-10-23 ANREISE', '2026-10-24 GANZTAG', '2026-10-25 GANZTAG', '2026-10-26 GANZTAG', '2026-10-27 ABREISE',
    ]);
    expect(r.summe).toBe(112);
  });

  it('DST Frühjahr: 2026-03-27T08:00 → 2026-03-31T18:00 = 5 eindeutige Tage, Inland 112,00', () => {
    const r = rechne('2026-03-27T08:00', '2026-03-31T18:00');
    expect(r.tage.map(t => t.datum)).toEqual(['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
    expect(new Set(r.tage.map(t => t.datum)).size).toBe(5);
    expect(r.summe).toBe(112);
  });

  it('Abfahrt 00:30: 2026-05-04T00:30 → 2026-05-05T18:00 = 2 Tage, 28,00 (kein 03.05.)', () => {
    const r = rechne('2026-05-04T00:30', '2026-05-05T18:00');
    expect(r.tage.map(kurz)).toEqual(['2026-05-04 ANREISE', '2026-05-05 ABREISE']);
    expect(r.summe).toBe(28);
  });

  it('Jahreswechsel 2026-12-30 → 2027-01-02 = 4 Tage', () => {
    const r = rechne('2026-12-30T08:00', '2027-01-02T18:00');
    expect(r.tage.map(kurz)).toEqual([
      '2026-12-30 ANREISE', '2026-12-31 GANZTAG', '2027-01-01 GANZTAG', '2027-01-02 ABREISE',
    ]);
    expect(r.summe).toBe(84);
  });

  it('Schaltjahr: 29.02. wird als Ganztag gezählt', () => {
    expect(bildeReisetage('2028-02-28T08:00', '2028-03-01T18:00', null).map(kurz))
      .toEqual(['2028-02-28 ANREISE', '2028-02-29 GANZTAG', '2028-03-01 ABREISE']);
  });

  it('eintägig am Tag der Zeitumstellung: Wanduhrzeit zählt (01:00 → 09:30 = 8:30 h)', () => {
    expect(bildeReisetage('2026-03-29T01:00', '2026-03-29T09:30', null).map(kurz)).toEqual(['2026-03-29 EINTAEGIG >8h']);
  });

  describe('unter 24 h über Mitternacht (Mitternachtsregel)', () => {
    it('17:00 → 00:30 ohne Übernachtung = 0,00 (7:30 h, ein Tag)', () => {
      const r = rechne('2026-03-16T17:00', '2026-03-17T00:30', { uebernachtung: false });
      expect(r.tage.map(kurz)).toEqual(['2026-03-16 EINTAEGIG ≤8h']);
      expect(r.summe).toBe(0);
    });

    it('16:00 → 02:00 ohne Übernachtung = 14,00 auf dem ersten Tag (8 h vs. 2 h)', () => {
      const r = rechne('2026-03-16T16:00', '2026-03-17T02:00', { uebernachtung: false });
      expect(r.tage.map(kurz)).toEqual(['2026-03-16 EINTAEGIG >8h']);
      expect(r.betraege).toEqual([14]);
    });

    it('größerer Zeitanteil am zweiten Tag → Datum des zweiten Tags', () => {
      const r = rechne('2026-03-16T22:00', '2026-03-17T09:00', { uebernachtung: false });
      expect(r.tage.map(kurz)).toEqual(['2026-03-17 EINTAEGIG >8h']);
      expect(r.summe).toBe(14);
    });

    it('Gleichstand (5 h / 5 h) → Abreisetag', () => {
      expect(bildeReisetage('2026-03-16T19:00', '2026-03-17T05:00', false).map(kurz)).toEqual(['2026-03-17 EINTAEGIG >8h']);
    });

    it('Jahreswechsel ohne Übernachtung: 31.12. 20:00 → 01.01. 06:00 → ein Tag am 01.01.', () => {
      expect(bildeReisetage('2026-12-31T20:00', '2027-01-01T06:00', false).map(kurz)).toEqual(['2027-01-01 EINTAEGIG >8h']);
    });

    it('mit Übernachtung → An- und Abreisetag, Inland 28,00', () => {
      const r = rechne('2026-03-16T17:00', '2026-03-17T09:00', { uebernachtung: true });
      expect(r.tage.map(kurz)).toEqual(['2026-03-16 ANREISE', '2026-03-17 ABREISE']);
      expect(r.summe).toBe(28);
    });

    it('ohne Übernachtungsangabe → Pflichtfrage (Fehler)', () => {
      erwarteFehler(() => bildeReisetage('2026-03-16T17:00', '2026-03-17T00:30', null), 'UEBERNACHTUNG_FEHLT', /übernachtet/);
      erwarteFehler(
        () => bildeReisetage('2026-03-16T17:00', '2026-03-17T00:30', undefined as unknown as null),
        'UEBERNACHTUNG_FEHLT',
      );
    });
  });

  describe('Fehler', () => {
    it('Rückkehr ≤ Abfahrt', () => {
      erwarteFehler(() => bildeReisetage('2026-03-16T10:00', '2026-03-16T10:00', true), 'RUECKKEHR_NICHT_NACH_ABFAHRT', /nach der Abfahrt/);
      erwarteFehler(() => bildeReisetage('2026-03-16T10:00', '2026-03-15T18:00', true), 'RUECKKEHR_NICHT_NACH_ABFAHRT');
    });

    it('mehr als 60 Kalendertage (60 sind erlaubt)', () => {
      expect(bildeReisetage('2026-01-01T08:00', '2026-03-01T18:00', null)).toHaveLength(60);
      erwarteFehler(() => bildeReisetage('2026-01-01T08:00', '2026-03-02T18:00', null), 'ZU_VIELE_TAGE', /60 Kalendertage/);
    });

    it('fremdes Format und unmögliche Kalenderzeitpunkte', () => {
      erwarteFehler(() => bildeReisetage('16.03.2026 08:00', '2026-03-16T18:00', null), 'FORMAT');
      erwarteFehler(() => bildeReisetage('2026-02-30T08:00', '2026-03-02T18:00', true), 'FORMAT');
      erwarteFehler(() => bildeReisetage('2026-03-16T08:00', '2026-03-16T24:00', null), 'FORMAT');
    });

    it('akzeptiert Sekunden/Z-Suffix (gleiche Wanduhrzeit wie gespeichert)', () => {
      expect(bildeReisetage('2026-03-16T08:00:00.000Z', '2026-03-16T16:01:00.000Z', null))
        .toEqual([{ datum: '2026-03-16', typ: 'EINTAEGIG', eintaegigUeber8h: true }]);
    });
  });
});

// ── 2. Maßgebendes Land je Tag ────────────────────────────────────────────────

describe('bestimmeTageslaender', () => {
  const T = (datum: string, typ: TagesLandAngabe['typ'], extra: Partial<TagesLandAngabe> = {}): TagesLandAngabe => ({
    datum, typ, ...extra,
  });

  it('BE → NL → LU, 4 Tage, Frühstück Tag 2–4 = 40,00 + 46,40 + 50,40 + 29,40 = 166,20 (Tag 4 erbt LU)', () => {
    const r = rechne('2026-03-16T08:00', '2026-03-19T18:00', {
      hauptland: 'Belgien',
      tage: {
        '2026-03-16': { land24uhr: 'Belgien' },
        '2026-03-17': { land24uhr: 'Niederlande', fruehstueck: true },
        '2026-03-18': { land24uhr: 'Luxemburg', fruehstueck: true },
        '2026-03-19': { fruehstueck: true },
      },
    });
    expect(r.laender).toEqual(['Belgien', 'Niederlande', 'Luxemburg', 'Luxemburg']);
    expect(r.betraege).toEqual([40, 46.4, 50.4, 29.4]);
    expect(r.summe).toBe(166.2);
  });

  it('Nachtbus: Mo 22:00 ab, Mo land24uhr = INLAND → Mo 14,00 (Inland)', () => {
    const r = rechne('2026-03-16T22:00', '2026-03-18T18:00', {
      hauptland: 'Niederlande',
      tage: { '2026-03-16': { land24uhr: 'INLAND' } },
    });
    expect(r.laender).toEqual(['INLAND', 'Niederlande', 'Niederlande']);
    expect(r.betraege[0]).toBe(14);
  });

  it('Zwischentag land24uhr = INLAND + letzte Tätigkeit Niederlande → 58,00 (Satz NL)', () => {
    const r = rechne('2026-03-16T08:00', '2026-03-18T18:00', {
      hauptland: 'Niederlande',
      tage: { '2026-03-17': { land24uhr: 'INLAND', letzterTaetigkeitsort: 'Niederlande' } },
    });
    expect(r.laender[1]).toBe('Niederlande');
    expect(r.betraege[1]).toBe(58);
  });

  it('Inlandstag mit Inlandstätigkeit + Frühstück → 28 − 5,60 = 22,40', () => {
    const r = rechne('2026-03-16T08:00', '2026-03-18T18:00', {
      hauptland: 'Niederlande',
      tage: { '2026-03-17': { land24uhr: 'INLAND', letzterTaetigkeitsort: 'INLAND', fruehstueck: true } },
    });
    expect(r.laender[1]).toBe('INLAND');
    expect(r.betraege[1]).toBe(22.4);
  });

  it('Seetag (GANZTAG) → 63,00 (Satz Luxemburg)', () => {
    const r = rechne('2026-03-16T08:00', '2026-03-18T18:00', {
      hauptland: 'Niederlande',
      tage: { '2026-03-17': { land24uhr: 'SEETAG' } },
    });
    expect(r.laender[1]).toBe('SEETAG');
    expect(r.betraege[1]).toBe(63);
  });

  it('ANDERES mit Freitext → 63,00 (Satz Luxemburg), Freitext im Ergebnis', () => {
    const r = rechne('2026-03-16T08:00', '2026-03-18T18:00', {
      hauptland: 'Belgien',
      tage: { '2026-03-17': { land24uhr: 'ANDERES', landFreitext: '  Atlantis  ' } },
    });
    expect(r.laender[1]).toBe('ANDERES');
    expect(r.betraege[1]).toBe(63);
    const laender = bestimmeTageslaender(
      [T('2026-03-16', 'ANREISE'), T('2026-03-17', 'GANZTAG', { land24uhr: 'ANDERES', landFreitext: '  Atlantis  ' })],
      'Belgien',
    );
    expect(laender[1]).toEqual({ landKey: 'ANDERES', landFreitext: 'Atlantis' });
    expect(laender[0]).toEqual({ landKey: 'Belgien', landFreitext: null });
  });

  it('ANDERES ohne Freitext → Fehler (auch bei leerem/Leerzeichen-Freitext)', () => {
    for (const landFreitext of [undefined, null, '', '   ']) {
      erwarteFehler(
        () => bestimmeTageslaender([T('2026-03-17', 'GANZTAG', { land24uhr: 'ANDERES', landFreitext })], 'Belgien'),
        'FREITEXT_FEHLT',
        /17\.03\.2026/,
      );
    }
    erwarteFehler(
      () => bestimmeTageslaender([T('2026-03-17', 'ABREISE', { letzterTaetigkeitsort: 'ANDERES' })], 'Belgien'),
      'FREITEXT_FEHLT',
    );
  });

  it('Inlandsreise mit Auslandstag → Fehler', () => {
    erwarteFehler(
      () => rechne('2026-03-16T08:00', '2026-03-18T18:00', { hauptland: null, tage: { '2026-03-17': { land24uhr: 'Belgien' } } }),
      'AUSLANDSTAG_BEI_INLANDSREISE',
      /17\.03\.2026/,
    );
    for (const extra of [{ letzterTaetigkeitsort: 'Niederlande' }, { land24uhr: 'ANDERES', landFreitext: 'X' }, { land24uhr: 'SEETAG' }]) {
      erwarteFehler(() => bestimmeTageslaender([T('2026-03-17', 'GANZTAG', extra)], null), 'AUSLANDSTAG_BEI_INLANDSREISE');
    }
  });

  it('Inlandsreise: alle Tage INLAND (auch mit ausdrücklicher Angabe INLAND)', () => {
    expect(
      bestimmeTageslaender(
        [T('2026-03-16', 'ANREISE', { land24uhr: 'INLAND' }), T('2026-03-17', 'GANZTAG'), T('2026-03-18', 'ABREISE', { letzterTaetigkeitsort: 'INLAND' })],
        null,
      ).map(l => l.landKey),
    ).toEqual(['INLAND', 'INLAND', 'INLAND']);
  });

  it('SEETAG nur am GANZTAG → sonst Fehler', () => {
    erwarteFehler(() => bestimmeTageslaender([T('2026-03-16', 'ANREISE', { land24uhr: 'SEETAG' })], 'Niederlande'), 'SEETAG_NUR_GANZTAG', /16\.03\.2026/);
    erwarteFehler(() => bestimmeTageslaender([T('2026-03-18', 'ABREISE', { letzterTaetigkeitsort: 'SEETAG' })], 'Niederlande'), 'SEETAG_NUR_GANZTAG');
    erwarteFehler(() => bestimmeTageslaender([T('2026-03-16', 'EINTAEGIG', { letzterTaetigkeitsort: 'SEETAG' })], 'Niederlande'), 'SEETAG_NUR_GANZTAG');
  });

  it('unbekannter reservierter Wert (Schreibvariante) → Fehler; Hauptland darf kein reservierter Wert sein', () => {
    for (const wert of ['inland', 'Seetag', 'anderes', ' INLAND']) {
      erwarteFehler(() => bestimmeTageslaender([T('2026-03-17', 'GANZTAG', { land24uhr: wert })], 'Belgien'), 'UNGUELTIGE_LANDANGABE', /Ungültige Landangabe/);
    }
    for (const hauptland of ['INLAND', 'ANDERES', 'SEETAG', 'seetag']) {
      erwarteFehler(() => bestimmeTageslaender([T('2026-03-17', 'GANZTAG')], hauptland), 'UNGUELTIGE_LANDANGABE', /Ungültiges Reiseland/);
    }
  });

  it('fehlende Angaben → Hauptland (Anreise, Zwischentag, eintägig)', () => {
    expect(
      bestimmeTageslaender([T('2026-03-16', 'ANREISE'), T('2026-03-17', 'GANZTAG', { land24uhr: '' })], 'Belgien').map(l => l.landKey),
    ).toEqual(['Belgien', 'Belgien']);
    expect(bestimmeTageslaender([T('2026-03-16', 'EINTAEGIG')], 'Belgien').map(l => l.landKey)).toEqual(['Belgien']);
  });

  it('Anreise-/Zwischentag: ohne 24-Uhr-Angabe gilt das Hauptland, nicht die Tätigkeit', () => {
    expect(
      bestimmeTageslaender([T('2026-03-17', 'GANZTAG', { letzterTaetigkeitsort: 'Niederlande' })], 'Belgien')[0].landKey,
    ).toBe('Belgien');
  });

  it('Anreise-/Zwischentag: 24-Uhr-Ort im Ausland schlägt die Tätigkeit', () => {
    expect(
      bestimmeTageslaender([T('2026-03-17', 'GANZTAG', { land24uhr: 'Luxemburg', letzterTaetigkeitsort: 'Niederlande' })], 'Belgien')[0].landKey,
    ).toBe('Luxemburg');
  });

  it('Abreise/eintägig: letzter Tätigkeitsort zählt, nicht der 24-Uhr-Ort', () => {
    const laender = bestimmeTageslaender(
      [
        T('2026-03-16', 'ANREISE', { land24uhr: 'Niederlande' }),
        T('2026-03-17', 'ABREISE', { land24uhr: 'INLAND', letzterTaetigkeitsort: 'Luxemburg' }),
      ],
      'Belgien',
    );
    expect(laender.map(l => l.landKey)).toEqual(['Niederlande', 'Luxemburg']);
  });

  it('Befund: eintägig erst in Belgien, danach in Aachen tätig → letzter Tätigkeitsort IM AUSLAND = Belgien 40,00', () => {
    const r = rechne('2026-03-16T06:00', '2026-03-16T20:00', {
      hauptland: 'Belgien',
      tage: { '2026-03-16': { letzterTaetigkeitsort: 'Belgien' } },
    });
    expect(r.laender).toEqual(['Belgien']);
    expect(r.betraege).toEqual([40]);
  });

  it('Befund: Zwischentag morgens Belgien, nachmittags Aachen, Hotel in Aachen → Belgien 59,00', () => {
    const r = rechne('2026-03-16T08:00', '2026-03-18T18:00', {
      hauptland: 'Belgien',
      tage: { '2026-03-17': { land24uhr: 'INLAND', letzterTaetigkeitsort: 'Belgien' } },
    });
    expect(r.laender[1]).toBe('Belgien');
    expect(r.betraege[1]).toBe(59);
  });

  it('Abreise ohne Tätigkeit im Ausland → INLAND', () => {
    const r = rechne('2026-03-16T08:00', '2026-03-17T18:00', {
      hauptland: 'Belgien',
      tage: { '2026-03-17': { letzterTaetigkeitsort: 'INLAND' } },
    });
    expect(r.laender).toEqual(['Belgien', 'INLAND']);
    expect(r.betraege).toEqual([40, 14]);
  });

  it('eintägige Auslandsreise über Mitternacht ohne Übernachtung: Satz des letzten Tätigkeitsorts', () => {
    const r = rechne('2026-03-16T16:00', '2026-03-17T02:00', {
      uebernachtung: false,
      hauptland: 'Belgien',
      tage: { '2026-03-16': { letzterTaetigkeitsort: 'Niederlande' } },
    });
    expect(r.laender).toEqual(['Niederlande']);
    expect(r.betraege).toEqual([39]);
  });

  it('Abreise ohne Angabe: Vortag im Inland → Hauptland', () => {
    expect(
      bestimmeTageslaender([T('2026-03-16', 'ANREISE', { land24uhr: 'INLAND' }), T('2026-03-17', 'ABREISE')], 'Belgien').map(l => l.landKey),
    ).toEqual(['INLAND', 'Belgien']);
  });

  it('Abreise ohne Angabe: Vortag Seetag → Hauptland (kein Seetag am Abreisetag)', () => {
    expect(
      bestimmeTageslaender(
        [T('2026-03-16', 'ANREISE'), T('2026-03-17', 'GANZTAG', { land24uhr: 'SEETAG' }), T('2026-03-18', 'ABREISE')],
        'Niederlande',
      ).map(l => l.landKey),
    ).toEqual(['Niederlande', 'SEETAG', 'Niederlande']);
  });

  it('Abreise ohne Angabe: Vortag ANDERES → ANDERES samt Freitext', () => {
    const laender = bestimmeTageslaender(
      [T('2026-03-16', 'ANREISE', { land24uhr: 'ANDERES', landFreitext: 'Atlantis' }), T('2026-03-17', 'ABREISE')],
      'Belgien',
    );
    expect(laender[1]).toEqual({ landKey: 'ANDERES', landFreitext: 'Atlantis' });
  });

  it('Freitext wird bei normalem Land nicht übernommen', () => {
    expect(bestimmeTageslaender([T('2026-03-16', 'ANREISE', { land24uhr: 'Belgien', landFreitext: 'egal' })], 'Belgien')[0])
      .toEqual({ landKey: 'Belgien', landFreitext: null });
  });

  it('alter Client ohne Tagesfelder: alle Tage = Hauptland bzw. Inland', () => {
    const ausland = rechne('2026-03-16T08:00', '2026-03-18T18:00', { hauptland: 'Belgien' });
    expect(ausland.laender).toEqual(['Belgien', 'Belgien', 'Belgien']);
    expect(ausland.summe).toBe(139);
    expect(rechne('2026-03-16T08:00', '2026-03-18T18:00').laender).toEqual(['INLAND', 'INLAND', 'INLAND']);
  });
});

// ── 3. Satzauswahl ────────────────────────────────────────────────────────────

const MELDUNG_2027 =
  /^Die Auslandspauschalen für 2027 sind noch nicht hinterlegt\. Bitte reichen Sie die Abrechnung später ein oder wenden Sie sich an die Buchhaltung\.$/;

describe('waehleTagesSatz / satzLandKey', () => {
  it('INLAND → gesetzlicher Satz 28/14 mit Quelle § 9 Abs. 4a EStG, unabhängig vom Jahr und ohne Stände', () => {
    for (const datum of ['2026-03-16', '2027-01-01', '2030-12-31']) {
      expect(waehleTagesSatz('INLAND', datum, [])).toEqual({ ...INLAND_SATZ, quelle: '§ 9 Abs. 4a EStG' });
    }
    expect(satzLandKey('INLAND')).toBeNull();
  });

  it('ANDERES und SEETAG → Satz Luxemburg (63/42)', () => {
    expect(waehleTagesSatz('ANDERES', '2026-03-16', STAENDE)).toEqual({ satz24h: 63, satz8h: 42, quelle: BMF_2026 });
    expect(waehleTagesSatz('SEETAG', '2026-03-16', STAENDE)).toEqual({ satz24h: 63, satz8h: 42, quelle: BMF_2026 });
    expect(satzLandKey('ANDERES')).toBe('Luxemburg');
    expect(satzLandKey('SEETAG')).toBe('Luxemburg');
  });

  it('sonst der Ländersatz des Reisejahres samt Quelle (auch Key in Großbuchstaben wie USA)', () => {
    expect(waehleTagesSatz('Belgien', '2026-03-16', STAENDE)).toEqual({ satz24h: 59, satz8h: 40, quelle: BMF_2026 });
    expect(waehleTagesSatz('USA', '2026-12-31', STAENDE)).toEqual({ satz24h: 59, satz8h: 40, quelle: BMF_2026 });
    expect(satzLandKey('Niederlande')).toBe('Niederlande');
  });

  it('unbekanntes Land → Fehler „Unbekanntes Reiseland: X“ (auch Objekt-Schlüssel wie constructor)', () => {
    erwarteFehler(() => waehleTagesSatz('Atlantis', '2026-03-16', STAENDE), 'UNBEKANNTES_LAND', /^Unbekanntes Reiseland: Atlantis$/);
    erwarteFehler(() => waehleTagesSatz('constructor', '2026-03-16', STAENDE), 'UNBEKANNTES_LAND');
  });

  it('fehlt Luxemburg in den Ständen, scheitern ANDERES/SEETAG mit dem Fallback-Key', () => {
    erwarteFehler(() => waehleTagesSatz('SEETAG', '2026-03-16', []), 'UNBEKANNTES_LAND', /Luxemburg/);
  });

  it('kein Stand im Reisejahr → SATZSTAND_FEHLT (der Vorjahresstand gilt nicht weiter)', () => {
    erwarteFehler(() => waehleTagesSatz('Belgien', '2027-01-01', STAENDE), 'SATZSTAND_FEHLT', MELDUNG_2027);
    erwarteFehler(() => waehleTagesSatz('ANDERES', '2027-06-30', STAENDE), 'SATZSTAND_FEHLT', MELDUNG_2027);
  });

  it('Reisejahr vor dem ersten Stand (verspätete Abrechnung) → Buchhaltung statt „später einreichen“', () => {
    for (const key of ['Belgien', 'ANDERES', 'SEETAG', 'Luxemburg']) {
      erwarteFehler(
        () => waehleTagesSatz(key, '2025-12-31', STAENDE_2027),
        'SATZSTAND_FEHLT',
        /^Für Reisetage im Jahr 2025 sind keine Auslandspauschalen hinterlegt\. Bitte wenden Sie sich an die Buchhaltung\.$/,
      );
    }
    // Ohne Luxemburg-Stände lässt sich das erste Jahr nicht bestimmen → bisherige Meldung
    erwarteFehler(
      () => waehleTagesSatz('Belgien', '2025-12-31', STAENDE.filter(s => s.landKey !== 'Luxemburg')),
      'SATZSTAND_FEHLT',
      /^Die Auslandspauschalen für 2025 sind noch nicht hinterlegt\./,
    );
  });

  it('Jahresstand da (Luxemburg), nur das Land fehlt → LAND_OHNE_SATZSTAND mit Hinweis auf „Staat nicht in der Liste“', () => {
    // Niederlande und USA haben keinen Stand 2027 (z. B. im BMF-Schreiben gestrichen)
    erwarteFehler(
      () => waehleTagesSatz('Niederlande', '2027-03-01', STAENDE_2027),
      'LAND_OHNE_SATZSTAND',
      /^Für „Niederlande“ ist für 2027 keine Auslandspauschale hinterlegt\. Bitte wählen Sie „Staat nicht in der Liste“ \(Satz Luxemburg\) oder wenden Sie sich an die Buchhaltung\.$/,
    );
    // Land erst ab 2027 aufgenommen: Reisetag 2026 (Jahresstand 2026 vorhanden)
    const mitNeuemLand = [...STAENDE_2027, stand('Frankreich', '2027-01-01', 54, 36, TEST_2027)];
    erwarteFehler(() => waehleTagesSatz('Frankreich', '2026-05-01', mitNeuemLand), 'LAND_OHNE_SATZSTAND', /^Für „Frankreich“ ist für 2026 keine/);
    // Land mitten im Jahr angelegt: Tage davor ohne Stand
    const abJuli = [...STAENDE, stand('Frankreich', '2026-07-01', 53, 36)];
    erwarteFehler(() => waehleTagesSatz('Frankreich', '2026-06-30', abJuli), 'LAND_OHNE_SATZSTAND');
    expect(waehleTagesSatz('Frankreich', '2026-07-01', abJuli).satz24h).toBe(53);
  });

  it('Stadt ohne Stand im Jahr → Hinweis auf den Staat (übrige Orte)', () => {
    const staende = [
      ...STAENDE_2027,
      stand('Spanien', '2026-01-01', 34, 23), stand('Spanien', '2027-01-01', 35, 24, TEST_2027),
      stand('Spanien — Barcelona', '2026-01-01', 34, 23),
    ];
    erwarteFehler(
      () => waehleTagesSatz('Spanien — Barcelona', '2027-01-02', staende),
      'LAND_OHNE_SATZSTAND',
      /^Für „Spanien — Barcelona“ ist für 2027 keine eigene Auslandspauschale hinterlegt\. Bitte wählen Sie „Spanien“ \(übrige Orte\) oder wenden Sie sich an die Buchhaltung\.$/,
    );
    expect(waehleTagesSatz('Spanien', '2027-01-02', staende)).toEqual({ satz24h: 35, satz8h: 24, quelle: TEST_2027 });
  });

  it('ANDERES/SEETAG → Luxemburg-Stand des Reisejahres', () => {
    expect(waehleTagesSatz('ANDERES', '2026-12-31', STAENDE_2027)).toEqual({ satz24h: 63, satz8h: 42, quelle: BMF_2026 });
    expect(waehleTagesSatz('SEETAG', '2027-01-01', STAENDE_2027)).toEqual({ satz24h: 65, satz8h: 44, quelle: TEST_2027 });
    expect(waehleTagesSatz('ANDERES', '2027-03-01', STAENDE_2027)).toEqual({ satz24h: 65, satz8h: 44, quelle: TEST_2027 });
  });
});

describe('waehleSatzstand (Satzstand nach Reisedatum)', () => {
  const korrektur = [stand('Belgien', '2026-01-01', 59, 40), stand('Belgien', '2026-07-01', 60, 40, 'Korrektur 2026')];

  it('größtes gueltigVon ≤ Datum im selben Kalenderjahr, Reihenfolge der Stände egal', () => {
    expect(waehleSatzstand(STAENDE_2027.filter(s => s.landKey === 'Belgien'), '2026-12-31')?.quelle).toBe(BMF_2026);
    expect(waehleSatzstand([...STAENDE_2027].reverse().filter(s => s.landKey === 'Belgien'), '2027-01-01')?.quelle).toBe(TEST_2027);
    expect(waehleSatzstand([...korrektur].reverse(), '2026-06-30')?.gueltigVon).toBe('2026-01-01');
    expect(waehleSatzstand(korrektur, '2026-07-01')?.gueltigVon).toBe('2026-07-01');
    expect(waehleSatzstand(korrektur, '2026-12-31')?.gueltigVon).toBe('2026-07-01');
  });

  it('kein Stand im Reisejahr → null (auch nicht der jüngste Vorjahresstand)', () => {
    expect(waehleSatzstand(korrektur, '2027-01-01')).toBeNull();
    expect(waehleSatzstand(korrektur, '2025-12-31')).toBeNull();
    expect(waehleSatzstand([], '2026-03-16')).toBeNull();
    // Stand erst ab Juli: Tage davor im selben Jahr ohne Stand
    expect(waehleSatzstand([stand('Belgien', '2027-07-01', 61, 41)], '2027-06-30')).toBeNull();
  });
});

describe('Sätze nach Reisedatum (komplette Kette)', () => {
  it('2026er Reise: Belgien 3 Tage = 139,00 mit Satz 2026, auch wenn ein Stand 2027 existiert', () => {
    const r = rechne('2026-03-16T08:00', '2026-03-18T18:00', { hauptland: 'Belgien', staende: STAENDE_2027 });
    expect(r.betraege).toEqual([40, 59, 40]);
    expect(r.summe).toBe(139);
  });

  it('Jahreswechsel 2026-12-30 → 2027-01-02 mit zwei Ständen: Dezember Satz 2026, Januar Satz 2027', () => {
    const r = rechne('2026-12-30T08:00', '2027-01-02T18:00', { hauptland: 'Belgien', staende: STAENDE_2027 });
    expect(r.tage.map(kurz)).toEqual([
      '2026-12-30 ANREISE', '2026-12-31 GANZTAG', '2027-01-01 GANZTAG', '2027-01-02 ABREISE',
    ]);
    expect(r.betraege).toEqual([40, 59, 61, 41]);
    expect(r.summe).toBe(201);
  });

  it('Jahreswechsel ohne Stand 2027 → Fehler (Route: 400)', () => {
    erwarteFehler(
      () => rechne('2026-12-30T08:00', '2027-01-02T18:00', { hauptland: 'Belgien' }),
      'SATZSTAND_FEHLT',
      MELDUNG_2027,
    );
  });

  it('Inlandsreise über den Jahreswechsel braucht keinen Stand (28/14)', () => {
    expect(rechne('2026-12-30T08:00', '2027-01-02T18:00', { staende: [] }).summe).toBe(84);
  });

  it('gueltig_von mitten im Jahr (Korrektur ab 2026-07-01): Tage davor alter, ab dem Datum neuer Stand', () => {
    const staende = [...STAENDE, stand('Belgien', '2026-07-01', 61, 41, 'Korrektur 2026')];
    const r = rechne('2026-06-29T08:00', '2026-07-02T18:00', { hauptland: 'Belgien', staende });
    expect(r.betraege).toEqual([40, 59, 61, 41]);
  });

  it('Mehrländerreise über den Jahreswechsel: Seetag 01.01.2027 → Luxemburg 2027', () => {
    const r = rechne('2026-12-30T08:00', '2027-01-02T18:00', {
      hauptland: 'Belgien',
      staende: STAENDE_2027,
      tage: { '2027-01-01': { land24uhr: 'SEETAG' } },
    });
    expect(r.laender).toEqual(['Belgien', 'Belgien', 'SEETAG', 'Belgien']);
    expect(r.betraege).toEqual([40, 59, 65, 41]);
  });
});
