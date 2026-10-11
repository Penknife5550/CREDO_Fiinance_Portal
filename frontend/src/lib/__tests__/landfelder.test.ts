import { describe, it, expect } from 'vitest';
import { landfelderVorgabe, landOffenNachAenderung, nachSeetag } from '../landfelder';
import { berechneVmaVorschau, bildeReisetage, uebernehmeTagesangaben, type Satzstand } from '../reisetage';
import type { ReisetagEingabe } from '../types';

const stand = (landKey: string, tagessatz24h: number, tagessatz8h: number): Satzstand =>
  ({ landKey, gueltigVon: '2026-01-01', quelle: 'BMF-Schreiben vom 05.12.2025', tagessatz24h, tagessatz8h });

const SAETZE: readonly Satzstand[] = [
  stand('Belgien', 59, 40),
  stand('Niederlande', 58, 39),
  stand('Luxemburg', 63, 42),
];

/** Tage wie im Formular bilden, `angaben` je Datum ergänzen; Vorschau wie im Formular. */
function eingaben(abfahrt: string, rueckkehr: string, angaben: Record<string, Partial<ReisetagEingabe>> = {}): ReisetagEingabe[] {
  return uebernehmeTagesangaben(bildeReisetage(abfahrt, rueckkehr, null), []).map(t => ({ ...t, ...angaben[t.datum] }));
}

/** Vorgabe je Tag, berechnet wie in der Tageskarte (Vortag, Vorschau des Tags, Hauptland). */
function vorgaben(tage: ReisetagEingabe[], hauptland = 'Belgien') {
  const vorschau = berechneVmaVorschau(tage, hauptland, SAETZE);
  return tage.map((t, i) => landfelderVorgabe(t, tage[i - 1], vorschau.tage[i], hauptland));
}

// Belgien 05.–09.10.2026: Anreisetag, drei Ganztage, Abreisetag
const ab = '2026-10-05T08:00';
const an = '2026-10-09T18:00';

describe('landfelderVorgabe', () => {
  it('Normalfall ein Land: Anreisetag offen, Zwischen- und Abreisetag zu', () => {
    expect(vorgaben(eingaben(ab, an))).toEqual(['offen', 'zu', 'zu', 'zu', 'zu']);
  });

  it('Anreisetag offen auch bei Abfahrt am Morgen (Durchreise: Land um 24 Uhr aktiv abfragen)', () => {
    expect(vorgaben(eingaben('2026-10-05T20:00', an))[0]).toBe('offen');
    expect(vorgaben(eingaben('2026-10-05T06:00', an))[0]).toBe('offen');
  });

  it('Mehrländer: Tage mit anderem Land offen, die übrigen zu', () => {
    const tage = eingaben(ab, an, { '2026-10-06': { land24uhr: 'Niederlande' }, '2026-10-07': { land24uhr: 'Luxemburg' } });
    expect(vorgaben(tage)).toEqual(['offen', 'offen', 'offen', 'zu', 'zu']);
  });

  it('Abreisetag mit Land vom Vortag vorbelegt (≠ Hauptland) → offen', () => {
    const tage = eingaben(ab, an, { '2026-10-08': { land24uhr: 'Niederlande' } });
    expect(vorgaben(tage)).toEqual(['offen', 'zu', 'zu', 'offen', 'offen']);
  });

  it('Abreisetag nach einem Seetag → offen (Land des Hafens), obwohl vorbelegt mit dem Hauptland', () => {
    const tage = eingaben(ab, an, { '2026-10-08': { land24uhr: 'SEETAG' } });
    const vorschau = berechneVmaVorschau(tage, 'Belgien', SAETZE);
    expect(vorschau.tage[4].land.landKey).toBe('Belgien');
    expect(vorgaben(tage)).toEqual(['offen', 'zu', 'zu', 'offen', 'offen']);
  });

  it('eigene vom Hauptland abweichende Angabe → offen, auch wenn das maßgebende Land das Hauptland ist', () => {
    // Um 24 Uhr in Deutschland, letzter Tätigkeitsort Belgien → maßgebend Belgien
    const tage = eingaben(ab, an, { '2026-10-07': { land24uhr: 'INLAND', letzterTaetigkeitsort: 'Belgien' } });
    expect(berechneVmaVorschau(tage, 'Belgien', SAETZE).tage[2].land.landKey).toBe('Belgien');
    expect(vorgaben(tage)[2]).toBe('offen');
  });

  it('eigene Angabe gleich dem Hauptland → zu', () => {
    const tage = eingaben(ab, an, { '2026-10-07': { land24uhr: 'Belgien' }, '2026-10-09': { letzterTaetigkeitsort: 'Belgien' } });
    expect(vorgaben(tage)).toEqual(['offen', 'zu', 'zu', 'zu', 'zu']);
  });

  it('„Staat nicht in der Liste“ ohne Staat → erzwungen, mit Staat → offen; die übrigen Tage unverändert', () => {
    const ohne = eingaben(ab, an, { '2026-10-07': { land24uhr: 'ANDERES', landFreitext: null } });
    expect(vorgaben(ohne)).toEqual(['offen', 'zu', 'erzwungen', 'zu', 'zu']);
    const mit = eingaben(ab, an, { '2026-10-07': { land24uhr: 'ANDERES', landFreitext: 'Nauru' } });
    expect(vorgaben(mit)).toEqual(['offen', 'zu', 'offen', 'zu', 'zu']);
  });

  it('Vorschau ohne Tage (z. B. Freitext nennt einen Staat der Liste) → alle Tage erzwungen', () => {
    const tage = eingaben(ab, an, { '2026-10-07': { land24uhr: 'ANDERES', landFreitext: 'Belgien' } });
    const vorschau = berechneVmaVorschau(tage, 'Belgien', SAETZE);
    expect(vorschau.tage).toEqual([]);
    expect(vorschau.fehler).not.toBeNull();
    expect(vorgaben(tage)).toEqual(['erzwungen', 'erzwungen', 'erzwungen', 'erzwungen', 'erzwungen']);
  });

  it('eintägige Reise im Hauptland → zu', () => {
    expect(vorgaben(eingaben('2026-10-05T07:00', '2026-10-05T19:00'))).toEqual(['zu']);
  });
});

describe('nachSeetag', () => {
  it('nur am Abreisetag nach einem Seetag', () => {
    const seetagVorAbreise = eingaben(ab, an, { '2026-10-08': { land24uhr: 'SEETAG' } });
    expect(nachSeetag(seetagVorAbreise[4], seetagVorAbreise[3])).toBe(true);
    const tage = eingaben(ab, an, { '2026-10-07': { land24uhr: 'SEETAG' } });
    expect(nachSeetag(tage[3], tage[2])).toBe(false); // Ganztag nach Seetag
    expect(nachSeetag(tage[4], tage[3])).toBe(false); // Abreisetag, Vortag kein Seetag
    expect(nachSeetag(tage[0], undefined)).toBe(false);
  });
});

describe('landOffenNachAenderung', () => {
  const tage = eingaben(ab, an);
  const [d0, d1, d2, d3, d4] = tage.map(t => t.datum);

  it('geänderter Tag offen, Zuklappen der Folgetage verfällt, geöffnete Folgetage und Vortage bleiben', () => {
    const manuell = { [d0]: false, [d2]: false, [d3]: true, [d4]: false };
    expect(landOffenNachAenderung(manuell, tage, 1)).toEqual({ [d0]: false, [d1]: true, [d3]: true });
  });

  it('ändert die bisherige Wahl nicht (neues Objekt)', () => {
    const manuell = { [d4]: false };
    const neu = landOffenNachAenderung(manuell, tage, 3);
    expect(manuell).toEqual({ [d4]: false });
    expect(neu).toEqual({ [d3]: true });
  });

  it('Abreisetag nach Zuklappen und Änderung am Vortag: Vorgabe greift wieder (Hinweis sichtbar)', () => {
    // Abreisetag von Hand zu, danach am Vortag „Niederlande“ → die Vorgabe „offen“ gilt wieder
    const manuell = landOffenNachAenderung({ [d4]: false }, tage, 3);
    const geaendert = tage.map(t => (t.datum === d3 ? { ...t, land24uhr: 'Niederlande' } : t));
    const vorgabe = vorgaben(geaendert)[4];
    expect(vorgabe).toBe('offen');
    expect(manuell[d4] ?? vorgabe === 'offen').toBe(true);
  });
});
