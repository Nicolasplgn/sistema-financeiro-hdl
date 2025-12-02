import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { 
  Save, AlertCircle, CheckCircle, Search, 
  ArrowRight, Copy, TrendingUp, Wallet, Receipt, History 
} from 'lucide-react';

const MoneyInput = ({ label, value, onChange, color = "blue" }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
    <div className="relative group">
      <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-medium group-focus-within:text-slate-600">R$</span>
      <input 
          type="number" step="0.01" placeholder="0,00"
          value={value === 0 ? '' : value}
          onChange={e => onChange(e.target.value)}
          className={`w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-none transition-all font-medium text-slate-700 focus:ring-2 focus:ring-${color}-100 focus:border-${color}-500 hover:border-slate-300`}
      />
    </div>
  </div>
);

const FinancialEntries = () => {
  const { selectedCompany } = useAuth();
  const [competence, setCompetence] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('revenue');
  const [form, setForm] = useState({
    revenue: { resale: 0, product: 0, service: 0, rent: 0, other: 0 },
    taxes: { icms: 0, difal: 0, iss: 0, fust: 0, funtell: 0, pis: 0, cofins: 0, csll: 0, irpj: 0, additionalIrpj: 0 },
    costs: { purchases: 0, expenses: 0 },
    notes: ''
  });

  const totalRevenue = Object.values(form.revenue).reduce((acc, val) => acc + (Number(val) || 0), 0);
  const totalTaxes = Object.values(form.taxes).reduce((acc, val) => acc + (Number(val) || 0), 0);
  const totalCosts = (Number(form.costs.purchases) || 0) + (Number(form.costs.expenses) || 0);
  const profitPreview = totalRevenue - totalTaxes - totalCosts;

  const toBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const loadData = async (dateToLoad, isCopyAction = false) => {
    if (!selectedCompany?.id) return;
    setLoading(true);
    if (!isCopyAction) setMessage(null);
    try {
      const response = await api.get('/entries', { params: { companyId: selectedCompany.id, month: dateToLoad } });
      const data = response.data;
      if (data) {
        setForm({
            revenue: { resale: data.revenue_resale, product: data.revenue_product, service: data.revenue_service, rent: data.revenue_rent, other: data.revenue_other },
            taxes: { icms: data.tax_icms, difal: data.tax_difal, iss: data.tax_iss, fust: data.tax_fust, funtell: data.tax_funtell, pis: data.tax_pis, cofins: data.tax_cofins, csll: data.tax_csll, irpj: data.tax_irpj, additionalIrpj: data.tax_additional_irpj },
            costs: { purchases: data.purchases_total, expenses: data.expenses_total },
            notes: data.notes || ''
        });
        if (isCopyAction) setMessage({ type: 'success', text: 'Dados copiados! Ajuste e salve.' });
        else setMessage({ type: 'info', text: 'Editando lançamento existente.' });
      } else {
        if (isCopyAction) setMessage({ type: 'error', text: 'Sem dados anteriores.' });
        else setForm({ revenue: { resale: 0, product: 0, service: 0, rent: 0, other: 0 }, taxes: { icms: 0, difal: 0, iss: 0, fust: 0, funtell: 0, pis: 0, cofins: 0, csll: 0, irpj: 0, additionalIrpj: 0 }, costs: { purchases: 0, expenses: 0 }, notes: '' });
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(competence); }, [competence, selectedCompany]);

  const handleCopyPrevious = () => {
    const [year, month] = competence.split('-');
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    const prevYear = date.getFullYear();
    const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
    if (window.confirm(`Copiar valores de ${prevMonth}/${prevYear}?`)) loadData(`${prevYear}-${prevMonth}-01`, true);
  };

  const handleChange = (section, field, value) => {
    const cleanValue = value === '' ? '' : value; 
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: cleanValue } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Selecione uma empresa.');
    setLoading(true);
    try {
        const [year, month] = competence.split('-');
        const lastDay = new Date(year, month, 0).getDate();
        const payload = {
            companyId: selectedCompany.id,
            periodStart: competence,
            periodEnd: `${year}-${month}-${lastDay}`,
            revenue: Object.fromEntries(Object.entries(form.revenue).map(([k, v]) => [k, Number(v) || 0])),
            taxes: Object.fromEntries(Object.entries(form.taxes).map(([k, v]) => [k, Number(v) || 0])),
            purchasesTotal: Number(form.costs.purchases) || 0,
            expensesTotal: Number(form.costs.expenses) || 0,
            notes: form.notes
        };
        await api.post('/entries', payload);
        setMessage({ type: 'success', text: 'Lançamento salvo com sucesso!' });
    } catch (error) { setMessage({ type: 'error', text: 'Erro ao salvar.' }); } finally { setLoading(false); }
  };

  if (!selectedCompany) return <div className="p-8 text-center text-slate-500">Selecione uma empresa.</div>;

  return (
    <div className="max-w-5xl mx-auto pb-32">
        <div className="flex flex-col md:flex-row justify-between items-end border-b pb-6 mb-6 gap-4">
            <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Receipt className="text-blue-600"/> Lançamentos</h1></div>
            <div className="flex items-end gap-3 bg-white p-2 rounded-xl border shadow-sm">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Competência</label><input type="date" value={competence} onChange={(e) => { const [y, m] = e.target.value.split('-'); setCompetence(`${y}-${m}-01`); }} className="border rounded-lg p-2 text-sm font-bold" /></div>
                <button onClick={handleCopyPrevious} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 flex items-center gap-2 text-sm font-semibold h-[38px]"><Copy size={16} /> Copiar Anterior</button>
            </div>
        </div>
        {message && <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{message.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}<span className="font-medium">{message.text}</span></div>}

        <form onSubmit={handleSubmit}>
            <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
              {['revenue', 'taxes', 'costs'].map(tab => (
                 <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {tab === 'revenue' && <TrendingUp size={18} className="text-blue-500"/>}
                    {tab === 'taxes' && <History size={18} className="text-red-500"/>}
                    {tab === 'costs' && <Wallet size={18} className="text-orange-500"/>}
                    {tab === 'revenue' ? '1. Faturamento' : tab === 'taxes' ? '2. Impostos' : '3. Custos'}
                 </button>
              ))}
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[400px]">
                {activeTab === 'revenue' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Detalhamento de Receita</h3><span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">Total: {toBRL(totalRevenue)}</span></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Object.keys(form.revenue).map(key => (<MoneyInput key={key} label={key === 'resale' ? 'Revenda' : key === 'product' ? 'Venda de Produtos' : key === 'service' ? 'Serviços' : key === 'rent' ? 'Locação' : 'Outras Receitas'} value={form.revenue[key]} onChange={val => handleChange('revenue', key, val)} color="blue" />))}</div>
                    <div className="mt-8 flex justify-end"><button type="button" onClick={() => setActiveTab('taxes')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">Próximo <ArrowRight size={18} /></button></div>
                  </div>
                )}
                {activeTab === 'taxes' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Carga Tributária</h3><span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm font-bold">Total: {toBRL(totalTaxes)}</span></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">{Object.keys(form.taxes).map(key => (<MoneyInput key={key} label={key.replace('additionalIrpj', 'Add. IRPJ').toUpperCase()} value={form.taxes[key]} onChange={val => handleChange('taxes', key, val)} color="red" />))}</div>
                    <div className="mt-8 flex justify-end gap-3"><button type="button" onClick={() => setActiveTab('revenue')} className="text-slate-500 px-6 py-3 font-semibold hover:bg-slate-50 rounded-xl">Voltar</button><button type="button" onClick={() => setActiveTab('costs')} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">Próximo <ArrowRight size={18} /></button></div>
                  </div>
                )}
                {activeTab === 'costs' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Saídas e Despesas</h3><span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">Total: {toBRL(totalCosts)}</span></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl"><MoneyInput label="Compras (Mercadorias / Insumos)" value={form.costs.purchases} onChange={val => handleChange('costs', 'purchases', val)} color="orange" /><MoneyInput label="Despesas Operacionais (Geral)" value={form.costs.expenses} onChange={val => handleChange('costs', 'expenses', val)} color="orange" /></div>
                    <div className="mt-8 pt-6 border-t"><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Observações</label><textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full border p-3 rounded-xl text-sm outline-none" rows="3" /></div>
                    <div className="mt-8 flex justify-end"><button type="button" onClick={() => setActiveTab('taxes')} className="text-slate-500 px-6 py-3 font-semibold hover:bg-slate-50 rounded-xl">Voltar</button></div>
                  </div>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-40">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-6 md:gap-12 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase">Receita Líquida</p><p className="font-mono font-bold text-slate-700 text-lg">{toBRL(totalRevenue - totalTaxes)}</p></div>
                        <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase">Lucro Final</p><p className={`font-mono font-bold text-xl ${profitPreview >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{toBRL(profitPreview)}</p></div>
                    </div>
                    <button type="submit" disabled={loading} className="bg-slate-900 hover:bg-black text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center gap-3 w-full md:w-auto justify-center">{loading ? 'Processando...' : <><Save size={20} /> Salvar Lançamento</>}</button>
                </div>
            </div>
        </form>
    </div>
  );
};

export default FinancialEntries;