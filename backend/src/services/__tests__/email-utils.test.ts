import { describe, it, expect } from 'vitest';
import {
  aufloeseVersandkanal,
  base64Groesse,
  pruefeAnhangGroesse,
  resolveSmtpConfig,
  configSignatur,
  MAX_MESSAGE_BYTES,
  type EmailConfigInput,
} from '../email-utils.js';

describe('aufloeseVersandkanal', () => {
  it.each([
    ['WEBHOOK', 'WEBHOOK'],
    ['webhook', 'WEBHOOK'],
    ['  WEBHOOK  ', 'WEBHOOK'],
    ['SMTP', 'SMTP'],
    ['smtp', 'SMTP'],
    ['MS365', 'SMTP'],      // toter Code → wie SMTP behandelt (Befund B)
    ['irgendwas', 'SMTP'],
    ['', 'SMTP'],           // eindeutiger Default (Befund C)
  ] as const)('versandMethode=%s → %s', (input, expected) => {
    expect(aufloeseVersandkanal(input)).toBe(expected);
  });

  it('null/undefined → SMTP', () => {
    expect(aufloeseVersandkanal(null)).toBe('SMTP');
    expect(aufloeseVersandkanal(undefined)).toBe('SMTP');
  });
});

describe('base64Groesse', () => {
  it.each([
    [0, 0],
    [1, 4],
    [3, 4],
    [4, 8],
    [6, 8],
  ])('%i bytes → %i kodiert', (bytes, expected) => {
    expect(base64Groesse(bytes)).toBe(expected);
  });
});

describe('pruefeAnhangGroesse (Befund F)', () => {
  it('kleiner Anhang ist ok', () => {
    expect(pruefeAnhangGroesse(1024).ok).toBe(true);
  });

  it('Anhang knapp unter der Grenze ist ok', () => {
    // roh so waehlen, dass base64-kodiert < 25 MB bleibt
    const roh = Math.floor((MAX_MESSAGE_BYTES / 4) * 3) - 100;
    expect(pruefeAnhangGroesse(roh).ok).toBe(true);
  });

  it('zu grosser Anhang wird mit deutscher Meldung abgelehnt', () => {
    const roh = 30 * 1024 * 1024; // 30 MB roh → kodiert ~40 MB
    const r = pruefeAnhangGroesse(roh);
    expect(r.ok).toBe(false);
    expect(r.fehler).toContain('zu gross');
  });

  it('respektiert eine eigene Grenze', () => {
    expect(pruefeAnhangGroesse(1_000_000, 100).ok).toBe(false);
  });
});

const leereRow: EmailConfigInput = {
  smtpServer: null, smtpPort: null, smtpUser: null, smtpPasswort: null,
  absenderName: null, absenderEmail: null, maxVersuche: null, fehlerEmail: null,
};

describe('resolveSmtpConfig', () => {
  it('nutzt DB-Werte und leitet secure aus dem Port ab (587 → false)', () => {
    const c = resolveSmtpConfig(
      { ...leereRow, smtpServer: 'smtp.db.de', smtpPort: 587, smtpUser: 'db@x.de', smtpPasswort: 'geheim', absenderEmail: 'from@x.de', absenderName: 'DB Sender', maxVersuche: 5, fehlerEmail: 'err@x.de' },
      {},
    );
    expect(c).not.toBeNull();
    expect(c).toMatchObject({
      host: 'smtp.db.de', port: 587, secure: false, user: 'db@x.de', pass: 'geheim',
      fromEmail: 'from@x.de', fromName: 'DB Sender', maxVersuche: 5, fehlerEmail: 'err@x.de',
    });
  });

  it('Port 465 → secure true', () => {
    const c = resolveSmtpConfig({ ...leereRow, smtpServer: 'h', smtpPort: 465, smtpUser: 'u' }, {});
    expect(c?.secure).toBe(true);
  });

  it('faellt pro Feld auf ENV zurueck, wenn DB leer ist', () => {
    const c = resolveSmtpConfig(leereRow, {
      host: 'smtp.env.de', port: '2525', user: 'env@x.de', pass: 'envpass',
      fromEmail: 'envfrom@x.de', fromName: 'Env Sender',
    });
    expect(c).toMatchObject({ host: 'smtp.env.de', port: 2525, user: 'env@x.de', pass: 'envpass', fromEmail: 'envfrom@x.de', fromName: 'Env Sender' });
  });

  it('DB hat pro Feld Vorrang vor ENV', () => {
    const c = resolveSmtpConfig(
      { ...leereRow, smtpServer: 'db-host', smtpUser: 'db-user' },
      { host: 'env-host', user: 'env-user' },
    );
    expect(c?.host).toBe('db-host');
    expect(c?.user).toBe('db-user');
  });

  it('null wenn Host fehlt', () => {
    expect(resolveSmtpConfig({ ...leereRow, smtpUser: 'u' }, {})).toBeNull();
  });

  it('null wenn Benutzer fehlt', () => {
    expect(resolveSmtpConfig({ ...leereRow, smtpServer: 'h' }, {})).toBeNull();
  });

  it('fromEmail faellt auf den Benutzer zurueck', () => {
    const c = resolveSmtpConfig({ ...leereRow, smtpServer: 'h', smtpUser: 'user@x.de' }, {});
    expect(c?.fromEmail).toBe('user@x.de');
  });

  it('Port-Default 587, maxVersuche-Default 3, fromName-Default gesetzt', () => {
    const c = resolveSmtpConfig({ ...leereRow, smtpServer: 'h', smtpUser: 'u', maxVersuche: 0 }, {});
    expect(c?.port).toBe(587);
    expect(c?.maxVersuche).toBe(3);
    expect(c?.fromName).toBe('CREDO Finanzportal');
  });
});

describe('configSignatur', () => {
  const base = resolveSmtpConfig({ ...leereRow, smtpServer: 'h', smtpUser: 'u', smtpPasswort: 'p1', absenderEmail: 'f@x.de' }, {})!;

  it('gleiche Config → gleiche Signatur', () => {
    const gleich = resolveSmtpConfig({ ...leereRow, smtpServer: 'h', smtpUser: 'u', smtpPasswort: 'p1', absenderEmail: 'f@x.de' }, {})!;
    expect(configSignatur(base)).toBe(configSignatur(gleich));
  });

  it('geaendertes Passwort → andere Signatur (Cache-Invalidierung)', () => {
    const anders = resolveSmtpConfig({ ...leereRow, smtpServer: 'h', smtpUser: 'u', smtpPasswort: 'p2', absenderEmail: 'f@x.de' }, {})!;
    expect(configSignatur(base)).not.toBe(configSignatur(anders));
  });
});
