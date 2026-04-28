import type { PersoenlicheDaten, Reisetag, WeitereKostenPosition, ErstattungPosition, Fahrt, SammelfahrtVerkehrsmittel } from './types';

const API = '/api';

// ── Belege hochladen ───────────────────────────────────

interface UploadResult {
  belege: Array<{
    originalname: string;
    dateipfad: string;
    sha256: string;
  }>;
}

export async function uploadBelege(dateien: File[]): Promise<string[]> {
  if (dateien.length === 0) return [];

  const formData = new FormData();
  for (const datei of dateien) {
    formData.append('belege', datei);
  }

  const res = await fetch(`${API}/einreichungen/belege`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error('Beleg-Upload fehlgeschlagen');
  const data: UploadResult = await res.json();
  return data.belege.map(b => b.dateipfad);
}

// ── Reisekosten einreichen ─────────────────────────────

interface ReisekostenPayload {
  persoenlich: PersoenlicheDaten;
  reiseanlass: string;
  reiseziel: string;
  abfahrtOrt: 'WOHNUNG' | 'TAETIGKEIT';
  abfahrtZeit: string;
  rueckkehrZeit: string;
  land: string | null;
  verkehrsmittel: string;
  kmGefahren: number;
  kmBetrag: number;
  reisetage: Reisetag[];
  vmaNetto: number;
  weitereKosten: WeitereKostenPosition[];
  weitereKostenSumme: number;
  gesamtbetrag: number;
  unterschriftBild?: string;
  belege: File[];
}

export async function einreichenReisekosten(payload: ReisekostenPayload): Promise<{ belegNr: string }> {
  // 1. Belege hochladen
  const belegDateipfade = await uploadBelege(payload.belege);

  // 2. Einreichung senden
  const res = await fetch(`${API}/einreichungen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      typ: 'REISEKOSTEN',
      persoenlich: {
        vorname: payload.persoenlich.vorname,
        nachname: payload.persoenlich.nachname,
        personalNr: payload.persoenlich.personalNr,
        iban: payload.persoenlich.iban,
        kontoinhaber: payload.persoenlich.kontoinhaber,
        mandantId: payload.persoenlich.mandantId,
        kostenstelleId: payload.persoenlich.kostenstelleId,
      },
      reiseanlass: payload.reiseanlass,
      reiseziel: payload.reiseziel,
      abfahrtOrt: payload.abfahrtOrt,
      abfahrtZeit: payload.abfahrtZeit,
      rueckkehrZeit: payload.rueckkehrZeit,
      land: payload.land,
      verkehrsmittel: payload.verkehrsmittel,
      kmGefahren: payload.kmGefahren,
      kmBetrag: payload.kmBetrag,
      reisetage: payload.reisetage,
      vmaNetto: payload.vmaNetto,
      weitereKosten: payload.weitereKosten.filter(k => k.betrag > 0),
      weitereKostenSumme: payload.weitereKostenSumme,
      gesamtbetrag: payload.gesamtbetrag,
      unterschriftBild: payload.unterschriftBild,
      belegDateipfade,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    const msg = err.detail ? `${err.error}: ${err.detail}` : (err.error || `Fehler ${res.status}`);
    throw new Error(msg);
  }

  const data = await res.json();
  return { belegNr: data.belegNr };
}

// ── Erstattung einreichen ──────────────────────────────

interface ErstattungPayload {
  persoenlich: PersoenlicheDaten;
  positionen: ErstattungPosition[];
  gesamtbetrag: number;
  unterschriftBild?: string;
  belege: File[];
}

// ── Sammelfahrt einreichen ──────────────────────────────

interface SammelfahrtPayload {
  persoenlich: PersoenlicheDaten;
  reiseanlass: string;
  verkehrsmittel: SammelfahrtVerkehrsmittel;
  fahrten: Fahrt[];
  kmSumme: number;
  gesamtbetrag: number;
  unterschriftBild?: string;
  belege: File[];
}

export async function einreichenSammelfahrt(payload: SammelfahrtPayload): Promise<{ belegNr: string }> {
  const belegDateipfade = await uploadBelege(payload.belege);

  const res = await fetch(`${API}/einreichungen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      typ: 'SAMMELFAHRT',
      persoenlich: {
        vorname: payload.persoenlich.vorname,
        nachname: payload.persoenlich.nachname,
        personalNr: payload.persoenlich.personalNr,
        iban: payload.persoenlich.iban,
        kontoinhaber: payload.persoenlich.kontoinhaber,
        mandantId: payload.persoenlich.mandantId,
        kostenstelleId: payload.persoenlich.kostenstelleId,
      },
      reiseanlass: payload.reiseanlass,
      verkehrsmittel: payload.verkehrsmittel,
      fahrten: payload.fahrten,
      kmSumme: payload.kmSumme,
      gesamtbetrag: payload.gesamtbetrag,
      unterschriftBild: payload.unterschriftBild,
      belegDateipfade,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    const msg = err.detail ? `${err.error}: ${err.detail}` : (err.error || `Fehler ${res.status}`);
    throw new Error(msg);
  }

  const data = await res.json();
  return { belegNr: data.belegNr };
}

export async function einreichenErstattung(payload: ErstattungPayload): Promise<{ belegNr: string }> {
  const belegDateipfade = await uploadBelege(payload.belege);

  const res = await fetch(`${API}/einreichungen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      typ: 'ERSTATTUNG',
      persoenlich: {
        vorname: payload.persoenlich.vorname,
        nachname: payload.persoenlich.nachname,
        personalNr: payload.persoenlich.personalNr,
        iban: payload.persoenlich.iban,
        kontoinhaber: payload.persoenlich.kontoinhaber,
        mandantId: payload.persoenlich.mandantId,
        kostenstelleId: payload.persoenlich.kostenstelleId,
      },
      positionen: payload.positionen,
      gesamtbetrag: payload.gesamtbetrag,
      unterschriftBild: payload.unterschriftBild,
      belegDateipfade,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
    const msg = err.detail ? `${err.error}: ${err.detail}` : (err.error || `Fehler ${res.status}`);
    throw new Error(msg);
  }

  const data = await res.json();
  return { belegNr: data.belegNr };
}
