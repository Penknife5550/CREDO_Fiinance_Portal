import { z } from 'zod';

const envSchema = z.object({
  // Pflicht
  DATABASE_URL: z.string().min(1, 'DATABASE_URL muss gesetzt sein'),

  // Optional
  SMTP_HOST: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
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
