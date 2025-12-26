import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, CheckCircle, DollarSign, TrendingUp, 
  ArrowDownCircle, FileText, Calendar, Building2, Calculator, 
  Eraser, History, Trash2, Edit3, ChevronDown, ChevronUp, 
  Plus, X, Tag, Copy, ChevronLeft, ChevronRight, AlertCircle,
  ArrowUpRight, ArrowDownRight, Info, ListPlus, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ESTADO INICIAL DO FORMULÁRIO
 */
const INITIAL_FORM_STATE = {
  revenue: { resale: 0, product: 0, service: 0, rent: 0, other: 0 },
  taxes: { icms: 0, difal: 0, iss: 0, fust: 0, funtell: 0, pis: 0, cofins: 0, csll: 0, irpj: 0, additionalIrpj: 0 },
  purchasesTotal: 0,
  expensesTotal: 0,
  notes: ''
};

/**
 * COMPONENTE DE INPUT MONETÁRIO COM MÁSCARA
 */
const MoneyInput = ({ label, value, onChange, readOnly = false }) => {
  const handleChange = (e) => {
    if (readOnly) return;
    let val = e.target.value.replace(/\D/g, '');
    val = (Number(val) / 100).toFixed(2);
    onChange(val);
  };

  return (
    <div className="flex flex-col gap-1.5 group">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 group-focus-within:text-blue-600 transition-colors flex items-center gap-1">
        {label} {readOnly && <Info size={10} className="text-slate-300"/>}
      </label>
      <div className={`relative flex items-center transition-all duration-300 ${readOnly ? 'bg-slate-50/50' : 'bg-white shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'} border border-slate-200 rounded-xl px-4 py-3`}>
        <span className="text-slate-400 font-bold mr-2 text-xs">R$</span>
        <input
          type="text"
          readOnly={readOnly}
          value={value ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
          onChange={handleChange}
          className={`w-full bg-transparent outline-none font-mono text-base font-bold text-slate-700 ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
        />
      </div>
    </div>
  );
};

/**
 * SEÇÃO DE AGRUPAMENTO DE CAMPOS
 */
const InputSection = ({ title, icon: Icon, color, children, description }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden h-full"
  >
    <div className="p-6 border-b border-slate-50 flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color.replace('text-', 'bg-').replace('600', '100')} ${color}`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <h2 className="font-bold text-slate-800 tracking-tight">{title}</h2>
      </div>
      {description && <p className="text-[11px] text-slate-400 ml-11 font-medium">{description}</p>}
    </div>
    <div className="p-6 grid gap-5">{children}</div>
  </motion.div>
);

const FinancialEntries = ({ companyId, apiBase }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  const user = JSON.parse(localStorage.getItem('hdl_user'));

  // ESTADOS PRINCIPAIS
  const [currentMonth, setCurrentMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [details, setDetails] = useState([]);
  const [history, setHistory] = useState([]);
  const [partners, setPartners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  
  // ESTADO DO NOVO ITEM ANALÍTICO
  const [newItem, setNewItem] = useState({ 
    partner_id: '', 
    category_id: '', 
    amount: '', 
    type: 'EXPENSE',
    description: '' 
  });

  // NAVEGAÇÃO DE MÊS
  const changeMonth = (offset) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  // CÁLCULO DE TOTAIS E MARGENS PARA A DRE
  const totals = useMemo(() => {
    const totalRev = Object.values(form.revenue).reduce((a, b) => Number(a) + Number(b), 0);
    const totalTax = Object.values(form.taxes).reduce((a, b) => Number(a) + Number(b), 0);
    const totalCost = Number(form.purchasesTotal) + Number(form.expensesTotal);
    const profit = totalRev - totalTax - totalCost;
    const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;
    return { totalRev, totalTax, totalCost, profit, margin };
  }, [form]);

  // SINCRONIZAÇÃO: LANÇAMENTOS ANALÍTICOS -> TOTAIS DA DRE
  useEffect(() => {
    const sumExpenses = details.filter(item => item.type === 'EXPENSE').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const sumRevenueExtras = details.filter(item => item.type === 'REVENUE').reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    setForm(prev => ({
        ...prev,
        expensesTotal: sumExpenses > 0 ? sumExpenses : prev.expensesTotal,
        revenue: { ...prev.revenue, other: sumRevenueExtras > 0 ? sumRevenueExtras : prev.revenue.other }
    }));
  }, [details]);

  // CARREGAR HISTÓRICO
  const loadHistory = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/entries/history?companyId=${companyId}`);
      if (response.ok) setHistory(await response.json());
    } catch (error) { console.error("Erro histórico:", error); }
  };

  // CARREGAR DADOS ESTÁTICOS
  useEffect(() => {
    if (!companyId) return;
    const loadInitialData = async () => {
      try {
        const [resPartners, resCategories] = await Promise.all([
          fetch(`${BASE_URL}/api/partners/${companyId}`),
          fetch(`${BASE_URL}/api/categories`)
        ]);
        if (resPartners.ok) setPartners(await resPartners.json());
        if (resCategories.ok) setCategories(await resCategories.json());
      } catch (error) { console.error(error); }
    };
    loadInitialData();
    loadHistory();
  }, [companyId]);

  // CARREGAR LANÇAMENTOS DO MÊS SELECIONADO
  useEffect(() => {
    if (!companyId) return;
    const loadCurrentEntry = async () => {
      setStatus('loading');
      try {
        const res = await fetch(`${BASE_URL}/api/entries?companyId=${companyId}&month=${currentMonth}-01`);
        const data = await res.json();
        if (data) {
          setForm({
            revenue: { resale: data.revenue_resale, product: data.revenue_product, service: data.revenue_service, rent: data.revenue_rent, other: data.revenue_other },
            taxes: { icms: data.tax_icms, difal: data.tax_difal, iss: data.tax_iss, fust: data.tax_fust, funtell: data.tax_funtell, pis: data.tax_pis, cofins: data.tax_cofins, csll: data.tax_csll, irpj: data.tax_irpj, additionalIrpj: data.tax_additional_irpj },
            purchasesTotal: data.purchases_total || 0,
            expensesTotal: data.expenses_total || 0,
            notes: data.notes || ''
          });
          setDetails(data.details || []);
        } else {
          setForm(INITIAL_FORM_STATE);
          setDetails([]);
        }
        setStatus(null);
      } catch (error) { setStatus(null); }
    };
    loadCurrentEntry();
  }, [companyId, currentMonth]);

  // FUNÇÃO DE LIMPEZA TOTAL (CAMPOS + ANALÍTICO)
  const handleClearEverything = () => {
    if (window.confirm("Deseja limpar todos os campos e a lista de lançamentos analíticos deste formulário?")) {
        setForm(INITIAL_FORM_STATE);
        setDetails([]); 
        setNewItem({ partner_id: '', category_id: '', amount: '', type: 'EXPENSE', description: '' });
    }
  };

  // SALVAR NO BANCO DE DADOS
  const handleSaveData = async () => {
    if (!companyId) return;
    setStatus('saving');
    try {
      const payload = { companyId, periodStart: `${currentMonth}-01`, userId: user?.id, userName: user?.full_name, ...form, details };
      const res = await fetch(`${BASE_URL}/api/entries`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      if (res.ok) { 
        setStatus('success'); 
        setTimeout(() => setStatus(null), 3000); 
        loadHistory(); 
      } else {
        setStatus('error');
      }
    } catch (error) { setStatus('error'); }
  };

  const formatCurrency = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const filteredPartners = partners.filter(p => newItem.type === 'REVENUE' ? (p.type === 'CLIENT' || p.type === 'BOTH') : (p.type === 'SUPPLIER' || p.type === 'BOTH'));

  return (
    <div className="max-w-7xl mx-auto pb-20 px-6 animate-in fade-in duration-700">
      
      {/* CABEÇALHO */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center py-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <div className="w-1.5 h-8 bg-blue-600 rounded-full"/> Vector Connect Enterprises
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest text-[10px]">Gestão de Competência Mensal</p>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition"><ChevronLeft size={20}/></button>
              <div className="flex items-center px-4 gap-2 border-x border-slate-100">
                <Calendar size={16} className="text-blue-500" />
                <input type="month" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="bg-transparent text-slate-700 font-bold text-sm border-none outline-none uppercase cursor-pointer" />
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition"><ChevronRight size={20}/></button>
           </div>
           <button onClick={() => setShowCloneModal(true)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl text-xs font-black hover:bg-slate-50 transition shadow-sm uppercase tracking-widest">
             <Copy size={16} className="text-amber-500"/> Clonar Mês
           </button>
        </div>
      </header>

      {/* DASHBOARD DE RESULTADO DRE */}
      <div className="sticky top-6 z-50 mb-12">
        <motion.div layout className="bg-slate-900 text-white rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center justify-between px-10 py-8 gap-10">
            <div className="flex items-center gap-6">
              <div className={`p-5 rounded-3xl ${totals.profit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} border border-white/5`}>
                {totals.profit >= 0 ? <TrendingUp size={32} /> : <ArrowDownCircle size={32} />}
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Resultado Líquido (EBITDA)</p>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-4xl font-black font-mono tracking-tighter italic">{formatCurrency(totals.profit)}</h2>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black ${totals.profit >= 0 ? 'bg-emerald-500 text-emerald-950' : 'bg-rose-500 text-rose-950'}`}>
                    {totals.margin.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-12 w-full lg:w-auto px-10 lg:border-l border-white/10 text-center lg:text-left">
              <div><p className="text-slate-500 text-[10px] font-black uppercase italic tracking-widest">Faturamento</p><p className="font-mono text-xl font-bold text-emerald-400 tracking-tight">{formatCurrency(totals.totalRev)}</p></div>
              <div><p className="text-slate-500 text-[10px] font-black uppercase italic tracking-widest">Tributos</p><p className="font-mono text-xl font-bold text-amber-400 tracking-tight">{formatCurrency(totals.totalTax)}</p></div>
              <div><p className="text-slate-500 text-[10px] font-black uppercase italic tracking-widest">Despesas</p><p className="font-mono text-xl font-bold text-rose-400 tracking-tight">{formatCurrency(totals.totalCost)}</p></div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* COLUNA 1: RECEITAS E MÓDULO ANALÍTICO */}
        <div className="space-y-8">
            <InputSection title="Faturamento Bruto" icon={TrendingUp} color="text-emerald-600" description="Entradas principais registradas">
                <MoneyInput label="Revenda de Mercadorias" value={form.revenue.resale} onChange={value => setForm({...form, revenue: {...form.revenue, resale: value}})} />
                <MoneyInput label="Produção Própria" value={form.revenue.product} onChange={value => setForm({...form, revenue: {...form.revenue, product: value}})} />
                <MoneyInput label="Prestação de Serviços" value={form.revenue.service} onChange={value => setForm({...form, revenue: {...form.revenue, service: value}})} />
                <MoneyInput label="Analítico (Calculado)" value={form.revenue.other} readOnly />
            </InputSection>

            {/* MÓDULO DE LANÇAMENTO ANALÍTICO */}
            <div className="bg-slate-900 rounded-[2rem] p-6 shadow-2xl border border-slate-800 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl" />
                <h3 className="font-black text-white text-[10px] mb-6 flex items-center gap-2 uppercase tracking-[0.2em] relative z-10">
                    <ListPlus size={14} className="text-blue-400"/> Detalhamento Analítico
                </h3>
                
                <div className="flex gap-2 mb-6 bg-slate-800/50 p-1.5 rounded-2xl border border-white/5 relative z-10">
                    <button onClick={() => setNewItem({...newItem, type: 'REVENUE'})} className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all duration-300 ${newItem.type === 'REVENUE' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}>ENTRADA</button>
                    <button onClick={() => setNewItem({...newItem, type: 'EXPENSE'})} className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all duration-300 ${newItem.type === 'EXPENSE' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-slate-300'}`}>SAÍDA</button>
                </div>

                <div className="space-y-3 relative z-10">
                    <div className="relative">
                        <select value={newItem.category_id} onChange={e => setNewItem({...newItem, category_id: e.target.value})} className="w-full text-xs font-bold border-none rounded-xl p-4 bg-slate-800 text-slate-200 outline-none ring-1 ring-white/5 focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer">
                            <option value="" disabled hidden>Classificação Contábil...</option>
                            {categories.filter(c => c.type === newItem.type).map(c => <option key={c.id} value={c.id} className="bg-slate-900 uppercase tracking-widest">{c.name}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-4 text-slate-500 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <select value={newItem.partner_id} onChange={e => setNewItem({...newItem, partner_id: e.target.value})} className="w-full text-xs font-bold border-none rounded-xl p-4 bg-slate-800 text-slate-200 outline-none ring-1 ring-white/5 focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer">
                            <option value="" disabled hidden>Parceiro / Entidade...</option>
                            {filteredPartners.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-4 text-slate-500 pointer-events-none" />
                    </div>

                    <div className="flex gap-2">
                        <input type="text" placeholder="Histórico / Descrição..." value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="flex-1 text-xs font-bold border-none rounded-xl p-4 bg-slate-800 text-slate-200 outline-none ring-1 ring-white/5 focus:ring-2 focus:ring-blue-500/50" />
                        <div className="relative w-28">
                            <span className="absolute left-3 top-4 text-[10px] font-bold text-slate-500">R$</span>
                            <input type="number" placeholder="0.00" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})} className="w-full text-sm font-black border-none rounded-xl p-4 pl-8 bg-slate-800 text-blue-400 outline-none ring-1 ring-white/5 font-mono"/>
                        </div>
                        <button onClick={() => { if (!newItem.category_id || !newItem.amount) return; setDetails([...details, { ...newItem, id: Date.now() }]); setNewItem({ ...newItem, amount: '', description: '' }); }} className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-500 transition shadow-lg active:scale-95"><Plus size={20}/></button>
                    </div>
                </div>

                <div className="mt-6 space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar relative z-10">
                    {details.map((item, index) => (
                        <div key={item.id || index} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                            <div className="flex flex-col">
                                <span className="font-black text-slate-200 text-[9px] uppercase tracking-tighter italic">{categories.find(c => c.id == item.category_id)?.name}</span>
                                <span className="text-slate-500 text-[10px] font-medium leading-none">{item.description || partners.find(p => p.id == item.partner_id)?.name || 'Geral'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`font-mono font-black text-xs ${item.type === 'REVENUE' ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(item.amount)}</span>
                                <button onClick={() => setDetails(details.filter((_, i) => i !== index))} className="text-slate-600 hover:text-rose-500 transition-colors"><X size={14}/></button>
                            </div>
                        </div>
                    ))}
                    {details.length === 0 && <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl"><p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Nenhum item analítico</p></div>}
                </div>
            </div>
        </div>

        {/* COLUNA 2: IMPOSTOS */}
        <InputSection title="Deduções e Tributos" icon={FileSpreadsheet} color="text-amber-600" description="Impacto tributário do período">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <MoneyInput label="DAS / Simples Nacional" value={form.taxes.icms} onChange={v => setForm({...form, taxes: {...form.taxes, icms: v}})} />
            <MoneyInput label="ISS Retido" value={form.taxes.iss} onChange={v => setForm({...form, taxes: {...form.taxes, iss: v}})} />
            <MoneyInput label="PIS" value={form.taxes.pis} onChange={v => setForm({...form, taxes: {...form.taxes, pis: v}})} />
            <MoneyInput label="COFINS" value={form.taxes.cofins} onChange={v => setForm({...form, taxes: {...form.taxes, cofins: v}})} />
            <MoneyInput label="IRPJ" value={form.taxes.irpj} onChange={v => setForm({...form, taxes: {...form.taxes, irpj: v}})} />
            <MoneyInput label="CSLL" value={form.taxes.csll} onChange={v => setForm({...form, taxes: {...form.taxes, csll: v}})} />
            <MoneyInput label="FUST (Telecom)" value={form.taxes.fust} onChange={v => setForm({...form, taxes: {...form.taxes, fust: v}})} />
            <MoneyInput label="FUNTELL" value={form.taxes.funtell} onChange={v => setForm({...form, taxes: {...form.taxes, funtell: v}})} />
          </div>
        </InputSection>
        
        {/* COLUNA 3: DESPESAS E SALVAR */}
        <div className="space-y-8">
          <InputSection title="Custos e Despesas" icon={ArrowDownCircle} color="text-rose-600" description="Saídas operacionais fixas e variáveis">
            <MoneyInput label="Compras Diretas" value={form.purchasesTotal} onChange={v => setForm({...form, purchasesTotal: v})} />
            <MoneyInput label="Saídas Analíticas" value={form.expensesTotal} readOnly />
          </InputSection>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1 group-focus-within:text-blue-600 transition-colors">Notas e Justificativas</label>
            <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm h-32 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none text-slate-700 font-medium transition-all" placeholder="Informações relevantes para o fechamento..." />
          </div>

          <div className="flex gap-4">
            <button onClick={handleClearEverything} className="w-20 h-16 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-300 hover:text-rose-500 transition-all active:scale-95 shadow-sm" title="Limpar Tudo">
              <Eraser size={24} />
            </button>
            <button onClick={handleSaveData} disabled={status === 'saving'} className={`flex-1 h-16 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-white shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${status === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
              {status === 'saving' ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : status === 'success' ? <><CheckCircle size={18}/> Salvo!</> : <><Save size={18}/> Consolidar Mês</>}
            </button>
          </div>
        </div>
      </div>

      {/* HISTÓRICO CONSOLIDADO */}
      <div className="mt-20">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-8"><div className="w-1.5 h-6 bg-slate-300 rounded-full"/> Histórico de Consolidação</h2>
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr><th className="px-10 py-5">Período Fiscal</th><th className="px-10 py-5 text-right">Faturamento Total</th><th className="px-10 py-5 text-right">EBITDA</th><th className="px-10 py-5 text-center">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
              {history.map((item) => {
                const itemProfit = item.total_revenue - item.total_taxes - item.total_costs;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-10 py-6 font-bold uppercase">{item.period_start.substring(0, 7)}</td>
                    <td className="px-10 py-6 text-right font-mono">{formatCurrency(item.total_revenue)}</td>
                    <td className={`px-10 py-6 text-right font-mono font-black ${itemProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(itemProfit)}</td>
                    <td className="px-10 py-6 text-center flex justify-center gap-2">
                        <button onClick={() => setCurrentMonth(item.period_start.substring(0, 7))} className="p-2.5 text-slate-300 hover:text-blue-600 transition-colors"><Edit3 size={18} /></button>
                        <button onClick={async () => { if(confirm("Deseja apagar este registro histórico?")) { await fetch(`${BASE_URL}/api/entries?companyId=${companyId}&month=${item.period_start}`, { method: 'DELETE' }); loadHistory(); } }} className="p-2.5 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {history.length === 0 && <div className="p-20 text-center font-bold text-slate-300 italic text-xs uppercase tracking-[0.3em]">Nenhum registro encontrado.</div>}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }`}} />
    </div>
  );
};

export default FinancialEntries;