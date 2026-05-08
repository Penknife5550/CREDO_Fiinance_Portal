export const EINREICHUNG_TYPEN = ['REISEKOSTEN', 'ERSTATTUNG', 'SAMMELFAHRT'] as const;
export type EinreichungTyp = typeof EINREICHUNG_TYPEN[number];

export const TYP_FILTER_VALUES = ['ALLE', ...EINREICHUNG_TYPEN] as const;
export type TypFilter = typeof TYP_FILTER_VALUES[number];
