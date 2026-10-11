// Landfelder je Reisetag (Ausland) im Schritt „Verpflegung“: wann sie auf- oder zugeklappt sind.
// Nur Anzeige — Land, Satz und Beträge rechnen weiter die reinen Funktionen in reisetage.ts.

import type { ReisetagEingabe } from './types';
import { LAND_ANDERES, LAND_SEETAG, type VmaVorschauTag } from './reisetage';

/**
 * - 'erzwungen': immer offen, ohne Umschalter
 * - 'offen': von selbst offen, zuklappbar
 * - 'zu': zugeklappt, Kopfzeile „Land · ändern“
 */
export type LandfelderVorgabe = 'erzwungen' | 'offen' | 'zu';

/** Abreisetag nach einem Seetag: ausgeschifft wird im Hafenland (Hinweis am Tag, Grund zum Öffnen). */
export function nachSeetag(tag: ReisetagEingabe, vortag: ReisetagEingabe | undefined): boolean {
  return tag.typ === 'ABREISE' && vortag?.land24uhr === LAND_SEETAG;
}

/**
 * Vorgabe für die Landfelder eines Tags — zugeklappt nur, wenn die Vorbelegung passt; nie Wichtiges verstecken:
 * - Erzwungen: ohne Vorschau des Tags (Land und Betrag unbekannt, Grund in der Meldung) und bei
 *   „Staat nicht in der Liste“ ohne Staat.
 * - Offen: Anreisetag (Abfahrt am Abend, Durchreise — das Land um 24 Uhr wird aktiv abgefragt),
 *   maßgebendes Land ≠ Hauptland (Mehrländer, Vorbelegung vom Vortag, Seetag), eigene vom Hauptland
 *   abweichende Angabe, Abreisetag nach einem Seetag.
 * - Zu: Zwischen- und Abreisetage im Hauptland ohne abweichende Angabe.
 */
export function landfelderVorgabe(
  tag: ReisetagEingabe,
  vortag: ReisetagEingabe | undefined,
  vorschauTag: VmaVorschauTag | undefined,
  hauptland: string | null,
): LandfelderVorgabe {
  if (!vorschauTag || (vorschauTag.land.landKey === LAND_ANDERES && !vorschauTag.land.landFreitext)) return 'erzwungen';
  const eigeneAbweichend = [tag.land24uhr, tag.letzterTaetigkeitsort].some(l => !!l && l !== hauptland);
  const pruefen = tag.typ === 'ANREISE'
    || vorschauTag.land.landKey !== hauptland
    || eigeneAbweichend
    || nachSeetag(tag, vortag);
  return pruefen ? 'offen' : 'zu';
}

/**
 * Von Hand auf- oder zugeklappt (Schlüssel: Datum) nach einer Landangabe an `tage[index]`: Der
 * geänderte Tag bleibt offen (sonst klappte er unter dem Finger zu, der Fokus ginge verloren). Ein
 * früheres Zuklappen der Folgetage verfällt — die Änderung kann dort einen neuen Grund zum Öffnen
 * schaffen (Vorbelegung vom Vortag, Seetag, weitergegebener Staat), den es nicht verdecken darf.
 * Von Hand geöffnete Folgetage bleiben offen.
 */
export function landOffenNachAenderung(
  manuell: Readonly<Record<string, boolean>>,
  tage: readonly ReisetagEingabe[],
  index: number,
): Record<string, boolean> {
  const neu: Record<string, boolean> = { ...manuell, [tage[index].datum]: true };
  for (const t of tage.slice(index + 1)) {
    if (neu[t.datum] === false) delete neu[t.datum];
  }
  return neu;
}
