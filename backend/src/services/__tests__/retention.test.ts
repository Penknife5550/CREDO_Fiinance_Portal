import { describe, it, expect, vi } from 'vitest';

// retention.ts importiert db/index.ts (wirft ohne DATABASE_URL). Getestet werden hier nur die
// reinen Regeln — die DB wird daher durch eine leere Attrappe ersetzt.
vi.mock('../../db/index.js', () => ({ db: {}, schema: {} }));

import {
  leseRetentionKonfig, moratoriumAktiv, moratoriumWarnung, tageBisMoratoriumsende, fristGrenze, retentionAktion,
  STANDARD_MORATORIUM_BIS, type RetentionKonfig,
} from '../retention.js';

const TAG_MS = 24 * 60 * 60 * 1000;

describe('leseRetentionKonfig', () => {
  it('fehlend oder leer → 90 Tage, Moratorium bis zum Enddatum im Code (nicht vom Compose-Default abhängig)', () => {
    expect(STANDARD_MORATORIUM_BIS).toBe('2027-03-31');
    expect(leseRetentionKonfig({})).toEqual({ ok: true, konfig: { tage: 90, moratoriumBis: '2027-03-31' } });
    expect(leseRetentionKonfig({ RETENTION_FRIST_TAGE: '', RETENTION_MORATORIUM_BIS: '' }))
      .toEqual({ ok: true, konfig: { tage: 90, moratoriumBis: '2027-03-31' } });
  });

  it.each(['1', '90', '3650'])('RETENTION_FRIST_TAGE=%s wird übernommen', (wert) => {
    expect(leseRetentionKonfig({ RETENTION_FRIST_TAGE: wert }))
      .toEqual({ ok: true, konfig: { tage: Number(wert), moratoriumBis: '2027-03-31' } });
  });

  it('RETENTION_TAGE (nur für ältere Images, Compose: 3650) wirkt nicht mehr', () => {
    expect(leseRetentionKonfig({ RETENTION_TAGE: '3650' })).toEqual({ ok: true, konfig: { tage: 90, moratoriumBis: '2027-03-31' } });
    expect(leseRetentionKonfig({ RETENTION_TAGE: '3650', RETENTION_FRIST_TAGE: '120' }))
      .toEqual({ ok: true, konfig: { tage: 120, moratoriumBis: '2027-03-31' } });
  });

  // Früher: Number(x) || 90 → „0“/„10 Jahre“ = 90, „3.650“ = 3,65 Tage, „-1“ = alles Zugestellte löschen.
  it.each(['0', '-1', '3.650', '3,650', '90.5', '10 Jahre', '10y', '1e3', ' 90', '90 ', '0x10', 'abc', '99999999999999999999'])(
    'RETENTION_FRIST_TAGE=„%s“ ist ungültig (fail-closed)',
    (wert) => {
      const r = leseRetentionKonfig({ RETENTION_FRIST_TAGE: wert });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fehler).toContain('RETENTION_FRIST_TAGE');
    },
  );

  it('RETENTION_MORATORIUM_BIS mit gültigem Datum (Verlängerung bzw. vorzeitiges Ende)', () => {
    expect(leseRetentionKonfig({ RETENTION_FRIST_TAGE: '90', RETENTION_MORATORIUM_BIS: '2027-06-30' }))
      .toEqual({ ok: true, konfig: { tage: 90, moratoriumBis: '2027-06-30' } });
    expect(leseRetentionKonfig({ RETENTION_MORATORIUM_BIS: '2028-02-29' }))
      .toEqual({ ok: true, konfig: { tage: 90, moratoriumBis: '2028-02-29' } });
    expect(leseRetentionKonfig({ RETENTION_MORATORIUM_BIS: '2026-12-01' }))
      .toEqual({ ok: true, konfig: { tage: 90, moratoriumBis: '2026-12-01' } });
  });

  it.each(['31.03.2027', '2027-3-31', '2027-02-29', '2027-04-31', '2027-13-01', '2027-03-31T00:00', 'morgen', ' 2027-03-31'])(
    'RETENTION_MORATORIUM_BIS=„%s“ ist ungültig (fail-closed)',
    (wert) => {
      const r = leseRetentionKonfig({ RETENTION_FRIST_TAGE: '90', RETENTION_MORATORIUM_BIS: wert });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fehler).toContain('RETENTION_MORATORIUM_BIS');
    },
  );
});

describe('moratoriumAktiv / Warnung vor dem Ende', () => {
  const konfig: RetentionKonfig = { tage: 90, moratoriumBis: '2027-03-31' };

  it('aktiv bis einschließlich Vortag, ab dem Enddatum (UTC) nicht mehr', () => {
    expect(moratoriumAktiv(konfig, new Date('2026-10-11T12:00:00Z'))).toBe(true);
    expect(moratoriumAktiv(konfig, new Date('2027-03-30T23:59:59Z'))).toBe(true);
    expect(moratoriumAktiv(konfig, new Date('2027-03-31T00:00:00Z'))).toBe(false);
    expect(moratoriumAktiv(konfig, new Date('2027-06-01T00:00:00Z'))).toBe(false);
  });

  it('vergangenes Enddatum = kein Moratorium', () => {
    expect(moratoriumAktiv({ tage: 90, moratoriumBis: '2026-10-01' }, new Date('2026-10-11T12:00:00Z'))).toBe(false);
  });

  it('Tage bis zum Ende (UTC-Kalendertage, Uhrzeit egal)', () => {
    expect(tageBisMoratoriumsende(konfig, new Date('2027-03-01T00:00:00Z'))).toBe(30);
    expect(tageBisMoratoriumsende(konfig, new Date('2027-03-01T23:59:59Z'))).toBe(30);
    expect(tageBisMoratoriumsende(konfig, new Date('2027-03-30T12:00:00Z'))).toBe(1);
    expect(tageBisMoratoriumsende(konfig, new Date('2027-03-31T00:00:00Z'))).toBe(0);
  });

  it('Warnung nur in den letzten 30 Tagen vor dem Ende (Prüftermin 01.03.2027 liegt davor)', () => {
    expect(moratoriumWarnung(konfig, new Date('2027-02-28T12:00:00Z'))).toBeNull(); // 31 Tage
    expect(moratoriumWarnung(konfig, new Date('2027-03-01T12:00:00Z'))).toContain('endet am 2027-03-31 (in 30 Tagen)');
    expect(moratoriumWarnung(konfig, new Date('2027-03-30T12:00:00Z'))).toContain('(in 1 Tag)');
    expect(moratoriumWarnung(konfig, new Date('2027-03-31T00:00:00Z'))).toBeNull();
    expect(moratoriumWarnung(konfig, new Date('2026-10-11T12:00:00Z'))).toBeNull();
  });
});

describe('retentionAktion (Löschbedingung)', () => {
  const jetzt = new Date('2026-10-11T03:00:00Z');
  const mitMoratorium: RetentionKonfig = { tage: 90, moratoriumBis: '2027-03-31' };
  const ohneMoratorium: RetentionKonfig = { tage: 90, moratoriumBis: '2026-01-01' };
  const alt = new Date(jetzt.getTime() - 91 * TAG_MS);
  const jung = new Date(jetzt.getTime() - 89 * TAG_MS);
  /** Reisekosten-Altbestand (ohne Land je Reisetag, vor Release 1b). */
  const rkAlt = (createdAt: Date, status = 'GESENDET') => ({ typ: 'REISEKOSTEN', status, createdAt, landJeTag: false });

  it('Frist: genau an der Grenze wird behalten, eine Millisekunde älter läuft ab', () => {
    const grenze = fristGrenze(ohneMoratorium, jetzt);
    expect(grenze.getTime()).toBe(jetzt.getTime() - 90 * TAG_MS);
    expect(retentionAktion({ typ: 'ERSTATTUNG', status: 'GESENDET', createdAt: grenze, landJeTag: false }, ohneMoratorium, jetzt))
      .toBe('BEHALTEN');
    expect(retentionAktion(
      { typ: 'ERSTATTUNG', status: 'GESENDET', createdAt: new Date(grenze.getTime() - 1), landJeTag: false }, ohneMoratorium, jetzt,
    )).toBe('LOESCHEN');
  });

  it.each(['EINGEREICHT', 'FEHLER'])('nie etwas Unzugestelltes (%s) — auch nicht nach der Frist', (status) => {
    expect(retentionAktion({ typ: 'ERSTATTUNG', status, createdAt: alt, landJeTag: false }, ohneMoratorium, jetzt)).toBe('BEHALTEN');
    expect(retentionAktion(rkAlt(alt, status), mitMoratorium, jetzt)).toBe('BEHALTEN');
  });

  it.each(['ERSTATTUNG', 'SAMMELFAHRT', 'KLASSENFAHRT'])('Moratorium hält %s nicht zurück', (typ) => {
    expect(retentionAktion({ typ, status: 'GESENDET', createdAt: alt, landJeTag: false }, mitMoratorium, jetzt)).toBe('LOESCHEN');
    expect(retentionAktion({ typ, status: 'GESENDET', createdAt: jung, landJeTag: false }, mitMoratorium, jetzt)).toBe('BEHALTEN');
  });

  it('REISEKOSTEN-Altbestand im Moratorium: abgelaufen → minimieren statt löschen, jung → behalten', () => {
    expect(retentionAktion(rkAlt(alt), mitMoratorium, jetzt)).toBe('MINIMIEREN');
    expect(retentionAktion(rkAlt(jung), mitMoratorium, jetzt)).toBe('BEHALTEN');
  });

  it('REISEKOSTEN mit Land je Reisetag (ab Release 1b, nicht Teil der Nachkorrektur): normale Frist', () => {
    const rkNeu = { typ: 'REISEKOSTEN', status: 'GESENDET', createdAt: alt, landJeTag: true };
    expect(retentionAktion(rkNeu, mitMoratorium, jetzt)).toBe('LOESCHEN');
    expect(retentionAktion({ ...rkNeu, createdAt: jung }, mitMoratorium, jetzt)).toBe('BEHALTEN');
  });

  it('REISEKOSTEN-Altbestand ohne bzw. nach dem Moratorium: normale Frist', () => {
    expect(retentionAktion(rkAlt(alt), ohneMoratorium, jetzt)).toBe('LOESCHEN');
    const nachEnde = new Date('2027-03-31T03:00:00Z');
    expect(retentionAktion(rkAlt(new Date(nachEnde.getTime() - 91 * TAG_MS)), mitMoratorium, nachEnde)).toBe('LOESCHEN');
  });

  it('längere Frist wirkt auf alle Typen', () => {
    const lang: RetentionKonfig = { tage: 3650, moratoriumBis: '2026-01-01' };
    expect(retentionAktion({ typ: 'ERSTATTUNG', status: 'GESENDET', createdAt: alt, landJeTag: false }, lang, jetzt)).toBe('BEHALTEN');
  });
});
