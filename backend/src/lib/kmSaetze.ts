// Zentrale Pauschalsätze fürs Backend (§ 9 Abs. 1 Nr. 4a EStG, BMF-Schreiben).
// Frontend hat ein eigenes Pendant in frontend/src/lib/sammelfahrt.ts —
// Werte müssen synchron bleiben.

export type KmVerkehrsmittel = 'PKW' | 'MOTORRAD';

export const KM_SAETZE: Record<KmVerkehrsmittel, number> = {
  PKW: 0.30,
  MOTORRAD: 0.20,
};

/** Pauschalsatz als number (z.B. 0.30). Unbekannte Werte → 0. */
export function kmSatz(verkehrsmittel: string | null | undefined): number {
  if (verkehrsmittel === 'PKW') return KM_SAETZE.PKW;
  if (verkehrsmittel === 'MOTORRAD') return KM_SAETZE.MOTORRAD;
  return 0;
}

/** Pauschalsatz als String mit Punkt für DB-Storage (z.B. "0.30"). */
export function kmSatzAlsDecimal(verkehrsmittel: string | null | undefined): string {
  return kmSatz(verkehrsmittel).toFixed(2);
}

/** Pauschalsatz im deutschen Format mit Komma (z.B. "0,30"). */
export function kmSatzAlsString(verkehrsmittel: string | null | undefined): string {
  return kmSatz(verkehrsmittel).toFixed(2).replace('.', ',');
}

/** Rundet auf 2 Nachkommastellen (Cent-genau). */
export function rundeAufCent(betrag: number): number {
  return Math.round(betrag * 100) / 100;
}

/** Berechnet Server-Wahrheit für eine einzelne km-Strecke. */
export function berechneKmBetrag(km: number, verkehrsmittel: string | null | undefined): number {
  if (!km || km <= 0) return 0;
  return rundeAufCent(km * kmSatz(verkehrsmittel));
}
