import { db, schema } from './index.js';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');

  // ── Mandanten (CREDO Einrichtungen) ────────────────
  const mandantenData = [
    { mandantNr: 10, name: 'Grundschule Haddenhausen', kategorie: 'Grundschulen', dmsEmail: 'fibu-gs-haddenhausen@docubit.credo.de', primaerfarbe: '#2563EB' },
    { mandantNr: 11, name: 'Grundschule Stemwede', kategorie: 'Grundschulen', dmsEmail: 'fibu-gs-stemwede@docubit.credo.de', primaerfarbe: '#2563EB' },
    { mandantNr: 12, name: 'Grundschule Minderheide', kategorie: 'Grundschulen', dmsEmail: 'fibu-gs-minderheide@docubit.credo.de', primaerfarbe: '#2563EB' },
    { mandantNr: 30, name: 'Gesamtschule', kategorie: 'Weiterführende Schulen', dmsEmail: 'fibu-gesamtschule@docubit.credo.de', primaerfarbe: '#059669' },
    { mandantNr: 31, name: 'Gymnasium', kategorie: 'Weiterführende Schulen', dmsEmail: 'fibu-gymnasium@docubit.credo.de', primaerfarbe: '#DC2626' },
    { mandantNr: 32, name: 'Berufskolleg', kategorie: 'Weiterführende Schulen', dmsEmail: 'fibu-berufskolleg@docubit.credo.de', primaerfarbe: '#7C3AED' },
    { mandantNr: 40, name: 'CREDO Verwaltung', kategorie: 'Verwaltung', dmsEmail: 'fibu-verwaltung@docubit.credo.de', primaerfarbe: '#6B7280' },
  ];

  for (const m of mandantenData) {
    await db.insert(schema.mandanten).values(m).onConflictDoNothing();
  }
  console.log(`  ✓ ${mandantenData.length} Mandanten angelegt`);

  // ── Kostenstellen werden NICHT geseedet (über AdminCenter pflegen) ──

  // ── Inlandspauschalen 2026 ─────────────────────────
  const pauschalen2026 = [
    { typ: 'KM_PKW', betrag: '0.30', gueltigVon: new Date('2026-01-01'), gueltigBis: new Date('2026-12-31') },
    { typ: 'KM_MOTORRAD', betrag: '0.20', gueltigVon: new Date('2026-01-01'), gueltigBis: new Date('2026-12-31') },
    { typ: 'VMA_8H', betrag: '14.00', gueltigVon: new Date('2026-01-01'), gueltigBis: new Date('2026-12-31') },
    { typ: 'VMA_24H', betrag: '28.00', gueltigVon: new Date('2026-01-01'), gueltigBis: new Date('2026-12-31') },
    { typ: 'VMA_ANREISETAG', betrag: '14.00', gueltigVon: new Date('2026-01-01'), gueltigBis: new Date('2026-12-31') },
    { typ: 'KUERZUNG_FRUEHSTUECK_PCT', betrag: '20.00', gueltigVon: new Date('2026-01-01'), gueltigBis: new Date('2026-12-31') },
    { typ: 'KUERZUNG_MITTAG_PCT', betrag: '40.00', gueltigVon: new Date('2026-01-01'), gueltigBis: new Date('2026-12-31') },
    { typ: 'KUERZUNG_ABEND_PCT', betrag: '40.00', gueltigVon: new Date('2026-01-01'), gueltigBis: new Date('2026-12-31') },
  ];

  for (const p of pauschalen2026) {
    await db.insert(schema.pauschalen).values(p).onConflictDoNothing();
  }
  console.log(`  ✓ Inlandspauschalen 2026 angelegt`);

  // ── Admin-Zugang ───────────────────────────────────
  const adminPasswort = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPasswort || adminPasswort.length < 12) {
    console.error('\n  FEHLER: ADMIN_INITIAL_PASSWORD muss gesetzt sein (min. 12 Zeichen).');
    console.error('  Beispiel: ADMIN_INITIAL_PASSWORD=$(openssl rand -base64 24) npm run seed\n');
    process.exit(1);
  }
  const hash = await bcrypt.hash(adminPasswort, 12);
  await db.insert(schema.admins).values({
    email: 'admin@credo.de',
    passwortHash: hash,
    name: 'CREDO Administrator',
  }).onConflictDoNothing();
  console.log(`  ✓ Admin-Zugang angelegt (admin@credo.de)`);

  // ── E-Mail-Konfiguration (Platzhalter) ─────────────
  await db.insert(schema.emailConfig).values({
    versandMethode: 'WEBHOOK',
    absenderName: 'CREDO Finanzportal',
    absenderEmail: 'finanzportal@credo.de',
    maxVersuche: 3,
    fehlerEmail: 'admin@credo.de',
  }).onConflictDoNothing();
  console.log(`  ✓ E-Mail-Konfiguration (Platzhalter) angelegt`);

  console.log('\nSeeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
