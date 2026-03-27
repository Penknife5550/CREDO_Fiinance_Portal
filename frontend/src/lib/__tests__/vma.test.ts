import { describe, it, expect } from 'vitest';
import { berechneReisetage, berechneVmaTag, berechneKmBetrag, berechneVmaGesamt, berechneVmaTagAusland } from '../vma';
import type { Reisetag } from '../types';

describe('berechneReisetage', () => {
  it('gibt leeres Array bei leerem Input', () => {
    expect(berechneReisetage('', '')).toEqual([]);
  });

  it('gibt leeres Array wenn Rückkehr vor Abfahrt', () => {
    expect(berechneReisetage('2026-03-15T10:00', '2026-03-15T08:00')).toEqual([]);
  });

  it('erkennt eintägige Reise unter 8h ohne VMA', () => {
    const tage = berechneReisetage('2026-03-15T09:00', '2026-03-15T14:00');
    expect(tage).toHaveLength(1);
    expect(tage[0].typ).toBe('EINTAEGIG');
    expect(tage[0].vmaBrutto).toBe(0);
  });

  it('erkennt eintägige Reise über 8h mit VMA', () => {
    const tage = berechneReisetage('2026-03-15T06:00', '2026-03-15T16:00');
    expect(tage).toHaveLength(1);
    expect(tage[0].typ).toBe('EINTAEGIG');
    expect(tage[0].vmaBrutto).toBe(14);
  });

  it('berechnet mehrtägige Reise korrekt', () => {
    const tage = berechneReisetage('2026-03-15T08:00', '2026-03-17T18:00');
    expect(tage).toHaveLength(3);
    expect(tage[0].typ).toBe('ANREISE');
    expect(tage[0].vmaBrutto).toBe(14);
    expect(tage[1].typ).toBe('GANZTAG');
    expect(tage[1].vmaBrutto).toBe(28);
    expect(tage[2].typ).toBe('ABREISE');
    expect(tage[2].vmaBrutto).toBe(14);
  });

  it('setzt alle Mahlzeiten auf false', () => {
    const tage = berechneReisetage('2026-03-15T08:00', '2026-03-16T18:00');
    tage.forEach(tag => {
      expect(tag.fruehstueckGestellt).toBe(false);
      expect(tag.mittagGestellt).toBe(false);
      expect(tag.abendGestellt).toBe(false);
    });
  });
});

describe('berechneVmaTag', () => {
  const ganzTag: Reisetag = {
    datum: '2026-03-16',
    typ: 'GANZTAG',
    fruehstueckGestellt: false,
    mittagGestellt: false,
    abendGestellt: false,
    vmaBrutto: 28,
    vmaKuerzung: 0,
    vmaNetto: 28,
  };

  it('berechnet Ganztag ohne Kürzung korrekt', () => {
    const result = berechneVmaTag(ganzTag);
    expect(result.vmaBrutto).toBe(28);
    expect(result.vmaKuerzung).toBe(0);
    expect(result.vmaNetto).toBe(28);
  });

  it('kürzt Frühstück um 20% vom Volltagessatz', () => {
    const result = berechneVmaTag({ ...ganzTag, fruehstueckGestellt: true });
    expect(result.vmaKuerzung).toBeCloseTo(5.6); // 28 * 0.20
    expect(result.vmaNetto).toBeCloseTo(22.4);
  });

  it('kürzt Mittag um 40% vom Volltagessatz', () => {
    const result = berechneVmaTag({ ...ganzTag, mittagGestellt: true });
    expect(result.vmaKuerzung).toBeCloseTo(11.2); // 28 * 0.40
    expect(result.vmaNetto).toBeCloseTo(16.8);
  });

  it('kürzt alle Mahlzeiten korrekt', () => {
    const result = berechneVmaTag({
      ...ganzTag,
      fruehstueckGestellt: true,
      mittagGestellt: true,
      abendGestellt: true,
    });
    expect(result.vmaKuerzung).toBeCloseTo(28); // 20% + 40% + 40% = 100%
    expect(result.vmaNetto).toBe(0); // Netto wird nicht negativ
  });

  it('Anreisetag wird korrekt berechnet', () => {
    const anreise: Reisetag = { ...ganzTag, typ: 'ANREISE', vmaBrutto: 14 };
    const result = berechneVmaTag(anreise);
    expect(result.vmaBrutto).toBe(14);
    expect(result.vmaNetto).toBe(14);
  });

  it('Kürzung bei Anreisetag vom Volltagessatz', () => {
    const anreise: Reisetag = { ...ganzTag, typ: 'ANREISE', vmaBrutto: 14, fruehstueckGestellt: true };
    const result = berechneVmaTag(anreise);
    // Kürzung ist 28 * 0.20 = 5.6, Brutto 14, Netto = 14 - 5.6 = 8.4
    expect(result.vmaNetto).toBeCloseTo(8.4);
  });
});

describe('berechneKmBetrag', () => {
  it('PKW: 0,30 EUR/km', () => {
    expect(berechneKmBetrag(100, 'PKW')).toBe(30);
  });

  it('Motorrad: 0,20 EUR/km', () => {
    expect(berechneKmBetrag(100, 'MOTORRAD')).toBe(20);
  });

  it('gibt 0 bei 0 km', () => {
    expect(berechneKmBetrag(0, 'PKW')).toBe(0);
  });

  it('gibt 0 bei negativen km', () => {
    expect(berechneKmBetrag(-10, 'PKW')).toBe(0);
  });

  it('gibt 0 bei sonstigen Verkehrsmitteln', () => {
    expect(berechneKmBetrag(100, 'BAHN')).toBe(0);
  });
});

describe('berechneVmaGesamt', () => {
  it('summiert vmaNetto aller Tage', () => {
    const tage: Reisetag[] = [
      { datum: '2026-03-15', typ: 'ANREISE', fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false, vmaBrutto: 14, vmaKuerzung: 0, vmaNetto: 14 },
      { datum: '2026-03-16', typ: 'GANZTAG', fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false, vmaBrutto: 28, vmaKuerzung: 0, vmaNetto: 28 },
      { datum: '2026-03-17', typ: 'ABREISE', fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false, vmaBrutto: 14, vmaKuerzung: 0, vmaNetto: 14 },
    ];
    expect(berechneVmaGesamt(tage)).toBe(56);
  });

  it('gibt 0 bei leerem Array', () => {
    expect(berechneVmaGesamt([])).toBe(0);
  });
});

describe('berechneVmaTagAusland', () => {
  const ganzTag: Reisetag = {
    datum: '2026-03-16',
    typ: 'GANZTAG',
    fruehstueckGestellt: false,
    mittagGestellt: false,
    abendGestellt: false,
    vmaBrutto: 28,
    vmaKuerzung: 0,
    vmaNetto: 28,
  };

  it('berechnet Ganztag Ausland (120% des Tagessatzes)', () => {
    const result = berechneVmaTagAusland(ganzTag, 40);
    expect(result.vmaBrutto).toBe(48); // 40 * 1.2
    expect(result.vmaNetto).toBe(48);
  });

  it('berechnet An-/Abreisetag Ausland (80%)', () => {
    const anreise = { ...ganzTag, typ: 'ANREISE' as const };
    const result = berechneVmaTagAusland(anreise, 40);
    expect(result.vmaBrutto).toBe(32); // 40 * 0.8
  });

  it('kürzt vom Auslands-Tagessatz', () => {
    const result = berechneVmaTagAusland({ ...ganzTag, fruehstueckGestellt: true }, 40);
    expect(result.vmaKuerzung).toBe(8); // 40 * 0.20
    expect(result.vmaNetto).toBe(40); // 48 - 8
  });
});
