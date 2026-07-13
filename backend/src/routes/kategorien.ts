import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, asc } from 'drizzle-orm';

export const kategorienRouter = Router();

// GET /api/kategorien/:mandantId — aktive Erstattungs-Kategorien eines Mandanten
// (oeffentlich, fuer den Kostenerstattungs-Wizard)
kategorienRouter.get('/:mandantId', async (req, res) => {
  try {
    const result = await db
      .select({
        key: schema.erstattungKategorien.key,
        label: schema.erstattungKategorien.label,
        reihenfolge: schema.erstattungKategorien.reihenfolge,
      })
      .from(schema.erstattungKategorien)
      .where(
        and(
          eq(schema.erstattungKategorien.mandantId, req.params.mandantId),
          eq(schema.erstattungKategorien.active, true),
        ),
      )
      .orderBy(asc(schema.erstattungKategorien.reihenfolge), asc(schema.erstattungKategorien.label));

    res.json(result);
  } catch (error) {
    console.error('Fehler beim Laden der Kategorien:', error);
    res.status(500).json({ error: 'Kategorien konnten nicht geladen werden' });
  }
});
