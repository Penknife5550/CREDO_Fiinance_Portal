import { describe, it, expect } from 'vitest';
import { validateIBAN, formatIBAN, formatCurrency, formatDate } from '../utils';

describe('validateIBAN', () => {
  it('akzeptiert gültige deutsche IBAN', () => {
    expect(validateIBAN('DE89370400440532013000')).toBe(true);
  });

  it('akzeptiert IBAN mit Leerzeichen', () => {
    expect(validateIBAN('DE89 3704 0044 0532 0130 00')).toBe(true);
  });

  it('akzeptiert IBAN in Kleinbuchstaben', () => {
    expect(validateIBAN('de89370400440532013000')).toBe(true);
  });

  it('lehnt IBAN mit falscher Prüfziffer ab', () => {
    expect(validateIBAN('DE00370400440532013000')).toBe(false);
  });

  it('lehnt zu kurze IBAN ab', () => {
    expect(validateIBAN('DE893704004405320130')).toBe(false);
  });

  it('lehnt nicht-deutsche IBAN ab', () => {
    expect(validateIBAN('FR7630006000011234567890189')).toBe(false);
  });

  it('lehnt leeren String ab', () => {
    expect(validateIBAN('')).toBe(false);
  });

  it('lehnt Buchstaben in Kontonummer ab', () => {
    expect(validateIBAN('DE89ABCDEFGHIJKLMNOPQR')).toBe(false);
  });
});

describe('formatIBAN', () => {
  it('formatiert IBAN in 4er-Gruppen', () => {
    expect(formatIBAN('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });

  it('entfernt bestehende Leerzeichen', () => {
    expect(formatIBAN('DE89 3704 0044 0532 0130 00')).toBe('DE89 3704 0044 0532 0130 00');
  });
});

describe('formatCurrency', () => {
  it('formatiert positive Beträge korrekt', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1.234,56');
    expect(result).toContain('€');
  });

  it('formatiert 0 korrekt', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0,00');
  });

  it('formatiert negative Beträge korrekt', () => {
    const result = formatCurrency(-50.99);
    expect(result).toContain('50,99');
  });
});

describe('formatDate', () => {
  it('formatiert Datum im deutschen Format', () => {
    const result = formatDate('2026-03-15');
    expect(result).toBe('15.03.2026');
  });

  it('akzeptiert Date-Objekte', () => {
    const result = formatDate(new Date(2026, 0, 5));
    expect(result).toBe('05.01.2026');
  });
});
