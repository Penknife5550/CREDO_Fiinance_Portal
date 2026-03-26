import type { Reisetag } from './types';

// ── Pauschalen 2026 (Inland) ───────────────────────────

const PAUSCHALEN = {
  VMA_8H: 14.0,          // > 8h eintägig
  VMA_24H: 28.0,         // Ganztag (24h)
  VMA_ANREISETAG: 14.0,  // An-/Abreisetag
  KUERZUNG_FRUEHSTUECK: 0.20,  // 20% vom Volltagessatz
  KUERZUNG_MITTAG: 0.40,       // 40%
  KUERZUNG_ABEND: 0.40,        // 40%
  KM_PKW: 0.30,
  KM_MOTORRAD: 0.20,
};

// ── Reisetage aus Abfahrt/Rückkehr berechnen ───────────

export function berechneReisetage(abfahrt: string, rueckkehr: string): Reisetag[] {
  if (!abfahrt || !rueckkehr) return [];

  const start = new Date(abfahrt);
  const ende = new Date(rueckkehr);

  if (ende <= start) return [];

  const diffMs = ende.getTime() - start.getTime();
  const diffMinuten = diffMs / (1000 * 60);

  // Eintägige Reise (kein Datumswechsel)
  const startTag = start.toISOString().split('T')[0];
  const endeTag = ende.toISOString().split('T')[0];

  if (startTag === endeTag) {
    // Eintägig — VMA nur wenn > 8h
    if (diffMinuten < 480) {
      return [{
        datum: startTag,
        typ: 'EINTAEGIG',
        fruehstueckGestellt: false,
        mittagGestellt: false,
        abendGestellt: false,
        vmaBrutto: 0,
        vmaKuerzung: 0,
        vmaNetto: 0,
      }];
    }
    const brutto = PAUSCHALEN.VMA_8H;
    return [{
      datum: startTag,
      typ: 'EINTAEGIG',
      fruehstueckGestellt: false,
      mittagGestellt: false,
      abendGestellt: false,
      vmaBrutto: brutto,
      vmaKuerzung: 0,
      vmaNetto: brutto,
    }];
  }

  // Mehrtägige Reise
  const tage: Reisetag[] = [];
  const current = new Date(startTag);
  const letzterTag = new Date(endeTag);

  while (current <= letzterTag) {
    const datumStr = current.toISOString().split('T')[0];
    const istAnreise = datumStr === startTag;
    const istAbreise = datumStr === endeTag;

    let typ: Reisetag['typ'];
    let brutto: number;

    if (istAnreise) {
      typ = 'ANREISE';
      brutto = PAUSCHALEN.VMA_ANREISETAG;
    } else if (istAbreise) {
      typ = 'ABREISE';
      brutto = PAUSCHALEN.VMA_ANREISETAG;
    } else {
      typ = 'GANZTAG';
      brutto = PAUSCHALEN.VMA_24H;
    }

    tage.push({
      datum: datumStr,
      typ,
      fruehstueckGestellt: false,
      mittagGestellt: false,
      abendGestellt: false,
      vmaBrutto: brutto,
      vmaKuerzung: 0,
      vmaNetto: brutto,
    });

    current.setDate(current.getDate() + 1);
  }

  return tage;
}

// ── VMA mit Kürzungen berechnen ────────────────────────

export function berechneVmaTag(tag: Reisetag): Reisetag {
  // Basis-Satz bestimmen
  let brutto: number;
  if (tag.typ === 'EINTAEGIG') {
    // Eintägig: nur VMA wenn > 8h (Brutto wurde schon gesetzt)
    brutto = tag.vmaBrutto;
  } else if (tag.typ === 'GANZTAG') {
    brutto = PAUSCHALEN.VMA_24H;
  } else {
    brutto = PAUSCHALEN.VMA_ANREISETAG;
  }

  if (brutto === 0) {
    return { ...tag, vmaBrutto: 0, vmaKuerzung: 0, vmaNetto: 0 };
  }

  // Kürzungen berechnen — IMMER vom Volltagessatz (28 EUR)!
  let kuerzung = 0;
  const volltagessatz = PAUSCHALEN.VMA_24H;

  if (tag.fruehstueckGestellt) {
    kuerzung += volltagessatz * PAUSCHALEN.KUERZUNG_FRUEHSTUECK;
  }
  if (tag.mittagGestellt) {
    kuerzung += volltagessatz * PAUSCHALEN.KUERZUNG_MITTAG;
  }
  if (tag.abendGestellt) {
    kuerzung += volltagessatz * PAUSCHALEN.KUERZUNG_ABEND;
  }

  // Netto darf nie negativ werden
  const netto = Math.max(0, brutto - kuerzung);

  return {
    ...tag,
    vmaBrutto: brutto,
    vmaKuerzung: kuerzung,
    vmaNetto: netto,
  };
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
  const d = new Date(datum);
  const tage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${tage[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
}

// ── Auslandspauschalen ──────────────────────────────────

export const AUSLANDSPAUSCHALEN: Record<string, { tagessatz24h: number; tagessatz8h: number; uebernachtung: number }> = {
  'Österreich': { tagessatz24h: 40, tagessatz8h: 27, uebernachtung: 105 },
  'Schweiz': { tagessatz24h: 64, tagessatz8h: 43, uebernachtung: 180 },
  'Niederlande': { tagessatz24h: 47, tagessatz8h: 32, uebernachtung: 125 },
  'Frankreich': { tagessatz24h: 58, tagessatz8h: 39, uebernachtung: 148 },
  'Italien': { tagessatz24h: 46, tagessatz8h: 31, uebernachtung: 138 },
  'Belgien': { tagessatz24h: 52, tagessatz8h: 35, uebernachtung: 141 },
  'Luxemburg': { tagessatz24h: 57, tagessatz8h: 38, uebernachtung: 130 },
  'Polen': { tagessatz24h: 30, tagessatz8h: 20, uebernachtung: 73 },
  'Tschechien': { tagessatz24h: 32, tagessatz8h: 21, uebernachtung: 83 },
  'Dänemark': { tagessatz24h: 58, tagessatz8h: 39, uebernachtung: 152 },
  'Großbritannien': { tagessatz24h: 52, tagessatz8h: 35, uebernachtung: 150 },
  'Spanien': { tagessatz24h: 38, tagessatz8h: 25, uebernachtung: 115 },
  'USA': { tagessatz24h: 51, tagessatz8h: 34, uebernachtung: 190 },
};

// ── VMA mit Kürzungen für Ausland berechnen ─────────────

export function berechneVmaTagAusland(tag: Reisetag, tagessatz24h: number): Reisetag {
  // Basis-Satz bestimmen
  let brutto: number;
  if (tag.typ === 'EINTAEGIG') {
    // Eintägig: nur VMA wenn > 8h — vmaBrutto wurde schon gesetzt
    // Wenn vmaBrutto > 0, nutze den 8h-Satz (tagessatz24h-Basis)
    brutto = tag.vmaBrutto > 0 ? tagessatz24h * 0.8 : 0;
  } else if (tag.typ === 'GANZTAG') {
    // Ganztag: 120% des Tagessatzes
    brutto = tagessatz24h * 1.2;
  } else {
    // An-/Abreisetag: 80% des Tagessatzes
    brutto = tagessatz24h * 0.8;
  }

  if (brutto === 0) {
    return { ...tag, vmaBrutto: 0, vmaKuerzung: 0, vmaNetto: 0 };
  }

  // Kürzungen berechnen — vom AUSLANDS-Tagessatz (24h)!
  let kuerzung = 0;

  if (tag.fruehstueckGestellt) {
    kuerzung += tagessatz24h * 0.20;
  }
  if (tag.mittagGestellt) {
    kuerzung += tagessatz24h * 0.40;
  }
  if (tag.abendGestellt) {
    kuerzung += tagessatz24h * 0.40;
  }

  // Netto darf nie negativ werden
  const netto = Math.max(0, Math.round((brutto - kuerzung) * 100) / 100);

  return {
    ...tag,
    vmaBrutto: Math.round(brutto * 100) / 100,
    vmaKuerzung: Math.round(kuerzung * 100) / 100,
    vmaNetto: netto,
  };
}
