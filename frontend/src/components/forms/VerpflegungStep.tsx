import { useState, useEffect } from 'react';
import type { Reisetag } from '@/lib/types';
import { berechneVmaTag, berechneVmaTagAusland, formatReisetagTyp, formatDatumKurz } from '@/lib/vma';
import { formatCurrency } from '@/lib/utils';

interface Props {
  reisetage: Reisetag[];
  onChange: (tage: Reisetag[]) => void;
  auslandsTagessatz24h?: number;
}

export function VerpflegungStep({ reisetage, onChange, auslandsTagessatz24h }: Props) {
  // Master-Toggle: hat irgendwer eine Mahlzeit gestellt?
  // Initial: aus den Daten ableiten — wenn ein Tag bereits Mahlzeit-Flags hat, ist es "Ja".
  const initialGestellt = reisetage.some(
    t => t.fruehstueckGestellt || t.mittagGestellt || t.abendGestellt,
  );
  const [verpflegungGestellt, setVerpflegungGestellt] = useState<boolean>(initialGestellt);

  // Wenn der User auf "Nein" wechselt: alle Mahlzeiten-Flags zuruecksetzen, VMA neu berechnen.
  useEffect(() => {
    if (!verpflegungGestellt && reisetage.some(t => t.fruehstueckGestellt || t.mittagGestellt || t.abendGestellt)) {
      const cleared = reisetage.map(t => {
        const reset = { ...t, fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false };
        return auslandsTagessatz24h
          ? berechneVmaTagAusland(reset, auslandsTagessatz24h)
          : berechneVmaTag(reset);
      });
      onChange(cleared);
    }
  }, [verpflegungGestellt, reisetage, onChange, auslandsTagessatz24h]);

  if (reisetage.length === 0) {
    return (
      <div className="text-center py-8 text-credo-500">
        <p>Bitte geben Sie zuerst die Reisedaten ein (Abfahrt und Rückkehr),</p>
        <p>um die Verpflegungspauschalen berechnen zu können.</p>
      </div>
    );
  }

  // Eintaegige Reise unter 8h: kein Anspruch — kompakter Hinweis, keine Eingabe
  const hatEintaegigOhneVma = reisetage.length === 1 && reisetage[0].vmaBrutto === 0;
  if (hatEintaegigOhneVma) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <p className="text-amber-900 font-medium mb-1">Kein Verpflegungsmehraufwand</p>
        <p className="text-sm text-amber-800">
          Bei einer Abwesenheit unter 8 Stunden besteht kein Anspruch auf
          Verpflegungspauschale (§ 9 Abs. 4a EStG).
        </p>
      </div>
    );
  }

  const handleMahlzeitToggle = (index: number, field: 'fruehstueckGestellt' | 'mittagGestellt' | 'abendGestellt') => {
    const updated = reisetage.map((tag, i) => {
      if (i !== index) return tag;
      const toggled = { ...tag, [field]: !tag[field] };
      return auslandsTagessatz24h
        ? berechneVmaTagAusland(toggled, auslandsTagessatz24h)
        : berechneVmaTag(toggled);
    });
    onChange(updated);
  };

  const vmaGesamt = reisetage.reduce((sum, t) => sum + t.vmaNetto, 0);
  const vmaBruttoGesamt = reisetage.reduce((sum, t) => sum + t.vmaBrutto, 0);

  return (
    <div className="space-y-6">
      {/* Master-Toggle: zwei radio-style Karten */}
      <fieldset>
        <legend className="text-sm font-medium text-credo-700 mb-3">
          Wurde Ihnen während der Reise eine Mahlzeit vom Arbeitgeber oder Veranstalter gestellt?
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`relative flex flex-col gap-1 px-5 py-4 rounded-xl border cursor-pointer transition-all
                       focus-within:ring-2 focus-within:ring-credo-500 focus-within:ring-offset-1
                       ${!verpflegungGestellt
                         ? 'border-credo-600 bg-credo-50 shadow-sm'
                         : 'border-credo-200 bg-white hover:border-credo-300'}`}
          >
            <input
              type="radio"
              name="verpflegungGestellt"
              className="sr-only"
              checked={!verpflegungGestellt}
              onChange={() => setVerpflegungGestellt(false)}
            />
            <span className="text-sm font-semibold text-credo-900">Nein</span>
            <span className="text-xs text-credo-500">Ich habe alles selbst bezahlt.</span>
          </label>
          <label
            className={`relative flex flex-col gap-1 px-5 py-4 rounded-xl border cursor-pointer transition-all
                       focus-within:ring-2 focus-within:ring-credo-500 focus-within:ring-offset-1
                       ${verpflegungGestellt
                         ? 'border-credo-600 bg-credo-50 shadow-sm'
                         : 'border-credo-200 bg-white hover:border-credo-300'}`}
          >
            <input
              type="radio"
              name="verpflegungGestellt"
              className="sr-only"
              checked={verpflegungGestellt}
              onChange={() => setVerpflegungGestellt(true)}
            />
            <span className="text-sm font-semibold text-credo-900">Ja</span>
            <span className="text-xs text-credo-500">Mindestens eine Mahlzeit war inklusive.</span>
          </label>
        </div>
      </fieldset>

      {/* Bei "Nein": kompakte Pauschalen-Anzeige */}
      {!verpflegungGestellt ? (
        <div className="bg-credo-50 border border-credo-200 rounded-xl p-5">
          <p className="text-xs text-credo-500 uppercase tracking-wider mb-1">Verpflegungspauschale</p>
          <p className="text-2xl font-bold text-credo-900">{formatCurrency(vmaBruttoGesamt)}</p>
          <p className="text-xs text-credo-500 mt-2">
            {reisetage.length === 1
              ? 'Eintägige Reise (über 8 Stunden)'
              : `${reisetage.length} Reisetage`}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop-Tabelle */}
          <div className="hidden lg:block border border-credo-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-credo-50">
                <tr>
                  <th scope="col" className="text-left p-3 font-medium text-credo-700">Tag</th>
                  <th scope="col" className="text-left p-3 font-medium text-credo-700">Typ</th>
                  <th scope="col" className="text-center p-3 font-medium text-credo-700">Frühstück</th>
                  <th scope="col" className="text-center p-3 font-medium text-credo-700">Mittag</th>
                  <th scope="col" className="text-center p-3 font-medium text-credo-700">Abend</th>
                  <th scope="col" className="text-right p-3 font-medium text-credo-700">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {reisetage.map((tag, index) => (
                  <tr key={tag.datum} className={`border-t border-credo-100 ${index % 2 === 0 ? '' : 'bg-credo-50/30'}`}>
                    <td className="p-3 text-credo-700 font-medium">{formatDatumKurz(tag.datum)}</td>
                    <td className="p-3 text-credo-500 text-xs">{formatReisetagTyp(tag.typ)}</td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                        checked={tag.fruehstueckGestellt}
                        onChange={() => handleMahlzeitToggle(index, 'fruehstueckGestellt')}
                        aria-label={`Frühstück gestellt am ${formatDatumKurz(tag.datum)}`}
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                        checked={tag.mittagGestellt}
                        onChange={() => handleMahlzeitToggle(index, 'mittagGestellt')}
                        aria-label={`Mittagessen gestellt am ${formatDatumKurz(tag.datum)}`}
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                        checked={tag.abendGestellt}
                        onChange={() => handleMahlzeitToggle(index, 'abendGestellt')}
                        aria-label={`Abendessen gestellt am ${formatDatumKurz(tag.datum)}`}
                      />
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-semibold text-credo-900">{formatCurrency(tag.vmaNetto)}</div>
                      {tag.vmaKuerzung > 0 && (
                        <div className="text-xs text-red-500">- {formatCurrency(tag.vmaKuerzung)}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-credo-50 border-t-2 border-credo-200">
                <tr>
                  <td colSpan={5} className="p-3 font-semibold text-credo-700">Gesamt</td>
                  <td className="p-3 text-right font-bold text-credo-900 text-lg">{formatCurrency(vmaGesamt)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile-Cards */}
          <div className="lg:hidden space-y-3">
            {reisetage.map((tag, index) => (
              <div key={tag.datum} className="border border-credo-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold text-credo-900">{formatDatumKurz(tag.datum)}</div>
                    <div className="text-xs text-credo-500">{formatReisetagTyp(tag.typ)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-credo-900">{formatCurrency(tag.vmaNetto)}</div>
                    {tag.vmaKuerzung > 0 && (
                      <div className="text-xs text-red-500">- {formatCurrency(tag.vmaKuerzung)}</div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['fruehstueckGestellt', 'mittagGestellt', 'abendGestellt'] as const).map(field => {
                    const labels = { fruehstueckGestellt: 'Frühstück', mittagGestellt: 'Mittag', abendGestellt: 'Abend' };
                    const checked = tag[field];
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => handleMahlzeitToggle(index, field)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-credo-500
                                   ${checked
                                     ? 'bg-credo-600 text-white shadow-sm'
                                     : 'bg-credo-50 text-credo-700 border border-credo-200 hover:bg-credo-100'}`}
                        aria-pressed={checked}
                      >
                        {labels[field]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="bg-credo-50 border border-credo-200 rounded-xl p-4 flex items-center justify-between">
              <span className="font-semibold text-credo-700">Gesamt</span>
              <span className="font-bold text-credo-900 text-lg">{formatCurrency(vmaGesamt)}</span>
            </div>
          </div>

          <p className="text-xs text-credo-500">
            Kürzung: Frühstück 20 %, Mittag 40 %, Abend 40 % — immer vom Volltagessatz (28,00 EUR Inland).
            Das Ergebnis pro Tag wird nie negativ.
          </p>
        </>
      )}
    </div>
  );
}
