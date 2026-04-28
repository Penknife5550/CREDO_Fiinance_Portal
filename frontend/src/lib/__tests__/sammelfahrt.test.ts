import { describe, it, expect } from 'vitest';
import { berechneKmBetrag, berechneFahrtenSummen, satzFuer, SAMMELFAHRT_MAX_FAHRTEN } from '../sammelfahrt';
import type { Fahrt } from '../types';

describe('satzFuer', () => {
  it('PKW liefert 0,30 EUR/km', () => {
    expect(satzFuer('PKW')).toBe(0.30);
  });

  it('Motorrad liefert 0,20 EUR/km', () => {
    expect(satzFuer('MOTORRAD')).toBe(0.20);
  });
});

describe('berechneKmBetrag (Sammelfahrt)', () => {
  it('PKW: 100 km × 0,30 = 30,00', () => {
    expect(berechneKmBetrag(100, 'PKW')).toBe(30);
  });

  it('Motorrad: 100 km × 0,20 = 20,00', () => {
    expect(berechneKmBetrag(100, 'MOTORRAD')).toBe(20);
  });

  it('Rundet auf 2 Nachkommastellen', () => {
    // 33,33 × 0,30 = 9,999 → 10,00
    expect(berechneKmBetrag(33.33, 'PKW')).toBe(10);
    // 12,5 × 0,30 = 3,75
    expect(berechneKmBetrag(12.5, 'PKW')).toBe(3.75);
  });

  it('liefert 0 bei 0 km', () => {
    expect(berechneKmBetrag(0, 'PKW')).toBe(0);
  });

  it('liefert 0 bei negativen km', () => {
    expect(berechneKmBetrag(-10, 'PKW')).toBe(0);
  });
});

describe('berechneFahrtenSummen', () => {
  const fahrten: Fahrt[] = [
    { datum: '2026-04-01', startOrt: 'Minden', ziel: 'Stemwede', km: 42, kmBetrag: 0 },
    { datum: '2026-04-03', startOrt: 'Minden', ziel: 'Espelkamp', km: 28, kmBetrag: 0 },
    { datum: '2026-04-05', startOrt: 'Minden', ziel: 'Minderheide', km: 55, kmBetrag: 0 },
  ];

  it('summiert km korrekt', () => {
    const result = berechneFahrtenSummen(fahrten, 'PKW');
    expect(result.kmSumme).toBe(125);
  });

  it('berechnet Gesamtbetrag PKW korrekt (125 × 0,30 = 37,50)', () => {
    const result = berechneFahrtenSummen(fahrten, 'PKW');
    expect(result.gesamtbetrag).toBe(37.5);
  });

  it('berechnet Gesamtbetrag Motorrad korrekt (125 × 0,20 = 25,00)', () => {
    const result = berechneFahrtenSummen(fahrten, 'MOTORRAD');
    expect(result.gesamtbetrag).toBe(25);
  });

  it('befüllt kmBetrag pro Fahrt', () => {
    const result = berechneFahrtenSummen(fahrten, 'PKW');
    expect(result.fahrten[0].kmBetrag).toBe(12.6);  // 42 × 0,30
    expect(result.fahrten[1].kmBetrag).toBe(8.4);   // 28 × 0,30
    expect(result.fahrten[2].kmBetrag).toBe(16.5);  // 55 × 0,30
  });

  it('rechnet bei Verkehrsmittel-Wechsel alle Beträge neu', () => {
    const pkw = berechneFahrtenSummen(fahrten, 'PKW');
    const motorrad = berechneFahrtenSummen(pkw.fahrten, 'MOTORRAD');
    expect(motorrad.fahrten[0].kmBetrag).toBe(8.4);  // 42 × 0,20
    expect(motorrad.gesamtbetrag).toBe(25);
  });

  it('liefert 0 bei leerem Fahrten-Array', () => {
    const result = berechneFahrtenSummen([], 'PKW');
    expect(result.kmSumme).toBe(0);
    expect(result.gesamtbetrag).toBe(0);
  });

  it('ignoriert Fahrten mit km=0 für Betrag', () => {
    const mitLeerer: Fahrt[] = [
      { datum: '2026-04-01', startOrt: 'A', ziel: 'B', km: 50, kmBetrag: 0 },
      { datum: '', startOrt: '', ziel: '', km: 0, kmBetrag: 0 },
    ];
    const result = berechneFahrtenSummen(mitLeerer, 'PKW');
    expect(result.kmSumme).toBe(50);
    expect(result.gesamtbetrag).toBe(15);
  });
});

describe('SAMMELFAHRT_MAX_FAHRTEN', () => {
  it('ist auf 50 gesetzt', () => {
    expect(SAMMELFAHRT_MAX_FAHRTEN).toBe(50);
  });
});
