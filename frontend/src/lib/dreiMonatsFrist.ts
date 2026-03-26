// ── 3-Monats-Frist Warnung (VMA bei gleicher Tätigkeitsstätte) ──

const STORAGE_KEY = 'credo_reiseziele';
const FRIST_TAGE = 90;

interface GespeichertesReiseziel {
  ziel: string;
  datum: string; // ISO-String
}

interface DreiMonatsFristErgebnis {
  warnung: boolean;
  ersteSeit: string | null;
  anzahl: number;
}

/** Berechnet einfache Zeichenübereinstimmung (>= 70% = Match) */
function aehnlich(a: string, b: string): boolean {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();

  if (normA === normB) return true;
  if (normA.length === 0 || normB.length === 0) return false;

  // Prüfe ob einer im anderen enthalten ist
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Einfacher Zeichenübereinstimmungs-Check
  const kuerzer = normA.length <= normB.length ? normA : normB;
  const laenger = normA.length <= normB.length ? normB : normA;

  let treffer = 0;
  for (let i = 0; i < kuerzer.length; i++) {
    if (laenger.includes(kuerzer[i])) {
      treffer++;
    }
  }

  const uebereinstimmung = treffer / Math.max(normA.length, normB.length);
  return uebereinstimmung >= 0.7;
}

/** Prüft ob ein Reiseziel in den letzten 90 Tagen bereits verwendet wurde */
export function pruefeDreiMonatsFrist(ziel: string): DreiMonatsFristErgebnis {
  if (!ziel || ziel.trim().length === 0) {
    return { warnung: false, ersteSeit: null, anzahl: 0 };
  }

  const gespeicherte = ladeReiseziele();
  const jetzt = new Date();
  const grenze = new Date(jetzt.getTime() - FRIST_TAGE * 24 * 60 * 60 * 1000);

  const treffer = gespeicherte.filter(g => {
    const datum = new Date(g.datum);
    return datum >= grenze && aehnlich(ziel, g.ziel);
  });

  if (treffer.length === 0) {
    return { warnung: false, ersteSeit: null, anzahl: 0 };
  }

  // Frühestes Datum finden
  treffer.sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());

  return {
    warnung: true,
    ersteSeit: treffer[0].datum,
    anzahl: treffer.length,
  };
}

/** Speichert ein Reiseziel mit aktuellem Datum in localStorage */
export function speichereReiseziel(ziel: string): void {
  if (!ziel || ziel.trim().length === 0) return;

  const gespeicherte = ladeReiseziele();
  gespeicherte.push({ ziel: ziel.trim(), datum: new Date().toISOString() });

  // Nur Einträge der letzten 6 Monate behalten (Aufräumen)
  const grenze = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const bereinigt = gespeicherte.filter(g => new Date(g.datum) >= grenze);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bereinigt));
  } catch {
    // localStorage voll oder nicht verfügbar — ignorieren
  }
}

function ladeReiseziele(): GespeichertesReiseziel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GespeichertesReiseziel[];
  } catch {
    return [];
  }
}
