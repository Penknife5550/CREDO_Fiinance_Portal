import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

interface EmailOptions {
  an: string;
  betreff: string;
  text: string;
  pdfDateipfad: string;
  pdfDateiname: string;
}

export async function sendeAnDms(options: EmailOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const pdfBuffer = await fs.promises.readFile(options.pdfDateipfad);

  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'CREDO Finanzportal'}" <${process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER}>`,
    to: options.an,
    subject: options.betreff,
    text: options.text,
    attachments: [
      {
        filename: options.pdfDateiname,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

export async function sendeAnDmsMitRetry(
  options: EmailOptions,
  maxVersuche = 3,
): Promise<{ erfolg: boolean; versuche: number; fehler?: string }> {
  const wartezeiten = [0, 30000, 60000]; // 0s, 30s, 60s

  for (let versuch = 1; versuch <= maxVersuche; versuch++) {
    try {
      if (versuch > 1) {
        await new Promise(resolve => setTimeout(resolve, wartezeiten[versuch - 1]));
      }
      await sendeAnDms(options);
      return { erfolg: true, versuche: versuch };
    } catch (err) {
      const fehlerMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error(`E-Mail-Versand Versuch ${versuch}/${maxVersuche} fehlgeschlagen:`, fehlerMsg);

      if (versuch === maxVersuche) {
        return { erfolg: false, versuche: versuch, fehler: fehlerMsg };
      }
    }
  }

  return { erfolg: false, versuche: maxVersuche, fehler: 'Max. Versuche erreicht' };
}
