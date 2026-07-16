import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

export type EinreichungTyp = 'REISEKOSTEN' | 'ERSTATTUNG' | 'SAMMELFAHRT' | 'KLASSENFAHRT';

const PREFIX_BY_TYP: Record<EinreichungTyp, string> = {
  REISEKOSTEN: 'RK',
  ERSTATTUNG: 'KE',
  SAMMELFAHRT: 'SF',
  KLASSENFAHRT: 'KF',
};

/**
 * Vergibt die nächste Belegnummer atomar über die `beleg_counter`-Tabelle (Audit #1/#15).
 *
 * Ein einziges `INSERT … ON CONFLICT DO UPDATE … RETURNING` serialisiert konkurrierende
 * Vergaben über den Row-Lock der (typ, jahr)-Zeile — es können nie zwei Einreichungen
 * dieselbe Nummer bekommen. Der frühere Ansatz (Advisory-Lock + SELECT MAX) persistierte
 * die gelesene Nummer nicht unter der Sperre und war damit race-anfällig: zwei parallele
 * Submits lasen denselben MAX-Wert und minteten dieselbe Nummer → der zweite INSERT lief
 * auf die UNIQUE-Verletzung und der Nutzer verlor seine Einreichung (500).
 *
 * Lücken in der Nummernfolge (bei nach der Vergabe abgebrochenen Einreichungen) sind
 * bewusst akzeptiert — nur Eindeutigkeit ist garantiert.
 */
export async function generateBelegNr(typ: EinreichungTyp): Promise<string> {
  const prefix = PREFIX_BY_TYP[typ];
  const year = new Date().getFullYear();

  const result = await db.execute(sql`
    INSERT INTO beleg_counter (typ, jahr, last_num)
    VALUES (${typ}::einreichung_typ, ${year}, 1)
    ON CONFLICT (typ, jahr) DO UPDATE SET last_num = beleg_counter.last_num + 1
    RETURNING last_num
  `);

  const nextNum = Number((result.rows[0] as { last_num: number }).last_num);
  return `${prefix}-${year}-${String(nextNum).padStart(5, '0')}`;
}
