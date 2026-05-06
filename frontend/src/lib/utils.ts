import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = '/api';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

export function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (!/^DE\d{20}$/.test(cleaned)) return false;

  // IBAN-Prüfsumme (ISO 13616 / mod-97)
  // Ländercode + Prüfziffer ans Ende verschieben, Buchstaben in Zahlen umwandeln
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numStr = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));

  // mod 97 auf großer Zahl (stückweise berechnen)
  let remainder = 0;
  for (const digit of numStr) {
    remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
  }
  return remainder === 1;
}

export function formatIBAN(iban: string): string {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Parsed Dezimalzahlen aus Eingaben mit deutschem Komma ODER Punkt.
 * `<input type="number">` akzeptiert in DE-Locale kein Komma — nutze daher
 * `<input type="text" inputMode="decimal">` und diese Funktion zum Parsen.
 * Gibt 0 zurueck bei leerer/ungueltiger Eingabe.
 */
export function parseGermanDecimal(value: string): number {
  if (!value) return 0;
  // Tausender-Punkte/Spaces entfernen, Komma -> Punkt
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // 1.234,56 -> 1234,56
    .replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}
