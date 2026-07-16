/**
 * Server-autoritative Verpflegungsmehraufwand-Berechnung (Audit #2).
 *
 * Spiegel von frontend/src/lib/vma.ts (berechneVmaTag / berechneVmaTagAusland) —
 * MUSS synchron bleiben. Der Server rechnet die VMA je Reisetag aus Tag-Typ +
 * Mahlzeiten-Flags + Land NEU und traut den vom Client gelieferten Beträgen nicht
 * (sonst wäre der Auszahlungsbetrag client-manipulierbar).
 *
 * Inland: Ganztag 28 €, An-/Abreise + eintägig(>8h) 14 €. Kürzung immer vom
 * 28-€-Volltagessatz (Frühstück 20 %, Mittag/Abend je 40 %).
 * Ausland: Ganztag = Tagessatz(24h) × 1,2; An-/Abreise + eintägig(>8h) = × 0,8.
 * Kürzung vom Auslands-24h-Satz (20/40/40 %).
 */

export type ReisetagTyp = 'ANREISE' | 'GANZTAG' | 'ABREISE' | 'EINTAEGIG';

export interface VmaTagInput {
  typ: ReisetagTyp;
  fruehstueckGestellt: boolean;
  mittagGestellt: boolean;
  abendGestellt: boolean;
  /** Nur für EINTAEGIG relevant: war die Reise ≥ 8 h? (Server aus Abfahrt/Rückkehr). */
  eintaegigUeber8h?: boolean;
}

export interface VmaTagErgebnis {
  vmaBrutto: number;
  vmaKuerzung: number;
  vmaNetto: number;
}

const INLAND_24H = 28;
const INLAND_8H = 14;
const K_FRUEHSTUECK = 0.2;
const K_MITTAG = 0.4;
const K_ABEND = 0.4;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Inland-VMA je Tag (Spiegel von berechneVmaTag). */
export function vmaTagInland(tag: VmaTagInput): VmaTagErgebnis {
  let brutto: number;
  if (tag.typ === 'GANZTAG') brutto = INLAND_24H;
  else if (tag.typ === 'ANREISE' || tag.typ === 'ABREISE') brutto = INLAND_8H;
  else brutto = tag.eintaegigUeber8h ? INLAND_8H : 0; // EINTAEGIG

  if (brutto === 0) return { vmaBrutto: 0, vmaKuerzung: 0, vmaNetto: 0 };

  let kuerzung = 0;
  if (tag.fruehstueckGestellt) kuerzung += INLAND_24H * K_FRUEHSTUECK;
  if (tag.mittagGestellt) kuerzung += INLAND_24H * K_MITTAG;
  if (tag.abendGestellt) kuerzung += INLAND_24H * K_ABEND;

  return { vmaBrutto: brutto, vmaKuerzung: kuerzung, vmaNetto: Math.max(0, brutto - kuerzung) };
}

/** Ausland-VMA je Tag (Spiegel von berechneVmaTagAusland). tagessatz24h = DB-Wert. */
export function vmaTagAusland(tag: VmaTagInput, tagessatz24h: number): VmaTagErgebnis {
  let brutto: number;
  if (tag.typ === 'GANZTAG') brutto = tagessatz24h * 1.2;
  else if (tag.typ === 'ANREISE' || tag.typ === 'ABREISE') brutto = tagessatz24h * 0.8;
  else brutto = tag.eintaegigUeber8h ? tagessatz24h * 0.8 : 0; // EINTAEGIG

  if (brutto === 0) return { vmaBrutto: 0, vmaKuerzung: 0, vmaNetto: 0 };

  let kuerzung = 0;
  if (tag.fruehstueckGestellt) kuerzung += tagessatz24h * 0.2;
  if (tag.mittagGestellt) kuerzung += tagessatz24h * 0.4;
  if (tag.abendGestellt) kuerzung += tagessatz24h * 0.4;

  return {
    vmaBrutto: round2(brutto),
    vmaKuerzung: round2(kuerzung),
    vmaNetto: Math.max(0, round2(brutto - kuerzung)),
  };
}

/** Berechnet die VMA je Tag serverseitig neu — Inland oder Ausland (tagessatz24h != null). */
export function berechneVmaServer(tag: VmaTagInput, tagessatz24h: number | null): VmaTagErgebnis {
  return tagessatz24h != null ? vmaTagAusland(tag, tagessatz24h) : vmaTagInland(tag);
}
