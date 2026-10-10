/**
 * Reisetage und maßgebendes Land je Reisetag — Frontend-Zwilling von
 * backend/src/lib/reisetage.ts (Release 1b/1c). Der Server rechnet autoritativ; die Vorschau
 * im Wizard MUSS identisch rechnen (Parität: tests/vma-paritaet.test.ts, unter TZ=UTC und
 * TZ=Europe/Berlin).
 *
 * 1. bildeReisetage: Tagesbildung aus Abfahrt/Rückkehr (Mitternachtsregel).
 * 2. bestimmeTageslaender: maßgebendes Land je Tag aus den Landangaben.
 * 3. waehleTagesSatz: Pauschalen-Paar + Quelle zum maßgebenden Land und Datum des Tags
 *    (Satzstand nach Reisedatum, waehleSatzstand).
 * Darunter (nur Frontend): Formular-Helfer und die Vorschau aus den Rohdaten.
 *
 * Rechtsgrundlage: § 9 Abs. 4a EStG, BMF-Schreiben vom 05.12.2025, R 9.6 Abs. 3 LStR.
 */

import { berechneVmaTagMitSatz, INLAND_QUELLE, INLAND_SATZ, type VmaSatz } from './vma';
import type { Reisetag, ReisetagEingabe } from './types';

type ReisetagTyp = ReisetagEingabe['typ'];

// Reservierte Werte der Länderauswahl (wie backend/src/lib/constants.ts).
export const LAND_INLAND = 'INLAND';
export const LAND_ANDERES = 'ANDERES'; // Staat nicht in der Liste → Satz Luxemburg, Freitext Pflicht
export const LAND_SEETAG = 'SEETAG';   // ganzer Tag an Bord (nur GANZTAG) → Satz Luxemburg
export const RESERVIERTE_LAND_KEYS: readonly string[] = [LAND_INLAND, LAND_ANDERES, LAND_SEETAG];

// Gesetzlicher Ersatzsatz für nicht aufgeführte Staaten (BMF-Schreiben vom 05.12.2025)
// und Seetage (R 9.6 Abs. 3 LStR).
export const FALLBACK_LAND_KEY = 'Luxemburg';

export type ReisetageFehlerCode =
  | 'FORMAT'
  | 'RUECKKEHR_NICHT_NACH_ABFAHRT'
  | 'ZU_VIELE_TAGE'
  | 'UEBERNACHTUNG_FEHLT'
  | 'AUSLANDSTAG_BEI_INLANDSREISE'
  | 'FREITEXT_FEHLT'
  | 'SEETAG_NUR_GANZTAG'
  | 'UNGUELTIGE_LANDANGABE'
  | 'UNBEKANNTES_LAND'
  | 'SATZSTAND_FEHLT'
  | 'LAND_OHNE_SATZSTAND';

/** Fachlicher Fehler der Tagesbildung/Landbestimmung mit deutscher Meldung (wie die 400 des Servers). */
export class ReisetageFehler extends Error {
  readonly code: ReisetageFehlerCode;

  constructor(code: ReisetageFehlerCode, message: string) {
    super(message);
    this.name = 'ReisetageFehler';
    this.code = code;
  }
}

// ── 1. Tagesbildung (zeitzonenunabhängig) ─────────────────────────────────────
// Abfahrt/Rückkehr sind datetime-local-Werte 'YYYY-MM-DDTHH:mm' (Wanduhrzeit). Gerechnet
// wird nur mit den String-Teilen (Date.UTC) — nie mit Ortszeit-Date-Objekten, sonst hängt
// das Ergebnis von der Zeitzone des Browsers ab (Zeitumstellung, Abfahrt vor 02:00 Uhr).
// Bewusste Vereinfachung: Auch die Dauer (8-h-/24-h-Grenze, größerer Zeitanteil) ist die
// Differenz der Wanduhrzeiten. In den beiden Nächten der Zeitumstellung (letzter Sonntag im
// März/Oktober) weicht sie um eine Stunde von der tatsächlichen Abwesenheit ab.

const ZEITPUNKT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const MINUTEN_8H = 480;
const MINUTEN_24H = 1440;
const MAX_REISETAGE = 60; // wie der Zod-Deckel der Server-Route

/** Wanduhrzeit in Minuten (Date.UTC aus den String-Teilen); null = kein gültiger datetime-local-Wert. */
function wanduhrMinuten(zeitpunkt: string): number | null {
  const m = ZEITPUNKT.exec(zeitpunkt);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Date.UTC rechnet Überläufe um (30.02., 24:00) — nur echte Kalenderzeitpunkte zulassen.
  return new Date(ms).toISOString().slice(0, 16) === m[0] ? ms / 60000 : null;
}

/** 'YYYY-MM-DD' plus n Kalendertage (reine UTC-Arithmetik). */
function plusTage(datum: string, n: number): string {
  const [j, m, t] = datum.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, t + n)).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 'TT.MM.JJJJ' (für Meldungen). */
function datumDe(datum: string): string {
  return `${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)}`;
}

export interface ReisetagSoll {
  datum: string;
  typ: ReisetagTyp;
  /** Nur für EINTAEGIG relevant: Gesamtabwesenheit strikt länger als 8 h. */
  eintaegigUeber8h: boolean;
}

/**
 * Reisetage zum Reisezeitraum (§ 9 Abs. 4a S. 3 EStG):
 * - gleicher Kalendertag → EINTAEGIG (Anspruch bei > 8 h);
 * - mehrere Kalendertage → ANREISE / GANZTAG … / ABREISE (An-/Abreisetag setzt eine
 *   auswärtige Übernachtung voraus, S. 3 Nr. 2);
 * - genau zwei Kalendertage OHNE Übernachtung (`uebernachtung === false`) → genau EIN Tag
 *   auf dem Kalendertag mit dem größeren Zeitanteil (Gleichstand: Abreisetag):
 *   unter 24 h EINTAEGIG, Anspruch bei > 8 h Gesamtdauer (S. 3 Nr. 3 Hs. 2);
 *   ab 24 h GANZTAG mit dem 24-h-Satz (BMF 25.11.2020 Bsp. 31: 28 € nur, wenn „die gesamte
 *   Tätigkeit über Nacht … 24 Stunden erreicht“ — also einmal, nicht An- + Abreisetag).
 * `uebernachtung` ist nur unter 24 h über zwei Kalendertage Pflicht (null → Fehler). Ab 24 h
 * gilt null als „mit Übernachtung“ (alter Client); ab drei Kalendertagen zählt die Angabe nicht.
 * Wirft ReisetageFehler: Format, Rückkehr ≤ Abfahrt, mehr als 60 Kalendertage,
 * fehlende Übernachtungsangabe.
 */
export function bildeReisetage(abfahrt: string, rueckkehr: string, uebernachtung: boolean | null): ReisetagSoll[] {
  const start = wanduhrMinuten(abfahrt);
  const ende = wanduhrMinuten(rueckkehr);
  if (start === null || ende === null) {
    throw new ReisetageFehler('FORMAT', 'Abfahrt und Rückkehr müssen als gültiges Datum mit Uhrzeit angegeben werden.');
  }
  if (ende <= start) {
    throw new ReisetageFehler('RUECKKEHR_NICHT_NACH_ABFAHRT', 'Die Rückkehr muss nach der Abfahrt liegen.');
  }

  const dauer = ende - start;
  const startTag = abfahrt.slice(0, 10);
  const endeTag = rueckkehr.slice(0, 10);
  if (startTag === endeTag) {
    return [{ datum: startTag, typ: 'EINTAEGIG', eintaegigUeber8h: dauer > MINUTEN_8H }];
  }
  if (plusTage(startTag, MAX_REISETAGE - 1) < endeTag) {
    throw new ReisetageFehler('ZU_VIELE_TAGE', `Der Reisezeitraum darf höchstens ${MAX_REISETAGE} Kalendertage umfassen.`);
  }

  // Unter 24 h über Mitternacht (dann genau zwei Kalendertage): Übernachtung ist Pflichtangabe.
  if (dauer < MINUTEN_24H && uebernachtung !== true && uebernachtung !== false) {
    throw new ReisetageFehler(
      'UEBERNACHTUNG_FEHLT',
      'Bitte geben Sie an, ob Sie auswärts übernachtet haben (Reise unter 24 Stunden über zwei Kalendertage).',
    );
  }
  // Genau zwei Kalendertage ohne Übernachtung: nur EIN Tag (kein An-/Abreisetag ohne Übernachtung).
  if (uebernachtung === false && plusTage(startTag, 1) === endeTag) {
    const minutenAbreisetag = Number(rueckkehr.slice(11, 13)) * 60 + Number(rueckkehr.slice(14, 16));
    const datum = dauer - minutenAbreisetag > minutenAbreisetag ? startTag : endeTag;
    return dauer < MINUTEN_24H
      ? [{ datum, typ: 'EINTAEGIG', eintaegigUeber8h: dauer > MINUTEN_8H }]
      : [{ datum, typ: 'GANZTAG', eintaegigUeber8h: false }];
  }

  const tage: ReisetagSoll[] = [];
  for (let datum = startTag; datum <= endeTag; datum = plusTage(datum, 1)) {
    const typ: ReisetagTyp = datum === startTag ? 'ANREISE' : datum === endeTag ? 'ABREISE' : 'GANZTAG';
    tage.push({ datum, typ, eintaegigUeber8h: false });
  }
  return tage;
}

// ── 2. Maßgebendes Land je Reisetag ───────────────────────────────────────────

/** Landangaben eines Reisetags. Leere Angabe = keine Angabe. */
export interface TagesLandAngabe {
  datum: string;
  typ: ReisetagTyp;
  /** Anreise-/Zwischentag: Land des Ortes, der vor 24 Uhr Ortszeit erreicht wird. */
  land24uhr?: string | null;
  /**
   * Land des letzten Tätigkeitsorts IM AUSLAND (§ 9 Abs. 4a S. 5 Hs. 2 EStG) — an diesem Tag,
   * am Abreisetag auch vom Vortag; 'INLAND' = keine berufliche Tätigkeit im Ausland.
   */
  letzterTaetigkeitsort?: string | null;
  /** Pflicht, wenn eine Angabe ANDERES lautet: Name des nicht aufgeführten Staats. */
  landFreitext?: string | null;
}

export interface TagesLand {
  /** 'INLAND', 'ANDERES', 'SEETAG' oder Land-Key aus pauschalen_ausland. */
  landKey: string;
  /** Nur bei ANDERES: Name des Staats (am Abreisetag ggf. vom Vortag übernommen), sonst null. */
  landFreitext: string | null;
}

/** Wie die Admin-Sperre: reserviert ohne Groß-/Kleinschreibung und Leerzeichen. */
function istReserviert(wert: string): boolean {
  return RESERVIERTE_LAND_KEYS.includes(wert.trim().toUpperCase());
}

/** Leere Angabe → null; Schreibvarianten reservierter Werte und Seetag außerhalb GANZTAG → Fehler. */
function pruefeAngabe(wert: string | null | undefined, tag: TagesLandAngabe): string | null {
  if (!wert) return null;
  if (istReserviert(wert) && !RESERVIERTE_LAND_KEYS.includes(wert)) {
    throw new ReisetageFehler('UNGUELTIGE_LANDANGABE', `Ungültige Landangabe: ${wert}`);
  }
  if (wert === LAND_SEETAG && tag.typ !== 'GANZTAG') {
    throw new ReisetageFehler(
      'SEETAG_NUR_GANZTAG',
      `Am ${datumDe(tag.datum)} ist „Seetag“ nicht möglich: nur für einen ganzen Tag an Bord. Für den Ein- oder Ausschiffungstag wählen Sie bitte das Land des Hafens.`,
    );
  }
  return wert;
}

/**
 * Maßgebendes Land je Reisetag (§ 9 Abs. 4a S. 5 EStG, BMF 05.12.2025), Reihenfolge wie `tage`:
 * - Inlandsreise (kein Hauptland): alle Tage INLAND; eine Auslandsangabe ist ein Fehler.
 * - Anreise-/Zwischentag: `land24uhr`; liegt er im Inland und gab es an diesem Tag einen
 *   Tätigkeitsort im Ausland, gilt dessen Land (S. 5 Hs. 2) — auch wenn danach noch eine
 *   Tätigkeit im Inland folgte.
 * - Abreisetag und eintägige Reise: letzter Tätigkeitsort im Ausland, `letzterTaetigkeitsort`
 *   (BMF 05.12.2025 S. 1); INLAND nur, wenn es keinen Tätigkeitsort im Ausland gab.
 * - Ohne Angabe: Hauptland; am Abreisetag das maßgebende Land des Vortags, falls dieses
 *   Ausland ist (ein Seetag zählt nicht — ausgeschifft wird im Hafenland), sonst Hauptland.
 * Wirft ReisetageFehler: Auslandstag bei Inlandsreise, ANDERES ohne Freitext, SEETAG
 * außerhalb GANZTAG, Schreibvariante eines reservierten Werts bzw. reservierter Wert als Hauptland.
 * Ob ein Land-Key existiert, prüft erst waehleTagesSatz.
 */
export function bestimmeTageslaender(tage: readonly TagesLandAngabe[], hauptland: string | null): TagesLand[] {
  if (hauptland && istReserviert(hauptland)) {
    throw new ReisetageFehler('UNGUELTIGE_LANDANGABE', `Ungültiges Reiseland: ${hauptland}`);
  }

  const ergebnis: TagesLand[] = [];
  for (const tag of tage) {
    const ort24 = pruefeAngabe(tag.land24uhr, tag);
    const taetigkeit = pruefeAngabe(tag.letzterTaetigkeitsort, tag);

    if (!hauptland) {
      if ((ort24 && ort24 !== LAND_INLAND) || (taetigkeit && taetigkeit !== LAND_INLAND)) {
        throw new ReisetageFehler(
          'AUSLANDSTAG_BEI_INLANDSREISE',
          `Bei einer Inlandsreise kann kein Reisetag im Ausland liegen (${datumDe(tag.datum)}). Bitte wählen Sie „Ausland“ und ein Reiseland.`,
        );
      }
      ergebnis.push({ landKey: LAND_INLAND, landFreitext: null });
      continue;
    }

    const freitext = tag.landFreitext?.trim() || null;
    if ((ort24 === LAND_ANDERES || taetigkeit === LAND_ANDERES) && !freitext) {
      throw new ReisetageFehler(
        'FREITEXT_FEHLT',
        `Bitte geben Sie für den ${datumDe(tag.datum)} an, in welchem Staat Sie waren (Staat nicht in der Liste).`,
      );
    }

    let land: string | null;
    if (tag.typ === 'ABREISE' || tag.typ === 'EINTAEGIG') {
      land = taetigkeit;
    } else {
      land = ort24 === LAND_INLAND && taetigkeit && taetigkeit !== LAND_INLAND ? taetigkeit : ort24;
    }

    if (land) {
      ergebnis.push({ landKey: land, landFreitext: land === LAND_ANDERES ? freitext : null });
      continue;
    }
    const vortag = ergebnis.length > 0 ? ergebnis[ergebnis.length - 1] : null;
    if (tag.typ === 'ABREISE' && vortag && vortag.landKey !== LAND_INLAND && vortag.landKey !== LAND_SEETAG) {
      ergebnis.push({ ...vortag });
    } else {
      ergebnis.push({ landKey: hauptland, landFreitext: null });
    }
  }
  return ergebnis;
}

// ── 3. Satzauswahl ────────────────────────────────────────────────────────────

/** Satzstand eines Landes: ein Eintrag aus GET /api/pauschalen/ausland (Schlüssel landKey + gueltigVon). */
export interface Satzstand extends VmaSatz {
  landKey: string;
  /** Erster Gültigkeitstag 'YYYY-MM-DD' (neuer Jahresstand: 'JJJJ-01-01'). */
  gueltigVon: string;
  /** Rechtsquelle, z. B. 'BMF-Schreiben vom 05.12.2025'. */
  quelle: string;
}

/** Am Reisetag angewandter Satz samt Quelle. */
export interface AngewandterSatz extends VmaSatz {
  quelle: string;
}

/**
 * Land-Key, dessen Satz für ein maßgebendes Land gilt: null = Inland (gesetzlicher Satz),
 * ANDERES und SEETAG → Luxemburg (BMF 05.12.2025; R 9.6 Abs. 3 LStR), sonst das Land selbst.
 */
export function satzLandKey(landKey: string): string | null {
  if (landKey === LAND_INLAND) return null;
  return landKey === LAND_ANDERES || landKey === LAND_SEETAG ? FALLBACK_LAND_KEY : landKey;
}

/**
 * Am Tag `datum` ('YYYY-MM-DD') gültiger Satzstand: der mit dem größten `gueltigVon` ≤ datum
 * IM SELBEN KALENDERJAHR wie `datum` — ein Stand des Vorjahres gilt nie weiter. Ein Stand
 * mitten im Jahr (Korrektur) gilt ab seinem Datum. null = kein Stand.
 * `staende` = Stände EINES Landes (Reihenfolge beliebig).
 */
export function waehleSatzstand<T extends { gueltigVon: string }>(staende: readonly T[], datum: string): T | null {
  const jahresanfang = `${datum.slice(0, 4)}-01-01`;
  let treffer: T | null = null;
  for (const stand of staende) {
    if (stand.gueltigVon >= jahresanfang && stand.gueltigVon <= datum && (!treffer || stand.gueltigVon > treffer.gueltigVon)) {
      treffer = stand;
    }
  }
  return treffer;
}

/**
 * Ist am Tag `datum` ein Jahresstand hinterlegt? Maßstab ist Luxemburg: Der gesetzliche Ersatzsatz
 * steht in jedem BMF-Schreiben, und das AdminCenter lässt den ersten Luxemburg-Stand eines Jahres
 * nicht löschen, solange andere Länder Stände in diesem Jahr haben.
 */
function jahresstandVorhanden(staende: ReadonlyArray<{ landKey: string; gueltigVon: string }>, datum: string): boolean {
  return waehleSatzstand(staende.filter(s => s.landKey === FALLBACK_LAND_KEY), datum) !== null;
}

/**
 * Fehler, wenn für `key` (Land-Key; ANDERES/SEETAG schon auf Luxemburg abgebildet) am Tag `datum`
 * kein Satzstand gilt — mit der Handlungsanweisung, die zum Fall passt (wie der Server):
 * - Jahresstand vorhanden, nur dieser Key nicht: Stadt → Staat (übrige Orte), Staat →
 *   „Staat nicht in der Liste“ (Satz Luxemburg);
 * - Reisejahr vor dem ersten Luxemburg-Stand (verspätete Abrechnung): Buchhaltung;
 * - sonst fehlt der Jahresstand noch: später einreichen.
 */
export function fehlerOhneSatzstand(key: string, datum: string, staende: readonly Satzstand[]): ReisetageFehler {
  const jahr = datum.slice(0, 4);
  if (jahresstandVorhanden(staende, datum)) {
    const [staat, stadt] = key.split(' — ');
    return new ReisetageFehler(
      'LAND_OHNE_SATZSTAND',
      stadt
        ? `Für „${key}“ ist für ${jahr} keine eigene Auslandspauschale hinterlegt. Bitte wählen Sie „${staat}“ (übrige Orte) oder wenden Sie sich an die Buchhaltung.`
        : `Für „${key}“ ist für ${jahr} keine Auslandspauschale hinterlegt. Bitte wählen Sie „Staat nicht in der Liste“ (Satz Luxemburg) oder wenden Sie sich an die Buchhaltung.`,
    );
  }
  const ersterStand = staende
    .filter(s => s.landKey === FALLBACK_LAND_KEY)
    .reduce<string | null>((min, s) => (min === null || s.gueltigVon < min ? s.gueltigVon : min), null);
  if (ersterStand !== null && jahr < ersterStand.slice(0, 4)) {
    return new ReisetageFehler(
      'SATZSTAND_FEHLT',
      `Für Reisetage im Jahr ${jahr} sind keine Auslandspauschalen hinterlegt. Bitte wenden Sie sich an die Buchhaltung.`,
    );
  }
  return new ReisetageFehler(
    'SATZSTAND_FEHLT',
    `Die Auslandspauschalen für ${jahr} sind noch nicht hinterlegt. Bitte reichen Sie die Abrechnung später ein oder wenden Sie sich an die Buchhaltung.`,
  );
}

/**
 * Pauschalen-Paar + Quelle zum maßgebenden Land am Reisetag `datum` ('YYYY-MM-DD').
 * Inland: gesetzlicher Satz 28/14 € (§ 9 Abs. 4a EStG), unabhängig vom Jahr. Ausland (auch
 * ANDERES/SEETAG → Luxemburg): Satzstand nach waehleSatzstand; `staende` = Satzstände
 * (GET /api/pauschalen/ausland, samt Luxemburg als Maßstab für den Jahresstand).
 * Wirft ReisetageFehler: UNBEKANNTES_LAND (kein Stand des Landes), LAND_OHNE_SATZSTAND (Jahresstand
 * vorhanden, nur dieses Land nicht), SATZSTAND_FEHLT (kein Jahresstand für das Reisejahr).
 */
export function waehleTagesSatz(landKey: string, datum: string, staende: readonly Satzstand[]): AngewandterSatz {
  const key = satzLandKey(landKey);
  if (key === null) return { ...INLAND_SATZ, quelle: INLAND_QUELLE };
  const staendeLand = staende.filter(s => s.landKey === key);
  if (staendeLand.length === 0) throw new ReisetageFehler('UNBEKANNTES_LAND', `Unbekanntes Reiseland: ${key}`);
  const stand = waehleSatzstand(staendeLand, datum);
  if (!stand) throw fehlerOhneSatzstand(key, datum, staende);
  return { tagessatz24h: stand.tagessatz24h, tagessatz8h: stand.tagessatz8h, quelle: stand.quelle };
}

// ── Nur Frontend: Formular-Helfer und Vorschau ────────────────────────────────

/**
 * Frage „Auswärtige Übernachtung?“ — bei Reisen über genau zwei Kalendertage (Regel aus bildeReisetage):
 * 'pflicht' unter 24 h (ohne Angabe lehnt auch der Server ab), 'vorbelegt' ab 24 h (ohne Angabe
 * rechnet der Server mit Übernachtung — im Formular als „Ja“ vorausgewählt), sonst null.
 */
export function uebernachtungsfrage(abfahrt: string, rueckkehr: string): 'pflicht' | 'vorbelegt' | null {
  try {
    return bildeReisetage(abfahrt, rueckkehr, null).length === 2 ? 'vorbelegt' : null;
  } catch (err) {
    return err instanceof ReisetageFehler && err.code === 'UEBERNACHTUNG_FEHLT' ? 'pflicht' : null;
  }
}

/** Anreise- und Zwischentag fragen nach dem Ort um 24 Uhr, Abreisetag und eintägige Reise nach der letzten Tätigkeit. */
export function fragtOrt24Uhr(typ: ReisetagTyp): boolean {
  return typ === 'ANREISE' || typ === 'GANZTAG';
}

/** Seetag nur am Ganztag — sonst verwerfen (Ein-/Ausschiffungstag = Land des Hafens). */
function ohneUngueltigenSeetag(wert: string | null | undefined, typ: ReisetagTyp): string | null {
  return wert === LAND_SEETAG && typ !== 'GANZTAG' ? null : wert ?? null;
}

/**
 * Neue Tagesliste nach Änderung von Abfahrt, Rückkehr oder Übernachtung: Mahlzeiten je Datum
 * übernehmen; Landangaben nur, wenn der Tag weiterhin dieselbe Frage stellt (Ort um 24 Uhr
 * bzw. letzte Tätigkeit) — ein Seetag nur, wenn der Tag ein Ganztag bleibt.
 */
export function uebernehmeTagesangaben(soll: readonly ReisetagSoll[], bisher: readonly ReisetagEingabe[]): ReisetagEingabe[] {
  const nachDatum = new Map(bisher.map(t => [t.datum, t]));
  return soll.map(s => {
    const alt = nachDatum.get(s.datum);
    const gleicheFrage = !!alt && fragtOrt24Uhr(alt.typ) === fragtOrt24Uhr(s.typ);
    return {
      ...s,
      fruehstueckGestellt: alt?.fruehstueckGestellt ?? false,
      mittagGestellt: alt?.mittagGestellt ?? false,
      abendGestellt: alt?.abendGestellt ?? false,
      land24uhr: gleicheFrage ? ohneUngueltigenSeetag(alt.land24uhr, s.typ) : null,
      letzterTaetigkeitsort: gleicheFrage ? ohneUngueltigenSeetag(alt.letzterTaetigkeitsort, s.typ) : null,
      landFreitext: gleicheFrage ? alt.landFreitext ?? null : null,
    };
  });
}

/**
 * Ändert die 24-Uhr-Angabe eines An-/Zwischentags (Index `index`) auf `neu`. Ist dabei „Staat nicht
 * in der Liste“ beteiligt (vorher oder nachher), ziehen die direkt folgenden Zwischentage mit,
 * solange sie keine eigene Angabe haben oder noch die bisherige Angabe dieses Tags tragen —
 * z. B. 5 Tage Nauru: einmal wählen und den Staat einmal eintippen statt je Tag. „Inland“ wird
 * nicht weitergegeben (Folgetage dann wieder ohne Angabe = Hauptland). Der Abreisetag erbt
 * ohnehin den Vortag (bestimmeTageslaender).
 */
export function setzeOrt24MitFolgetagen(tage: readonly ReisetagEingabe[], index: number, neu: ReisetagEingabe): ReisetagEingabe[] {
  const alt = tage[index];
  const ergebnis = tage.map((t, i) => (i === index ? neu : t));
  const geaendert = alt.land24uhr !== neu.land24uhr || (alt.landFreitext ?? '') !== (neu.landFreitext ?? '');
  if (!geaendert || !fragtOrt24Uhr(neu.typ) || (alt.land24uhr !== LAND_ANDERES && neu.land24uhr !== LAND_ANDERES)) return ergebnis;

  const folgt = (t: ReisetagEingabe) =>
    (!t.land24uhr && !t.letzterTaetigkeitsort) ||
    (alt.land24uhr === LAND_ANDERES && t.land24uhr === LAND_ANDERES && (t.landFreitext ?? '') === (alt.landFreitext ?? ''));
  const land24uhr = neu.land24uhr && neu.land24uhr !== LAND_INLAND ? neu.land24uhr : null;
  for (let i = index + 1; i < ergebnis.length && ergebnis[i].typ === 'GANZTAG' && folgt(ergebnis[i]); i++) {
    ergebnis[i] = {
      ...ergebnis[i],
      land24uhr,
      letzterTaetigkeitsort: null,
      landFreitext: land24uhr === LAND_ANDERES ? neu.landFreitext ?? null : null,
    };
  }
  return ergebnis;
}

// Übliche Namen von Staaten und Gebieten, die in der BMF-Übersicht anders heißen bzw. zum
// Mutterland zählen (Schlüssel normalisiert wie normalisiereName). Ziel = Land-Key.
const LAND_ALIASE: Record<string, string> = {
  'sudkorea': 'Korea, Republik', 'sud korea': 'Korea, Republik', 'republik korea': 'Korea, Republik',
  'belarus': 'Weißrussland', 'weissrussland': 'Weißrussland',
  'elfenbeinkuste': 'Côte d’Ivoire', 'ivory coast': 'Côte d’Ivoire',
  'moldawien': 'Moldau, Republik', 'moldau': 'Moldau, Republik', 'moldova': 'Moldau, Republik', 'republik moldau': 'Moldau, Republik',
  'england': 'Großbritannien', 'schottland': 'Großbritannien', 'wales': 'Großbritannien', 'nordirland': 'Großbritannien',
  'vereinigtes konigreich': 'Großbritannien', 'united kingdom': 'Großbritannien', 'uk': 'Großbritannien', 'gibraltar': 'Großbritannien',
  'holland': 'Niederlande',
  'tschechische republik': 'Tschechien',
  'slowakei': 'Slowakische Republik',
  'russland': 'Russische Föderation',
  'mazedonien': 'Nordmazedonien',
  'turkiye': 'Türkei',
  'vereinigte staaten': 'USA', 'vereinigte staaten von amerika': 'USA', 'amerika': 'USA', 'us': 'USA',
  'vae': 'Vereinigte Arabische Emirate', 'uae': 'Vereinigte Arabische Emirate', 'emirate': 'Vereinigte Arabische Emirate',
  'burma': 'Myanmar', 'birma': 'Myanmar',
  'vatikan': 'Vatikanstaat',
  'kapverden': 'Kap Verde',
  'bosnien': 'Bosnien und Herzegowina',
  'marshallinseln': 'Marshall Inseln',
  'kanaren': 'Spanien — Kanarische Inseln', 'teneriffa': 'Spanien — Kanarische Inseln', 'gran canaria': 'Spanien — Kanarische Inseln',
  'lanzarote': 'Spanien — Kanarische Inseln', 'fuerteventura': 'Spanien — Kanarische Inseln',
  'mallorca': 'Spanien', 'balearen': 'Spanien', 'ibiza': 'Spanien',
  'madeira': 'Portugal', 'azoren': 'Portugal',
  'gronland': 'Dänemark', 'faroer': 'Dänemark', 'faroer inseln': 'Dänemark',
  'korsika': 'Frankreich', 'guadeloupe': 'Frankreich', 'martinique': 'Frankreich', 'reunion': 'Frankreich',
  'sizilien': 'Italien', 'sardinien': 'Italien',
  'kreta': 'Griechenland',
  'hawaii': 'USA', 'alaska': 'USA', 'puerto rico': 'USA',
};

/** Vergleichsform eines Namens: klein, ohne Akzente/Apostrophe, ß → ss, nur Buchstaben/Ziffern. */
function normalisiereName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[’'`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Steht der bei „Staat nicht in der Liste“ eingetippte Staat doch in der Liste (ohne Groß-/
 * Kleinschreibung, unter anderem Namen oder als Gebiet des Mutterlands)? Liefert den Land-Key
 * (z. B. „Südkorea“ → „Korea, Republik“, „Teneriffa“ → „Spanien — Kanarische Inseln“), sonst null.
 */
export function landKeyZuFreitext(freitext: string, landKeys: readonly string[]): string | null {
  const gesucht = normalisiereName(freitext);
  if (!gesucht) return null;
  const direkt = landKeys.find(k => normalisiereName(k) === gesucht || normalisiereName(k.split(' — ')[1] ?? '') === gesucht);
  if (direkt) return direkt;
  const alias = LAND_ALIASE[gesucht];
  return alias && landKeys.includes(alias) ? alias : null;
}

/**
 * Länderauswahl aus den Satzständen: jedes Land genau einmal (die API liefert je Land alle
 * Stände). Ist für `datum` ein Jahresstand hinterlegt (Luxemburg), nur die Länder, für die an
 * diesem Tag ein Stand gilt (waehleSatzstand) — im BMF-Schreiben gestrichene oder erst später
 * aufgenommene Länder und Städte fallen heraus. Ohne Jahresstand (BMF-Schreiben noch nicht
 * eingespielt, Jahr vor dem ersten Stand) bleibt jedes Land wählbar: Sortierung und Anzeige vom
 * jüngsten Stand bis `datum`, sonst vom ältesten; den fehlenden Stand meldet die Vorschau.
 * Reihenfolge: `reihenfolge` (< 1000 = „Häufige Ziele“), bei Gleichstand nach Namen.
 */
export function laenderZumDatum<T extends { landKey: string; gueltigVon: string; reihenfolge: number }>(
  staende: readonly T[],
  datum: string,
): T[] {
  const nurGueltige = jahresstandVorhanden(staende, datum);
  const jahresanfang = `${datum.slice(0, 4)}-01-01`;
  const jeLand = new Map<string, T>();
  for (const stand of staende) {
    if (nurGueltige && (stand.gueltigVon < jahresanfang || stand.gueltigVon > datum)) continue;
    const bisher = jeLand.get(stand.landKey);
    const besser = !bisher ||
      (stand.gueltigVon <= datum
        ? bisher.gueltigVon > datum || stand.gueltigVon > bisher.gueltigVon
        : bisher.gueltigVon > datum && stand.gueltigVon < bisher.gueltigVon);
    if (besser) jeLand.set(stand.landKey, stand);
  }
  return [...jeLand.values()].sort((a, b) => a.reihenfolge - b.reihenfolge || a.landKey.localeCompare(b.landKey, 'de'));
}

/** Reisetag der Vorschau: Eingaben + maßgebendes Land + angewandter Satz + Beträge. */
export interface VmaVorschauTag extends Reisetag {
  land: TagesLand;
  satz: AngewandterSatz;
}

export interface VmaVorschau {
  /** Leer, wenn sich Land oder Satz nicht bestimmen lassen (dann steht der Grund in `fehler`). */
  tage: VmaVorschauTag[];
  /** Erste Meldung, mit der auch der Server ablehnen würde — blockiert Weiter/Einreichen. */
  fehler: string | null;
}

// Platzhalter (nicht eintippbar): Ein fehlender Freitext ändert weder Land noch Satz.
const OHNE_FREITEXT = '\u0000';

/**
 * Vorschau = Serverrechnung aus den Rohdaten: Land je Tag (bestimmeTageslaender) → Satz des
 * Satzstands zum Datum des Tags (waehleTagesSatz) → VMA (berechneVmaTagMitSatz). Fehlt nur der
 * Freitext zu „Staat nicht in der Liste“, bleiben Länder und Beträge sichtbar (sie hängen nicht
 * vom Freitext ab); die Meldung steht trotzdem in `fehler`. Fehlt der Satzstand für ein
 * Reisejahr, gibt es keine Beträge, nur die Meldung des Servers.
 */
export function berechneVmaVorschau(
  tage: readonly ReisetagEingabe[],
  hauptland: string | null,
  staende: readonly Satzstand[],
): VmaVorschau {
  let fehler: string | null = null;
  let laender: TagesLand[];
  try {
    laender = bestimmeTageslaender(tage, hauptland);
  } catch (err) {
    if (!(err instanceof ReisetageFehler)) throw err;
    fehler = err.message;
    if (err.code !== 'FREITEXT_FEHLT') return { tage: [], fehler };
    try {
      laender = bestimmeTageslaender(
        tage.map(t => ({ ...t, landFreitext: t.landFreitext?.trim() || OHNE_FREITEXT })),
        hauptland,
      ).map(l => (l.landFreitext === OHNE_FREITEXT ? { ...l, landFreitext: null } : l));
    } catch {
      return { tage: [], fehler };
    }
  }

  try {
    return {
      tage: tage.map((t, i) => {
        const satz = waehleTagesSatz(laender[i].landKey, t.datum, staende);
        const tag = berechneVmaTagMitSatz({ ...t, vmaBrutto: 0, vmaKuerzung: 0, vmaNetto: 0 }, satz);
        return { ...tag, land: laender[i], satz };
      }),
      fehler,
    };
  } catch (err) {
    if (!(err instanceof ReisetageFehler)) throw err;
    return { tage: [], fehler: fehler ?? err.message };
  }
}

/** Anzeigename eines maßgebenden Landes (Tageskarten, Zusammenfassung). */
export function landBezeichnung(land: TagesLand): string {
  if (land.landKey === LAND_INLAND) return 'Inland';
  if (land.landKey === LAND_SEETAG) return 'Seetag';
  if (land.landKey === LAND_ANDERES) return land.landFreitext ?? 'Staat nicht in der Liste';
  return land.landKey;
}

/** Länderfolge der Reise, z. B. „Belgien → Niederlande → Luxemburg“ (aufeinanderfolgend gleiche Länder einmal). */
export function laenderfolge(laender: readonly TagesLand[]): string {
  const namen = laender.map(landBezeichnung);
  return namen.filter((name, i) => i === 0 || name !== namen[i - 1]).join(' → ');
}
