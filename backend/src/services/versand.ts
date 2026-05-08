import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { sendeWebhook, type WebhookEinreichungData } from './webhook.js';
import { sendeAnDmsMitRetry } from './email.js';

interface VersandOptions {
  einreichungId: string;
  belegNr: string;
  dmsEmail: string;
  pdfPfad: string;
  webhookData: WebhookEinreichungData;
  smtpBetreff: string;
  smtpText: string;
}

/** Schreibt einen Status-Patch und loggt Fehler robust. Bewusst nicht-throwend,
 *  weil dies in fire-and-forget Promise-Ketten nach dem 201-Response laeuft. */
async function aktualisiereVersandStatus(
  einreichungId: string,
  belegNr: string,
  patch: Partial<typeof schema.einreichungen.$inferInsert>,
): Promise<void> {
  try {
    await db
      .update(schema.einreichungen)
      .set(patch)
      .where(eq(schema.einreichungen.id, einreichungId));
  } catch (err) {
    console.error(`[${belegNr}] Status-Update fehlgeschlagen:`, err);
  }
}

/** Versendet eine Einreichung entweder via n8n-Webhook oder direkt per SMTP — abhaengig
 *  von emailConfig.versandMethode. Identische Pipeline fuer Reisekosten/Erstattung/Sammelfahrt. */
export async function versendeEinreichung(opts: VersandOptions): Promise<void> {
  const { einreichungId, belegNr, dmsEmail, pdfPfad, webhookData, smtpBetreff, smtpText } = opts;

  const [emailConf] = await db.select().from(schema.emailConfig).limit(1);
  const versandMethode = emailConf?.versandMethode || 'WEBHOOK';
  console.log(`[${belegNr}] Versandmethode: ${versandMethode}, PDF: ${pdfPfad}`);

  if (versandMethode === 'WEBHOOK') {
    try {
      await sendeWebhook('eingereicht', webhookData, dmsEmail, pdfPfad);
      await aktualisiereVersandStatus(einreichungId, belegNr, {
        emailStatus: 'GESENDET',
        status: 'GESENDET',
      });
    } catch (err) {
      console.error(`[${belegNr}] Webhook-Versand fehlgeschlagen:`, err);
      await aktualisiereVersandStatus(einreichungId, belegNr, {
        emailStatus: 'FEHLER',
        status: 'FEHLER',
        emailLetzterFehler: String(err),
      });
    }
    return;
  }

  // Direkter SMTP-Versand
  try {
    const emailResult = await sendeAnDmsMitRetry({
      an: dmsEmail,
      betreff: smtpBetreff,
      text: smtpText,
      pdfDateipfad: pdfPfad,
      pdfDateiname: `${belegNr}.pdf`,
    });

    const newStatus = emailResult.erfolg ? 'GESENDET' : 'FEHLER';
    await aktualisiereVersandStatus(einreichungId, belegNr, {
      emailStatus: emailResult.erfolg ? 'GESENDET' : 'FEHLER',
      emailVersuche: emailResult.versuche,
      emailLetzterFehler: emailResult.fehler || null,
      status: newStatus,
    });

    if (!emailResult.erfolg) {
      await sendeWebhook('fehler', webhookData, dmsEmail, pdfPfad).catch(err =>
        console.error(`[${belegNr}] Fehler-Webhook fehlgeschlagen:`, err),
      );
    }
  } catch (err) {
    console.error(`[${belegNr}] SMTP-Pipeline-Fehler:`, err);
  }
}
