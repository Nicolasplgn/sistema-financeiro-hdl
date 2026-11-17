// Projeções: próximos 12 meses a partir do último mês lançado.
import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { RotateCcw, Wand2 } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Alert, Button, Card, CardHeader, Field, Input, Loading, Page, PageHeader, Stat, Tabs } from '../components/ui';
import { baseChartOptions, SERIES } from '../utils/charts';
import { brl, monthLabel, pct, qty, toNumber } from '../utils/format';

const TAX_RATE = 0.15; // estimativa de impostos sobre a receita usada na projeção

/** Tendência mensal (%) por regressão linear simples sobre o faturamento. */
const trendOf = (values) => {
  const n = values.length;
  if (n < 2) return 0;
  let sx = 0; let sy = 0; let sxy = 0; let sxx = 0;
  values.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const avg = sy / n;
  return avg ? (slope / avg) * 100 : 0;
};

const Slider = ({ label, value, onChange, min, max, hint }) => (
  <Field label={<span className="flex justify-between"><span>{label}</span><span className="num text-ink font-semibold">{pct(value, 1)} ao mês</span></span>} hint={hint}>
    <input type="range" min={min} max={max} step="0.1" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
  </Field>
);

const AnalyticalProjections = ({ companyId }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [growth, setGrowth] = useState(0);
  const [costGrowth, setCostGrowth] = useState(0);
  const [cash, setCash] = useState('');
  const [scenario, setScenario] = useState('todos');

  useEffect(() => {
    let alive = true;
    http.get('/intelligence/projections', { params: { companyId } })
      .then((r) => { if (alive) { setData({ ...r.data, companyId }); setError(null); } })
      .catch((e) => alive && setError(errorMessage(e, 'Erro ao carregar o histórico.')));
    return () => { alive = false; };
  }, [companyId]);

  const projection = useMemo(() => {
    const hist = data?.dataset || [];
    if (hist.length === 0) return null;
    const last = hist[hist.length - 1];
    let baseExpenses = Number(last.expenses);
    if (!baseExpenses) baseExpenses = hist.reduce((a, m) => a + Number(m.expenses), 0) / hist.length;
    const baseRevenue = Number(last.revenue);
    const months = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      const d = new Date(); d.setMonth(d.getMonth() + n);
      const mi = d.getMonth();
      const season = mi === 10 || mi === 11 ? 1.15 : mi === 0 || mi === 1 ? 0.85 : 1;
      const rev = (g) => baseRevenue * (1 + g / 100) ** n * season;
      const expenses = baseExpenses * (1 + costGrowth / 100) ** n;
      const realistic = rev(growth);
      return {
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
        optimistic: rev(growth + 5), realistic, pessimistic: rev(growth - 10), expenses,
        profit: realistic - expenses - realistic * TAX_RATE,
      };
    });
    const totalRevenue = months.reduce((a, m) => a + m.realistic, 0);
    const totalProfit = months.reduce((a, m) => a + m.profit, 0);
    const avgExpenses = months.reduce((a, m) => a + m.expenses, 0) / 12;
    return { months, totalRevenue, totalProfit, avgExpenses, baseRevenue };
  }, [data, growth, costGrowth]);

  if (error) return <Page><Alert tone="error">{error}</Alert></Page>;
  if (!data || data.companyId !== companyId) return <Loading label="Lendo o histórico…" />;
  if (!projection) {
    return <Page><PageHeader title="Projeções" /><Alert tone="info">É preciso ter pelo menos um mês lançado para projetar os próximos 12 meses.</Alert></Page>;
  }

  const hist = data.dataset;
  const cashValue = toNumber(cash);
  const runway = cashValue > 0 && projection.avgExpenses > 0 ? cashValue / projection.avgExpenses : null;
  const maxRev = Math.max(...hist.map((d) => Number(d.revenue)), 1);
  const show = (s) => scenario === 'todos' || scenario === s;

  return (
    <Page>
      <PageHeader
        title="Projeções"
        description={`Próximos 12 meses partindo do último mês lançado (faturamento de ${brl(projection.baseRevenue)}). Novembro e dezembro têm +15% de sazonalidade; janeiro e fevereiro, −15%.`}
        actions={(
          <>
            <Button icon={Wand2} onClick={() => { const t = trendOf(hist.map((d) => Number(d.revenue))); setGrowth(Number(t.toFixed(1))); setCostGrowth(Number((t * 0.8).toFixed(1))); }}>Usar a tendência real</Button>
            <Button icon={RotateCcw} onClick={() => { setGrowth(0); setCostGrowth(0); setCash(''); setScenario('todos'); }}>Zerar</Button>
          </>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-5">
          <CardHeader className="mb-0" title="Premissas" description="Arraste para simular." />
          <Slider label="Crescimento do faturamento" value={growth} onChange={setGrowth} min={-15} max={15} hint="O cenário otimista usa +5 pontos; o pessimista, −10 pontos." />
          <Slider label="Aumento dos custos" value={costGrowth} onChange={setCostGrowth} min={-5} max={15} />
          <Field label="Saldo em caixa hoje" hint="Para calcular por quantos meses o caixa cobre as despesas.">
            <Input prefix="R$" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0,00" />
          </Field>
          {runway !== null && (
            <div className={`p-3 rounded-lg border ${runway < 4 ? 'border-neg bg-neg-soft' : 'border-line bg-surface-2'}`}>
              <p className="text-xs text-ink-2">O caixa cobre</p>
              <p className="text-xl font-semibold num">{qty(runway, 1)} meses</p>
              <p className="text-xs text-ink-3">de despesas médias de {brl(projection.avgExpenses)}/mês{runway < 4 ? ' — atenção à liquidez' : ''}</p>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Faturamento projetado"
            description={`Soma de 12 meses no cenário realista: ${brl(projection.totalRevenue)}`}
            actions={<Tabs value={scenario} onChange={setScenario} items={[{ id: 'todos', label: 'Todos' }, { id: 'optimistic', label: 'Otimista' }, { id: 'realistic', label: 'Realista' }, { id: 'pessimistic', label: 'Pessimista' }]} />}
          />
          <div className="h-80">
            <Line
              data={{
                labels: projection.months.map((m) => m.label),
                datasets: [
                  { label: 'Otimista', data: projection.months.map((m) => m.optimistic), borderColor: SERIES.profit, borderDash: [5, 5], pointRadius: 0, hidden: !show('optimistic'), tension: 0.3 },
                  { label: 'Realista', data: projection.months.map((m) => m.realistic), borderColor: SERIES.revenue, borderWidth: 3, pointRadius: 2, hidden: !show('realistic'), tension: 0.3 },
                  { label: 'Pessimista', data: projection.months.map((m) => m.pessimistic), borderColor: SERIES.loss, borderDash: [5, 5], pointRadius: 0, hidden: !show('pessimistic'), tension: 0.3 },
                  { label: 'Despesas', data: projection.months.map((m) => m.expenses), borderColor: SERIES.margin, pointRadius: 0, tension: 0.3 },
                ],
              }}
              options={baseChartOptions()}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Lucro projetado em 12 meses" value={brl(projection.totalProfit)} tone={projection.totalProfit >= 0 ? 'pos' : 'neg'} hint={`Realista, com ${pct(TAX_RATE * 100, 0)} de impostos estimados`} />
        <Stat label="Despesa média projetada" value={brl(projection.avgExpenses)} hint="Por mês" />
        <Stat label="Faturamento médio projetado" value={brl(projection.totalRevenue / 12)} hint="Por mês, cenário realista" />
      </div>

      <Card>
        <CardHeader title="Sazonalidade" description="Faturamento dos últimos meses lançados, comparado ao melhor mês." />
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
          {hist.slice(-12).map((d) => {
            const share = Number(d.revenue) / maxRev;
            return (
              <div key={d.period} className="text-center" title={brl(Number(d.revenue))}>
                <div className="h-16 rounded-lg flex items-end overflow-hidden bg-surface-3">
                  <div className="w-full rounded-lg" style={{ height: `${Math.max(share * 100, 4)}%`, background: share > 0.75 ? 'var(--pos)' : share > 0.4 ? 'var(--brand)' : 'var(--warn)' }} />
                </div>
                <p className="mt-1 text-xs text-ink-2">{monthLabel(d.period)}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </Page>
  );
};

export default AnalyticalProjections;
