const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** R$ 1.234,56 — "—" quando não há valor (o #DIV/0! das planilhas). */
export const brl = (value, digits = 2) =>
  isNumber(value)
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';

/** 12,34% */
export const pct = (value, digits = 2) =>
  isNumber(value)
    ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
    : '—';

/** 1.234,5 */
export const qty = (value, digits = 1) =>
  isNumber(value)
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';

/** Aceita "1.234,56", "1234.56" ou número; vazio vira 0. */
export const toNumber = (value) => {
  if (isNumber(value)) return value;
  const text = String(value ?? '').trim();
  if (text === '') return 0;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

export const REGIME_LABEL = {
  LUCRO_REAL: 'Lucro Real',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  SIMPLES: 'Simples Nacional',
};

/** Texto para os resultados sem preço (status devolvido pelo backend). */
export const STATUS_LABEL = {
  SEM_BASE: 'Sem base de rateio',
  SEM_CUSTO: 'Sem ficha técnica',
  INVIAVEL: 'Encargos ≥ 100%',
};
