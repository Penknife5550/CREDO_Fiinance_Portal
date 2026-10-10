/**
 * Reisetage und maßgebendes Land je Reisetag — reine, testbare Funktionen (Release 1b).
 *
 * 1. bildeReisetage: Tagesbildung aus Abfahrt/Rückkehr (Mitternachtsregel).
 * 2. bestimmeTageslaender: maßgebendes Land je Tag aus den Landangaben.
 * 3. waehleTagesSatz: Pauschalen-Paar zum maßgebenden Land.
 *
 * Der Frontend-Zwilling (Vorschau) MUSS identisch rechnen; die Parität prüft
 * tests/vma-paritaet.test.ts (unter TZ=UTC und TZ=Europe/Berlin).
 *
 * Rechtsgrundlage: § 9 Abs. 4a EStG, BMF-Schreiben vom 05.12.2025, R 9.6 Abs. 3 LStR.
 */

import { INLAND_SATZ, type ReisetagTyp, type TagesSatz } from './vma.js';
import { FALLBACK_LAND_KEY, LAND_ANDERES, LAND_INLAND, LAND_SEETAG, RESERVIERTE_LAND_KEYS } from './constants.js';

export type ReisetageFehlerCode =
  | 'FORMAT'
  | 'RUECKKEHR_NICHT_NACH_ABFAHRT'
  | 'ZU_VIELE_TAGE'
  | 'UEBERNACHTUNG_FEHLT'
  | 'AUSLANDSTAG_BEI_INLANDSREISE'
  | 'FREITEXT_FEHLT'
  | 'SEETAG_NUR_GANZTAG'
  | 'UNGUELTIGE_LANDANGABE'
  | 'UNBEKANNTES_LAND';

/** Fachlicher Fehler der Tagesbildung/Landbestimmung mit deutscher Meldung (Route: 400). */
export class ReisetageFehler extends Error {
  readonly code: ReisetageFehlerCode;

  constructor(code: ReisetageFehlerCode, message: string) {
    super(message);
    this.name = 'ReisetageFehler';
    this.code = code;
  }
}

// ── 1. Tagesbildung (zeitzonenunabhängig) ─────────────────────────────────────
// Abfahrt/Rückkehr kommen als datetime-local-Wert 'YYYY-MM-DDTHH:mm' (Wanduhrzeit).
// Gerechnet wird nur mit den String-Teilen (Date.UTC) — nie mit Ortszeit-Date-Objekten,
// sonst hängt das Ergebnis von der Zeitzone des Rechners ab (Zeitumstellung, Abfahrt
// vor 02:00 Uhr).
// Bewusste Vereinfachung: Auch die Dauer (8-h-/24-h-Grenze, größerer Zeitanteil) ist die
// Differenz der Wanduhrzeiten. In den beiden Nächten der Zeitumstellung (letzter Sonntag im
// März/Oktober) weicht sie um eine Stunde von der tatsächlichen Abwesenheit ab.

const ZEITPUNKT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const MINUTEN_8H = 480;
const MINUTEN_24H = 1440;
const MAX_REISETAGE = 60; // wie der Zod-Deckel der Route

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

/** Eintägige Abwesenheit: Anspruch nur bei strikt MEHR als 8 h (> 480 min) — 8:00 h genügt nicht. */
export function dauertLaengerAls8h(abfahrt: string, rueckkehr: string): boolean {
  const start = wanduhrMinuten(abfahrt);
  const ende = wanduhrMinuten(rueckkehr);
  return start !== null && ende !== null && ende - start > MINUTEN_8H;
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

/** Landangaben eines (serverseitig gebildeten) Reisetags. Leere Angabe = keine Angabe. */
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

/**
 * Land-Key, dessen Satz für ein maßgebendes Land gilt: null = Inland (gesetzlicher Satz),
 * ANDERES und SEETAG → Luxemburg (BMF 05.12.2025; R 9.6 Abs. 3 LStR), sonst das Land selbst.
 * Damit lädt die Route alle benötigten Sätze in EINER Abfrage.
 */
export function satzLandKey(landKey: string): string | null {
  if (landKey === LAND_INLAND) return null;
  return landKey === LAND_ANDERES || landKey === LAND_SEETAG ? FALLBACK_LAND_KEY : landKey;
}

/** Pauschalen-Paar zum maßgebenden Land; `saetze` = Ländersätze nach Land-Key (pauschalen_ausland). */
export function waehleTagesSatz(landKey: string, saetze: ReadonlyMap<string, TagesSatz>): TagesSatz {
  const key = satzLandKey(landKey);
  if (key === null) return INLAND_SATZ;
  const satz = saetze.get(key);
  if (!satz) throw new ReisetageFehler('UNBEKANNTES_LAND', `Unbekanntes Reiseland: ${key}`);
  return satz;
}
