import fs from 'fs';
import { db, schema } from '../db/index.js';

interface WebhookPayload {
  event: 'eingereicht' | 'status_geaendert' | 'fehler';
  timestamp: string;
  an: string;
  pdfBase64?: string;
  pdfDateiname?: string;
  einreichung: {
    id: string;
    belegNr: string;
    typ: 'REISEKOSTEN' | 'ERSTATTUNG' | 'SAMMELFAHRT';
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
  };
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

/** Sendet Webhook an alle aktiven Konfigurationen */
export async function sendeWebhook(event: WebhookPayload['event'], data: WebhookPayload['einreichung'], an: string, pdfDateipfad?: string) {
  const configs = await db.select().from(schema.webhookConfig);

  // PDF als Base64 lesen (einmal für alle Webhooks)
  let pdfBase64: string | undefined;
  let pdfDateiname: string | undefined;
  if (pdfDateipfad) {
    try {
      const pdfBuffer = fs.readFileSync(pdfDateipfad);
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

    // Typ-Filter prüfen (ALLE, REISEKOSTEN, ERSTATTUNG, SAMMELFAHRT)
    if (config.typFilter && config.typFilter !== 'ALLE' && config.typFilter !== data.typ) {
      console.log(`  Webhook übersprungen: typFilter=${config.typFilter}, typ=${data.typ}`);
      continue;
    }

    // Event-Filter prüfen
    if (event === 'eingereicht' && !config.eventEingereicht) {
      console.log(`  Webhook übersprungen: eventEingereicht ist deaktiviert`);
      continue;
    }
    if (event === 'status_geaendert' && !config.eventStatusGeaendert) continue;
    if (event === 'fehler' && !config.eventFehler) {
      console.log(`  Webhook übersprungen: eventFehler ist deaktiviert`);
      continue;
    }

    // PDF sowohl auf Top-Level als auch in einreichung (Kompatibilität)
    const payloadData = pdfBase64 ? { ...data, pdfBase64, pdfDateiname } : data;

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      an,
      pdfBase64,
      pdfDateiname,
      einreichung: payloadData,
    };

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      ...buildAuthHeaders(config),
    };

    console.log(`  Webhook senden → ${config.url} [${event}] (${Math.round(body.length / 1024)} KB, hasPdf=${!!pdfBase64})`);

    try {
      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        console.error(`  Webhook fehlgeschlagen (${config.url}): HTTP ${res.status} ${await res.text().catch(() => '')}`);
      } else {
        console.log(`  Webhook erfolgreich → ${config.url} [${event}]`);
      }
    } catch (err) {
      console.error(`  Webhook-Fehler (${config.url}):`, err);
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
