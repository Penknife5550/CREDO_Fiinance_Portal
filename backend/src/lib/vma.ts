/**
 * Server-autoritative Verpflegungsmehraufwand-Berechnung (Audit #2).
 *
 * Zwilling von frontend/src/lib/vma.ts (berechneVmaTagMitSatz) — MUSS identisch
 * rechnen; die Parität prüft tests/vma-paritaet.test.ts. Der Server rechnet die
 * VMA je Reisetag aus Tag-Typ + Mahlzeiten-Flags + Satz NEU und traut den vom
 * Client gelieferten Beträgen nicht (sonst wäre der Auszahlungsbetrag
 * client-manipulierbar).
 *
 * Rechtsgrundlage: § 9 Abs. 4a EStG, BMF-Schreiben vom 05.12.2025 (Ausland).
 * - Ganztag = 24-h-Satz; An-/Abreisetag und eintägig (strikt mehr als 8 h) = 8-h-Satz.
 * - Die BMF-Ländertabelle enthält bereits die ENDBETRÄGE (Spalte 24 h bzw.
 *   An-/Abreise/8 h) — es gibt keinen Auf- oder Abschlag (kein × 1,2 / × 0,8).
 * - Kürzung bei gestellten Mahlzeiten: Frühstück 20 %, Mittag 40 %, Abend 40 %
 *   jeweils vom 24-h-Satz des für den Tag maßgebenden Landes (Inland: 28 €),
 *   auch am An-/Abreisetag. Der Tagesbetrag wird nie negativ.
 */

export type ReisetagTyp = 'ANREISE' | 'GANZTAG' | 'ABREISE' | 'EINTAEGIG';

export interface VmaTagInput {
  typ: ReisetagTyp;
  fruehstueckGestellt: boolean;
  mittagGestellt: boolean;
  abendGestellt: boolean;
  /** Nur für EINTAEGIG relevant: war die Abwesenheit strikt länger als 8 h? (Server aus Abfahrt/Rückkehr). */
  eintaegigUeber8h?: boolean;
}

export interface VmaTagErgebnis {
  vmaBrutto: number;
  vmaKuerzung: number;
  vmaNetto: number;
}

/** Pauschalen-Paar eines Landes: 24-h-Satz (Ganztag) und 8-h-Satz (An-/Abreise, eintägig > 8 h). */
export interface TagesSatz {
  satz24h: number;
  satz8h: number;
}

/** Inland (§ 9 Abs. 4a Satz 3 EStG). */
export const INLAND_SATZ: TagesSatz = { satz24h: 28, satz8h: 14 };

/** Quelle des Inlandssatzes (je Reisetag gespeichert, Fußnote in PDF und Mail). */
export const INLAND_QUELLE = '§ 9 Abs. 4a EStG';

const K_FRUEHSTUECK = 0.2;
const K_MITTAG = 0.4;
const K_ABEND = 0.4;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** VMA je Tag für einen beliebigen Satz (Inland oder Ausland). */
export function vmaTag(tag: VmaTagInput, satz: TagesSatz): VmaTagErgebnis {
  let brutto: number;
  if (tag.typ === 'GANZTAG') brutto = satz.satz24h;
  else if (tag.typ === 'ANREISE' || tag.typ === 'ABREISE') brutto = satz.satz8h;
  else brutto = tag.eintaegigUeber8h ? satz.satz8h : 0; // EINTAEGIG

  if (brutto === 0) return { vmaBrutto: 0, vmaKuerzung: 0, vmaNetto: 0 };

  let kuerzung = 0;
  if (tag.fruehstueckGestellt) kuerzung += satz.satz24h * K_FRUEHSTUECK;
  if (tag.mittagGestellt) kuerzung += satz.satz24h * K_MITTAG;
  if (tag.abendGestellt) kuerzung += satz.satz24h * K_ABEND;

  const vmaBrutto = round2(brutto);
  // Die Kürzung darf die Pauschale nicht übersteigen (§ 9 Abs. 4a S. 8 letzter Hs. EStG).
  const vmaKuerzung = round2(Math.min(kuerzung, brutto));
  return { vmaBrutto, vmaKuerzung, vmaNetto: Math.max(0, round2(vmaBrutto - vmaKuerzung)) };
}

/** Inland-VMA je Tag (28/14 €). */
export const vmaTagInland = (tag: VmaTagInput): VmaTagErgebnis => vmaTag(tag, INLAND_SATZ);
