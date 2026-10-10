export const EINREICHUNG_TYPEN = ['REISEKOSTEN', 'ERSTATTUNG', 'SAMMELFAHRT', 'KLASSENFAHRT'] as const;
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

// Auslandspauschalen: reservierte Schlüssel der Länderauswahl (Inland bzw. Sonderfälle
// „Staat nicht in der Liste“ und „Seetag“) — dürfen nicht als Land in
// `pauschalen_ausland` angelegt werden (Vergleich ohne Groß-/Kleinschreibung).
export const LAND_INLAND = 'INLAND';
export const LAND_ANDERES = 'ANDERES'; // Staat nicht in der Liste → Satz Luxemburg, Freitext Pflicht
export const LAND_SEETAG = 'SEETAG';   // ganzer Tag an Bord (nur GANZTAG) → Satz Luxemburg
export const RESERVIERTE_LAND_KEYS: readonly string[] = [LAND_INLAND, LAND_ANDERES, LAND_SEETAG];

// Gesetzlicher Ersatzsatz für nicht aufgeführte Staaten (BMF-Schreiben vom 05.12.2025)
// und Seetage (R 9.6 Abs. 3 LStR) — dieser Eintrag darf nie gelöscht werden.
export const FALLBACK_LAND_KEY = 'Luxemburg';
