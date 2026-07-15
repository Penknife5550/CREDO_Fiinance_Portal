import { describe, it, expect } from 'vitest';
import {
  berechneKlassenfahrt,
  rundeAufCent,
  KlassenfahrtBerechnungsfehler,
  type KfKostenzeileInput,
} from '../klassenfahrt';

// Zwilling-Test: muss mit backend/src/lib/__tests__/klassenfahrt.test.ts uebereinstimmen.
// Zielwert des 3-Klassen-Falls = 281,80 EUR (Summe der cent-gerundeten Auszahlungen).

describe('berechneKlassenfahrt — Golden Master (Frontend-Zwilling)', () => {
  it('3-Klassen-Gruppenbuchung → 281,80 EUR', () => {
    const klassen = [
      { schueler: 27, begleiter: 2 },
      { schueler: 25, begleiter: 2 },
      { schueler: 24, begleiter: 2 },
    ];
    const kostenzeilen: KfKostenzeileInput[] = [
      { modus: 'PROPORTIONAL', betrag: 580 },
      { modus: 'PROPORTIONAL', betrag: 4793.2 },
      { modus: 'DIREKT', betrag: 450, anteile: [250, 0, 200] },
      { modus: 'DIREKT', betrag: 510, anteile: [270, 0, 240] },
      { modus: 'DIREKT', betrag: 528.94, anteile: [285.6, 0, 243.34] },
      { modus: 'DIREKT', betrag: 147, anteile: [83.7, 0, 63.3] },
      { modus: 'PROPORTIONAL', betrag: 171 },
      { modus: 'PROPORTIONAL', betrag: 36 },
      { modus: 'PROPORTIONAL', betrag: 500 },
    ];

    const r = berechneKlassenfahrt(klassen, kostenzeilen);

    expect(r.klassen[0].kostenanteil).toBeCloseTo(3049.37, 2);
    expect(r.klassen[1].kostenanteil).toBeCloseTo(2000.07, 2);
    expect(r.klassen[2].kostenanteil).toBeCloseTo(2666.7, 2);

    expect(r.klassen[0].zuschuss).toBeCloseTo(105.15, 2);
    expect(r.klassen[1].zuschuss).toBeCloseTo(74.08, 2);
    expect(r.klassen[2].zuschuss).toBeCloseTo(102.57, 2);

    expect(r.gesamtZuschuss).toBeCloseTo(281.8, 2);

    // Aufteilungs-Matrix (Wizard-/PDF-Transparenz)
    expect(r.verteilung[0][0]).toBeCloseTo(206.05, 2);
    expect(r.verteilung[0][1]).toBeCloseTo(190.79, 2);
    expect(r.verteilung[0][2]).toBeCloseTo(183.16, 2);
    expect(r.verteilung[1][0]).toBeCloseTo(1702.85, 2);
    expect(r.verteilung[2]).toEqual([250, 0, 200]);
    for (let k = 0; k < 3; k++) {
      const spaltensumme = r.verteilung.reduce((s, zeile) => s + zeile[k], 0);
      expect(spaltensumme).toBeCloseTo(r.klassen[k].kostenanteil, 2);
    }
  });

  it('Einzelbuchung (48 S, 4 B, 3066,30 €) → 58,97 EUR', () => {
    const r = berechneKlassenfahrt(
      [{ schueler: 48, begleiter: 4 }],
      [{ modus: 'PROPORTIONAL', betrag: 3066.3 }],
    );
    expect(r.gesamtZuschuss).toBeCloseTo(58.97, 2);
  });
});

describe('berechneKlassenfahrt — Guards & Modi', () => {
  it('anteilige Begleitperson (1,5) senkt die Personenzahl korrekt', () => {
    const r = berechneKlassenfahrt(
      [{ schueler: 20, begleiter: 1.5 }],
      [{ modus: 'PROPORTIONAL', betrag: 1000 }],
    );
    expect(r.klassen[0].zuschuss).toBeCloseTo(46.51, 2);
  });

  it('negative Kostenzeile darf keinen negativen Zuschuss erzeugen (>= 0)', () => {
    const r = berechneKlassenfahrt(
      [{ schueler: 10, begleiter: 1 }],
      [
        { modus: 'PROPORTIONAL', betrag: 100 },
        { modus: 'DIREKT', betrag: -500, anteile: [-500] },
      ],
    );
    expect(r.klassen[0].zuschuss).toBe(0);
    expect(r.gesamtZuschuss).toBe(0);
  });

  it('proportionale Kosten ohne Schueler werfen', () => {
    expect(() =>
      berechneKlassenfahrt([{ schueler: 0, begleiter: 2 }], [{ modus: 'PROPORTIONAL', betrag: 100 }]),
    ).toThrow(KlassenfahrtBerechnungsfehler);
  });

  it('leere Klassenliste wirft', () => {
    expect(() => berechneKlassenfahrt([], [])).toThrow(KlassenfahrtBerechnungsfehler);
  });
});

describe('rundeAufCent', () => {
  it.each([
    [1.005, 1.01],
    [-1.005, -1.01],
    [0, 0],
  ])('rundet %s → %s', (input, expected) => {
    expect(rundeAufCent(input)).toBeCloseTo(expected, 2);
  });
});
