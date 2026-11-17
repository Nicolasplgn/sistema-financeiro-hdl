// Aba MARKUP: a aba "MARK UP LUCRO REAL - <canal> <modelo>" da planilha.
import React, { useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Field, Loading, Select, Tabs, Toggle } from '../../components/ui';
import { CalcCell, NumberCell, SelectCell, SheetFrame } from '../../components/ui/sheet';
import { brl, money, pct, qty, REGIME_LABEL, STATUS_LABEL } from '../../utils/format';
import ModelChannelPicker from './ModelChannelPicker';
import ChannelComparison from './ChannelComparison';
import { CompositionBar, PriceFlow } from './PriceAnatomy';
import { usePriceCalc } from './usePriceCalc';

// Linha do markup → campo do canal no painel.
const FIELD_BY_ENCARGO = {
  icms: 'icms_out_percent', difal: 'difal_out_percent', pis: 'pis_out_percent', cofins: 'cofins_out_percent',
  ir_csll: 'ir_csll_percent', comissao: 'commission_percent', propaganda: 'marketing_percent', frete: 'freight_percent',
  inadimplencia: 'default_rate_percent', custo_financeiro: 'financial_cost_percent',
  desconto_a_vista: 'cash_discount_percent', margem_lucro: 'profit_margin_percent',
};

const BASE_FIELDS = [
  { field: 'sales_target', label: 'Meta de venda do canal', format: 'money' },
  { field: 'fixed_cost_share_percent', label: 'Apropriação custo fixo', format: 'percent' },
  { field: 'prolabore_share_percent', label: 'Apropriação pró-labore', format: 'percent' },
  { field: 'payroll_share_percent', label: 'Apropriação salário', format: 'percent' },
];

const Row = ({ label, children, strong }) => (
  <tr className={strong ? 'total' : undefined}>
    <td className="cell">{label}</td>
    {children}
  </tr>
);

// ----------------------------------------------------------------------------- tabela de preços (todos)
const PriceMatrix = ({ painel, onOpen }) => (
  <SheetFrame>
    <table className="sheet min-w-[860px]">
      <thead>
        <tr>
          <th className="text-left sticky-col">Modelo</th>
          <th className="text-right">Custo de compra</th>
          {painel.canais.map((c) => <th key={c.id} className="text-right">{c.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {painel.produtos.map((p, i) => (
          <tr key={p.id}>
            <td className="cell sticky-col bg-surface"><span className="text-ink-3 mr-2 num">{i + 1}</span><span className="font-medium">{p.sku || p.name}</span></td>
            <CalcCell value={p.itens > 0 ? p.custo : null} />
            {painel.canais.map((c) => {
              const x = painel.precos.find((pr) => pr.product_id === p.id && pr.channel_id === c.id);
              return (
                <td key={c.id} className="cell text-right">
                  <button className="w-full text-right hover:text-brand" onClick={() => onOpen(p.id, c.id)} title={x?.motivo || 'Abrir o markup'}>
                    {x?.status === 'OK' ? (
                      <>
                        <span className="block font-semibold num">{brl(x.preco_venda_com_ipi)}</span>
                        <span className="block text-[11px] text-ink-3 num">{qty(x.quantidade_mes, 0)} un./mês · {pct(x.total_percentual)}</span>
                      </>
                    ) : <span className="text-xs text-ink-3">{STATUS_LABEL[x?.status] || '—'}</span>}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </SheetFrame>
);

// ----------------------------------------------------------------------------- aba
const MarkupSheet = ({ ctx }) => {
  const { painel, selection, setSelection, savePainel, setFeedback, goTo } = ctx;
  const [view, setView] = useState('um');
  const [simulating, setSimulating] = useState(false);
  const [sim, setSim] = useState({ channel: {} });

  const overrides = useMemo(() => {
    if (!simulating) return undefined;
    const o = {};
    if (Object.keys(sim.channel).length > 0) o.channel = sim.channel;
    if (sim.allocation_percent !== undefined) o.allocation_percent = sim.allocation_percent;
    if (sim.ipi_tier !== undefined) o.ipi_tier = sim.ipi_tier;
    return Object.keys(o).length > 0 ? o : undefined;
  }, [simulating, sim]);

  const { result, loading } = usePriceCalc({ ...selection, overrides, version: painel, setFeedback });

  if (painel.produtos.length === 0 || painel.canais.length === 0) {
    return <Alert tone="info">Para calcular o markup é preciso ter ao menos um canal (aba Painel) e um modelo (aba Fichas técnicas).</Alert>;
  }

  const changed = (field) => simulating && sim.channel[field] !== undefined;

  /** Edição de um campo do canal: grava no painel, ou só simula. */
  const setChannelField = (field, value) => {
    if (simulating) setSim((s) => ({ ...s, channel: { ...s.channel, [field]: value } }));
    else savePainel({ canais: [{ id: selection.channelId, [field]: value }] });
  };
  const setAllocation = (value) => {
    if (simulating) setSim((s) => ({ ...s, allocation_percent: value }));
    else savePainel({ produtos: [{ id: selection.productId, allocation_percent: value }] });
  };
  const setTier = (tier) => {
    if (simulating) setSim((s) => ({ ...s, ipi_tier: tier }));
    else savePainel({ faixas_ipi: [{ product_id: selection.productId, channel_id: selection.channelId, ipi_tier: tier }] });
  };

  const saveSimulation = async () => {
    const body = {};
    if (Object.keys(sim.channel).length > 0) body.canais = [{ id: selection.channelId, ...sim.channel }];
    if (sim.allocation_percent !== undefined) body.produtos = [{ id: selection.productId, allocation_percent: sim.allocation_percent }];
    if (sim.ipi_tier !== undefined) body.faixas_ipi = [{ product_id: selection.productId, channel_id: selection.channelId, ipi_tier: sim.ipi_tier }];
    const saved = await savePainel(body);
    if (saved) {
      setSim({ channel: {} });
      setSimulating(false);
      setFeedback({ tone: 'success', text: 'Simulação gravada no painel. Os valores do canal valem para todos os modelos dele.' });
    }
  };

  const m = result?.markup;
  const canal = result?.canal;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Markup</h2>
          <p className="text-[13px] text-ink-2 mt-0.5">Preço de venda sugerido = preço de compra ÷ (1 − total dos encargos sobre a venda).</p>
        </div>
        <Tabs value={view} onChange={setView} items={[{ id: 'um', label: 'Um modelo em um canal' }, { id: 'canais', label: 'Comparar canais' }, { id: 'todos', label: 'Tabela de preços' }]} />
      </div>

      {view === 'canais' && (
        <>
          <Field label="Modelo" className="max-w-md">
            <Select value={selection.productId ?? ''} onChange={(e) => setSelection({ ...selection, productId: Number(e.target.value) })}>
              {painel.produtos.map((p, i) => <option key={p.id} value={p.id}>{i + 1} · {p.sku ? `${p.sku} — ` : ''}{p.name}</option>)}
            </Select>
          </Field>
          <p className="text-[13px] text-ink-2">As abas MARKUP e TRIBUTOS de cada canal, lado a lado, para o mesmo modelo: onde o preço sobe, onde o imposto pesa e qual canal dá mais lucro no mês.</p>
          <ChannelComparison painel={painel} productId={selection.productId} version={painel} />
        </>
      )}

      {view === 'canais' ? null : view === 'todos' ? (
        <>
          <PriceMatrix painel={painel} onOpen={(productId, channelId) => { setSelection({ productId, channelId }); setView('um'); }} />
          <p className="text-xs text-ink-3">Preço com IPI. Clique em uma célula para abrir o markup daquele modelo e canal.</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <ModelChannelPicker painel={painel} selection={selection} setSelection={(s) => { setSelection(s); setSim({ channel: {} }); }} />
            <div className="flex flex-wrap items-center gap-3">
              <Toggle
                checked={simulating}
                onChange={(v) => { setSimulating(v); if (!v) setSim({ channel: {} }); }}
                label="Modo simulação"
                description={simulating ? 'Mudanças não são gravadas' : 'Mudanças são gravadas no painel'}
              />
              {simulating && overrides && (
                <>
                  <Button size="sm" icon={RotateCcw} onClick={() => setSim({ channel: {} })}>Desfazer</Button>
                  <Button size="sm" variant="primary" icon={Save} onClick={saveSimulation}>Gravar no painel</Button>
                </>
              )}
            </div>
          </div>

          {simulating && <Alert tone="info">Simulação ligada: os valores alterados aparecem em destaque e não mudam o painel até você clicar em “Gravar no painel”.</Alert>}

          {!result && loading && <Loading label="Calculando…" />}

          {m && canal && m.status === 'OK' && (
            <Card>
              <CardHeader title="Como este preço se forma" description="O mesmo cálculo da aba MARKUP da planilha, passo a passo." />
              <PriceFlow m={m} />
              <div className="mt-5">
                <p className="text-sm font-medium text-ink mb-2">De cada {brl(m.preco_venda_sugerido)} do preço sugerido</p>
                <CompositionBar m={m} />
              </div>
            </Card>
          )}

          {m && canal && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              {/* ENCARGOS */}
              <div className="space-y-3">
                <SheetFrame>
                  <table className="sheet">
                    <thead>
                      <tr><th className="text-left">Base do canal</th><th className="text-right w-[170px]">Valor</th></tr>
                    </thead>
                    <tbody>
                      {BASE_FIELDS.map((b) => (
                        <tr key={b.field}>
                          <td className="cell">{b.label} {changed(b.field) && <Badge tone="brand">simulado</Badge>}</td>
                          <NumberCell value={Number(canal[b.field] || 0)} format={b.format} label={b.label} onCommit={(v) => setChannelField(b.field, v)} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SheetFrame>

                <SheetFrame>
                  <table className="sheet">
                    <thead>
                      <tr><th className="text-left">Encargos sobre a venda</th><th className="text-right w-[150px]">Valor</th><th className="text-right w-[120px]">Repres.</th></tr>
                    </thead>
                    <tbody>
                      {m.encargos.map((e) => {
                        const field = FIELD_BY_ENCARGO[e.key];
                        return (
                          <tr key={e.key}>
                            <td className="cell">
                              {e.label}
                              {e.origem === 'rateio' && <span className="ml-2 text-[11px] text-ink-3">rateio</span>}
                              {field && changed(field) && <Badge tone="brand" className="ml-2">simulado</Badge>}
                            </td>
                            <CalcCell value={e.valor} />
                            {field
                              ? <NumberCell value={e.percentual} format="percent" label={e.label} onCommit={(v) => setChannelField(field, v)} />
                              : <CalcCell value={e.percentual} format="percent" title="Calculado: estrutura do canal × rateio do modelo ÷ valor de venda atribuído" />}
                          </tr>
                        );
                      })}
                      <tr className="total">
                        <td className="cell">Total</td>
                        <td className="cell" />
                        <td className="cell text-right num">{pct(m.total_percentual)}</td>
                      </tr>
                    </tbody>
                  </table>
                </SheetFrame>
                <p className="text-xs text-ink-3">
                  As linhas “rateio” não são digitadas: são o total mensal × apropriação do canal × rateio do modelo, divididos pelo valor de venda atribuído.
                  {!simulating && ' Mudar um percentual aqui muda o canal no painel e vale para todos os modelos dele.'}
                </p>
              </div>

              {/* RESULTADO */}
              <div className="space-y-3">
                <SheetFrame>
                  <table className="sheet">
                    <tbody>
                      <Row label="Rateio do modelo">
                        <NumberCell value={Number(result.produto.allocation_percent)} format="percent" disabled={result.parametros.rateio_total} label="Rateio do modelo" onCommit={setAllocation} />
                      </Row>
                      <Row label="Faixa do IPI (1 ou 2)">
                        <SelectCell value={m.ipi_faixa} label="Faixa do IPI" onChange={(v) => setTier(Number(v))}>
                          <option value={1}>1 — {pct(Number(canal.ipi_tier1_percent))}</option>
                          <option value={2}>2 — {pct(Number(canal.ipi_tier2_percent))}</option>
                        </SelectCell>
                      </Row>
                      <Row label="Valor de venda atribuído"><CalcCell value={m.valor_venda_atribuido} /></Row>
                      <Row label={`Preço de compra (${REGIME_LABEL[result.regime]})`}><CalcCell value={m.preco_compra} /></Row>
                    </tbody>
                  </table>
                </SheetFrame>

                {m.status === 'OK' ? (
                  <>
                    <div className="rounded-xl border border-brand bg-brand-soft p-5 text-center">
                      <p className="text-xs font-medium text-ink-2">Preço de venda sugerido</p>
                      <p className="text-4xl font-semibold text-ink num mt-1">{brl(m.preco_venda_sugerido)}</p>
                      <p className="text-xs text-ink-2 mt-2 num">{brl(m.preco_compra)} ÷ (1 − {pct(m.total_percentual)}) · divisor {m.divisor.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</p>
                    </div>
                    <SheetFrame>
                      <table className="sheet">
                        <tbody>
                          <Row label={`IPI (${pct(m.ipi_percentual)})`}><CalcCell value={m.ipi_valor} /></Row>
                          <Row label="Preço de venda com IPI"><CalcCell value={m.preco_venda_com_ipi} strong /></Row>
                          <Row label={`Valor somado c/ desconto ${pct(m.desconto_fora_percentual, 0)} p/ fora`}><CalcCell value={m.valor_com_desconto_fora} /></Row>
                          <Row label="Desconto"><CalcCell value={m.desconto_fora_valor} /></Row>
                          <Row label="Valor de venda líquido"><CalcCell value={m.valor_venda_liquido} /></Row>
                          <Row label="Quantidade produzida por mês"><CalcCell value={m.quantidade_mes} format="qty" /></Row>
                          <Row label="Lucro antes do IR/CS (por unidade)"><CalcCell value={m.lucro.antes_ir_cs} /></Row>
                          <Row label={`IR/CS (${pct(result.parametros.ir_percent + result.parametros.csll_percent, 0)} do lucro)`}><CalcCell value={m.lucro.ir_cs} /></Row>
                          <Row label="Lucro líquido por unidade"><CalcCell value={m.lucro.liquido_unitario} strong /></Row>
                          <Row label="Lucro líquido no mês" strong><td className="cell text-right num">{money(m.lucro.liquido_total)}</td></Row>
                        </tbody>
                      </table>
                    </SheetFrame>
                    <Button variant="ghost" size="sm" onClick={() => goTo('tributos')}>Ver os tributos deste preço →</Button>
                  </>
                ) : (
                  <Alert tone="warning" title={STATUS_LABEL[m.status]}>
                    {m.motivo}
                    {m.status === 'SEM_BASE' && ' Na planilha aparece #DIV/0!. Informe a meta de venda do canal e o rateio do modelo (ou ligue “Rateio total” no Painel).'}
                    {m.status === 'SEM_CUSTO' && ' Preencha a ficha técnica do modelo.'}
                  </Alert>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MarkupSheet;
