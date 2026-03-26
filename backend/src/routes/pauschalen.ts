import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, lte, gte } from 'drizzle-orm';

export const pauschalenRouter = Router();

// GET /api/pauschalen — Alle aktuell gültigen Pauschalen
pauschalenRouter.get('/', async (_req, res) => {
  try {
    const heute = new Date();
    const result = await db.select().from(schema.pauschalen)
      .where(and(
        lte(schema.pauschalen.gueltigVon, heute),
        gte(schema.pauschalen.gueltigBis, heute)
      ));
    res.json(result);
  } catch (error) {
    console.error('Fehler beim Laden der Pauschalen:', error);
    res.status(500).json({ error: 'Pauschalen konnten nicht geladen werden' });
  }
});

// GET /api/pauschalen/ausland/:land — Pauschalen für ein Land
pauschalenRouter.get('/ausland/:land', async (req, res) => {
  try {
    const heute = new Date();
    const result = await db.select().from(schema.pauschalen)
      .where(and(
        eq(schema.pauschalen.land, req.params.land),
        lte(schema.pauschalen.gueltigVon, heute),
        gte(schema.pauschalen.gueltigBis, heute)
      ));
    res.json(result);
  } catch (error) {
    console.error('Fehler beim Laden der Auslandspauschalen:', error);
    res.status(500).json({ error: 'Auslandspauschalen konnten nicht geladen werden' });
  }
});
