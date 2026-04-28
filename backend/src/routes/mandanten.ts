import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

export const mandantenRouter = Router();

// GET /api/mandanten — Alle aktiven Mandanten (für Self-Service Dropdown)
mandantenRouter.get('/', async (_req, res) => {
  try {
    const result = await db
      .select({
        id: schema.mandanten.id,
        mandantNr: schema.mandanten.mandantNr,
        name: schema.mandanten.name,
        kategorie: schema.mandanten.kategorie,
        primaerfarbe: schema.mandanten.primaerfarbe,
        kstReisekostenAn: schema.mandanten.kstReisekostenAn,
        kstErstattungAn: schema.mandanten.kstErstattungAn,
        kstSammelfahrtAn: schema.mandanten.kstSammelfahrtAn,
      })
      .from(schema.mandanten)
      .where(eq(schema.mandanten.active, true))
      .orderBy(schema.mandanten.kategorie, schema.mandanten.mandantNr);

    res.json(result);
  } catch (error) {
    console.error('Fehler beim Laden der Mandanten:', error);
    res.status(500).json({ error: 'Mandanten konnten nicht geladen werden' });
  }
});
