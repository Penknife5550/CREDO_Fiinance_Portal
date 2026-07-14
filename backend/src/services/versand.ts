import { db, schema } from '../db/index.js';
import { eq, and, ne } from 'drizzle-orm';
import { sendeWebhook, type WebhookEinreichungData } from './webhook.js';
import { sendeAnDmsMitRetry, sendEmailDetailed } from './email.js';
import { aufloeseVersandkanal, type Versandkanal } from './email-utils.js';

interface VersandOptions {
  einreichungId: string;
  belegNr: string;
  dmsEmail: string;
  pdfPfad: string;
  webhookData: WebhookEinreichungData;
  smtpBetreff: string;
  smtpText: string;
}

/** Schreibt eine Zeile ins Versandprotokoll (email_log). Wirft nie. */
async function schreibeEmailLog(entry: {
  einreichungId?: string | null;
  belegNr?: string | null;
  kanal: Versandkanal;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  empfaenger?: string | null;
  betreff?: string | null;
  messageId?: string | null;
  fehler?: string | null;
  versuche?: number;
  istTest?: boolean;
}): Promise<void> {
  try {
    await db.insert(schema.emailLog).values({
      einreichungId: entry.einreichungId ?? null,
      belegNr: entry.belegNr ?? null,
      kanal: entry.kanal,
      status: entry.status,
      empfaenger: entry.empfaenger ?? null,
      betreff: entry.betreff ?? null,
      messageId: entry.messageId ?? null,
      fehler: entry.fehler ?? null,
      versuche: entry.versuche ?? 0,
      istTest: entry.istTest ?? false,
    });
  } catch (err) {
    console.error('[Versand] Versandprotokoll konnte nicht geschrieben werden:', err);
  }
}

/** Schreibt einen Status-Patch und loggt Fehler robust. Bewusst nicht-throwend,
 *  weil dies in fire-and-forget Promise-Ketten nach dem 201-Response laeuft.
 *  Mit `nurWennNichtGesendet` wird ein bereits erreichter GESENDET-Status nicht
 *  von einem spaeteren Pfad ueberschrieben (Befund J). */
async function aktualisiereVersandStatus(
  einreichungId: string,
  belegNr: string,
  patch: Partial<typeof schema.einreichungen.$inferInsert>,
  opts?: { nurWennNichtGesendet?: boolean },
): Promise<void> {
  try {
    const where = opts?.nurWennNichtGesendet
      ? and(eq(schema.einreichungen.id, einreichungId), ne(schema.einreichungen.status, 'GESENDET'))
      : eq(schema.einreichungen.id, einreichungId);
    await db.update(schema.einreichungen).set(patch).where(where);
  } catch (err) {
    console.error(`[${belegNr}] Status-Update fehlgeschlagen:`, err);
  }
}

/** Best-effort-Alarm an die konfigurierte fehlerEmail bei endgueltigem Fehlversand (Befund H).
 *  Ohne diesen Weg gaebe es ausserhalb von n8n gar keine Fehlerbenachrichtigung. */
async function benachrichtigeFehlerEmail(
  fehlerEmail: string,
  belegNr: string,
  dmsEmail: string,
  fehler: string,
): Promise<void> {
  const result = await sendEmailDetailed({
    an: fehlerEmail,
    betreff: `[FEHLER] Versand fehlgeschlagen: ${belegNr}`,
    text: [
      `Die Zustellung der Einreichung ${belegNr} an ${dmsEmail} ist nach mehreren Versuchen fehlgeschlagen.`,
      '',
      `Fehler: ${fehler}`,
      '',
      'Bitte im AdminCenter unter „Versand & Integration → Fehlgeschlagene Versände" erneut anstoßen,',
      'sobald die Ursache behoben ist.',
      '',
      'Diese Meldung wurde automatisch vom CREDO Finanzportal erstellt.',
    ].join('\n'),
  });
  if (!result.ok) {
    // Erwartbar, wenn genau der SMTP-Server ausgefallen ist — nur protokollieren.
    console.error(`[${belegNr}] Fehler-Benachrichtigung an ${fehlerEmail} konnte nicht gesendet werden: ${result.error}`);
  }
}

/** Deutsche Fehlermeldung fuer einen nicht (vollstaendig) zugestellten Webhook-Versand. */
function webhookFehlerText(wh: { konfiguriert: number; fehlgeschlagen: number }): string {
  return wh.konfiguriert === 0
    ? 'Versandmethode WEBHOOK, aber kein aktiver Webhook fuer diesen Vorgang konfiguriert.'
    : `${wh.fehlgeschlagen} von ${wh.konfiguriert} Webhook-Ziel(en) nicht erreichbar.`;
}

/** Versendet eine Einreichung entweder via n8n-Webhook oder direkt per SMTP — abhaengig
 *  von emailConfig.versandMethode. Identische Pipeline fuer Reisekosten/Erstattung/Sammelfahrt. */
export async function versendeEinreichung(opts: VersandOptions): Promise<void> {
  const { einreichungId, belegNr, dmsEmail, pdfPfad, webhookData, smtpBetreff, smtpText } = opts;

  const [emailConf] = await db.select().from(schema.emailConfig).limit(1);
  const kanal = aufloeseVersandkanal(emailConf?.versandMethode);
  const maxVersuche = emailConf?.maxVersuche && emailConf.maxVersuche > 0 ? emailConf.maxVersuche : 3;
  const fehlerEmail = emailConf?.fehlerEmail?.trim() || null;
  console.log(`[${belegNr}] Versandkanal: ${kanal}, PDF: ${pdfPfad}`);

  if (kanal === 'WEBHOOK') {
    try {
      const wh = await sendeWebhook('eingereicht', webhookData, dmsEmail, pdfPfad);
      if (wh.konfiguriert > 0 && wh.fehlgeschlagen === 0) {
        await aktualisiereVersandStatus(einreichungId, belegNr, {
          emailStatus: 'GESENDET',
          status: 'GESENDET',
        });
        await schreibeEmailLog({
          einreichungId, belegNr, kanal, status: 'SENT',
          empfaenger: dmsEmail, betreff: smtpBetreff, versuche: wh.konfiguriert,
        });
      } else {
        // Webhook wirft nicht bei HTTP-Fehlern → aus der Bilanz erkennen (Review-Fund #1).
        const fehler = webhookFehlerText(wh);
        await aktualisiereVersandStatus(einreichungId, belegNr, {
          emailStatus: 'FEHLER',
          status: 'FEHLER',
          emailLetzterFehler: fehler,
        }, { nurWennNichtGesendet: true });
        await schreibeEmailLog({
          einreichungId, belegNr, kanal, status: 'FAILED',
          empfaenger: dmsEmail, betreff: smtpBetreff, fehler, versuche: wh.konfiguriert,
        });
        if (fehlerEmail) await benachrichtigeFehlerEmail(fehlerEmail, belegNr, dmsEmail, fehler);
      }
    } catch (err) {
      const fehler = err instanceof Error ? err.message : String(err);
      console.error(`[${belegNr}] Webhook-Versand fehlgeschlagen:`, err);
      await aktualisiereVersandStatus(einreichungId, belegNr, {
        emailStatus: 'FEHLER',
        status: 'FEHLER',
        emailLetzterFehler: fehler,
      }, { nurWennNichtGesendet: true });
      await schreibeEmailLog({
        einreichungId, belegNr, kanal, status: 'FAILED',
        empfaenger: dmsEmail, betreff: smtpBetreff, fehler,
      });
      if (fehlerEmail) await benachrichtigeFehlerEmail(fehlerEmail, belegNr, dmsEmail, fehler);
    }
    return;
  }

  // Direkter SMTP-Versand (Standard).
  try {
    const emailResult = await sendeAnDmsMitRetry({
      an: dmsEmail,
      betreff: smtpBetreff,
      text: smtpText,
      pdfDateipfad: pdfPfad,
      pdfDateiname: `${belegNr}.pdf`,
    }, maxVersuche);

    if (emailResult.erfolg) {
      await aktualisiereVersandStatus(einreichungId, belegNr, {
        emailStatus: 'GESENDET',
        emailVersuche: emailResult.versuche,
        emailLetzterFehler: null,
        status: 'GESENDET',
      });
      await schreibeEmailLog({
        einreichungId, belegNr, kanal, status: 'SENT',
        empfaenger: dmsEmail, betreff: smtpBetreff,
        messageId: emailResult.messageId, versuche: emailResult.versuche,
      });
      return;
    }

    const fehler = emailResult.fehler || 'Unbekannter Fehler';
    await aktualisiereVersandStatus(einreichungId, belegNr, {
      emailStatus: 'FEHLER',
      emailVersuche: emailResult.versuche,
      emailLetzterFehler: fehler,
      status: 'FEHLER',
    }, { nurWennNichtGesendet: true });
    await schreibeEmailLog({
      einreichungId, belegNr, kanal, status: 'FAILED',
      empfaenger: dmsEmail, betreff: smtpBetreff, fehler, versuche: emailResult.versuche,
    });

    // n8n-Fallback: Fehler-Webhook feuern (falls konfiguriert) …
    await sendeWebhook('fehler', webhookData, dmsEmail, pdfPfad).catch(err =>
      console.error(`[${belegNr}] Fehler-Webhook fehlgeschlagen:`, err),
    );
    // … und die konfigurierte fehlerEmail benachrichtigen (Befund H).
    if (fehlerEmail) await benachrichtigeFehlerEmail(fehlerEmail, belegNr, dmsEmail, fehler);
  } catch (err) {
    console.error(`[${belegNr}] SMTP-Pipeline-Fehler:`, err);
  }
}

interface ResendResult {
  erfolg: boolean;
  versuche: number;
  fehler?: string;
}

/**
 * Manueller Requeue eines fehlgeschlagenen Versands (Befund G). Nutzt das bereits
 * erzeugte PDF (mit Deckblatt/QR/Zusammenfassung), damit die DMS-Zustellung
 * inhaltlich identisch zum Erstversand ist.
 *
 * Doppelversand-Schutz (2 Ebenen, gegen Doppelbelege im DMS):
 *  1. Atomarer CAS-Claim ueber `emailVersuche`: zwei parallele Resends (Doppelklick,
 *     zweiter Admin) — nur der erste trifft die Zeile, der zweite bricht ab.
 *  2. Der frische Erstversand (fire-and-forget, emailStatus=AUSSTEHEND) wird gar nicht
 *     erst zum Requeue angeboten (Alters-Filter in der Admin-Route), damit Requeue
 *     nicht parallel zum noch laufenden Erstversand feuert.
 *
 * Kanalbewusst: requeued ueber denselben Kanal wie der Regelversand (WEBHOOK→n8n,
 * sonst SMTP) — sonst schluege der Resend auf reinem n8n-Betrieb immer fehl bzw.
 * umginge n8n (Paritaet).
 */
export async function versendeErneut(einreichungId: string): Promise<ResendResult> {
  const [einreichung] = await db.select().from(schema.einreichungen)
    .where(eq(schema.einreichungen.id, einreichungId)).limit(1);
  if (!einreichung) return { erfolg: false, versuche: 0, fehler: 'Einreichung nicht gefunden' };
  if (einreichung.status === 'GESENDET') {
    return { erfolg: false, versuche: 0, fehler: 'Bereits erfolgreich versendet' };
  }
  if (!einreichung.pdfDateipfad) {
    return { erfolg: false, versuche: 0, fehler: 'Kein PDF vorhanden — Einreichung kann nicht erneut versendet werden' };
  }

  // (1) Atomarer Claim: emailVersuche als Optimistic-Lock-Token hochzaehlen, aber nur
  //     wenn die Zeile noch den gelesenen Stand hat und nicht bereits GESENDET ist.
  //     Ein zweiter paralleler Resend liest denselben Stand, sein UPDATE trifft dann
  //     keine Zeile mehr → er bricht ab, statt ein zweites Mal zuzustellen.
  const claimVersuche = (einreichung.emailVersuche || 0) + 1;
  const claimed = await db.update(schema.einreichungen)
    .set({ emailVersuche: claimVersuche })
    .where(and(
      eq(schema.einreichungen.id, einreichungId),
      eq(schema.einreichungen.emailVersuche, einreichung.emailVersuche || 0),
      ne(schema.einreichungen.status, 'GESENDET'),
    ))
    .returning({ id: schema.einreichungen.id });
  if (claimed.length === 0) {
    return { erfolg: false, versuche: 0, fehler: 'Versand läuft bereits oder wurde inzwischen abgeschlossen.' };
  }

  const [mandant] = await db.select().from(schema.mandanten)
    .where(eq(schema.mandanten.id, einreichung.mandantId)).limit(1);
  if (!mandant) return { erfolg: false, versuche: 0, fehler: 'Mandant nicht gefunden' };

  const [emailConf] = await db.select().from(schema.emailConfig).limit(1);
  const kanal = aufloeseVersandkanal(emailConf?.versandMethode);
  const fehlerEmail = emailConf?.fehlerEmail?.trim() || null;
  const betreff = `[${einreichung.belegNr}] ${einreichung.mitarbeiterVorname} ${einreichung.mitarbeiterNachname} - ${mandant.name}`;

  // Gemeinsame Statuspflege fuer beide Kanaele.
  const erfolgVermerken = async (versuche: number, messageId?: string) => {
    await aktualisiereVersandStatus(einreichungId, einreichung.belegNr, {
      emailStatus: 'GESENDET', emailVersuche: claimVersuche, emailLetzterFehler: null, status: 'GESENDET',
    }, { nurWennNichtGesendet: true });
    await schreibeEmailLog({
      einreichungId, belegNr: einreichung.belegNr, kanal, status: 'SENT',
      empfaenger: mandant.dmsEmail, betreff, messageId, versuche,
    });
  };
  const fehlerVermerken = async (fehler: string, versuche: number) => {
    await aktualisiereVersandStatus(einreichungId, einreichung.belegNr, {
      emailStatus: 'FEHLER', emailVersuche: claimVersuche, emailLetzterFehler: fehler, status: 'FEHLER',
    }, { nurWennNichtGesendet: true });
    await schreibeEmailLog({
      einreichungId, belegNr: einreichung.belegNr, kanal, status: 'FAILED',
      empfaenger: mandant.dmsEmail, betreff, fehler, versuche,
    });
    if (fehlerEmail) await benachrichtigeFehlerEmail(fehlerEmail, einreichung.belegNr, mandant.dmsEmail, fehler);
  };

  // ── WEBHOOK-Kanal (n8n): denselben Weg wie der Regelversand nutzen. ──
  if (kanal === 'WEBHOOK') {
    const [kostenstelle] = einreichung.kostenstelleId
      ? await db.select().from(schema.kostenstellen).where(eq(schema.kostenstellen.id, einreichung.kostenstelleId)).limit(1)
      : [undefined];
    const webhookData: WebhookEinreichungData = {
      id: einreichung.id,
      belegNr: einreichung.belegNr,
      typ: einreichung.typ,
      status: 'EINGEREICHT',
      mandant: mandant.name,
      mandantNr: mandant.mandantNr,
      kostenstelle: kostenstelle?.bezeichnung || '',
      mitarbeiter: {
        vorname: einreichung.mitarbeiterVorname,
        nachname: einreichung.mitarbeiterNachname,
        personalNr: einreichung.mitarbeiterPersonalNr,
      },
      gesamtbetrag: String(einreichung.gesamtbetrag),
      iban: einreichung.bankIban ?? '',
      kontoinhaber: einreichung.bankKontoinhaber ?? '',
    };
    try {
      const wh = await sendeWebhook('eingereicht', webhookData, mandant.dmsEmail, einreichung.pdfDateipfad);
      if (wh.konfiguriert > 0 && wh.fehlgeschlagen === 0) {
        await erfolgVermerken(wh.konfiguriert);
        return { erfolg: true, versuche: wh.konfiguriert };
      }
      const fehler = webhookFehlerText(wh);
      await fehlerVermerken(fehler, wh.konfiguriert);
      return { erfolg: false, versuche: wh.konfiguriert, fehler };
    } catch (err) {
      const fehler = err instanceof Error ? err.message : String(err);
      await fehlerVermerken(fehler, 1);
      return { erfolg: false, versuche: 1, fehler };
    }
  }

  // ── SMTP-Kanal (Standard). Ein Versuch: der Requeue laeuft synchron im Admin-Request;
  //    die langen Retry-Wartezeiten (bis 90 s) wuerden die Antwort blockieren. ──
  const text = [
    `Erneuter Versand der Einreichung ${einreichung.belegNr}.`,
    '',
    `Mandant: ${mandant.name} (${mandant.mandantNr})`,
    `Einreicher: ${einreichung.mitarbeiterVorname} ${einreichung.mitarbeiterNachname}`,
    `Gesamtbetrag: ${Number(einreichung.gesamtbetrag).toFixed(2).replace('.', ',')} EUR`,
    '',
    'Alle Details und Belege befinden sich im angehaengten PDF (Deckblatt mit QR + Zusammenfassung).',
    'Diese E-Mail wurde automatisch vom CREDO Finanzportal erstellt.',
  ].join('\n');

  const emailResult = await sendeAnDmsMitRetry({
    an: mandant.dmsEmail,
    betreff,
    text,
    pdfDateipfad: einreichung.pdfDateipfad,
    pdfDateiname: `${einreichung.belegNr}.pdf`,
  }, 1);

  if (emailResult.erfolg) {
    await erfolgVermerken(emailResult.versuche, emailResult.messageId);
    return { erfolg: true, versuche: emailResult.versuche };
  }

  const fehler = emailResult.fehler || 'Unbekannter Fehler';
  await fehlerVermerken(fehler, emailResult.versuche);
  return { erfolg: false, versuche: emailResult.versuche, fehler };
}
