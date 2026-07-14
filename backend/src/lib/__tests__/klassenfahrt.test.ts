import { describe, it, expect } from 'vitest';
import {
  berechneKlassenfahrt,
  rundeAufCent,
  KlassenfahrtBerechnungsfehler,
  type KfKostenzeileInput,
} from '../klassenfahrt.js';

// Golden-Master: die drei echten Excel-Abrechnungen aus Klassenfahrten/*.xlsx.
// Zielwert des 3-Klassen-Falls ist 281,80 EUR (Summe der cent-gerundeten
// Auszahlungen je Konto), NICHT die Excel-Anzeige 281,79 (Summe der ungerundeten,
// einmal gerundet) — siehe Entscheidung 2026-07-14.

describe('berechneKlassenfahrt — Golden Master gegen Excel', () => {
  it('KF 1 Klasse4 / Gruppenbuchung (3 Klassen) → 281,80 EUR', () => {
    const klassen = [
      { schueler: 27, begleiter: 2 },
      { schueler: 25, begleiter: 2 },
      { schueler: 24, begleiter: 2 },
    ];
    const kostenzeilen: KfKostenzeileInput[] = [
      { modus: 'PROPORTIONAL', betrag: 580 },        // Fahrtkosten
      { modus: 'PROPORTIONAL', betrag: 4793.2 },     // Unterkunft
      { modus: 'DIREKT', betrag: 450, anteile: [250, 0, 200] },        // Sommerrodelbahn
      { modus: 'DIREKT', betrag: 510, anteile: [270, 0, 240] },        // Bogenschiessen
      { modus: 'DIREKT', betrag: 528.94, anteile: [285.6, 0, 243.34] }, // Kartfahren
      { modus: 'DIREKT', betrag: 147, anteile: [83.7, 0, 63.3] },       // Bowling
      { modus: 'PROPORTIONAL', betrag: 171 },        // Schwimmbad
      { modus: 'PROPORTIONAL', betrag: 36 },         // Ettelsberg (Seilbahn)
      { modus: 'PROPORTIONAL', betrag: 500 },        // Klettern
    ];

    const r = berechneKlassenfahrt(klassen, kostenzeilen);

    // Kostenanteile je Klasse (Excel D20/E20/F20)
    expect(r.klassen[0].kostenanteil).toBeCloseTo(3049.37, 2);
    expect(r.klassen[1].kostenanteil).toBeCloseTo(2000.07, 2);
    expect(r.klassen[2].kostenanteil).toBeCloseTo(2666.7, 2);

    // FV-Zuschuss je Klasse = Auszahlung je Konto (Excel D22/E22/F22, cent-gerundet)
    expect(r.klassen[0].zuschuss).toBeCloseTo(105.15, 2);
    expect(r.klassen[1].zuschuss).toBeCloseTo(74.08, 2);
    expect(r.klassen[2].zuschuss).toBeCloseTo(102.57, 2);

    // Gesamt = Summe der gerundeten Auszahlungen
    expect(r.gesamtZuschuss).toBeCloseTo(281.8, 2);
  });

  it('KF 2 Klassen3 / Einzelbuchung (48 S, 4 B, 3066,30 €) → 58,97 EUR', () => {
    const r = berechneKlassenfahrt(
      [{ schueler: 48, begleiter: 4 }],
      [{ modus: 'PROPORTIONAL', betrag: 3066.3 }],
    );
    expect(r.klassen[0].zuschuss).toBeCloseTo(58.97, 2);
    expect(r.gesamtZuschuss).toBeCloseTo(58.97, 2);
  });

  it('KF 3 Klassen2 / Einzelbuchung (27 S, 2 B, 2820,30 €) → 97,25 EUR', () => {
    const r = berechneKlassenfahrt(
      [{ schueler: 27, begleiter: 2 }],
      [{ modus: 'PROPORTIONAL', betrag: 2820.3 }],
    );
    expect(r.klassen[0].zuschuss).toBeCloseTo(97.25, 2);
    expect(r.gesamtZuschuss).toBeCloseTo(97.25, 2);
  });
});

describe('berechneKlassenfahrt — Verteilung & Modi', () => {
  it('anteilige Begleitperson (1,5) senkt die Personenzahl korrekt', () => {
    // 1000 € / (20 + 1,5) = 46,5116… → 46,51
    const r = berechneKlassenfahrt(
      [{ schueler: 20, begleiter: 1.5 }],
      [{ modus: 'PROPORTIONAL', betrag: 1000 }],
    );
    expect(r.klassen[0].zuschuss).toBeCloseTo(46.51, 2);
  });

  it('DIREKT verteilt nur die eingetragenen Anteile je Klasse', () => {
    const r = berechneKlassenfahrt(
      [{ schueler: 10, begleiter: 1 }, { schueler: 10, begleiter: 1 }],
      [{ modus: 'DIREKT', betrag: 110, anteile: [110, 0] }],
    );
    expect(r.klassen[0].kostenanteil).toBeCloseTo(110, 2);
    expect(r.klassen[1].kostenanteil).toBeCloseTo(0, 2);
    expect(r.klassen[0].zuschuss).toBeCloseTo(10, 2); // 110/11
    expect(r.klassen[1].zuschuss).toBeCloseTo(0, 2);
  });
});

describe('berechneKlassenfahrt — Guards', () => {
  it('negative Kostenzeile darf keinen negativen Zuschuss erzeugen (>= 0)', () => {
    const r = berechneKlassenfahrt(
      [{ schueler: 10, begleiter: 1 }],
      [
        { modus: 'PROPORTIONAL', betrag: 100 },
        { modus: 'DIREKT', betrag: -500, anteile: [-500] }, // grosse Gutschrift
      ],
    );
    expect(r.klassen[0].zuschuss).toBe(0);
    expect(r.gesamtZuschuss).toBe(0);
  });

  it('proportionale Kosten ohne Schueler werfen einen Berechnungsfehler', () => {
    expect(() =>
      berechneKlassenfahrt(
        [{ schueler: 0, begleiter: 2 }],
        [{ modus: 'PROPORTIONAL', betrag: 100 }],
      ),
    ).toThrow(KlassenfahrtBerechnungsfehler);
  });

  it('DIREKT ohne Schueler ist erlaubt (keine Division durch Sigma-Schueler)', () => {
    const r = berechneKlassenfahrt(
      [{ schueler: 0, begleiter: 2 }],
      [{ modus: 'DIREKT', betrag: 200, anteile: [200] }],
    );
    expect(r.klassen[0].zuschuss).toBeCloseTo(100, 2); // 200 / (0+2)
  });

  it('leere Klassenliste wirft', () => {
    expect(() => berechneKlassenfahrt([], [])).toThrow(KlassenfahrtBerechnungsfehler);
  });
});

describe('rundeAufCent', () => {
  it.each([
    [105.15072595, 105.15],
    [74.07651072, 74.08],
    [102.56550607, 102.57],
    [1.005, 1.01],
    [-1.005, -1.01],
    [0, 0],
  ])('rundet %s → %s', (input, expected) => {
    expect(rundeAufCent(input)).toBeCloseTo(expected, 2);
  });
});
