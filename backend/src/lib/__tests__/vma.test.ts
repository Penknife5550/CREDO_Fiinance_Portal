import { describe, it, expect } from 'vitest';
import { vmaTagInland, vmaTagAusland, type VmaTagInput } from '../vma.js';

const tag = (over: Partial<VmaTagInput>): VmaTagInput => ({
  typ: 'GANZTAG', fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false, ...over,
});

describe('vmaTagInland', () => {
  it('Ganztag ohne Mahlzeiten → 28', () => {
    const r = vmaTagInland(tag({ typ: 'GANZTAG' }));
    expect(r.vmaBrutto).toBe(28); expect(r.vmaKuerzung).toBe(0); expect(r.vmaNetto).toBe(28);
  });
  it('Ganztag mit F+M+A → Kürzung 28, Netto 0', () => {
    const r = vmaTagInland(tag({ typ: 'GANZTAG', fruehstueckGestellt: true, mittagGestellt: true, abendGestellt: true }));
    expect(r.vmaKuerzung).toBeCloseTo(28, 2); expect(r.vmaNetto).toBeCloseTo(0, 2);
  });
  it('Anreisetag ohne Mahlzeiten → 14', () => {
    expect(vmaTagInland(tag({ typ: 'ANREISE' })).vmaNetto).toBe(14);
  });
  it('Abreisetag mit Frühstück → 14 − 5,60 = 8,40', () => {
    const r = vmaTagInland(tag({ typ: 'ABREISE', fruehstueckGestellt: true }));
    expect(r.vmaBrutto).toBe(14); expect(r.vmaKuerzung).toBeCloseTo(5.6, 2); expect(r.vmaNetto).toBeCloseTo(8.4, 2);
  });
  it('Anreisetag F+M+A: Kürzung vom Volltagessatz (28) > Brutto (14) → Netto 0', () => {
    const r = vmaTagInland(tag({ typ: 'ANREISE', fruehstueckGestellt: true, mittagGestellt: true, abendGestellt: true }));
    expect(r.vmaKuerzung).toBeCloseTo(28, 2); expect(r.vmaNetto).toBe(0);
  });
  it('Eintägig ≥ 8h → 14, < 8h → 0', () => {
    expect(vmaTagInland(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: true })).vmaNetto).toBe(14);
    expect(vmaTagInland(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: false })).vmaNetto).toBe(0);
  });
});

describe('vmaTagAusland (Tagessatz24h = 59, z.B. Belgien)', () => {
  it('Ganztag ohne Mahlzeiten → 59 × 1,2 = 70,80', () => {
    const r = vmaTagAusland(tag({ typ: 'GANZTAG' }), 59);
    expect(r.vmaBrutto).toBeCloseTo(70.8, 2); expect(r.vmaNetto).toBeCloseTo(70.8, 2);
  });
  it('Ganztag mit Frühstück → Kürzung 11,80, Netto 59', () => {
    const r = vmaTagAusland(tag({ typ: 'GANZTAG', fruehstueckGestellt: true }), 59);
    expect(r.vmaKuerzung).toBeCloseTo(11.8, 2); expect(r.vmaNetto).toBeCloseTo(59, 2);
  });
  it('An-/Abreisetag → 59 × 0,8 = 47,20', () => {
    expect(vmaTagAusland(tag({ typ: 'ANREISE' }), 59).vmaBrutto).toBeCloseTo(47.2, 2);
  });
  it('Eintägig ≥ 8h → 47,20, < 8h → 0', () => {
    expect(vmaTagAusland(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: true }), 59).vmaNetto).toBeCloseTo(47.2, 2);
    expect(vmaTagAusland(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: false }), 59).vmaNetto).toBe(0);
  });
});

describe('Manipulationsresistenz', () => {
  it('berechnet ausschließlich aus Typ+Flags — Client-Beträge existieren im Input nicht', () => {
    // Der Input hat keine vmaBrutto/vmaNetto-Felder → ein manipulierter 99999-Wert
    // kann gar nicht einfließen; das Ergebnis ist immer die Pauschale.
    const r = vmaTagInland(tag({ typ: 'GANZTAG' }));
    expect(r.vmaNetto).toBe(28);
  });
});
