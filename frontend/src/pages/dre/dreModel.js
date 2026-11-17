// Transformações da DRE para cada forma de visualização (sem chamadas à API).
import { MONTHS_SHORT } from '../../utils/format';

/** Subtotais que são fórmulas de outras linhas (usado na tela e no Excel). */
export const SUBTOTAL_FORMULAS = {
  receita_liquida: ['receita_bruta', 'deducoes'],
  lucro_bruto: ['receita_liquida', 'custos'],
  resultado_operacional: ['lucro_bruto', 'despesas'],
  lair: ['resultado_operacional', 'resultado_financeiro', 'outros_resultados'],
  lucro_liquido: ['lair', 'tributos_lucro'],
};

export const VIEWS = [
  { id: 'mensal', label: 'Mensal' },
  { id: 'trimestral', label: 'Trimestral' },
  { id: 'acumulado', label: 'Acumulado' },
  { id: 'comparativo', label: 'Comparativo anual' },
];

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const ratio = (a, b) => (b ? (a / b) * 100 : null);

/**
 * Colunas da tabela para a visão escolhida.
 * Cada coluna: { key, label, sub?, value(line) → número|null, kind: 'valor'|'pct', emphasis? }
 */
export function buildColumns({ view, year, prevByLine, base, baseTotal, prevBaseTotal, monthsWithData }) {
  const yy = String(year).slice(2);
  const cols = [];
  if (view === 'mensal') {
    MONTHS_SHORT.forEach((m, i) => cols.push({ key: `m${i}`, label: `${m}/${yy}`, value: (l) => l.values[i], muted: !monthsWithData[i] }));
    cols.push({ key: 'total', label: `Total ${year}`, value: (l) => l.total, emphasis: true });
    cols.push({ key: 'av', label: 'AV%', kind: 'pct', value: (l) => ratio(l.total, baseTotal) });
  }
  if (view === 'trimestral') {
    [0, 1, 2, 3].forEach((q) => cols.push({ key: `t${q}`, label: `${q + 1}º tri/${yy}`, value: (l) => sum(l.values.slice(q * 3, q * 3 + 3)), muted: !monthsWithData.slice(q * 3, q * 3 + 3).some(Boolean) }));
    cols.push({ key: 's1', label: `1º sem/${yy}`, value: (l) => sum(l.values.slice(0, 6)), emphasis: true });
    cols.push({ key: 's2', label: `2º sem/${yy}`, value: (l) => sum(l.values.slice(6)), emphasis: true });
    cols.push({ key: 'total', label: `Total ${year}`, value: (l) => l.total, emphasis: true });
    cols.push({ key: 'av', label: 'AV%', kind: 'pct', value: (l) => ratio(l.total, baseTotal) });
  }
  if (view === 'acumulado') {
    MONTHS_SHORT.forEach((m, i) => cols.push({ key: `a${i}`, label: i === 0 ? `jan/${yy}` : `jan–${m}/${yy}`, value: (l) => sum(l.values.slice(0, i + 1)), muted: !monthsWithData[i] }));
    cols.push({ key: 'av', label: 'AV% ano', kind: 'pct', value: (l) => ratio(l.total, baseTotal) });
  }
  if (view === 'comparativo') {
    cols.push({ key: 'atual', label: String(year), value: (l) => l.total, emphasis: true });
    cols.push({ key: 'av', label: `AV% ${year}`, kind: 'pct', value: (l) => ratio(l.total, baseTotal) });
    cols.push({ key: 'anterior', label: String(year - 1), value: (l) => prevByLine[l.id]?.total ?? 0 });
    cols.push({ key: 'av_ant', label: `AV% ${year - 1}`, kind: 'pct', value: (l) => ratio(prevByLine[l.id]?.total ?? 0, prevBaseTotal) });
    cols.push({ key: 'var', label: 'Variação R$', value: (l) => l.total - (prevByLine[l.id]?.total ?? 0) });
    cols.push({
      key: 'ah', label: 'AH%', kind: 'pct',
      value: (l) => {
        const p = prevByLine[l.id]?.total ?? 0;
        return p ? ((l.total - p) / Math.abs(p)) * 100 : null;
      },
    });
  }
  return cols.map((c) => ({ kind: 'valor', ...c, base }));
}

/** Indicadores gerenciais a partir das linhas da DRE. */
export function indicators(lines, monthsWithData, goal) {
  const t = Object.fromEntries(lines.map((l) => [l.id, l.total]));
  const meses = monthsWithData.filter(Boolean).length || 1;
  const rl = t.receita_liquida;
  const mcPercent = rl ? ((rl + t.custos) / rl) : null; // margem de contribuição sobre a receita líquida
  const custosFixos = -(t.despesas + Math.min(t.resultado_financeiro, 0));
  const tributos = -(t.deducoes + t.tributos_lucro);
  return {
    receitaBruta: t.receita_bruta,
    receitaLiquida: rl,
    lucroBruto: t.lucro_bruto,
    margemBruta: ratio(t.lucro_bruto, rl),
    ebit: t.resultado_operacional,
    margemOperacional: ratio(t.resultado_operacional, rl),
    lucroLiquido: t.lucro_liquido,
    margemLiquida: ratio(t.lucro_liquido, rl),
    cargaTributaria: ratio(tributos, t.receita_bruta),
    tributos,
    pontoEquilibrioMensal: mcPercent && mcPercent > 0 ? (custosFixos / mcPercent) / meses : null,
    receitaLiquidaMediaMensal: rl / meses,
    despesasSobreReceita: ratio(-t.despesas, rl),
    meses,
    meta: goal,
    metaPercentual: goal ? ratio(t.receita_bruta, goal) : null,
  };
}
