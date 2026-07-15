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

// ── Klassenfahrt einreichen (nur Mandant 40) ────────────

interface KlassenfahrtPayload {
  mandantId: string;
  einreicher: { vorname: string; nachname: string; personalNr: string };
  anlass: string;
  ziel: string;
  zeitraumVon: string;
  zeitraumBis: string;
  klassen: Array<{ bezeichnung: string; schueler: number; begleiter: number; empfaenger: string; iban: string }>;
  kostenzeilen: Array<{ oberkategorie: string; bezeichnung: string; modus: 'PROPORTIONAL' | 'DIREKT'; betrag: number; anteile: number[] }>;
  unterschriftBild?: string;
  belege: File[];
  /** Einmal pro Formular-Instanz erzeugt (crypto.randomUUID) — Schutz gegen Doppel-Submit. */
  idempotenzKey: string;
}

export async function einreichenKlassenfahrt(payload: KlassenfahrtPayload): Promise<{ belegNr: string }> {
  const belegDateipfade = await uploadBelege(payload.belege);

  const res = await fetch(`${API}/einreichungen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      typ: 'KLASSENFAHRT',
      mandantId: payload.mandantId,
      einreicher: {
        vorname: payload.einreicher.vorname,
        nachname: payload.einreicher.nachname,
        personalNr: payload.einreicher.personalNr,
      },
      anlass: payload.anlass,
      ziel: payload.ziel || undefined,
      zeitraumVon: payload.zeitraumVon,
      zeitraumBis: payload.zeitraumBis,
      klassen: payload.klassen.map(k => ({
        bezeichnung: k.bezeichnung || undefined,
        schueler: k.schueler,
        begleiter: k.begleiter,
        empfaenger: k.empfaenger,
        iban: k.iban.replace(/\s/g, '').toUpperCase(),
      })),
      // DIREKT liefert die Anteile je Klasse; PROPORTIONAL braucht sie nicht.
      kostenzeilen: payload.kostenzeilen.map(z => ({
        oberkategorie: z.oberkategorie,
        bezeichnung: z.bezeichnung,
        modus: z.modus,
        betrag: z.betrag,
        anteile: z.modus === 'DIREKT' ? z.anteile : undefined,
      })),
      unterschriftBild: payload.unterschriftBild,
      belegDateipfade,
      idempotenzKey: payload.idempotenzKey,
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
