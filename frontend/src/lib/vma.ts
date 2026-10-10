import type { Reisetag } from './types';

// ── Pauschalen 2026 (Inland) ───────────────────────────

const PAUSCHALEN = {
  VMA_8H: 14.0,          // > 8h eintägig
  VMA_24H: 28.0,         // Ganztag (24h)
  KUERZUNG_FRUEHSTUECK: 0.20,  // 20% vom 24-h-Satz des Landes (Inland 28 EUR)
  KUERZUNG_MITTAG: 0.40,       // 40%
  KUERZUNG_ABEND: 0.40,        // 40%
  KM_PKW: 0.30,
  KM_MOTORRAD: 0.20,
};

/** Pauschalen-Paar eines Landes (Feldnamen wie AuslandsPauschale aus hooks.ts):
 *  24 h = Ganztag, 8 h = An-/Abreisetag bzw. eintägig > 8 h. */
export interface VmaSatz {
  tagessatz24h: number;
  tagessatz8h: number;
}

/** Inland (§ 9 Abs. 4a S. 3 EStG). */
export const INLAND_SATZ: VmaSatz = { tagessatz24h: PAUSCHALEN.VMA_24H, tagessatz8h: PAUSCHALEN.VMA_8H };

/** Quelle des Inlandssatzes (wie backend/src/lib/vma.ts). */
export const INLAND_QUELLE = '§ 9 Abs. 4a EStG';

// Reisetage (Tagesbildung), maßgebendes Land je Tag und Satzauswahl: siehe reisetage.ts.

// ── VMA mit Kürzungen berechnen ────────────────────────
// Zwilling von backend/src/lib/vma.ts (vmaTag) — MUSS identisch rechnen
// (Parität: tests/vma-paritaet.test.ts). Die BMF-Ländertabelle enthält bereits
// die Endbeträge (24 h / An-/Abreise 8 h) — kein Auf- oder Abschlag.

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function berechneVmaTagMitSatz(tag: Reisetag, satz: VmaSatz): Reisetag {
  let brutto: number;
  if (tag.typ === 'GANZTAG') brutto = satz.tagessatz24h;
  else if (tag.typ === 'ANREISE' || tag.typ === 'ABREISE') brutto = satz.tagessatz8h;
  else brutto = tag.eintaegigUeber8h ? satz.tagessatz8h : 0; // EINTAEGIG

  if (brutto === 0) {
    return { ...tag, vmaBrutto: 0, vmaKuerzung: 0, vmaNetto: 0 };
  }

  // Kürzungen — vom 24-h-Satz des maßgebenden Landes (Inland 28 EUR), auch am An-/Abreisetag
  let kuerzung = 0;
  if (tag.fruehstueckGestellt) kuerzung += satz.tagessatz24h * PAUSCHALEN.KUERZUNG_FRUEHSTUECK;
  if (tag.mittagGestellt) kuerzung += satz.tagessatz24h * PAUSCHALEN.KUERZUNG_MITTAG;
  if (tag.abendGestellt) kuerzung += satz.tagessatz24h * PAUSCHALEN.KUERZUNG_ABEND;

  // Netto darf nie negativ werden; die Kürzung darf die Pauschale nicht übersteigen
  // (§ 9 Abs. 4a S. 8 letzter Hs. EStG)
  const vmaBrutto = round2(brutto);
  const vmaKuerzung = round2(Math.min(kuerzung, brutto));
  return { ...tag, vmaBrutto, vmaKuerzung, vmaNetto: Math.max(0, round2(vmaBrutto - vmaKuerzung)) };
}

/** Inland-VMA je Tag (28/14 EUR). */
export function berechneVmaTag(tag: Reisetag): Reisetag {
  return berechneVmaTagMitSatz(tag, INLAND_SATZ);
}

// ── Kilometer-Betrag berechnen ─────────────────────────

export function berechneKmBetrag(km: number, verkehrsmittel: string): number {
  if (!km || km <= 0) return 0;

  switch (verkehrsmittel) {
    case 'PKW':
      return Math.round(km * PAUSCHALEN.KM_PKW * 100) / 100;
    case 'MOTORRAD':
      return Math.round(km * PAUSCHALEN.KM_MOTORRAD * 100) / 100;
    default:
      return 0;
  }
}

// ── Gesamt-VMA berechnen ───────────────────────────────

export function berechneVmaGesamt(tage: Reisetag[]): number {
  return tage.reduce((sum, tag) => sum + tag.vmaNetto, 0);
}

// ── Formatierung ───────────────────────────────────────

export function formatReisetagTyp(typ: Reisetag['typ']): string {
  switch (typ) {
    case 'ANREISE': return 'Anreisetag';
    case 'ABREISE': return 'Abreisetag';
    case 'GANZTAG': return 'Ganztag';
    case 'EINTAEGIG': return 'Eintägig';
  }
}

export function formatDatumKurz(datum: string): string {
  // 'YYYY-MM-DD' wird als UTC-Mitternacht gelesen — daher UTC-Getter, sonst zeigt ein Browser
  // westlich von UTC (z. B. auf Dienstreise in den USA) den Vortag.
  const d = new Date(datum);
  const tage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${tage[d.getUTCDay()]} ${d.getUTCDate().toString().padStart(2, '0')}.${(d.getUTCMonth() + 1).toString().padStart(2, '0')}.`;
}
