import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { asc } from 'drizzle-orm';

export const pauschalenRouter = Router();

// GET /api/pauschalen-ausland — Liste aller Auslandspauschalen (oeffentlich, fuer Reisekosten-Wizard)
pauschalenRouter.get('/ausland', async (_req, res) => {
  try {
    const result = await db
      .select({
        landKey: schema.pauschalenAusland.landKey,
        tagessatz24h: schema.pauschalenAusland.tagessatz24h,
        tagessatz8h: schema.pauschalenAusland.tagessatz8h,
        uebernachtung: schema.pauschalenAusland.uebernachtung,
        reihenfolge: schema.pauschalenAusland.reihenfolge,
      })
      .from(schema.pauschalenAusland)
      .orderBy(asc(schema.pauschalenAusland.reihenfolge), asc(schema.pauschalenAusland.landKey));

    // Drizzle gibt decimal als String zurueck — fuer das Frontend in number umwandeln
    const data = result.map(row => ({
      landKey: row.landKey,
      tagessatz24h: Number(row.tagessatz24h),
      tagessatz8h: Number(row.tagessatz8h),
      uebernachtung: Number(row.uebernachtung),
      reihenfolge: row.reihenfolge,
    }));

    res.json(data);
  } catch (error) {
    console.error('Fehler beim Laden der Auslandspauschalen:', error);
    res.status(500).json({ error: 'Auslandspauschalen konnten nicht geladen werden' });
  }
});
