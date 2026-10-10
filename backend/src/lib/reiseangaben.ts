/**
 * Reisekosten (Release 1b/1c): Zuordnung der Client-Tagesangaben, Anzeige des Reiselands,
 * Quellen der angewandten Pauschalen und Prüfvermerke bei Überschneidungen — reine, testbare
 * Funktionen für Route, PDF und Mailtext.
 * Die steuerliche Logik (Tagesbildung, maßgebendes Land, Satz) liegt in reisetage.ts.
 */

import { LAND_ANDERES, LAND_INLAND, LAND_SEETAG } from './constants.js';
import type { ReisetagSoll, TagesLand } from './reisetage.js';

/** 'YYYY-MM-DD' → 'TT.MM.JJJJ'. */
export function datumDe(datum: string): string {
  return `${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)}`;
}

/**
 * Ordnet die vom Client gelieferten Tage per Datum den serverseitig gebildeten Tagen zu
 * (Typ und Reihenfolge bestimmt der Server, vom Client kommen nur Mahlzeiten und Landangaben).
 * null = die Datumsmenge passt nicht (fehlender, zusätzlicher oder doppelter Tag).
 */
export function ordneTageZu<T extends { datum: string }>(
  sollTage: readonly ReisetagSoll[],
  clientTage: readonly T[],
): Array<{ soll: ReisetagSoll; client: T }> | null {
  const jeDatum = new Map(clientTage.map(t => [t.datum, t]));
  if (jeDatum.size !== clientTage.length || jeDatum.size !== sollTage.length) return null;
  const paare: Array<{ soll: ReisetagSoll; client: T }> = [];
  for (const soll of sollTage) {
    const client = jeDatum.get(soll.datum);
    if (!client) return null;
    paare.push({ soll, client });
  }
  return paare;
}

/** Anzeigename des maßgebenden Landes eines Tags (Inland, Seetag, Staat aus Freitext oder Land-Key). */
export function landBezeichnung(land: TagesLand): string {
  if (land.landKey === LAND_INLAND) return 'Inland';
  if (land.landKey === LAND_SEETAG) return 'Seetag';
  if (land.landKey === LAND_ANDERES) return land.landFreitext ?? 'Staat nicht in der Liste';
  return land.landKey;
}

/** Länderfolge der Reise ohne direkte Wiederholung, z. B. ['Belgien', 'Niederlande', 'Luxemburg']. */
export function reiselandFolge(laender: readonly TagesLand[]): string[] {
  const folge: string[] = [];
  for (const land of laender) {
    const name = landBezeichnung(land);
    if (folge[folge.length - 1] !== name) folge.push(name);
  }
  return folge;
}

/** Zusammenhängende Tage als Zeitraum: '01.07.2026', '30.12.–31.12.2026', '31.12.2026–01.01.2027'. */
function zeitraumDe(von: string, bis: string): string {
  if (von === bis) return datumDe(von);
  return `${von.slice(0, 4) === bis.slice(0, 4) ? datumDe(von).slice(0, 6) : datumDe(von)}–${datumDe(bis)}`;
}

/**
 * Fußnote zu den angewandten Pauschalen (PDF und Mail), z. B. „Pauschalen: BMF-Schreiben vom
 * 05.12.2025; Inland: § 9 Abs. 4a EStG“. Auslandsquellen ohne Wiederholung in der Reihenfolge der
 * Tage; galten mehrere (Jahreswechsel, Korrekturstand), steht bei jeder, an welchen Tagen — so
 * zeigt auch der archivierte Beleg, welcher Stand an welchem Tag angewandt wurde. Reine
 * Inlandsreise: nur die Inlandsquelle. `tage` in der Reihenfolge der (lückenlosen) Reisetage.
 */
export function quellenVermerk(tage: ReadonlyArray<{ datum: string; landKey: string; satzQuelle: string }>): string {
  const ausland = tage.map((t, i) => ({ ...t, i })).filter(t => t.landKey !== LAND_INLAND);
  const auslandQuellen = [...new Set(ausland.map(t => t.satzQuelle))];
  const zeitraeume = (quelle: string) => {
    const bereiche: Array<[von: string, bis: string]> = [];
    let vorher = -2;
    for (const t of ausland) {
      if (t.satzQuelle !== quelle) continue;
      if (t.i === vorher + 1) bereiche[bereiche.length - 1][1] = t.datum;
      else bereiche.push([t.datum, t.datum]);
      vorher = t.i;
    }
    return bereiche.map(([von, bis]) => zeitraumDe(von, bis)).join(', ');
  };
  const auslandText = auslandQuellen.length > 1
    ? auslandQuellen.map(q => `${q} (${zeitraeume(q)})`).join('; ')
    : auslandQuellen.join('');
  const inland = [...new Set(tage.filter(t => t.landKey === LAND_INLAND).map(t => t.satzQuelle))].join(', ');
  const teile = [auslandText, inland && auslandText ? `Inland: ${inland}` : inland].filter(Boolean);
  return `Pauschalen: ${teile.join('; ')}`;
}

/** Gemeinsamer Reisetag mit einer früheren Reisekostenabrechnung derselben Person. */
export interface Ueberschneidung {
  belegNr: string;
  /** 'YYYY-MM-DD' */
  datum: string;
  /** Der Tag ist in beiden Abrechnungen eine eintägige Reise (ohne Übernachtung). */
  beideEintaegig: boolean;
}

/**
 * Prüfvermerke zu Überschneidungen, je früherem Beleg (Tage aufsteigend) — das Portal verrechnet
 * nicht automatisch, sondern weist die Buchhaltung darauf hin:
 * - zwei eintägige Reisen am selben Tag: Abwesenheitszeiten zusammenrechnen, höchstens eine
 *   Pauschale (BMF 25.11.2020 Rz. 47) — je Reise unter 8 h kann zusammen ein Anspruch entstehen;
 * - sonst (z. B. Rückreisetag + neue Reise): nur die höhere Pauschale; gestellte Mahlzeiten BEIDER
 *   Abrechnungen kürzen vom 24-h-Satz des Landes mit der höheren Pauschale (BMF 05.12.2025, Beispiel).
 */
export function ueberschneidungsVermerke(treffer: readonly Ueberschneidung[]): string[] {
  const gruppen = new Map<string, { belegNr: string; beideEintaegig: boolean; tage: Set<string> }>();
  for (const t of treffer) {
    const schluessel = `${t.belegNr}|${t.beideEintaegig}`;
    const gruppe = gruppen.get(schluessel) ?? { belegNr: t.belegNr, beideEintaegig: t.beideEintaegig, tage: new Set<string>() };
    gruppe.tage.add(t.datum);
    gruppen.set(schluessel, gruppe);
  }
  return [...gruppen.keys()].sort().map(schluessel => {
    const { belegNr, beideEintaegig, tage: tageSet } = gruppen.get(schluessel)!;
    const tage = [...tageSet].sort().map(datumDe);
    const liste = tage.length === 1 ? tage[0] : `${tage.slice(0, -1).join(', ')} und ${tage[tage.length - 1]}`;
    if (beideEintaegig) {
      return `Überschneidung mit ${belegNr} am ${liste}: zwei eintägige Reisen am selben Tag – Abwesenheitszeiten zusammenrechnen, höchstens eine Pauschale für den Tag (BMF 25.11.2020 Rz. 47). Bitte prüfen.`;
    }
    const regel = tage.length === 1
      ? 'für diesen Tag ist nur die höhere Pauschale zulässig'
      : 'für diese Tage ist jeweils nur die höhere Pauschale zulässig';
    return `Überschneidung mit ${belegNr} am ${liste}: ${regel}; gestellte Mahlzeiten beider Abrechnungen sind vom 24-h-Satz des Landes mit der höheren Pauschale zu kürzen (BMF 05.12.2025). Bitte prüfen.`;
  });
}
