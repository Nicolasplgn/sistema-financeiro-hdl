const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const asNumber = (v) => (isNumber(v) ? v : Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

/** R$ 1.234,56 — "—" quando não há valor (o #DIV/0! das planilhas). */
export const brl = (value, digits = 2) => {
  const n = asNumber(value);
  return n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/** 1.234,56 (sem "R$"), para colunas de planilha. */
export const money = (value, digits = 2) => {
  const n = asNumber(value);
  return n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/** 12,34% */
export const pct = (value, digits = 2) => {
  const n = asNumber(value);
  return n === null ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
};

/** 1.234,5 */
export const qty = (value, digits = 1) => {
  const n = asNumber(value);
  return n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/** R$ 12,3 mil / R$ 1,2 mi — para eixos e cartões. */
export const brlShort = (value) => {
  const n = asNumber(value);
  if (n === null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return brl(n);
};

/** Aceita "1.234,56", "1234.56", "12%" ou número; vazio vira 0. */
export const toNumber = (value) => {
  if (isNumber(value)) return value;
  const text = String(value ?? '').replace(/R\$|%|\s/g, '').trim();
  if (text === '') return 0;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

/** Valor do banco → texto para editar ("12.5" → "12,5"). */
export const toInput = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n).replace('.', ',') : '';
};

/** "2026-03" → "mar/2026" */
export const monthLabel = (key) => {
  if (!key) return '';
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return key;
  return `${new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${y}`;
};

export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

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
