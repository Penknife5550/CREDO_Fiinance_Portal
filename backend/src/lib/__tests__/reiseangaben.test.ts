import { describe, it, expect } from 'vitest';
import { ordneTageZu, landBezeichnung, reiselandFolge, quellenVermerk, ueberschneidungsVermerke, datumDe } from '../reiseangaben.js';
import { bildeReisetage, bestimmeTageslaender, waehleTagesSatz, type Satzstand, type TagesLand } from '../reisetage.js';
import { vmaTag } from '../vma.js';

// Satzstand 2026 (BMF-Schreiben vom 05.12.2025)
const STAENDE: readonly Satzstand[] = [
  { landKey: 'Belgien', satz24h: 59, satz8h: 40 },
  { landKey: 'Niederlande', satz24h: 58, satz8h: 39 },
  { landKey: 'Luxemburg', satz24h: 63, satz8h: 42 },
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

/** Kette wie in der Route: Server-Tage → Zuordnung per Datum → Land → Satz → VMA-Summe. */
function routenKette(abfahrt: string, rueckkehr: string, uebernachtung: boolean | null, hauptland: string | null, client: ClientTag[]) {
  const paare = ordneTageZu(bildeReisetage(abfahrt, rueckkehr, uebernachtung), client);
  if (!paare) return null;
  const tage = paare.map(({ soll, client: c }) => ({ ...soll, ...c, typ: soll.typ, datum: soll.datum }));
  const laender = bestimmeTageslaender(tage, hauptland);
  const summe = tage.reduce(
    (s, t, i) =>
      s + vmaTag(
        { typ: t.typ, eintaegigUeber8h: t.eintaegigUeber8h, fruehstueckGestellt: t.fruehstueckGestellt, mittagGestellt: false, abendGestellt: false },
        waehleTagesSatz(laender[i].landKey, t.datum, STAENDE),
      ).vmaNetto,
    0,
  );
  return { laender, summe: Math.round(summe * 100) / 100 };
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

describe('Route-Kette (Zuordnung → Land → Satz)', () => {
  it('BE → NL → LU, Frühstück Tag 2–4, Tag 4 ohne Angabe erbt LU = 166,20', () => {
    const ergebnis = routenKette('2026-03-16T08:00', '2026-03-19T18:00', null, 'Belgien', [
      clientTag('2026-03-19', { fruehstueckGestellt: true }),
      clientTag('2026-03-16', { land24uhr: 'Belgien' }),
      clientTag('2026-03-17', { land24uhr: 'Niederlande', fruehstueckGestellt: true }),
      clientTag('2026-03-18', { land24uhr: 'Luxemburg', fruehstueckGestellt: true }),
    ]);
    expect(ergebnis?.laender.map(l => l.landKey)).toEqual(['Belgien', 'Niederlande', 'Luxemburg', 'Luxemburg']);
    expect(ergebnis?.summe).toBe(166.2);
  });

  it('alter Client ohne Tagesfelder: alle Tage = Hauptland', () => {
    const ergebnis = routenKette('2026-03-16T08:00', '2026-03-18T18:00', null, 'Belgien',
      ['2026-03-16', '2026-03-17', '2026-03-18'].map(d => clientTag(d)));
    expect(ergebnis?.laender.map(l => l.landKey)).toEqual(['Belgien', 'Belgien', 'Belgien']);
    expect(ergebnis?.summe).toBe(40 + 59 + 40);
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
