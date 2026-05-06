import crypto from 'crypto';

// AES-256-GCM. ENCRYPTION_KEY = 64 Hex-Zeichen (32 Byte).
// Generieren: `openssl rand -hex 32`
//
// Verschluesselte Werte werden mit Prefix `enc:v1:` gespeichert. So koennen
// Legacy-Klartext-Werte unbeschadet weitergelesen werden, neue Schreibungen
// landen verschluesselt in der DB.

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const ENC_PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ENCRYPTION_KEY fehlt oder ungueltig (64 Hex-Zeichen erforderlich, generieren mit: openssl rand -hex 32)'
    );
  }
  return Buffer.from(hex, 'hex');
}

export function isEncryptionConfigured(): boolean {
  const hex = process.env.ENCRYPTION_KEY;
  return !!hex && /^[0-9a-fA-F]{64}$/.test(hex);
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(encoded: string): string {
  if (!encoded.startsWith(ENC_PREFIX)) {
    throw new Error('Wert ist nicht im erwarteten Format (Prefix fehlt)');
  }
  const key = getKey();
  const buf = Buffer.from(encoded.slice(ENC_PREFIX.length), 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Verschluesselter Wert ist beschaedigt');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/**
 * Liest einen Wert, der entweder verschluesselt (enc:v1:...) oder Legacy-Klartext
 * sein kann. Erleichtert die Migration.
 */
export function decryptSecretIfNeeded(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value; // Legacy-Klartext
  return decryptSecret(value);
}
