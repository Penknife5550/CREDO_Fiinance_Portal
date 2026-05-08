import { describe, it, expect } from 'vitest';
import { matchesTypFilter, assertSafeWebhookUrl, UnsafeWebhookUrlError } from '../webhook-utils.js';

describe('matchesTypFilter', () => {
  describe('ALLE / leerer Filter — alles durchlassen', () => {
    it.each([
      ['ALLE', 'REISEKOSTEN'],
      ['ALLE', 'ERSTATTUNG'],
      ['ALLE', 'SAMMELFAHRT'],
      [null, 'SAMMELFAHRT'],
      [undefined, 'REISEKOSTEN'],
      ['', 'ERSTATTUNG'],
    ] as const)('typFilter=%s, typ=%s → durchgelassen', (filter, typ) => {
      expect(matchesTypFilter(filter, typ)).toBe(true);
    });
  });

  describe('exakter Match', () => {
    it.each([
      ['SAMMELFAHRT', 'SAMMELFAHRT'],
      ['REISEKOSTEN', 'REISEKOSTEN'],
      ['ERSTATTUNG', 'ERSTATTUNG'],
    ] as const)('typFilter=%s = typ=%s → durchgelassen', (filter, typ) => {
      expect(matchesTypFilter(filter, typ)).toBe(true);
    });
  });

  describe('Mismatch — blockieren', () => {
    it.each([
      ['REISEKOSTEN', 'SAMMELFAHRT'],
      ['ERSTATTUNG', 'SAMMELFAHRT'],
      ['SAMMELFAHRT', 'REISEKOSTEN'],
      ['SAMMELFAHRT', 'ERSTATTUNG'],
      ['REISEKOSTEN', 'ERSTATTUNG'],
    ] as const)('typFilter=%s, typ=%s → geblockt', (filter, typ) => {
      expect(matchesTypFilter(filter, typ)).toBe(false);
    });
  });
});

describe('assertSafeWebhookUrl (SSRF-Schutz)', () => {
  it('akzeptiert gueltige https-URL auf oeffentlicher Domain', () => {
    expect(() => assertSafeWebhookUrl('https://n8n.example.com/webhook/credo-sammelfahrt')).not.toThrow();
  });

  it.each([
    'http://localhost/webhook',
    'http://127.0.0.1:5678/webhook',
    'http://10.0.0.1/webhook',
    'http://192.168.1.1/webhook',
    'http://172.16.0.1/webhook',
    'http://169.254.169.254/webhook',  // AWS metadata
  ])('blockt private/loopback: %s', url => {
    expect(() => assertSafeWebhookUrl(url)).toThrow(UnsafeWebhookUrlError);
  });

  it('blockt nicht-http(s) Protokolle', () => {
    expect(() => assertSafeWebhookUrl('ftp://example.com/x')).toThrow(UnsafeWebhookUrlError);
    expect(() => assertSafeWebhookUrl('file:///etc/passwd')).toThrow(UnsafeWebhookUrlError);
  });

  it('blockt ungueltige URL', () => {
    expect(() => assertSafeWebhookUrl('not-a-url')).toThrow(UnsafeWebhookUrlError);
  });
});
