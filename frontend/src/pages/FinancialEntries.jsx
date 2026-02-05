import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  Save, CheckCircle, DollarSign, TrendingUp, 
  ArrowDownCircle, FileText, Calendar, Building2, Calculator, 
  Eraser, History, Trash2, Edit3, ChevronDown, ChevronUp, 
  Plus, X, Tag, Copy, ChevronLeft, ChevronRight, AlertCircle,
  ArrowUpRight, ArrowDownRight, Info, ListPlus, FileSpreadsheet,
  UploadCloud, Loader2
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
  const fileInputRef = useRef(null);

  // ESTADOS PRINCIPAIS
  const [currentMonth, setCurrentMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [details, setDetails] = useState([]);
  const [history, setHistory] = useState([]);
  const [partners, setPartners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  
  // ESTADO DO MODAL DE CLONE
  const [cloneTarget, setCloneTarget] = useState('');

  // ESTADO DE UPLOAD
  const [isUploading, setIsUploading] = useState(false);
  
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

  // CARREGAR HISTÓRICO E DADOS INICIAIS
  const loadInitialData = async () => {
    try {
      const [resPartners, resCategories, resHistory] = await Promise.all([
        axios.get(`${BASE_URL}/api/partners/${companyId}`),
        axios.get(`${BASE_URL}/api/categories`),
        axios.get(`${BASE_URL}/api/entries/history?companyId=${companyId}`)
      ]);
      
      setPartners(resPartners.data);
      setCategories(resCategories.data);
      setHistory(resHistory.data);
    } catch (error) { 
        console.error("Erro ao carregar dados iniciais:", error); 
    }
  };

  useEffect(() => {
    if (companyId) {
        loadInitialData();
    }
  }, [companyId]);

  // CARREGAR LANÇAMENTOS DO MÊS SELECIONADO
  useEffect(() => {
    if (!companyId) return;
    
    const loadCurrentEntry = async () => {
      setStatus('loading');
      try {
        const res = await axios.get(`${BASE_URL}/api/entries`, { 
            params: { companyId, month: `${currentMonth}-01` } 
        });
        
        const data = res.data;
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
      } catch (error) { 
          console.error("Erro ao carregar lançamento:", error);
          setStatus(null); 
      }
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
      
      await axios.post(`${BASE_URL}/api/entries`, payload);
      
      setStatus('success'); 
      setTimeout(() => setStatus(null), 3000); 
      
      // Atualiza o histórico após salvar
      const resHist = await axios.get(`${BASE_URL}/api/entries/history?companyId=${companyId}`);
      setHistory(resHist.data);

    } catch (error) { 
        console.error("Erro ao salvar:", error);
        setStatus('error'); 
    }
  };
  
  // UPLOAD DE EXCEL
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !companyId) return;

    if (!confirm("Isso importará os dados da planilha e atualizará os meses correspondentes no sistema. Deseja continuar?")) {
        e.target.value = null; 
        return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', companyId);

    try {
        await axios.post(`${BASE_URL}/api/import/dre`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert("Importação concluída com sucesso! Os dados do BI foram atualizados.");
        
        // Recarrega histórico
        const resHist = await axios.get(`${BASE_URL}/api/entries/history?companyId=${companyId}`);
        setHistory(resHist.data);
        
        // Força reload do mês atual
        const [y, m] = currentMonth.split('-');
        setCurrentMonth(`${y}-${m}`); 
        
    } catch (error) {
        alert("Erro na importação. Verifique se a planilha segue o modelo padrão.");
        console.error(error);
    } finally {
        setIsUploading(false);
        e.target.value = null; 
    }
  };

  const handleDeleteEntry = async (date) => {
      if(!confirm("Deseja apagar este registro histórico?")) return;
      try {
          await axios.delete(`${BASE_URL}/api/entries`, { params: { companyId, month: date } });
          const res = await axios.get(`${BASE_URL}/api/entries/history?companyId=${companyId}`);
          setHistory(res.data);
          
          if(date === `${currentMonth}-01`) {
              setForm(INITIAL_FORM_STATE);
              setDetails([]);
          }
      } catch(e) { alert('Erro ao excluir'); }
  };

  const formatCurrency = (value) => {
      const num = Number(value);
      if (isNaN(num)) return 'R$ 0,00';
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  
  const filteredPartners = partners.filter(p => newItem.type === 'REVENUE' ? (p.type === 'CLIENT' || p.type === 'BOTH') : (p.type === 'SUPPLIER' || p.type === 'BOTH'));

  return (
    <div className="max-w-7xl mx-auto pb-20 px-6 animate-in fade-in duration-700">
      
      {/* Input Oculto para Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />

      {/* CABEÇALHO */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center py-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <div className="w-1.5 h-8 bg-blue-600 rounded-full"/> Vector Connect Enterprises
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest text-[10px]">Gestão de Competência Mensal</p>
        </div>

        <div className="flex items-center gap-3">
           
           {/* BOTÃO DE IMPORTAÇÃO */}
           <button 
             onClick={() => fileInputRef.current.click()} 
             disabled={isUploading}
             className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl text-xs font-black hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 uppercase tracking-widest active:scale-95"
           >
             {isUploading ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>}
             Importar DRE
           </button>

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
      <div className="relative mb-12">
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
                        <input 
                            type="text" 
                            placeholder="Histórico / Descrição..." 
                            value={newItem.description} 
                            onChange={e => setNewItem({...newItem, description: e.target.value})} 
                            className="flex-1 text-xs font-bold border-none rounded-xl p-4 bg-slate-800 text-slate-200 outline-none ring-1 ring-white/5 focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600" 
                        />
                        <div className="relative w-28">
                            <span className="absolute left-3 top-4 text-[10px] font-bold text-slate-500">R$</span>
                            <input 
                                type="number" 
                                placeholder="0.00" 
                                value={newItem.amount} 
                                onChange={e => setNewItem({...newItem, amount: e.target.value})} 
                                className="w-full text-sm font-black border-none rounded-xl p-4 pl-8 bg-slate-800 text-blue-400 outline-none ring-1 ring-white/5 font-mono focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
                            />
                        </div>
                        <button 
                            type="button" 
                            onClick={() => { 
                                // VALIDAÇÃO COM FEEDBACK
                                if (!newItem.category_id) return alert("Selecione uma Classificação Contábil.");
                                if (!newItem.amount || Number(newItem.amount) <= 0) return alert("Informe um valor válido.");
                                
                                // ADICIONA À LISTA
                                setDetails([...details, { ...newItem, id: Date.now() }]); 
                                
                                // LIMPA CAMPOS (Mantém tipo e categoria para agilizar digitação em massa)
                                setNewItem({ ...newItem, amount: '', description: '' }); 
                            }} 
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl transition shadow-lg active:scale-95 flex items-center justify-center"
                            title="Adicionar Item"
                        >
                            <Plus size={20}/>
                        </button>
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
                // CORREÇÃO: Somar as colunas individuais
                const totalRev = 
                  Number(item.revenue_resale || 0) + 
                  Number(item.revenue_product || 0) + 
                  Number(item.revenue_service || 0) + 
                  Number(item.revenue_rent || 0) + 
                  Number(item.revenue_other || 0);

                const totalTax = 
                  Number(item.tax_icms || 0) + 
                  Number(item.tax_difal || 0) + 
                  Number(item.tax_iss || 0) + 
                  Number(item.tax_pis || 0) + 
                  Number(item.tax_cofins || 0) + 
                  Number(item.tax_csll || 0) + 
                  Number(item.tax_irpj || 0) + 
                  Number(item.tax_additional_irpj || 0) + 
                  Number(item.tax_fust || 0) + 
                  Number(item.tax_funtell || 0);

                const totalCost = Number(item.purchases_total || 0) + Number(item.expenses_total || 0);
                const itemProfit = totalRev - totalTax - totalCost;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-10 py-6 font-bold uppercase">{item.period_start.substring(0, 7)}</td>
                    <td className="px-10 py-6 text-right font-mono">{formatCurrency(totalRev)}</td>
                    <td className={`px-10 py-6 text-right font-mono font-black ${itemProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(itemProfit)}</td>
                    <td className="px-10 py-6 text-center flex justify-center gap-2">
                        <button onClick={() => setCurrentMonth(item.period_start.substring(0, 7))} className="p-2.5 text-slate-300 hover:text-blue-600 transition-colors"><Edit3 size={18} /></button>
                        <button onClick={() => handleDeleteEntry(item.period_start)} className="p-2.5 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {history.length === 0 && <div className="p-20 text-center font-bold text-slate-300 italic text-xs uppercase tracking-[0.3em]">Nenhum registro encontrado.</div>}
        </div>
      </div>

      {/* MODAL DE CLONAGEM - VERSÃO CORRIGIDA */}
      <AnimatePresence>
        {showCloneModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative">
                    <button onClick={() => setShowCloneModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-4"><Copy size={32}/></div>
                        <h3 className="text-xl font-black text-slate-900">Clonar Competência</h3>
                        <p className="text-xs text-slate-500 font-medium mt-2">Copia todos os lançamentos de um mês para outro.</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Origem (Copia deste)</label>
                            <input disabled value={currentMonth} className="w-full p-3 bg-slate-100 rounded-xl font-bold text-slate-500 text-center border-none outline-none"/>
                        </div>
                        
                        <div className="flex justify-center"><ArrowDownCircle className="text-slate-300"/></div>
                        
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Destino (Cola neste)</label>
                            <input 
                                type="month" 
                                value={cloneTarget} 
                                onChange={(e) => setCloneTarget(e.target.value)}
                                className="w-full p-3 bg-white border-2 border-amber-100 focus:border-amber-400 rounded-xl font-bold text-slate-700 text-center outline-none transition-colors"
                            />
                        </div>

                        <button 
                            type="button" 
                            onClick={async () => {
                                if (!cloneTarget) return alert("Por favor, selecione o mês de destino.");
                                if (cloneTarget === currentMonth) return alert("O mês de destino deve ser diferente da origem.");

                                try {
                                    const btn = document.getElementById('btn-clonar');
                                    if(btn) btn.innerText = "Clonando...";

                                    await axios.post(`${BASE_URL}/api/entries/clone`, {
                                        companyId,
                                        sourceMonth: currentMonth,
                                        targetMonth: cloneTarget
                                    });

                                    alert("✅ Mês clonado com sucesso!");
                                    setShowCloneModal(false);
                                    setCloneTarget(''); 
                                    
                                    const resHist = await axios.get(`${BASE_URL}/api/entries/history?companyId=${companyId}`);
                                    setHistory(resHist.data);

                                } catch (err) {
                                    const msg = err.response?.data?.error || err.message;
                                    alert(`❌ Erro ao clonar: ${msg}`);
                                } finally {
                                    const btn = document.getElementById('btn-clonar');
                                    if(btn) btn.innerText = "Confirmar Cópia";
                                }
                            }}
                            id="btn-clonar"
                            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-200 transition-all mt-2 active:scale-95"
                        >
                            Confirmar Cópia
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FinancialEntries;