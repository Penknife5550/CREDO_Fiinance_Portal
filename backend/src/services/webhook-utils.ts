import net from 'net';
import type { EinreichungTyp } from '../lib/constants.js';

const ALLOW_PRIVATE_HOSTS = process.env.WEBHOOK_ALLOW_PRIVATE_HOSTS === 'true';

export class UnsafeWebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeWebhookUrlError';
  }
}

/** Loopback-, Link-local- und RFC1918-Adressen erkennen. */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::' || h === '::1') return true;

  if (net.isIPv4(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  if (net.isIPv6(h)) {
    if (h.startsWith('fc') || h.startsWith('fd')) return true; // ULA fc00::/7
    if (h.startsWith('fe80:')) return true; // link-local
  }

  return false;
}

/** SSRF-Schutz: wirft UnsafeWebhookUrlError, wenn URL ungueltig oder auf privates Netz zeigt. */
export function assertSafeWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeWebhookUrlError('Ungueltige URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeWebhookUrlError('Nur http(s)-URLs erlaubt');
  }
  if (!ALLOW_PRIVATE_HOSTS && isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new UnsafeWebhookUrlError('URL zeigt auf ein privates oder Loopback-Netz — aus Sicherheitsgruenden blockiert');
  }
}

/** Entscheidet, ob eine Webhook-Konfig mit gegebenem typFilter den Einreichungstyp empfaengt.
 *  'ALLE' und leere/null-Filter passen auf alles — sonst muss exakt der Typ matchen. */
export function matchesTypFilter(typFilter: string | null | undefined, dataTyp: EinreichungTyp): boolean {
  if (!typFilter || typFilter === 'ALLE') return true;
  return typFilter === dataTyp;
}
