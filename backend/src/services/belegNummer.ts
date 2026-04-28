import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

export type EinreichungTyp = 'REISEKOSTEN' | 'ERSTATTUNG' | 'SAMMELFAHRT';

const PREFIX_BY_TYP: Record<EinreichungTyp, string> = {
  REISEKOSTEN: 'RK',
  ERSTATTUNG: 'KE',
  SAMMELFAHRT: 'SF',
};

const LOCK_OFFSET_BY_TYP: Record<EinreichungTyp, number> = {
  REISEKOSTEN: 1,
  ERSTATTUNG: 2,
  SAMMELFAHRT: 3,
};

export async function generateBelegNr(typ: EinreichungTyp): Promise<string> {
  const prefix = PREFIX_BY_TYP[typ];
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  // Advisory Lock Key: Kombination aus Typ und Jahr für exklusive Sperre
  const lockKey = year * 10 + LOCK_OFFSET_BY_TYP[typ];

  return await db.transaction(async (tx) => {
    // PostgreSQL Advisory Lock für threadsafe Belegnummern-Vergabe
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

    const result = await tx.execute(
      sql`SELECT beleg_nr FROM einreichungen WHERE beleg_nr LIKE ${pattern} ORDER BY beleg_nr DESC LIMIT 1 FOR UPDATE`
    );

    let nextNum = 1;
    if (result.rows.length > 0) {
      const lastNr = (result.rows[0] as Record<string, string>).beleg_nr;
      const lastNum = parseInt(lastNr.split('-')[2], 10);
      nextNum = lastNum + 1;
    }

    return `${prefix}-${year}-${String(nextNum).padStart(5, '0')}`;
  });
}
