import { z } from 'zod';

const envSchema = z.object({
  // Pflicht
  DATABASE_URL: z.string().min(1, 'DATABASE_URL muss gesetzt sein'),

  // Optional — SMTP-Fallback (greift nur, wenn email_config die Felder nicht setzt)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .regex(/^\d+$/, 'SMTP_PORT muss eine Zahl sein (z.B. 587 oder 465)')
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM_EMAIL: z.string().email('MAIL_FROM_EMAIL muss eine gueltige E-Mail-Adresse sein').optional(),
  MAIL_FROM_NAME: z.string().optional(),
  // Opt-in, um die TLS-Zertifikatspruefung abzuschalten (nur fuer lokale/Test-Relays
  // mit Self-Signed-Zertifikat). In Produktion NICHT setzen.
  SMTP_ALLOW_SELF_SIGNED: z.enum(['true', 'false']).optional(),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY muss 64 Hex-Zeichen sein (openssl rand -hex 32)')
    .optional(),
  APP_URL: z.string().optional(),
  PORT: z.string().optional(),
  ADMIN_INITIAL_PASSWORD: z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n  Umgebungsvariablen-Fehler:');
  console.error('  ─────────────────────────');
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('');
  process.exit(1);
}

export const env = result.data;
