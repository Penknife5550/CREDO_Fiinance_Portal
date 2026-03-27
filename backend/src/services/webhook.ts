import { db, schema } from '../db/index.js';

interface WebhookPayload {
  event: 'eingereicht' | 'status_geaendert' | 'fehler';
  timestamp: string;
  an: string;
  einreichung: {
    id: string;
    belegNr: string;
    typ: 'REISEKOSTEN' | 'ERSTATTUNG';
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
export async function sendeWebhook(event: WebhookPayload['event'], data: WebhookPayload['einreichung'], an: string) {
  const configs = await db.select().from(schema.webhookConfig);

  for (const config of configs) {
    if (!config.aktiv || !config.url) continue;

    // Typ-Filter prüfen (ALLE, REISEKOSTEN, ERSTATTUNG)
    if (config.typFilter && config.typFilter !== 'ALLE' && config.typFilter !== data.typ) continue;

    // Event-Filter prüfen
    if (event === 'eingereicht' && !config.eventEingereicht) continue;
    if (event === 'status_geaendert' && !config.eventStatusGeaendert) continue;
    if (event === 'fehler' && !config.eventFehler) continue;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      an,
      einreichung: data,
    };

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      ...buildAuthHeaders(config),
    };

    try {
      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`Webhook fehlgeschlagen (${config.url}): HTTP ${res.status}`);
      } else {
        console.log(`  Webhook gesendet → ${config.url} [${event}]`);
      }
    } catch (err) {
      console.error(`Webhook-Fehler (${config.url}):`, err);
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
