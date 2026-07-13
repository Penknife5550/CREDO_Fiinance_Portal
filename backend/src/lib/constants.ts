export const EINREICHUNG_TYPEN = ['REISEKOSTEN', 'ERSTATTUNG', 'SAMMELFAHRT'] as const;
export type EinreichungTyp = typeof EINREICHUNG_TYPEN[number];

export const TYP_FILTER_VALUES = ['ALLE', ...EINREICHUNG_TYPEN] as const;
export type TypFilter = typeof TYP_FILTER_VALUES[number];

// Standard-Erstattungskategorien. Werden pro Mandant in `erstattung_kategorien`
// geseedet; dienen zusaetzlich als Fallback, falls ein Mandant (noch) keine
// eigenen Kategorien hinterlegt hat.
export const ERSTATTUNG_KATEGORIEN_DEFAULT = [
  { key: 'BUEROMATERIAL', label: 'Büromaterial', reihenfolge: 10 },
  { key: 'FACHLITERATUR', label: 'Fachliteratur', reihenfolge: 20 },
  { key: 'LEBENSMITTEL', label: 'Lebensmittel', reihenfolge: 30 },
  { key: 'ARBEITSMITTEL', label: 'Arbeitsmittel', reihenfolge: 40 },
  { key: 'FORTBILDUNG', label: 'Fortbildung', reihenfolge: 50 },
  { key: 'SONSTIGES', label: 'Sonstiges', reihenfolge: 60 },
] as const;

export const ERSTATTUNG_KATEGORIE_DEFAULT_KEYS: readonly string[] =
  ERSTATTUNG_KATEGORIEN_DEFAULT.map(k => k.key);
