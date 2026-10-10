import { describe, it, expect } from 'vitest';
import { vmaTag, vmaTagInland, INLAND_SATZ, type VmaTagInput, type TagesSatz } from '../vma.js';
import { dauertLaengerAls8h } from '../reisetage.js';

const tag = (over: Partial<VmaTagInput>): VmaTagInput => ({
  typ: 'GANZTAG', fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false, ...over,
});

const VOLLPENSION = { fruehstueckGestellt: true, mittagGestellt: true, abendGestellt: true };
const BELGIEN: TagesSatz = { satz24h: 59, satz8h: 40 };

describe('vmaTagInland', () => {
  it('Ganztag ohne Mahlzeiten → 28', () => {
    const r = vmaTagInland(tag({ typ: 'GANZTAG' }));
    expect(r.vmaBrutto).toBe(28); expect(r.vmaKuerzung).toBe(0); expect(r.vmaNetto).toBe(28);
  });
  it('Ganztag mit F+M+A → Kürzung 28, Netto 0', () => {
    const r = vmaTagInland(tag({ typ: 'GANZTAG', ...VOLLPENSION }));
    expect(r.vmaKuerzung).toBeCloseTo(28, 2); expect(r.vmaNetto).toBeCloseTo(0, 2);
  });
  it('Anreisetag ohne Mahlzeiten → 14', () => {
    expect(vmaTagInland(tag({ typ: 'ANREISE' })).vmaNetto).toBe(14);
  });
  it('Abreisetag mit Frühstück → 14 − 5,60 = 8,40', () => {
    const r = vmaTagInland(tag({ typ: 'ABREISE', fruehstueckGestellt: true }));
    expect(r.vmaBrutto).toBe(14); expect(r.vmaKuerzung).toBeCloseTo(5.6, 2); expect(r.vmaNetto).toBeCloseTo(8.4, 2);
  });
  it('Inlandstag mit Frühstück → 28 − 5,60 = 22,40', () => {
    expect(vmaTagInland(tag({ typ: 'GANZTAG', fruehstueckGestellt: true })).vmaNetto).toBe(22.4);
  });
  it('Anreisetag F+M+A: Kürzung (28) auf die Pauschale (14) gedeckelt → Netto 0', () => {
    const r = vmaTagInland(tag({ typ: 'ANREISE', ...VOLLPENSION }));
    expect(r).toEqual({ vmaBrutto: 14, vmaKuerzung: 14, vmaNetto: 0 });
  });
  it('Eintägig > 8h → 14, sonst 0', () => {
    expect(vmaTagInland(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: true })).vmaNetto).toBe(14);
    expect(vmaTagInland(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: false })).vmaNetto).toBe(0);
  });
  it('ist identisch mit vmaTag(…, INLAND_SATZ = 28/14)', () => {
    expect(INLAND_SATZ).toEqual({ satz24h: 28, satz8h: 14 });
    expect(vmaTagInland(tag({ typ: 'ANREISE', mittagGestellt: true }))).toEqual(vmaTag(tag({ typ: 'ANREISE', mittagGestellt: true }), INLAND_SATZ));
  });
});

describe('vmaTag Ausland — BMF-Endbeträge ohne Faktor (Belgien 59/40)', () => {
  it('Ganztag → 59,00 (24-h-Spalte, kein × 1,2)', () => {
    expect(vmaTag(tag({ typ: 'GANZTAG' }), BELGIEN)).toEqual({ vmaBrutto: 59, vmaKuerzung: 0, vmaNetto: 59 });
  });
  it('Anreisetag → 40,00 (8-h-Spalte, kein × 0,8)', () => {
    expect(vmaTag(tag({ typ: 'ANREISE' }), BELGIEN)).toEqual({ vmaBrutto: 40, vmaKuerzung: 0, vmaNetto: 40 });
  });
  it('Abreisetag → 40,00', () => {
    expect(vmaTag(tag({ typ: 'ABREISE' }), BELGIEN).vmaNetto).toBe(40);
  });
  it('Ganztag + Frühstück → 59 − 11,80 = 47,20', () => {
    expect(vmaTag(tag({ typ: 'GANZTAG', fruehstueckGestellt: true }), BELGIEN))
      .toEqual({ vmaBrutto: 59, vmaKuerzung: 11.8, vmaNetto: 47.2 });
  });
  it('Anreisetag + Frühstück → 40 − 11,80 = 28,20 (Kürzung vom 24-h-Satz)', () => {
    expect(vmaTag(tag({ typ: 'ANREISE', fruehstueckGestellt: true }), BELGIEN))
      .toEqual({ vmaBrutto: 40, vmaKuerzung: 11.8, vmaNetto: 28.2 });
  });
  it('Vollpension Ganztag → 0,00', () => {
    expect(vmaTag(tag({ typ: 'GANZTAG', ...VOLLPENSION }), BELGIEN).vmaNetto).toBe(0);
  });
  it('Vollpension Anreisetag → 0,00 (nie negativ, Kürzung höchstens die Pauschale)', () => {
    expect(vmaTag(tag({ typ: 'ANREISE', ...VOLLPENSION }), BELGIEN))
      .toEqual({ vmaBrutto: 40, vmaKuerzung: 40, vmaNetto: 0 });
  });
  it('Eintägig > 8h → 40,00, sonst 0', () => {
    expect(vmaTag(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: true }), BELGIEN).vmaNetto).toBe(40);
    expect(vmaTag(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: false }), BELGIEN).vmaNetto).toBe(0);
    expect(vmaTag(tag({ typ: 'EINTAEGIG' }), BELGIEN).vmaNetto).toBe(0);
  });
  it('Belgien 3 Tage (An/Ganz/Ab, keine Mahlzeiten) = 139,00', () => {
    const summe = (['ANREISE', 'GANZTAG', 'ABREISE'] as const)
      .map(typ => vmaTag(tag({ typ }), BELGIEN).vmaNetto)
      .reduce((a, b) => a + b, 0);
    expect(summe).toBe(139);
  });
  it('BMF-Beispiel: Anreisetag + Frühstück bei 75/50 → 50 − 15 = 35,00', () => {
    expect(vmaTag(tag({ typ: 'ANREISE', fruehstueckGestellt: true }), { satz24h: 75, satz8h: 50 }).vmaNetto).toBe(35);
  });
  it('Netto = Brutto − Kürzung exakt in Cent (keine Float-Reste)', () => {
    const r = vmaTag(tag({ typ: 'GANZTAG', fruehstueckGestellt: true, mittagGestellt: true }), { satz24h: 34, satz8h: 23 });
    expect(r).toEqual({ vmaBrutto: 34, vmaKuerzung: 20.4, vmaNetto: 13.6 });
  });
});

describe('dauertLaengerAls8h (eintägig: strikt mehr als 8 h)', () => {
  it('8:00 h → kein Anspruch (Inland 0, Ausland 0)', () => {
    const ueber8h = dauertLaengerAls8h('2026-03-16T08:00', '2026-03-16T16:00');
    expect(ueber8h).toBe(false);
    expect(vmaTagInland(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: ueber8h })).vmaNetto).toBe(0);
    expect(vmaTag(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: ueber8h }), BELGIEN).vmaNetto).toBe(0);
  });
  it('8:01 h → Inland 14,00, Ausland (Belgien) 40,00', () => {
    const ueber8h = dauertLaengerAls8h('2026-03-16T08:00', '2026-03-16T16:01');
    expect(ueber8h).toBe(true);
    expect(vmaTagInland(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: ueber8h })).vmaNetto).toBe(14);
    expect(vmaTag(tag({ typ: 'EINTAEGIG', eintaegigUeber8h: ueber8h }), BELGIEN).vmaNetto).toBe(40);
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
