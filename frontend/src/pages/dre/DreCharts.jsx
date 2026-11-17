// Gráficos da DRE: cascata do resultado, margens, despesas e deduções.
import React from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, CardHeader } from '../../components/ui';
import { baseChartOptions, SERIES } from '../../utils/charts';
import { brl, MONTHS_SHORT, pct } from '../../utils/format';

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Cascata: da receita bruta ao lucro líquido. */
export const WaterfallChart = ({ byId }) => {
  const steps = [
    { label: 'Receita bruta', value: byId.receita_bruta, total: true },
    { label: 'Deduções', value: byId.deducoes },
    { label: 'Custo das vendas', value: byId.custos },
    { label: 'Despesas operac.', value: byId.despesas },
    { label: 'Result. financeiro', value: byId.resultado_financeiro },
    { label: 'Outras receitas', value: byId.outros_resultados },
    { label: 'IR e CSLL', value: byId.tributos_lucro },
    { label: 'Lucro líquido', value: byId.lucro_liquido, total: true },
  ];
  let running = 0;
  const bars = steps.map((s) => {
    if (s.total) { running = s.value; return [0, s.value]; }
    const start = running;
    running += s.value;
    return [start, running];
  });
  const colors = steps.map((s) => (s.total ? SERIES.revenue : s.value >= 0 ? SERIES.profit : SERIES.loss));
  const opts = baseChartOptions();
  opts.plugins.legend = { display: false };
  opts.plugins.tooltip = { callbacks: { label: (c) => `${steps[c.dataIndex].label}: ${brl(steps[c.dataIndex].value)}` } };
  opts.scales.y.beginAtZero = true;
  return (
    <Card>
      <CardHeader title="Do faturamento ao lucro" description="Cascata do resultado do ano: quanto cada etapa da DRE tira (vermelho) ou soma (verde)." />
      <div className="h-80">
        <Bar data={{ labels: steps.map((s) => s.label), datasets: [{ data: bars, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] }} options={opts} />
      </div>
    </Card>
  );
};

/** Margens bruta, operacional e líquida mês a mês. */
export const MarginsChart = ({ lineById, monthsWithData }) => {
  const idx = MONTHS_SHORT.map((_, i) => i).filter((i) => monthsWithData[i]);
  const m = (id, i) => {
    const rl = lineById.receita_liquida.values[i];
    return rl ? (lineById[id].values[i] / rl) * 100 : null;
  };
  const opts = baseChartOptions();
  opts.scales.y.ticks.callback = (v) => `${v}%`;
  opts.scales.y.beginAtZero = false;
  opts.plugins.tooltip = { callbacks: { label: (c) => `${c.dataset.label}: ${pct(c.raw, 1)}` } };
  return (
    <Card>
      <CardHeader title="Margens mês a mês" description="Sobre a receita líquida. A distância entre as linhas mostra o peso das despesas e dos tributos." />
      <div className="h-80">
        <Line
          data={{
            labels: idx.map((i) => MONTHS_SHORT[i]),
            datasets: [
              { label: 'Margem bruta', data: idx.map((i) => m('lucro_bruto', i)), borderColor: SERIES.revenue, backgroundColor: SERIES.revenue, tension: 0.3 },
              { label: 'Margem operacional (EBIT)', data: idx.map((i) => m('resultado_operacional', i)), borderColor: SERIES.taxes, backgroundColor: SERIES.taxes, tension: 0.3 },
              { label: 'Margem líquida', data: idx.map((i) => m('lucro_liquido', i)), borderColor: SERIES.profit, backgroundColor: SERIES.profit, tension: 0.3 },
            ],
          }}
          options={opts}
        />
      </div>
    </Card>
  );
};

/** Composição das despesas operacionais e financeiras do ano. */
export const ExpensesChart = ({ lineById }) => {
  const parts = [
    { id: 'desp_pessoal', label: 'Pessoal' },
    { id: 'desp_administrativas', label: 'Administrativas' },
    { id: 'desp_comerciais', label: 'Comerciais' },
    { id: 'desp_tributarias', label: 'Tributárias' },
    { id: 'desp_financeiras', label: 'Financeiras' },
    { id: 'desp_nao_detalhadas', label: 'Sem detalhamento' },
  ].map((p) => ({ ...p, value: -(lineById[p.id]?.total || 0) })).filter((p) => p.value > 0.005);
  const total = parts.reduce((a, p) => a + p.value, 0);
  const palette = [SERIES.revenue, SERIES.purchases, SERIES.expenses, SERIES.taxes, SERIES.loss, '#94a3b8'];
  return (
    <Card>
      <CardHeader title="Para onde vão as despesas" description="Despesas operacionais e financeiras do ano, por natureza." />
      {total === 0 ? <p className="text-sm text-ink-3">Sem despesas no ano.</p> : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-52 h-52 shrink-0">
            <Doughnut
              data={{ labels: parts.map((p) => p.label), datasets: [{ data: parts.map((p) => p.value), backgroundColor: palette.slice(0, parts.length), borderColor: cssVar('--surface'), borderWidth: 2 }] }}
              options={{ cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${brl(c.raw)} (${pct((c.raw / total) * 100, 1)})` } } }, maintainAspectRatio: false }}
            />
          </div>
          <ul className="flex-1 w-full space-y-2 text-sm">
            {parts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: palette[i] }} />
                <span className="flex-1">{p.label}</span>
                <span className="text-ink-3 num w-14 text-right">{pct((p.value / total) * 100, 1)}</span>
                <span className="num w-32 text-right">{brl(p.value)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 pt-2 border-t border-line font-semibold"><span className="flex-1">Total</span><span className="num">{brl(total)}</span></li>
          </ul>
        </div>
      )}
    </Card>
  );
};

/** Tributos de cada mês: deduções da receita + IR e CSLL. */
export const TaxesChart = ({ lineById, monthsWithData }) => {
  const idx = MONTHS_SHORT.map((_, i) => i).filter((i) => monthsWithData[i]);
  const series = [
    { id: 'ded_icms', label: lineById.ded_icms.label.replace(' sobre vendas', ''), color: SERIES.revenue },
    { id: 'ded_pis', label: 'PIS', color: SERIES.taxes },
    { id: 'ded_cofins', label: 'COFINS', color: SERIES.profit },
    { id: 'ded_iss', label: 'ISS', color: SERIES.purchases },
    { id: 'ded_difal', label: 'DIFAL', color: '#14b8a6' },
    { id: 'ded_telecom', label: 'FUST/FUNTTEL', color: '#94a3b8' },
    { id: 'irpj', label: 'IRPJ', color: SERIES.loss },
    { id: 'csll', label: 'CSLL', color: SERIES.expenses },
  ].filter((s) => lineById[s.id].values.some((v) => v !== 0));
  return (
    <Card>
      <CardHeader title="Tributos por mês" description="Impostos sobre o faturamento (deduções) e sobre o lucro (IR e CSLL), empilhados." />
      <div className="h-80">
        <Bar
          data={{ labels: idx.map((i) => MONTHS_SHORT[i]), datasets: series.map((s) => ({ label: s.label, data: idx.map((i) => -lineById[s.id].values[i]), backgroundColor: s.color })) }}
          options={baseChartOptions({ stacked: true })}
        />
      </div>
    </Card>
  );
};
