// Comparativo de canais: as abas MARKUP <canal> e TRIBUTOS <canal> de um mesmo
// modelo lado a lado (Online, B2B dentro do PR, B2B fora do PR, Exportação…).
import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import http, { errorMessage } from '../../services/http';
import { Alert, Card, CardHeader, Loading } from '../../components/ui';
import { SheetFrame } from '../../components/ui/sheet';
import { baseChartOptions } from '../../utils/charts';
import { brl, money, pct, qty, STATUS_LABEL } from '../../utils/format';
import { composition, GROUPS } from './priceComposition';

const ChannelComparison = ({ painel, productId, version }) => {
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return undefined;
    let alive = true;
    Promise.all(painel.canais.map((c) => http.get('/price-calc', { params: { productId, channelId: c.id } }).then((r) => r.data)))
      .then((list) => { if (alive) { setResults({ productId, version, list }); setError(null); } })
      .catch((e) => alive && setError(errorMessage(e, 'Erro ao comparar os canais.')));
    return () => { alive = false; };
  }, [painel, productId, version]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!results || results.productId !== productId || results.version !== version) return <Loading label="Calculando todos os canais…" />;

  const list = results.list;
  const ok = list.filter((r) => r.markup.status === 'OK');
  const encargos = list[0]?.markup.encargos.map((e) => ({ key: e.key, label: e.label, origem: e.origem })) ?? [];
  const cell = (r, fn, format = 'money') => {
    if (r.markup.status !== 'OK' && format !== 'pctAlways') return <span className="text-ink-3">—</span>;
    const v = fn(r);
    if (v === null || v === undefined) return <span className="text-ink-3">—</span>;
    return format === 'pct' || format === 'pctAlways' ? pct(v) : format === 'qty' ? qty(v, 1) : money(v);
  };
  const best = ok.length ? ok.reduce((a, b) => (b.markup.lucro.liquido_total > a.markup.lucro.liquido_total ? b : a)) : null;
  const showBest = best && best.markup.lucro.liquido_total > 0;

  // Linha da tabela (função comum, não componente)
  const row = ({ label, fn, format, strong, title }) => (
    <tr key={label} className={strong ? 'total' : undefined}>
      <td className="cell sticky-col bg-surface" title={title}>{label}</td>
      {list.map((r) => <td key={r.canal.id} className="cell text-right num">{cell(r, fn, format)}</td>)}
    </tr>
  );

  return (
    <div className="space-y-5">
      <SheetFrame>
        <table className="sheet" style={{ minWidth: 300 + list.length * 170 }}>
          <thead>
            <tr>
              <th className="text-left sticky-col min-w-[280px]">{list[0]?.produto.sku || list[0]?.produto.name}</th>
              {list.map((r) => (
                <th key={r.canal.id} className="text-right min-w-[160px] whitespace-normal">
                  <span className="block normal-case text-[12px] text-ink">{r.canal.name}</span>
                  {r.markup.status !== 'OK' && <span className="block text-[10px] font-normal normal-case text-warn">{STATUS_LABEL[r.markup.status]}</span>}
                  {showBest && best.canal.id === r.canal.id && ok.length > 1 && <span className="block text-[10px] font-normal normal-case text-pos">maior lucro no mês</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="group"><td colSpan={list.length + 1}>Base</td></tr>
            {row({ label: 'Meta de venda do canal', fn: (r) => Number(r.canal.sales_target), format: 'money' })}
            {row({ label: 'Valor de venda atribuído', fn: (r) => r.markup.valor_venda_atribuido })}
            {row({ label: 'Preço de compra', fn: (r) => r.markup.preco_compra })}

            <tr className="group"><td colSpan={list.length + 1}>Encargos sobre a venda (% do preço)</td></tr>
            {encargos.map((e) => (
              <tr key={e.key}>
                <td className="cell sticky-col bg-surface">{e.label}{e.origem === 'rateio' && <span className="ml-2 text-[11px] text-ink-3">rateio</span>}</td>
                {list.map((r) => {
                  const it = r.markup.encargos.find((x) => x.key === e.key);
                  const v = it?.percentual;
                  return <td key={r.canal.id} className={`cell text-right num ${!v ? 'text-ink-3' : ''}`}>{v === null || v === undefined ? '—' : pct(v)}</td>;
                })}
              </tr>
            ))}
            <tr className="total">
              <td className="cell sticky-col">Total dos encargos</td>
              {list.map((r) => <td key={r.canal.id} className="cell text-right num">{r.markup.total_percentual === null ? '—' : pct(r.markup.total_percentual)}</td>)}
            </tr>

            <tr className="group"><td colSpan={list.length + 1}>Preço</td></tr>
            {row({ label: 'Preço de venda sugerido', fn: (r) => r.markup.preco_venda_sugerido, strong: true })}
            {row({ label: 'IPI da faixa', fn: (r) => r.markup.ipi_valor })}
            {row({ label: 'Preço com IPI', fn: (r) => r.markup.preco_venda_com_ipi })}
            {row({ label: 'Preço de tabela (c/ desconto por fora)', fn: (r) => r.markup.valor_com_desconto_fora })}
            {row({ label: 'Quantidade produzida por mês', fn: (r) => r.markup.quantidade_mes, format: 'qty' })}

            <tr className="group"><td colSpan={list.length + 1}>Resultado</td></tr>
            {row({ label: 'Lucro líquido por unidade', fn: (r) => r.markup.lucro.liquido_unitario })}
            {row({ label: 'Lucro líquido no mês', fn: (r) => r.markup.lucro.liquido_total, strong: true })}

            <tr className="group"><td colSpan={list.length + 1}>Tributos por unidade</td></tr>
            {row({ label: 'Impostos da venda', fn: (r) => r.tributos.venda?.total })}
            {row({ label: '(−) Créditos da compra (com ICMS)', fn: (r) => r.tributos.compra.total_com_icms })}
            {row({ label: 'Imposto devido (com IR/CSLL)', fn: (r) => r.tributos.devido?.total, strong: true })}
            {row({ label: 'Alíquota efetiva', fn: (r) => r.tributos.devido?.aliquota_efetiva, format: 'pct' })}
          </tbody>
        </table>
      </SheetFrame>

      {ok.length > 0 && (
        <Card>
          <CardHeader title="Composição do preço em cada canal" description="De cada R$ 100 do preço sugerido: quanto é custo, imposto, despesa de venda, estrutura e lucro." />
          <div className="h-72">
            <Bar
              data={{
                labels: ok.map((r) => r.canal.name),
                datasets: GROUPS.map((g) => ({
                  label: g.label,
                  data: ok.map((r) => composition(r.markup).find((p) => p.id === g.id).percent),
                  backgroundColor: g.color,
                })),
              }}
              options={(() => {
                const o = baseChartOptions({ stacked: true });
                o.indexAxis = 'y';
                o.scales.x = { ...o.scales.y, stacked: true, max: 100, ticks: { ...o.scales.y.ticks, callback: (v) => `${v}%` } };
                o.scales.y = { stacked: true, grid: { display: false }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--ink-2').trim() } };
                o.plugins.tooltip = { callbacks: { label: (c) => `${c.dataset.label}: ${pct(c.raw, 1)} (${brl((ok[c.dataIndex].markup.preco_venda_sugerido * c.raw) / 100)})` } };
                return o;
              })()}
            />
          </div>
        </Card>
      )}
    </div>
  );
};

export default ChannelComparison;
