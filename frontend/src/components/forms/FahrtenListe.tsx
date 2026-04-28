import { Plus, Trash2 } from 'lucide-react';
import type { Fahrt, SammelfahrtVerkehrsmittel } from '@/lib/types';
import { berechneKmBetrag, satzFuer, SAMMELFAHRT_MAX_FAHRTEN } from '@/lib/sammelfahrt';
import { formatCurrency } from '@/lib/utils';

interface Props {
  fahrten: Fahrt[];
  onChange: (fahrten: Fahrt[]) => void;
  verkehrsmittel: SammelfahrtVerkehrsmittel;
  defaultStartOrt: string;
  errors: Record<string, string>;
}

const EMPTY_FAHRT: Fahrt = { datum: '', startOrt: '', ziel: '', km: 0, kmBetrag: 0 };

export function FahrtenListe({ fahrten, onChange, verkehrsmittel, defaultStartOrt, errors }: Props) {
  const satz = satzFuer(verkehrsmittel);
  const kmSumme = fahrten.reduce((s, f) => s + (f.km || 0), 0);
  const gesamt = fahrten.reduce((s, f) => s + f.kmBetrag, 0);

  const updateFahrt = (index: number, patch: Partial<Fahrt>) => {
    const next = fahrten.map((f, i) => {
      if (i !== index) return f;
      const merged = { ...f, ...patch };
      if (patch.km !== undefined) {
        merged.kmBetrag = berechneKmBetrag(merged.km, verkehrsmittel);
      }
      return merged;
    });
    onChange(next);
  };

  const addFahrt = () => {
    if (fahrten.length >= SAMMELFAHRT_MAX_FAHRTEN) return;
    onChange([...fahrten, { ...EMPTY_FAHRT, startOrt: defaultStartOrt }]);
  };

  const removeFahrt = (index: number) => {
    if (fahrten.length <= 1) return;
    onChange(fahrten.filter((_, i) => i !== index));
  };

  const fehlerFuer = (index: number, feld: string) => errors[`fahrt_${index}_${feld}`];

  return (
    <div className="space-y-3">
      {/* Desktop: Tabelle (ab lg, damit Tablets im Hochformat die Card-Variante bekommen) */}
      <div className="hidden lg:block border border-credo-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-credo-50 text-xs">
            <tr>
              <th scope="col" className="text-left p-2.5 font-medium text-credo-700 w-36">Datum</th>
              <th scope="col" className="text-left p-2.5 font-medium text-credo-700">Von</th>
              <th scope="col" className="text-left p-2.5 font-medium text-credo-700">Nach</th>
              <th scope="col" className="text-right p-2.5 font-medium text-credo-700 w-24">km</th>
              <th scope="col" className="text-right p-2.5 font-medium text-credo-700 w-28">Betrag</th>
              <th scope="col" className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {fahrten.map((f, i) => (
              <tr key={i} className={i % 2 === 0 ? '' : 'bg-credo-50/30'}>
                <td className="p-2 align-top">
                  <input
                    type="date"
                    aria-label={`Fahrt ${i + 1}: Datum`}
                    className={`input-field py-2 px-2 text-sm ${fehlerFuer(i, 'datum') ? 'border-red-400' : ''}`}
                    value={f.datum}
                    onChange={e => updateFahrt(i, { datum: e.target.value })}
                  />
                </td>
                <td className="p-2 align-top">
                  <input
                    type="text"
                    aria-label={`Fahrt ${i + 1}: Von`}
                    className={`input-field py-2 px-2 text-sm ${fehlerFuer(i, 'startOrt') ? 'border-red-400' : ''}`}
                    placeholder={defaultStartOrt || 'Startort'}
                    value={f.startOrt}
                    onChange={e => updateFahrt(i, { startOrt: e.target.value })}
                  />
                </td>
                <td className="p-2 align-top">
                  <input
                    type="text"
                    aria-label={`Fahrt ${i + 1}: Nach`}
                    className={`input-field py-2 px-2 text-sm ${fehlerFuer(i, 'ziel') ? 'border-red-400' : ''}`}
                    placeholder="Reiseziel"
                    value={f.ziel}
                    onChange={e => updateFahrt(i, { ziel: e.target.value })}
                  />
                </td>
                <td className="p-2 align-top">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    aria-label={`Fahrt ${i + 1}: Kilometer`}
                    className={`input-field py-2 px-2 text-sm text-right font-mono ${fehlerFuer(i, 'km') ? 'border-red-400' : ''}`}
                    placeholder="0"
                    value={f.km || ''}
                    onChange={e => updateFahrt(i, { km: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td className="p-2 align-top text-right text-sm font-medium text-credo-800 pt-3.5">
                  {f.km > 0 ? formatCurrency(f.kmBetrag) : '—'}
                </td>
                <td className="p-2 align-top text-center">
                  <button
                    type="button"
                    onClick={() => removeFahrt(i)}
                    disabled={fahrten.length <= 1}
                    aria-label={`Fahrt ${i + 1} entfernen`}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-credo-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-credo-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile + Tablet: Cards */}
      <div className="lg:hidden space-y-3">
        {fahrten.map((f, i) => (
          <div key={i} className="border border-credo-200 rounded-lg p-3 space-y-2.5 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-credo-700">Fahrt {i + 1}</span>
              <button
                type="button"
                onClick={() => removeFahrt(i)}
                disabled={fahrten.length <= 1}
                aria-label={`Fahrt ${i + 1} entfernen`}
                className="p-1 text-credo-400 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input
              type="date"
              className={`input-field text-sm ${fehlerFuer(i, 'datum') ? 'border-red-400' : ''}`}
              value={f.datum}
              onChange={e => updateFahrt(i, { datum: e.target.value })}
              aria-label="Datum"
            />
            <input
              type="text"
              className={`input-field text-sm ${fehlerFuer(i, 'startOrt') ? 'border-red-400' : ''}`}
              placeholder={defaultStartOrt || 'Von (Startort)'}
              value={f.startOrt}
              onChange={e => updateFahrt(i, { startOrt: e.target.value })}
              aria-label="Von"
            />
            <input
              type="text"
              className={`input-field text-sm ${fehlerFuer(i, 'ziel') ? 'border-red-400' : ''}`}
              placeholder="Nach (Ziel)"
              value={f.ziel}
              onChange={e => updateFahrt(i, { ziel: e.target.value })}
              aria-label="Nach"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                className={`input-field text-sm font-mono ${fehlerFuer(i, 'km') ? 'border-red-400' : ''}`}
                placeholder="km"
                value={f.km || ''}
                onChange={e => updateFahrt(i, { km: parseFloat(e.target.value) || 0 })}
                aria-label="Kilometer"
              />
              <div className="flex items-center justify-end px-2 text-sm font-medium text-credo-800">
                {f.km > 0 ? formatCurrency(f.kmBetrag) : '—'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addFahrt}
        disabled={fahrten.length >= SAMMELFAHRT_MAX_FAHRTEN}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-credo-300 text-sm font-medium text-credo-600 hover:bg-credo-50 hover:border-credo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Plus className="w-4 h-4" />
        Weitere Fahrt hinzufügen
      </button>

      {fahrten.length >= SAMMELFAHRT_MAX_FAHRTEN && (
        <p className="text-xs text-amber-600 text-center">
          Maximum von {SAMMELFAHRT_MAX_FAHRTEN} Fahrten pro Sammelantrag erreicht.
        </p>
      )}

      {/* Summe */}
      <div className="bg-credo-50 rounded-lg p-3 flex justify-between items-center text-sm">
        <span className="text-credo-600">
          Gesamt: <span className="font-mono font-medium">{kmSumme.toFixed(2).replace('.', ',')} km</span>
          {' × '}
          <span className="font-mono">{satz.toFixed(2).replace('.', ',')} EUR/km</span>
        </span>
        <span className="text-lg font-bold text-credo-900">{formatCurrency(gesamt)}</span>
      </div>
    </div>
  );
}
