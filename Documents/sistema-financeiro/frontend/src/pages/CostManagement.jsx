import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Building2, Users, Briefcase, Landmark, TrendingUp,
  Plus, Trash2, Wallet, X, Box, 
  Percent, DollarSign, PieChart, Calculator, Truck,
  BarChart3, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';

ChartJS.register(ArcElement, Tooltip, Legend);

const CostManagement = ({ apiBase, selectedCompanyId }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  const user = JSON.parse(localStorage.getItem('hdl_user'));

  // Estados de Navegação
  const [activeTab, setActiveTab] = useState('operational'); 
  const [opSubTab, setOpSubTab] = useState('fixed'); 
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Estados de Dados
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [prolabore, setProlabore] = useState([]);
  const [channels, setChannels] = useState([]);

  // Estados de Formulário
  const [fixedForm, setFixedForm] = useState({ name: '', amount: '' });
  const [payForm, setPayForm] = useState({ employee_name: '', role: '', total_cost: '' });
  const [proForm, setProForm] = useState({ partner_name: '', total_cost: '' });

  // Controle de Blocos e Modais
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isCreateBlockModalOpen, setIsCreateBlockModalOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  
  // Modal de Confirmação Genérico
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });

  // Projeção Financeira
  const [projectedRevenue, setProjectedRevenue] = useState(100000); 

  // --- 1. CARREGAMENTO DE DADOS ---
  const fetchData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [resFixed, resPay, resPro, resChan] = await Promise.all([
        axios.get(`${BASE_URL}/api/fixed-expenses?companyId=${selectedCompanyId}`),
        axios.get(`${BASE_URL}/api/payroll?companyId=${selectedCompanyId}`),
        axios.get(`${BASE_URL}/api/prolabore?companyId=${selectedCompanyId}`),
        axios.get(`${BASE_URL}/api/sales-channels?companyId=${selectedCompanyId}`)
      ]);
      setFixedExpenses(resFixed.data); 
      setPayroll(resPay.data); 
      setProlabore(resPro.data); 
      setChannels(resChan.data);
    } catch (error) { console.error("Erro dados:", error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [selectedCompanyId, refreshTrigger]);

  // --- 2. CÁLCULOS TOTAIS (GLOBAL) ---
  // Definidos aqui no topo para evitar ReferenceError
  const totalFixed = fixedExpenses.reduce((a,b) => a + Number(b.amount), 0);
  const totalPayroll = payroll.reduce((a,b) => a + Number(b.total_cost), 0);
  const totalProlabore = prolabore.reduce((a,b) => a + Number(b.total_cost), 0);
  const totalOperationalCost = totalFixed + totalPayroll + totalProlabore;
  
  // Sugestões de Rateio (Calculadora)
  const suggestedFixedRate = projectedRevenue > 0 ? (totalFixed / projectedRevenue) * 100 : 0;
  const suggestedPayrollRate = projectedRevenue > 0 ? ((totalPayroll + totalProlabore) / projectedRevenue) * 100 : 0;

  // --- 3. ACTIONS (SALVAR, DELETAR, ATUALIZAR) ---

  const handleSaveOp = async (e, type) => {
    e.preventDefault();
    let endpoint, payload, reset;
    if (type === 'fixed') { endpoint = 'fixed-expenses'; payload = fixedForm; reset = () => setFixedForm({ name: '', amount: '' }); }
    if (type === 'payroll') { endpoint = 'payroll'; payload = payForm; reset = () => setPayForm({ employee_name: '', role: '', total_cost: '' }); }
    if (type === 'prolabore') { endpoint = 'prolabore'; payload = proForm; reset = () => setProForm({ partner_name: '', total_cost: '' }); }
    
    await axios.post(`${BASE_URL}/api/${endpoint}`, { ...payload, company_id: selectedCompanyId });
    reset(); setRefreshTrigger(p => p + 1);
  };

  const requestDeleteOp = (endpoint, id) => {
    setConfirmModal({
        isOpen: true,
        title: 'Remover Item',
        message: 'Tem certeza? O custo operacional total será afetado.',
        action: async () => {
            await axios.delete(`${BASE_URL}/api/${endpoint}/${id}`);
            setRefreshTrigger(p => p + 1);
            setConfirmModal({ isOpen: false, title: '', message: '', action: null });
        }
    });
  };

  const handleCreateBlock = async () => {
    if (!newBlockName) return;
    try {
        await axios.post(`${BASE_URL}/api/sales-channels`, { company_id: selectedCompanyId, name: newBlockName, userId: user?.id, userName: user?.full_name });
        setNewBlockName('');
        setIsCreateBlockModalOpen(false);
        setRefreshTrigger(p => p + 1);
    } catch (e) { alert('Erro ao criar.'); }
  };

  const requestDeleteBlock = (id) => {
    setConfirmModal({
        isOpen: true,
        title: 'Excluir Bloco',
        message: 'Atenção: Todas as regras fiscais e de markup deste bloco serão perdidas.',
        action: async () => {
            await axios.delete(`${BASE_URL}/api/sales-channels/${id}`, { params: { userId: user?.id, userName: user?.full_name } });
            setSelectedBlock(null);
            setRefreshTrigger(p => p + 1);
            setConfirmModal({ isOpen: false, title: '', message: '', action: null });
        }
    });
  };

  const handleUpdateRule = async (channelId, field, value) => {
    const updatedChannels = channels.map(c => c.id === channelId ? { ...c, [field]: value } : c);
    setChannels(updatedChannels);
    if (selectedBlock && selectedBlock.id === channelId) setSelectedBlock({ ...selectedBlock, [field]: value });
    const channel = updatedChannels.find(c => c.id === channelId);
    try { await axios.put(`${BASE_URL}/api/sales-channels/${channelId}`, { ...channel, userId: user?.id, userName: user?.full_name }); } catch(e) { console.error(e); }
  };

  const requestApplyRate = () => {
    setConfirmModal({
        isOpen: true,
        title: 'Atualizar Todos os Blocos',
        message: `Aplicar taxa de ${suggestedFixedRate.toFixed(2)}% (Fixos) e ${suggestedPayrollRate.toFixed(2)}% (Pessoal) em TODOS os blocos de Markup?`,
        action: async () => {
            try {
                const updates = channels.map(c => axios.put(`${BASE_URL}/api/sales-channels/${c.id}`, { 
                    ...c, 
                    fixed_expenses_rate_percent: suggestedFixedRate.toFixed(2),
                    payroll_rate_percent: suggestedPayrollRate.toFixed(2)
                }));
                await Promise.all(updates);
                setRefreshTrigger(p => p + 1);
            } catch(e) { alert('Erro.'); } 
            finally { setConfirmModal({ isOpen: false, title: '', message: '', action: null }); }
        }
    });
  };

  // --- 4. COMPONENTES VISUAIS ---

  const RuleRow = ({ label, value, field, color="text-slate-600", readOnly=false }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-50 hover:bg-slate-50 px-2 rounded-lg transition-colors">
        <span className={`text-[11px] font-bold uppercase tracking-wide flex items-center gap-2 ${color}`}>{label}</span>
        <div className="relative w-20">
            <input 
                type="number" 
                step="0.01" 
                value={value} 
                readOnly={readOnly}
                onChange={(e) => !readOnly && handleUpdateRule(selectedBlock.id, field, e.target.value)}
                className={`w-full text-right bg-transparent font-mono font-bold text-slate-800 text-sm outline-none border-b ${readOnly ? 'border-transparent' : 'border-slate-200 focus:border-blue-500'}`}
            />
            <span className="absolute right-0 -bottom-3 text-[9px] text-slate-400 font-bold">%</span>
        </div>
    </div>
  );

  const SectionHeader = ({ title, icon: Icon, color }) => (
    <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${color.replace('text-', 'border-')}/20 mt-6 first:mt-0`}>
        <Icon size={14} className={color}/>
        <h4 className={`text-xs font-black uppercase tracking-widest ${color}`}>{title}</h4>
    </div>
  );

  const renderMiniChart = (block, type) => {
    if (type === 'taxes') {
        const t = Number(block.icms_out_percent) + Number(block.pis_out_percent) + Number(block.cofins_out_percent) + Number(block.ipi_out_percent) + Number(block.difal_out_percent) + Number(block.ir_csll_percent);
        return { data: { labels: ['Carga'], datasets: [{ data: [t, 100-t], backgroundColor: ['#6366f1', '#f1f5f9'], borderWidth: 0 }] }, total: t, color: 'text-indigo-600' };
    } else {
        const profit = Number(block.profit_margin_percent);
        return { data: { labels: ['Lucro', 'Custos'], datasets: [{ data: [profit, 100-profit], backgroundColor: ['#10b981', '#f1f5f9'], borderWidth: 0 }] }, total: profit, color: 'text-emerald-600' };
    }
  };

  if (!selectedCompanyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><Wallet size={48} className="mb-4 opacity-20"/><p className="font-bold uppercase tracking-widest text-xs">Selecione uma empresa</p></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-700 pb-32">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic flex items-center gap-3">
            <Wallet className="text-blue-600" size={32}/> Gestão Financeira
          </h1>
          <p className="text-slate-400 font-medium text-xs mt-1 uppercase tracking-widest">
            Centro de Custos & Configuração de Blocos
          </p>
        </div>
        
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
            <button onClick={() => { setActiveTab('operational'); setSelectedBlock(null); }} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'operational' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><Building2 size={16}/> Operacional</button>
            <div className="w-px h-6 bg-slate-200 self-center mx-1"/>
            <button onClick={() => { setActiveTab('taxes'); setSelectedBlock(null); }} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'taxes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-600 hover:bg-indigo-50'}`}><Landmark size={16}/> Módulo Fiscal</button>
            <button onClick={() => { setActiveTab('markup'); setSelectedBlock(null); }} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'markup' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}><TrendingUp size={16}/> Módulo Markup</button>
        </div>
      </div>

      {/* --- ABA OPERACIONAL --- */}
      {activeTab === 'operational' && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
            <div className="flex gap-4 mb-8 border-b border-slate-100 pb-4">
                {['fixed', 'payroll', 'prolabore'].map(tab => (
                    <button key={tab} onClick={() => setOpSubTab(tab)} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${opSubTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>
                        {tab === 'fixed' ? 'Custos Fixos' : tab === 'payroll' ? 'Folha Pgto' : 'Pro-labore'}
                    </button>
                ))}
            </div>
            <div className="animate-in fade-in">
                <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-6 rounded-3xl border border-slate-200 mb-6">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                            {opSubTab === 'fixed' ? 'Total Fixos' : opSubTab === 'payroll' ? 'Total Folha' : 'Total Retiradas'}
                        </p>
                        <p className="text-3xl font-black text-slate-900">
                            R$ {(opSubTab === 'fixed' ? totalFixed : opSubTab === 'payroll' ? totalPayroll : totalProlabore).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </p>
                    </div>
                    <form onSubmit={(e) => handleSaveOp(e, opSubTab)} className="flex gap-2">
                        <input required placeholder={opSubTab === 'fixed' ? 'Nome' : opSubTab === 'payroll' ? 'Funcionário' : 'Sócio'} value={opSubTab === 'fixed' ? fixedForm.name : opSubTab === 'payroll' ? payForm.employee_name : proForm.partner_name} onChange={e => { if(opSubTab==='fixed') setFixedForm({...fixedForm, name:e.target.value}); else if(opSubTab==='payroll') setPayForm({...payForm, employee_name:e.target.value}); else setProForm({...proForm, partner_name:e.target.value}); }} className="p-3 rounded-xl border text-xs font-bold outline-none w-48"/>
                        {opSubTab === 'payroll' && <input placeholder="Cargo" value={payForm.role} onChange={e=>setPayForm({...payForm, role:e.target.value})} className="p-3 rounded-xl border text-xs font-bold outline-none w-32"/>}
                        <input required type="number" step="0.01" placeholder="R$" value={opSubTab === 'fixed' ? fixedForm.amount : opSubTab === 'payroll' ? payForm.total_cost : proForm.total_cost} onChange={e => { if(opSubTab==='fixed') setFixedForm({...fixedForm, amount:e.target.value}); else if(opSubTab==='payroll') setPayForm({...payForm, total_cost:e.target.value}); else setProForm({...proForm, total_cost:e.target.value}); }} className="p-3 rounded-xl border w-32 text-xs font-bold outline-none"/>
                        <button className="bg-slate-900 text-white p-3 rounded-xl hover:scale-105 transition"><Plus size={18}/></button>
                    </form>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(opSubTab === 'fixed' ? fixedExpenses : opSubTab === 'payroll' ? payroll : prolabore).map(i => (
                        <div key={i.id} className="p-4 border border-slate-100 rounded-xl flex justify-between items-center bg-white group hover:shadow-md transition">
                            <div className="flex items-center gap-3"><div className="p-2 bg-slate-50 rounded-lg text-slate-400">{opSubTab === 'fixed' ? <Building2 size={16}/> : opSubTab === 'payroll' ? <Users size={16}/> : <Briefcase size={16}/>}</div><div><p className="font-bold text-slate-700 text-xs uppercase">{i.name || i.employee_name || i.partner_name}</p>{i.role && <p className="text-[9px] font-bold text-slate-400">{i.role}</p>}</div></div>
                            <div className="flex items-center gap-3"><span className="font-bold text-sm text-slate-900">R$ {Number(i.amount || i.total_cost).toLocaleString('pt-BR')}</span><button onClick={() => requestDeleteOp(opSubTab === 'fixed' ? 'fixed-expenses' : opSubTab === 'payroll' ? 'payroll' : 'prolabore', i.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14}/></button></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* --- ABA BLOCOS (FISCAL E MARKUP) --- */}
      {(activeTab === 'taxes' || activeTab === 'markup') && (
        <div className="space-y-8 animate-in fade-in">
            
            {/* CALCULADORA (SOMENTE MARKUP) */}
            {activeTab === 'markup' && (
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none"/>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-8 items-center">
                        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Wallet size={14}/> Custo Operacional</p><h2 className="text-4xl font-black font-mono tracking-tighter text-white">R$ {totalOperationalCost.toLocaleString('pt-BR', {minimumFractionDigits: 0})}</h2></div>
                        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><TrendingUp size={14}/> Faturamento Estimado</p><div className="flex items-center gap-2 bg-white/10 rounded-2xl p-3 border border-white/10"><span className="text-emerald-400 font-black text-xs">R$</span><input type="number" value={projectedRevenue} onChange={(e) => setProjectedRevenue(parseFloat(e.target.value) || 0)} className="bg-transparent text-xl font-bold text-white outline-none w-full font-mono"/></div></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rateio Fixos</p>
                            <span className="text-2xl font-black text-emerald-400">{suggestedFixedRate.toFixed(2)}%</span>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-end border-b border-white/10 pb-2"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rateio Pessoal</span><span className="text-2xl font-black text-emerald-400">{suggestedPayrollRate.toFixed(2)}%</span></div>
                            <button onClick={requestApplyRate} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"><RefreshCw size={14}/> Atualizar Todos</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header do Módulo */}
            <div className={`p-8 rounded-[2.5rem] border flex justify-between items-center ${activeTab === 'taxes' ? 'bg-indigo-50 border-indigo-100 text-indigo-900' : 'bg-emerald-50 border-emerald-100 text-emerald-900'}`}>
                <div>
                    <h2 className={`text-2xl font-black uppercase tracking-tighter flex items-center gap-3 ${activeTab === 'taxes' ? 'text-indigo-900' : 'text-emerald-900'}`}>
                        {activeTab === 'taxes' ? <Landmark size={28}/> : <BarChart3 size={28}/>}
                        {activeTab === 'taxes' ? 'Blocos Fiscais' : 'Blocos de Estratégia'}
                    </h2>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${activeTab === 'taxes' ? 'text-indigo-400' : 'text-emerald-500'}`}>
                        {activeTab === 'taxes' ? 'Gerencie as regras de impostos por bloco' : 'Defina margens e custos por bloco'}
                    </p>
                </div>
                <button onClick={() => setIsCreateBlockModalOpen(true)} className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 text-white ${activeTab === 'taxes' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                    <Plus size={18}/> Novo Bloco
                </button>
            </div>

            {/* GRID DE BLOCOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {channels.map(block => {
                    const { data, total, color, label } = renderMiniChart(block, activeTab);
                    return (
                        <div key={block.id} onClick={() => setSelectedBlock(block)} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 hover:shadow-2xl hover:border-transparent transition-all cursor-pointer group relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className={`p-3 rounded-2xl bg-slate-50 ${color}`}><Box size={24}/></div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                    <p className={`text-2xl font-black tracking-tighter ${color}`}>{total.toFixed(2)}%</p>
                                </div>
                            </div>
                            <div className="h-32 flex items-center justify-center relative mb-4"><Doughnut data={data} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }} /></div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight truncate text-center">{block.name}</h3>
                            <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Editar</p>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* --- MODAL DE EDIÇÃO DE REGRAS (ESTRUTURA DA PLANILHA) --- */}
      {selectedBlock && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex justify-end transition-all" onClick={() => setSelectedBlock(null)}>
            <div className="bg-white w-full max-w-lg h-full shadow-2xl p-0 overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
                
                {/* Header Modal */}
                <div className={`p-8 pb-6 border-b ${activeTab === 'taxes' ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/50 ${activeTab === 'taxes' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                            {activeTab === 'taxes' ? 'Regras Fiscais' : 'Estratégia de Preço'}
                        </span>
                        <button onClick={() => setSelectedBlock(null)} className="p-2 hover:bg-white/50 rounded-full transition"><X size={20}/></button>
                    </div>
                    <h2 className={`text-3xl font-black uppercase tracking-tighter ${activeTab === 'taxes' ? 'text-indigo-900' : 'text-emerald-900'}`}>{selectedBlock.name}</h2>
                </div>

                <div className="p-8 space-y-8 flex-1">
                    {/* CAMPOS FISCAIS (Conforme Imagem 2) */}
                    {activeTab === 'taxes' && (
                        <div>
                            <SectionHeader title="Impostos sobre Venda (Produto Final)" icon={Landmark} color="text-indigo-600"/>
                            <div className="space-y-1">
                                <RuleRow label="ICMS (Alíquota)" field="icms_out_percent" value={selectedBlock.icms_out_percent} color="text-indigo-600"/>
                                <RuleRow label="PIS" field="pis_out_percent" value={selectedBlock.pis_out_percent}/>
                                <RuleRow label="COFINS" field="cofins_out_percent" value={selectedBlock.cofins_out_percent}/>
                                <RuleRow label="IPI (Saída)" field="ipi_out_percent" value={selectedBlock.ipi_out_percent}/>
                                <RuleRow label="DIFAL" field="difal_out_percent" value={selectedBlock.difal_out_percent}/>
                                <RuleRow label="IR / CSLL (Estimado)" field="ir_csll_percent" value={selectedBlock.ir_csll_percent}/>
                            </div>
                        </div>
                    )}

                    {/* CAMPOS MARKUP (Conforme Imagem 1) */}
                    {activeTab === 'markup' && (
                        <>
                            <div>
                                <SectionHeader title="Encargos Variáveis" icon={TrendingUp} color="text-rose-600"/>
                                <div className="space-y-1">
                                    <RuleRow label="Comissão Vendas" field="commission_percent" value={selectedBlock.commission_percent}/>
                                    <RuleRow label="Marketing / Propaganda" field="marketing_percent" value={selectedBlock.marketing_percent}/>
                                    <RuleRow label="Frete Entrega (%)" field="freight_percent" value={selectedBlock.freight_percent}/>
                                    <RuleRow label="Inadimplência (Risco)" field="default_rate_percent" value={selectedBlock.default_rate_percent}/>
                                    <RuleRow label="Custo Financeiro" field="financial_cost_percent" value={selectedBlock.financial_cost_percent}/>
                                </div>
                            </div>

                            <div>
                                <SectionHeader title="Estrutura e Rateio" icon={Building2} color="text-slate-600"/>
                                <div className="space-y-1">
                                    <RuleRow label="Despesas Fixas (Rateio)" field="fixed_expenses_rate_percent" value={selectedBlock.fixed_expenses_rate_percent}/>
                                    <RuleRow label="Salários / Pro-labore (Rateio)" field="payroll_rate_percent" value={selectedBlock.payroll_rate_percent}/>
                                </div>
                            </div>

                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <SectionHeader title="Objetivo de Resultado" icon={DollarSign} color="text-emerald-600"/>
                                <RuleRow label="Margem de Lucro (Líquida)" field="profit_margin_percent" value={selectedBlock.profit_margin_percent} color="text-emerald-700"/>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-center">
                    <button onClick={() => requestDeleteBlock(selectedBlock.id)} className="text-rose-400 text-xs font-black uppercase tracking-widest hover:text-rose-600 flex items-center gap-2 transition"><Trash2 size={14}/> Excluir este Bloco</button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL CRIAR BLOCO --- */}
      {isCreateBlockModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mb-6 mx-auto"><Box size={32}/></div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Novo Bloco</h3>
                <p className="text-slate-500 text-sm mb-8 font-medium">Crie um agrupador (Ex: B2B PR).</p>
                <input autoFocus type="text" placeholder="Nome do Bloco" value={newBlockName} onChange={e => setNewBlockName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/20 mb-6"/>
                <div className="flex gap-3 pt-2"><button onClick={() => setIsCreateBlockModalOpen(false)} className="flex-1 py-4 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition">Cancelar</button><button onClick={handleCreateBlock} className="flex-1 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition shadow-xl hover:-translate-y-1">Criar</button></div>
            </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32}/></div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">{confirmModal.title}</h3>
                    <p className="text-slate-500 text-sm mb-8 font-medium">{confirmModal.message}</p>
                    <div className="flex gap-3 w-full"><button onClick={() => setConfirmModal({...confirmModal, isOpen: false})} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-xs uppercase">Cancelar</button><button onClick={confirmModal.action} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase">Confirmar</button></div>
                </div>
            </motion.div>
        </div>
      )}

    </div>
  );
};

export default CostManagement;