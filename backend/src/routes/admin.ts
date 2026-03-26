import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

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
