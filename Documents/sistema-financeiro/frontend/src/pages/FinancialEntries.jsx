import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, CheckCircle, DollarSign, TrendingUp, 
  ArrowDownCircle, FileText, Calendar, Building2, Calculator, 
  Eraser, History, Trash2, Edit3, ChevronDown, ChevronUp, 
  Plus, X, Tag, Copy, ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_FORM_STATE = {
  revenue: { resale: 0, product: 0, service: 0, rent: 0, other: 0 },
  taxes: { icms: 0, difal: 0, iss: 0, fust: 0, funtell: 0, pis: 0, cofins: 0, csll: 0, irpj: 0, additionalIrpj: 0 },
  purchasesTotal: 0,
  expensesTotal: 0,
  notes: ''
};

// --- COMPONENTES AUXILIARES ---
const MoneyInput = ({ label, value, onChange, readOnly = false }) => {
  const handleChange = (e) => {
    if (readOnly) return;
    let val = e.target.value.replace(/\D/g, '');
    val = (Number(val) / 100).toFixed(2);
    onChange(val);
  };
  return (
    <div className="relative group">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block group-hover:text-blue-500 transition-colors">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-0 top-2 text-slate-400 font-medium text-sm">R$</span>
        <input
          type="text"
          readOnly={readOnly}
          value={value ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
          onChange={handleChange}
          className={`w-full pl-6 py-1.5 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none transition-all font-mono text-slate-700 font-medium text-lg ${readOnly ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
        />
      </div>
    </div>
  );
};

const InputSection = ({ title, icon: Icon, color, children }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
    <div className="flex items-center gap-3 mb-6 pb-3 border-b border-slate-50">
      <div className={`p-2 rounded-lg bg-opacity-10 ${color.replace('text-', 'bg-')} ${color}`}>
        <Icon size={20} />
      </div>
      <h2 className="font-bold text-slate-800">{title}</h2>
    </div>
    <div className="grid gap-5">{children}</div>
  </div>
);

const FinancialEntries = ({ companyId, apiBase }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  const user = JSON.parse(localStorage.getItem('hdl_user'));

  // ESTADOS
  const [currentMonth, setCurrentMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [details, setDetails] = useState([]);
  const [history, setHistory] = useState([]);
  const [partners, setPartners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [newItem, setNewItem] = useState({ partner_id: '', category_id: '', amount: '', type: 'EXPENSE' });
  
  // Modal de Clonagem
  const [showCloneModal, setShowCloneModal] = useState(false);

  // --- LÓGICA DE NAVEGAÇÃO DE DATA ---
  const changeMonth = (offset) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  // --- CÁLCULOS ---
  const totals = useMemo(() => {
    const totalRev = Object.values(form.revenue).reduce((a, b) => Number(a) + Number(b), 0);
    const totalTax = Object.values(form.taxes).reduce((a, b) => Number(a) + Number(b), 0);
    const totalCost = Number(form.purchasesTotal) + Number(form.expensesTotal);
    const profit = totalRev - totalTax - totalCost;
    const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;
    return { totalRev, totalTax, totalCost, profit, margin };
  }, [form]);

  // Sincroniza totais automáticos baseados nos detalhes
  useEffect(() => {
    const sumExpenses = details.filter(d => d.type === 'EXPENSE').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const sumRevenueExtras = details.filter(d => d.type === 'REVENUE').reduce((acc, curr) => acc + Number(curr.amount), 0);
    setForm(prev => ({
        ...prev,
        expensesTotal: sumExpenses > 0 ? sumExpenses : prev.expensesTotal,
        revenue: { ...prev.revenue, other: sumRevenueExtras > 0 ? sumRevenueExtras : prev.revenue.other }
    }));
  }, [details]);

  // --- CARREGAMENTO DE DADOS ---
  const loadHistory = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/entries/history?companyId=${companyId}`);
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!companyId) return;
    const loadStaticData = async () => {
      try {
        const [resPart, resCat] = await Promise.all([
          fetch(`${BASE_URL}/api/partners/${companyId}`),
          fetch(`${BASE_URL}/api/categories`)
        ]);
        if (resPart.ok) setPartners(await resPart.json());
        if (resCat.ok) setCategories(await resCat.json());
      } catch (e) { console.error(e); }
    };
    loadStaticData();
    loadHistory();
  }, [companyId, BASE_URL]);

  useEffect(() => {
    if (!companyId) return;
    const loadEntry = async () => {
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
      } catch (e) { setStatus(null); }
    };
    loadEntry();
  }, [companyId, currentMonth, BASE_URL]);

  // --- LÓGICA DE CLONAGEM ---
  const handleCloneMonth = async (sourceMonth) => {
    try {
      setStatus('loading');
      const res = await fetch(`${BASE_URL}/api/entries?companyId=${companyId}&month=${sourceMonth}`);
      const data = await res.json();
      
      if (data) {
        // Clonamos os dados mas mantemos o mês de destino (currentMonth)
        setForm({
          revenue: { resale: data.revenue_resale, product: data.revenue_product, service: data.revenue_service, rent: data.revenue_rent, other: data.revenue_other },
          taxes: { icms: data.tax_icms, difal: data.tax_difal, iss: data.tax_iss, fust: data.tax_fust, funtell: data.tax_funtell, pis: data.tax_pis, cofins: data.tax_cofins, csll: data.tax_csll, irpj: data.tax_irpj, additionalIrpj: data.tax_additional_irpj },
          purchasesTotal: data.purchases_total || 0,
          expensesTotal: data.expenses_total || 0,
          notes: `Clonado de ${sourceMonth.substring(0, 7)}. ${data.notes || ''}`
        });
        
        // Removemos IDs originais dos detalhes para que sejam inseridos como novos
        const cleanedDetails = (data.details || []).map(({ id, entry_id, ...rest }) => ({ ...rest, id: Date.now() + Math.random() }));
        setDetails(cleanedDetails);
        
        setShowCloneModal(false);
        setStatus('success');
        setTimeout(() => setStatus(null), 2000);
      } else {
        alert("Nenhum dado encontrado no mês de origem.");
      }
    } catch (e) {
      alert("Erro ao clonar mês.");
    } finally { setStatus(null); }
  };

  // --- PERSISTÊNCIA ---
  const handleSave = async () => {
    if (!companyId) return alert("Selecione uma empresa.");
    setStatus('saving');
    try {
      const payload = { 
        companyId, 
        periodStart: `${currentMonth}-01`, 
        periodEnd: `${currentMonth}-28`, 
        userId: user?.id, 
        userName: user?.full_name,
        ...form, 
        details 
      };
      const res = await fetch(`${BASE_URL}/api/entries`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      if (res.ok) { 
        setStatus('success'); 
        setTimeout(() => setStatus(null), 3000); 
        loadHistory();
      } else { setStatus('error'); }
    } catch (e) { setStatus('error'); }
  };

  const handleDelete = async (date) => {
    if (!window.confirm("Deseja apagar todos os lançamentos deste mês?")) return;
    try {
      const res = await fetch(`${BASE_URL}/api/entries?companyId=${companyId}&month=${date}&userId=${user?.id}&userName=${encodeURIComponent(user?.full_name)}`, { method: 'DELETE' });
      if (res.ok) {
        loadHistory();
        if (date === `${currentMonth}-01`) {
          setForm(INITIAL_FORM_STATE);
          setDetails([]);
        }
      }
    } catch (e) { alert("Erro ao excluir."); }
  };

  // --- HELPERS UI ---
  const f = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const filteredPartners = partners.filter(p => newItem.type === 'REVENUE' ? (p.type === 'CLIENT' || p.type === 'BOTH') : (p.type === 'SUPPLIER' || p.type === 'BOTH'));

  if (!companyId) return (
    <div className="h-96 flex flex-col items-center justify-center text-slate-400">
      <Building2 size={48} className="mb-4 opacity-20 animate-pulse"/><p>Selecione uma empresa para gerenciar lançamentos.</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in relative">
      
      {/* HEADER E NAVEGAÇÃO DE MÊS */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <DollarSign className="text-blue-600" /> Lançamentos Mensais
          </h1>
          <p className="text-slate-500 text-sm mt-1">Empresa: <span className="font-bold text-slate-700 underline decoration-blue-200">MGP TELECOM</span></p>
        </div>

        <div className="flex items-center gap-2">
           <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-1">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition"><ChevronLeft size={20}/></button>
              <div className="flex items-center px-4 gap-2">
                <Calendar size={16} className="text-blue-500" />
                <input 
                  type="month" 
                  value={currentMonth} 
                  onChange={(e) => setCurrentMonth(e.target.value)} 
                  className="border-none bg-transparent text-slate-700 font-bold text-sm focus:ring-0 outline-none cursor-pointer"
                />
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition"><ChevronRight size={20}/></button>
           </div>
           
           <button 
             onClick={() => setShowCloneModal(true)}
             className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm"
           >
             <Copy size={18} className="text-amber-500"/> Clonar Mês
           </button>
        </div>
      </div>

      {/* DASHBOARD DE RESUMO RÁPIDO */}
      <div className="sticky top-0 z-40 pb-6 pt-2 -mt-2 bg-gray-50/95 backdrop-blur-sm">
        <motion.div layout className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border border-slate-700">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="p-3 bg-white/10 rounded-xl"><Calculator size={24} className="text-blue-400"/></div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Resultado Líquido ({currentMonth})</p>
              <div className="flex items-baseline gap-2">
                <h2 className={`text-3xl font-bold ${totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{f(totals.profit)}</h2>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${totals.profit >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>{totals.margin.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="flex gap-8 text-sm w-full md:w-auto justify-around md:justify-end border-t md:border-t-0 border-slate-700 pt-4 md:pt-0">
            <div><p className="text-slate-500 mb-1">Faturamento</p><p className="font-mono text-emerald-400 font-bold">{f(totals.totalRev)}</p></div>
            <div><p className="text-slate-500 mb-1">Impostos</p><p className="font-mono text-amber-400 font-bold">{f(totals.totalTax)}</p></div>
            <div><p className="text-slate-500 mb-1">Custos/Desp.</p><p className="font-mono text-rose-400 font-bold">{f(totals.totalCost)}</p></div>
          </div>
        </motion.div>
      </div>

      {/* FORMULÁRIO PRINCIPAL */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Edit3 size={20} className="text-slate-400" /> Detalhamento Operacional</h2>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 text-sm text-blue-600 font-bold bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
            {showForm ? 'Recolher Painel' : 'Abrir Painel'} {showForm ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-1">
                
                {/* COLUNA 1: RECEITAS E ITENS AVULSOS */}
                <div className="space-y-6">
                    <InputSection title="Receitas Brutas" icon={TrendingUp} color="text-emerald-600">
                        <MoneyInput label="Venda de Mercadorias (Revenda)" value={form.revenue.resale} onChange={v => setForm({...form, revenue: {...form.revenue, resale: v}})} />
                        <MoneyInput label="Produção Própria" value={form.revenue.product} onChange={v => setForm({...form, revenue: {...form.revenue, product: v}})} />
                        <MoneyInput label="Prestação de Serviços" value={form.revenue.service} onChange={v => setForm({...form, revenue: {...form.revenue, service: v}})} />
                        <MoneyInput label="Outras Receitas (Automático)" value={form.revenue.other} readOnly />
                    </InputSection>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm border-t-4 border-t-blue-500">
                        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><Tag size={16} className="text-blue-600"/> Lançamentos Analíticos</h3>
                        
                        <div className="flex gap-2 mb-4 bg-slate-50 p-1 rounded-lg">
                           <button onClick={() => setNewItem({...newItem, type: 'REVENUE'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${newItem.type === 'REVENUE' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500'}`}>Entrada</button>
                           <button onClick={() => setNewItem({...newItem, type: 'EXPENSE'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${newItem.type === 'EXPENSE' ? 'bg-rose-500 text-white shadow' : 'text-slate-500'}`}>Saída</button>
                        </div>
                        
                        <div className="space-y-3 mb-4">
                           <select value={newItem.category_id} onChange={e => setNewItem({...newItem, category_id: e.target.value})} className="w-full text-sm border-slate-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500/20">
                              <option value="">Selecione a Categoria...</option>
                              {categories.filter(c => c.type === newItem.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                           </select>
                           
                           <div className="flex gap-2">
                               <select value={newItem.partner_id} onChange={e => setNewItem({...newItem, partner_id: e.target.value})} className="flex-1 text-sm border-slate-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500/20">
                                  <option value="">Parceiro/Entidade</option>
                                  {filteredPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                               </select>
                               <input type="number" placeholder="0.00" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})} className="w-28 text-sm border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono font-bold"/>
                               <button onClick={() => {
                                 if (!newItem.category_id || !newItem.amount) return;
                                 setDetails([...details, { ...newItem, id: Date.now() }]);
                                 setNewItem({ ...newItem, amount: '' });
                               }} className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 transition shadow-md shadow-blue-200"><Plus size={20}/></button>
                           </div>
                        </div>
                        
                        <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {details.map((item, idx) => (
                                <div key={item.id || idx} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700">{categories.find(c => c.id == item.category_id)?.name}</span>
                                        <span className="text-slate-400 text-[10px]">{partners.find(p => p.id == item.partner_id)?.name || 'Geral'}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono font-bold ${item.type === 'REVENUE' ? 'text-emerald-600' : 'text-rose-600'}`}>{f(item.amount)}</span>
                                        <button onClick={() => setDetails(details.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100"><X size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            {details.length === 0 && <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl"><p className="text-xs text-slate-300 italic">Nenhum detalhamento inserido.</p></div>}
                        </div>
                    </div>
                </div>

                {/* COLUNA 2: IMPOSTOS */}
                <InputSection title="Carga Tributária" icon={FileText} color="text-amber-600">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                    <MoneyInput label="DAS (Simples)" value={form.taxes.icms} onChange={v => setForm({...form, taxes: {...form.taxes, icms: v}})} />
                    <MoneyInput label="ISS Retido" value={form.taxes.iss} onChange={v => setForm({...form, taxes: {...form.taxes, iss: v}})} />
                    <MoneyInput label="PIS" value={form.taxes.pis} onChange={v => setForm({...form, taxes: {...form.taxes, pis: v}})} />
                    <MoneyInput label="COFINS" value={form.taxes.cofins} onChange={v => setForm({...form, taxes: {...form.taxes, cofins: v}})} />
                    <MoneyInput label="IRPJ" value={form.taxes.irpj} onChange={v => setForm({...form, taxes: {...form.taxes, irpj: v}})} />
                    <MoneyInput label="CSLL" value={form.taxes.csll} onChange={v => setForm({...form, taxes: {...form.taxes, csll: v}})} />
                    <MoneyInput label="FUST" value={form.taxes.fust} onChange={v => setForm({...form, taxes: {...form.taxes, fust: v}})} />
                    <MoneyInput label="FUNTELL" value={form.taxes.funtell} onChange={v => setForm({...form, taxes: {...form.taxes, funtell: v}})} />
                  </div>
                </InputSection>
                
                {/* COLUNA 3: CUSTOS E SALVAR */}
                <div className="space-y-6">
                  <InputSection title="Custos e Despesas" icon={ArrowDownCircle} color="text-rose-600">
                    <MoneyInput label="Compras / Fornecedores" value={form.purchasesTotal} onChange={v => setForm({...form, purchasesTotal: v})} />
                    <MoneyInput label="Despesas Operacionais (Auto)" value={form.expensesTotal} readOnly />
                  </InputSection>

                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Observações do Mês</label>
                    <textarea 
                      value={form.notes} 
                      onChange={(e) => setForm({...form, notes: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm h-24 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none text-slate-700 transition-all" 
                      placeholder="Ex: Pagamento de bônus anual, reajuste de contrato..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setForm(INITIAL_FORM_STATE)} className="px-5 py-4 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all group">
                      <Eraser size={20} className="group-hover:rotate-12 transition-transform"/>
                    </button>
                    <button 
                      onClick={handleSave} 
                      disabled={status === 'saving'} 
                      className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${status === 'success' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 shadow-blue-200'}`}
                    >
                      {status === 'saving' ? <span className="animate-pulse">Processando...</span> : status === 'success' ? <><CheckCircle size={20}/> Sucesso!</> : <><Save size={20}/> Salvar Lançamento</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* HISTÓRICO */}
      <div className="mt-8 border-t border-slate-200 pt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History size={20} className="text-slate-400" /> Histórico de Lançamentos</h2>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition">
            {showHistory ? 'Esconder' : 'Ver Todos'} {showHistory ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>

        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {history.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                    <History size={40} className="mb-2 opacity-10"/>
                    <p>Nenhum lançamento histórico encontrado.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Período</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Faturamento Total</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Resultado</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {history.map((item) => {
                        const itemProfit = item.total_revenue - item.total_taxes - item.total_costs;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="p-4 font-bold text-slate-700">{item.period_start.substring(0, 7)}</td>
                            <td className="p-4 text-right font-mono text-sm text-slate-600">{f(item.total_revenue)}</td>
                            <td className={`p-4 text-right font-mono text-sm font-bold ${itemProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{f(itemProfit)}</td>
                            <td className="p-4 text-right flex justify-end gap-2">
                              <button onClick={() => setCurrentMonth(item.period_start.substring(0, 7))} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition" title="Editar"><Edit3 size={16} /></button>
                              <button onClick={() => handleDelete(item.period_start)} className="p-2 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition" title="Excluir"><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MODAL DE CLONAGEM (Framer Motion) */}
      <AnimatePresence>
        {showCloneModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Copy className="text-amber-500" size={18}/> Clonar Lançamentos</h3>
                <button onClick={() => setShowCloneModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-500 mb-6 flex gap-2">
                  <AlertCircle size={32} className="text-amber-400 shrink-0"/>
                  Isso irá copiar todos os valores de impostos, faturamento e detalhes de um mês anterior para o mês selecionado atualmente ({currentMonth}).
                </p>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase">Selecione o Mês de Origem:</label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {history.filter(h => h.period_start.substring(0, 7) !== currentMonth).map(h => (
                      <button 
                        key={h.id} 
                        onClick={() => handleCloneMonth(h.period_start)}
                        className="flex justify-between items-center p-3 rounded-xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition group"
                      >
                        <span className="font-bold text-slate-700">{h.period_start.substring(0, 7)}</span>
                        <span className="text-xs text-slate-400 font-mono group-hover:text-blue-600">{f(h.total_revenue)}</span>
                      </button>
                    ))}
                    {history.length < 2 && <p className="text-center text-xs text-slate-400 py-4 italic">Histórico insuficiente para clonagem.</p>}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end">
                <button onClick={() => setShowCloneModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default FinancialEntries;