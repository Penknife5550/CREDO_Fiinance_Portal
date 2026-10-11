/**
 * Reisekosten (Release 1b/1c): Zuordnung der Client-Tagesangaben, Anzeige des Reiselands,
 * Quellen der angewandten Pauschalen und Prüfvermerke bei Überschneidungen — reine, testbare
 * Funktionen für Route, PDF und Mailtext. Dazu die VMA-Rechenkette der Route
 * (bereiteReisekostenVor → Satzstände laden → berechneReisekostenVma), damit Tests und
 * Paritätstest genau den Serverpfad prüfen.
 * Die steuerliche Logik (Tagesbildung, maßgebendes Land, Satz) liegt in reisetage.ts.
 */

import { FALLBACK_LAND_KEY, LAND_ANDERES, LAND_INLAND, LAND_SEETAG, RESERVIERTE_LAND_KEYS } from './constants.js';
import { rundeAufCent } from './kmSaetze.js';
import {
  bestimmeTageslaender, bildeReisetage, brauchtSatz, pruefeLandFreitext, ReisetageFehler, satzLandKey, waehleTagesSatz,
  type AngewandterSatz, type ReisetagSoll, type Satzstand, type TagesLand,
} from './reisetage.js';
import { vmaTag, type VmaTagErgebnis } from './vma.js';

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

/**
 * Steuer-, Format- und Trennzeichen → Leerzeichen: \p{Cc} (CR, LF, TAB …), \p{Cf} (u. a. Bidi-Overrides
 * wie U+202E, Null-Breiten-Zeichen), \p{Zl}/\p{Zp} (U+2028/U+2029, in manchen Mail-Clients ein
 * Zeilenumbruch). Für Freitexte aus dem öffentlichen Formular, die in den Mailtext an das DMS gelangen —
 * sonst ließen sich dort eigene Zeilen einschleusen (z. B. eine gefälschte Zeile „Prüfvermerk:“) oder
 * Text umdrehen. Zod-Transform der Reisekosten-Route; dieselbe Zeichenklasse prüft satzstaende.ts.
 */
export function ohneSteuerzeichen(text: string): string {
  return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ');
}

// ── VMA-Rechenkette der Reisekosten-Route ─────────────────────────────────────

/** Reisetag, wie ihn der Client sendet: vom Client zählen nur Datum, Mahlzeiten und Landangaben. */
export interface ClientReisetag {
  datum: string;
  fruehstueckGestellt: boolean;
  mittagGestellt: boolean;
  abendGestellt: boolean;
  land24uhr?: string | null;
  letzterTaetigkeitsort?: string | null;
  landFreitext?: string | null;
}

/** VMA-relevante Angaben der Einreichung (Zod-geprüfter Body); Client-Beträge werden nicht gelesen. */
export interface ReisekostenAngaben {
  abfahrtZeit: string;
  rueckkehrZeit: string;
  /** Fehlt das Feld (undefined), ist es ein altes, noch geöffnetes Formular ohne Übernachtungsfrage. */
  uebernachtung?: boolean | null;
  /** Hauptland; leer/null = Inlandsreise. */
  land?: string | null;
  reisetage: readonly ClientReisetag[];
}

/** Server-Reisetag (Datum/Typ vom Server) mit Mahlzeiten und Roh-Landangaben des Clients. */
export interface ReisetagMitAngaben extends ReisetagSoll {
  fruehstueckGestellt: boolean;
  mittagGestellt: boolean;
  abendGestellt: boolean;
  land24uhr: string | null;
  letzterTaetigkeitsort: string | null;
  landFreitext: string | null;
}

export interface ReisekostenVorbereitung {
  /** Hauptland; null = Inlandsreise. */
  hauptland: string | null;
  tage: ReisetagMitAngaben[];
  /** Maßgebendes Land je Tag (Reihenfolge wie `tage`). */
  laender: TagesLand[];
  /** Land-Keys, deren Satzstände die Route laden muss — immer samt Luxemburg; leer = reine Inlandsreise. */
  satzKeys: string[];
  /** Satzstände ALLER Länder laden: ein Freitext („Staat nicht in der Liste“) wird gegen die ganze Liste geprüft. */
  alleLaender: boolean;
}

/** Gespeicherter Reisetag: Angaben + maßgebendes Land + angewandter Satz (null = kein Anspruch) + Beträge. */
export interface ServerReisetag extends ReisetagMitAngaben, VmaTagErgebnis {
  landKey: string;
  /** Freitext des maßgebenden Landes (nur bei ANDERES, am Abreisetag ggf. vom Vortag), sonst null. */
  landFreitext: string | null;
  satz: AngewandterSatz | null;
}

export interface ReisekostenVma {
  tage: ServerReisetag[];
  vmaBrutto: number;
  vmaKuerzung: number;
  vmaNetto: number;
  /** Fußnote „Pauschalen: …“ für PDF und Mail (quellenVermerk). */
  pauschalenQuellen: string;
}

/** Quellenvermerk eines Tags ohne Anspruch (es gibt keinen Satz und keine Quelle; gespeichert wird NULL). */
export const QUELLE_KEIN_ANSPRUCH = 'kein Anspruch (bis 8 h)';

/** Angegebene Länder (Roh-Angaben, ohne reservierte Werte) — auch nicht maßgebende werden gespeichert. */
function angegebeneLaender(tage: readonly ReisetagMitAngaben[]): string[] {
  return tage
    .flatMap(t => [t.land24uhr, t.letzterTaetigkeitsort])
    .filter((k): k is string => !!k && !RESERVIERTE_LAND_KEYS.includes(k));
}

/**
 * Teil 1 der Rechenkette (vor dem Laden der Satzstände): Reisetage serverseitig aus Abfahrt/Rückkehr
 * (+ Übernachtung) bilden, die Client-Tage per Datum zuordnen (Mahlzeiten + Landangaben; Anzahl,
 * Datum und Typ bestimmt der Server), maßgebendes Land je Tag (§ 9 Abs. 4a S. 5 EStG) und die
 * benötigten Satz-Keys — Hauptland, alle Angaben und die Satz-Keys der Tage, IMMER samt Luxemburg
 * (sein Stand zeigt, ob das Reisejahr hinterlegt ist; passende Meldung).
 * Wirft ReisetageFehler (Route: 400), u. a. bei einem alten Formular ohne Übernachtungsangabe
 * und wenn die Client-Tage nicht zum Zeitraum passen.
 */
export function bereiteReisekostenVor(angaben: ReisekostenAngaben): ReisekostenVorbereitung {
  const hauptland = angaben.land || null;

  let sollTage: ReisetagSoll[];
  try {
    sollTage = bildeReisetage(angaben.abfahrtZeit, angaben.rueckkehrZeit, angaben.uebernachtung ?? null);
  } catch (err) {
    // Ein noch geöffnetes altes Formular kennt die Übernachtungsfrage nicht (sendet das Feld
    // gar nicht, das neue sendet immer null oder true/false) → Hinweis auf Neuladen.
    if (err instanceof ReisetageFehler && err.code === 'UEBERNACHTUNG_FEHLT' && angaben.uebernachtung === undefined) {
      throw new ReisetageFehler(
        'UEBERNACHTUNG_FEHLT',
        'Das Formular wurde aktualisiert. Bitte laden Sie die Seite neu und geben Sie an, ob Sie auswärts übernachtet haben.',
      );
    }
    throw err;
  }
  const paare = ordneTageZu(sollTage, angaben.reisetage);
  if (!paare) {
    throw new ReisetageFehler(
      'TAGE_PASSEN_NICHT',
      'Die Reisetage passen nicht zum Reisezeitraum. Bitte laden Sie die Seite neu und prüfen Sie Ihre Angaben.',
    );
  }
  const tage = paare.map(({ soll, client }): ReisetagMitAngaben => ({
    ...soll,
    fruehstueckGestellt: client.fruehstueckGestellt,
    mittagGestellt: client.mittagGestellt,
    abendGestellt: client.abendGestellt,
    land24uhr: client.land24uhr || null,
    letzterTaetigkeitsort: client.letzterTaetigkeitsort || null,
    landFreitext: client.landFreitext ?? null,
  }));

  // Alter Client ohne Tagesfelder → Hauptland bzw. Inland.
  const laender = bestimmeTageslaender(tage, hauptland);

  const auslandsKeys = [hauptland, ...angegebeneLaender(tage), ...laender.map(l => satzLandKey(l.landKey))]
    .filter((k): k is string => k !== null);
  return {
    hauptland,
    tage,
    laender,
    satzKeys: auslandsKeys.length > 0 ? [...new Set([...auslandsKeys, FALLBACK_LAND_KEY])] : [],
    alleLaender: laender.some((l, i) => l.landKey === LAND_ANDERES && !!l.landFreitext && brauchtSatz(tage[i])),
  };
}

/**
 * Teil 2 der Rechenkette (nach dem Laden der Satzstände zu `satzKeys` bzw. aller bei `alleLaender`):
 * jede Landangabe muss ein bekannter Land-Key sein (auch nicht maßgebende — sie werden gespeichert);
 * je Tag mit Anspruch (brauchtSatz) Freitextprüfung (pruefeLandFreitext) und Satz des Satzstands zum
 * Datum des Tags (waehleTagesSatz), VMA aus Typ + Mahlzeiten + Satz (vmaTag) — die Client-Beträge
 * zählen nie (Audit #2). Tage ohne Anspruch: kein Satz, 0,00. Dazu Summen und Quellenvermerk.
 * Wirft ReisetageFehler (Route: 400).
 */
export function berechneReisekostenVma(vorbereitung: ReisekostenVorbereitung, staende: readonly Satzstand[]): ReisekostenVma {
  const { hauptland, tage, laender } = vorbereitung;
  const bekannteLaender = new Set(staende.map(s => s.landKey));
  const unbekanntesLand = [hauptland, ...angegebeneLaender(tage)].find(k => k && !bekannteLaender.has(k));
  if (unbekanntesLand) throw new ReisetageFehler('UNBEKANNTES_LAND', `Unbekanntes Reiseland: ${unbekanntesLand}`);

  const serverTage = tage.map((t, i): ServerReisetag => {
    const land = { landKey: laender[i].landKey, landFreitext: laender[i].landFreitext };
    if (!brauchtSatz(t)) return { ...t, ...land, satz: null, vmaBrutto: 0, vmaKuerzung: 0, vmaNetto: 0 };
    pruefeLandFreitext(laender[i], t.datum, staende);
    const satz = waehleTagesSatz(laender[i].landKey, t.datum, staende);
    return {
      ...t,
      ...land,
      satz,
      ...vmaTag(
        {
          typ: t.typ,
          fruehstueckGestellt: t.fruehstueckGestellt,
          mittagGestellt: t.mittagGestellt,
          abendGestellt: t.abendGestellt,
          eintaegigUeber8h: t.eintaegigUeber8h,
        },
        satz,
      ),
    };
  });

  return {
    tage: serverTage,
    vmaBrutto: rundeAufCent(serverTage.reduce((s, t) => s + t.vmaBrutto, 0)),
    vmaKuerzung: rundeAufCent(serverTage.reduce((s, t) => s + t.vmaKuerzung, 0)),
    vmaNetto: rundeAufCent(serverTage.reduce((s, t) => s + t.vmaNetto, 0)),
    pauschalenQuellen: quellenVermerk(
      serverTage.map(t => ({ datum: t.datum, landKey: t.landKey, satzQuelle: t.satz?.quelle ?? QUELLE_KEIN_ANSPRUCH })),
    ),
  };
}
