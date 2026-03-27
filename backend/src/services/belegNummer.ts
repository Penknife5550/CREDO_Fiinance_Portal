import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

export async function generateBelegNr(typ: 'REISEKOSTEN' | 'ERSTATTUNG'): Promise<string> {
  const prefix = typ === 'REISEKOSTEN' ? 'RK' : 'KE';
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  // Advisory Lock Key: Kombination aus Typ und Jahr für exklusive Sperre
  const lockKey = typ === 'REISEKOSTEN' ? year * 10 + 1 : year * 10 + 2;

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
