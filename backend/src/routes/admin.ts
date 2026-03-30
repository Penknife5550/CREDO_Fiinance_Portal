import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { sendeTestWebhook } from '../services/webhook.js';

export const adminRouter = Router();

// TODO: Auth-Middleware für Admin-Zugang hinzufügen

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
      typFilter: z.enum(['ALLE', 'REISEKOSTEN', 'ERSTATTUNG']).optional().default('ALLE'),
      aktiv: z.boolean().optional().default(true),
      eventEingereicht: z.boolean().optional().default(true),
      eventStatusGeaendert: z.boolean().optional().default(true),
      eventFehler: z.boolean().optional().default(true),
    }).parse(req.body);

    const result = await db.insert(schema.webhookConfig).values(body).returning();
    res.status(201).json(result[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validierungsfehler', details: error.errors });
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
      typFilter: z.enum(['ALLE', 'REISEKOSTEN', 'ERSTATTUNG']).optional(),
      aktiv: z.boolean().optional(),
      eventEingereicht: z.boolean().optional(),
      eventStatusGeaendert: z.boolean().optional(),
      eventFehler: z.boolean().optional(),
    }).parse(req.body);

    // Maskierte Werte nicht überschreiben
    const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.secret === '***' || body.secret === undefined) {
      delete updateData.secret;
    }
    if (body.authPass === '***' || body.authPass === undefined) {
      delete updateData.authPass;
    }
    if (body.authHeaderValue === '***' || body.authHeaderValue === undefined) {
      delete updateData.authHeaderValue;
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
      authPass: config.authPass,
      authHeaderName: config.authHeaderName,
      authHeaderValue: config.authHeaderValue,
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
    } else {
      console.error('Fehler:', error);
      res.status(500).json({ error: 'Test konnte nicht durchgeführt werden' });
    }
  }
});
