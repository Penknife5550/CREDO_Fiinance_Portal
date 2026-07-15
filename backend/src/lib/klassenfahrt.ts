/**
 * Klassenfahrt-Zuschussberechnung (Teil 3) — server-autoritativ.
 *
 * Zielgroesse ist der FV-Zuschuss je Klasse: der Foerderverein traegt genau eine
 * Personen-Quote (= Kosten pro Person) je Klasse. Der Client darf eine Live-Vorschau
 * mit demselben Algorithmus zeigen (frontend/src/lib/klassenfahrt.ts als Zwilling),
 * aber der Server rechnet immer neu — Client-Zahlen werden nie vertraut.
 *
 * Verteilung je Kostenzeile:
 *  - PROPORTIONAL: Gesamtbetrag nach Schuelerzahl (Begleiter zaehlen NICHT mit).
 *  - DIREKT:       Betrag je Klasse manuell (anteile[]); Zeilensumme = Summe der Anteile.
 *
 * Zuschuss je Klasse = K / (Schueler + Begleiter), je Klasse auf Cent gerundet
 * (= tatsaechliche Auszahlung je Klassenkonto), Guard >= 0. Gesamt = Summe der
 * gerundeten Klassenwerte (NICHT Summe-dann-runden) — nur so stimmt die
 * Auszahlungstabelle mit dem Gesamtbetrag ueberein (IKS-konsistent; 3-Klassen-
 * Beispiel = 281,80 EUR).
 */

export type Verteilmodus = 'PROPORTIONAL' | 'DIREKT';

export interface KfKlasseInput {
  /** Schuelerzahl (Ganzzahl, >= 0). */
  schueler: number;
  /** Begleitpersonen (Dezimal erlaubt, z.B. 1,5; Pflicht >= 1). */
  begleiter: number;
}

export interface KfKostenzeileInput {
  modus: Verteilmodus;
  /** PROPORTIONAL: Gesamtbetrag der Zeile. DIREKT: informativ (Summe der anteile). */
  betrag: number;
  /** DIREKT: Betrag je Klasse (Index = Klassenindex, Laenge = Anzahl Klassen). */
  anteile?: number[];
}

export interface KfKlasseErgebnis {
  /** Summe der Kostenanteile dieser Klasse (auf Cent gerundet, nur Anzeige). */
  kostenanteil: number;
  /** Kosten pro Person in voller Praezision (K / (S+B)). */
  kostenProPerson: number;
  /** FV-Zuschuss = Auszahlung auf das Klassenkonto (Cent-gerundet, >= 0). */
  zuschuss: number;
}

export interface KfErgebnis {
  klassen: KfKlasseErgebnis[];
  /** Summe der (gerundeten) Klassen-Zuschuesse. */
  gesamtZuschuss: number;
  /**
   * Aufteilungs-Matrix in voller Praezision: verteilung[zeileIndex][klasseIndex] =
   * der auf diese Klasse entfallende Anteil dieser Kostenzeile. Spaltensumme je Klasse
   * = deren Kostenanteil K. Basis fuer die transparente Aufteilungstabelle im PDF
   * (nachvollziehbar, wie K und damit der Zuschuss zustande kommen).
   */
  verteilung: number[][];
}

/** Fachlicher Berechnungsfehler mit deutscher Meldung (fuer 400-Antwort bzw. Client-Guard). */
export class KlassenfahrtBerechnungsfehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KlassenfahrtBerechnungsfehler';
  }
}

/** Kaufmaennisch auf Cent runden (Half-Up), robust gegen Float-Halbcent-Fehler. */
export function rundeAufCent(n: number): number {
  // + EPSILON * sign faengt Faelle wie 1.005 ab, die binaer knapp unter .005 liegen.
  const sign = n < 0 ? -1 : 1;
  return sign * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Berechnet die FV-Zuschuesse je Klasse und den Gesamtbetrag. Wirft
 * KlassenfahrtBerechnungsfehler bei fachlich unmoeglichen Eingaben
 * (proportionale Kosten ohne Schueler, Klasse ohne Personen).
 */
export function berechneKlassenfahrt(
  klassen: KfKlasseInput[],
  kostenzeilen: KfKostenzeileInput[],
): KfErgebnis {
  if (klassen.length === 0) {
    throw new KlassenfahrtBerechnungsfehler('Mindestens eine Klasse ist erforderlich.');
  }

  const sigmaSchueler = klassen.reduce((s, k) => s + k.schueler, 0);

  // Kostenanteil je Klasse in voller Praezision aufsummieren; je Zeile den
  // Klassenanteil festhalten (Aufteilungs-Matrix fuer die PDF-Transparenz).
  const kProKlasse = klassen.map(() => 0);
  const verteilung: number[][] = [];
  for (const zeile of kostenzeilen) {
    let zeileAnteile: number[];
    if (zeile.modus === 'PROPORTIONAL') {
      if (sigmaSchueler <= 0) {
        throw new KlassenfahrtBerechnungsfehler(
          'Proportional verteilte Kosten sind ohne erfasste Schueler nicht moeglich.',
        );
      }
      zeileAnteile = klassen.map(k => zeile.betrag * (k.schueler / sigmaSchueler));
    } else {
      const anteile = zeile.anteile ?? [];
      zeileAnteile = klassen.map((_, i) => anteile[i] ?? 0);
    }
    verteilung.push(zeileAnteile);
    for (let i = 0; i < klassen.length; i++) {
      kProKlasse[i] += zeileAnteile[i];
    }
  }

  const klassenErg: KfKlasseErgebnis[] = klassen.map((k, i) => {
    const personen = k.schueler + k.begleiter;
    if (personen <= 0) {
      throw new KlassenfahrtBerechnungsfehler(
        `Klasse ${i + 1}: Schueler + Begleitpersonen muss groesser als 0 sein.`,
      );
    }
    const kostenProPerson = kProKlasse[i] / personen; // volle Praezision
    // Auszahlung je Konto: cent-gerundet und nie negativ (Gutschriften duerfen keine
    // negative Ueberweisung erzeugen).
    const zuschuss = Math.max(0, rundeAufCent(kostenProPerson));
    return { kostenanteil: rundeAufCent(kProKlasse[i]), kostenProPerson, zuschuss };
  });

  // Gesamt = Summe der bereits gerundeten Auszahlungen (selbstkonsistent mit der Tabelle).
  const gesamtZuschuss = rundeAufCent(klassenErg.reduce((s, e) => s + e.zuschuss, 0));

  return { klassen: klassenErg, gesamtZuschuss, verteilung };
}
