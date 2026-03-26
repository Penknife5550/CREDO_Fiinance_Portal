import { useState, useEffect } from 'react';
import type { Mandant, Kostenstelle } from './types';
import { apiFetch } from './utils';

// ── Mandanten laden ────────────────────────────────────

export function useMandanten() {
  const [mandanten, setMandanten] = useState<Mandant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Mandant[]>('/mandanten')
      .then((data) => {
        setMandanten(data);
        setError(null);
      })
      .catch((err) => {
        setMandanten([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Mandanten konnten nicht geladen werden. API nicht erreichbar.',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Gruppiert nach Kategorie
  const gruppiert = mandanten.reduce<Record<string, Mandant[]>>((acc, m) => {
    (acc[m.kategorie] ??= []).push(m);
    return acc;
  }, {});

  return { mandanten, gruppiert, loading, error };
}

// ── Kostenstellen laden (abhängig von Mandant) ─────────

export function useKostenstellen(mandantId: string) {
  const [kostenstellen, setKostenstellen] = useState<Kostenstelle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mandantId) {
      setKostenstellen([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    apiFetch<Kostenstelle[]>(`/kostenstellen/${mandantId}`)
      .then((data) => {
        setKostenstellen(data);
        setError(null);
      })
      .catch((err) => {
        setKostenstellen([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Kostenstellen konnten nicht geladen werden. API nicht erreichbar.',
        );
      })
      .finally(() => setLoading(false));
  }, [mandantId]);

  return { kostenstellen, loading, error };
}
