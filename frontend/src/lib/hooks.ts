import { useState, useEffect, useRef } from 'react';
import type { Mandant, Kostenstelle, ErstattungKategorie } from './types';
import { apiFetch } from './utils';

// ── Warnung bei Datenverlust (beforeunload) ────────────
//
// Browser-Bug: Listener-Re-Registrierung pro Render verlor die Warnung in
// einigen Browsern, ausserdem wird das Event ohne `returnValue = ''` von
// Chrome/Edge ignoriert. Der Hook benutzt einen ref, damit der Listener
// stabil registriert ist und immer den aktuellen Stand kennt.

export function useUnsavedWarning(hasUnsavedData: boolean): void {
  const ref = useRef(hasUnsavedData);
  ref.current = hasUnsavedData;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (ref.current) {
        e.preventDefault();
        // Chrome/Edge ignorieren preventDefault ohne returnValue.
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}

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

// ── Erstattungs-Kategorien laden (abhängig von Mandant) ─

export function useKategorien(mandantId: string) {
  const [kategorien, setKategorien] = useState<ErstattungKategorie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mandantId) {
      setKategorien([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    apiFetch<ErstattungKategorie[]>(`/kategorien/${mandantId}`)
      .then((data) => {
        setKategorien(data);
        setError(null);
      })
      .catch((err) => {
        setKategorien([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Kategorien konnten nicht geladen werden. API nicht erreichbar.',
        );
      })
      .finally(() => setLoading(false));
  }, [mandantId]);

  return { kategorien, loading, error };
}

// ── Auslandspauschalen laden (DB-gepflegt im AdminCenter) ──

/** Ein Satzstand eines Landes (GET /api/pauschalen/ausland liefert je Land alle Stände). */
export interface AuslandsPauschale {
  landKey: string;
  /** Erster Gültigkeitstag 'YYYY-MM-DD'. */
  gueltigVon: string;
  /** Rechtsquelle, z. B. 'BMF-Schreiben vom 05.12.2025'. */
  quelle: string;
  tagessatz24h: number;
  tagessatz8h: number;
  uebernachtung: number;
  reihenfolge: number;
}

/**
 * Alle Satzstände aller Länder. Den Satz je Reisetag wählt die Vorschau mit derselben reinen
 * Funktion wie der Server (waehleTagesSatz in lib/reisetage.ts); die Länderauswahl braucht jedes
 * Land einmal (laenderZumDatum).
 */
export function useAuslandsPauschalen() {
  const [staende, setStaende] = useState<AuslandsPauschale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuslandsPauschale[]>('/pauschalen/ausland')
      .then((data) => {
        setStaende(data);
        setError(null);
      })
      .catch((err) => {
        setStaende([]);
        setError(
          err instanceof Error
            ? err.message
            : 'Auslandspauschalen konnten nicht geladen werden.',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return { staende, loading, error };
}
