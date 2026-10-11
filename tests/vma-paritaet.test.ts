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
  brauchtSatz as beBrauchtSatz,
  landKeyZuFreitext as beLandKeyZuFreitext,
  listenEintraegeZuFreitext as beListenEintraegeZuFreitext,
  LAND_ALIASE as BE_LAND_ALIASE,
  pruefeLandFreitext as bePruefeLandFreitext,
  satzLandKey as beSatzLandKey,
  waehleSatzstand as beWaehleSatzstand,
  waehleTagesSatz as beWaehleTagesSatz,
  ReisetageFehler as BeReisetageFehler,
  type Satzstand as BeSatzstand,
  type TagesLandAngabe as BeTagesLandAngabe,
} from '../backend/src/lib/reisetage';
import {
  bereiteReisekostenVor as beBereiteReisekostenVor,
  berechneReisekostenVma as beBerechneReisekostenVma,
  landBezeichnung as beLandBezeichnung,
  reiselandFolge as beReiselandFolge,
  type ReisekostenVorbereitung as BeVorbereitung,
} from '../backend/src/lib/reiseangaben';
import { berechneVmaTagMitSatz, type VmaSatz } from '../frontend/src/lib/vma';
import {
  bildeReisetage as feBildeReisetage,
  bestimmeTageslaender as feBestimmeTageslaender,
  brauchtSatz as feBrauchtSatz,
  landKeyZuFreitext as feLandKeyZuFreitext,
  listenEintraegeZuFreitext as feListenEintraegeZuFreitext,
  LAND_ALIASE as FE_LAND_ALIASE,
  pruefeLandFreitext as fePruefeLandFreitext,
  satzLandKey as feSatzLandKey,
  waehleSatzstand as feWaehleSatzstand,
  waehleTagesSatz as feWaehleTagesSatz,
  ReisetageFehler as FeReisetageFehler,
  berechneVmaVorschau,
  laenderfolge as feLaenderfolge,
  landBezeichnung as feLandBezeichnung,
  uebernehmeTagesangaben,
  type Satzstand as FeSatzstand,
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

// ── 3. Satzauswahl (satzLandKey / waehleSatzstand / waehleTagesSatz) ──────────

const BMF_2026 = 'BMF-Schreiben vom 05.12.2025';
const TEST_2027 = 'Test-Stand 2027'; // fiktiver Stand, Werte nur zur Unterscheidung
const KORREKTUR = 'Korrektur ab 01.07.2026'; // fiktiver Stand mitten im Jahr

/** Satzstand als Zeile [Land, gültig ab, 24 h, 8 h, Quelle] — für beide Zwillinge in deren Feldnamen. */
type StandZeile = readonly [landKey: string, gueltigVon: string, s24: number, s8: number, quelle: string];
const beStaende = (zeilen: readonly StandZeile[]): BeSatzstand[] =>
  zeilen.map(([landKey, gueltigVon, satz24h, satz8h, quelle]) => ({ landKey, gueltigVon, quelle, satz24h, satz8h }));
const feStaende = (zeilen: readonly StandZeile[]): FeSatzstand[] =>
  zeilen.map(([landKey, gueltigVon, tagessatz24h, tagessatz8h, quelle]) => ({ landKey, gueltigVon, quelle, tagessatz24h, tagessatz8h }));

// Satzstand 2026 (BMF-Schreiben vom 05.12.2025, Endbeträge 24 h / 8 h)
const STAND_2026: readonly StandZeile[] = [
  ['Belgien', '2026-01-01', 59, 40, BMF_2026],
  ['Niederlande', '2026-01-01', 58, 39, BMF_2026],
  ['Luxemburg', '2026-01-01', 63, 42, BMF_2026],
];
const MIT_2027: readonly StandZeile[] = [
  ...STAND_2026,
  ['Belgien', '2027-01-01', 61, 41, TEST_2027],
  ['Luxemburg', '2027-01-01', 65, 44, TEST_2027],
];
const MIT_KORREKTUR: readonly StandZeile[] = [...STAND_2026, ['Belgien', '2026-07-01', 60, 41, KORREKTUR]];
// Jahresstand 2027 mit Lücken: Niederlande und Barcelona nur 2026 (gestrichen), Frankreich erst ab 2027
const MIT_LUECKEN: readonly StandZeile[] = [
  ...MIT_2027,
  ['Spanien', '2026-01-01', 34, 23, BMF_2026],
  ['Spanien', '2027-01-01', 35, 24, TEST_2027],
  ['Spanien — Barcelona', '2026-01-01', 34, 23, BMF_2026],
  ['Frankreich', '2027-01-01', 54, 36, TEST_2027],
];

/** Alle Kalendertage von `von` bis `bis` als 'YYYY-MM-DD' (UTC-Arithmetik). */
function kalendertage(von: string, bis: string): string[] {
  const tage: string[] = [];
  for (let ms = Date.parse(`${von}T00:00:00Z`); ms <= Date.parse(`${bis}T00:00:00Z`); ms += 86_400_000) {
    tage.push(new Date(ms).toISOString().slice(0, 10));
  }
  return tage;
}

// Jahreswechsel 2025/26 bis 2027/28 (jeder Tag) und Schalttag 2028
const DATEN = [...kalendertage('2025-12-20', '2028-01-10'), '2028-02-29', '2028-12-31'];
const DATEN_TEXT = 'jeder Tag 20.12.2025–10.01.2028, 29.02. und 31.12.2028';

describe('Satzstandparität waehleSatzstand Backend ↔ Frontend (Stand nach Reisedatum)', () => {
  // Stände EINES Landes, bewusst auch unsortiert
  const LISTEN: Array<[string, Array<{ gueltigVon: string }>]> = [
    ['keine Stände', []],
    ['nur 2026', [{ gueltigVon: '2026-01-01' }]],
    ['2026 + 2027', [{ gueltigVon: '2026-01-01' }, { gueltigVon: '2027-01-01' }]],
    ['2027 + 2026 (unsortiert)', [{ gueltigVon: '2027-01-01' }, { gueltigVon: '2026-01-01' }]],
    ['2026 + Korrektur ab 01.07.2026', [{ gueltigVon: '2026-07-01' }, { gueltigVon: '2026-01-01' }]],
    ['nur Stand mitten im Jahr (ab 15.03.2027)', [{ gueltigVon: '2027-03-15' }]],
    ['2026, Korrektur 31.12.2026, 2027, 2028', [
      { gueltigVon: '2028-01-01' }, { gueltigVon: '2026-12-31' }, { gueltigVon: '2027-01-01' }, { gueltigVon: '2026-01-01' },
    ]],
    ['nur 2028 (Schaltjahr) ab 29.02.', [{ gueltigVon: '2028-02-29' }]],
  ];

  /** Erwartung unabhängig von beiden Zwillingen: größtes gueltigVon ≤ Datum im selben Kalenderjahr. */
  const referenz = (liste: Array<{ gueltigVon: string }>, datum: string) =>
    liste
      .filter(s => s.gueltigVon.slice(0, 4) === datum.slice(0, 4) && s.gueltigVon <= datum)
      .sort((a, b) => (a.gueltigVon < b.gueltigVon ? 1 : -1))[0] ?? null;

  for (const [name, liste] of LISTEN) {
    it(`${name}: ${DATEN_TEXT}`, () => {
      for (const datum of DATEN) {
        const be = beWaehleSatzstand(liste, datum);
        expect(feWaehleSatzstand(liste, datum), `${name} @ ${datum}`).toBe(be);
        expect(be, `${name} @ ${datum}`).toBe(referenz(liste, datum));
      }
    });
  }

  it('Stichproben: Jahreswechsel, Stand mitten im Jahr, kein Vorjahresstand', () => {
    const [, zwei] = LISTEN[2];
    const [, korrektur] = LISTEN[4];
    expect(beWaehleSatzstand(zwei, '2026-12-31')?.gueltigVon).toBe('2026-01-01');
    expect(beWaehleSatzstand(zwei, '2027-01-01')?.gueltigVon).toBe('2027-01-01');
    expect(beWaehleSatzstand(korrektur, '2026-06-30')?.gueltigVon).toBe('2026-01-01');
    expect(beWaehleSatzstand(korrektur, '2026-07-01')?.gueltigVon).toBe('2026-07-01');
    expect(beWaehleSatzstand(korrektur, '2027-01-01')).toBeNull(); // Vorjahresstand gilt nicht weiter
    expect(beWaehleSatzstand(zwei, '2025-12-31')).toBeNull(); // nur spätere Stände
  });
});

describe('Satzparität satzLandKey / waehleTagesSatz Backend ↔ Frontend', () => {
  const KEYS = [
    'INLAND', 'ANDERES', 'SEETAG', 'Belgien', 'Niederlande', 'Luxemburg', 'Spanien', 'Spanien — Barcelona', 'Frankreich',
    'Atlantis', 'constructor', 'toString', '__proto__', '',
  ];
  const TABELLEN: Array<[string, readonly StandZeile[]]> = [
    ['Stand 2026', STAND_2026],
    ['Stand 2026 + Test-Stand 2027', MIT_2027],
    ['Stand 2026 + Korrektur Belgien ab 01.07.', MIT_KORREKTUR],
    ['Stand 2027 mit gestrichenen und neuen Keys', MIT_LUECKEN],
    ['Luxemburg erst ab 01.07.2027', [...STAND_2026, ['Luxemburg', '2027-07-01', 65, 44, TEST_2027], ['Belgien', '2027-01-01', 61, 41, TEST_2027]]],
    ['ohne Luxemburg', STAND_2026.filter(([k]) => k !== 'Luxemburg')],
    ['umgekehrt sortiert', [...MIT_2027].reverse()],
    ['leer', []],
  ];

  // Angewandter Satz beider Seiten in gemeinsamer Form [24 h, 8 h, Quelle] bzw. der Fehler.
  const paarBe = (r: Ergebnis<ReturnType<typeof beWaehleTagesSatz>>) => ('ok' in r ? { ok: [r.ok.satz24h, r.ok.satz8h, r.ok.quelle] } : r);
  const paarFe = (r: Ergebnis<ReturnType<typeof feWaehleTagesSatz>>) =>
    ('ok' in r ? { ok: [r.ok.tagessatz24h, r.ok.tagessatz8h, r.ok.quelle] } : r);

  for (const [name, zeilen] of TABELLEN) {
    it(`alle Keys × ${DATEN_TEXT}, ${name}`, () => {
      const be = beStaende(zeilen);
      const fe = feStaende(zeilen);
      for (const key of KEYS) {
        expect(feSatzLandKey(key), key).toBe(beSatzLandKey(key));
        for (const datum of DATEN) {
          const b = paarBe(ergebnis(() => beWaehleTagesSatz(key, datum, be)));
          const f = paarFe(ergebnis(() => feWaehleTagesSatz(key, datum, fe)));
          expect(f, `${key} @ ${datum}`).toEqual(b);
        }
      }
    });
  }

  it('Inland → 28/14 (§ 9 Abs. 4a EStG) in jedem Jahr; Seetag und nicht aufgeführter Staat → Luxemburg-Stand des Reisejahres', () => {
    const be = beStaende(MIT_2027);
    for (const datum of ['2026-03-16', '2027-01-01', '2030-12-31']) {
      expect(beWaehleTagesSatz('INLAND', datum, [])).toEqual({ satz24h: 28, satz8h: 14, quelle: '§ 9 Abs. 4a EStG' });
    }
    expect(beWaehleTagesSatz('SEETAG', '2026-12-31', be)).toEqual({ satz24h: 63, satz8h: 42, quelle: BMF_2026 });
    expect(beWaehleTagesSatz('ANDERES', '2027-01-01', be)).toEqual({ satz24h: 65, satz8h: 44, quelle: TEST_2027 });
    expect(feWaehleTagesSatz('SEETAG', '2027-06-30', feStaende(MIT_2027))).toEqual({ tagessatz24h: 65, tagessatz8h: 44, quelle: TEST_2027 });
  });

  it('kein Stand im Reisejahr → SATZSTAND_FEHLT mit der Meldung des Servers, unbekanntes Land → UNBEKANNTES_LAND', () => {
    const erwartet = {
      code: 'SATZSTAND_FEHLT',
      meldung: 'Die Auslandspauschalen für 2027 sind noch nicht hinterlegt. Bitte reichen Sie die Abrechnung später ein oder wenden Sie sich an die Buchhaltung.',
    };
    for (const key of ['Belgien', 'Niederlande', 'SEETAG', 'ANDERES']) {
      expect(ergebnis(() => beWaehleTagesSatz(key, '2027-01-01', beStaende(STAND_2026))), key).toEqual(erwartet);
      expect(ergebnis(() => feWaehleTagesSatz(key, '2027-01-01', feStaende(STAND_2026))), key).toEqual(erwartet);
    }
    expect(ergebnis(() => feWaehleTagesSatz('Atlantis', '2026-03-16', feStaende(STAND_2026))))
      .toEqual({ code: 'UNBEKANNTES_LAND', meldung: 'Unbekanntes Reiseland: Atlantis' });
  });

  it('Jahresstand da, nur der Key fehlt → LAND_OHNE_SATZSTAND: Staat → „Staat nicht in der Liste“, Stadt → Staat (übrige Orte)', () => {
    const faelle: Array<[string, string, string]> = [
      ['Niederlande', '2027-01-01', 'Für „Niederlande“ ist für 2027 keine Auslandspauschale hinterlegt. Bitte wählen Sie „Staat nicht in der Liste“ (Satz Luxemburg) oder wenden Sie sich an die Buchhaltung.'],
      ['Frankreich', '2026-12-31', 'Für „Frankreich“ ist für 2026 keine Auslandspauschale hinterlegt. Bitte wählen Sie „Staat nicht in der Liste“ (Satz Luxemburg) oder wenden Sie sich an die Buchhaltung.'],
      ['Spanien — Barcelona', '2027-01-02', 'Für „Spanien — Barcelona“ ist für 2027 keine eigene Auslandspauschale hinterlegt. Bitte wählen Sie „Spanien“ (übrige Orte) oder wenden Sie sich an die Buchhaltung.'],
    ];
    for (const [key, datum, meldung] of faelle) {
      const erwartet = { code: 'LAND_OHNE_SATZSTAND', meldung };
      expect(ergebnis(() => beWaehleTagesSatz(key, datum, beStaende(MIT_LUECKEN))), key).toEqual(erwartet);
      expect(ergebnis(() => feWaehleTagesSatz(key, datum, feStaende(MIT_LUECKEN))), key).toEqual(erwartet);
    }
  });

  it('Reisejahr vor dem ersten Luxemburg-Stand → SATZSTAND_FEHLT mit Verweis auf die Buchhaltung', () => {
    const erwartet = {
      code: 'SATZSTAND_FEHLT',
      meldung: 'Für Reisetage im Jahr 2025 sind keine Auslandspauschalen hinterlegt. Bitte wenden Sie sich an die Buchhaltung.',
    };
    for (const key of ['Belgien', 'Luxemburg', 'SEETAG', 'ANDERES', 'Frankreich']) {
      expect(ergebnis(() => beWaehleTagesSatz(key, '2025-12-31', beStaende(MIT_LUECKEN))), key).toEqual(erwartet);
      expect(ergebnis(() => feWaehleTagesSatz(key, '2025-12-31', feStaende(MIT_LUECKEN))), key).toEqual(erwartet);
    }
  });
});

// ── 3b. Tage ohne Anspruch / Freitext bei „Staat nicht in der Liste“ ─────────────

describe('Parität brauchtSatz / landKeyZuFreitext / pruefeLandFreitext Backend ↔ Frontend', () => {
  it('brauchtSatz: alle Typen mit und ohne 8-h-Angabe', () => {
    for (const typ of TYPEN) {
      for (const eintaegigUeber8h of [true, false, undefined]) {
        expect(feBrauchtSatz({ typ, eintaegigUeber8h }), `${typ} ${eintaegigUeber8h}`).toBe(beBrauchtSatz({ typ, eintaegigUeber8h }));
      }
    }
  });

  it('Alias-Tabelle identisch', () => {
    expect(FE_LAND_ALIASE).toEqual(BE_LAND_ALIASE);
  });

  // Listen- und Stadtnamen, alle Alias-Namen (auch in anderer Schreibweise), nicht aufgeführte Staaten, Leereingaben
  const KEYS = [...new Set([
    ...Object.values(BE_LAND_ALIASE), 'Polen', 'Belgien', 'China — Hongkong', 'Frankreich — Paris', 'Côte d’Ivoire',
    'Spanien — Barcelona', 'USA — Miami', 'Russische Föderation — Moskau',
  ])];
  const FREITEXTE = [
    ...Object.keys(BE_LAND_ALIASE), ...Object.keys(BE_LAND_ALIASE).map(k => ` ${k.toUpperCase()} `),
    ...KEYS, ...KEYS.map(k => k.toLowerCase()), 'Hongkong', 'paris', "cote d'ivoire", 'Süd-Korea', 'Grönland', 'Färöer',
    'Palma', 'Mallorca', 'New York', 'New York City', 'Washington', 'Washington, D.C.', 'Hong Kong', 'Sankt-Petersburg',
    'St. Petersburg', 'York', 'Nauru', 'Kiribati', 'Nordkorea', '', '   ', '—', 'constructor', '__proto__',
  ];

  it(`landKeyZuFreitext: ${FREITEXTE.length} Eingaben × volle, leere und Teilliste`, () => {
    const LISTEN = [KEYS, [], KEYS.filter((_, i) => i % 2 === 0)];
    let treffer = 0;
    for (const liste of LISTEN) {
      for (const freitext of FREITEXTE) {
        const be = beLandKeyZuFreitext(freitext, liste);
        expect(feLandKeyZuFreitext(freitext, liste), `${freitext} (${liste.length} Keys)`).toBe(be);
        if (be) treffer++;
      }
    }
    expect(treffer).toBeGreaterThan(100); // nicht nur null verglichen
  });

  it(`listenEintraegeZuFreitext (Staat + Stadt): ${FREITEXTE.length} Eingaben × volle, leere und Teilliste`, () => {
    const LISTEN = [KEYS, [], KEYS.filter((_, i) => i % 2 === 0), [...KEYS].reverse()];
    let mehrere = 0;
    for (const liste of LISTEN) {
      for (const freitext of FREITEXTE) {
        const be = beListenEintraegeZuFreitext(freitext, liste);
        expect(feListenEintraegeZuFreitext(freitext, liste), `${freitext} (${liste.length} Keys)`).toEqual(be);
        expect(be[0] ?? null, freitext).toBe(beLandKeyZuFreitext(freitext, liste));
        if (be.length > 1) mehrere++;
      }
    }
    expect(mehrere).toBeGreaterThan(5); // auch Staat + Stadt verglichen (Mallorca, New York, Washington)
  });

  it('pruefeLandFreitext: Land × Freitext × Datum × Satzstände (Fehlercode und Meldung)', () => {
    // Städte mit eigenem Satz: Palma nur 2026 (Meldung 2027 nur „Spanien“), New York City in beiden Jahren
    const MIT_STAEDTEN: readonly StandZeile[] = [
      ...MIT_LUECKEN,
      ['Spanien — Palma de Mallorca', '2026-01-01', 44, 29, BMF_2026],
      ['USA', '2026-01-01', 59, 40, BMF_2026],
      ['USA — New York City', '2026-01-01', 66, 44, BMF_2026],
      ['USA — New York City', '2027-01-01', 67, 45, TEST_2027],
      ['USA', '2027-01-01', 60, 40, TEST_2027],
    ];
    const TABELLEN: Array<readonly StandZeile[]> = [
      STAND_2026, MIT_2027, MIT_LUECKEN, [...STAND_2026, ['Polen', '2026-07-01', 34, 23, KORREKTUR]], MIT_STAEDTEN, [],
    ];
    const LAENDER = [
      ...['Polen', 'holland', 'Niederlande', 'Belgien', 'Nauru', 'Barcelona', 'Frankreich', 'Spanien', 'Mallorca', 'Palma',
        'New York', 'Washington', '', null]
        .map(landFreitext => ({ landKey: 'ANDERES', landFreitext })),
      { landKey: 'Belgien', landFreitext: 'Polen' }, { landKey: 'SEETAG', landFreitext: null },
    ];
    let fehler = 0;
    for (const zeilen of TABELLEN) {
      const be = beStaende(zeilen);
      const fe = feStaende(zeilen);
      for (const land of LAENDER) {
        for (const datum of ['2025-12-31', '2026-01-01', '2026-06-30', '2026-07-01', '2026-12-31', '2027-01-01', '2027-06-30']) {
          const b = ergebnis(() => bePruefeLandFreitext(land, datum, be));
          expect(ergebnis(() => fePruefeLandFreitext(land, datum, fe)), `${JSON.stringify(land)} @ ${datum}`).toEqual(b);
          if ('code' in b) fehler++;
        }
      }
    }
    expect(fehler).toBeGreaterThan(20); // auch Ablehnungen verglichen
  });
});

// ── 4. Gesamtbeträge der Spezifikationsfälle (komplette Kette) ────────────────

type TagAngabe = Partial<Pick<ReisetagEingabe,
  'land24uhr' | 'letzterTaetigkeitsort' | 'landFreitext' | 'fruehstueckGestellt' | 'mittagGestellt' | 'abendGestellt'>>;

interface Fall {
  name: string;
  abfahrt: string;
  rueckkehr: string;
  uebernachtung?: boolean | null;
  hauptland?: string | null;
  tage?: Record<string, TagAngabe>;
  /** Satzstände (Vorgabe: Stand 2026). */
  staende?: readonly StandZeile[];
  /** Betrag je Tag (Reihenfolge der Tage) oder Fehlermeldung (Teilstring). */
  netto?: number[];
  summe?: number;
  /** Quelle des angewandten Satzes je Tag (optional geprüft); null = Tag ohne Anspruch, kein Satz. */
  quellen?: Array<string | null>;
  fehler?: string;
}

type Rechnung = { netto: number[]; summe: number; quellen: Array<string | null> } | { fehler: string };

const runde = (n: number) => Math.round(n * 100) / 100;

/** Eingaben je Tag wie das Formular (Tage bilden → Eingaben übernehmen → Angaben des Falls) = Client-Payload. */
function formularTage(f: Fall): ReisetagEingabe[] {
  const soll = feBildeReisetage(f.abfahrt, f.rueckkehr, f.uebernachtung ?? null);
  return uebernehmeTagesangaben(soll, []).map(t => ({ ...t, ...f.tage?.[t.datum] }));
}

/** Satzstände, wie die Route sie lädt: WHERE land_key IN (Satz-Keys) bzw. alle Länder. */
function geladeneStaende(v: BeVorbereitung, alle: BeSatzstand[]): BeSatzstand[] {
  if (v.satzKeys.length === 0) return [];
  return v.alleLaender ? alle : alle.filter(s => v.satzKeys.includes(s.landKey));
}

/**
 * Echter Serverpfad (backend/src/lib/reiseangaben.ts, wie die Route): bereiteReisekostenVor →
 * Satzstände laden → berechneReisekostenVma, mit den Tagen des Formulars als Client-Payload.
 */
function backendRechnung(f: Fall): Rechnung {
  let reisetage: ReisetagEingabe[] = [];
  try {
    reisetage = formularTage(f);
  } catch (err) {
    // Das Formular schickt dann nicht ab — der Server lehnt (bildeReisetage) mit derselben Meldung ab.
    if (!(err instanceof FeReisetageFehler)) throw err;
  }
  try {
    const v = beBereiteReisekostenVor({
      abfahrtZeit: f.abfahrt, rueckkehrZeit: f.rueckkehr, uebernachtung: f.uebernachtung ?? null, land: f.hauptland ?? null, reisetage,
    });
    const r = beBerechneReisekostenVma(v, geladeneStaende(v, beStaende(f.staende ?? STAND_2026)));
    return { netto: r.tage.map(t => t.vmaNetto), summe: r.vmaNetto, quellen: r.tage.map(t => t.satz?.quelle ?? null) };
  } catch (err) {
    if (err instanceof BeReisetageFehler) return { fehler: err.message };
    throw err;
  }
}

/** Frontend-Kette wie das Formular: Tage bilden → Eingaben übernehmen → Vorschau. */
function frontendRechnung(f: Fall): Rechnung {
  try {
    const vorschau = berechneVmaVorschau(formularTage(f), f.hauptland ?? null, feStaende(f.staende ?? STAND_2026));
    if (vorschau.fehler) return { fehler: vorschau.fehler };
    const netto = vorschau.tage.map(t => t.vmaNetto);
    return { netto, summe: runde(netto.reduce((a, b) => a + b, 0)), quellen: vorschau.tage.map(t => t.satz?.quelle ?? null) };
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
  // Release 1c: Satzstand je Reisetag nach Datum
  {
    name: 'Inland über den Jahreswechsel braucht keinen Satzstand (28/14, § 9 Abs. 4a EStG)',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00', staende: [],
    netto: [14, 28, 28, 14], summe: 84, quellen: Array(4).fill('§ 9 Abs. 4a EStG'),
  },
  {
    name: 'Belgien 3 Tage 2026 = 139,00 mit Satz 2026, auch wenn ein Stand 2027 existiert',
    abfahrt: '2026-03-16T08:00', rueckkehr: '2026-03-18T18:00', hauptland: 'Belgien', staende: MIT_2027,
    netto: [40, 59, 40], summe: 139, quellen: [BMF_2026, BMF_2026, BMF_2026],
  },
  {
    name: 'Jahreswechsel Belgien mit Stand 2026 + Test-Stand 2027: Dezember 2026er, Januar 2027er Satz',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00', hauptland: 'Belgien', staende: MIT_2027,
    netto: [40, 59, 61, 41], summe: 201, quellen: [BMF_2026, BMF_2026, TEST_2027, TEST_2027],
  },
  {
    name: 'Jahreswechsel Belgien ohne Stand 2027 → Fehler (Server: 400)',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00', hauptland: 'Belgien',
    fehler: 'Die Auslandspauschalen für 2027 sind noch nicht hinterlegt. Bitte reichen Sie die Abrechnung später ein oder wenden Sie sich an die Buchhaltung.',
  },
  {
    name: 'Jahreswechsel ohne Stand 2027, Januar-Tage im Inland → kein Fehler',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-01T18:00', hauptland: 'Belgien',
    tage: { '2026-12-31': { land24uhr: 'INLAND' }, '2027-01-01': { letzterTaetigkeitsort: 'INLAND' } },
    netto: [40, 28, 14], summe: 82, quellen: [BMF_2026, '§ 9 Abs. 4a EStG', '§ 9 Abs. 4a EStG'],
  },
  {
    name: 'Jahreswechsel, Seetag am 01.01.2027 → Luxemburg-Stand 2027',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00', hauptland: 'Belgien', staende: MIT_2027,
    tage: { '2027-01-01': { land24uhr: 'SEETAG' } },
    netto: [40, 59, 65, 41], summe: 205, quellen: [BMF_2026, BMF_2026, TEST_2027, TEST_2027],
  },
  {
    name: 'Seetag am 01.01.2027 ohne Luxemburg-Stand 2027 → Fehler, obwohl Belgien 2027 hinterlegt ist',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00', hauptland: 'Belgien',
    staende: MIT_2027.filter(([k, von]) => !(k === 'Luxemburg' && von === '2027-01-01')),
    tage: { '2027-01-01': { land24uhr: 'SEETAG' } },
    fehler: 'Die Auslandspauschalen für 2027 sind noch nicht hinterlegt.',
  },
  {
    name: 'Jahreswechsel, Niederlande im Stand 2027 nicht mehr aufgeführt → Hinweis auf „Staat nicht in der Liste“',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00', hauptland: 'Niederlande', staende: MIT_LUECKEN,
    fehler: 'Für „Niederlande“ ist für 2027 keine Auslandspauschale hinterlegt. Bitte wählen Sie „Staat nicht in der Liste“ (Satz Luxemburg)',
  },
  {
    name: 'Jahreswechsel, Niederlande 2027 gestrichen: Januar-Tage „Staat nicht in der Liste“ → Luxemburg-Stand 2027',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00', hauptland: 'Niederlande', staende: MIT_LUECKEN,
    tage: { '2027-01-01': { land24uhr: 'ANDERES', landFreitext: 'Niederlande' } },
    netto: [39, 58, 65, 44], summe: 206, quellen: [BMF_2026, BMF_2026, TEST_2027, TEST_2027],
  },
  {
    name: 'Jahreswechsel, Barcelona 2027 gestrichen: Januar-Tage Spanien (übrige Orte) 2027',
    abfahrt: '2026-12-30T08:00', rueckkehr: '2027-01-02T18:00', hauptland: 'Spanien — Barcelona', staende: MIT_LUECKEN,
    tage: { '2027-01-01': { land24uhr: 'Spanien' } },
    netto: [23, 34, 35, 24], summe: 116, quellen: [BMF_2026, BMF_2026, TEST_2027, TEST_2027],
  },
  {
    name: 'Verspätete Abrechnung Dezember 2025 (vor dem ersten Stand) → Buchhaltung',
    abfahrt: '2025-12-29T08:00', rueckkehr: '2025-12-31T18:00', hauptland: 'Belgien',
    fehler: 'Für Reisetage im Jahr 2025 sind keine Auslandspauschalen hinterlegt. Bitte wenden Sie sich an die Buchhaltung.',
  },
  {
    name: 'Stand mitten im Jahr (Korrektur Belgien ab 01.07.2026): Tage davor alter, ab dem Datum neuer Satz',
    abfahrt: '2026-06-29T08:00', rueckkehr: '2026-07-02T18:00', hauptland: 'Belgien', staende: MIT_KORREKTUR,
    tage: { '2026-07-01': { fruehstueckGestellt: true } },
    // 01.07.: 60 − 20 % von 60 = 48,00; 02.07.: 41 (8-h-Satz der Korrektur)
    netto: [40, 59, 48, 41], summe: 188, quellen: [BMF_2026, BMF_2026, KORREKTUR, KORREKTUR],
  },
  // Tage ohne Anspruch brauchen keinen Satz (EH-M1)
  {
    name: 'Tagesreise bis 8 h, Niederlande am 14.01.2027 ohne Stand 2027 → 0,00 ohne Satz statt Fehler',
    abfahrt: '2027-01-14T08:00', rueckkehr: '2027-01-14T15:00', hauptland: 'Niederlande',
    netto: [0], summe: 0, quellen: [null],
  },
  {
    name: 'Tagesreise über 8 h, Niederlande am 14.01.2027 ohne Stand 2027 → Fehler (Satz nötig)',
    abfahrt: '2027-01-14T08:00', rueckkehr: '2027-01-14T16:01', hauptland: 'Niederlande',
    fehler: 'Die Auslandspauschalen für 2027 sind noch nicht hinterlegt. Bitte reichen Sie die Abrechnung später ein oder wenden Sie sich an die Buchhaltung.',
  },
  {
    name: 'Tagesreise bis 8 h im Inland ohne Satzstände → 0,00 ohne Satz',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-12T16:00', staende: [],
    netto: [0], summe: 0, quellen: [null],
  },
  // „Staat nicht in der Liste“ mit einem Staat aus der Liste (SEC-m1)
  {
    name: '„Staat nicht in der Liste“ + „ Holland “ → Fehler (Niederlande steht in der Liste)',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: 'Belgien',
    tage: { '2026-10-13': { land24uhr: 'ANDERES', landFreitext: ' Holland ' } },
    fehler: '„Niederlande“ steht in der Liste – bitte dort auswählen.',
  },
  {
    name: 'Abreisetag erbt „Staat nicht in der Liste“ + „Luxemburg“ vom Vortag → Fehler',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-14T18:00', hauptland: 'Belgien',
    tage: { '2026-10-13': { land24uhr: 'ANDERES', landFreitext: 'luxemburg' } },
    fehler: '„Luxemburg“ steht in der Liste – bitte dort auswählen.',
  },
  {
    name: 'Tagesreise bis 8 h mit „Staat nicht in der Liste“ + „Holland“: kein Satz, also keine Prüfung → 0,00',
    abfahrt: '2026-10-12T08:00', rueckkehr: '2026-10-12T14:00', hauptland: 'Belgien',
    tage: { '2026-10-12': { letzterTaetigkeitsort: 'ANDERES', landFreitext: 'Holland' } },
    netto: [0], summe: 0, quellen: [null],
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
        expect('netto' in be && { netto: be.netto, summe: be.summe }).toEqual({ netto: f.netto, summe: f.summe });
        if (f.quellen) expect('quellen' in be && be.quellen).toEqual(f.quellen);
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
