/**
 * Paritätstest der beiden VMA-Zwillinge: Backend (autoritativ, Auszahlung) und
 * Frontend (Vorschau im Wizard) müssen für jeden Tag-Typ, jede Mahlzeitenkombination
 * und jeden Satz centgenau dasselbe liefern.
 *
 * Liegt bewusst im Repo-Root (nicht unter backend/src oder frontend/src), weil er
 * beide Workspaces importiert — sonst brechen tsc bzw. der Docker-Build.
 */
import { describe, it, expect } from 'vitest';
import { vmaTag, type ReisetagTyp, type TagesSatz } from '../backend/src/lib/vma';
import {
  bildeReisetage as beBildeReisetage,
  bestimmeTageslaender as beBestimmeTageslaender,
  satzLandKey as beSatzLandKey,
  waehleTagesSatz as beWaehleTagesSatz,
  ReisetageFehler as BeReisetageFehler,
  type TagesLandAngabe as BeTagesLandAngabe,
} from '../backend/src/lib/reisetage';
import { landBezeichnung as beLandBezeichnung, reiselandFolge as beReiselandFolge } from '../backend/src/lib/reiseangaben';
import { berechneVmaTagMitSatz, type VmaSatz } from '../frontend/src/lib/vma';
import {
  bildeReisetage as feBildeReisetage,
  bestimmeTageslaender as feBestimmeTageslaender,
  satzLandKey as feSatzLandKey,
  waehleTagesSatz as feWaehleTagesSatz,
  ReisetageFehler as FeReisetageFehler,
  berechneVmaVorschau,
  laenderfolge as feLaenderfolge,
  landBezeichnung as feLandBezeichnung,
  uebernehmeTagesangaben,
} from '../frontend/src/lib/reisetage';
import type { Reisetag, ReisetagEingabe } from '../frontend/src/lib/types';

const TYPEN: ReisetagTyp[] = ['ANREISE', 'GANZTAG', 'ABREISE', 'EINTAEGIG'];
// [24 h, 8 h]: Inland, Belgien, Dänemark, Spanien, Luxemburg
const SAETZE: Array<[number, number]> = [[28, 14], [59, 40], [75, 50], [34, 23], [63, 42]];
// Alle 8 Kombinationen aus Frühstück/Mittag/Abend
const MAHLZEITEN = [0, 1, 2, 3, 4, 5, 6, 7].map(bits => ({
  fruehstueckGestellt: (bits & 1) !== 0,
  mittagGestellt: (bits & 2) !== 0,
  abendGestellt: (bits & 4) !== 0,
}));

describe('VMA-Parität Backend (vmaTag) ↔ Frontend (berechneVmaTagMitSatz)', () => {
  for (const [s24, s8] of SAETZE) {
    const backendSatz: TagesSatz = { satz24h: s24, satz8h: s8 };
    const frontendSatz: VmaSatz = { tagessatz24h: s24, tagessatz8h: s8 };

    for (const typ of TYPEN) {
      // Bei EINTAEGIG beide Fälle (> 8 h / nicht > 8 h), sonst ist das Flag irrelevant.
      const ueber8hVarianten = typ === 'EINTAEGIG' ? [true, false] : [undefined];

      for (const eintaegigUeber8h of ueber8hVarianten) {
        it(`${typ}${eintaegigUeber8h === false ? ' (≤ 8 h)' : ''} @ ${s24}/${s8}: alle 8 Mahlzeitenkombinationen`, () => {
          for (const mahlzeiten of MAHLZEITEN) {
            const tag: Reisetag = {
              datum: '2026-03-16',
              typ,
              eintaegigUeber8h,
              ...mahlzeiten,
              vmaBrutto: 0,
              vmaKuerzung: 0,
              vmaNetto: 0,
            };
            const backend = vmaTag(tag, backendSatz);
            const frontend = berechneVmaTagMitSatz(tag, frontendSatz);
            expect(
              { vmaBrutto: frontend.vmaBrutto, vmaKuerzung: frontend.vmaKuerzung, vmaNetto: frontend.vmaNetto },
              JSON.stringify(mahlzeiten),
            ).toEqual(backend);
            expect(backend.vmaNetto).toBeGreaterThanOrEqual(0);
            expect(backend.vmaKuerzung).toBeLessThanOrEqual(backend.vmaBrutto);
          }
        });
      }
    }
  }
});

// ── Hilfen ────────────────────────────────────────────────────────────────────

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Ergebnis einer Funktion oder ihr ReisetageFehler (Code + Meldung) — beide Seiten müssen gleich liefern bzw. gleich ablehnen. */
type Ergebnis<T> = { ok: T } | { code: string; meldung: string };

function ergebnis<T>(fn: () => T): Ergebnis<T> {
  try {
    return { ok: fn() };
  } catch (err) {
    if (err instanceof BeReisetageFehler || err instanceof FeReisetageFehler) {
      expect(err.name).toBe('ReisetageFehler');
      return { code: err.code, meldung: err.message };
    }
    throw err;
  }
}

/** Deterministischer Zufall (mulberry32) — reproduzierbare Kombinationen. */
function zufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const kurz = (t: { datum: string; typ: string; eintaegigUeber8h?: boolean }) =>
  t.typ === 'EINTAEGIG' ? `${t.datum} EINTAEGIG ${t.eintaegigUeber8h ? '>8h' : '≤8h'}` : `${t.datum} ${t.typ}`;

// ── 1. Tagesbildung (bildeReisetage) ──────────────────────────────────────────

/**
 * Frontend (Vorschau) und Backend (autoritativ) müssen dieselben Tage liefern bzw. mit
 * demselben Code und derselben Meldung ablehnen — unabhängig von der Zeitzone des Rechners.
 * CI führt diese Datei unter TZ=UTC und TZ=Europe/Berlin aus.
 * Erwartung: Tage als 'Datum Typ' bzw. 'Datum EINTAEGIG >8h' / '≤8h' oder ein Fehlercode.
 */
const ZEITRAEUME: Array<[string, string, string, boolean | null, string[] | string]> = [
  ['Zeitumstellung Frühjahr (29.03.)', '2026-03-27T08:00', '2026-03-31T18:00', null,
    ['2026-03-27 ANREISE', '2026-03-28 GANZTAG', '2026-03-29 GANZTAG', '2026-03-30 GANZTAG', '2026-03-31 ABREISE']],
  ['Zeitumstellung Herbst (25.10.)', '2026-10-23T08:00', '2026-10-27T18:00', null,
    ['2026-10-23 ANREISE', '2026-10-24 GANZTAG', '2026-10-25 GANZTAG', '2026-10-26 GANZTAG', '2026-10-27 ABREISE']],
  ['Abfahrt vor 01:00 Uhr (kein Vortag)', '2026-05-04T00:30', '2026-05-05T18:00', null,
    ['2026-05-04 ANREISE', '2026-05-05 ABREISE']],
  ['eintägig mit Abfahrt 01:00 Uhr, 9 h', '2026-05-04T01:00', '2026-05-04T10:00', null,
    ['2026-05-04 EINTAEGIG >8h']],
  ['eintägig am Tag der Zeitumstellung (Wanduhrzeit 8:30 h)', '2026-03-29T01:00', '2026-03-29T09:30', null,
    ['2026-03-29 EINTAEGIG >8h']],
  ['eintägig genau 8:00 h', '2026-03-16T08:00', '2026-03-16T16:00', null, ['2026-03-16 EINTAEGIG ≤8h']],
  ['eintägig 8:01 h', '2026-03-16T08:00', '2026-03-16T16:01', null, ['2026-03-16 EINTAEGIG >8h']],
  ['Jahreswechsel', '2026-12-30T08:00', '2027-01-02T18:00', null,
    ['2026-12-30 ANREISE', '2026-12-31 GANZTAG', '2027-01-01 GANZTAG', '2027-01-02 ABREISE']],
  ['Schaltjahr', '2028-02-28T08:00', '2028-03-01T18:00', null,
    ['2028-02-28 ANREISE', '2028-02-29 GANZTAG', '2028-03-01 ABREISE']],
  // Mitternachtsregel: unter 24 h über zwei Kalendertage
  ['17:00 → 00:30 ohne Übernachtung (7:30 h)', '2026-10-12T17:00', '2026-10-13T00:30', false, ['2026-10-12 EINTAEGIG ≤8h']],
  ['16:00 → 02:00 ohne Übernachtung (10 h, erster Tag)', '2026-10-12T16:00', '2026-10-13T02:00', false, ['2026-10-12 EINTAEGIG >8h']],
  ['22:00 → 08:00 ohne Übernachtung (10 h, zweiter Tag)', '2026-10-12T22:00', '2026-10-13T08:00', false, ['2026-10-13 EINTAEGIG >8h']],
  ['18:00 → 06:00 ohne Übernachtung (Gleichstand → Abreisetag)', '2026-10-12T18:00', '2026-10-13T06:00', false, ['2026-10-13 EINTAEGIG >8h']],
  ['20:00 → 06:00 ohne Übernachtung über die Zeitumstellung (25.10.)', '2026-10-24T20:00', '2026-10-25T06:00', false, ['2026-10-25 EINTAEGIG >8h']],
  ['17:00 → 00:30 mit Übernachtung', '2026-10-12T17:00', '2026-10-13T00:30', true, ['2026-10-12 ANREISE', '2026-10-13 ABREISE']],
  ['17:00 → 00:30 ohne Angabe', '2026-10-12T17:00', '2026-10-13T00:30', null, 'UEBERNACHTUNG_FEHLT'],
  ['genau 24 h mit Übernachtung', '2026-10-12T08:00', '2026-10-13T08:00', true, ['2026-10-12 ANREISE', '2026-10-13 ABREISE']],
  ['genau 24 h ohne Angabe (alter Client = mit Übernachtung)', '2026-10-12T08:00', '2026-10-13T08:00', null, ['2026-10-12 ANREISE', '2026-10-13 ABREISE']],
  // Ab 24 h über zwei Kalendertage ohne Übernachtung: EIN Ganztag (BMF 25.11.2020 Bsp. 31)
  ['genau 24 h ohne Übernachtung (größerer Anteil am ersten Tag)', '2026-10-12T08:00', '2026-10-13T08:00', false, ['2026-10-12 GANZTAG']],
  ['26 h ohne Übernachtung', '2026-05-04T06:00', '2026-05-05T08:00', false, ['2026-05-04 GANZTAG']],
  ['26 h ohne Übernachtung, größerer Anteil am zweiten Tag', '2026-05-04T20:00', '2026-05-05T22:00', false, ['2026-05-05 GANZTAG']],
  ['drei Kalendertage: Angabe ohne Bedeutung', '2026-05-04T06:00', '2026-05-06T08:00', false,
    ['2026-05-04 ANREISE', '2026-05-05 GANZTAG', '2026-05-06 ABREISE']],
  ['gleicher Tag: Angabe ohne Bedeutung', '2026-10-12T08:00', '2026-10-12T18:00', false, ['2026-10-12 EINTAEGIG >8h']],
  // Fehler
  ['Rückkehr vor Abfahrt', '2026-03-16T10:00', '2026-03-16T08:00', true, 'RUECKKEHR_NICHT_NACH_ABFAHRT'],
  ['Rückkehr = Abfahrt', '2026-03-16T10:00', '2026-03-16T10:00', true, 'RUECKKEHR_NICHT_NACH_ABFAHRT'],
  ['61 Kalendertage', '2026-01-01T08:00', '2026-03-02T18:00', true, 'ZU_VIELE_TAGE'],
  ['30. Februar', '2026-02-30T08:00', '2026-03-02T18:00', true, 'FORMAT'],
  ['24:00 Uhr', '2026-03-16T24:00', '2026-03-17T18:00', true, 'FORMAT'],
  ['leer', '', '2026-03-17T18:00', true, 'FORMAT'],
  ['Leerzeichen statt T', '2026-03-16 08:00', '2026-03-17T18:00', true, 'FORMAT'],
];

describe(`Reisetage-Parität bildeReisetage Backend ↔ Frontend, TZ=${TZ}`, () => {
  for (const [name, abfahrt, rueckkehr, uebernachtung, erwartet] of ZEITRAEUME) {
    it(name, () => {
      const be = ergebnis(() => beBildeReisetage(abfahrt, rueckkehr, uebernachtung));
      const fe = ergebnis(() => feBildeReisetage(abfahrt, rueckkehr, uebernachtung));
      expect(fe).toEqual(be);
      if (typeof erwartet === 'string') expect('code' in be && be.code).toBe(erwartet);
      else expect('ok' in be && be.ok.map(kurz)).toEqual(erwartet);
    });
  }

  it('genau 60 Kalendertage sind erlaubt', () => {
    expect(beBildeReisetage('2026-01-01T08:00', '2026-03-01T18:00', null)).toHaveLength(60);
    expect(feBildeReisetage('2026-01-01T08:00', '2026-03-01T18:00', null)).toEqual(
      beBildeReisetage('2026-01-01T08:00', '2026-03-01T18:00', null),
    );
  });

  it('alle Kombinationen um Mitternacht und die Zeitumstellungen (mit/ohne/keine Übernachtungsangabe)', () => {
    const uhrzeiten = ['00:00', '00:30', '01:59', '02:00', '02:30', '03:00', '08:00', '12:00', '16:00', '16:01', '18:00', '23:59'];
    const tage = ['2026-03-28', '2026-03-29', '2026-03-30', '2026-10-24', '2026-10-25', '2026-10-26'];
    const zeitpunkte = tage.flatMap(d => uhrzeiten.map(u => `${d}T${u}`));
    let verglichen = 0;
    for (const abfahrt of zeitpunkte) {
      for (const rueckkehr of zeitpunkte) {
        for (const uebernachtung of [true, false, null]) {
          const be = ergebnis(() => beBildeReisetage(abfahrt, rueckkehr, uebernachtung));
          const fe = ergebnis(() => feBildeReisetage(abfahrt, rueckkehr, uebernachtung));
          expect(fe, `${abfahrt} → ${rueckkehr}, Übernachtung ${uebernachtung}`).toEqual(be);
          verglichen++;
        }
      }
    }
    expect(verglichen).toBe(72 * 72 * 3);
  });
});

// ── 2. Maßgebendes Land je Tag (bestimmeTageslaender) ─────────────────────────

// Angaben inkl. leerer Werte, Schreibvarianten reservierter Werte und unbekannter Länder
const ANGABEN: Array<string | null | undefined> = [
  undefined, null, '', 'INLAND', 'ANDERES', 'SEETAG', 'Belgien', 'Niederlande', 'Atlantis', 'inland', ' SEETAG', 'Anderes ',
];
const FREITEXTE: Array<string | null | undefined> = [undefined, null, '', '   ', 'Nauru', ' Nauru '];
const HAUPTLAENDER: Array<string | null> = [null, 'Belgien', 'Luxemburg', 'INLAND', 'seetag', ' Anderes'];
const TYP_FOLGEN: ReisetagTyp[][] = [
  ['EINTAEGIG'],
  ['ANREISE', 'ABREISE'],
  ['ANREISE', 'GANZTAG', 'ABREISE'],
  ['ANREISE', 'GANZTAG', 'GANZTAG', 'ABREISE'],
  ['ANREISE', 'GANZTAG', 'GANZTAG', 'GANZTAG', 'GANZTAG', 'ABREISE'],
];

function vergleicheLaender(tage: BeTagesLandAngabe[], hauptland: string | null) {
  const be = ergebnis(() => beBestimmeTageslaender(tage, hauptland));
  const fe = ergebnis(() => feBestimmeTageslaender(tage, hauptland));
  expect(fe, JSON.stringify({ tage, hauptland })).toEqual(be);
  return be;
}

describe('Landparität bestimmeTageslaender Backend ↔ Frontend', () => {
  it('jeder einzelne Tag: alle Typen × Ort um 24 Uhr × letzte Tätigkeit × Freitext × Hauptland', () => {
    let faelle = 0;
    for (const typ of ['ANREISE', 'GANZTAG', 'ABREISE', 'EINTAEGIG'] as ReisetagTyp[]) {
      for (const land24uhr of ANGABEN) {
        for (const letzterTaetigkeitsort of ANGABEN) {
          for (const landFreitext of FREITEXTE) {
            for (const hauptland of HAUPTLAENDER) {
              vergleicheLaender([{ datum: '2026-10-12', typ, land24uhr, letzterTaetigkeitsort, landFreitext }], hauptland);
              faelle++;
            }
          }
        }
      }
    }
    expect(faelle).toBe(4 * 12 * 12 * 6 * 6);
  });

  it('Vortag → Abreisetag: alle Kombinationen (Übernahme des Vortags inkl. Freitext)', () => {
    const vortagOrt = [null, 'INLAND', 'ANDERES', 'SEETAG', 'Niederlande'];
    const vortagTaetigkeit = [null, 'INLAND', 'Niederlande', 'ANDERES'];
    const abreise = [null, 'INLAND', 'Belgien', 'ANDERES'];
    let ergebnisse = 0;
    for (const o of vortagOrt) {
      for (const t of vortagTaetigkeit) {
        for (const f1 of [null, 'Nauru']) {
          for (const a of abreise) {
            for (const f2 of [null, 'Kiribati']) {
              for (const hauptland of [null, 'Belgien']) {
                const r = vergleicheLaender([
                  { datum: '2026-10-12', typ: 'ANREISE', land24uhr: 'Belgien' },
                  { datum: '2026-10-13', typ: 'GANZTAG', land24uhr: o, letzterTaetigkeitsort: t, landFreitext: f1 },
                  { datum: '2026-10-14', typ: 'ABREISE', letzterTaetigkeitsort: a, landFreitext: f2 },
                ], hauptland);
                if ('ok' in r) ergebnisse++;
              }
            }
          }
        }
      }
    }
    expect(ergebnisse).toBeGreaterThan(50); // nicht nur Fehlerfälle verglichen
  });

  it('5.000 zufällige Reisen (1–6 Tage, gemischte Angaben)', () => {
    const r = zufall(20261010);
    const wahl = <T>(liste: readonly T[]): T => liste[Math.floor(r() * liste.length)];
    let ok = 0;
    for (let i = 0; i < 5000; i++) {
      const typen = wahl(TYP_FOLGEN);
      const tage = typen.map((typ, n): BeTagesLandAngabe => ({
        datum: `2026-10-${String(10 + n).padStart(2, '0')}`,
        typ,
        // überwiegend gültige Angaben, damit nicht nur Fehlerpfade verglichen werden
        land24uhr: r() < 0.8 ? wahl([null, 'INLAND', 'Belgien', 'Niederlande', 'ANDERES', 'SEETAG']) : wahl(ANGABEN),
        letzterTaetigkeitsort: r() < 0.8 ? wahl([null, null, 'INLAND', 'Belgien', 'Niederlande', 'ANDERES']) : wahl(ANGABEN),
        landFreitext: r() < 0.7 ? wahl(['Nauru', ' Kiribati ']) : wahl(FREITEXTE),
      }));
      const hauptland = r() < 0.85 ? wahl([null, 'Belgien', 'Luxemburg']) : wahl(HAUPTLAENDER);
      if ('ok' in vergleicheLaender(tage, hauptland)) ok++;
    }
    expect(ok).toBeGreaterThan(1000);
  });
});

// ── 3. Satzauswahl (satzLandKey / waehleTagesSatz) ────────────────────────────

describe('Satzparität satzLandKey / waehleTagesSatz Backend ↔ Frontend', () => {
  const KEYS = ['INLAND', 'ANDERES', 'SEETAG', 'Belgien', 'Luxemburg', 'Atlantis', 'constructor', 'toString', '__proto__', ''];
  const mitLuxemburg: Array<[string, number, number]> = [['Belgien', 59, 40], ['Luxemburg', 63, 42]];
  const ohneLuxemburg: Array<[string, number, number]> = [['Belgien', 59, 40]];

  for (const [name, liste] of [['mit Luxemburg', mitLuxemburg], ['ohne Luxemburg', ohneLuxemburg]] as const) {
    it(`alle Keys, Ländertabelle ${name}`, () => {
      const be = new Map<string, TagesSatz>(liste.map(([k, s24, s8]) => [k, { satz24h: s24, satz8h: s8 }]));
      const fe = new Map<string, VmaSatz>(liste.map(([k, s24, s8]) => [k, { tagessatz24h: s24, tagessatz8h: s8 }]));
      for (const key of KEYS) {
        expect(feSatzLandKey(key), key).toBe(beSatzLandKey(key));
        const b = ergebnis(() => beWaehleTagesSatz(key, be));
        const f = ergebnis(() => feWaehleTagesSatz(key, fe));
        const paarBe = 'ok' in b ? { ok: [b.ok.satz24h, b.ok.satz8h] } : b;
        const paarFe = 'ok' in f ? { ok: [f.ok.tagessatz24h, f.ok.tagessatz8h] } : f;
        expect(paarFe, key).toEqual(paarBe);
      }
    });
  }

  it('Inland → 28/14, Seetag und nicht aufgeführter Staat → Satz Luxemburg', () => {
    const be = new Map<string, TagesSatz>([['Luxemburg', { satz24h: 63, satz8h: 42 }]]);
    expect(beWaehleTagesSatz('INLAND', be)).toEqual({ satz24h: 28, satz8h: 14 });
    expect(beWaehleTagesSatz('SEETAG', be)).toEqual({ satz24h: 63, satz8h: 42 });
    expect(beWaehleTagesSatz('ANDERES', be)).toEqual({ satz24h: 63, satz8h: 42 });
  });
});

// ── 4. Gesamtbeträge der Spezifikationsfälle (komplette Kette) ────────────────

// BMF-Schreiben vom 05.12.2025 (Endbeträge 24 h / 8 h)
const LAENDER: Array<[string, number, number]> = [['Belgien', 59, 40], ['Niederlande', 58, 39], ['Luxemburg', 63, 42]];
const BE_SAETZE = new Map<string, TagesSatz>(LAENDER.map(([k, s24, s8]) => [k, { satz24h: s24, satz8h: s8 }]));
const FE_SAETZE = new Map<string, VmaSatz>(LAENDER.map(([k, s24, s8]) => [k, { tagessatz24h: s24, tagessatz8h: s8 }]));

type TagAngabe = Partial<Pick<ReisetagEingabe,
  'land24uhr' | 'letzterTaetigkeitsort' | 'landFreitext' | 'fruehstueckGestellt' | 'mittagGestellt' | 'abendGestellt'>>;

interface Fall {
  name: string;
  abfahrt: string;
  rueckkehr: string;
  uebernachtung?: boolean | null;
  hauptland?: string | null;
  tage?: Record<string, TagAngabe>;
  /** Betrag je Tag (Reihenfolge der Tage) oder Fehlermeldung (Teilstring). */
  netto?: number[];
  summe?: number;
  fehler?: string;
}

const runde = (n: number) => Math.round(n * 100) / 100;

/** Backend-Kette wie die Route: Tage bilden → Angaben per Datum → Land → Satz → vmaTag. */
function backendRechnung(f: Fall): { netto: number[]; summe: number } | { fehler: string } {
  try {
    const soll = beBildeReisetage(f.abfahrt, f.rueckkehr, f.uebernachtung ?? null);
    const angaben = soll.map(t => ({ ...t, ...f.tage?.[t.datum] }));
    const laender = beBestimmeTageslaender(angaben, f.hauptland ?? null);
    const netto = angaben.map((t, i) => vmaTag(
      {
        typ: t.typ,
        eintaegigUeber8h: t.eintaegigUeber8h,
        fruehstueckGestellt: !!t.fruehstueckGestellt,
        mittagGestellt: !!t.mittagGestellt,
        abendGestellt: !!t.abendGestellt,
      },
      beWaehleTagesSatz(laender[i].landKey, BE_SAETZE),
    ).vmaNetto);
    return { netto, summe: runde(netto.reduce((a, b) => a + b, 0)) };
  } catch (err) {
    if (err instanceof BeReisetageFehler) return { fehler: err.message };
    throw err;
  }
}

/** Frontend-Kette wie das Formular: Tage bilden → Eingaben übernehmen → Vorschau. */
function frontendRechnung(f: Fall): { netto: number[]; summe: number } | { fehler: string } {
  try {
    const soll = feBildeReisetage(f.abfahrt, f.rueckkehr, f.uebernachtung ?? null);
    const tage = uebernehmeTagesangaben(soll, []).map(t => ({ ...t, ...f.tage?.[t.datum] }));
    const vorschau = berechneVmaVorschau(tage, f.hauptland ?? null, FE_SAETZE);
    if (vorschau.fehler) return { fehler: vorschau.fehler };
    const netto = vorschau.tage.map(t => t.vmaNetto);
    return { netto, summe: runde(netto.reduce((a, b) => a + b, 0)) };
  } catch (err) {
    if (err instanceof FeReisetageFehler) return { fehler: err.message };
    throw err;
  }
}

const FRUEHSTUECK = { fruehstueckGestellt: true };

const FAELLE: Fall[] = [
  {
    name: 'BE → NL → LU, 4 Tage, Frühstück Tag 2–4 (Tag 4 ohne Angabe erbt LU)',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-15T18:00', hauptland: 'Belgien',
    tage: {
      '2026-10-13': { land24uhr: 'Niederlande', ...FRUEHSTUECK },
      '2026-10-14': { land24uhr: 'Luxemburg', ...FRUEHSTUECK },
      '2026-10-15': { ...FRUEHSTUECK },
    },
    netto: [40, 46.4, 50.4, 29.4], summe: 166.2,
  },
  {
    name: 'Nachtbus Mo 22:00 ab, um 24 Uhr noch im Inland → Mo 14,00',
    abfahrt: '2026-10-12T22:00', rueckkehr: '2026-10-14T08:00', hauptland: 'Belgien',
    tage: { '2026-10-12': { land24uhr: 'INLAND' } },
    netto: [14, 59, 40], summe: 113,
  },
  {
    name: 'Zwischentag: um 24 Uhr Inland, letzte Tätigkeit Niederlande → 58,00',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: 'Belgien',
    tage: { '2026-10-13': { land24uhr: 'INLAND', letzterTaetigkeitsort: 'Niederlande' } },
    // Abreisetag ohne Angabe erbt das maßgebende Land des Vortags (Niederlande)
    netto: [40, 58, 39], summe: 137,
  },
  {
    name: 'Inlandstag mit Inlandstätigkeit + Frühstück → 22,40',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: 'Belgien',
    tage: { '2026-10-13': { land24uhr: 'INLAND', letzterTaetigkeitsort: 'INLAND', ...FRUEHSTUECK } },
    // Abreisetag ohne Angabe: Vortag Inland → Hauptland Belgien
    netto: [40, 22.4, 40], summe: 102.4,
  },
  {
    name: 'Seetag → 63,00 (Satz Luxemburg); Ausschiffung ohne Angabe → Hauptland',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: 'Niederlande',
    tage: { '2026-10-13': { land24uhr: 'SEETAG' } },
    netto: [39, 63, 39], summe: 141,
  },
  {
    name: 'Seetag am Anreisetag → Fehler',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: 'Niederlande',
    tage: { '2026-10-12': { land24uhr: 'SEETAG' } },
    fehler: 'Am 12.10.2026 ist „Seetag“ nicht möglich',
  },
  {
    name: 'Staat nicht in der Liste → 63,00 (Satz Luxemburg), Abreisetag erbt',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: 'Belgien',
    tage: { '2026-10-13': { land24uhr: 'ANDERES', landFreitext: 'Nauru' } },
    netto: [40, 63, 42], summe: 145,
  },
  {
    name: 'Staat nicht in der Liste ohne Freitext → Fehler',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: 'Belgien',
    tage: { '2026-10-13': { land24uhr: 'ANDERES', landFreitext: '  ' } },
    fehler: 'Bitte geben Sie für den 13.10.2026 an, in welchem Staat Sie waren',
  },
  {
    name: 'Inlandsreise mit Auslandstag → Fehler',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: null,
    tage: { '2026-10-14': { letzterTaetigkeitsort: 'Belgien' } },
    fehler: 'Bei einer Inlandsreise kann kein Reisetag im Ausland liegen (14.10.2026)',
  },
  {
    name: 'Inland über die Zeitumstellung Herbst: 5 Tage = 112,00',
    abfahrt: '2026-10-23T08:00', rueckkehr: '2026-10-27T18:00',
    netto: [14, 28, 28, 28, 14], summe: 112,
  },
  {
    name: 'Inland über die Zeitumstellung Frühjahr: 5 eindeutige Tage = 112,00',
    abfahrt: '2026-03-27T08:00', rueckkehr: '2026-03-31T18:00',
    netto: [14, 28, 28, 28, 14], summe: 112,
  },
  {
    name: 'Abfahrt 00:30 Uhr: 2 Tage = 28,00 (kein Vortag)',
    abfahrt: '2026-05-04T00:30', rueckkehr: '2026-05-05T18:00',
    netto: [14, 14], summe: 28,
  },
  {
    name: '17:00 → 00:30 ohne Übernachtung = 0,00',
    abfahrt: '2026-10-12T17:00', rueckkehr: '2026-10-13T00:30', uebernachtung: false,
    netto: [0], summe: 0,
  },
  {
    name: '16:00 → 02:00 ohne Übernachtung = 14,00 (erster Tag)',
    abfahrt: '2026-10-12T16:00', rueckkehr: '2026-10-13T02:00', uebernachtung: false,
    netto: [14], summe: 14,
  },
  {
    name: '16:00 → 02:00 ohne Übernachtung, Ausland: Satz des letzten Tätigkeitsorts',
    abfahrt: '2026-10-12T16:00', rueckkehr: '2026-10-13T02:00', uebernachtung: false, hauptland: 'Belgien',
    tage: { '2026-10-12': { letzterTaetigkeitsort: 'Niederlande' } },
    netto: [39], summe: 39,
  },
  {
    name: '17:00 → 00:30 ohne Übernachtungsangabe → Fehler',
    abfahrt: '2026-10-12T17:00', rueckkehr: '2026-10-13T00:30',
    fehler: 'Bitte geben Sie an, ob Sie auswärts übernachtet haben',
  },
  {
    name: '26 h über zwei Kalendertage ohne Übernachtung, Belgien = 59,00 (ein 24-h-Satz statt 2 × 40,00)',
    abfahrt: '2026-05-04T06:00', rueckkehr: '2026-05-05T08:00', uebernachtung: false, hauptland: 'Belgien',
    netto: [59], summe: 59,
  },
  {
    name: '26 h ohne Übernachtung, Inland mit Mittag und Abend = 28 − 22,40 = 5,60',
    abfahrt: '2026-05-04T06:00', rueckkehr: '2026-05-05T08:00', uebernachtung: false,
    tage: { '2026-05-04': { mittagGestellt: true, abendGestellt: true } },
    netto: [5.6], summe: 5.6,
  },
  {
    name: 'eintägig erst Belgien, dann Aachen: letzter Tätigkeitsort im Ausland = Belgien 40,00',
    abfahrt: '2026-10-12T06:00', rueckkehr: '2026-10-12T20:00', hauptland: 'Belgien',
    tage: { '2026-10-12': { letzterTaetigkeitsort: 'Belgien' } },
    netto: [40], summe: 40,
  },
  {
    name: 'Jahreswechsel 2026-12-30 → 2027-01-02 = 4 Tage',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00',
    netto: [14, 28, 28, 14], summe: 84,
  },
];

describe(`Gesamtbeträge der Spezifikationsfälle Backend ↔ Frontend, TZ=${TZ}`, () => {
  for (const f of FAELLE) {
    it(f.name, () => {
      const be = backendRechnung(f);
      const fe = frontendRechnung(f);
      expect(fe).toEqual(be);
      if (f.fehler) {
        expect('fehler' in be && be.fehler).toContain(f.fehler);
      } else {
        expect(be).toEqual({ netto: f.netto, summe: f.summe });
      }
    });
  }
});

// ── 5. Anzeige: Landname und Länderfolge (PDF/Mail ↔ Wizard) ─────────────────

describe('Anzeigeparität landBezeichnung / reiselandFolge ↔ laenderfolge', () => {
  const KEYS = ['INLAND', 'ANDERES', 'SEETAG', 'Belgien', 'Frankreich — Paris', 'Luxemburg'];
  const FREI: Array<string | null> = [null, 'Nauru', 'Kiribati'];
  const laender = KEYS.flatMap(landKey => FREI.map(landFreitext => ({ landKey, landFreitext })));

  it('jeder Key mit und ohne Freitext', () => {
    for (const l of laender) expect(feLandBezeichnung(l), JSON.stringify(l)).toBe(beLandBezeichnung(l));
  });

  it('Länderfolgen aller Paare und 2.000 zufälliger Reisen (1–8 Tage)', () => {
    const vergleiche = (folge: typeof laender) =>
      expect(feLaenderfolge(folge), JSON.stringify(folge)).toBe(beReiselandFolge(folge).join(' → '));
    for (const a of laender) for (const b of laender) vergleiche([a, b]);
    const r = zufall(4711);
    for (let i = 0; i < 2000; i++) {
      vergleiche(Array.from({ length: 1 + Math.floor(r() * 8) }, () => laender[Math.floor(r() * laender.length)]));
    }
  });
});
