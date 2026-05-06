import crypto from 'crypto';

// AES-256-GCM. ENCRYPTION_KEY = 64 Hex-Zeichen (32 Byte).
// Generieren: `openssl rand -hex 32`

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ENCRYPTION_KEY fehlt oder ungültig (64 Hex-Zeichen erforderlich, generieren mit: openssl rand -hex 32)'
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Verschlüsselter Wert ist beschädigt');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function isEncryptionConfigured(): boolean {
  const hex = process.env.ENCRYPTION_KEY;
  return !!hex && /^[0-9a-fA-F]{64}$/.test(hex);
}
