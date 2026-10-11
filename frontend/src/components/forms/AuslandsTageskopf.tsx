import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ReisetagEingabe } from '@/lib/types';
import { formatReisetagTyp, formatDatumKurz } from '@/lib/vma';
import { landBezeichnung, satzLandKey, type VmaVorschauTag } from '@/lib/reisetage';
import { formatCurrency } from '@/lib/utils';

// Gleiche Mindesthöhe für Button und reine Anzeige: kein Sprung, wenn der Kopf wechselt
// (z. B. beim ersten Zeichen im Freitext zu „Staat nicht in der Liste“).
const KOPF = 'flex w-full min-h-[44px] items-start justify-between gap-3';

interface Props {
  tag: ReisetagEingabe;
  /** Vorschau des Tags (maßgebendes Land, Betrag); fehlt sie, zeigt der Kopf kein Land und „—“. */
  vorschauTag: VmaVorschauTag | undefined;
  /** Landfelder sichtbar? */
  offen: boolean;
  /** Mit Umschalter ist die ganze Kopfzeile ein Button, sonst nur Anzeige (Landfelder immer offen). */
  mitUmschalter: boolean;
  onUmschalten: () => void;
  /** Landfelder des Tags. */
  children: ReactNode;
}

/**
 * Auslands-Tageskarte: Kopfzeile (Datum · Typ, maßgebendes Land, Betrag) und darunter die
 * Landfelder. Mit Umschalter ist die ganze Kopfzeile der Button „ändern“ bzw. „ausblenden“
 * (Tippfläche ≥ 44 px); der Fokus bleibt beim Auf- und Zuklappen auf dem Button, Tab führt in die
 * Felder. Screenreader lesen einen Satz statt der optischen Teile (aria-hidden). Kopf und Panel sind
 * Geschwister: Wechselt nur der Kopf zwischen Button und Anzeige, bleiben Panel und Fokus erhalten.
 */
export function AuslandsTageskopf({ tag, vorschauTag: v, offen, mitUmschalter, onUmschalten, children }: Props) {
  const panelId = `landfelder-${tag.datum}`;
  // Maßgebendes Land, z. B. „Belgien“ oder „Nauru · Satz Luxemburg“.
  const satzVon = v ? satzLandKey(v.land.landKey) : null;
  const land = v ? `${landBezeichnung(v.land)}${satzVon && satzVon !== v.land.landKey ? ` · Satz ${satzVon}` : ''}` : null;
  const betrag = v ? formatCurrency(v.vmaNetto) : '—';
  const k = v?.vmaKuerzung ?? 0;

  const inhalt = (
    <>
      <span className="sr-only">
        {formatDatumKurz(tag.datum)}, {formatReisetagTyp(tag.typ)}
        {land && `: ${land}`}, {v ? betrag : 'Betrag noch offen'}
        {k > 0 && `, gekürzt um ${formatCurrency(k)}`}
        {mitUmschalter && (offen ? ' – Landangaben ausblenden' : ' – Land ändern')}
      </span>
      <span aria-hidden="true" className="min-w-0">
        <span className="block">
          <span className="font-semibold text-credo-900">{formatDatumKurz(tag.datum)}</span>
          <span className="text-xs text-credo-500"> · {formatReisetagTyp(tag.typ)}</span>
        </span>
        <span className="block text-xs text-credo-700">
          {land}
          {land && mitUmschalter && <span className="text-credo-500"> · </span>}
          {mitUmschalter && (
            <span className="whitespace-nowrap font-medium text-credo-600 underline underline-offset-2 group-hover:text-credo-900">
              {offen ? 'ausblenden' : 'ändern'}
              <ChevronDown className={`inline-block w-3.5 h-3.5 ml-0.5 align-[-2px] transition-transform ${offen ? 'rotate-180' : ''}`} />
            </span>
          )}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-right">
        <span className="block font-bold text-credo-900">{betrag}</span>
        {k > 0 && <span className="block text-xs text-red-600">- {formatCurrency(k)}</span>}
      </span>
    </>
  );

  return (
    <>
      {mitUmschalter ? (
        <button
          type="button"
          onClick={onUmschalten}
          aria-expanded={offen}
          aria-controls={panelId}
          className={`group ${KOPF} rounded-lg text-left
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-credo-500 focus-visible:ring-offset-4`}
        >
          {inhalt}
        </button>
      ) : (
        <div className={KOPF}>{inhalt}</div>
      )}
      <div id={panelId} hidden={!offen} className="mt-3">
        {children}
      </div>
    </>
  );
}
