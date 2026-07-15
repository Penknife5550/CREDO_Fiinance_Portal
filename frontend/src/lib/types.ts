// ── API-Typen ──────────────────────────────────────────

export type Vorgangstyp = 'reisekosten' | 'erstattung' | 'sammelfahrt';

export type KstField = 'kstReisekostenAn' | 'kstErstattungAn' | 'kstSammelfahrtAn';

export const VORGANGSTYP_META: Record<Vorgangstyp, { kuerzel: string; label: string; kstFlag: KstField }> = {
  reisekosten: { kuerzel: 'RK', label: 'Reisekosten', kstFlag: 'kstReisekostenAn' },
  erstattung: { kuerzel: 'KE', label: 'Erstattung', kstFlag: 'kstErstattungAn' },
  sammelfahrt: { kuerzel: 'SF', label: 'Sammelfahrt', kstFlag: 'kstSammelfahrtAn' },
};

// Default = anzeigen. undefined kommt vor, wenn die API das Feld noch nicht liefert.
export function istKstAn(m: Pick<MandantBase, KstField> | undefined, vorgangstyp: Vorgangstyp): boolean {
  if (!m) return true;
  return m[VORGANGSTYP_META[vorgangstyp].kstFlag] !== false;
}

export interface MandantBase {
  id: string;
  mandantNr: number;
  name: string;
  kategorie: string;
  primaerfarbe: string;
  kstReisekostenAn?: boolean;
  kstErstattungAn?: boolean;
  kstSammelfahrtAn?: boolean;
}

// Public-View, wie sie GET /api/mandanten zurückgibt
export type Mandant = MandantBase;

// Admin-View mit zusätzlichen Audit-Feldern (PUT/POST /api/admin/mandanten)
export interface MandantAdmin extends MandantBase {
  dmsEmail: string;
  logo: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Kostenstelle {
  id: string;
  bezeichnung: string;
  nummer: string;
}

// ── Formular-Typen ─────────────────────────────────────

export interface PersoenlicheDaten {
  vorname: string;
  nachname: string;
  personalNr: string;
  iban: string;
  kontoinhaber: string;
  mandantId: string;
  kostenstelleId: string;
}

export interface Reisetag {
  datum: string;
  typ: 'ANREISE' | 'GANZTAG' | 'ABREISE' | 'EINTAEGIG';
  fruehstueckGestellt: boolean;
  mittagGestellt: boolean;
  abendGestellt: boolean;
  vmaBrutto: number;
  vmaKuerzung: number;
  vmaNetto: number;
}

export interface WeitereKostenPosition {
  typ: string;
  beschreibung: string;
  betrag: number;
  belegDatei?: File;
}

export interface ReisekostenFormData {
  persoenlich: PersoenlicheDaten;
  reiseanlass: string;
  reiseziel: string;
  abfahrtOrt: 'WOHNUNG' | 'TAETIGKEIT';
  abfahrtZeit: string;
  rueckkehrZeit: string;
  inlandAusland: 'inland' | 'ausland';
  land?: string;
  verkehrsmittel: string;
  kmGefahren: number;
  kmBetrag: number;
  reisetage: Reisetag[];
  vmaGesamt: number;
  weitereKosten: WeitereKostenPosition[];
  weitereKostenSumme: number;
  gesamtbetrag: number;
  unterschriftBild?: string;
}

export interface ErstattungPosition {
  beschreibung: string;
  kategorie: string;
  datum: string;
  betrag: number;
  belegDatei?: File;
}

export interface ErstattungFormData {
  persoenlich: PersoenlicheDaten;
  positionen: ErstattungPosition[];
  gesamtbetrag: number;
  unterschriftBild?: string;
}

// ── Sammelfahrt ─────────────────────────────────────────

export type SammelfahrtVerkehrsmittel = 'PKW' | 'MOTORRAD';

export interface Fahrt {
  datum: string;
  startOrt: string;
  ziel: string;
  km: number;
  kmBetrag: number;
}

export interface SammelfahrtFormData {
  persoenlich: PersoenlicheDaten;
  reiseanlass: string;
  verkehrsmittel: SammelfahrtVerkehrsmittel;
  defaultStartOrt: string;
  fahrten: Fahrt[];
  kmSumme: number;
  gesamtbetrag: number;
  unterschriftBild?: string;
}

// ── Kategorien ─────────────────────────────────────────

// Erstattungs-Kategorie, wie sie GET /api/kategorien/:mandantId zurückgibt.
export interface ErstattungKategorie {
  key: string;
  label: string;
  reihenfolge: number;
}

// Fallback, falls für einen Mandanten (noch) keine Kategorien gepflegt sind.
export const ERSTATTUNG_KATEGORIEN = [
  { value: 'BUEROMATERIAL', label: 'Büromaterial' },
  { value: 'FACHLITERATUR', label: 'Fachliteratur' },
  { value: 'LEBENSMITTEL', label: 'Lebensmittel' },
  { value: 'ARBEITSMITTEL', label: 'Arbeitsmittel' },
  { value: 'FORTBILDUNG', label: 'Fortbildung' },
  { value: 'SONSTIGES', label: 'Sonstiges' },
] as const;

// Fallback-Liste im {key,label}-Format der API (für den Wizard, wenn keine DB-Kategorien vorliegen).
export const ERSTATTUNG_KATEGORIEN_FALLBACK: ErstattungKategorie[] = ERSTATTUNG_KATEGORIEN.map((k, i) => ({
  key: k.value,
  label: k.label,
  reihenfolge: (i + 1) * 10,
}));

export const VERKEHRSMITTEL = [
  { value: 'PKW', label: 'PKW' },
  { value: 'MOTORRAD', label: 'Motorrad' },
  { value: 'OEPNV', label: 'ÖPNV' },
  { value: 'BAHN', label: 'Bahn' },
  { value: 'FLUG', label: 'Flug' },
  { value: 'SONSTIGE', label: 'Sonstiges' },
] as const;

export const WEITERE_KOSTEN_TYPEN = [
  { value: 'UEBERNACHTUNG', label: 'Übernachtung' },
  { value: 'PARKEN', label: 'Parkgebühren' },
  { value: 'MAUT', label: 'Maut' },
  { value: 'SONSTIGE', label: 'Sonstige Nebenkosten' },
] as const;

// ── Klassenfahrt (nur Mandant 40 = Förderverein) ───────

export type KfOberkategorie = 'FAHRTKOSTEN' | 'UNTERKUNFT' | 'AKTIVITAETEN' | 'SONSTIGES';
export type KfVerteilmodus = 'PROPORTIONAL' | 'DIREKT';

export const KF_OBERKATEGORIEN: { value: KfOberkategorie; label: string }[] = [
  { value: 'FAHRTKOSTEN', label: 'Fahrtkosten' },
  { value: 'UNTERKUNFT', label: 'Unterkunft' },
  { value: 'AKTIVITAETEN', label: 'Aktivitäten' },
  { value: 'SONSTIGES', label: 'Sonstiges' },
];

export const KF_MAX_KLASSEN = 5;
export const KF_MAX_KOSTENZEILEN = 50;

export interface KfEinreicher {
  vorname: string;
  nachname: string;
  personalNr: string;
}

export interface KfKlasseForm {
  bezeichnung: string;
  schueler: number;
  begleiter: number;
  empfaenger: string;
  iban: string;
}

export interface KfKostenzeileForm {
  oberkategorie: KfOberkategorie;
  bezeichnung: string;
  modus: KfVerteilmodus;
  betrag: number;      // PROPORTIONAL: Gesamt; DIREKT: informativ (= Summe der Anteile)
  anteile: number[];   // je Klasse (nur bei DIREKT genutzt); Länge = Anzahl Klassen
}

export interface KlassenfahrtFormData {
  einreicher: KfEinreicher;
  anlass: string;
  ziel: string;
  zeitraumVon: string;
  zeitraumBis: string;
  klassen: KfKlasseForm[];
  kostenzeilen: KfKostenzeileForm[];
  unterschriftBild?: string;
}
