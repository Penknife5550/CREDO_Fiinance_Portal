import type { ReactNode } from 'react';
import type { AuslandsPauschale } from '@/lib/hooks';
import { LAND_ANDERES, LAND_INLAND, LAND_SEETAG, landKeyZuFreitext } from '@/lib/reisetage';

interface Props {
  id: string;
  label: string;
  /** Gewählter Wert: 'INLAND', 'ANDERES', 'SEETAG' oder Land-Key; '' = noch nichts gewählt (nur mit platzhalter). */
  value: string;
  onChange: (wert: string) => void;
  /** Länder aus GET /api/pauschalen/ausland. */
  laender: AuslandsPauschale[];
  /** Leere erste Option (z. B. „Bitte Land wählen...“). */
  platzhalter?: string;
  /** Option „Inland (Deutschland)“ anbieten. */
  mitInland?: boolean;
  /** Text der Inland-Option (z. B. „Keine Tätigkeit im Ausland“ bei der Frage nach dem Tätigkeitsort). */
  inlandText?: string;
  /** Option „Seetag (ganzer Tag an Bord)“ anbieten — nur für Ganztage. */
  mitSeetag?: boolean;
  /** Option „Staat nicht in der Liste (Satz Luxemburg)“ samt Freitext anbieten. */
  mitAnderes?: boolean;
  /** Name des nicht aufgeführten Staats (bei „Staat nicht in der Liste“). */
  freitext?: string;
  onFreitextChange?: (text: string) => void;
  /** Freitext rot markieren (nach der Schritt-Validierung, wenn er fehlt). */
  freitextFehler?: boolean;
  /** ID der Meldung, die den fehlenden Freitext erklärt (aria-describedby). */
  freitextFehlerId?: string;
  fehler?: string;
  hinweis?: ReactNode;
}

/**
 * Länderauswahl als natives <select> (mobil die System-Auswahl) mit Gruppen:
 * Inland, Häufige Ziele (Sortierung < 1000, im AdminCenter pflegbar), Alle Länder A–Z,
 * Sonderfälle (Seetag, Staat nicht in der Liste + Freitext).
 */
export function LandAuswahl({
  id, label, value, onChange, laender, platzhalter,
  mitInland = false, inlandText = 'Inland (Deutschland)', mitSeetag = false, mitAnderes = false,
  freitext, onFreitextChange, freitextFehler = false, freitextFehlerId, fehler, hinweis,
}: Props) {
  const haeufigeZiele = laender.filter(p => p.reihenfolge < 1000);
  const alleLaenderAZ = [...laender].sort((a, b) => a.landKey.localeCompare(b.landKey, 'de'));
  // Staaten mit eigenen Stadtsätzen (z. B. „Spanien — Palma de Mallorca“) als „übrige Orte“ kennzeichnen,
  // damit niemand für eine Stadt mit eigenem Satz versehentlich den allgemeinen Staatssatz wählt.
  const staatenMitStaedten = new Set(laender.filter(p => p.landKey.includes(' — ')).map(p => p.landKey.split(' — ')[0]));
  const anzeige = (landKey: string) => (staatenMitStaedten.has(landKey) ? `${landKey} (übrige Orte)` : landKey);
  const zeigeFreitext = mitAnderes && value === LAND_ANDERES;
  // Eingetippter Staat steht doch in der Liste (z. B. „Südkorea“ → „Korea, Republik“)?
  const listenLand = zeigeFreitext && freitext ? landKeyZuFreitext(freitext, laender.map(p => p.landKey)) : null;

  const hinweisId = `${id}-hinweis`;
  const fehlerId = `${id}-fehler`;
  const beschreibung = [hinweis ? hinweisId : null, fehler ? fehlerId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select
        id={id}
        className={`input-field ${fehler ? 'border-red-400' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-describedby={beschreibung}
        aria-invalid={fehler ? true : undefined}
      >
        {platzhalter !== undefined && <option value="">{platzhalter}</option>}
        {mitInland && (
          <optgroup label="Inland">
            <option value={LAND_INLAND}>{inlandText}</option>
          </optgroup>
        )}
        {haeufigeZiele.length > 0 && (
          <optgroup label="Häufige Ziele">
            {haeufigeZiele.map(p => (
              <option key={p.landKey} value={p.landKey}>{anzeige(p.landKey)}</option>
            ))}
          </optgroup>
        )}
        {alleLaenderAZ.length > 0 && (
          <optgroup label="Alle Länder A–Z">
            {alleLaenderAZ.map(p => (
              <option key={p.landKey} value={p.landKey}>{anzeige(p.landKey)}</option>
            ))}
          </optgroup>
        )}
        {(mitSeetag || mitAnderes) && (
          <optgroup label="Sonderfälle">
            {mitSeetag && <option value={LAND_SEETAG}>Seetag (ganzer Tag an Bord)</option>}
            {mitAnderes && <option value={LAND_ANDERES}>Staat nicht in der Liste (Satz Luxemburg)</option>}
          </optgroup>
        )}
      </select>
      {fehler && <p id={fehlerId} className="text-xs text-red-500 mt-1">{fehler}</p>}
      {zeigeFreitext && (
        <div className="mt-2">
          <label htmlFor={`${id}-freitext`} className="label">Welcher Staat? *</label>
          <input
            id={`${id}-freitext`}
            type="text"
            maxLength={100}
            className={`input-field ${freitextFehler ? 'border-red-400' : ''}`}
            placeholder="z. B. Nauru"
            value={freitext ?? ''}
            onChange={e => onFreitextChange?.(e.target.value)}
            aria-invalid={freitextFehler}
            aria-describedby={[listenLand ? `${id}-listenland` : null, freitextFehler ? freitextFehlerId : null].filter(Boolean).join(' ') || undefined}
          />
          {listenLand && (
            <p id={`${id}-listenland`} className="text-xs text-amber-700 mt-1">
              Steht in der Liste als „{listenLand}“ – bitte dort auswählen.{' '}
              <button
                type="button"
                className="font-medium underline hover:text-amber-900"
                onClick={() => onChange(listenLand)}
              >
                „{listenLand}“ übernehmen
              </button>
            </p>
          )}
        </div>
      )}
      {hinweis && <div id={hinweisId}>{hinweis}</div>}
    </div>
  );
}
