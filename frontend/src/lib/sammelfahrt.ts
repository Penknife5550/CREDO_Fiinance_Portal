import type { Fahrt, SammelfahrtVerkehrsmittel } from './types';

// km-Pauschalsätze in EUR/km. Quelle: § 9 Abs. 1 Nr. 4a EStG.
export const SAMMELFAHRT_SAETZE: Record<SammelfahrtVerkehrsmittel, number> = {
  PKW: 0.30,
  MOTORRAD: 0.20,
};

export const SAMMELFAHRT_MAX_FAHRTEN = 50;

export function satzFuer(verkehrsmittel: SammelfahrtVerkehrsmittel): number {
  return SAMMELFAHRT_SAETZE[verkehrsmittel];
}

export function berechneKmBetrag(km: number, verkehrsmittel: SammelfahrtVerkehrsmittel): number {
  if (!km || km <= 0) return 0;
  return Math.round(km * satzFuer(verkehrsmittel) * 100) / 100;
}

export function berechneFahrtenSummen(
  fahrten: Fahrt[],
  verkehrsmittel: SammelfahrtVerkehrsmittel,
): { fahrten: Fahrt[]; kmSumme: number; gesamtbetrag: number } {
  const aktualisierte = fahrten.map(f => ({
    ...f,
    kmBetrag: berechneKmBetrag(f.km, verkehrsmittel),
  }));
  const kmSumme = Math.round(aktualisierte.reduce((s, f) => s + (f.km || 0), 0) * 100) / 100;
  const gesamtbetrag = Math.round(aktualisierte.reduce((s, f) => s + f.kmBetrag, 0) * 100) / 100;
  return { fahrten: aktualisierte, kmSumme, gesamtbetrag };
}
