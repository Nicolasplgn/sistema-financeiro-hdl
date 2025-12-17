import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, CheckCircle, DollarSign, TrendingUp, 
  ArrowDownCircle, FileText, Calendar, Building2, Calculator, 
  Eraser, History, Trash2, Edit3, ChevronDown, ChevronUp, 
  Plus, X, Users 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_FORM_STATE = {
  revenue: { resale: 0, product: 0, service: 0, rent: 0, other: 0 },
  taxes: { icms: 0, difal: 0, iss: 0, fust: 0, funtell: 0, pis: 0, cofins: 0, csll: 0, irpj: 0, additionalIrpj: 0 },
  purchasesTotal: 0,
  expensesTotal: 0,
  notes: ''
};

const MoneyInput = ({ label, value, onChange }) => {
  const handleChange = (e) => {
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
          value={value ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
          onChange={handleChange}
          placeholder="0,00"
          className="w-full pl-6 py-1.5 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none transition-all font-mono text-slate-700 font-medium text-lg placeholder:text-slate-300"
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
    <div className="grid gap-5">
      {children}
    </div>
  </div>
);

const FinancialEntries = ({ companyId, apiBase }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  
  const [currentMonth, setCurrentMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  
  // --- NOVOS ESTADOS PARA A LISTA DE ITENS ---
  const [details, setDetails] = useState([]); 
  const [newItem, setNewItem] = useState({ partner_id: '', amount: '', type: 'REVENUE' });
  
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [partners, setPartners] = useState([]); 
  const [showForm, setShowForm] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  // Cálculos Totais
  const sumValues = (obj) => Object.values(obj).reduce((a, b) => Number(a) + Number(b), 0);
  const totals = useMemo(() => {
    const totalRev = sumValues(form.revenue);
    const totalTax = sumValues(form.taxes);
    const totalCost = Number(form.purchasesTotal) + Number(form.expensesTotal);
    const profit = totalRev - totalTax - totalCost;
    const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;
    return { totalRev, totalTax, totalCost, profit, margin };
  }, [form]);

  // --- EFEITO MÁGICO: SOMA AUTOMÁTICA ---
  // Quando a lista 'details' muda, atualiza os totais lá em cima
  useEffect(() => {
    if (details.length === 0) return;

    // Soma tudo que é despesa na lista
    const sumExpenses = details
      .filter(d => d.type === 'EXPENSE')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    // Soma tudo que é receita extra na lista
    const sumRevenueExtras = details
      .filter(d => d.type === 'REVENUE')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);

    setForm(prev => ({
        ...prev,
        // Se a lista de despesas tiver valor, ela SOBRESCREVE o campo manual de Despesas Operacionais
        expensesTotal: sumExpenses > 0 ? sumExpenses : prev.expensesTotal,
        revenue: {
            ...prev.revenue,
            // Soma nas 'Outras Receitas'
            other: sumRevenueExtras > 0 ? sumRevenueExtras : prev.revenue.other
        }
    }));
  }, [details]);

  // Carrega Parceiros
  useEffect(() => {
    if (!companyId) return;
    const loadPartners = async () => { 
        try { 
            const res = await fetch(`${BASE_URL}/api/partners/${companyId}`); 
            if(res.ok) setPartners(await res.json()); 
        } catch(e) { console.error("Erro parceiros", e); } 
    };
    loadPartners();
    fetchHistory();
  }, [companyId, BASE_URL]);

  const fetchHistory = async () => { 
      try { 
          const res = await fetch(`${BASE_URL}/api/entries/history?companyId=${companyId}`); 
          if (res.ok) setHistory(await res.json()); 
      } catch (e) { console.error("Erro histórico", e); } 
  };

  // Carrega Lançamento do Mês
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
          // Se tiver detalhes salvos no banco, carrega na lista
          setDetails(data.details || []); 
          setShowForm(true);
        } else {
          setForm(INITIAL_FORM_STATE);
          setDetails([]);
        }
        setStatus(null);
      } catch (e) { 
        setForm(INITIAL_FORM_STATE); 
        setDetails([]); 
        setStatus(null); 
      }
    };
    loadEntry();
  }, [companyId, currentMonth, BASE_URL]);

  const updateForm = (section, field, value) => { 
      if (section) setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } })); 
      else setForm(prev => ({ ...prev, [field]: value })); 
  };

  // Handlers da Lista
  const handleAddItem = () => {
    if (!newItem.partner_id || !newItem.amount) return alert("Selecione parceiro e valor");
    setDetails([...details, { ...newItem, id: Date.now() }]); // Adiciona na memória
    setNewItem({ ...newItem, amount: '' }); // Limpa input
  };

  const handleRemoveItem = (idx) => {
    const newDetails = [...details];
    newDetails.splice(idx, 1);
    setDetails(newDetails);
  };

  const handleSave = async () => {
    if (!companyId) return alert("Selecione uma empresa.");
    setStatus('saving');
    try {
      // Manda tudo pro backend: ID, Data, Valores Totais e a Lista de Detalhes
      const payload = { 
          companyId, 
          periodStart: `${currentMonth}-01`, 
          periodEnd: `${currentMonth}-28`, 
          ...form,
          details 
      };
      
      const res = await fetch(`${BASE_URL}/api/entries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { 
          setStatus('success'); 
          setTimeout(() => setStatus(null), 3000); 
          fetchHistory(); 
      } else {
          setStatus('error');
      }
    } catch (e) { setStatus('error'); }
  };

  const handleDelete = async (date) => { 
      if (!window.confirm("Tem certeza?")) return; 
      try { 
          const res = await fetch(`${BASE_URL}/api/entries?companyId=${companyId}&month=${date}`, { method: 'DELETE' }); 
          if (res.ok) { 
              fetchHistory(); 
              if (date === `${currentMonth}-01`) { 
                  setForm(INITIAL_FORM_STATE); 
                  setDetails([]); 
              } 
          } 
      } catch (e) { alert("Erro ao excluir."); } 
  };

  const loadFromHistory = (date) => { 
      setCurrentMonth(date.substring(0, 7)); 
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
      setShowForm(true); 
  };
  
  const f = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  // Filtra parceiros para o dropdown (se selecionar Receita, mostra clientes; se Despesa, fornecedores)
  const filteredPartners = partners.filter(p => newItem.type === 'REVENUE' ? (p.type === 'CLIENT' || p.type === 'BOTH') : (p.type === 'SUPPLIER' || p.type === 'BOTH'));

  if (!companyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><Building2 size={48} className="mb-4 opacity-20"/><p>Selecione uma empresa.</p></div>;

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4 pt-2">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2"><DollarSign className="text-blue-600" /> Lançamentos</h1>
            <p className="text-slate-500 text-sm mt-1">Preencha os dados contábeis do mês.</p>
        </div>
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex items-center">
            <Calendar size={18} className="text-slate-400 ml-3" />
            <input type="month" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="border-none bg-transparent text-slate-700 font-bold text-sm focus:ring-0 outline-none cursor-pointer px-3 py-1.5"/>
        </div>
      </div>

      {/* Resumo Topo */}
      <div className="sticky top-0 z-40 pb-6 pt-2 -mt-2 bg-gray-50/95 backdrop-blur-sm">
        <motion.div layout className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border border-slate-700">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="p-3 bg-white/10 rounded-xl"><Calculator size={24} className="text-blue-400"/></div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Resultado ({currentMonth})</p>
              <div className="flex items-baseline gap-2">
                <h2 className={`text-3xl font-bold ${totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{f(totals.profit)}</h2>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${totals.profit >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>{totals.margin.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div className="flex gap-8 text-sm w-full md:w-auto justify-around md:justify-end border-t md:border-t-0 border-slate-700 pt-4 md:pt-0">
            <div><p className="text-slate-500 mb-1">Receita</p><p className="font-mono text-emerald-400 font-bold">{f(totals.totalRev)}</p></div>
            <div><p className="text-slate-500 mb-1">Impostos</p><p className="font-mono text-amber-400 font-bold">{f(totals.totalTax)}</p></div>
            <div><p className="text-slate-500 mb-1">Custos</p><p className="font-mono text-rose-400 font-bold">{f(totals.totalCost)}</p></div>
          </div>
        </motion.div>
      </div>

      {/* Formulário */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Edit3 size={20} className="text-slate-400" /> Detalhes</h2>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 text-sm text-blue-600 font-bold bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">{showForm ? 'Minimizar' : 'Expandir'} {showForm ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-1">
                
                {/* COLUNA 1: RECEITAS + LISTA */}
                <div className="space-y-6">
                    <InputSection title="Receitas (Entradas)" icon={TrendingUp} color="text-emerald-600">
                        <MoneyInput label="Revenda de Mercadorias" value={form.revenue.resale} onChange={v => updateForm('revenue', 'resale', v)} />
                        <MoneyInput label="Venda de Produtos" value={form.revenue.product} onChange={v => updateForm('revenue', 'product', v)} />
                        <MoneyInput label="Prestação de Serviços" value={form.revenue.service} onChange={v => updateForm('revenue', 'service', v)} />
                        <MoneyInput label="Locação de Bens" value={form.revenue.rent} onChange={v => updateForm('revenue', 'rent', v)} />
                        {/* Campo Automático */}
                        <div className="relative group border-l-4 border-emerald-400 pl-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Outras Receitas (Lista)</label>
                            <div className="relative"><span className="absolute left-0 top-2 text-slate-400 font-medium text-sm">R$</span><input type="text" readOnly value={form.revenue.other ? Number(form.revenue.other).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} className="w-full pl-6 py-1.5 bg-slate-50 border-b border-slate-200 font-mono text-slate-600 font-medium text-lg cursor-not-allowed"/></div>
                        </div>
                    </InputSection>

                    {/* MÓDULO DE LISTA DE ITENS */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><Plus size={16} className="text-blue-600"/> Detalhar Parceiros</h3>
                        
                        <div className="flex gap-2 mb-4 bg-slate-50 p-1 rounded-lg">
                           <button onClick={() => setNewItem({...newItem, type: 'REVENUE'})} className={`flex-1 py-1 text-xs font-bold rounded-md transition ${newItem.type === 'REVENUE' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500'}`}>Receita</button>
                           <button onClick={() => setNewItem({...newItem, type: 'EXPENSE'})} className={`flex-1 py-1 text-xs font-bold rounded-md transition ${newItem.type === 'EXPENSE' ? 'bg-rose-500 text-white shadow' : 'text-slate-500'}`}>Despesa</button>
                        </div>
                        
                        <div className="flex gap-2 mb-2">
                           <select value={newItem.partner_id} onChange={e => setNewItem({...newItem, partner_id: e.target.value})} className="flex-1 text-sm border rounded-lg p-2 outline-none focus:border-blue-500 bg-white">
                              <option value="">Selecione...</option>
                              {filteredPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                           </select>
                           <input type="number" placeholder="0.00" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})} className="w-24 text-sm border rounded-lg p-2 outline-none focus:border-blue-500"/>
                           <button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Plus size={18}/></button>
                        </div>
                        
                        <div className="max-h-40 overflow-y-auto space-y-2">
                            {details.map((item, idx) => {
                                const partnerName = partners.find(p => p.id == item.partner_id)?.name || 'Desconhecido';
                                return (
                                    <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${item.type === 'REVENUE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                            <span className="font-medium text-slate-700 truncate max-w-[120px]" title={partnerName}>{partnerName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-slate-600">{f(item.amount)}</span>
                                            <button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                                        </div>
                                    </div>
                                );
                            })}
                            {details.length === 0 && <p className="text-center text-xs text-slate-300 py-2">Nenhum item adicionado</p>}
                        </div>
                    </div>
                </div>

                {/* COLUNA 2: IMPOSTOS */}
                <InputSection title="Impostos (Deduções)" icon={FileText} color="text-amber-600">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                    <MoneyInput label="DAS / Simples" value={form.taxes.icms} onChange={v => updateForm('taxes', 'icms', v)} />
                    <MoneyInput label="PIS" value={form.taxes.pis} onChange={v => updateForm('taxes', 'pis', v)} />
                    <MoneyInput label="COFINS" value={form.taxes.cofins} onChange={v => updateForm('taxes', 'cofins', v)} />
                    <MoneyInput label="ISS" value={form.taxes.iss} onChange={v => updateForm('taxes', 'iss', v)} />
                    <MoneyInput label="IRPJ" value={form.taxes.irpj} onChange={v => updateForm('taxes', 'irpj', v)} />
                    <MoneyInput label="CSLL" value={form.taxes.csll} onChange={v => updateForm('taxes', 'csll', v)} />
                    <MoneyInput label="ICMS / DIFAL" value={form.taxes.difal} onChange={v => updateForm('taxes', 'difal', v)} />
                    <MoneyInput label="Outros" value={form.taxes.additionalIrpj} onChange={v => updateForm('taxes', 'additionalIrpj', v)} />
                  </div>
                </InputSection>
                
                {/* COLUNA 3: CUSTOS */}
                <div className="space-y-6">
                  <InputSection title="Custos & Despesas" icon={ArrowDownCircle} color="text-rose-600">
                    <MoneyInput label="Compras (Fornecedores)" value={form.purchasesTotal} onChange={v => updateForm(null, 'purchasesTotal', v)} />
                    {/* Campo Automático */}
                    <div className="relative group border-l-4 border-rose-400 pl-3">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Despesas Operacionais (Lista)</label>
                         <div className="relative"><span className="absolute left-0 top-2 text-slate-400 font-medium text-sm">R$</span><input type="text" readOnly value={form.expensesTotal ? Number(form.expensesTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} className="w-full pl-6 py-1.5 bg-slate-50 border-b border-slate-200 font-mono text-slate-600 font-medium text-lg cursor-not-allowed"/></div>
                    </div>
                  </InputSection>

                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Anotações</label><textarea value={form.notes} onChange={(e) => updateForm(null, 'notes', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-slate-700" placeholder="Obs..."/></div>
                  <div className="flex gap-3"><button onClick={() => setForm(INITIAL_FORM_STATE)} className="px-4 py-4 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition" title="Limpar"><Eraser size={20} /></button><button onClick={handleSave} disabled={status === 'saving'} className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 ${status === 'success' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-blue-600 hover:bg-blue-700'}`}>{status === 'saving' ? <span className="animate-pulse">Salvando...</span> : status === 'success' ? <><CheckCircle size={20}/> Salvo!</> : <><Save size={20}/> Salvar Dados</>}</button></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-8"><div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History size={20} className="text-slate-400" /> Histórico</h2><button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition">{showHistory ? 'Ocultar' : 'Ver Histórico'} {showHistory ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button></div><AnimatePresence>{showHistory && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">{history.length === 0 ? (<div className="p-8 text-center text-slate-400">Nenhum lançamento anterior.</div>) : (<table className="w-full text-left"><thead className="bg-slate-50 border-b border-slate-100"><tr><th className="p-4 text-xs font-bold text-slate-500 uppercase">Período</th><th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Faturamento</th><th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Lucro</th><th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-50">{history.map((item) => { const itemProfit = item.total_revenue - item.total_taxes - item.total_costs; return (<tr key={item.id} className="hover:bg-slate-50 transition-colors group"><td className="p-4 font-bold text-slate-700">{item.period_start.substring(0, 7)}</td><td className="p-4 text-right font-mono text-sm text-slate-600">{f(item.total_revenue)}</td><td className={`p-4 text-right font-mono text-sm font-bold ${itemProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{f(itemProfit)}</td><td className="p-4 text-right flex justify-end gap-2"><button onClick={() => loadFromHistory(item.period_start)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"><Edit3 size={16} /></button><button onClick={() => handleDelete(item.period_start)} className="p-2 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition"><Trash2 size={16} /></button></td></tr>); })}</tbody></table>)}</div></motion.div>)}</AnimatePresence></div>
    </div>
  );
};

export default FinancialEntries;