import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { parseGermanDecimal } from '@/lib/utils';

// Number -> deutscher String. Ganze Zahlen ohne Komma, sonst mit. 0 -> ''.
function formatGerman(n: number): string {
  if (!n) return '';
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value: number;
  onChange: (n: number) => void;
}

/**
 * DE-Dezimal-Input: hält intern einen String-State, damit das Komma während
 * der Eingabe nicht durch Re-Parsing nach Number verschwindet (klassischer
 * controlled-input-Bug bei "66," -> 66 -> render "66").
 *
 * Externer Wert wird nur synchronisiert, solange das Feld unfokussiert ist;
 * beim Blur wird der String aus dem Number normalisiert.
 */
export function DezimalInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(() => formatGerman(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatGerman(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        const n = parseGermanDecimal(text);
        setText(formatGerman(n));
        if (n !== value) onChange(n);
      }}
      onChange={e => {
        const v = e.target.value;
        if (v !== '' && !/^[\d.,\s]*$/.test(v)) return;
        setText(v);
        onChange(parseGermanDecimal(v));
      }}
      {...rest}
    />
  );
}
