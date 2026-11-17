// DRE — Demonstração do Resultado do Exercício (Lei 6.404/76, art. 187; CPC 26).
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, Info, Printer, Search, AlertTriangle } from 'lucide-react';
import http, { errorMessage } from '../../services/http';
import { Alert, Badge, Button, Card, CardHeader, Loading, Modal, Page, Select, Stat, Tabs, Toggle } from '../../components/ui';
import { SheetFrame } from '../../components/ui/sheet';
import { brl, MONTHS_SHORT, pct, REGIME_LABEL } from '../../utils/format';
import { buildColumns, indicators, VIEWS } from './dreModel';
import { ExpensesChart, MarginsChart, TaxesChart, WaterfallChart } from './DreCharts';
import { exportDreExcel } from './dreExcel';

/** Formato contábil: negativos entre parênteses, zero como traço. */
const acc = (v) => {
  if (v === null || v === undefined || Math.abs(v) < 0.005) return '–';
  const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
};
const accPct = (v) => (v === null || v === undefined || !Number.isFinite(v) || Math.abs(v) < 0.05 ? '–' : v < 0 ? `(${pct(-v, 1)})` : pct(v, 1));

const ROW_STYLE = {
  group: 'font-semibold text-ink',
  item: 'text-ink-2',
  subtotal: 'font-semibold text-ink bg-surface-3',
  result: 'font-bold text-ink bg-brand-soft',
};

// ----------------------------------------------------------------------------- detalhamento por conta
const AccountsModal = ({ line, accounts, year, onClose }) => {
  const [q, setQ] = useState('');
  if (!line) return null;
  const list = accounts.filter((a) => a.line === line.id && (!q || a.description.toLowerCase().includes(q.toLowerCase())));
  const total = list.reduce((s, a) => s + a.total, 0);
  const sem = line.total - accounts.filter((a) => a.line === line.id).reduce((s, a) => s + a.total, 0);
  return (
    <Modal open onClose={onClose} size="xl" title={`${line.code} ${line.label}`} description={`Contas que compõem a linha em ${year}, como vieram dos balancetes. Valores negativos reduzem o resultado.`}>
      <div className="mb-3 max-w-sm relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar conta…" className="w-full h-9 pl-9 pr-3 rounded-lg border border-line bg-surface text-sm outline-none focus:border-brand" />
      </div>
      <SheetFrame maxHeight="60vh">
        <table className="sheet min-w-[1300px]">
          <thead className="sticky top-0 z-[3]">
            <tr>
              <th className="text-left sticky-col min-w-[280px]">Conta</th>
              {MONTHS_SHORT.map((m) => <th key={m} className="text-right">{m}</th>)}
              <th className="text-right">Total</th>
              <th className="text-right">% da linha</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.description}>
                <td className="cell sticky-col bg-surface">{a.description}</td>
                {a.values.map((v, i) => <td key={i} className="cell text-right num">{acc(v)}</td>)}
                <td className="cell text-right num font-semibold">{acc(a.total)}</td>
                <td className="cell text-right num text-ink-2">{line.total ? pct((a.total / line.total) * 100, 1) : '–'}</td>
              </tr>
            ))}
            {Math.abs(sem) > 0.005 && !q && (
              <tr>
                <td className="cell sticky-col bg-surface text-ink-3 italic">Meses sem detalhamento por conta</td>
                {MONTHS_SHORT.map((m) => <td key={m} className="cell" />)}
                <td className="cell text-right num">{acc(sem)}</td>
                <td className="cell text-right num text-ink-2">{line.total ? pct((sem / line.total) * 100, 1) : '–'}</td>
              </tr>
            )}
            <tr className="total">
              <td className="cell sticky-col">Total da linha</td>
              {MONTHS_SHORT.map((m) => <td key={m} className="cell" />)}
              <td className="cell text-right num">{acc(q ? total : line.total)}</td>
              <td className="cell" />
            </tr>
          </tbody>
        </table>
      </SheetFrame>
    </Modal>
  );
};

// ----------------------------------------------------------------------------- página
const DrePage = ({ companyId }) => {
  const [year, setYear] = useState(() => Number(localStorage.getItem('vector_dre_year')) || new Date().getFullYear());
  const [view, setView] = useState(() => localStorage.getItem('vector_dre_view') || 'mensal');
  const [avBase, setAvBase] = useState(() => localStorage.getItem('vector_dre_av') || 'receita_bruta');
  const [hideZero, setHideZero] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);
  const [exporting, setExporting] = useState(false);
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i), []);

  useEffect(() => { localStorage.setItem('vector_dre_year', String(year)); }, [year]);
  useEffect(() => { localStorage.setItem('vector_dre_view', view); }, [view]);
  useEffect(() => { localStorage.setItem('vector_dre_av', avBase); }, [avBase]);

  useEffect(() => {
    let alive = true;
    http.get('/reports/dre/completa', { params: { companyId, year } })
      .then((r) => { if (alive) { setData({ ...r.data, key: `${companyId}-${year}` }); setError(null); } })
      .catch((e) => alive && setError(errorMessage(e, 'Erro ao montar a DRE.')));
    return () => { alive = false; };
  }, [companyId, year]);

  const ready = data && data.key === `${companyId}-${year}`;
  const model = useMemo(() => {
    if (!ready) return null;
    const lines = data.atual.lines;
    const lineById = Object.fromEntries(lines.map((l) => [l.id, l]));
    const byId = Object.fromEntries(lines.map((l) => [l.id, l.total]));
    const prevByLine = Object.fromEntries(data.anterior.lines.map((l) => [l.id, l]));
    const monthsWithData = data.atual.months.map((m) => m.hasEntry);
    const accountLines = new Set(data.atual.accounts.map((a) => a.line));
    return { lines, lineById, byId, prevByLine, monthsWithData, accountLines };
  }, [data, ready]);

  if (error && !ready) return <Page><Alert tone="error">{error}</Alert></Page>;
  if (!ready || !model) return <Loading label="Montando a DRE…" />;

  const { lines, lineById, byId, prevByLine, monthsWithData, accountLines } = model;
  const conf = data.atual.conferencia;
  const ind = indicators(lines, monthsWithData, data.meta_faturamento);
  const columns = buildColumns({
    view, year, prevByLine, base: avBase, monthsWithData,
    baseTotal: byId[avBase],
    prevBaseTotal: prevByLine[avBase]?.total ?? 0,
  });

  const zeroAll = (l) => l.values.every((v) => Math.abs(v) < 0.005) && (view !== 'comparativo' || Math.abs(prevByLine[l.id]?.total ?? 0) < 0.005);
  const visible = lines.filter((l) => {
    if (l.kind === 'item' && collapsed[l.parent]) return false;
    if (hideZero && l.kind === 'item' && zeroAll(l)) return false;
    return true;
  });
  const groups = lines.filter((l) => l.kind === 'group').map((l) => l.id);
  const allCollapsed = groups.every((g) => collapsed[g]);
  const firstMonth = monthsWithData.indexOf(true);
  const lastMonth = monthsWithData.lastIndexOf(true);

  const exportExcel = async () => {
    setExporting(true);
    try { await exportDreExcel({ data, avBase }); } finally { setExporting(false); }
  };

  return (
    <Page wide>
      {/* ------------------------------------------------ controles */}
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="min-w-0 flex-1 basis-[420px]">
          <h1 className="text-2xl font-bold tracking-tight text-ink">DRE — Demonstração do Resultado do Exercício</h1>
          <p className="mt-1 text-sm text-ink-2 max-w-3xl leading-relaxed">
            Estrutura do art. 187 da Lei 6.404/76 e do CPC 26, montada a partir dos lançamentos e dos balancetes. Clique em uma linha com <ChevronRight size={12} className="inline" /> ou no nome de uma conta para ver a composição.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Exercício" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-36">
            {years.map((y) => <option key={y} value={y}>Exercício {y}</option>)}
          </Select>
          <Button icon={FileSpreadsheet} loading={exporting} onClick={exportExcel}>Excel com fórmulas</Button>
          <Button icon={Printer} onClick={() => window.print()}>Imprimir / PDF</Button>
        </div>
      </div>

      {/* ------------------------------------------------ cabeçalho da demonstração */}
      <Card className="print:shadow-none print:border-0">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-ink">{data.empresa.razao_social || data.empresa.nome}</p>
            <p className="text-sm text-ink-2">CNPJ {data.empresa.cnpj || '—'} · {REGIME_LABEL[data.empresa.regime] || data.empresa.regime}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-ink">Demonstração do Resultado do Exercício</p>
            <p className="text-sm text-ink-2">
              {firstMonth >= 0 ? `${MONTHS_SHORT[firstMonth]} a ${MONTHS_SHORT[lastMonth]} de ${year}` : `Exercício ${year}`} · valores em R$
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {conf.confere
            ? <Badge tone="pos"><CheckCircle2 size={12} /> Lucro confere com os lançamentos (diferença {brl(conf.diferenca)})</Badge>
            : <Badge tone="neg"><AlertTriangle size={12} /> Diferença de {brl(conf.diferenca)} entre a DRE e os lançamentos</Badge>}
          <Badge tone="neutral">{conf.meses_lancados} de 12 meses lançados</Badge>
          {conf.despesas_detalhadas_percentual !== null && (
            <Badge tone={conf.despesas_detalhadas_percentual >= 90 ? 'pos' : 'warn'}>{pct(conf.despesas_detalhadas_percentual, 0)} das despesas detalhadas por conta</Badge>
          )}
          {conf.saidas_capital > 0 && <Badge tone="warn">{brl(conf.saidas_capital)} em saídas de capital fora do resultado</Badge>}
          {data.anterior.tem_dados ? <Badge tone="brand">Comparativo com {year - 1} disponível</Badge> : <Badge>Sem lançamentos em {year - 1}</Badge>}
        </div>
      </Card>

      {/* ------------------------------------------------ indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Receita líquida" value={brl(ind.receitaLiquida)} hint={`Bruta ${brl(ind.receitaBruta)}`} />
        <Stat label="Margem bruta" value={pct(ind.margemBruta, 1)} hint={`Lucro bruto ${brl(ind.lucroBruto)}`} tone="brand" />
        <Stat label="Margem operacional (EBIT)" value={pct(ind.margemOperacional, 1)} hint={`EBIT ${brl(ind.ebit)}`} tone={ind.ebit >= 0 ? 'brand' : 'neg'} />
        <Stat label="Margem líquida" value={pct(ind.margemLiquida, 1)} hint={`Lucro ${brl(ind.lucroLiquido)}`} tone={ind.lucroLiquido >= 0 ? 'pos' : 'neg'} />
        <Stat label="Carga tributária" value={pct(ind.cargaTributaria, 1)} hint={`${brl(ind.tributos)} sobre a receita bruta`} tone="warn" />
        <Stat
          label="Ponto de equilíbrio"
          value={ind.pontoEquilibrioMensal === null ? '—' : brl(ind.pontoEquilibrioMensal)}
          hint={ind.pontoEquilibrioMensal === null ? 'Margem de contribuição negativa' : `receita líquida/mês · média atual ${brl(ind.receitaLiquidaMediaMensal)}`}
        />
      </div>
      {ind.meta && (
        <Card className="print:hidden">
          <div className="flex justify-between text-sm mb-2"><span className="font-medium">Meta de faturamento de {year}: {brl(ind.meta)}</span><span className="num">{pct(ind.metaPercentual, 1)} atingido</span></div>
          <div className="h-2 rounded-full bg-surface-3 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(ind.metaPercentual || 0, 100)}%` }} /></div>
        </Card>
      )}

      {/* ------------------------------------------------ tabela */}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-line print:hidden">
          <Tabs value={view} onChange={setView} items={VIEWS} />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-ink-2">
              AV% sobre
              <select value={avBase} onChange={(e) => setAvBase(e.target.value)} className="h-8 px-2 rounded-md border border-line bg-surface text-sm text-ink">
                <option value="receita_bruta">Receita bruta</option>
                <option value="receita_liquida">Receita líquida</option>
              </select>
            </label>
            <Toggle checked={hideZero} onChange={setHideZero} label="Ocultar linhas zeradas" />
            <Button size="sm" variant="ghost" onClick={() => setCollapsed(allCollapsed ? {} : Object.fromEntries(groups.map((g) => [g, true])))}>
              {allCollapsed ? 'Expandir tudo' : 'Recolher tudo'}
            </Button>
          </div>
        </div>
        {view === 'comparativo' && !data.anterior.tem_dados && (
          <Alert tone="info" className="m-4 mb-0">Não há lançamentos em {year - 1}. A coluna do ano anterior aparece zerada.</Alert>
        )}
        <SheetFrame className="p-4">
          <table className="sheet" style={{ minWidth: 380 + columns.length * 112 }}>
            <thead className="sticky top-0 z-[3]">
              <tr>
                <th className="text-left sticky-col min-w-[360px]">Conta</th>
                {columns.map((c) => <th key={c.key} className={`text-right min-w-[104px] ${c.emphasis ? 'text-ink' : ''} ${c.muted ? 'opacity-50' : ''}`}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => {
                const hasChildren = l.kind === 'group';
                const drillable = accountLines.has(l.id);
                const style = ROW_STYLE[l.kind];
                return (
                  <tr key={l.id}>
                    <td className={`cell sticky-col ${l.kind === 'subtotal' || l.kind === 'result' ? style : `bg-surface ${style}`}`}>
                      <div className={`flex items-center gap-1.5 ${l.kind === 'item' ? 'pl-6' : ''}`}>
                        {hasChildren ? (
                          <button className="text-ink-3 hover:text-ink print:hidden" onClick={() => setCollapsed((c) => ({ ...c, [l.id]: !c[l.id] }))} aria-label={collapsed[l.id] ? 'Expandir' : 'Recolher'}>
                            {collapsed[l.id] ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                          </button>
                        ) : <span className="w-[15px] shrink-0" />}
                        <span className="text-ink-3 num text-xs w-8 shrink-0">{l.code}</span>
                        {drillable
                          ? <button className="text-left hover:text-brand underline decoration-dotted underline-offset-2" onClick={() => setDrill(l)}>{l.label}</button>
                          : <span>{l.label}</span>}
                      </div>
                    </td>
                    {columns.map((c) => {
                      const v = c.value(l);
                      const negativeResult = (l.kind === 'result' || l.kind === 'subtotal') && c.kind === 'valor' && v < -0.005;
                      return (
                        <td key={c.key} className={`cell text-right num ${style} ${c.muted ? 'opacity-50' : ''} ${negativeResult ? '!text-neg' : ''} ${c.kind === 'pct' ? 'text-ink-3' : ''}`}>
                          {c.kind === 'pct' ? accPct(v) : acc(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SheetFrame>
        <p className="px-4 pb-4 text-xs text-ink-3">
          Valores entre parênteses reduzem o resultado. AV% (análise vertical) = linha ÷ {avBase === 'receita_liquida' ? 'receita líquida' : 'receita bruta'}.
          {view === 'comparativo' && ' AH% (análise horizontal) = variação sobre o ano anterior.'}
          {' '}Meses sem lançamento aparecem esmaecidos.
        </p>
      </Card>

      {/* ------------------------------------------------ gráficos */}
      <div className="grid gap-4 xl:grid-cols-2 print:hidden">
        <WaterfallChart byId={byId} />
        <MarginsChart lineById={lineById} monthsWithData={monthsWithData} />
        <ExpensesChart lineById={lineById} />
        <TaxesChart lineById={lineById} monthsWithData={monthsWithData} />
      </div>

      {/* ------------------------------------------------ notas */}
      <Card>
        <CardHeader title="Notas explicativas" icon={Info} />
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ink-2 leading-relaxed">
          <li>Fonte: lançamentos mensais do sistema, digitados ou importados dos balancetes da contabilidade ({conf.meses_lancados} meses em {year}).</li>
          <li>Deduções da receita bruta: {lineById.ded_icms.label}, DIFAL, PIS, COFINS, ISS e FUST/FUNTTEL sobre o faturamento.</li>
          <li>IRPJ (com adicional) e CSLL aparecem como provisão sobre o lucro, depois do resultado antes dos tributos (LAIR), e não como dedução da receita.</li>
          <li>
            Despesas operacionais classificadas por natureza a partir das contas do balancete (pessoal, comerciais, administrativas e tributárias).
            Juros, tarifas bancárias, IOF, taxas de cartão e seguro de empréstimos vão para o resultado financeiro.
            {conf.despesas_detalhadas_percentual !== null && conf.despesas_detalhadas_percentual < 100 && ` ${pct(100 - conf.despesas_detalhadas_percentual, 0)} das despesas vieram sem conta e estão em “sem detalhamento”.`}
          </li>
          <li>Pagamentos de empréstimos e demais movimentações patrimoniais ({brl(conf.saidas_capital)} no ano) afetam o caixa, mas não o resultado.</li>
          <li>Conferência: o lucro líquido desta DRE ({brl(conf.lucro_dre)}) é igual ao resultado dos lançamentos ({brl(conf.lucro_lancamentos)}).</li>
        </ol>
      </Card>

      <AccountsModal line={drill} accounts={data.atual.accounts} year={year} onClose={() => setDrill(null)} />
    </Page>
  );
};

export default DrePage;
