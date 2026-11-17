// ARQUIVO: src/pages/PricingSimulator.jsx
// Simulador de preços = planilhas MARKUP <canal> <modelo> e TRIBUTOS <canal> <modelo>.
// A tela não calcula nada: cada alteração é enviada ao backend, que devolve o
// markup e os tributos com as fórmulas das planilhas.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calculator, Tag, Package, Globe, Loader2, AlertCircle, RotateCcw, Save, Landmark, Table2, CheckCircle2, X, AlertTriangle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { createPricingApi, errorMessage } from '../services/pricingApi';
import { brl, pct, qty, toNumber, REGIME_LABEL, STATUS_LABEL } from '../utils/format';

// Linha do markup → campo do canal que o usuário pode simular.
const FIELD_BY_ENCARGO = {
  icms: 'icms_out_percent', difal: 'difal_out_percent', pis: 'pis_out_percent', cofins: 'cofins_out_percent',
  ir_csll: 'ir_csll_percent', comissao: 'commission_percent', propaganda: 'marketing_percent', frete: 'freight_percent',
  inadimplencia: 'default_rate_percent', custo_financeiro: 'financial_cost_percent',
  desconto_a_vista: 'cash_discount_percent', margem_lucro: 'profit_margin_percent',
};

const BASE_FIELDS = [
  { field: 'sales_target', label: 'Meta de venda do canal', money: true },
  { field: 'fixed_cost_share_percent', label: 'Apropriação custo fixo' },
  { field: 'prolabore_share_percent', label: 'Apropriação pró-labore' },
  { field: 'payroll_share_percent', label: 'Apropriação salário' },
];

const VIEWS = [
  { id: 'simulador', label: 'Markup', icon: Calculator },
  { id: 'tabela', label: 'Tabela de preços', icon: Table2 },
];

const inputValue = (v) => (v === null || v === undefined || v === '' ? '' : String(Number(v)).replace('.', ','));
const money = (v) => brl(v).replace('R$', '').trim();

const SmallInput = ({ value, onChange, changed, className = 'w-20', ...props }) => (
  <input
    type="text" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
    className={`${className} text-right bg-transparent font-mono font-bold text-sm outline-none border-b py-0.5 focus:border-blue-500 ${changed ? 'text-blue-600 border-blue-400' : 'text-slate-800 border-slate-200'}`}
    {...props}
  />
);

const Row = ({ label, value, strong = false, tone = 'text-slate-700' }) => (
  <div className={`flex justify-between items-center py-2 ${strong ? 'border-t border-dashed border-slate-200 mt-1 pt-3' : ''}`}>
    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
    <span className={`font-mono font-black ${strong ? 'text-base' : 'text-sm'} ${tone}`}>{value}</span>
  </div>
);

const PricingSimulator = ({ apiBase, selectedCompanyId }) => {
  const api = useMemo(() => createPricingApi(apiBase), [apiBase]);

  const [view, setView] = useState('simulador');
  const [painel, setPainel] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');

  const [result, setResult] = useState(null);
  const [overrides, setOverrides] = useState({ channel: {} }); // strings digitadas
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const requestId = useRef(0);

  const hasOverrides = Object.keys(overrides.channel).length > 0 || overrides.allocation_percent !== undefined || overrides.ipi_tier !== undefined;

  // --- painel (lista de produtos, canais e tabela de preços) ---
  const loadPainel = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      const res = await api.get('/pricing/painel', { params: { companyId: selectedCompanyId } });
      setPainel(res.data);
    } catch (error) {
      setFeedback({ type: 'erro', text: errorMessage(error, 'Erro ao carregar produtos e canais.') });
    }
  }, [api, selectedCompanyId]);

  useEffect(() => {
    setPainel(null); setResult(null); setSelectedProduct(''); setSelectedChannel(''); setOverrides({ channel: {} }); setFeedback(null);
    loadPainel();
  }, [loadPainel]);

  // --- cálculo (gravado ou simulado) ---
  const numericOverrides = useCallback((o) => {
    const out = {};
    const channel = Object.fromEntries(Object.entries(o.channel).map(([f, v]) => [f, toNumber(v)]));
    if (Object.keys(channel).length > 0) out.channel = channel;
    if (o.allocation_percent !== undefined) out.allocation_percent = toNumber(o.allocation_percent);
    if (o.ipi_tier !== undefined) out.ipi_tier = o.ipi_tier;
    return out;
  }, []);

  const calculate = useCallback(async (productId, channelId, o) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const body = numericOverrides(o);
      const res = Object.keys(body).length > 0
        ? await api.post('/pricing/simulate', { productId, channelId, overrides: body })
        : await api.get('/price-calc', { params: { productId, channelId } });
      if (id === requestId.current) setResult(res.data);
    } catch (error) {
      if (id === requestId.current) setFeedback({ type: 'erro', text: errorMessage(error, 'Erro ao calcular o preço.') });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [api, numericOverrides]);

  // Troca de produto/canal: descarta a simulação e busca o cálculo gravado.
  useEffect(() => {
    setOverrides({ channel: {} });
    if (!selectedProduct || !selectedChannel) { setResult(null); return; }
    calculate(selectedProduct, selectedChannel, { channel: {} });
  }, [selectedProduct, selectedChannel, calculate]);

  // Edição: recalcula no backend 350 ms depois da última tecla.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return undefined; }
    if (!selectedProduct || !selectedChannel || !hasOverrides) return undefined;
    const timer = setTimeout(() => calculate(selectedProduct, selectedChannel, overrides), 350);
    return () => clearTimeout(timer);
  }, [overrides]); // eslint-disable-line react-hooks/exhaustive-deps

  const editChannel = (field, value) => setOverrides((o) => ({ ...o, channel: { ...o.channel, [field]: value } }));
  const resetSimulation = () => { setOverrides({ channel: {} }); calculate(selectedProduct, selectedChannel, { channel: {} }); };

  /** Grava no painel de rateio os valores simulados deste canal/modelo. */
  const saveSimulation = async () => {
    setSaving(true);
    try {
      const body = numericOverrides(overrides);
      await api.put('/pricing/painel', {
        company_id: selectedCompanyId,
        canais: body.channel ? [{ id: Number(selectedChannel), ...body.channel }] : [],
        produtos: body.allocation_percent !== undefined ? [{ id: Number(selectedProduct), allocation_percent: body.allocation_percent }] : [],
        faixas_ipi: body.ipi_tier !== undefined ? [{ product_id: Number(selectedProduct), channel_id: Number(selectedChannel), ipi_tier: body.ipi_tier }] : [],
      });
      setOverrides({ channel: {} });
      await Promise.all([loadPainel(), calculate(selectedProduct, selectedChannel, { channel: {} })]);
      setFeedback({ type: 'ok', text: 'Valores gravados no painel de rateio. Eles passam a valer para todos os modelos deste canal.' });
    } catch (error) {
      setFeedback({ type: 'erro', text: errorMessage(error, 'Erro ao gravar no painel.') });
    } finally {
      setSaving(false);
    }
  };

  if (!selectedCompanyId) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-slate-300">
        <Calculator size={64} className="mb-4 opacity-20" />
        <p className="font-black uppercase tracking-widest text-xs">Selecione uma empresa para iniciar</p>
      </div>
    );
  }

  const m = result?.markup;
  const t = result?.tributos;
  const canal = result?.canal;
  const valueOf = (field) => (overrides.channel[field] !== undefined ? overrides.channel[field] : inputValue(canal?.[field]));

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-32">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter italic flex items-center gap-3"><Tag className="text-blue-600" size={34} /> Simulador de Preços</h1>
          <p className="text-slate-400 font-medium text-xs mt-2 uppercase tracking-widest ml-1">
            Markup divisor: preço = custo de compra ÷ (1 − encargos sobre a venda){painel ? ` · ${REGIME_LABEL[painel.regime]}` : ''}
          </p>
        </div>
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === v.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><v.icon size={14} /> {v.label}</button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className={`flex items-start justify-between gap-3 p-4 rounded-2xl border text-sm font-bold ${feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
          <span className="flex items-start gap-2">{feedback.type === 'ok' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}{feedback.text}</span>
          <button onClick={() => setFeedback(null)} aria-label="Fechar aviso"><X size={16} /></button>
        </div>
      )}

      {/* ===================== TABELA DE PREÇOS ===================== */}
      {view === 'tabela' && painel && (
        <Card noPadding className="overflow-hidden">
          {painel.produtos.length === 0 || painel.canais.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500 font-medium">Cadastre produtos e canais (ou carregue as planilhas em Gestão Financeira) para ver a tabela de preços.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="text-left px-5 py-4">Modelo</th>
                    <th className="text-right px-4 py-4">Custo de compra</th>
                    {painel.canais.map((c) => <th key={c.id} className="text-right px-4 py-4 min-w-[170px]">{c.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {painel.produtos.map((p, index) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <p className="font-black text-slate-800 text-xs"><span className="text-slate-400 font-mono mr-2">{index + 1}</span>{p.sku || '—'}</p>
                        <p className="text-[11px] text-slate-500 font-medium truncate max-w-[300px]">{p.name}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{p.itens > 0 ? brl(p.custo) : '—'}</td>
                      {painel.canais.map((c) => {
                        const preco = painel.precos.find((x) => x.product_id === p.id && x.channel_id === c.id);
                        return (
                          <td key={c.id} className="px-4 py-3 text-right">
                            <button onClick={() => { setSelectedProduct(String(p.id)); setSelectedChannel(String(c.id)); setView('simulador'); }} className="text-right hover:opacity-70" title="Abrir o markup deste modelo neste canal">
                              {preco?.status === 'OK' ? (
                                <>
                                  <p className="font-mono font-black text-slate-900">{brl(preco.preco_venda_com_ipi)}</p>
                                  <p className="text-[10px] font-bold text-slate-400">{qty(preco.quantidade_mes, 0)} un./mês · encargos {pct(preco.total_percentual)}</p>
                                </>
                              ) : (
                                <p className="text-[11px] font-bold text-slate-400" title={preco?.motivo || ''}>{STATUS_LABEL[preco?.status] || '—'}</p>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-5 py-3 text-[11px] text-slate-400 font-medium border-t border-slate-100">Preço de venda sugerido com IPI. “Sem base de rateio” equivale ao #DIV/0! da planilha: canal sem meta de venda ou modelo com 0% de rateio.</p>
        </Card>
      )}

      {/* ===================== MARKUP ===================== */}
      {view === 'simulador' && (
        <>
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1" htmlFor="sim-produto">Produto (ficha técnica)</label>
                <div className="relative">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select id="sim-produto" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-700 text-sm outline-none focus:border-blue-500 cursor-pointer">
                    <option value="">Selecione o produto…</option>
                    {(painel?.produtos ?? []).map((p) => <option key={p.id} value={p.id}>{p.sku ? `${p.sku} — ` : ''}{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block ml-1" htmlFor="sim-canal">Canal de venda</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select id="sim-canal" value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-700 text-sm outline-none focus:border-blue-500 cursor-pointer">
                    <option value="">Selecione o canal…</option>
                    {(painel?.canais ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {!result && loading && (
            <div className="h-48 flex flex-col items-center justify-center text-blue-600"><Loader2 size={36} className="animate-spin mb-3" /><p className="font-black uppercase tracking-widest text-[10px]">Calculando…</p></div>
          )}

          {result && m && (
            <>
              {/* barra de simulação */}
              <div className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border ${hasOverrides ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className={`text-xs font-bold ${hasOverrides ? 'text-blue-700' : 'text-slate-500'}`}>
                  {hasOverrides ? 'Simulação: os valores em azul ainda não foram gravados.' : 'Valores gravados no painel de rateio. Edite qualquer campo para simular.'}
                  {loading && <Loader2 size={12} className="inline animate-spin ml-2" />}
                </p>
                {hasOverrides && (
                  <div className="flex gap-2">
                    <button onClick={resetSimulation} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50"><RotateCcw size={13} /> Voltar ao gravado</button>
                    <button onClick={saveSimulation} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Gravar no painel</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ENCARGOS SOBRE A VENDA */}
                <div className="lg:col-span-7 space-y-6">
                  <Card noPadding className="overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {BASE_FIELDS.map((b) => (
                        <label key={b.field} className="flex flex-col justify-between">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{b.label}</span>
                          <span className="flex items-center gap-1">
                            {b.money && <span className="text-[10px] font-bold text-slate-400">R$</span>}
                            <SmallInput value={valueOf(b.field)} onChange={(v) => editChannel(b.field, v)} changed={overrides.channel[b.field] !== undefined} aria-label={b.label} className="w-full" />
                            {!b.money && <span className="text-[10px] font-bold text-slate-400">%</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="text-left px-6 py-3">Encargos sobre a venda</th>
                          <th className="text-right px-4 py-3">Valor</th>
                          <th className="text-right px-6 py-3">Repres.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.encargos.map((e) => {
                          const field = FIELD_BY_ENCARGO[e.key];
                          return (
                            <tr key={e.key} className={`border-b border-slate-50 ${e.grupo === 'margem' ? 'bg-emerald-50/50' : ''}`}>
                              <td className="px-6 py-2.5">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{e.label}</span>
                                {e.origem === 'rateio' && <span className="ml-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">rateio</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-slate-500">{brl(e.valor)}</td>
                              <td className="px-6 py-2.5 text-right">
                                {field ? (
                                  <span className="inline-flex items-center gap-1">
                                    <SmallInput value={valueOf(field)} onChange={(v) => editChannel(field, v)} changed={overrides.channel[field] !== undefined} aria-label={e.label} />
                                    <span className="text-[10px] font-bold text-slate-400">%</span>
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-sm text-slate-700">{pct(e.percentual)}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-900">
                          <td className="px-6 py-3.5 text-xs font-black text-white uppercase tracking-widest" colSpan={2}>Total</td>
                          <td className="px-6 py-3.5 text-right font-mono font-black text-white">{pct(m.total_percentual)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="px-6 py-3 text-[11px] text-slate-400 font-medium">
                      Pró-labore, despesas fixas e salários não são digitados: são o total mensal × apropriação do canal × rateio do modelo, divididos pelo valor de venda atribuído.
                    </p>
                  </Card>
                </div>

                {/* RESULTADO */}
                <div className="lg:col-span-5 space-y-6">
                  <Card className={m.status === 'OK' ? 'border-2 border-emerald-100' : 'border-2 border-amber-100 bg-amber-50/40'}>
                    <div className="grid grid-cols-2 gap-4 pb-4 mb-2 border-b border-slate-100">
                      <label className="block">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Rateio do modelo</span>
                        <span className="flex items-center gap-1">
                          <SmallInput
                            value={overrides.allocation_percent !== undefined ? overrides.allocation_percent : inputValue(result.produto.allocation_percent)}
                            onChange={(v) => setOverrides((o) => ({ ...o, allocation_percent: v }))}
                            changed={overrides.allocation_percent !== undefined} disabled={result.parametros.rateio_total} aria-label="Rateio do modelo" className="w-full disabled:opacity-40"
                          />
                          <span className="text-[10px] font-bold text-slate-400">%</span>
                        </span>
                        {result.parametros.rateio_total && <span className="text-[10px] text-slate-400 font-medium">“Rateio total” ligado: vale 100%</span>}
                      </label>
                      <label className="block">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Faixa do IPI</span>
                        <select value={overrides.ipi_tier ?? m.ipi_faixa} onChange={(e) => setOverrides((o) => ({ ...o, ipi_tier: Number(e.target.value) }))} className={`w-full bg-transparent font-bold text-sm outline-none border-b py-1 cursor-pointer ${overrides.ipi_tier !== undefined ? 'text-blue-600 border-blue-400' : 'text-slate-800 border-slate-200'}`}>
                          <option value={1}>Faixa 1 — {pct(Number(canal.ipi_tier1_percent))}</option>
                          <option value={2}>Faixa 2 — {pct(Number(canal.ipi_tier2_percent))}</option>
                        </select>
                      </label>
                    </div>

                    <Row label="Valor de venda atribuído" value={brl(m.valor_venda_atribuido)} />
                    <Row label={`Preço de compra (${REGIME_LABEL[result.regime]})`} value={brl(m.preco_compra)} />

                    {m.status === 'OK' ? (
                      <>
                        <div className="text-center py-6">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Preço de venda sugerido</p>
                          <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{brl(m.preco_venda_sugerido)}</h2>
                          <p className="text-[11px] font-bold text-slate-400 mt-3">{brl(m.preco_compra)} ÷ (1 − {pct(m.total_percentual)}) · divisor {m.divisor.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</p>
                        </div>
                        <Row label={`IPI (${pct(m.ipi_percentual)})`} value={brl(m.ipi_valor)} />
                        <Row label="Preço de venda com IPI" value={brl(m.preco_venda_com_ipi)} tone="text-slate-900" />
                        <Row label={`Valor com desconto de ${pct(m.desconto_fora_percentual, 0)} p/ fora`} value={brl(m.valor_com_desconto_fora)} />
                        <Row label="Desconto" value={`− ${brl(m.desconto_fora_valor)}`} tone="text-rose-500" />
                        <Row label="Valor de venda líquido" value={brl(m.valor_venda_liquido)} />
                        <Row label="Quantidade produzida / mês" value={qty(m.quantidade_mes)} strong />
                        <Row label="Lucro antes do IR/CS (un.)" value={brl(m.lucro.antes_ir_cs)} />
                        <Row label="IR / CSLL (un.)" value={`− ${brl(m.lucro.ir_cs)}`} tone="text-rose-500" />
                        <Row label="Lucro líquido por unidade" value={brl(m.lucro.liquido_unitario)} tone="text-emerald-600" />
                        <Row label="Lucro líquido no mês" value={brl(m.lucro.liquido_total)} tone="text-emerald-600" strong />
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <div className="inline-flex p-4 bg-amber-100 text-amber-600 rounded-full mb-4"><AlertCircle size={30} /></div>
                        <h3 className="text-sm font-black text-amber-700 tracking-tight uppercase">{STATUS_LABEL[m.status]}</h3>
                        <p className="text-slate-600 text-sm font-medium mt-2 max-w-xs mx-auto">{m.motivo}</p>
                        {m.status === 'SEM_BASE' && <p className="text-slate-400 text-[11px] font-medium mt-3">Na planilha esta combinação aparece como #DIV/0!. Informe a meta de venda e o rateio acima para simular.</p>}
                        {m.total_percentual !== null && <p className="text-slate-400 text-[11px] font-bold mt-3">Encargos: {pct(m.total_percentual)}</p>}
                      </div>
                    )}
                  </Card>
                </div>
              </div>

              {/* TRIBUTOS */}
              <Card noPadding className="overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2"><Landmark size={16} className="text-blue-600" /> Tributos por unidade — {REGIME_LABEL[result.regime]}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="text-left px-6 py-3" />
                        {['IPI', 'PIS', 'COFINS', 'DIFAL', 'ICMS', 'Total'].map((h) => <th key={h} className="text-right px-4 py-3">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="font-mono text-slate-700">
                      <tr className="border-b border-slate-50">
                        <td className="px-6 py-3 font-sans text-xs font-bold text-slate-600 uppercase tracking-wide">Venda do produto final<span className="block text-[10px] font-medium normal-case tracking-normal text-slate-400">sobre o preço de {brl(t.venda.preco_venda)}</span></td>
                        {['ipi', 'pis', 'cofins', 'difal', 'icms', 'total'].map((k) => <td key={k} className="px-4 py-3 text-right font-bold">{money(t.venda[k])}{k !== 'total' && <span className="block text-[10px] text-slate-400 font-medium">{pct(t.venda.aliquotas[k])}</span>}</td>)}
                      </tr>
                      <tr className="border-b border-slate-50">
                        <td className="px-6 py-3 font-sans text-xs font-bold text-slate-600 uppercase tracking-wide">Compra (créditos da ficha técnica)<span className="block text-[10px] font-medium normal-case tracking-normal text-slate-400">total sem o ICMS, como na planilha</span></td>
                        <td className="px-4 py-3 text-right font-bold">{money(t.compra.ipi)}</td>
                        <td className="px-4 py-3 text-right font-bold">{money(t.compra.pis)}</td>
                        <td className="px-4 py-3 text-right font-bold">{money(t.compra.cofins)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">—</td>
                        <td className="px-4 py-3 text-right font-bold">{money(t.compra.icms)}</td>
                        <td className="px-4 py-3 text-right font-bold">{money(t.compra.total)}</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="px-6 py-3 font-sans text-xs font-black text-slate-800 uppercase tracking-wide">Imposto devido</td>
                        {['ipi', 'pis', 'cofins', 'difal', 'icms', 'total_impostos'].map((k) => <td key={k} className="px-4 py-3 text-right font-black text-slate-900">{t.devido ? money(t.devido[k]) : '—'}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {t.devido && (
                  <div className="px-6 py-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">IR ({pct(result.parametros.ir_percent, 0)} do lucro)</p><p className="font-mono font-black text-slate-800">{brl(t.devido.ir)}</p></div>
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CSLL ({pct(result.parametros.csll_percent, 0)} do lucro)</p><p className="font-mono font-black text-slate-800">{brl(t.devido.csll)}</p></div>
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total devido por unidade</p><p className="font-mono font-black text-slate-900">{brl(t.devido.total)}</p></div>
                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alíquota efetiva</p><p className="font-mono font-black text-blue-600">{pct(t.devido.aliquota_efetiva)}</p></div>
                  </div>
                )}
              </Card>
            </>
          )}

          {!result && !loading && (
            <div className="h-48 flex flex-col items-center justify-center text-slate-300">
              <Calculator size={48} className="mb-3 opacity-30" />
              <p className="font-black uppercase tracking-widest text-[10px]">Escolha um produto e um canal</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PricingSimulator;
