// ARQUIVO: src/pages/CostManagement.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Building2, Users, Briefcase, Landmark, TrendingUp,
  Plus, Trash2, Wallet, X, Box, 
  Percent, DollarSign, PieChart, Calculator, Truck,
  BarChart3, RefreshCw, AlertTriangle, Edit3, Wand2
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader } from '../components/ui/Card';
import { ConfirmationModal } from '../components/ui/ConfirmationModal'; // <--- IMPORTADO

ChartJS.register(ArcElement, Tooltip, Legend);

const CostManagement = ({ apiBase, selectedCompanyId }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  const user = JSON.parse(localStorage.getItem('hdl_user'));

  // Estados
  const [activeTab, setActiveTab] = useState('operational'); 
  const [opSubTab, setOpSubTab] = useState('fixed'); 
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Dados
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [prolabore, setProlabore] = useState([]);
  const [channels, setChannels] = useState([]);

  // Forms
  const [fixedForm, setFixedForm] = useState({ name: '', amount: '' });
  const [payForm, setPayForm] = useState({ employee_name: '', role: '', total_cost: '' });
  const [proForm, setProForm] = useState({ partner_name: '', total_cost: '' });

  // Modais e Controles
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isCreateBlockModalOpen, setIsCreateBlockModalOpen] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  
  // ESTADO DO MODAL BONITO
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    description: '',
    variant: 'info',
    onConfirm: () => {}
  });

  // Projeção
  const [projectedRevenue, setProjectedRevenue] = useState(100000); 

  // --- FUNÇÃO AUXILIAR PARA ABRIR O MODAL ---
  const openConfirm = (title, description, onConfirm, variant = 'info') => {
    setModalConfig({ isOpen: true, title, description, onConfirm, variant });
  };

  // --- CARREGAMENTO ---
  useEffect(() => {
    if (!selectedCompanyId) return;
    setLoading(true);
    const loadData = async () => {
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
    loadData();
  }, [selectedCompanyId, refreshTrigger]);

  // --- CÁLCULOS ---
  const totalFixed = fixedExpenses.reduce((a,b) => a + Number(b.amount), 0);
  const totalPayroll = payroll.reduce((a,b) => a + Number(b.total_cost), 0);
  const totalProlabore = prolabore.reduce((a,b) => a + Number(b.total_cost), 0);
  const totalOperationalCost = totalFixed + totalPayroll + totalProlabore;
  
  const suggestedFixedRate = projectedRevenue > 0 ? (totalFixed / projectedRevenue) * 100 : 0;
  const suggestedPayrollRate = projectedRevenue > 0 ? ((totalPayroll + totalProlabore) / projectedRevenue) * 100 : 0;

  // --- AÇÕES ---
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
    // Substituindo window.confirm pelo modal bonito
    openConfirm(
      "Remover Item de Custo?", 
      "Essa ação removerá o valor do cálculo total e não poderá ser desfeita.", 
      () => axios.delete(`${BASE_URL}/api/${endpoint}/${id}`).then(() => setRefreshTrigger(p => p + 1)),
      "danger"
    );
  };

  const handleCreateBlock = async () => {
    if (!newBlockName) return;
    await axios.post(`${BASE_URL}/api/sales-channels`, { company_id: selectedCompanyId, name: newBlockName, userId: user?.id });
    setNewBlockName(''); setIsCreateBlockModalOpen(false); setRefreshTrigger(p => p + 1);
  };

  // CRIAÇÃO EM MASSA (PADRÕES) - COM MODAL BONITO
  const handleCreateDefaults = () => {
    openConfirm(
      "Gerar Blocos Padrão",
      "Isso criará automaticamente os blocos: Online, B2B PR, B2B Fora e Exportação. Deseja continuar?",
      async () => {
        setLoading(true);
        try {
            const defaults = ["Venda Online", "Venda B2B (PR)", "Venda B2B (Fora)", "Venda Exportação"];
            const promises = defaults.map(name => 
                axios.post(`${BASE_URL}/api/sales-channels`, { 
                    company_id: selectedCompanyId, 
                    name: name, 
                    userId: user?.id 
                })
            );
            await Promise.all(promises);
            setRefreshTrigger(p => p + 1);
        } catch (error) {
            alert("Erro ao criar blocos padrão.");
        } finally {
            setLoading(false);
        }
      },
      "info"
    );
  };

  const requestDeleteBlock = (id) => {
    openConfirm(
      "Excluir Bloco de Estratégia?",
      "Você perderá todas as regras fiscais e de markup configuradas neste bloco.",
      async () => {
        await axios.delete(`${BASE_URL}/api/sales-channels/${id}`, { params: { userId: user?.id } });
        setSelectedBlock(null); setRefreshTrigger(p => p + 1);
      },
      "danger"
    );
  };

  const handleUpdateRule = async (channelId, field, value) => {
    const updatedChannels = channels.map(c => c.id === channelId ? { ...c, [field]: value } : c);
    setChannels(updatedChannels);
    if (selectedBlock?.id === channelId) setSelectedBlock({ ...selectedBlock, [field]: value });
    const channel = updatedChannels.find(c => c.id === channelId);
    try { await axios.put(`${BASE_URL}/api/sales-channels/${channelId}`, { ...channel, userId: user?.id }); } catch(e) { console.error(e); }
  };

  const requestApplyRate = () => {
    openConfirm(
      "Atualizar Taxas em Massa",
      `Aplicar taxa de ${suggestedFixedRate.toFixed(2)}% (Fixos) e ${suggestedPayrollRate.toFixed(2)}% (Pessoal) em TODOS os blocos existentes?`,
      () => {
        const updates = channels.map(c => axios.put(`${BASE_URL}/api/sales-channels/${c.id}`, { 
            ...c, fixed_expenses_rate_percent: suggestedFixedRate.toFixed(2), payroll_rate_percent: suggestedPayrollRate.toFixed(2)
        }));
        Promise.all(updates).then(() => setRefreshTrigger(p => p + 1));
      },
      "info"
    );
  };

  // ... (Restante do código de renderização igual)
  const renderMiniChart = (block, type) => {
    if (type === 'taxes') {
        const t = Number(block.icms_out_percent) + Number(block.pis_out_percent) + Number(block.cofins_out_percent) + Number(block.ipi_out_percent) + Number(block.difal_out_percent) + Number(block.ir_csll_percent);
        return { data: { labels: ['Carga'], datasets: [{ data: [t, 100-t], backgroundColor: ['#6366f1', '#f1f5f9'], borderWidth: 0 }] }, total: t, color: 'text-indigo-600' };
    } else {
        const profit = Number(block.profit_margin_percent);
        return { data: { labels: ['Lucro', 'Custos'], datasets: [{ data: [profit, 100-profit], backgroundColor: ['#10b981', '#f1f5f9'], borderWidth: 0 }] }, total: profit, color: 'text-emerald-600' };
    }
  };

  const RuleRow = ({ label, value, field, readOnly=false }) => (
    <div className="flex justify-between items-center py-3 border-b border-slate-50 hover:bg-slate-50 px-3 rounded-lg transition-colors">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{label}</span>
        <div className="relative w-24">
            <input 
                type="number" step="0.01" value={value} readOnly={readOnly}
                onChange={(e) => !readOnly && handleUpdateRule(selectedBlock.id, field, e.target.value)}
                className={`w-full text-right bg-transparent font-mono font-bold text-slate-800 text-sm outline-none border-b ${readOnly ? 'border-transparent' : 'border-slate-300 focus:border-blue-500'}`}
            />
            <span className="absolute right-0 -bottom-4 text-[9px] text-slate-400 font-bold">%</span>
        </div>
    </div>
  );

  if (!selectedCompanyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><Wallet size={48} className="mb-4 opacity-20"/><p className="font-bold uppercase tracking-widest text-xs">Selecione uma empresa</p></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-32">
      
      {/* COMPONENTE DO MODAL INSERIDO AQUI */}
      <ConfirmationModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        description={modalConfig.description}
        variant={modalConfig.variant}
      />

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic flex items-center gap-3">
            <Wallet className="text-blue-600" size={32}/> Gestão Financeira
          </h1>
          <p className="text-slate-400 font-medium text-xs mt-1 uppercase tracking-widest">
            Centro de Custos & Configuração de Blocos
          </p>
        </div>
        
        {/* NAVEGAÇÃO SUPERIOR */}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
            <button onClick={() => { setActiveTab('operational'); setSelectedBlock(null); }} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'operational' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}><Building2 size={16}/> Operacional</button>
            <div className="w-px h-6 bg-slate-200 self-center mx-1"/>
            <button onClick={() => { setActiveTab('taxes'); setSelectedBlock(null); }} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'taxes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-600 hover:bg-indigo-50'}`}><Landmark size={16}/> Módulo Fiscal</button>
            <button onClick={() => { setActiveTab('markup'); setSelectedBlock(null); }} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'markup' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}><TrendingUp size={16}/> Módulo Markup</button>
        </div>
      </div>

      {/* --- ABA OPERACIONAL --- */}
      {activeTab === 'operational' && (
        <Card>
            <div className="flex gap-4 mb-8 border-b border-slate-100 pb-4">
                {['fixed', 'payroll', 'prolabore'].map(tab => (
                    <button key={tab} onClick={() => setOpSubTab(tab)} className={`text-xs font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${opSubTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>
                        {tab === 'fixed' ? 'Custos Fixos' : tab === 'payroll' ? 'Folha Pgto' : 'Pro-labore'}
                    </button>
                ))}
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-6 rounded-3xl border border-slate-200 mb-6">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Consolidado</p>
                    <p className="text-3xl font-black text-slate-900">R$ {(opSubTab === 'fixed' ? totalFixed : opSubTab === 'payroll' ? totalPayroll : totalProlabore).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                <form onSubmit={(e) => handleSaveOp(e, opSubTab)} className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
                    <input required placeholder="Descrição" value={opSubTab === 'fixed' ? fixedForm.name : opSubTab === 'payroll' ? payForm.employee_name : proForm.partner_name} onChange={e => { if(opSubTab==='fixed') setFixedForm({...fixedForm, name:e.target.value}); else if(opSubTab==='payroll') setPayForm({...payForm, employee_name:e.target.value}); else setProForm({...proForm, partner_name:e.target.value}); }} className="flex-1 p-3 rounded-xl border border-slate-200 text-xs font-bold outline-none"/>
                    {opSubTab === 'payroll' && <input placeholder="Cargo" value={payForm.role} onChange={e=>setPayForm({...payForm, role:e.target.value})} className="w-24 p-3 rounded-xl border border-slate-200 text-xs font-bold outline-none"/>}
                    <input required type="number" step="0.01" placeholder="R$" value={opSubTab === 'fixed' ? fixedForm.amount : opSubTab === 'payroll' ? payForm.total_cost : proForm.total_cost} onChange={e => { if(opSubTab==='fixed') setFixedForm({...fixedForm, amount:e.target.value}); else if(opSubTab==='payroll') setPayForm({...payForm, total_cost:e.target.value}); else setProForm({...proForm, total_cost:e.target.value}); }} className="w-28 p-3 rounded-xl border border-slate-200 text-xs font-bold outline-none"/>
                    <button className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition shadow-lg"><Plus size={18}/></button>
                </form>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(opSubTab === 'fixed' ? fixedExpenses : opSubTab === 'payroll' ? payroll : prolabore).map(i => (
                    <div key={i.id} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-center bg-white hover:border-blue-200 hover:shadow-md transition group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                {opSubTab === 'fixed' ? <Building2 size={16}/> : <Users size={16}/>}
                            </div>
                            <div><p className="font-bold text-slate-700 text-xs uppercase">{i.name || i.employee_name || i.partner_name}</p>{i.role && <p className="text-[9px] font-bold text-slate-400">{i.role}</p>}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-sm text-slate-900">R$ {Number(i.amount || i.total_cost).toLocaleString('pt-BR')}</span>
                            <button onClick={() => requestDeleteOp(opSubTab === 'fixed' ? 'fixed-expenses' : opSubTab === 'payroll' ? 'payroll' : 'prolabore', i.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
      )}

      {/* --- ABA BLOCOS (FISCAL E MARKUP) --- */}
      {(activeTab === 'taxes' || activeTab === 'markup') && (
        <div className="space-y-8 animate-in fade-in">
            
            {/* CALCULADORA (APENAS MARKUP) */}
            {activeTab === 'markup' && (
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none"/>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-8 items-center">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Wallet size={14}/> Custo Operacional</p>
                            <h2 className="text-4xl font-black font-mono tracking-tighter text-white">R$ {totalOperationalCost.toLocaleString('pt-BR', {minimumFractionDigits: 0})}</h2>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><TrendingUp size={14}/> Faturamento Estimado</p>
                            <div className="flex items-center gap-2 bg-white/10 rounded-2xl p-3 border border-white/10 focus-within:bg-white/20 transition-all">
                                <span className="text-emerald-400 font-black text-xs">R$</span>
                                <input type="number" value={projectedRevenue} onChange={(e) => setProjectedRevenue(parseFloat(e.target.value) || 0)} className="bg-transparent text-xl font-bold text-white outline-none w-full font-mono"/>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rateio Fixos</p>
                            <span className="text-3xl font-black text-emerald-400 tracking-tighter">{suggestedFixedRate.toFixed(2)}%</span>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rateio Pessoal</span>
                                <span className="text-2xl font-black text-emerald-400">{suggestedPayrollRate.toFixed(2)}%</span>
                            </div>
                            <button onClick={requestApplyRate} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"><RefreshCw size={14}/> Atualizar Todos</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER DA SEÇÃO DE BLOCOS */}
            <div className={`p-8 rounded-[2.5rem] border flex flex-col md:flex-row justify-between items-center gap-6 ${activeTab === 'taxes' ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <div>
                    <h2 className={`text-2xl font-black uppercase tracking-tighter flex items-center gap-3 ${activeTab === 'taxes' ? 'text-indigo-900' : 'text-emerald-900'}`}>
                        {activeTab === 'taxes' ? <Landmark size={28}/> : <BarChart3 size={28}/>}
                        {activeTab === 'taxes' ? 'Blocos Fiscais' : 'Blocos de Estratégia'}
                    </h2>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${activeTab === 'taxes' ? 'text-indigo-400' : 'text-emerald-600/70'}`}>
                        {activeTab === 'taxes' ? 'Gerencie as regras de impostos por bloco' : 'Defina margens e custos por bloco'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleCreateDefaults}
                        className={`px-4 py-4 rounded-2xl shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center bg-white ${activeTab === 'taxes' ? 'text-indigo-600' : 'text-emerald-600'}`}
                        title="Criar Blocos Padrão (Online, B2B, Exportação)"
                    >
                        <Wand2 size={20}/>
                    </button>
                    <button onClick={() => setIsCreateBlockModalOpen(true)} className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 text-white ${activeTab === 'taxes' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        <Plus size={18}/> Novo Bloco
                    </button>
                </div>
            </div>

            {/* GRID DE BLOCOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {channels.map(block => {
                    const { data, total, color, label } = renderMiniChart(block, activeTab);
                    return (
                        <div key={block.id} onClick={() => setSelectedBlock(block)} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 hover:shadow-2xl hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden h-[320px] flex flex-col justify-between">
                            
                            <div className="flex justify-between items-start z-10">
                                <div className={`p-3 rounded-2xl bg-slate-50 ${color} group-hover:scale-110 transition-transform`}><Box size={24}/></div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                    <p className={`text-2xl font-black tracking-tighter ${color}`}>{total.toFixed(2)}%</p>
                                </div>
                            </div>
                            
                            <div className="h-28 flex items-center justify-center relative my-4">
                                <Doughnut data={data} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }} />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit3 size={24} className="text-slate-300"/>
                                </div>
                            </div>
                            
                            <div className="text-center z-10">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate px-2">{block.name}</h3>
                                <button className="mt-4 w-full py-2.5 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                    Editar Regras
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* --- MODAL DE EDIÇÃO --- */}
      {selectedBlock && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex justify-end transition-all" onClick={() => setSelectedBlock(null)}>
            <div className="bg-white w-full max-w-lg h-full shadow-2xl p-0 overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
                
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
                    {activeTab === 'taxes' && (
                        <div>
                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-indigo-100 pb-2"><Landmark size={14}/> Tributos de Saída</h4>
                            <div className="space-y-1">
                                <RuleRow label="ICMS (Alíquota)" field="icms_out_percent" value={selectedBlock.icms_out_percent}/>
                                <RuleRow label="PIS" field="pis_out_percent" value={selectedBlock.pis_out_percent}/>
                                <RuleRow label="COFINS" field="cofins_out_percent" value={selectedBlock.cofins_out_percent}/>
                                <RuleRow label="IPI (Saída)" field="ipi_out_percent" value={selectedBlock.ipi_out_percent}/>
                                <RuleRow label="DIFAL" field="difal_out_percent" value={selectedBlock.difal_out_percent}/>
                                <RuleRow label="IR / CSLL (Estimado)" field="ir_csll_percent" value={selectedBlock.ir_csll_percent}/>
                            </div>
                        </div>
                    )}

                    {activeTab === 'markup' && (
                        <>
                            <div>
                                <h4 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-rose-100 pb-2"><TrendingUp size={14}/> Custos Variáveis</h4>
                                <div className="space-y-1">
                                    <RuleRow label="Comissão Vendas" field="commission_percent" value={selectedBlock.commission_percent}/>
                                    <RuleRow label="Marketing / Ads" field="marketing_percent" value={selectedBlock.marketing_percent}/>
                                    <RuleRow label="Frete Entrega (%)" field="freight_percent" value={selectedBlock.freight_percent}/>
                                    <RuleRow label="Inadimplência" field="default_rate_percent" value={selectedBlock.default_rate_percent}/>
                                    <RuleRow label="Custo Financeiro" field="financial_cost_percent" value={selectedBlock.financial_cost_percent}/>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2"><Building2 size={14}/> Estrutura & Rateio</h4>
                                <div className="space-y-1">
                                    <RuleRow label="Despesas Fixas" field="fixed_expenses_rate_percent" value={selectedBlock.fixed_expenses_rate_percent}/>
                                    <RuleRow label="Folha / Pro-labore" field="payroll_rate_percent" value={selectedBlock.payroll_rate_percent}/>
                                    <RuleRow label="Administrativo" field="administrative_cost_percent" value={selectedBlock.administrative_cost_percent}/>
                                </div>
                            </div>

                            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2"><DollarSign size={14}/> Resultado Alvo</h4>
                                <RuleRow label="Margem de Lucro" field="profit_margin_percent" value={selectedBlock.profit_margin_percent}/>
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
    </div>
  );
};

export default CostManagement;