import fs from 'fs';
import crypto from 'crypto';
import { db, schema } from '../db/index.js';
import { decryptSecretIfNeeded } from './crypto.js';
import type { EinreichungTyp } from '../lib/constants.js';
import { matchesTypFilter, assertSafeWebhookUrl, UnsafeWebhookUrlError } from './webhook-utils.js';

export { assertSafeWebhookUrl, UnsafeWebhookUrlError };

export interface WebhookEinreichungData {
  id: string;
  belegNr: string;
  typ: EinreichungTyp;
  status: string;
  mandant: string;
  mandantNr: number;
  kostenstelle: string;
  mitarbeiter: {
    vorname: string;
    nachname: string;
    personalNr: string;
  };
  gesamtbetrag: string;
  iban: string;
  kontoinhaber: string;
  // Reisekosten-spezifisch
  reiseziel?: string;
  reiseanlass?: string;
  verkehrsmittel?: string;
  kmGefahren?: string;
  vmaNetto?: string;
  // Erstattung-spezifisch
  anzahlPositionen?: number;
  // Sammelfahrt-spezifisch
  anzahlFahrten?: number;
  fahrten?: Array<{ datum: string; startOrt: string; ziel: string; km: number; kmBetrag: number }>;
}

interface WebhookPayload {
  event: 'eingereicht' | 'status_geaendert' | 'fehler';
  timestamp: string;
  an: string;
  pdfBase64?: string;
  pdfDateiname?: string;
  einreichung: WebhookEinreichungData;
}

interface WebhookAuthConfig {
  authType: string;
  authUser: string | null;
  authPass: string | null;
  authHeaderName: string | null;
  authHeaderValue: string | null;
}

/** Erzeugt Auth-Header basierend auf der Konfiguration */
function buildAuthHeaders(config: WebhookAuthConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (config.authType) {
    case 'BASIC': {
      if (config.authUser && config.authPass) {
        const credentials = Buffer.from(`${config.authUser}:${config.authPass}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      break;
    }
    case 'HEADER': {
      if (config.authHeaderName && config.authHeaderValue) {
        headers[config.authHeaderName] = config.authHeaderValue;
      }
      break;
    }
    // NONE: keine Auth-Header
  }

  return headers;
}

/** HMAC-SHA256 Signatur ueber den Body — n8n kann das mit dem secret pruefen */
function buildSignatureHeader(body: string, secret: string | null): string | null {
  if (!secret) return null;
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${sig}`;
}

/** Sendet einen einzelnen POST mit Retry-Logik bei 5xx/Netzwerkfehlern */
async function postMitRetry(url: string, body: string, headers: Record<string, string>): Promise<{ ok: boolean; status?: number; fehler?: string }> {
  const wartezeiten = [0, 30000, 60000]; // 0s, 30s, 60s
  let letzterFehler = '';
  let letzterStatus: number | undefined;

  for (let versuch = 1; versuch <= 3; versuch++) {
    if (versuch > 1) {
      await new Promise(r => setTimeout(r, wartezeiten[versuch - 1]));
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      letzterStatus = res.status;
      letzterFehler = await res.text().catch(() => '');

      // 4xx ist Client-Fehler — Retry sinnlos
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, fehler: letzterFehler.substring(0, 500) };
      }
    } catch (err) {
      letzterFehler = err instanceof Error ? err.message : 'Unbekannter Fehler';
    }
  }

  return { ok: false, status: letzterStatus, fehler: letzterFehler.substring(0, 500) };
}

/** Sendet Webhook an alle aktiven Konfigurationen */
export async function sendeWebhook(event: WebhookPayload['event'], data: WebhookEinreichungData, an: string, pdfDateipfad?: string) {
  const configs = await db.select().from(schema.webhookConfig);

  // PDF als Base64 lesen (einmal für alle Webhooks)
  let pdfBase64: string | undefined;
  let pdfDateiname: string | undefined;
  if (pdfDateipfad) {
    try {
      const pdfBuffer = await fs.promises.readFile(pdfDateipfad);
      pdfBase64 = pdfBuffer.toString('base64');
      pdfDateiname = pdfDateipfad.split(/[/\\]/).pop();
      console.log(`  PDF gelesen: ${pdfDateiname} (${Math.round(pdfBuffer.length / 1024)} KB, Base64: ${Math.round((pdfBase64?.length || 0) / 1024)} KB)`);
    } catch (err) {
      console.error(`  PDF konnte nicht gelesen werden (${pdfDateipfad}):`, err);
    }
  }

  if (configs.length === 0) {
    console.warn('  Keine Webhook-Konfigurationen in DB gefunden!');
  }

  for (const config of configs) {
    if (!config.aktiv || !config.url) {
      console.log(`  Webhook übersprungen: aktiv=${config.aktiv}, url=${config.url}`);
      continue;
    }

    if (!matchesTypFilter(config.typFilter, data.typ)) {
      console.log(`  Webhook übersprungen: typFilter=${config.typFilter}, typ=${data.typ}`);
      continue;
    }

    if (event === 'eingereicht' && !config.eventEingereicht) continue;
    if (event === 'status_geaendert' && !config.eventStatusGeaendert) continue;
    if (event === 'fehler' && !config.eventFehler) continue;

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      an,
      pdfBase64,
      pdfDateiname,
      einreichung: data,
    };
    const body = JSON.stringify(payload);

    // Auth-Daten und Secret entschluesseln (Legacy-Klartext wird durchgereicht)
    let plainAuthPass: string | null = null;
    let plainAuthHeaderValue: string | null = null;
    let plainSecret: string | null = null;
    try {
      plainAuthPass = decryptSecretIfNeeded(config.authPass);
      plainAuthHeaderValue = decryptSecretIfNeeded(config.authHeaderValue);
      plainSecret = decryptSecretIfNeeded(config.secret);
    } catch (err) {
      console.error(`  Webhook-Secrets konnten nicht entschluesselt werden (${config.url}):`, err);
      continue;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      ...buildAuthHeaders({
        authType: config.authType,
        authUser: config.authUser,
        authPass: plainAuthPass,
        authHeaderName: config.authHeaderName,
        authHeaderValue: plainAuthHeaderValue,
      }),
    };
    const signature = buildSignatureHeader(body, plainSecret);
    if (signature) headers['X-Webhook-Signature'] = signature;

    console.log(`  Webhook senden → ${config.url} [${event}] (${Math.round(body.length / 1024)} KB, hasPdf=${!!pdfBase64}, signed=${!!signature})`);

    const result = await postMitRetry(config.url, body, headers);
    if (result.ok) {
      console.log(`  Webhook erfolgreich → ${config.url} [${event}] (${result.status})`);
    } else {
      console.error(`  Webhook fehlgeschlagen (${config.url}): HTTP ${result.status ?? 'n/a'} ${result.fehler}`);
    }
  }
}

/** Sendet einen Test-Webhook an eine spezifische URL */
export async function sendeTestWebhook(
  url: string,
  authConfig: WebhookAuthConfig,
): Promise<{ erfolg: boolean; status?: number; antwort?: string; fehler?: string }> {
  const payload: WebhookPayload = {
    event: 'eingereicht',
    timestamp: new Date().toISOString(),
    an: 'test@example.com',
    pdfBase64: undefined,
    pdfDateiname: undefined,
    einreichung: {
      id: '00000000-0000-0000-0000-000000000000',
      belegNr: 'TEST-RK-2026-001',
      typ: 'REISEKOSTEN',
      status: 'EINGEREICHT',
      mandant: 'CREDO Verwaltung',
      mandantNr: 40,
      kostenstelle: 'Allgemeine Verwaltung',
      mitarbeiter: {
        vorname: 'Max',
        nachname: 'Mustermann',
        personalNr: '12345',
      },
      gesamtbetrag: '142.80',
      iban: 'DE89370400440532013000',
      kontoinhaber: 'Max Mustermann',
      reiseziel: 'Berlin (Testdaten)',
      reiseanlass: 'Webhook-Test vom CREDO Finanzportal',
      verkehrsmittel: 'BAHN',
      kmGefahren: '0',
      vmaNetto: '28.00',
    },
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': 'test',
    ...buildAuthHeaders(authConfig),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });

    const antwort = await res.text().catch(() => '');
    return {
      erfolg: res.ok,
      status: res.status,
      antwort: antwort.substring(0, 500),
    };
  } catch (err) {
    return {
      erfolg: false,
      fehler: err instanceof Error ? err.message : 'Unbekannter Fehler',
    };
  }
}
