// ARQUIVO: src/pages/CostManagement.jsx
// Gestão Financeira = planilhas CUSTO FIXO, FOLHA, PRO-LABORE e PAINEL DE RATEIO.
// Nenhuma conta é feita aqui: os totais, a apropriação por canal e os preços vêm do backend.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, Users, Briefcase, Wallet, Plus, Trash2, Save, RefreshCw, AlertTriangle,
  SlidersHorizontal, FileSpreadsheet, Loader2, CheckCircle2, X, Settings2,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { createPricingApi, errorMessage } from '../services/pricingApi';
import { brl, pct, toNumber, REGIME_LABEL, STATUS_LABEL } from '../utils/format';

// Linhas digitáveis do PAINEL, na ordem da planilha.
const PAINEL_ROWS = [
  { field: 'fixed_cost_share_percent', label: 'Apropriação custo fixo', sum: 'pct', group: 'Rateio da estrutura' },
  { field: 'prolabore_share_percent', label: 'Apropriação pró-labore', sum: 'pct' },
  { field: 'payroll_share_percent', label: 'Apropriação salário', sum: 'pct' },
  { field: 'sales_target', label: 'Meta de venda', money: true, sum: 'brl' },
  { field: 'profit_margin_percent', label: 'Lucro', group: 'Encargos sobre a venda' },
  { field: 'icms_out_percent', label: 'ICMS' },
  { field: 'difal_out_percent', label: 'DIFAL' },
  { field: 'pis_out_percent', label: 'PIS' },
  { field: 'cofins_out_percent', label: 'COFINS' },
  { field: 'ir_csll_percent', label: 'IR / CSLL' },
  { field: 'commission_percent', label: 'Comissão vendas' },
  { field: 'marketing_percent', label: 'Propaganda' },
  { field: 'freight_percent', label: 'Frete da entrega' },
  { field: 'default_rate_percent', label: 'Inadimplência' },
  { field: 'financial_cost_percent', label: 'Custo financeiro' },
  { field: 'cash_discount_percent', label: 'Desconto à vista (por dentro)' },
  { field: 'ipi_tier1_percent', label: 'IPI — faixa 1', group: 'IPI na saída' },
  { field: 'ipi_tier2_percent', label: 'IPI — faixa 2' },
];

const PARAMETROS = [
  { field: 'pis_credit_percent', label: 'Crédito PIS', hint: 'Ficha técnica' },
  { field: 'cofins_credit_percent', label: 'Crédito COFINS', hint: 'Ficha técnica' },
  { field: 'icms_credit_imported_percent', label: 'ICMS importado', hint: 'Ficha técnica' },
  { field: 'icms_credit_national_percent', label: 'ICMS nacional', hint: 'Ficha técnica' },
  { field: 'ir_percent', label: 'IR', hint: 'Sobre o lucro' },
  { field: 'csll_percent', label: 'CSLL', hint: 'Sobre o lucro' },
  { field: 'outside_discount_percent', label: 'Desconto p/ fora', hint: 'Markup' },
  { field: 'attendance_bonus_percent', label: 'Adic. assiduidade', hint: 'Folha' },
  { field: 'fgts_percent', label: 'FGTS', hint: 'Folha' },
  { field: 'fgts_fine_percent', label: 'Multa FGTS', hint: 'Folha' },
];

const TABS = [
  { id: 'painel', label: 'Painel de Rateio', icon: SlidersHorizontal },
  { id: 'fixed', label: 'Custo Fixo', icon: Building2 },
  { id: 'payroll', label: 'Folha', icon: Users },
  { id: 'prolabore', label: 'Pró-labore', icon: Briefcase },
];

const inputValue = (v) => (v === null || v === undefined || v === '' ? '' : String(Number(v)).replace('.', ','));

const NumInput = ({ value, onChange, className = '', ...props }) => (
  <input
    type="text" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
    className={`w-full bg-transparent text-right font-mono font-bold text-slate-800 text-sm outline-none border-b border-slate-200 focus:border-blue-500 py-1 ${className}`}
    {...props}
  />
);

const CostManagement = ({ apiBase, selectedCompanyId }) => {
  const api = useMemo(() => createPricingApi(apiBase), [apiBase]);

  const [activeTab, setActiveTab] = useState('painel');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'ok' | 'erro', text }

  const [painel, setPainel] = useState(null);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [prolabore, setProlabore] = useState([]);

  // Rascunho do painel (strings digitadas); só vai ao banco em "Salvar painel".
  const [draft, setDraft] = useState({ canais: {}, produtos: {}, faixas: {}, parametros: {} });
  const [dirty, setDirty] = useState(false);

  const [fixedForm, setFixedForm] = useState({ name: '', amount: '' });
  const [proForm, setProForm] = useState({ partner_name: '', total_cost: '' });
  const emptyPay = { employee_name: '', role: '', base_salary: '', overtime: '', bonus: '', commission: '', transport_voucher: '', meal_voucher: '' };
  const [payForm, setPayForm] = useState(emptyPay);

  const [newChannel, setNewChannel] = useState(null); // string enquanto o modal está aberto
  const [importOpen, setImportOpen] = useState(false);
  const [importFiles, setImportFiles] = useState([]);
  const [confirm, setConfirm] = useState({ isOpen: false, title: '', description: '', variant: 'info', onConfirm: () => {} });

  const notify = (type, text) => setFeedback({ type, text });

  const applyPainel = useCallback((data) => {
    setPainel(data);
    const canais = {};
    data.canais.forEach((c) => { canais[c.id] = Object.fromEntries(PAINEL_ROWS.map((r) => [r.field, inputValue(c[r.field])])); });
    const produtos = {};
    const faixas = {};
    data.produtos.forEach((p) => {
      produtos[p.id] = { allocation_percent: inputValue(p.allocation_percent) };
      Object.entries(p.ipi_tiers).forEach(([channelId, tier]) => { faixas[`${p.id}:${channelId}`] = tier; });
    });
    const parametros = Object.fromEntries(PARAMETROS.map((p) => [p.field, inputValue(data.parametros[p.field])]));
    parametros.rateio_total = Boolean(data.parametros.rateio_total);
    setDraft({ canais, produtos, faixas, parametros });
    setDirty(false);
  }, []);

  const loadAll = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const params = { companyId: selectedCompanyId };
      const [resPainel, resFixed, resPay, resPro] = await Promise.all([
        api.get('/pricing/painel', { params }),
        api.get('/fixed-expenses', { params }),
        api.get('/payroll', { params }),
        api.get('/prolabore', { params }),
      ]);
      applyPainel(resPainel.data);
      setFixedExpenses(resFixed.data);
      setPayroll(resPay.data);
      setProlabore(resPro.data);
    } catch (error) {
      notify('erro', errorMessage(error, 'Erro ao carregar os dados de custos.'));
    } finally {
      setLoading(false);
    }
  }, [api, selectedCompanyId, applyPainel]);

  useEffect(() => { setPainel(null); setFeedback(null); loadAll(); }, [loadAll]);

  // ---------------------------------------------------------------- painel
  const editChannel = (id, field, value) => { setDraft((d) => ({ ...d, canais: { ...d.canais, [id]: { ...d.canais[id], [field]: value } } })); setDirty(true); };
  const editProduct = (id, value) => { setDraft((d) => ({ ...d, produtos: { ...d.produtos, [id]: { allocation_percent: value } } })); setDirty(true); };
  const editTier = (productId, channelId, tier) => { setDraft((d) => ({ ...d, faixas: { ...d.faixas, [`${productId}:${channelId}`]: Number(tier) } })); setDirty(true); };
  const editParam = (field, value) => { setDraft((d) => ({ ...d, parametros: { ...d.parametros, [field]: value } })); setDirty(true); };

  const draftSum = (field) => Object.values(draft.canais).reduce((acc, c) => acc + toNumber(c[field]), 0);
  const allocationSum = Object.values(draft.produtos).reduce((acc, p) => acc + toNumber(p.allocation_percent), 0);

  const savePainel = async () => {
    setSaving(true);
    try {
      const parametros = Object.fromEntries(PARAMETROS.map((p) => [p.field, toNumber(draft.parametros[p.field])]));
      parametros.rateio_total = draft.parametros.rateio_total;
      const res = await api.put('/pricing/painel', {
        company_id: selectedCompanyId,
        parametros,
        canais: Object.entries(draft.canais).map(([id, fields]) => ({
          id: Number(id), ...Object.fromEntries(Object.entries(fields).map(([f, v]) => [f, toNumber(v)])),
        })),
        produtos: Object.entries(draft.produtos).map(([id, p]) => ({ id: Number(id), allocation_percent: toNumber(p.allocation_percent) })),
        faixas_ipi: Object.entries(draft.faixas).map(([key, tier]) => {
          const [productId, channelId] = key.split(':').map(Number);
          return { product_id: productId, channel_id: channelId, ipi_tier: tier };
        }),
      });
      applyPainel(res.data);
      const [resPay] = await Promise.all([api.get('/payroll', { params: { companyId: selectedCompanyId } })]);
      setPayroll(resPay.data);
      notify('ok', 'Painel de rateio salvo. Preços recalculados.');
    } catch (error) {
      notify('erro', errorMessage(error, 'Erro ao salvar o painel.'));
    } finally {
      setSaving(false);
    }
  };

  const createChannel = async () => {
    if (!newChannel?.trim()) return;
    try {
      await api.post('/sales-channels', { company_id: selectedCompanyId, name: newChannel.trim() });
      setNewChannel(null);
      await loadAll();
    } catch (error) { notify('erro', errorMessage(error, 'Erro ao criar o canal.')); }
  };

  const askDeleteChannel = (channel) => setConfirm({
    isOpen: true, variant: 'danger',
    title: `Excluir o canal "${channel.name}"?`,
    description: 'As alíquotas, a meta e a apropriação deste canal serão perdidas. Alterações não salvas no painel também serão descartadas.',
    onConfirm: async () => {
      try { await api.delete(`/sales-channels/${channel.id}`); await loadAll(); }
      catch (error) { notify('erro', errorMessage(error, 'Erro ao excluir o canal.')); }
    },
  });

  const runImport = async (substituir) => {
    setImportOpen(false);
    setLoading(true);
    try {
      let res;
      if (importFiles.length > 0) {
        const form = new FormData();
        form.append('companyId', selectedCompanyId);
        form.append('substituir', substituir ? 'true' : 'false');
        importFiles.forEach((f) => form.append('files', f));
        res = await api.post('/pricing/import-planilhas', form);
      } else {
        res = await api.post('/pricing/import-planilhas', { companyId: selectedCompanyId, substituir });
      }
      const r = res.data.resumo;
      notify('ok', `Planilhas carregadas: ${r.canais.criados + r.canais.atualizados} canais, ${r.produtos.criados + r.produtos.atualizados} produtos, `
        + `${r.itens_ficha} itens de ficha, ${r.custos_fixos.criados + r.custos_fixos.atualizados} custos fixos, `
        + `${r.folha.criados + r.folha.atualizados} funcionários, ${r.pro_labore.criados + r.pro_labore.atualizados} pró-labores.`);
      setImportFiles([]);
      await loadAll();
    } catch (error) {
      notify('erro', errorMessage(error, 'Erro ao carregar as planilhas.'));
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------- custos de estrutura
  const submitCost = async (e, endpoint, payload, reset) => {
    e.preventDefault();
    try {
      await api.post(`/${endpoint}`, { ...payload, company_id: selectedCompanyId });
      reset();
      await loadAll();
    } catch (error) { notify('erro', errorMessage(error, 'Erro ao salvar.')); }
  };

  const askDeleteCost = (endpoint, id, name) => setConfirm({
    isOpen: true, variant: 'danger',
    title: `Remover "${name}"?`,
    description: 'O valor sai do total mensal e do rateio dos canais. Não pode ser desfeito.',
    onConfirm: async () => {
      try { await api.delete(`/${endpoint}/${id}`); await loadAll(); }
      catch (error) { notify('erro', errorMessage(error, 'Erro ao remover.')); }
    },
  });

  if (!selectedCompanyId) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400">
        <Wallet size={48} className="mb-4 opacity-20" />
        <p className="font-bold uppercase tracking-widest text-xs">Selecione uma empresa</p>
      </div>
    );
  }

  const totais = painel?.totais_mensais ?? { fixed: 0, payroll: 0, prolabore: 0 };
  const estrutura = totais.fixed + totais.payroll + totais.prolabore;
  const precoDe = (productId, channelId) => painel?.precos.find((p) => p.product_id === productId && p.channel_id === channelId);

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 animate-in fade-in duration-500 pb-32">
      <ConfirmationModal
        isOpen={confirm.isOpen} onClose={() => setConfirm({ ...confirm, isOpen: false })} onConfirm={confirm.onConfirm}
        title={confirm.title} description={confirm.description} variant={confirm.variant}
      />

      {/* CABEÇALHO */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic flex items-center gap-3">
            <Wallet className="text-blue-600" size={32} /> Gestão Financeira
          </h1>
          <p className="text-slate-400 font-medium text-xs mt-1 uppercase tracking-widest">
            Custos de estrutura e painel de rateio {painel && `· ${REGIME_LABEL[painel.regime]}`}
          </p>
        </div>
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex gap-1 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className={`flex items-start justify-between gap-3 p-4 rounded-2xl border text-sm font-bold ${feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
          <span className="flex items-start gap-2">{feedback.type === 'ok' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}{feedback.text}</span>
          <button onClick={() => setFeedback(null)} aria-label="Fechar aviso"><X size={16} /></button>
        </div>
      )}

      {/* TOTAIS MENSAIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Custo fixo', value: totais.fixed, icon: Building2 },
          { label: 'Folha', value: totais.payroll, icon: Users },
          { label: 'Pró-labore', value: totais.prolabore, icon: Briefcase },
          { label: 'Estrutura mensal', value: estrutura, icon: Wallet, strong: true },
        ].map((item) => (
          <div key={item.label} className={`p-5 rounded-3xl border ${item.strong ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 mb-2 ${item.strong ? 'text-slate-300' : 'text-slate-400'}`}><item.icon size={13} /> {item.label}</p>
            <p className={`text-xl font-black font-mono tracking-tight ${item.strong ? 'text-white' : 'text-slate-900'}`}>{brl(item.value)}</p>
          </div>
        ))}
      </div>

      {loading && !painel && (
        <div className="h-48 flex items-center justify-center text-blue-600"><Loader2 className="animate-spin" size={32} /></div>
      )}

      {/* ===================== PAINEL DE RATEIO ===================== */}
      {activeTab === 'painel' && painel && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setNewChannel('')} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50"><Plus size={14} /> Novo canal</button>
              <button onClick={() => setImportOpen(true)} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50"><FileSpreadsheet size={14} /> Carregar planilhas</button>
            </div>
            <div className="flex items-center gap-3">
              {dirty && <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1"><AlertTriangle size={14} /> Alterações não salvas — valores em R$ e preços abaixo são os da última gravação</span>}
              <button onClick={loadAll} disabled={saving} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50" title="Descartar alterações e recarregar"><RefreshCw size={16} /></button>
              <button onClick={savePainel} disabled={!dirty || saving} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar painel
              </button>
            </div>
          </div>

          {painel.avisos.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-xs font-bold space-y-1">
              {painel.avisos.map((a) => <p key={a} className="flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {a}</p>)}
            </div>
          )}

          {painel.canais.length === 0 ? (
            <Card className="text-center">
              <p className="font-black text-slate-700 mb-1">Nenhum canal de venda cadastrado.</p>
              <p className="text-sm text-slate-500">Crie os canais (colunas do painel) ou carregue as planilhas de markup para começar.</p>
            </Card>
          ) : (
            <Card noPadding className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[230px]">Digitável</th>
                      {painel.canais.map((c) => (
                        <th key={c.id} className="px-4 py-4 text-right min-w-[150px]">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{c.name}</span>
                            <button onClick={() => askDeleteChannel(c)} className="text-slate-300 hover:text-rose-500" title="Excluir canal"><Trash2 size={13} /></button>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[130px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAINEL_ROWS.map((row) => {
                      const sum = row.sum ? draftSum(row.field) : null;
                      const sumWrong = row.sum === 'pct' && Math.abs(sum - 100) > 0.005;
                      return (
                        <React.Fragment key={row.field}>
                          {row.group && (
                            <tr><td colSpan={painel.canais.length + 2} className="px-5 pt-5 pb-1 text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">{row.group}</td></tr>
                          )}
                          <tr className="border-b border-slate-50 hover:bg-slate-50/60">
                            <td className="px-5 py-2 text-xs font-bold text-slate-600 uppercase tracking-wide">{row.label}</td>
                            {painel.canais.map((c) => (
                              <td key={c.id} className="px-4 py-2">
                                <div className="flex items-center gap-1">
                                  {row.money && <span className="text-[10px] font-bold text-slate-400">R$</span>}
                                  <NumInput value={draft.canais[c.id]?.[row.field]} onChange={(v) => editChannel(c.id, row.field, v)} aria-label={`${row.label} — ${c.name}`} />
                                  {!row.money && <span className="text-[10px] font-bold text-slate-400">%</span>}
                                </div>
                              </td>
                            ))}
                            <td className={`px-4 py-2 text-right font-mono font-black text-sm ${sumWrong ? 'text-rose-600' : 'text-slate-700'}`}>
                              {row.sum === 'pct' && pct(sum)}{row.sum === 'brl' && brl(sum)}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    <tr><td colSpan={painel.canais.length + 2} className="px-5 pt-5 pb-1 text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">Estrutura apropriada ao canal (calculado)</td></tr>
                    {[
                      { key: 'custo_fixo', label: 'Despesas fixas mensais', total: totais.fixed },
                      { key: 'pro_labore', label: 'Pró-labore', total: totais.prolabore },
                      { key: 'salarios', label: 'Salários fixos mensais', total: totais.payroll },
                    ].map((row) => (
                      <tr key={row.key} className="border-b border-slate-50 bg-slate-50/40">
                        <td className="px-5 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wide">{row.label}</td>
                        {painel.canais.map((c) => (
                          <td key={c.id} className="px-4 py-2.5 text-right font-mono text-xs font-bold text-slate-600">
                            {brl(c.apropriacao[row.key])}
                            <span className="block text-[10px] text-slate-400">{Number(c.sales_target) > 0 ? `${pct((c.apropriacao[row.key] / Number(c.sales_target)) * 100)} da meta` : 'sem meta'}</span>
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-black text-slate-700">{brl(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* RATEIO POR MODELO + PREÇOS */}
          <Card noPadding className="overflow-hidden">
            <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Rateio das despesas fixas por modelo</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Valor de venda atribuído = meta do canal × rateio do modelo. Preço = custo ÷ (1 − encargos).</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={Boolean(draft.parametros.rateio_total)} onChange={(e) => editParam('rateio_total', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Rateio total<span className="block text-[10px] font-medium normal-case tracking-normal text-slate-400">cada modelo absorve 100% da meta e da estrutura</span></span>
              </label>
            </div>
            {painel.produtos.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 font-medium">Nenhum produto cadastrado. Cadastre em “Cadastro / Custos” ou carregue as planilhas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="text-left px-5 py-3">Modelo</th>
                      <th className="text-right px-4 py-3">Custo de compra</th>
                      <th className="text-right px-4 py-3 w-28">Rateio</th>
                      {painel.canais.map((c) => <th key={c.id} className="text-right px-4 py-3 min-w-[170px]">{c.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {painel.produtos.map((p, index) => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <p className="font-black text-slate-800 text-xs"><span className="text-slate-400 font-mono mr-2">{index + 1}</span>{p.sku || '—'}</p>
                          <p className="text-[11px] text-slate-500 font-medium truncate max-w-[280px]">{p.name}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{p.itens > 0 ? brl(p.custo) : <span className="text-[11px] text-amber-600 font-sans">sem ficha</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1"><NumInput value={draft.produtos[p.id]?.allocation_percent} onChange={(v) => editProduct(p.id, v)} disabled={Boolean(draft.parametros.rateio_total)} aria-label={`Rateio — ${p.name}`} className="disabled:opacity-40" /><span className="text-[10px] font-bold text-slate-400">%</span></div>
                        </td>
                        {painel.canais.map((c) => {
                          const preco = precoDe(p.id, c.id);
                          return (
                            <td key={c.id} className="px-4 py-3 text-right">
                              {preco?.status === 'OK'
                                ? <p className="font-mono font-black text-slate-900">{brl(preco.preco_venda_com_ipi)}</p>
                                : <p className="text-[11px] font-bold text-slate-400" title={preco?.motivo || ''}>{STATUS_LABEL[preco?.status] || '—'}</p>}
                              <select value={draft.faixas[`${p.id}:${c.id}`] ?? 2} onChange={(e) => editTier(p.id, c.id, e.target.value)} className="mt-1 text-[10px] font-bold text-slate-500 bg-transparent outline-none cursor-pointer" aria-label={`Faixa de IPI — ${p.name} — ${c.name}`}>
                                <option value={1}>IPI faixa 1</option>
                                <option value={2}>IPI faixa 2</option>
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-slate-50">
                      <td className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest" colSpan={2}>Soma do rateio</td>
                      <td className={`px-4 py-3 text-right font-mono font-black ${!draft.parametros.rateio_total && Math.abs(allocationSum - 100) > 0.005 ? 'text-rose-600' : 'text-slate-700'}`}>{draft.parametros.rateio_total ? '—' : pct(allocationSum)}</td>
                      <td colSpan={painel.canais.length} className="px-4 py-3 text-right text-[10px] font-bold text-slate-400">Preço de venda sugerido com IPI</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* PARÂMETROS */}
          <Card>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-5"><Settings2 size={16} className="text-blue-600" /> Parâmetros das planilhas</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {PARAMETROS.map((p) => (
                <div key={p.field} className="bg-slate-50 rounded-2xl border border-slate-100 p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{p.label}</p>
                  <div className="flex items-center gap-1"><NumInput value={draft.parametros[p.field]} onChange={(v) => editParam(p.field, v)} aria-label={p.label} /><span className="text-[10px] font-bold text-slate-400">%</span></div>
                  <p className="text-[9px] font-medium text-slate-400 mt-1">{p.hint}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ===================== CUSTO FIXO ===================== */}
      {activeTab === 'fixed' && (
        <Card>
          <form onSubmit={(e) => submitCost(e, 'fixed-expenses', { name: fixedForm.name, amount: toNumber(fixedForm.amount) }, () => setFixedForm({ name: '', amount: '' }))} className="flex flex-col md:flex-row gap-2 mb-6">
            <input required placeholder="Despesa fixa (ex.: Aluguel)" value={fixedForm.name} onChange={(e) => setFixedForm({ ...fixedForm, name: e.target.value })} className="flex-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold outline-none focus:border-blue-500" />
            <input required inputMode="decimal" placeholder="Valor mensal R$" value={fixedForm.amount} onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })} className="md:w-44 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold outline-none focus:border-blue-500 text-right" />
            <button className="bg-slate-900 text-white px-5 py-3 rounded-xl hover:bg-black transition flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest"><Plus size={16} /> Adicionar</button>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {fixedExpenses.map((i) => (
              <div key={i.id} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center bg-white hover:border-blue-200 transition group">
                <p className="font-bold text-slate-700 text-xs uppercase">{i.name}</p>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm font-mono text-slate-900">{brl(Number(i.amount))}</span>
                  <button onClick={() => askDeleteCost('fixed-expenses', i.id, i.name)} className="text-slate-300 hover:text-rose-500" aria-label={`Remover ${i.name}`}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {fixedExpenses.length === 0 && <p className="col-span-full text-center text-sm text-slate-400 font-medium py-8">Nenhuma despesa fixa cadastrada.</p>}
          </div>
        </Card>
      )}

      {/* ===================== FOLHA ===================== */}
      {activeTab === 'payroll' && (
        <Card noPadding className="overflow-hidden">
          <form
            onSubmit={(e) => submitCost(e, 'payroll', {
              employee_name: payForm.employee_name, role: payForm.role,
              base_salary: toNumber(payForm.base_salary), overtime: toNumber(payForm.overtime), bonus: toNumber(payForm.bonus),
              commission: toNumber(payForm.commission), transport_voucher: toNumber(payForm.transport_voucher), meal_voucher: toNumber(payForm.meal_voucher),
            }, () => setPayForm(emptyPay))}
            className="p-6 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-2 items-end"
          >
            {[
              { f: 'employee_name', label: 'Nome', span: 'xl:col-span-2', required: true, text: true },
              { f: 'role', label: 'Cargo', text: true },
              { f: 'base_salary', label: 'Salário', required: true },
              { f: 'overtime', label: 'Horas extras' },
              { f: 'bonus', label: 'Gratificação' },
              { f: 'commission', label: 'Comissão' },
              { f: 'transport_voucher', label: 'Vale transp.' },
              { f: 'meal_voucher', label: 'Vale alim.' },
            ].map((field) => (
              <label key={field.f} className={`block ${field.span || ''}`}>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{field.label}</span>
                <input required={field.required} inputMode={field.text ? 'text' : 'decimal'} value={payForm[field.f]} onChange={(e) => setPayForm({ ...payForm, [field.f]: e.target.value })} className={`w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold outline-none focus:border-blue-500 ${field.text ? '' : 'text-right'}`} />
              </label>
            ))}
            <button className="col-span-2 md:col-span-4 xl:col-span-9 bg-slate-900 text-white px-5 py-3 rounded-xl hover:bg-black transition flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest"><Plus size={16} /> Adicionar funcionário (13º, férias, FGTS e multa são calculados)</button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="text-left px-5 py-3 min-w-[220px]">Funcionário</th>
                  {['Salário', 'Assiduid.', 'H. extras', 'Gratif.', 'Comissão', 'Sal+Grat+Com', '13º', 'Férias', '1/3 férias', 'FGTS', 'Multa 40%', 'V. transp.', 'V. alim.', 'Custo'].map((h) => <th key={h} className="text-right px-3 py-3 whitespace-nowrap">{h}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {payroll.map((emp) => {
                  const c = emp.calculo;
                  const cells = c
                    ? [c.salario, c.adicional_assiduidade, c.horas_extras, c.gratificacao, c.comissao, c.remuneracao, c.decimo_terceiro, c.ferias, c.terco_ferias, c.fgts, c.multa_fgts, c.vale_transporte, c.vale_alimentacao]
                    : null;
                  return (
                    <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-5 py-2.5">
                        <p className="font-bold text-slate-800 uppercase">{emp.employee_name}</p>
                        {(emp.role || emp.cost_center) && <p className="text-[10px] text-slate-400 font-medium">{[emp.role, emp.cost_center].filter(Boolean).join(' · ')}</p>}
                      </td>
                      {cells
                        ? cells.map((v, i) => <td key={i} className="px-3 py-2.5 text-right font-mono text-slate-600 whitespace-nowrap">{brl(v).replace('R$', '').trim()}</td>)
                        : <td colSpan={13} className="px-3 py-2.5 text-center text-[11px] text-slate-400 font-medium">custo total informado diretamente (cadastro anterior, sem composição)</td>}
                      <td className="px-3 py-2.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">{brl(emp.total_cost)}</td>
                      <td className="px-3 py-2.5 text-right"><button onClick={() => askDeleteCost('payroll', emp.id, emp.employee_name)} className="text-slate-300 hover:text-rose-500" aria-label={`Remover ${emp.employee_name}`}><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
                {payroll.length === 0 && <tr><td colSpan={16} className="text-center text-sm text-slate-400 font-medium py-8">Nenhum funcionário cadastrado.</td></tr>}
              </tbody>
              {payroll.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-black">
                    <td className="px-5 py-3 text-[10px] text-slate-400 uppercase tracking-widest" colSpan={14}>Total da folha ({payroll.length})</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-900 whitespace-nowrap">{brl(totais.payroll)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* ===================== PRÓ-LABORE ===================== */}
      {activeTab === 'prolabore' && (
        <Card>
          <form onSubmit={(e) => submitCost(e, 'prolabore', { partner_name: proForm.partner_name, total_cost: toNumber(proForm.total_cost) }, () => setProForm({ partner_name: '', total_cost: '' }))} className="flex flex-col md:flex-row gap-2 mb-6">
            <input required placeholder="Sócio" value={proForm.partner_name} onChange={(e) => setProForm({ ...proForm, partner_name: e.target.value })} className="flex-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold outline-none focus:border-blue-500" />
            <input required inputMode="decimal" placeholder="Pró-labore mensal R$" value={proForm.total_cost} onChange={(e) => setProForm({ ...proForm, total_cost: e.target.value })} className="md:w-52 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-bold outline-none focus:border-blue-500 text-right" />
            <button className="bg-slate-900 text-white px-5 py-3 rounded-xl hover:bg-black transition flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest"><Plus size={16} /> Adicionar</button>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {prolabore.map((i) => (
              <div key={i.id} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center bg-white hover:border-blue-200 transition">
                <p className="font-bold text-slate-700 text-xs uppercase">{i.partner_name}</p>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm font-mono text-slate-900">{brl(Number(i.total_cost))}</span>
                  <button onClick={() => askDeleteCost('prolabore', i.id, i.partner_name)} className="text-slate-300 hover:text-rose-500" aria-label={`Remover ${i.partner_name}`}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {prolabore.length === 0 && <p className="col-span-full text-center text-sm text-slate-400 font-medium py-8">Nenhum pró-labore cadastrado.</p>}
          </div>
        </Card>
      )}

      {/* MODAL: NOVO CANAL */}
      {newChannel !== null && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setNewChannel(null)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-1 tracking-tight">Novo canal de venda</h3>
            <p className="text-slate-500 text-sm mb-6 font-medium">Vira uma coluna do painel de rateio (ex.: Vendas B2B fora do PR).</p>
            <input autoFocus type="text" placeholder="Nome do canal" value={newChannel} onChange={(e) => setNewChannel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createChannel()} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 mb-6" />
            <div className="flex gap-3">
              <button onClick={() => setNewChannel(null)} className="flex-1 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl">Cancelar</button>
              <button onClick={createChannel} className="flex-1 py-3.5 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CARREGAR PLANILHAS */}
      {importOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setImportOpen(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-900 mb-1 tracking-tight flex items-center gap-2"><FileSpreadsheet className="text-blue-600" size={22} /> Carregar planilhas de markup</h3>
            <p className="text-slate-500 text-sm mb-5 font-medium leading-relaxed">
              Lê PAINEL, FICHA TECNICA 1–10, CUSTO FIXO, FOLHA e PRO-LABORE e grava canais, produtos com ficha técnica, custos fixos, folha e pró-labore nesta empresa.
            </p>
            <label className="block mb-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arquivos CSV (opcional)</span>
              <input type="file" accept=".csv" multiple onChange={(e) => setImportFiles(Array.from(e.target.files || []))} className="block w-full mt-2 text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold" />
              <span className="block text-[11px] text-slate-400 font-medium mt-2">{importFiles.length > 0 ? `${importFiles.length} arquivo(s) selecionado(s).` : 'Sem arquivos, usa as planilhas guardadas no servidor (backend/markup_files).'}</span>
            </label>
            <div className="space-y-2">
              <button onClick={() => runImport(false)} className="w-full p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-left transition">
                <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Mesclar</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Atualiza o que tem o mesmo nome ou código e acrescenta o resto. Nada é apagado.</p>
              </button>
              <button onClick={() => runImport(true)} className="w-full p-4 rounded-2xl border border-rose-100 hover:bg-rose-50 text-left transition">
                <p className="text-xs font-black text-rose-600 uppercase tracking-wide">Substituir tudo</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Apaga antes os canais, produtos, insumos, fichas, custos fixos, folha e pró-labore desta empresa. Não pode ser desfeito.</p>
              </button>
              <button onClick={() => setImportOpen(false)} className="w-full py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostManagement;
