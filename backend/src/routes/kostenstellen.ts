import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';

export const kostenstellenRouter = Router();

// GET /api/kostenstellen/:mandantId — Kostenstellen eines Mandanten
kostenstellenRouter.get('/:mandantId', async (req, res) => {
  try {
    const result = await db
      .select({
        id: schema.kostenstellen.id,
        bezeichnung: schema.kostenstellen.bezeichnung,
        nummer: schema.kostenstellen.nummer,
      })
      .from(schema.kostenstellen)
      .where(
        and(
          eq(schema.kostenstellen.mandantId, req.params.mandantId),
          eq(schema.kostenstellen.active, true)
        )
      )
      .orderBy(schema.kostenstellen.nummer);

    res.json(result);
  } catch (error) {
    console.error('Fehler beim Laden der Kostenstellen:', error);
    res.status(500).json({ error: 'Kostenstellen konnten nicht geladen werden' });
  }
});
