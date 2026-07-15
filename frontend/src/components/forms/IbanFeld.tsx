import { useState } from 'react';
import { validateIBAN, formatIBAN } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (iban: string) => void;
  id?: string;
  /** Externer Fehler (z.B. aus der Schritt-Validierung) — hat Vorrang vor der Live-Prüfung. */
  error?: string;
  placeholder?: string;
  'aria-label'?: string;
}

/**
 * IBAN-Eingabe mit Live-Validierung (mod-97 aus utils). Speichert intern IMMER
 * die bereinigte Form (ohne Leerzeichen, Großbuchstaben) — passt damit direkt zum
 * Server-Kontrakt DE\d{20}. Angezeigt wird bei Blur die 4er-gruppierte Form.
 * Wiederverwendbar je Klassenkonto.
 */
export function IbanFeld({ value, onChange, id, error, placeholder, 'aria-label': ariaLabel }: Props) {
  const [focused, setFocused] = useState(false);
  const istGueltig = validateIBAN(value);
  const zeigeFehler = !!error || (!focused && value.length > 0 && !istGueltig);
  const display = focused ? value : value ? formatIBAN(value) : '';

  return (
    <div>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        aria-invalid={zeigeFehler}
        className={`input-field font-mono ${zeigeFehler ? 'border-red-400' : ''}`}
        placeholder={placeholder ?? 'DE00 0000 0000 0000 0000 00'}
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(e.target.value.replace(/\s/g, '').toUpperCase())}
      />
      {zeigeFehler && (
        <p className="text-xs text-red-500 mt-1">
          {error || 'Bitte gültige deutsche IBAN eingeben (DE + 20 Ziffern).'}
        </p>
      )}
    </div>
  );
}
