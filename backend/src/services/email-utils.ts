/**
 * Reine, DB-/netzfreie Helfer rund um den E-Mail-Versand — direkt unit-testbar
 * (email.ts/versand.ts importieren db/index.ts und sind daher nicht ohne
 * DATABASE_URL importierbar). Muster wie webhook-utils.ts.
 */

export type Versandkanal = 'SMTP' | 'WEBHOOK';

/**
 * Loest den Versandkanal robust auf. 'MS365' war toter Code (kein OAuth-Versand)
 * und wird wie SMTP behandelt; jeder unbekannte/leere Wert faellt ebenfalls auf
 * SMTP zurueck (eindeutiger Default statt der frueheren WEBHOOK-Inkonsistenz, Befund C).
 */
export function aufloeseVersandkanal(versandMethode: string | null | undefined): Versandkanal {
  return (versandMethode || '').trim().toUpperCase() === 'WEBHOOK' ? 'WEBHOOK' : 'SMTP';
}

export interface SmtpConfigResolved {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  maxVersuche: number;
  fehlerEmail: string | null;
}

/** Ein Zeilen-Ausschnitt der `email_config`, Passwort bereits entschluesselt. */
export interface EmailConfigInput {
  smtpServer: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPasswort: string | null;
  absenderName: string | null;
  absenderEmail: string | null;
  maxVersuche: number | null;
  fehlerEmail: string | null;
}

export interface SmtpEnvFallback {
  host?: string;
  port?: string;
  user?: string;
  pass?: string;
  fromName?: string;
  fromEmail?: string;
}

/** Office365-Nachrichtengrenze. SMTP kodiert Anhaenge base64 (+~33 %). */
export const MAX_MESSAGE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Groesse einer Datei nach base64-Kodierung (so gross wird sie im SMTP-Body). */
export function base64Groesse(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

/**
 * Prueft, ob ein Anhang die Nachrichtengrenze sprengt. Liefert eine deutsche
 * Fehlermeldung statt eines stillen Fehlversands (Befund F).
 */
export function pruefeAnhangGroesse(
  bytes: number,
  maxMessageBytes = MAX_MESSAGE_BYTES,
): { ok: boolean; fehler?: string } {
  const kodiert = base64Groesse(bytes);
  if (kodiert > maxMessageBytes) {
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    const maxMb = (maxMessageBytes / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      fehler: `Anhang zu gross (${mb} MB, nach E-Mail-Kodierung ueber ${maxMb} MB). `
        + `Bitte Belege verkleinern oder die Einreichung ueber einen anderen Weg zustellen.`,
    };
  }
  return { ok: true };
}

/**
 * Fuehrt DB-Konfiguration und ENV-Fallback pro Feld zusammen. Gibt `null`
 * zurueck, wenn Host oder Benutzer fehlen (dann ist kein Versand moeglich).
 * `secure` wird aus dem Port abgeleitet (465 = implizites TLS).
 */
export function resolveSmtpConfig(
  row: EmailConfigInput | null | undefined,
  env: SmtpEnvFallback,
): SmtpConfigResolved | null {
  const host = (row?.smtpServer || env.host || '').trim();
  const portRaw = row?.smtpPort ?? (env.port ? parseInt(env.port, 10) : undefined);
  const port = typeof portRaw === 'number' && Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 587;
  const user = (row?.smtpUser || env.user || '').trim();
  const pass = row?.smtpPasswort ?? env.pass ?? '';
  const fromEmail = (row?.absenderEmail || env.fromEmail || user).trim();
  const fromName = (row?.absenderName || env.fromName || 'CREDO Finanzportal').trim();
  const maxVersuche = row?.maxVersuche && row.maxVersuche > 0 ? row.maxVersuche : 3;
  const fehlerEmail = row?.fehlerEmail?.trim() || null;

  if (!host || !user || !fromEmail) return null;

  return { host, port, secure: port === 465, user, pass, fromName, fromEmail, maxVersuche, fehlerEmail };
}

/** Signatur ueber die versandrelevanten Felder — steuert die Transporter-Cache-Invalidierung. */
export function configSignatur(c: SmtpConfigResolved): string {
  return [c.host, c.port, c.secure, c.user, c.pass, c.fromEmail, c.fromName].join('|');
}
