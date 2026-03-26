// ── API-Typen ──────────────────────────────────────────

export interface Mandant {
  id: string;
  mandantNr: number;
  name: string;
  kategorie: string;
  primaerfarbe: string;
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

// ── Kategorien ─────────────────────────────────────────

export const ERSTATTUNG_KATEGORIEN = [
  { value: 'BUEROMATERIAL', label: 'Büromaterial' },
  { value: 'FACHLITERATUR', label: 'Fachliteratur' },
  { value: 'LEBENSMITTEL', label: 'Lebensmittel' },
  { value: 'ARBEITSMITTEL', label: 'Arbeitsmittel' },
  { value: 'FORTBILDUNG', label: 'Fortbildung' },
  { value: 'SONSTIGES', label: 'Sonstiges' },
] as const;

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
