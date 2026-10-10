import { describe, it, expect } from 'vitest';
import { erstelleReisekostenEmailText } from '../emailTexte.js';

const basis = {
  vorname: 'Anna',
  nachname: 'Muster',
  personalNr: '4711',
  mandantName: 'Testschule',
  mandantNr: '10',
  reiseziel: 'Brüssel',
  abfahrtZeit: '2026-03-16T08:00',
  rueckkehrZeit: '2026-03-19T18:00',
  gesamtbetrag: 166.2,
  iban: 'DE89370400440532013000',
  kontoinhaber: 'Anna Muster',
  pruefvermerke: [] as string[],
};

describe('erstelleReisekostenEmailText', () => {
  it('Auslandsreise: Reiseland-Zeile, Land je Mahlzeitenzeile, Kürzung vom Satz des Tageslandes', () => {
    const text = erstelleReisekostenEmailText({
      ...basis,
      land: 'Belgien',
      reiseland: ['Belgien', 'Niederlande', 'Luxemburg'],
      reisetage: [
        { datum: '2026-03-16', land: 'Belgien', fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false },
        { datum: '2026-03-17', land: 'Niederlande', fruehstueckGestellt: true, mittagGestellt: false, abendGestellt: false },
        { datum: '2026-03-18', land: 'Luxemburg', fruehstueckGestellt: true, mittagGestellt: false, abendGestellt: true },
      ],
    });
    expect(text).toContain('Reiseland: Belgien → Niederlande → Luxemburg');
    expect(text).toContain('17.03.2026 (Niederlande): F gestellt');
    expect(text).toContain('18.03.2026 (Luxemburg): F, A gestellt');
    expect(text).toContain('maßgebenden Landes');
    expect(text).not.toContain('immer auf den vollen Tagessatz (28 EUR)');
    expect(text).not.toContain('Prüfvermerk');
  });

  it('Inlandsreise: 28-EUR-Hinweis bleibt, keine Frühstück-19-%-Zeile mehr', () => {
    const text = erstelleReisekostenEmailText({
      ...basis,
      land: null,
      reiseland: ['Inland'],
      reisetage: [{ datum: '2026-03-16', land: 'Inland', fruehstueckGestellt: true, mittagGestellt: false, abendGestellt: false }],
    });
    expect(text).toContain('Reiseland: Inland');
    expect(text).toContain('16.03.2026 (Inland): F gestellt');
    expect(text).toContain('immer auf den vollen Tagessatz (28 EUR)');
    expect(text).not.toContain('19%');
    expect(text).not.toContain('19 %');
  });

  it('Prüfvermerke werden aufgeführt', () => {
    const vermerk = 'Überschneidung mit RK-2026-00007 am 16.03.2026: für diesen Tag ist nur die höhere Pauschale zulässig (BMF 05.12.2025). Bitte prüfen.';
    const text = erstelleReisekostenEmailText({ ...basis, land: null, reiseland: ['Inland'], reisetage: [], pruefvermerke: [vermerk] });
    expect(text).toContain(`Prüfvermerk:\n  ${vermerk}`);
  });
});
