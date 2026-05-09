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

// ── Auslandspauschalen 2026 ─────────────────────────────
// Quelle: BMF-Schreiben vom 05.12.2025 (IV C 5 - S 2353/00094/007/012),
//   gueltig ab 01.01.2026.
// Stadt-Differenzierung als separate Eintraege ("Frankreich — Paris" etc.) —
//   das BMF-Schreiben weist fuer einige Metropolen abweichende Saetze aus,
//   der User waehlt im Dropdown den passenden Eintrag.
// Uebernachtungspauschale wird vom Backend nicht ausgezahlt (tatsaechliche
//   Hotelkosten via Beleg) — das Feld bleibt nur als Referenz fuer den User.

export const AUSLANDSPAUSCHALEN: Record<string, { tagessatz24h: number; tagessatz8h: number; uebernachtung: number }> = {
  'Belgien': { tagessatz24h: 59, tagessatz8h: 40, uebernachtung: 141 },
  'Dänemark': { tagessatz24h: 75, tagessatz8h: 50, uebernachtung: 152 },
  'Frankreich': { tagessatz24h: 53, tagessatz8h: 36, uebernachtung: 148 },
  'Frankreich — Paris': { tagessatz24h: 58, tagessatz8h: 39, uebernachtung: 158 },
  'Großbritannien': { tagessatz24h: 52, tagessatz8h: 35, uebernachtung: 150 },
  'Großbritannien — London': { tagessatz24h: 66, tagessatz8h: 44, uebernachtung: 220 },
  'Italien': { tagessatz24h: 42, tagessatz8h: 28, uebernachtung: 138 },
  'Italien — Rom': { tagessatz24h: 48, tagessatz8h: 32, uebernachtung: 160 },
  'Luxemburg': { tagessatz24h: 63, tagessatz8h: 42, uebernachtung: 130 },
  'Niederlande': { tagessatz24h: 58, tagessatz8h: 39, uebernachtung: 125 },
  'Österreich': { tagessatz24h: 50, tagessatz8h: 33, uebernachtung: 108 },
  'Polen': { tagessatz24h: 30, tagessatz8h: 20, uebernachtung: 73 },
  'Schweiz': { tagessatz24h: 68, tagessatz8h: 46, uebernachtung: 180 },
  'Schweiz — Genf': { tagessatz24h: 70, tagessatz8h: 47, uebernachtung: 200 },
  'Spanien': { tagessatz24h: 42, tagessatz8h: 28, uebernachtung: 115 },
  'Spanien — Barcelona': { tagessatz24h: 34, tagessatz8h: 23, uebernachtung: 130 },
  'Spanien — Madrid': { tagessatz24h: 42, tagessatz8h: 28, uebernachtung: 140 },
  'Tschechien': { tagessatz24h: 32, tagessatz8h: 21, uebernachtung: 83 },
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
