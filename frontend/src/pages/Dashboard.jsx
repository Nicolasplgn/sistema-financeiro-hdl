// Visão geral: faturamento, saídas e lucro do período, da empresa ou do grupo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { CalendarRange, FileDown, FileSpreadsheet, Info, MessageCircle, TrendingDown, TrendingUp, Wallet, Percent, Landmark } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Alert, Button, Card, CardHeader, EmptyState, Input, Loading, Page, PageHeader, Stat } from '../components/ui';
import { SheetFrame } from '../components/ui/sheet';
import { baseChartOptions, SERIES } from '../utils/charts';
import { brl, money, monthLabel, pct } from '../utils/format';

const currentYear = () => new Date().getFullYear();
const lastDay = (month) => { const [y, m] = month.split('-').map(Number); return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };

const RankingList = ({ title, items, tone }) => {
  const max = items.length ? Number(items[0].value) || 1 : 1;
  return (
    <Card>
      <CardHeader title={title} />
      {items.length === 0 ? <p className="text-sm text-ink-3">Sem lançamentos detalhados com parceiro neste período.</p> : (
        <ol className="space-y-3">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate"><span className="text-ink-3 num mr-2">{i + 1}.</span>{it.name}</span>
                <span className="font-medium num shrink-0">{brl(Number(it.value))}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(Number(it.value) / max) * 100}%`, background: tone }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
};

const Dashboard = ({ companyId, groupId, companies }) => {
  const [period, setPeriod] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vector_dash_period')) || { start: `${currentYear()}-01`, end: `${currentYear()}-12` }; }
    catch { return { start: `${currentYear()}-01`, end: `${currentYear()}-12` }; }
  });
  const [report, setReport] = useState(null);
  const [ranking, setRanking] = useState({ clients: [], suppliers: [] });
  const [previous, setPrevious] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef(null);

  useEffect(() => { localStorage.setItem('vector_dash_period', JSON.stringify(period)); }, [period]);

  // Grupo: soma as empresas que pertencem a ele.
  const companyIds = useMemo(() => (groupId
    ? companies.filter((c) => Number(c.group_id) === Number(groupId)).map((c) => c.id)
    : companyId ? [companyId] : []), [companyId, groupId, companies]);
  const key = `${companyIds.join(',')}|${period.start}|${period.end}`;
  const [loadedKey, setLoadedKey] = useState(null);

  useEffect(() => {
    if (companyIds.length === 0) return undefined;
    let alive = true;
    const startDate = `${period.start}-01`;
    const endDate = lastDay(period.end);
    const back = (d) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
    Promise.all([
      http.post('/report', { companyIds, startDate, endDate }),
      companyId ? http.get('/reports/partners-ranking', { params: { companyId, startDate, endDate } }) : Promise.resolve({ data: { clients: [], suppliers: [] } }),
      http.post('/report', { companyIds, startDate: back(startDate), endDate: lastDay(back(period.end)) }),
    ])
      .then(([r, rk, prev]) => { if (alive) { setReport(r.data); setRanking(rk.data); setPrevious(prev.data); setError(null); setLoadedKey(key); } })
      .catch((e) => alive && setError(errorMessage(e, 'Erro ao carregar o relatório.')));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (groupId && companyIds.length === 0) {
    return <Page><EmptyState title="Este grupo não tem empresas" description="Vincule empresas ao grupo em “Empresas e grupos” para ver o consolidado." /></Page>;
  }
  if (!report || loadedKey !== key) return error ? <Page><Alert tone="error">{error}</Alert></Page> : <Loading label="Montando a visão geral…" />;

  const { months, summary, categories } = report;
  const saidas = summary.totalTaxes + summary.totalCosts;
  const margin = summary.totalRevenue > 0 ? (summary.totalProfit / summary.totalRevenue) * 100 : 0;
  const taxTotals = months.reduce((acc, m) => ({
    ICMS: acc.ICMS + Number(m.tax_icms || 0), PIS: acc.PIS + Number(m.tax_pis || 0), COFINS: acc.COFINS + Number(m.tax_cofins || 0),
    ISS: acc.ISS + Number(m.tax_iss || 0), 'IRPJ + CSLL': acc['IRPJ + CSLL'] + Number(m.tax_irpj_csll || 0),
  }), { ICMS: 0, PIS: 0, COFINS: 0, ISS: 0, 'IRPJ + CSLL': 0 });
  const otherTaxes = summary.totalTaxes - Object.values(taxTotals).reduce((a, b) => a + b, 0);
  const catTotal = categories.reduce((a, c) => a + Number(c.total), 0);
  const ps = previous?.months?.length ? previous.summary : null;
  const delta = (cur, prev) => (ps && prev ? `${cur >= prev ? '▲' : '▼'} ${pct(Math.abs(((cur - prev) / Math.abs(prev)) * 100), 1)} vs ${Number(period.start.slice(0, 4)) - 1}` : null);
  const carga = summary.totalRevenue > 0 ? (summary.totalTaxes / summary.totalRevenue) * 100 : null;
  const topCategories = categories.slice(0, 8);

  // ------------------------------------------------------------------ exportações
  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Visão geral');
    ws.addRow([`Visão geral ${period.start} a ${period.end}`]).font = { bold: true, size: 14 };
    ws.addRow([]);
    const header = ws.addRow(['Mês', 'Faturamento', 'Impostos', 'Compras', 'Despesas', 'Lucro líquido', 'Margem %']);
    header.font = { bold: true };
    months.forEach((m) => ws.addRow([m.monthKey, m.totalRevenue, m.totalTaxes, m.totalPurchases, m.totalExpenses, m.profit, m.totalRevenue > 0 ? m.profit / m.totalRevenue : 0]));
    const total = ws.addRow(['Total', summary.totalRevenue, summary.totalTaxes, months.reduce((a, m) => a + m.totalPurchases, 0), months.reduce((a, m) => a + m.totalExpenses, 0), summary.totalProfit, margin / 100]);
    total.font = { bold: true };
    ws.columns = [{ width: 12 }, ...Array(5).fill({ width: 18, style: { numFmt: '"R$" #,##0.00' } }), { width: 12, style: { numFmt: '0.0%' } }];
    saveAs(new Blob([await wb.xlsx.writeBuffer()]), `visao-geral_${period.start}_${period.end}.xlsx`);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, (canvas.height * w) / canvas.width);
      pdf.save(`visao-geral_${period.start}_${period.end}.pdf`);
    } finally { setExporting(false); }
  };

  const shareWhatsApp = () => {
    const text = `Resumo ${period.start} a ${period.end}\nFaturamento: ${brl(summary.totalRevenue)}\nSaídas: ${brl(saidas)}\nLucro: ${brl(summary.totalProfit)}\nMargem: ${pct(margin, 1)}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const labels = months.map((m) => monthLabel(m.monthKey));

  return (
    <Page wide>
      <PageHeader
        title={groupId ? 'Visão geral do grupo' : 'Visão geral'}
        description={groupId ? `Soma das ${companyIds.length} empresas do grupo no período.` : 'Resultado da empresa no período, a partir dos lançamentos mensais.'}
        actions={(
          <>
            <div className="flex items-center gap-2">
              <Input type="month" aria-label="Mês inicial" value={period.start} onChange={(e) => e.target.value && setPeriod({ ...period, start: e.target.value })} className="w-40" />
              <span className="text-ink-3 text-sm">até</span>
              <Input type="month" aria-label="Mês final" value={period.end} onChange={(e) => e.target.value && setPeriod({ ...period, end: e.target.value })} className="w-40" />
              <Button icon={CalendarRange} onClick={() => setPeriod({ start: `${currentYear()}-01`, end: `${currentYear()}-12` })}>Ano atual</Button>
            </div>
            <Button icon={FileSpreadsheet} onClick={exportExcel} disabled={months.length === 0}>Excel</Button>
            <Button icon={FileDown} onClick={exportPdf} loading={exporting}>PDF</Button>
            <Button icon={MessageCircle} onClick={shareWhatsApp}>WhatsApp</Button>
          </>
        )}
      />

      <div ref={printRef} className="space-y-6">
        {months.length === 0 ? (
          <Card><EmptyState title="Nenhum lançamento neste período" description="Registre os meses em “Lançamentos do mês” ou importe a DRE/balancetes da contabilidade." /></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
              <Stat label="Faturamento" value={brl(summary.totalRevenue)} icon={Wallet} hint={delta(summary.totalRevenue, ps?.totalRevenue) || 'Receita operacional bruta'} />
              <Stat label="Saídas" value={brl(saidas)} icon={TrendingDown} hint={delta(saidas, ps && ps.totalTaxes + ps.totalCosts) || 'Impostos + compras + despesas'} tone="neg" />
              <Stat label="Lucro líquido" value={brl(summary.totalProfit)} icon={TrendingUp} tone={summary.totalProfit >= 0 ? 'pos' : 'neg'} hint={delta(summary.totalProfit, ps?.totalProfit) || 'Receitas − saídas'} />
              <Stat label="Margem líquida" value={pct(margin, 1)} icon={Percent} hint={ps && ps.totalRevenue ? `${pct((ps.totalProfit / ps.totalRevenue) * 100, 1)} no mesmo período de ${Number(period.start.slice(0, 4)) - 1}` : 'Lucro ÷ faturamento'} />
              <Stat label="Carga tributária" value={pct(carga, 1)} icon={Landmark} tone="warn" hint={`${brl(summary.totalTaxes)} em impostos`} />
              <Stat label="Saídas de capital" value={brl(summary.totalPatrimonial)} icon={Landmark} tone="warn" hint="Empréstimos e dívidas (fora da DRE)" />
            </div>
            {summary.totalPatrimonial > 0 && (
              <Alert tone="info" title="Sobre as saídas de capital">
                Pagamentos de empréstimos, dividendos e dívidas antigas saem do caixa, mas não entram como despesa no lucro, para não distorcer o resultado operacional.
              </Alert>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader title="Faturamento e lucro por mês" description="Barras em reais; a linha mostra a margem (%)." />
                <div className="h-80">
                  <Bar
                    data={{
                      labels,
                      datasets: [
                        { type: 'line', label: 'Margem', data: months.map((m) => (m.totalRevenue > 0 ? (m.profit / m.totalRevenue) * 100 : 0)), borderColor: SERIES.margin, backgroundColor: SERIES.margin, yAxisID: 'y1', tension: 0.3, pointRadius: 2 },
                        { label: 'Faturamento', data: months.map((m) => m.totalRevenue), backgroundColor: SERIES.revenue, borderRadius: 4, yAxisID: 'y' },
                        { label: 'Lucro líquido', data: months.map((m) => m.profit), backgroundColor: months.map((m) => (m.profit >= 0 ? SERIES.profit : SERIES.loss)), borderRadius: 4, yAxisID: 'y' },
                      ],
                    }}
                    options={baseChartOptions({ percentAxis: true })}
                  />
                </div>
              </Card>
              <Card>
                <CardHeader title="Para onde foi o dinheiro" description="Saídas de cada mês, por tipo." />
                <div className="h-80">
                  <Bar
                    data={{
                      labels,
                      datasets: [
                        { label: 'Impostos', data: months.map((m) => m.totalTaxes), backgroundColor: SERIES.taxes },
                        { label: 'Compras', data: months.map((m) => m.totalPurchases), backgroundColor: SERIES.purchases },
                        { label: 'Despesas', data: months.map((m) => m.totalExpenses), backgroundColor: SERIES.expenses },
                      ],
                    }}
                    options={baseChartOptions({ stacked: true })}
                  />
                </div>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader title="Matriz tributária" description="Cada imposto, mês a mês." />
                <div className="h-80">
                  <Bar
                    data={{
                      labels,
                      datasets: [
                        { label: 'ICMS / DAS', data: months.map((m) => m.tax_icms), backgroundColor: SERIES.revenue },
                        { label: 'PIS', data: months.map((m) => m.tax_pis), backgroundColor: SERIES.taxes },
                        { label: 'COFINS', data: months.map((m) => m.tax_cofins), backgroundColor: SERIES.profit },
                        { label: 'ISS', data: months.map((m) => m.tax_iss), backgroundColor: SERIES.purchases },
                        { label: 'IRPJ + CSLL', data: months.map((m) => m.tax_irpj_csll), backgroundColor: SERIES.loss },
                        { label: 'Outros', data: months.map((m) => Math.max(m.totalTaxes - m.tax_icms - m.tax_pis - m.tax_cofins - m.tax_iss - m.tax_irpj_csll, 0)), backgroundColor: '#94a3b8' },
                      ],
                    }}
                    options={baseChartOptions({ stacked: true })}
                  />
                </div>
              </Card>
              <Card>
                <CardHeader title="Principais contas do período" description="Maiores entradas e saídas detalhadas (dos balancetes e do detalhamento analítico)." />
                {topCategories.length === 0 ? <p className="text-sm text-ink-3">Nenhum item detalhado no período.</p> : (
                  <div className="h-80">
                    <Doughnut
                      data={{
                        labels: topCategories.map((c) => `${c.type === 'REVENUE' ? '+' : '−'} ${c.name}`),
                        datasets: [{ data: topCategories.map((c) => Number(c.total)), backgroundColor: SERIES.palette, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(), borderWidth: 2 }],
                      }}
                      options={{
                        maintainAspectRatio: false, cutout: '62%',
                        plugins: {
                          legend: { position: 'right', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--ink-2').trim(), boxWidth: 10, font: { size: 11 } } },
                          tooltip: { callbacks: { label: (c) => `${c.label}: ${brl(c.raw)}` } },
                        },
                      }}
                    />
                  </div>
                )}
              </Card>
            </div>

            <Card padded={false}>
              <div className="p-5 pb-3"><CardHeader className="mb-0" title="Mês a mês" description="Os números por trás dos gráficos." /></div>
              <SheetFrame className="px-5 pb-5">
                <table className="sheet min-w-[860px]">
                  <thead>
                    <tr>
                      <th className="text-left">Mês</th><th className="text-right">Faturamento</th><th className="text-right">Outras receitas</th>
                      <th className="text-right">Impostos</th><th className="text-right">Compras</th><th className="text-right">Despesas</th>
                      <th className="text-right">Lucro líquido</th><th className="text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={m.monthKey}>
                        <td className="cell">{monthLabel(m.monthKey)}</td>
                        <td className="cell text-right num">{money(m.totalRevenue)}</td>
                        <td className="cell text-right num">{money(m.otherRevenue)}</td>
                        <td className="cell text-right num">{money(m.totalTaxes)}</td>
                        <td className="cell text-right num">{money(m.totalPurchases)}</td>
                        <td className="cell text-right num">{money(m.totalExpenses)}</td>
                        <td className={`cell text-right num font-medium ${m.profit >= 0 ? 'text-pos' : 'text-neg'}`}>{money(m.profit)}</td>
                        <td className="cell text-right num">{m.totalRevenue > 0 ? pct((m.profit / m.totalRevenue) * 100, 1) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td className="cell">Total</td>
                      <td className="cell text-right num">{money(summary.totalRevenue)}</td>
                      <td className="cell text-right num">{money(months.reduce((a, m) => a + m.otherRevenue, 0))}</td>
                      <td className="cell text-right num">{money(summary.totalTaxes)}</td>
                      <td className="cell text-right num">{money(months.reduce((a, m) => a + m.totalPurchases, 0))}</td>
                      <td className="cell text-right num">{money(months.reduce((a, m) => a + m.totalExpenses, 0))}</td>
                      <td className="cell text-right num">{money(summary.totalProfit)}</td>
                      <td className="cell text-right num">{pct(margin, 1)}</td>
                    </tr>
                  </tbody>
                </table>
              </SheetFrame>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Impostos do período" description="Total de cada tributo lançado." />
                <ul className="divide-y divide-line">
                  {[...Object.entries(taxTotals), ...(otherTaxes > 0.005 ? [['Outros (DIFAL, FUST…)', otherTaxes]] : [])].sort((a, b) => b[1] - a[1]).map(([name, v]) => (
                    <li key={name} className="flex justify-between py-2 text-sm">
                      <span>{name}</span>
                      <span className="num"><span className="text-ink-3 mr-3">{summary.totalTaxes > 0 ? pct((v / summary.totalTaxes) * 100, 1) : '—'}</span>{brl(v)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between py-2 text-sm font-semibold"><span>Total</span><span className="num">{brl(summary.totalTaxes)}</span></li>
                </ul>
              </Card>
              <Card>
                <CardHeader title="Detalhamento por categoria" description="Itens analíticos dos lançamentos (entradas e saídas)." />
                {categories.length === 0 ? (
                  <p className="text-sm text-ink-3 flex gap-2"><Info size={16} className="shrink-0" /> Nenhum item detalhado no período. O detalhamento é feito em “Lançamentos do mês”.</p>
                ) : (
                  <ul className="space-y-2.5 max-h-80 overflow-y-auto scroll-thin pr-1">
                    {categories.map((c, i) => (
                      <li key={`${c.name}-${c.type}-${i}`}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="truncate">{c.name}</span>
                          <span className={`num shrink-0 ${c.type === 'REVENUE' ? 'text-pos' : 'text-neg'}`}>{c.type === 'REVENUE' ? '+' : '−'} {brl(Number(c.total))}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${catTotal > 0 ? (Number(c.total) / catTotal) * 100 : 0}%`, background: c.type === 'REVENUE' ? SERIES.profit : SERIES.loss }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {!groupId && (
              <div className="grid gap-4 lg:grid-cols-2">
                <RankingList title="Maiores clientes" items={ranking.clients} tone={SERIES.profit} />
                <RankingList title="Maiores fornecedores" items={ranking.suppliers} tone={SERIES.loss} />
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  );
};

export default Dashboard;
