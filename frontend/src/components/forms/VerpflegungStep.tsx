import type { Reisetag } from '@/lib/types';
import { berechneVmaTag, berechneVmaTagAusland, formatReisetagTyp, formatDatumKurz } from '@/lib/vma';
import { formatCurrency } from '@/lib/utils';

interface Props {
  reisetage: Reisetag[];
  onChange: (tage: Reisetag[]) => void;
  auslandsTagessatz24h?: number;
}

export function VerpflegungStep({ reisetage, onChange, auslandsTagessatz24h }: Props) {
  if (reisetage.length === 0) {
    return (
      <div className="text-center py-8 text-credo-500">
        <p>Bitte geben Sie zuerst die Reisedaten ein (Abfahrt und Rückkehr),</p>
        <p>um die Verpflegungspauschalen berechnen zu können.</p>
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
  const hatEintaegigOhneVma = reisetage.length === 1 && reisetage[0].vmaBrutto === 0;

  return (
    <div className="space-y-5">
      <div className="text-sm text-credo-600 bg-credo-50 p-3 rounded-lg">
        Die Verpflegungspauschalen werden automatisch anhand Ihrer Reisedaten berechnet.
        Haken setzen = der Arbeitgeber hat diese Mahlzeit bezahlt (z.B. im Hotel oder bei einer Veranstaltung). <strong>Der entsprechende Betrag wird dann von der Pauschale abgezogen.</strong>
      </div>

      {hatEintaegigOhneVma ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Kein Verpflegungsmehraufwand.</strong> Bei einer Abwesenheit unter 8 Stunden besteht kein Anspruch auf Verpflegungspauschale.
        </div>
      ) : (
        <div className="border border-credo-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-credo-50">
              <tr>
                <th className="text-left p-3 font-medium text-credo-700">Tag</th>
                <th className="text-left p-3 font-medium text-credo-700">Typ</th>
                <th className="text-center p-3 font-medium text-credo-700">
                  <span className="hidden sm:inline">Frühstück gestellt?</span>
                  <span className="sm:hidden">Fr. gestellt?</span>
                </th>
                <th className="text-center p-3 font-medium text-credo-700">
                  <span className="hidden sm:inline">Mittag gestellt?</span>
                  <span className="sm:hidden">Mi. gestellt?</span>
                </th>
                <th className="text-center p-3 font-medium text-credo-700">
                  <span className="hidden sm:inline">Abend gestellt?</span>
                  <span className="sm:hidden">Ab. gestellt?</span>
                </th>
                <th className="text-right p-3 font-medium text-credo-700">Kürzung</th>
                <th className="text-right p-3 font-medium text-credo-700">Betrag</th>
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
                      className="w-4 h-4 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                      checked={tag.fruehstueckGestellt}
                      onChange={() => handleMahlzeitToggle(index, 'fruehstueckGestellt')}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                      checked={tag.mittagGestellt}
                      onChange={() => handleMahlzeitToggle(index, 'mittagGestellt')}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                      checked={tag.abendGestellt}
                      onChange={() => handleMahlzeitToggle(index, 'abendGestellt')}
                    />
                  </td>
                  <td className="p-3 text-right text-red-500 text-xs">
                    {tag.vmaKuerzung > 0 ? `- ${formatCurrency(tag.vmaKuerzung)}` : '—'}
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(tag.vmaNetto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-credo-50 border-t-2 border-credo-200">
              <tr>
                <td colSpan={6} className="p-3 font-semibold text-credo-700">
                  Gesamt Verpflegungsmehraufwand
                </td>
                <td className="p-3 text-right font-bold text-credo-900 text-lg">
                  {formatCurrency(vmaGesamt)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-credo-500">
        Haken = Mahlzeit wurde gestellt. Kürzung: Frühstück 20%, Mittag 40%, Abend 40% — immer vom Volltagessatz (28,00 EUR).
        Das Ergebnis pro Tag wird nie negativ.
      </p>
    </div>
  );
}
