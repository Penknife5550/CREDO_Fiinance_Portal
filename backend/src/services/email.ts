/**
 * CREDO Finanzportal – SMTP-Direktversand (primaerer Versandkanal).
 *
 * Konfiguration wird aus der Datenbank (`email_config`) gelesen, ENV bleibt als
 * Fallback. Das SMTP-Passwort liegt verschluesselt (enc:v1:, crypto.ts) und wird
 * erst beim Transporter-Bau entschluesselt. Der Transporter wird gecacht
 * (Connection-Pool) und nur neu gebaut, wenn sich die Konfiguration aendert.
 *
 * Blaupause: HR-Portal `src/lib/mailer.ts` (DB-getrieben, harte Timeouts,
 * `sendEmailDetailed` wirft nie). Frueher las diese Datei ausschliesslich
 * `process.env.SMTP_*` — die AdminCenter-Config war wirkungslos (Befund A).
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import { db, schema } from '../db/index.js';
import { decryptSecretIfNeeded } from './crypto.js';
import {
  resolveSmtpConfig,
  configSignatur,
  pruefeAnhangGroesse,
  type SmtpConfigResolved,
  type SmtpEnvFallback,
} from './email-utils.js';

// =============================================
// Typen
// =============================================
export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailOptions {
  an: string;
  betreff: string;
  text: string;
  html?: string;
  cc?: string;
  bcc?: string;
  attachments?: MailAttachment[];
  /** Bequemer Pfad-Anhang; wird gelesen, groessengeprueft und als PDF angehaengt. */
  pdfDateipfad?: string;
  pdfDateiname?: string;
}

export type SendResult =
  | { ok: true; messageId?: string; accepted: string[] }
  // permanent = erneuter Versuch zwecklos (z.B. Anhang zu gross/unlesbar) → Retry abbrechen
  | { ok: false; error: string; permanent?: boolean };

export interface RetryResult {
  erfolg: boolean;
  versuche: number;
  fehler?: string;
  messageId?: string;
}

// =============================================
// DB-Konfiguration laden
// =============================================
async function ladeEmailConfig(): Promise<SmtpConfigResolved | null> {
  const [row] = await db.select().from(schema.emailConfig).limit(1);

  let passwort: string | null = null;
  try {
    passwort = decryptSecretIfNeeded(row?.smtpPasswortEncrypted);
  } catch (err) {
    console.error('[Mailer] SMTP-Passwort konnte nicht entschluesselt werden:', err);
    passwort = null;
  }

  const env: SmtpEnvFallback = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.MAIL_FROM_NAME,
    fromEmail: process.env.MAIL_FROM_EMAIL,
  };

  return resolveSmtpConfig(
    row
      ? {
          smtpServer: row.smtpServer,
          smtpPort: row.smtpPort,
          smtpUser: row.smtpUser,
          smtpPasswort: passwort,
          absenderName: row.absenderName,
          absenderEmail: row.absenderEmail,
          maxVersuche: row.maxVersuche,
          fehlerEmail: row.fehlerEmail,
        }
      : null,
    env,
  );
}

// =============================================
// Transporter (gecacht, mit Pool + harten Timeouts)
// =============================================
let cached: { signatur: string; transporter: nodemailer.Transporter; config: SmtpConfigResolved } | null = null;

async function getTransporter(): Promise<{ transporter: nodemailer.Transporter; config: SmtpConfigResolved } | null> {
  const config = await ladeEmailConfig();
  if (!config) return null;

  const signatur = configSignatur(config);
  if (cached && cached.signatur === signatur) {
    return { transporter: cached.transporter, config };
  }

  // Konfiguration hat sich geaendert (oder erster Aufruf): alten Pool schliessen.
  if (cached) {
    try { cached.transporter.close(); } catch { /* ignore */ }
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    // Connection-Pool: nicht bei jedem Versuch neu verbinden (Befund E, Office365-Limits).
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    // Harte Timeouts: ein haengender Server darf den Hintergrund-Versand nicht minutenlang blockieren (Befund I).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // STARTTLS erzwingen, wenn nicht implizit-TLS (Port != 465): SMTP-Benutzer +
    // (entschluesseltes) Passwort duerfen nie ueber eine unverschluesselte Verbindung gehen.
    requireTLS: !config.secure,
    tls: {
      // Zertifikatspruefung standardmaessig streng — es ist eine credential-tragende
      // Verbindung. Abschwaechung NUR explizit per ENV (z.B. lokales Self-Signed-Relay),
      // nicht still an NODE_ENV gekoppelt (sonst waere ein vergessenes NODE_ENV=production
      // in Prod stillschweigend unsicher).
      rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED !== 'true',
    },
  });

  cached = { signatur, transporter, config };
  return { transporter, config };
}

/** Liefert die aufgeloeste Config (fuer maxVersuche/fehlerEmail), ohne den Pool zu bauen. */
export async function getVersandConfig(): Promise<SmtpConfigResolved | null> {
  return ladeEmailConfig();
}

// =============================================
// Versand — wirft niemals
// =============================================
export async function sendEmailDetailed(options: EmailOptions): Promise<SendResult> {
  const result = await getTransporter();
  if (!result) {
    return {
      ok: false,
      error: 'SMTP ist nicht konfiguriert. Bitte im AdminCenter unter „Versand & Integration" '
        + 'Server, Benutzer und Absender eintragen (oder die SMTP_*-ENV-Variablen setzen).',
    };
  }

  // Anhaenge sammeln (Buffer haben Vorrang; sonst PDF-Pfad lesen).
  const attachments: MailAttachment[] = [...(options.attachments ?? [])];
  if (options.pdfDateipfad) {
    try {
      const buffer = await fs.promises.readFile(options.pdfDateipfad);
      attachments.push({
        filename: options.pdfDateiname || 'Dokument.pdf',
        content: buffer,
        contentType: 'application/pdf',
      });
    } catch (err) {
      return { ok: false, error: `Anhang konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`, permanent: true };
    }
  }

  // Groessenpruefung (Befund F) — einzige Stelle; ein zu grosser Anhang ist permanent.
  const gesamtBytes = attachments.reduce((sum, a) => sum + a.content.length, 0);
  if (gesamtBytes > 0) {
    const check = pruefeAnhangGroesse(gesamtBytes);
    if (!check.ok) return { ok: false, error: check.fehler!, permanent: true };
  }

  try {
    const info = await result.transporter.sendMail({
      from: `"${result.config.fromName}" <${result.config.fromEmail}>`,
      to: options.an,
      cc: options.cc || undefined,
      bcc: options.bcc || undefined,
      subject: options.betreff,
      text: options.text,
      html: options.html,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    return {
      ok: true,
      messageId: info.messageId,
      accepted: ((info.accepted ?? []) as Array<string | { address: string }>).map((a) =>
        typeof a === 'string' ? a : a.address,
      ),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Mailer] Versand fehlgeschlagen:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Versand mit Retry. Liest den PDF-Anhang einmal (statt bei jedem Versuch neu).
 * Die Groessengrenze prueft sendEmailDetailed einmalig; permanente Fehler
 * (Anhang zu gross/unlesbar) brechen die Schleife sofort ab. Wirft niemals.
 */
export async function sendeAnDmsMitRetry(options: EmailOptions, maxVersuche = 3): Promise<RetryResult> {
  const wartezeiten = [0, 30000, 60000]; // 0s, 30s, 60s

  // PDF-Anhang einmal lesen (statt bei jedem Versuch neu).
  let attachments: MailAttachment[] | undefined = options.attachments;
  if (options.pdfDateipfad) {
    try {
      const buffer = await fs.promises.readFile(options.pdfDateipfad);
      attachments = [
        ...(options.attachments ?? []),
        { filename: options.pdfDateiname || 'Dokument.pdf', content: buffer, contentType: 'application/pdf' },
      ];
    } catch (err) {
      return { erfolg: false, versuche: 0, fehler: `Anhang konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  const versandOptions: EmailOptions = {
    an: options.an,
    betreff: options.betreff,
    text: options.text,
    html: options.html,
    cc: options.cc,
    bcc: options.bcc,
    attachments,
  };

  const anzahl = maxVersuche > 0 ? maxVersuche : 3;
  let letzterFehler = 'Unbekannter Fehler';
  let versucht = 0;

  for (let versuch = 1; versuch <= anzahl; versuch++) {
    versucht = versuch;
    if (versuch > 1) {
      await new Promise((r) => setTimeout(r, wartezeiten[Math.min(versuch - 1, wartezeiten.length - 1)]));
    }
    const result = await sendEmailDetailed(versandOptions);
    if (result.ok) {
      return { erfolg: true, versuche: versuch, messageId: result.messageId };
    }
    letzterFehler = result.error;
    console.error(`[Mailer] Versuch ${versuch}/${anzahl} fehlgeschlagen: ${letzterFehler}`);
    if (result.permanent) break; // Anhang zu gross/unlesbar → erneuter Versuch zwecklos
  }

  return { erfolg: false, versuche: versucht, fehler: letzterFehler };
}

// =============================================
// SMTP-Verbindung testen (AdminCenter)
// =============================================
export async function testSmtpVerbindung(
  testEmail: string,
): Promise<{ success: boolean; error?: string; durationMs: number }> {
  const start = Date.now();
  try {
    const result = await getTransporter();
    if (!result) {
      return {
        success: false,
        error: 'SMTP ist nicht konfiguriert. Bitte Server, Benutzer und Absender eintragen.',
        durationMs: Date.now() - start,
      };
    }

    await result.transporter.verify();

    await result.transporter.sendMail({
      from: `"${result.config.fromName}" <${result.config.fromEmail}>`,
      to: testEmail,
      subject: 'CREDO Finanzportal – SMTP-Verbindungstest',
      text: 'Dies ist eine Test-E-Mail. Die SMTP-Konfiguration des CREDO Finanzportals funktioniert korrekt.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #575756;">
          <h2 style="color: #575756;">✅ SMTP-Verbindungstest erfolgreich</h2>
          <p>Die SMTP-Konfiguration des CREDO Finanzportals funktioniert korrekt.</p>
          <p style="color: #999; font-size: 12px;">Gesendet am ${new Date().toLocaleString('de-DE')}</p>
        </div>
      `,
    });

    return { success: true, durationMs: Date.now() - start };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      durationMs: Date.now() - start,
    };
  }
}
