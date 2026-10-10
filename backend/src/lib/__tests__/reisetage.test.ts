import { describe, it, expect } from 'vitest';
import {
  bildeReisetage,
  bestimmeTageslaender,
  waehleTagesSatz,
  satzLandKey,
  ReisetageFehler,
  type ReisetageFehlerCode,
  type TagesLandAngabe,
} from '../reisetage.js';
import { vmaTag, INLAND_SATZ, type TagesSatz } from '../vma.js';

// BMF-Schreiben vom 05.12.2025 (Endbeträge 24 h / 8 h)
const SAETZE: ReadonlyMap<string, TagesSatz> = new Map([
  ['Belgien', { satz24h: 59, satz8h: 40 }],
  ['Niederlande', { satz24h: 58, satz8h: 39 }],
  ['Luxemburg', { satz24h: 63, satz8h: 42 }],
  ['USA', { satz24h: 59, satz8h: 40 }],
]);

type TagesEingabe = Partial<Pick<TagesLandAngabe, 'land24uhr' | 'letzterTaetigkeitsort' | 'landFreitext'>> & {
  fruehstueck?: boolean;
  mittag?: boolean;
  abend?: boolean;
};

/** Komplette Kette wie in der Route: Tage bilden → Angaben per Datum zuordnen → Land → Satz → VMA. */
function rechne(
  abfahrt: string,
  rueckkehr: string,
  opts: { uebernachtung?: boolean | null; hauptland?: string | null; tage?: Record<string, TagesEingabe> } = {},
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
        waehleTagesSatz(laender[i].landKey, SAETZE),
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

describe('waehleTagesSatz / satzLandKey', () => {
  it('INLAND → gesetzlicher Satz 28/14', () => {
    expect(waehleTagesSatz('INLAND', SAETZE)).toEqual(INLAND_SATZ);
    expect(satzLandKey('INLAND')).toBeNull();
  });

  it('ANDERES und SEETAG → Satz Luxemburg (63/42)', () => {
    expect(waehleTagesSatz('ANDERES', SAETZE)).toEqual({ satz24h: 63, satz8h: 42 });
    expect(waehleTagesSatz('SEETAG', SAETZE)).toEqual({ satz24h: 63, satz8h: 42 });
    expect(satzLandKey('ANDERES')).toBe('Luxemburg');
    expect(satzLandKey('SEETAG')).toBe('Luxemburg');
  });

  it('sonst der Ländersatz (auch Key in Großbuchstaben wie USA)', () => {
    expect(waehleTagesSatz('Belgien', SAETZE)).toEqual({ satz24h: 59, satz8h: 40 });
    expect(waehleTagesSatz('USA', SAETZE)).toEqual({ satz24h: 59, satz8h: 40 });
    expect(satzLandKey('Niederlande')).toBe('Niederlande');
  });

  it('unbekanntes Land → Fehler „Unbekanntes Reiseland: X“ (auch Objekt-Schlüssel wie constructor)', () => {
    erwarteFehler(() => waehleTagesSatz('Atlantis', SAETZE), 'UNBEKANNTES_LAND', /^Unbekanntes Reiseland: Atlantis$/);
    erwarteFehler(() => waehleTagesSatz('constructor', SAETZE), 'UNBEKANNTES_LAND');
  });

  it('fehlt Luxemburg in den Sätzen, scheitern ANDERES/SEETAG mit dem Fallback-Key', () => {
    erwarteFehler(() => waehleTagesSatz('SEETAG', new Map()), 'UNBEKANNTES_LAND', /Luxemburg/);
  });
});
