import { pgTable, uuid, varchar, text, integer, decimal, boolean, timestamp, pgEnum, serial, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────

export const einreichungTypEnum = pgEnum('einreichung_typ', ['REISEKOSTEN', 'ERSTATTUNG', 'SAMMELFAHRT', 'KLASSENFAHRT']);
export const einreichungStatusEnum = pgEnum('einreichung_status', ['EINGEREICHT', 'GESENDET', 'FEHLER']);
export const emailStatusEnum = pgEnum('email_status', ['AUSSTEHEND', 'GESENDET', 'FEHLER']);
export const verkehrsmittelEnum = pgEnum('verkehrsmittel', ['PKW', 'MOTORRAD', 'OEPNV', 'BAHN', 'FLUG', 'SONSTIGE']);
export const abfahrtOrtEnum = pgEnum('abfahrt_ort', ['WOHNUNG', 'TAETIGKEIT']);
export const reisetagTypEnum = pgEnum('reisetag_typ', ['ANREISE', 'GANZTAG', 'ABREISE', 'EINTAEGIG']);
// Hinweis: Erstattungs-Kategorien sind seit Migration 0009 KEIN Enum mehr, sondern
// pro Mandant in der Tabelle `erstattung_kategorien` konfigurierbar (varchar-Spalte).

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

// ── Erstattungs-Kategorien (pro Mandant konfigurierbar, im AdminCenter) ─
// Ersetzt das feste Enum. `key` wird in positionen.kategorie gespeichert und
// bleibt pro Mandant eindeutig. Dropdown-Reihenfolge ueber `reihenfolge`.

export const erstattungKategorien = pgTable('erstattung_kategorien', {
  id: uuid('id').defaultRandom().primaryKey(),
  mandantId: uuid('mandant_id').notNull().references(() => mandanten.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 50 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  reihenfolge: integer('reihenfolge').notNull().default(0),
  active: boolean('active').notNull().default(true),
}, (t) => ({
  mandantActiveIdx: index('erstattung_kategorien_mandant_active_idx').on(t.mandantId, t.active),
  mandantKeyUidx: uniqueIndex('erstattung_kategorien_mandant_key_uidx').on(t.mandantId, t.key),
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
  // Persoenliches Auszahlungskonto — bei KLASSENFAHRT leer (Konten liegen je Klasse), daher nullable.
  bankIban: varchar('bank_iban', { length: 34 }),
  bankKontoinhaber: varchar('bank_kontoinhaber', { length: 200 }),

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
  // Idempotenz gegen Doppel-Submit (verlorene Response): ein Key pro Formular-Instanz.
  idempotenzKey: varchar('idempotenz_key', { length: 64 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
}, (t) => ({
  mandantIdx: index('einreichungen_mandant_idx').on(t.mandantId),
  statusIdx: index('einreichungen_status_idx').on(t.status),
  emailStatusIdx: index('einreichungen_email_status_idx').on(t.emailStatus),
  createdAtIdx: index('einreichungen_created_at_idx').on(t.createdAt),
  idempotenzKeyUidx: uniqueIndex('einreichungen_idempotenz_key_uidx').on(t.idempotenzKey),
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
  kategorie: varchar('kategorie', { length: 50 }).notNull(), // Key aus erstattung_kategorien (pro Mandant)
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

// ── Klassenfahrt (nur Mandant 40 = Christlicher Schulverein Minden e.V.) ──
// Die gemeinsame `einreichungen`-Zeile ist der Kopf (typ=KLASSENFAHRT): reiseanlass = Anlass,
// abfahrtZeit/rueckkehrZeit = Zeitraum, gesamtbetrag = FV-Gesamtzuschuss. Die Auszahlung
// erfolgt getrennt je Klasse auf ein eigenes Klassenkonto (IBAN im Klartext, interner Betrieb).

export const klassenfahrtKlassen = pgTable('klassenfahrt_klassen', {
  id: uuid('id').defaultRandom().primaryKey(),
  einreichungId: uuid('einreichung_id').notNull().references(() => einreichungen.id, { onDelete: 'cascade' }),
  reihenfolge: integer('reihenfolge').notNull().default(0),
  bezeichnung: varchar('bezeichnung', { length: 100 }), // z.B. "Klasse 6a" (optional)
  schueler: integer('schueler').notNull(),
  begleiter: decimal('begleiter', { precision: 5, scale: 2 }).notNull(), // Dezimal erlaubt (z.B. 1,5)
  empfaenger: varchar('empfaenger', { length: 200 }).notNull(),
  iban: varchar('iban', { length: 34 }).notNull(), // Klartext (interner Betrieb, wie Bestand)
  zuschuss: decimal('zuschuss', { precision: 10, scale: 2 }).notNull(), // server-berechnete Auszahlung
}, (t) => ({
  einreichungIdx: index('klassenfahrt_klassen_einreichung_idx').on(t.einreichungId),
}));

export const klassenfahrtKostenzeilen = pgTable('klassenfahrt_kostenzeilen', {
  id: uuid('id').defaultRandom().primaryKey(),
  einreichungId: uuid('einreichung_id').notNull().references(() => einreichungen.id, { onDelete: 'cascade' }),
  reihenfolge: integer('reihenfolge').notNull().default(0),
  oberkategorie: varchar('oberkategorie', { length: 30 }).notNull(), // FAHRTKOSTEN|UNTERKUNFT|AKTIVITAETEN|SONSTIGES
  bezeichnung: varchar('bezeichnung', { length: 200 }).notNull(),
  modus: varchar('modus', { length: 12 }).notNull(), // PROPORTIONAL | DIREKT
  betrag: decimal('betrag', { precision: 10, scale: 2 }).notNull(), // PROP: Gesamt; DIREKT: Summe der Anteile (negativ erlaubt)
}, (t) => ({
  einreichungIdx: index('klassenfahrt_kostenzeilen_einreichung_idx').on(t.einreichungId),
}));

// Betrag je Klasse fuer DIREKT-Zeilen — ohne diese Ablage waere der Server-Recompute
// der DIREKT-Verteilung nicht rekonstruierbar (Lueckenpruefung-Befund).
export const klassenfahrtKostenzeileAnteil = pgTable('klassenfahrt_kostenzeile_anteil', {
  id: uuid('id').defaultRandom().primaryKey(),
  kostenzeileId: uuid('kostenzeile_id').notNull().references(() => klassenfahrtKostenzeilen.id, { onDelete: 'cascade' }),
  klasseReihenfolge: integer('klasse_reihenfolge').notNull(), // 0-basiert, verweist auf klassenfahrt_klassen.reihenfolge
  betrag: decimal('betrag', { precision: 10, scale: 2 }).notNull(),
}, (t) => ({
  kostenzeileIdx: index('klassenfahrt_anteil_kostenzeile_idx').on(t.kostenzeileId),
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

// ── Auslandspauschalen (DB-gepflegt, BMF-Schreiben jaehrlich) ──
// Eine Row pro Land bzw. Land—Stadt-Variante. Dropdown-Reihenfolge ueber
// `reihenfolge`. Editierbar im AdminCenter (PauschalenTab).

export const pauschalenAusland = pgTable('pauschalen_ausland', {
  landKey: varchar('land_key', { length: 100 }).primaryKey(),
  tagessatz24h: decimal('tagessatz_24h', { precision: 8, scale: 2 }).notNull(),
  tagessatz8h: decimal('tagessatz_8h', { precision: 8, scale: 2 }).notNull(),
  uebernachtung: decimal('uebernachtung', { precision: 8, scale: 2 }).notNull(),
  reihenfolge: integer('reihenfolge').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ── E-Mail-Konfiguration (AdminCenter) ─────────────────

export const emailConfig = pgTable('email_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  // SMTP = eigener Direktversand (Standard), WEBHOOK = n8n-Fallback.
  // 'MS365' wurde entfernt (war toter Code) — Legacy-Werte migriert Migration 0010 auf 'SMTP'.
  versandMethode: varchar('versand_methode', { length: 10 }).notNull().default('SMTP'),
  smtpServer: varchar('smtp_server', { length: 255 }),
  smtpPort: integer('smtp_port'),
  smtpUser: varchar('smtp_user', { length: 255 }),
  smtpPasswortEncrypted: text('smtp_passwort_encrypted'), // enc:v1: (crypto.ts) oder Legacy-Klartext
  // ms365*-Spalten bleiben (ungenutzt) fuer Datenerhalt; kein OAuth-Versand implementiert.
  ms365TenantId: varchar('ms365_tenant_id', { length: 255 }),
  ms365ClientId: varchar('ms365_client_id', { length: 255 }),
  ms365ClientSecretEncrypted: text('ms365_client_secret_encrypted'),
  absenderName: varchar('absender_name', { length: 255 }).notNull().default('CREDO Finanzportal'),
  absenderEmail: varchar('absender_email', { length: 255 }).notNull(),
  maxVersuche: integer('max_versuche').notNull().default(3),
  fehlerEmail: varchar('fehler_email', { length: 255 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ── Versandprotokoll (jeder Zustellversuch, Kanal-uebergreifend) ────
// Blaupause: HR-Portal EmailLog. Protokolliert jeden SMTP-/Webhook-Versuch
// (SENT/FAILED/SKIPPED) fuer Nachvollziehbarkeit (IKS) und die Admin-Ansicht.
// FK auf die Einreichung ist optional (ON DELETE SET NULL) — Testmails haben
// keine Einreichung, und geloeschte Einreichungen sollen das Protokoll nicht mitnehmen.
// beleg_nr wird denormalisiert mitgeschrieben, damit die Zeile ohne Join lesbar bleibt.

export const emailLog = pgTable('email_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  einreichungId: uuid('einreichung_id').references(() => einreichungen.id, { onDelete: 'set null' }),
  belegNr: varchar('beleg_nr', { length: 20 }),
  kanal: varchar('kanal', { length: 10 }).notNull(),   // SMTP | WEBHOOK
  status: varchar('status', { length: 10 }).notNull(), // SENT | FAILED | SKIPPED
  empfaenger: varchar('empfaenger', { length: 255 }),
  betreff: varchar('betreff', { length: 500 }),
  messageId: varchar('message_id', { length: 255 }),
  fehler: text('fehler'),
  versuche: integer('versuche').notNull().default(0),
  istTest: boolean('ist_test').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  einreichungIdx: index('email_log_einreichung_idx').on(t.einreichungId),
  createdAtIdx: index('email_log_created_at_idx').on(t.createdAt),
  statusIdx: index('email_log_status_idx').on(t.status),
}));

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
  typFilter: varchar('typ_filter', { length: 20 }).notNull().default('ALLE'), // ALLE | REISEKOSTEN | ERSTATTUNG | SAMMELFAHRT
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
