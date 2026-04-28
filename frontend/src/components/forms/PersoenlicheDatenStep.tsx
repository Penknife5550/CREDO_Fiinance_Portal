import { useEffect, useMemo } from 'react';
import { useMandanten, useKostenstellen } from '@/lib/hooks';
import { validateIBAN, formatIBAN } from '@/lib/utils';
import { istKstAn, type PersoenlicheDaten, type Vorgangstyp } from '@/lib/types';

interface Props {
  data: PersoenlicheDaten;
  onChange: (data: PersoenlicheDaten) => void;
  errors: Record<string, string>;
  vorgangstyp: Vorgangstyp;
}

export function PersoenlicheDatenStep({ data, onChange, errors, vorgangstyp }: Props) {
  const { mandanten, gruppiert } = useMandanten();
  const { kostenstellen } = useKostenstellen(data.mandantId);

  // Beim noch-nicht-gewählten Mandant zeigen, um Layout-Sprung beim Wechsel zu minimieren.
  const selectedMandant = useMemo(
    () => mandanten.find(m => m.id === data.mandantId),
    [mandanten, data.mandantId],
  );
  const kstAnzeigen = istKstAn(selectedMandant, vorgangstyp);

  // Wenn der gewählte Mandant das KST-Feld für diesen Vorgangstyp ausblendet,
  // setzen wir eine evtl. zuvor erfasste Kostenstelle zurück, damit sie nicht
  // unsichtbar mit ans Backend geschickt wird.
  useEffect(() => {
    if (!kstAnzeigen && data.kostenstelleId) {
      onChange({ ...data, kostenstelleId: '' });
    }
  }, [kstAnzeigen, data, onChange]);

  const update = (field: keyof PersoenlicheDaten, value: string) => {
    const updated = { ...data, [field]: value };
    // Kostenstelle zurücksetzen wenn Mandant wechselt
    if (field === 'mandantId') {
      updated.kostenstelleId = '';
    }
    onChange(updated);
  };

  const handleIbanInput = (value: string) => {
    // Nur Ziffern und Buchstaben, max 22 Zeichen (DE + 20 Ziffern)
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 22);
    update('iban', cleaned);
  };

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Vorname *</label>
          <input
            type="text"
            className={`input-field ${errors.vorname ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="Max"
            value={data.vorname}
            onChange={e => update('vorname', e.target.value)}
          />
          {errors.vorname && <p className="text-xs text-red-500 mt-1">{errors.vorname}</p>}
        </div>
        <div>
          <label className="label">Nachname *</label>
          <input
            type="text"
            className={`input-field ${errors.nachname ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="Mustermann"
            value={data.nachname}
            onChange={e => update('nachname', e.target.value)}
          />
          {errors.nachname && <p className="text-xs text-red-500 mt-1">{errors.nachname}</p>}
        </div>
      </div>

      {/* Personalnummer */}
      <div>
        <label className="label">Personalnummer <span className="text-credo-500 font-normal">(optional)</span></label>
        <input
          type="text"
          className="input-field"
          placeholder="12345"
          value={data.personalNr}
          onChange={e => update('personalNr', e.target.value)}
        />
      </div>

      {/* Bankdaten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">IBAN *</label>
          <input
            type="text"
            className={`input-field font-mono ${
              errors.iban || (data.iban.length === 22 && !validateIBAN(data.iban))
                ? 'border-red-400 focus:ring-red-400'
                : data.iban.length === 22 && validateIBAN(data.iban)
                  ? 'border-emerald-400 focus:ring-emerald-400'
                  : ''
            }`}
            placeholder="DE89 3704 0044 0532 0130 00"
            value={formatIBAN(data.iban)}
            onChange={e => handleIbanInput(e.target.value)}
          />
          {errors.iban && <p className="text-xs text-red-500 mt-1">{errors.iban}</p>}
          {!errors.iban && data.iban.length === 22 && !validateIBAN(data.iban) && (
            <p className="text-xs text-red-500 mt-1">IBAN-Prüfsumme ungültig — bitte überprüfen</p>
          )}
          {!errors.iban && data.iban.length > 0 && data.iban.length < 22 && (
            <p className="text-xs text-credo-400 mt-1">{data.iban.length}/22 Zeichen</p>
          )}
          {data.iban.length === 22 && validateIBAN(data.iban) && (
            <p className="text-xs text-emerald-600 mt-1">IBAN gültig</p>
          )}
        </div>
        <div>
          <label className="label">Kontoinhaber *</label>
          <input
            type="text"
            className={`input-field ${errors.kontoinhaber ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="Max Mustermann"
            value={data.kontoinhaber}
            onChange={e => update('kontoinhaber', e.target.value)}
          />
          {errors.kontoinhaber && <p className="text-xs text-red-500 mt-1">{errors.kontoinhaber}</p>}
        </div>
      </div>

      {/* Mandant + Kostenstelle */}
      <div className={kstAnzeigen ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
        <div>
          <label className="label">Mandant *</label>
          <select
            className={`input-field ${errors.mandantId ? 'border-red-400 focus:ring-red-400' : ''}`}
            value={data.mandantId}
            onChange={e => update('mandantId', e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {Object.entries(gruppiert).map(([kategorie, mandantenInGruppe]) => (
              <optgroup key={kategorie} label={kategorie}>
                {mandantenInGruppe.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.mandantNr})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.mandantId && <p className="text-xs text-red-500 mt-1">{errors.mandantId}</p>}
        </div>
        {kstAnzeigen && (
          <div>
            <label className="label">Kostenstelle <span className="text-credo-500 font-normal">(optional)</span></label>
            <select
              className="input-field"
              value={data.kostenstelleId}
              onChange={e => update('kostenstelleId', e.target.value)}
              disabled={!data.mandantId}
            >
              <option value="">
                {data.mandantId ? 'Keine Auswahl' : 'Bitte zuerst Mandant wählen...'}
              </option>
              {kostenstellen.map(k => (
                <option key={k.id} value={k.id}>
                  {k.nummer} — {k.bezeichnung}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
