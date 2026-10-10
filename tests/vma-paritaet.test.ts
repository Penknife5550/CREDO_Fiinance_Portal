/**
 * Paritätstest der beiden VMA-Zwillinge: Backend (autoritativ, Auszahlung) und
 * Frontend (Vorschau im Wizard) müssen für jeden Tag-Typ, jede Mahlzeitenkombination
 * und jeden Satz centgenau dasselbe liefern.
 *
 * Liegt bewusst im Repo-Root (nicht unter backend/src oder frontend/src), weil er
 * beide Workspaces importiert — sonst brechen tsc bzw. der Docker-Build.
 */
import { describe, it, expect } from 'vitest';
import { vmaTag, reisetageAusZeitraum, type ReisetagTyp, type TagesSatz } from '../backend/src/lib/vma';
import { berechneVmaTagMitSatz, berechneReisetage, type VmaSatz } from '../frontend/src/lib/vma';
import type { Reisetag } from '../frontend/src/lib/types';

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

/**
 * Tagesbildung: Frontend (berechneReisetage, Vorschau) und Backend (reisetageAusZeitraum,
 * Prüfung der Client-Tage) müssen dieselben Tage liefern — unabhängig von der Zeitzone
 * des Rechners. CI führt diese Datei unter TZ=UTC und TZ=Europe/Berlin aus.
 * Format je Tag: 'Datum Typ' bzw. 'Datum EINTAEGIG >8h' / '≤8h'.
 */
const ZEITRAEUME: Array<[string, string, string, string[]]> = [
  ['Zeitumstellung Frühjahr (29.03.)', '2026-03-27T08:00', '2026-03-31T18:00',
    ['2026-03-27 ANREISE', '2026-03-28 GANZTAG', '2026-03-29 GANZTAG', '2026-03-30 GANZTAG', '2026-03-31 ABREISE']],
  ['Zeitumstellung Herbst (25.10.)', '2026-10-23T08:00', '2026-10-27T18:00',
    ['2026-10-23 ANREISE', '2026-10-24 GANZTAG', '2026-10-25 GANZTAG', '2026-10-26 GANZTAG', '2026-10-27 ABREISE']],
  ['Abfahrt vor 01:00 Uhr (kein Vortag)', '2026-05-04T00:30', '2026-05-05T18:00',
    ['2026-05-04 ANREISE', '2026-05-05 ABREISE']],
  ['eintägig mit Abfahrt 01:00 Uhr, 9 h', '2026-05-04T01:00', '2026-05-04T10:00',
    ['2026-05-04 EINTAEGIG >8h']],
  ['eintägig am Tag der Zeitumstellung (Wanduhrzeit 8:30 h)', '2026-03-29T01:00', '2026-03-29T09:30',
    ['2026-03-29 EINTAEGIG >8h']],
  ['eintägig genau 8:00 h', '2026-03-16T08:00', '2026-03-16T16:00', ['2026-03-16 EINTAEGIG ≤8h']],
  ['eintägig 8:01 h', '2026-03-16T08:00', '2026-03-16T16:01', ['2026-03-16 EINTAEGIG >8h']],
  ['Jahreswechsel', '2026-12-30T08:00', '2027-01-02T18:00',
    ['2026-12-30 ANREISE', '2026-12-31 GANZTAG', '2027-01-01 GANZTAG', '2027-01-02 ABREISE']],
  ['Schaltjahr', '2028-02-28T08:00', '2028-03-01T18:00',
    ['2028-02-28 ANREISE', '2028-02-29 GANZTAG', '2028-03-01 ABREISE']],
  ['Rückkehr vor Abfahrt', '2026-03-16T10:00', '2026-03-16T08:00', []],
];

const kurz = (t: { datum: string; typ: string; eintaegigUeber8h?: boolean }) =>
  t.typ === 'EINTAEGIG' ? `${t.datum} EINTAEGIG ${t.eintaegigUeber8h ? '>8h' : '≤8h'}` : `${t.datum} ${t.typ}`;

describe(`Reisetage-Parität Backend (reisetageAusZeitraum) ↔ Frontend (berechneReisetage), TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {
  for (const [name, abfahrt, rueckkehr, erwartet] of ZEITRAEUME) {
    it(name, () => {
      expect((reisetageAusZeitraum(abfahrt, rueckkehr) ?? []).map(kurz)).toEqual(erwartet);
      expect(berechneReisetage(abfahrt, rueckkehr).map(kurz)).toEqual(erwartet);
    });
  }
});
