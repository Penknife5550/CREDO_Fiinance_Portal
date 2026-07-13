import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { sendeTestWebhook, assertSafeWebhookUrl, UnsafeWebhookUrlError } from '../services/webhook.js';
import { encryptSecret, isEncryptionConfigured, decryptSecretIfNeeded } from '../services/crypto.js';
import { TYP_FILTER_VALUES } from '../lib/constants.js';

class EncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionConfigError';
  }
}

function encryptOrPassthrough(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === '') return value;
  if (!isEncryptionConfigured()) {
    throw new EncryptionConfigError('ENCRYPTION_KEY nicht gesetzt — Webhook-Auth-Daten koennen nicht verschluesselt gespeichert werden. Bitte ENV-Variable setzen (openssl rand -hex 32).');
  }
  return encryptSecret(value);
}

export const adminRouter = Router();

// ── Mandanten CRUD ─────────────────────────────────────

// GET /api/admin/mandanten — Alle Mandanten (inkl. inaktive)
adminRouter.get('/mandanten', async (_req, res) => {
  try {
    const result = await db.select().from(schema.mandanten).orderBy(schema.mandanten.mandantNr);
    res.json(result);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Mandanten' });
  }
});

// POST /api/admin/mandanten — Neuen Mandanten anlegen
adminRouter.post('/mandanten', async (req, res) => {
  try {
    const body = z.object({
      mandantNr: z.number().int().positive(),
      name: z.string().min(1).max(255),
      kategorie: z.string().min(1).max(100),
      dmsEmail: z.string().email(),
      primaerfarbe: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      kstReisekostenAn: z.boolean().optional(),
      kstErstattungAn: z.boolean().optional(),
      kstSammelfahrtAn: z.boolean().optional(),
    }).parse(req.body);

    const result = await db.insert(schema.mandanten).values(body).returning();
    res.status(201).json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Mandant konnte nicht angelegt werden' });
    }
  }
});

// PUT /api/admin/mandanten/:id — Mandant bearbeiten
adminRouter.put('/mandanten/:id', async (req, res) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(255).optional(),
      kategorie: z.string().min(1).max(100).optional(),
      dmsEmail: z.string().email().optional(),
      primaerfarbe: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      active: z.boolean().optional(),
      kstReisekostenAn: z.boolean().optional(),
      kstErstattungAn: z.boolean().optional(),
      kstSammelfahrtAn: z.boolean().optional(),
    }).parse(req.body);

    const result = await db
      .update(schema.mandanten)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.mandanten.id, req.params.id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Mandant nicht gefunden' });
      return;
    }
    res.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Mandant konnte nicht aktualisiert werden' });
    }
  }
});

// ── Kostenstellen CRUD ─────────────────────────────────

// GET /api/admin/kostenstellen/:mandantId
adminRouter.get('/kostenstellen/:mandantId', async (req, res) => {
  try {
    const result = await db
      .select()
      .from(schema.kostenstellen)
      .where(eq(schema.kostenstellen.mandantId, req.params.mandantId))
      .orderBy(schema.kostenstellen.nummer);
    res.json(result);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kostenstellen' });
  }
});

// POST /api/admin/kostenstellen
adminRouter.post('/kostenstellen', async (req, res) => {
  try {
    const body = z.object({
      mandantId: z.string().uuid(),
      bezeichnung: z.string().min(1).max(255),
      nummer: z.string().min(1).max(20),
    }).parse(req.body);

    const result = await db.insert(schema.kostenstellen).values(body).returning();
    res.status(201).json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Kostenstelle konnte nicht angelegt werden' });
    }
  }
});

// PUT /api/admin/kostenstellen/:id — Kostenstelle bearbeiten
adminRouter.put('/kostenstellen/:id', async (req, res) => {
  try {
    const body = z.object({
      bezeichnung: z.string().min(1).max(255).optional(),
      nummer: z.string().min(1).max(20).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const result = await db
      .update(schema.kostenstellen)
      .set(body)
      .where(eq(schema.kostenstellen.id, req.params.id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Kostenstelle nicht gefunden' });
      return;
    }
    res.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Kostenstelle konnte nicht aktualisiert werden' });
    }
  }
});

// DELETE /api/admin/kostenstellen/:id — Kostenstelle löschen
adminRouter.delete('/kostenstellen/:id', async (req, res) => {
  try {
    const result = await db
      .delete(schema.kostenstellen)
      .where(eq(schema.kostenstellen.id, req.params.id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Kostenstelle nicht gefunden' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Kostenstelle konnte nicht gelöscht werden' });
  }
});

// ── Erstattungs-Kategorien CRUD (pro Mandant) ──────────

/** Leitet aus einer Bezeichnung einen stabilen, DB-tauglichen Key ab. */
function kategorieKeyAusLabel(label: string): string {
  return label
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

// GET /api/admin/kategorien/:mandantId — alle Kategorien (inkl. inaktive) eines Mandanten
adminRouter.get('/kategorien/:mandantId', async (req, res) => {
  try {
    const result = await db
      .select()
      .from(schema.erstattungKategorien)
      .where(eq(schema.erstattungKategorien.mandantId, req.params.mandantId))
      .orderBy(schema.erstattungKategorien.reihenfolge, schema.erstattungKategorien.label);
    res.json(result);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

// POST /api/admin/kategorien — neue Kategorie (Key wird aus der Bezeichnung abgeleitet)
adminRouter.post('/kategorien', async (req, res) => {
  try {
    const body = z.object({
      mandantId: z.string().uuid(),
      label: z.string().min(1).max(100),
      reihenfolge: z.number().int().nonnegative().default(0),
    }).parse(req.body);

    const key = kategorieKeyAusLabel(body.label);
    if (!key) {
      res.status(400).json({ error: 'Aus der Bezeichnung konnte kein gültiger Schlüssel gebildet werden' });
      return;
    }

    const result = await db.insert(schema.erstattungKategorien).values({
      mandantId: body.mandantId,
      key,
      label: body.label,
      reihenfolge: body.reihenfolge,
    }).returning();
    res.status(201).json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else if (error instanceof Error && error.message.includes('duplicate')) {
      res.status(409).json({ error: 'Eine Kategorie mit dieser Bezeichnung existiert bereits für diesen Mandanten' });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Kategorie konnte nicht angelegt werden' });
    }
  }
});

// PUT /api/admin/kategorien/:id — Bezeichnung/Reihenfolge/Sichtbarkeit (Key bleibt stabil)
adminRouter.put('/kategorien/:id', async (req, res) => {
  try {
    const body = z.object({
      label: z.string().min(1).max(100).optional(),
      reihenfolge: z.number().int().nonnegative().optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const result = await db
      .update(schema.erstattungKategorien)
      .set(body)
      .where(eq(schema.erstattungKategorien.id, req.params.id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Kategorie nicht gefunden' });
      return;
    }
    res.json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Kategorie konnte nicht aktualisiert werden' });
    }
  }
});

// DELETE /api/admin/kategorien/:id
adminRouter.delete('/kategorien/:id', async (req, res) => {
  try {
    const result = await db
      .delete(schema.erstattungKategorien)
      .where(eq(schema.erstattungKategorien.id, req.params.id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Kategorie nicht gefunden' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Kategorie konnte nicht gelöscht werden' });
  }
});

// ── Auslandspauschalen ─────────────────────────────────
// Editierbar im AdminCenter (PauschalenTab). Quelle: BMF-Schreiben (jaehrlich).

const auslandspauschaleSchema = z.object({
  landKey: z.string().min(1).max(100),
  tagessatz24h: z.number().nonnegative().max(999),
  tagessatz8h: z.number().nonnegative().max(999),
  uebernachtung: z.number().nonnegative().max(9999),
  reihenfolge: z.number().int().nonnegative().default(0),
});

// GET /api/admin/pauschalen-ausland — Liste fuer AdminCenter (mit allen Feldern)
adminRouter.get('/pauschalen-ausland', async (_req, res) => {
  try {
    const result = await db
      .select()
      .from(schema.pauschalenAusland)
      .orderBy(schema.pauschalenAusland.reihenfolge, schema.pauschalenAusland.landKey);

    res.json(result.map(row => ({
      landKey: row.landKey,
      tagessatz24h: Number(row.tagessatz24h),
      tagessatz8h: Number(row.tagessatz8h),
      uebernachtung: Number(row.uebernachtung),
      reihenfolge: row.reihenfolge,
      updatedAt: row.updatedAt,
    })));
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Auslandspauschalen konnten nicht geladen werden' });
  }
});

// POST /api/admin/pauschalen-ausland — neuer Eintrag
adminRouter.post('/pauschalen-ausland', async (req, res) => {
  try {
    const parsed = auslandspauschaleSchema.parse(req.body);
    const [row] = await db.insert(schema.pauschalenAusland).values({
      landKey: parsed.landKey,
      tagessatz24h: String(parsed.tagessatz24h),
      tagessatz8h: String(parsed.tagessatz8h),
      uebernachtung: String(parsed.uebernachtung),
      reihenfolge: parsed.reihenfolge,
    }).returning();
    res.status(201).json({ landKey: row.landKey });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
      return;
    }
    if (error instanceof Error && error.message.includes('duplicate')) {
      res.status(409).json({ error: 'Ein Eintrag mit diesem Land existiert bereits' });
      return;
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Auslandspauschale konnte nicht angelegt werden' });
  }
});

// PUT /api/admin/pauschalen-ausland/:landKey — Update (URL-encoded landKey)
adminRouter.put('/pauschalen-ausland/:landKey', async (req, res) => {
  try {
    const landKey = decodeURIComponent(req.params.landKey);
    const parsed = auslandspauschaleSchema.partial({ landKey: true }).parse(req.body);

    const result = await db
      .update(schema.pauschalenAusland)
      .set({
        tagessatz24h: parsed.tagessatz24h !== undefined ? String(parsed.tagessatz24h) : undefined,
        tagessatz8h: parsed.tagessatz8h !== undefined ? String(parsed.tagessatz8h) : undefined,
        uebernachtung: parsed.uebernachtung !== undefined ? String(parsed.uebernachtung) : undefined,
        reihenfolge: parsed.reihenfolge,
        updatedAt: new Date(),
      })
      .where(eq(schema.pauschalenAusland.landKey, landKey))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Auslandspauschale nicht gefunden' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
      return;
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Auslandspauschale konnte nicht aktualisiert werden' });
  }
});

// DELETE /api/admin/pauschalen-ausland/:landKey
adminRouter.delete('/pauschalen-ausland/:landKey', async (req, res) => {
  try {
    const landKey = decodeURIComponent(req.params.landKey);
    const result = await db
      .delete(schema.pauschalenAusland)
      .where(eq(schema.pauschalenAusland.landKey, landKey))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Auslandspauschale nicht gefunden' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Auslandspauschale konnte nicht geloescht werden' });
  }
});

// ── E-Mail-Konfiguration ──────────────────────────────

// GET /api/admin/email-config
adminRouter.get('/email-config', async (_req, res) => {
  try {
    const result = await db.select().from(schema.emailConfig).limit(1);
    if (result.length === 0) {
      res.status(404).json({ error: 'Keine E-Mail-Konfiguration vorhanden' });
      return;
    }
    // Passwörter nicht zurückgeben
    const config = result[0];
    res.json({
      ...config,
      smtpPasswortEncrypted: config.smtpPasswortEncrypted ? '***' : null,
      ms365ClientSecretEncrypted: config.ms365ClientSecretEncrypted ? '***' : null,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der E-Mail-Konfiguration' });
  }
});

// PUT /api/admin/email-config — Versandmethode aktualisieren
adminRouter.put('/email-config', async (req, res) => {
  try {
    const body = z.object({
      versandMethode: z.enum(['WEBHOOK', 'SMTP', 'MS365']),
    }).parse(req.body);

    const [existing] = await db.select().from(schema.emailConfig).limit(1);
    if (!existing) {
      res.status(404).json({ error: 'Keine E-Mail-Konfiguration vorhanden' });
      return;
    }

    const [updated] = await db.update(schema.emailConfig)
      .set({ versandMethode: body.versandMethode, updatedAt: new Date() })
      .where(eq(schema.emailConfig.id, existing.id))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren der E-Mail-Konfiguration' });
    }
  }
});

// ── Webhook-Konfiguration ─────────────────────────────

// GET /api/admin/webhooks — Alle Webhook-Konfigurationen laden
adminRouter.get('/webhooks', async (_req, res) => {
  try {
    const result = await db.select().from(schema.webhookConfig);
    // Sensible Felder maskieren
    res.json(result.map(w => ({
      ...w,
      secret: w.secret ? '***' : null,
      authPass: w.authPass ? '***' : null,
      authHeaderValue: w.authHeaderValue ? '***' : null,
    })));
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Webhooks' });
  }
});

// POST /api/admin/webhooks — Neuen Webhook anlegen
adminRouter.post('/webhooks', async (req, res) => {
  try {
    const body = z.object({
      url: z.string().url().min(1),
      secret: z.string().optional().default(''),
      authType: z.enum(['NONE', 'BASIC', 'HEADER']).optional().default('NONE'),
      authUser: z.string().max(255).optional().nullable(),
      authPass: z.string().max(255).optional().nullable(),
      authHeaderName: z.string().max(255).optional().nullable(),
      authHeaderValue: z.string().max(500).optional().nullable(),
      typFilter: z.enum(TYP_FILTER_VALUES).optional().default('ALLE'),
      aktiv: z.boolean().optional().default(true),
      eventEingereicht: z.boolean().optional().default(true),
      eventStatusGeaendert: z.boolean().optional().default(true),
      eventFehler: z.boolean().optional().default(true),
    }).parse(req.body);

    assertSafeWebhookUrl(body.url);

    const insertData = {
      ...body,
      secret: body.secret ? encryptOrPassthrough(body.secret) ?? null : null,
      authPass: body.authPass ? encryptOrPassthrough(body.authPass) ?? null : null,
      authHeaderValue: body.authHeaderValue ? encryptOrPassthrough(body.authHeaderValue) ?? null : null,
    };

    const result = await db.insert(schema.webhookConfig).values(insertData).returning();
    res.status(201).json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else if (error instanceof UnsafeWebhookUrlError || error instanceof EncryptionConfigError) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Webhook konnte nicht angelegt werden' });
    }
  }
});

// PUT /api/admin/webhooks/:id — Webhook bearbeiten
adminRouter.put('/webhooks/:id', async (req, res) => {
  try {
    const body = z.object({
      url: z.string().url().optional(),
      secret: z.string().optional(),
      authType: z.enum(['NONE', 'BASIC', 'HEADER']).optional(),
      authUser: z.string().max(255).optional().nullable(),
      authPass: z.string().max(255).optional().nullable(),
      authHeaderName: z.string().max(255).optional().nullable(),
      authHeaderValue: z.string().max(500).optional().nullable(),
      typFilter: z.enum(TYP_FILTER_VALUES).optional(),
      aktiv: z.boolean().optional(),
      eventEingereicht: z.boolean().optional(),
      eventStatusGeaendert: z.boolean().optional(),
      eventFehler: z.boolean().optional(),
    }).parse(req.body);

    if (body.url) assertSafeWebhookUrl(body.url);

    // Maskierte Werte nicht überschreiben; neue Werte verschluesselt ablegen
    const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.secret === '***' || body.secret === undefined) {
      delete updateData.secret;
    } else {
      updateData.secret = body.secret ? encryptOrPassthrough(body.secret) ?? null : null;
    }
    if (body.authPass === '***' || body.authPass === undefined) {
      delete updateData.authPass;
    } else {
      updateData.authPass = body.authPass ? encryptOrPassthrough(body.authPass) ?? null : null;
    }
    if (body.authHeaderValue === '***' || body.authHeaderValue === undefined) {
      delete updateData.authHeaderValue;
    } else {
      updateData.authHeaderValue = body.authHeaderValue ? encryptOrPassthrough(body.authHeaderValue) ?? null : null;
    }

    const result = await db
      .update(schema.webhookConfig)
      .set(updateData)
      .where(eq(schema.webhookConfig.id, req.params.id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Webhook nicht gefunden' });
      return;
    }
    res.json({
      ...result[0],
      secret: result[0].secret ? '***' : null,
      authPass: result[0].authPass ? '***' : null,
      authHeaderValue: result[0].authHeaderValue ? '***' : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
    } else if (error instanceof UnsafeWebhookUrlError || error instanceof EncryptionConfigError) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Webhook konnte nicht aktualisiert werden' });
    }
  }
});

// DELETE /api/admin/webhooks/:id — Webhook löschen
adminRouter.delete('/webhooks/:id', async (req, res) => {
  try {
    const result = await db
      .delete(schema.webhookConfig)
      .where(eq(schema.webhookConfig.id, req.params.id))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: 'Webhook nicht gefunden' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Webhook konnte nicht gelöscht werden' });
  }
});

// POST /api/admin/webhooks/:id/test — Test-Webhook senden
adminRouter.post('/webhooks/:id/test', async (req, res) => {
  try {
    const [config] = await db.select().from(schema.webhookConfig).where(eq(schema.webhookConfig.id, req.params.id));
    if (!config || !config.url) {
      res.status(404).json({ error: 'Webhook nicht gefunden oder URL fehlt' });
      return;
    }

    const result = await sendeTestWebhook(config.url, {
      authType: config.authType,
      authUser: config.authUser,
      authPass: decryptSecretIfNeeded(config.authPass),
      authHeaderName: config.authHeaderName,
      authHeaderValue: decryptSecretIfNeeded(config.authHeaderValue),
    });
    res.json(result);
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Test konnte nicht durchgeführt werden' });
  }
});

// POST /api/admin/webhooks/test-url — Test an beliebige URL (zum Testen vor Speichern)
adminRouter.post('/webhooks/test-url', async (req, res) => {
  try {
    const body = z.object({
      url: z.string().url(),
      authType: z.enum(['NONE', 'BASIC', 'HEADER']).optional().default('NONE'),
      authUser: z.string().optional().nullable(),
      authPass: z.string().optional().nullable(),
      authHeaderName: z.string().optional().nullable(),
      authHeaderValue: z.string().optional().nullable(),
    }).parse(req.body);

    assertSafeWebhookUrl(body.url);

    const result = await sendeTestWebhook(body.url, {
      authType: body.authType,
      authUser: body.authUser ?? null,
      authPass: body.authPass ?? null,
      authHeaderName: body.authHeaderName ?? null,
      authHeaderValue: body.authHeaderValue ?? null,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ungültige URL' });
    } else if (error instanceof UnsafeWebhookUrlError) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Test konnte nicht durchgeführt werden' });
    }
  }
});
