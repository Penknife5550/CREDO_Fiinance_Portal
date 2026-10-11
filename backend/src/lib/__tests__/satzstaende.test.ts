import { describe, it, expect } from 'vitest';
import {
  auslandspauschaleSchema, auslandspauschaleUpdateSchema, satzstandSchluessel, istUniqueViolation,
  meldungOhneJahresstand, MELDUNG_8H_UEBER_24H, MAX_TAGESSATZ,
} from '../satzstaende.js';

const GUELTIG = {
  landKey: 'Belgien',
  gueltigVon: '2026-01-01',
  quelle: 'BMF-Schreiben vom 05.12.2025',
  tagessatz24h: 59,
  tagessatz8h: 40,
  uebernachtung: 141,
};

/** Meldungen der Zod-Fehler je Feld (erstes Pfadelement). */
function fehler(ergebnis: { success: boolean; error?: { errors: Array<{ path: (string | number)[]; message: string }> } }) {
  return (ergebnis.error?.errors ?? []).map(e => `${String(e.path[0])}: ${e.message}`);
}

describe('auslandspauschaleSchema (POST)', () => {
  it('nimmt einen gültigen Stand an', () => {
    expect(auslandspauschaleSchema.safeParse(GUELTIG).success).toBe(true);
  });

  it('trimmt Land und Quelle', () => {
    const p = auslandspauschaleSchema.parse({ ...GUELTIG, landKey: '  Belgien ', quelle: ' BMF \n' });
    expect(p.landKey).toBe('Belgien');
    expect(p.quelle).toBe('BMF');
  });

  it.each([
    'Test 100%', 'A%41', 'Bel\ngien', 'Bel\tgien', 'Bel\u0000gien', 'Bel\u007Fgien', '   ',
    'Bel\u2028gien', 'Bel\u2029gien', 'Bel\u202Egien', 'Bel\u2066gien', 'Bel\u200Bgien',
  ])(
    'lehnt Land %j ab (Steuerzeichen, %, leer)',
    landKey => {
      const r = auslandspauschaleSchema.safeParse({ ...GUELTIG, landKey });
      expect(r.success).toBe(false);
      expect(fehler(r)[0]).toMatch(/^landKey: /);
    },
  );

  it('erlaubt Gedankenstrich, Umlaute und Klammern im Land', () => {
    expect(auslandspauschaleSchema.safeParse({ ...GUELTIG, landKey: 'Frankreich — Paris' }).success).toBe(true);
    expect(auslandspauschaleSchema.safeParse({ ...GUELTIG, landKey: 'Ägypten (übrige Orte)' }).success).toBe(true);
  });

  it('lehnt Steuerzeichen in der Quelle ab (Zeile im Mailtext)', () => {
    const r = auslandspauschaleSchema.safeParse({ ...GUELTIG, quelle: 'BMF\nGesamtbetrag: 999 €' });
    expect(fehler(r)).toEqual(['quelle: Ungültige Zeichen in der Quelle (keine Zeilenumbrüche oder Steuerzeichen)']);
  });

  it.each([['U+2028', '\u2028'], ['U+2029', '\u2029'], ['U+202E', '\u202E'], ['U+200B', '\u200B']])(
    'lehnt %s in der Quelle ab (Zeilentrenner, Bidi, Null-Breite)',
    (_name, zeichen) => {
      const r = auslandspauschaleSchema.safeParse({ ...GUELTIG, quelle: `BMF${zeichen}Prüfvermerk: X` });
      expect(fehler(r)).toEqual(['quelle: Ungültige Zeichen in der Quelle (keine Zeilenumbrüche oder Steuerzeichen)']);
    },
  );

  it('Tagessätze: > 0 und höchstens MAX_TAGESSATZ (200, zugleich Deckel der Einreichung)', () => {
    expect(MAX_TAGESSATZ).toBe(200);
    expect(auslandspauschaleSchema.safeParse({ ...GUELTIG, tagessatz24h: 200, tagessatz8h: 200 }).success).toBe(true);
    expect(fehler(auslandspauschaleSchema.safeParse({ ...GUELTIG, tagessatz24h: 830 })))
      .toEqual(['tagessatz24h: Höchstens 200 €']);
    expect(fehler(auslandspauschaleSchema.safeParse({ ...GUELTIG, tagessatz8h: 0 })))
      .toEqual(['tagessatz8h: Muss größer als 0 € sein']);
  });

  it('8 h darf nicht größer als 24 h sein (gleich ist erlaubt)', () => {
    expect(auslandspauschaleSchema.safeParse({ ...GUELTIG, tagessatz24h: 40, tagessatz8h: 40 }).success).toBe(true);
    expect(fehler(auslandspauschaleSchema.safeParse({ ...GUELTIG, tagessatz24h: 40, tagessatz8h: 59 })))
      .toEqual([`tagessatz8h: ${MELDUNG_8H_UEBER_24H}`]);
  });

  it('Übernachtung 0 bis 9.999 €', () => {
    expect(auslandspauschaleSchema.safeParse({ ...GUELTIG, uebernachtung: 0 }).success).toBe(true);
    expect(auslandspauschaleSchema.safeParse({ ...GUELTIG, uebernachtung: 9999 }).success).toBe(true);
    expect(fehler(auslandspauschaleSchema.safeParse({ ...GUELTIG, uebernachtung: 10000 })))
      .toEqual(['uebernachtung: Höchstens 9.999 €']);
    expect(fehler(auslandspauschaleSchema.safeParse({ ...GUELTIG, uebernachtung: -1 })))
      .toEqual(['uebernachtung: Darf nicht negativ sein']);
  });

  it('lehnt unmögliche Kalenderdaten ab', () => {
    expect(fehler(auslandspauschaleSchema.safeParse({ ...GUELTIG, gueltigVon: '2027-02-30' })))
      .toEqual(['gueltigVon: Ungültiges Datum']);
  });
});

describe('auslandspauschaleUpdateSchema (PUT)', () => {
  it('Teilupdate ohne Schlüssel; einzelner Satz ohne Vergleich (prüft die Route gegen die DB)', () => {
    expect(auslandspauschaleUpdateSchema.parse({ tagessatz8h: 70 })).toEqual({ tagessatz8h: 70 });
    expect(auslandspauschaleUpdateSchema.parse({ landKey: 'X', quelle: 'Q' })).toEqual({ quelle: 'Q' });
  });

  it('gleiche Grenzen wie beim Anlegen', () => {
    expect(fehler(auslandspauschaleUpdateSchema.safeParse({ tagessatz24h: 201 }))).toEqual(['tagessatz24h: Höchstens 200 €']);
    expect(auslandspauschaleUpdateSchema.safeParse({ quelle: 'a\rb' }).success).toBe(false);
  });
});

describe('satzstandSchluessel', () => {
  it('übernimmt den von Express bereits dekodierten Key unverändert (kein zweites Dekodieren)', () => {
    expect(satzstandSchluessel({ landKey: 'Land 100%', gueltigVon: '2026-01-01' }))
      .toEqual({ landKey: 'Land 100%', gueltigVon: '2026-01-01' });
    expect(satzstandSchluessel({ landKey: 'A%41', gueltigVon: '2026-01-01' })?.landKey).toBe('A%41');
  });

  it('null bei ungültigem Datum', () => {
    expect(satzstandSchluessel({ landKey: 'Belgien', gueltigVon: '2026-02-30' })).toBeNull();
    expect(satzstandSchluessel({ landKey: 'Belgien', gueltigVon: 'gestern' })).toBeNull();
  });
});

describe('istUniqueViolation', () => {
  it('erkennt 23505 direkt und als cause (DrizzleQueryError)', () => {
    expect(istUniqueViolation({ code: '23505' })).toBe(true);
    expect(istUniqueViolation(Object.assign(new Error('Failed query'), { cause: { code: '23505' } }))).toBe(true);
  });

  it('andere Fehler nicht — auch nicht am Meldungstext', () => {
    expect(istUniqueViolation(new Error('duplicate key value violates unique constraint'))).toBe(false);
    expect(istUniqueViolation({ code: '23503' })).toBe(false);
    expect(istUniqueViolation(null)).toBe(false);
    expect(istUniqueViolation('23505')).toBe(false);
  });
});

describe('meldungOhneJahresstand', () => {
  it('nennt das Jahr und den Weg über den BMF-Import', () => {
    expect(meldungOhneJahresstand('2027')).toBe(
      'Für 2027 ist noch kein Jahresstand eingespielt. Neue Jahresstände werden zentral per BMF-Import eingespielt; hier nur Korrekturen in bereits eingespielten Jahren.',
    );
  });
});
