import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  decryptSecretIfNeeded,
  isEncrypted,
  isEncryptionConfigured,
} from '../crypto.js';

const TEST_KEY = '0'.repeat(64); // 64 Hex-Zeichen

describe('crypto', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  describe('encryptSecret / decryptSecret', () => {
    it('round-trip: ASCII', () => {
      const plaintext = 'mein-supergeheimes-passwort-123';
      const encrypted = encryptSecret(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(decryptSecret(encrypted)).toBe(plaintext);
    });

    it('round-trip: Umlaute und Sonderzeichen', () => {
      const plaintext = 'Tüt€l!#@`~ßöäü';
      expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
    });

    it('verschluesselt mit zufaelligem IV (zwei Aufrufe → andere Outputs)', () => {
      const plaintext = 'derselbe-input';
      const a = encryptSecret(plaintext);
      const b = encryptSecret(plaintext);
      expect(a).not.toBe(b);
      expect(decryptSecret(a)).toBe(plaintext);
      expect(decryptSecret(b)).toBe(plaintext);
    });

    it('Output traegt enc:v1: Prefix', () => {
      expect(encryptSecret('x').startsWith('enc:v1:')).toBe(true);
    });
  });

  describe('decryptSecretIfNeeded', () => {
    it('null/undefined → null', () => {
      expect(decryptSecretIfNeeded(null)).toBeNull();
      expect(decryptSecretIfNeeded(undefined)).toBeNull();
      expect(decryptSecretIfNeeded('')).toBeNull();
    });

    it('Legacy-Klartext (ohne Prefix) wird unveraendert zurueckgegeben', () => {
      expect(decryptSecretIfNeeded('legacy-plain-password')).toBe('legacy-plain-password');
    });

    it('Verschluesselter Wert wird entschluesselt', () => {
      const enc = encryptSecret('hidden');
      expect(decryptSecretIfNeeded(enc)).toBe('hidden');
    });
  });

  describe('isEncrypted', () => {
    it('erkennt Prefix', () => {
      expect(isEncrypted('enc:v1:abc')).toBe(true);
      expect(isEncrypted('plain')).toBe(false);
      expect(isEncrypted('')).toBe(false);
    });
  });

  describe('isEncryptionConfigured', () => {
    it('true bei gueltigem Key', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      expect(isEncryptionConfigured()).toBe(true);
    });

    it('false ohne Key', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
      process.env.ENCRYPTION_KEY = TEST_KEY;
    });

    it('false bei ungueltigem Format (zu kurz)', () => {
      process.env.ENCRYPTION_KEY = 'abc';
      expect(isEncryptionConfigured()).toBe(false);
      process.env.ENCRYPTION_KEY = TEST_KEY;
    });
  });

  describe('Auth-Tag-Schutz (Tampering)', () => {
    it('manipulierter Ciphertext wirft beim Decrypt', () => {
      const enc = encryptSecret('original');
      // Letztes Zeichen aendern (Ciphertext-Bytes)
      const tampered = enc.slice(0, -2) + (enc.slice(-2) === 'AA' ? 'BB' : 'AA');
      expect(() => decryptSecret(tampered)).toThrow();
    });
  });

  describe('Wechselnder ENCRYPTION_KEY', () => {
    it('mit anderem Key kann nicht entschluesselt werden', () => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
      const enc = encryptSecret('secret');

      process.env.ENCRYPTION_KEY = '1'.repeat(64);
      expect(() => decryptSecret(enc)).toThrow();

      process.env.ENCRYPTION_KEY = TEST_KEY;
    });
  });
});
