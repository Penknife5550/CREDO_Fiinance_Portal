import { pgTable, uuid, varchar, text, integer, decimal, boolean, timestamp, pgEnum, serial, index } from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────

export const einreichungTypEnum = pgEnum('einreichung_typ', ['REISEKOSTEN', 'ERSTATTUNG', 'SAMMELFAHRT']);
export const einreichungStatusEnum = pgEnum('einreichung_status', ['EINGEREICHT', 'GESENDET', 'FEHLER']);
export const emailStatusEnum = pgEnum('email_status', ['AUSSTEHEND', 'GESENDET', 'FEHLER']);
export const verkehrsmittelEnum = pgEnum('verkehrsmittel', ['PKW', 'MOTORRAD', 'OEPNV', 'BAHN', 'FLUG', 'SONSTIGE']);
export const abfahrtOrtEnum = pgEnum('abfahrt_ort', ['WOHNUNG', 'TAETIGKEIT']);
export const reisetagTypEnum = pgEnum('reisetag_typ', ['ANREISE', 'GANZTAG', 'ABREISE', 'EINTAEGIG']);
export const erstattungKategorieEnum = pgEnum('erstattung_kategorie', [
  'BUEROMATERIAL', 'FACHLITERATUR', 'LEBENSMITTEL', 'ARBEITSMITTEL', 'FORTBILDUNG', 'SONSTIGES'
]);

// ── Mandanten ──────────────────────────────────────────

export const mandanten = pgTable('mandanten', {
  id: uuid('id').defaultRandom().primaryKey(),
  mandantNr: integer('mandant_nr').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  kategorie: varchar('kategorie', { length: 100 }).notNull(),
  dmsEmail: varchar('dms_email', { length: 255 }).notNull(),
  primaerfarbe: varchar('primaerfarbe', { length: 7 }).notNull().default('#6B7280'),
  logo: varchar('logo', { length: 500 }),
  active: boolean('active').notNull().default(true),
  // Kostenstellen-Sichtbarkeit pro Vorgangstyp (Default: anzeigen)
  kstReisekostenAn: boolean('kst_reisekosten_an').notNull().default(true),
  kstErstattungAn: boolean('kst_erstattung_an').notNull().default(true),
  kstSammelfahrtAn: boolean('kst_sammelfahrt_an').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  activeIdx: index('mandanten_active_idx').on(t.active),
}));

// ── Kostenstellen ──────────────────────────────────────

export const kostenstellen = pgTable('kostenstellen', {
  id: uuid('id').defaultRandom().primaryKey(),
  mandantId: uuid('mandant_id').notNull().references(() => mandanten.id, { onDelete: 'cascade' }),
  bezeichnung: varchar('bezeichnung', { length: 255 }).notNull(),
  nummer: varchar('nummer', { length: 20 }).notNull(),
  active: boolean('active').notNull().default(true),
}, (t) => ({
  mandantActiveIdx: index('kostenstellen_mandant_active_idx').on(t.mandantId, t.active),
}));

// ── Einreichungen (Reisekosten + Erstattungen) ─────────

export const einreichungen = pgTable('einreichungen', {
  id: uuid('id').defaultRandom().primaryKey(),
  typ: einreichungTypEnum('typ').notNull(),
  belegNr: varchar('beleg_nr', { length: 20 }).notNull().unique(),
  mandantId: uuid('mandant_id').notNull().references(() => mandanten.id),
  kostenstelleId: uuid('kostenstelle_id').references(() => kostenstellen.id),
  status: einreichungStatusEnum('status').notNull().default('EINGEREICHT'),

  // Persönliche Daten (pro Einreichung, kein Account)
  mitarbeiterVorname: varchar('mitarbeiter_vorname', { length: 100 }).notNull(),
  mitarbeiterNachname: varchar('mitarbeiter_nachname', { length: 100 }).notNull(),
  mitarbeiterPersonalNr: varchar('mitarbeiter_personal_nr', { length: 20 }).notNull(),
  bankIban: varchar('bank_iban', { length: 34 }).notNull(),
  bankKontoinhaber: varchar('bank_kontoinhaber', { length: 200 }).notNull(),

  // Nur bei REISEKOSTEN
  reiseanlass: text('reiseanlass'),
  reiseziel: text('reiseziel'),
  abfahrtOrt: abfahrtOrtEnum('abfahrt_ort'),
  abfahrtZeit: timestamp('abfahrt_zeit'),
  rueckkehrZeit: timestamp('rueckkehr_zeit'),
  land: varchar('land', { length: 100 }), // NULL = Inland
  verkehrsmittel: verkehrsmittelEnum('verkehrsmittel'),
  kmGefahren: decimal('km_gefahren', { precision: 8, scale: 2 }),
  kmBerechnet: decimal('km_berechnet', { precision: 8, scale: 2 }),
  kmPauschaleSatz: decimal('km_pauschale_satz', { precision: 4, scale: 2 }),
  kmBetrag: decimal('km_betrag', { precision: 10, scale: 2 }),
  vmaBrutto: decimal('vma_brutto', { precision: 10, scale: 2 }),
  vmaKuerzung: decimal('vma_kuerzung', { precision: 10, scale: 2 }),
  vmaNetto: decimal('vma_netto', { precision: 10, scale: 2 }),
  weitereKostenSumme: decimal('weitere_kosten_summe', { precision: 10, scale: 2 }),

  // Gemeinsame Felder
  gesamtbetrag: decimal('gesamtbetrag', { precision: 10, scale: 2 }).notNull(),
  unterschriftBild: text('unterschrift_bild'), // Base64-encoded PNG
  unterschriftZeit: timestamp('unterschrift_zeit'),
  pdfDateipfad: varchar('pdf_dateipfad', { length: 500 }),
  emailStatus: emailStatusEnum('email_status').notNull().default('AUSSTEHEND'),
  emailVersuche: integer('email_versuche').notNull().default(0),
  emailLetzterFehler: text('email_letzter_fehler'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
}, (t) => ({
  mandantIdx: index('einreichungen_mandant_idx').on(t.mandantId),
  statusIdx: index('einreichungen_status_idx').on(t.status),
  emailStatusIdx: index('einreichungen_email_status_idx').on(t.emailStatus),
  createdAtIdx: index('einreichungen_created_at_idx').on(t.createdAt),
}));

// ── Reisetage (tagesweise VMA-Erfassung) ───────────────

export const reisetage = pgTable('reisetage', {
  id: uuid('id').defaultRandom().primaryKey(),
  einreichungId: uuid('einreichung_id').notNull().references(() => einreichungen.id, { onDelete: 'cascade' }),
  datum: timestamp('datum').notNull(),
  typ: reisetagTypEnum('typ').notNull(),
  fruehstueckGestellt: boolean('fruehstueck_gestellt').notNull().default(false),
  mittagGestellt: boolean('mittag_gestellt').notNull().default(false),
  abendGestellt: boolean('abend_gestellt').notNull().default(false),
  vmaBrutto: decimal('vma_brutto', { precision: 10, scale: 2 }).notNull(),
  vmaKuerzung: decimal('vma_kuerzung', { precision: 10, scale: 2 }).notNull().default('0'),
  vmaNetto: decimal('vma_netto', { precision: 10, scale: 2 }).notNull(),
}, (t) => ({
  einreichungIdx: index('reisetage_einreichung_idx').on(t.einreichungId),
}));

// ── Fahrten (für Sammelfahrt-Vorgang) ──────────────────

export const fahrten = pgTable('fahrten', {
  id: uuid('id').defaultRandom().primaryKey(),
  einreichungId: uuid('einreichung_id').notNull().references(() => einreichungen.id, { onDelete: 'cascade' }),
  datum: timestamp('datum').notNull(),
  startOrt: varchar('start_ort', { length: 500 }).notNull(),
  ziel: varchar('ziel', { length: 500 }).notNull(),
  km: decimal('km', { precision: 8, scale: 2 }).notNull(),
  kmBetrag: decimal('km_betrag', { precision: 10, scale: 2 }).notNull(),
  reihenfolge: integer('reihenfolge').notNull().default(0),
});

// ── Erstattungspositionen ──────────────────────────────

export const positionen = pgTable('positionen', {
  id: uuid('id').defaultRandom().primaryKey(),
  einreichungId: uuid('einreichung_id').notNull().references(() => einreichungen.id, { onDelete: 'cascade' }),
  beschreibung: varchar('beschreibung', { length: 500 }).notNull(),
  kategorie: erstattungKategorieEnum('kategorie').notNull(),
  datum: timestamp('datum').notNull(),
  betrag: decimal('betrag', { precision: 10, scale: 2 }).notNull(),
  belegId: uuid('beleg_id'),
}, (t) => ({
  einreichungIdx: index('positionen_einreichung_idx').on(t.einreichungId),
}));

// ── Belege (Anlagen) ───────────────────────────────────

export const belege = pgTable('belege', {
  id: uuid('id').defaultRandom().primaryKey(),
  einreichungId: uuid('einreichung_id').notNull().references(() => einreichungen.id, { onDelete: 'cascade' }),
  dateiname: varchar('dateiname', { length: 255 }).notNull(),
  dateityp: varchar('dateityp', { length: 10 }).notNull(),
  dateigroesse: integer('dateigroesse').notNull(),
  dateipfad: varchar('dateipfad', { length: 500 }).notNull(),
  sha256Hash: varchar('sha256_hash', { length: 64 }).notNull(),
  uploadZeit: timestamp('upload_zeit').notNull().defaultNow(),
  beschreibung: varchar('beschreibung', { length: 500 }),
  betrag: decimal('betrag', { precision: 10, scale: 2 }),
}, (t) => ({
  einreichungIdx: index('belege_einreichung_idx').on(t.einreichungId),
}));

// ── Weitere Kosten (bei Reisekosten) ───────────────────

export const weitereKosten = pgTable('weitere_kosten', {
  id: uuid('id').defaultRandom().primaryKey(),
  einreichungId: uuid('einreichung_id').notNull().references(() => einreichungen.id, { onDelete: 'cascade' }),
  typ: varchar('typ', { length: 50 }).notNull(), // UEBERNACHTUNG, PARKEN, MAUT, SONSTIGE
  beschreibung: varchar('beschreibung', { length: 500 }),
  betrag: decimal('betrag', { precision: 10, scale: 2 }).notNull(),
  belegId: uuid('beleg_id').references(() => belege.id, { onDelete: 'set null' }),
}, (t) => ({
  einreichungIdx: index('weitere_kosten_einreichung_idx').on(t.einreichungId),
}));

// ── Pauschalen ─────────────────────────────────────────

export const pauschalen = pgTable('pauschalen', {
  id: uuid('id').defaultRandom().primaryKey(),
  typ: varchar('typ', { length: 30 }).notNull(), // KM_PKW, KM_MOTORRAD, VMA_8H, VMA_24H, etc.
  land: varchar('land', { length: 100 }), // NULL = Inland
  ort: varchar('ort', { length: 100 }),
  betrag: decimal('betrag', { precision: 10, scale: 2 }).notNull(),
  gueltigVon: timestamp('gueltig_von').notNull(),
  gueltigBis: timestamp('gueltig_bis').notNull(),
});

// ── E-Mail-Konfiguration (AdminCenter) ─────────────────

export const emailConfig = pgTable('email_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  versandMethode: varchar('versand_methode', { length: 10 }).notNull().default('SMTP'), // SMTP oder MS365
  smtpServer: varchar('smtp_server', { length: 255 }),
  smtpPort: integer('smtp_port'),
  smtpUser: varchar('smtp_user', { length: 255 }),
  smtpPasswortEncrypted: text('smtp_passwort_encrypted'),
  ms365TenantId: varchar('ms365_tenant_id', { length: 255 }),
  ms365ClientId: varchar('ms365_client_id', { length: 255 }),
  ms365ClientSecretEncrypted: text('ms365_client_secret_encrypted'),
  absenderName: varchar('absender_name', { length: 255 }).notNull().default('CREDO Finanzportal'),
  absenderEmail: varchar('absender_email', { length: 255 }).notNull(),
  maxVersuche: integer('max_versuche').notNull().default(3),
  fehlerEmail: varchar('fehler_email', { length: 255 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ── Webhook-Konfiguration (AdminCenter) ────────────────

export const webhookConfig = pgTable('webhook_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  aktiv: boolean('aktiv').notNull().default(false),
  url: varchar('url', { length: 500 }),
  secret: varchar('secret', { length: 255 }), // Legacy — kept for backward compat
  authType: varchar('auth_type', { length: 20 }).notNull().default('NONE'), // NONE | BASIC | HEADER
  authUser: varchar('auth_user', { length: 255 }),
  authPass: varchar('auth_pass', { length: 255 }),
  authHeaderName: varchar('auth_header_name', { length: 255 }),
  authHeaderValue: varchar('auth_header_value', { length: 500 }),
  typFilter: varchar('typ_filter', { length: 20 }).notNull().default('ALLE'), // ALLE | REISEKOSTEN | ERSTATTUNG
  eventEingereicht: boolean('event_eingereicht').notNull().default(true),
  eventStatusGeaendert: boolean('event_status_geaendert').notNull().default(true),
  eventFehler: boolean('event_fehler').notNull().default(true),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ── Admin-Zugang ───────────────────────────────────────

export const admins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwortHash: varchar('passwort_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ── Audit-Log ──────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  aktion: varchar('aktion', { length: 50 }).notNull(),
  entitaet: varchar('entitaet', { length: 50 }).notNull(),
  entitaetId: varchar('entitaet_id', { length: 50 }),
  alteWerte: text('alte_werte'), // JSON
  neueWerte: text('neue_werte'), // JSON
  zeitstempel: timestamp('zeitstempel').notNull().defaultNow(),
  ipAdresse: varchar('ip_adresse', { length: 45 }),
});
