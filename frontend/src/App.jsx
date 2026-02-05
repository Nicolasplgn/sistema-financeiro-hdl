import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, DollarSign, Building2, ChevronLeft, ChevronRight, LogOut, Users, ShieldAlert,
  FileText, XCircle, Briefcase, Zap, BrainCircuit, Activity, Layers, Target, CloudLightning, Lock, Tag, Box, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Importação das Páginas
import Dashboard from './pages/Dashboard';
import FinancialEntries from './pages/FinancialEntries';
import IntelligenceHub from './pages/IntelligenceHub';
import AnalyticalProjections from './pages/AnalyticalProjections';
import Companies from './pages/Companies';
import Partners from './pages/Partners';
import AuditLogs from './pages/AuditLogs';
import DRE from './pages/DRE';
import Login from './pages/Login';
import QuestorManager from './pages/QuestorManager';
import PricingSimulator from './pages/PricingSimulator'; 
import ProductManager from './pages/ProductManager';
import CostManagement from './pages/CostManagement';
import AdminPanel from './pages/AdminPanel';

// Configuração da API
const API_BASE = `http://${window.location.hostname}:4000`;

// --- COMPONENTE DE RESTRIÇÃO ---
const GroupRestriction = ({ moduleName }) => (
  <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-700 p-8">
    <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner relative">
      <Layers size={48} className="text-slate-300" />
      <div className="absolute -right-2 -bottom-2 bg-slate-900 text-white p-3 rounded-2xl border-4 border-slate-50">
        <Lock size={20} />
      </div>
    </div>
    <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter italic">
      Modo Consolidado Ativo
    </h2>
    <p className="text-slate-500 mb-8 text-sm font-medium leading-relaxed max-w-md">
      O módulo <strong>{moduleName}</strong> requer dados granulares e está disponível apenas na visualização individual por unidade (CNPJ).
    </p>
  </div>
);

// --- COMPONENTE SIDEBAR ISOLADO (Para preservar scroll) ---
const Sidebar = ({ user, activeTab, setActiveTab, isCollapsed, setIsCollapsed, onLogout }) => {
    // Menu Config
    const menuItems = [
        { section: 'Master Control', role: 'SUPER_ADMIN', items: [
            { id: 'admin_panel', icon: ShieldAlert, label: 'Central de Clientes', color: 'text-rose-500' }
        ]},
        { section: 'Inteligência', items: [
            { id: 'dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
            { id: 'pricing', icon: Tag, label: 'Simulador Preços', color: 'text-amber-500' },
            { id: 'products_manager', icon: Box, label: 'Cadastro / Custos', color: 'text-emerald-500' },
            { id: 'inteligencia', icon: BrainCircuit, label: 'Monitor de Saúde', color: 'text-emerald-500' },
            { id: 'analytical', icon: Activity, label: 'Projeções BI', color: 'text-blue-400' },
        ]},
        { section: 'Financeiro', items: [
            { id: 'dre', icon: FileText, label: 'DRE Gerencial' },
            { id: 'entries', icon: DollarSign, label: 'Lançamentos' },
            { id: 'costs', icon: Wallet, label: 'Gestão Financeira', color: 'text-rose-500' },
        ]},
        { section: 'Gestão', items: [
            { id: 'companies', icon: Building2, label: 'Empresas & Grupos' },
            { id: 'partners', icon: Users, label: 'Parceiros' },
            { id: 'audit', icon: ShieldAlert, label: 'Logs', color: 'text-slate-400' },
            { id: 'questor', icon: CloudLightning, label: 'Integração Questor', color: 'text-purple-500' },
        ]}
    ];

    return (
        <aside className={`${isCollapsed ? 'w-24' : 'w-72'} bg-slate-900 h-full flex-shrink-0 transition-all duration-500 z-50 flex flex-col border-r border-slate-800 shadow-2xl relative`}>
            {/* Logo */}
            <div className="h-24 flex items-center justify-center border-b border-white/5 relative shrink-0">
                <div className={`flex items-center transition-all duration-500 gap-4 ${isCollapsed ? 'px-0' : 'px-6'}`}>
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-600/30 transform rotate-3">V</div>
                    {!isCollapsed && (
                        <div className="flex flex-col">
                            <span className="text-white font-black text-xl tracking-tighter leading-none">VECTOR</span>
                            <span className="text-blue-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1">Enterprise</span>
                        </div>
                    )}
                </div>
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-blue-600 rounded-full text-white flex items-center justify-center shadow-2xl border-2 border-slate-900 hover:bg-blue-500 transition-all z-50">
                    {isCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
                </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-8 px-4 space-y-8 custom-scrollbar" id="sidebar-scroll-container">
                {menuItems.map((group, idx) => {
                    if (group.role && user?.role !== group.role) return null;
                    return (
                        <div key={idx}>
                            {!isCollapsed && <p className="px-4 text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2 animate-in fade-in slide-in-from-left-2">{group.section}</p>}
                            <div className="space-y-1">
                                {group.items.map(item => {
                                    const isActive = activeTab === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-200 group relative
                                                ${isActive ? 'bg-white/10 text-white shadow-lg backdrop-blur-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                                                ${isCollapsed ? 'justify-center' : 'justify-start'}
                                            `}
                                            title={isCollapsed ? item.label : ''}
                                        >
                                            <item.icon size={20} className={`flex-shrink-0 ${isActive ? (item.color?.replace('text-', 'text-') || 'text-blue-400') : (item.color || 'text-slate-400')} transition-colors`} />
                                            {!isCollapsed && <span className="font-bold text-sm tracking-tight truncate">{item.label}</span>}
                                            {isActive && !isCollapsed && <motion.div layoutId="active-indicator" className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-black/20 shrink-0">
                <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg uppercase shrink-0">{user.full_name.charAt(0)}</div>
                        {!isCollapsed && (
                            <div className="overflow-hidden">
                                <p className="text-sm font-black text-white truncate">{user.full_name.split(' ')[0]}</p>
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest truncate">{user.role}</p>
                            </div>
                        )}
                    </div>
                    <button onClick={onLogout} className="text-slate-500 hover:text-rose-500 transition-all p-2.5 rounded-xl shrink-0"><LogOut size={20} /></button>
                </div>
            </div>
        </aside>
    );
};

const App = () => {
  // --- ESTADOS ---
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('hdl_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
  });

  const [selectedEntity, setSelectedEntity] = useState(() => {
    try {
      const stored = localStorage.getItem('vector_entity');
      return stored ? JSON.parse(stored) : { type: null, id: null, name: '' };
    } catch (e) { return { type: null, id: null, name: '' }; }
  });

  const [activeTab, setActiveTab] = useState(() => {
     // Recupera a última aba acessada ou define padrão
     const savedTab = localStorage.getItem('vector_active_tab');
     if (savedTab) return savedTab;
     return (user && user.role === 'SUPER_ADMIN') ? 'admin_panel' : 'dashboard';
  });

  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => {
      return localStorage.getItem('vector_sidebar_collapsed') === 'true';
  });

  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);

  // --- EFEITOS ---
  
  // Salvar aba ativa
  useEffect(() => {
      if (user) localStorage.setItem('vector_active_tab', activeTab);
  }, [activeTab, user]);

  // Salvar estado da sidebar
  useEffect(() => {
      localStorage.setItem('vector_sidebar_collapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  // Configuração Axios
  useEffect(() => {
    const token = localStorage.getItem('hdl_token');
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    else delete axios.defaults.headers.common['Authorization'];
  }, [user]);

  // Carregar dados iniciais
  useEffect(() => {
    if (user) {
        axios.get(`${API_BASE}/api/companies`)
            .then(res => setCompanies(res.data))
            .catch(err => { if (err.response?.status === 401) handleLogout(); });

        axios.get(`${API_BASE}/api/groups`)
            .then(res => setGroups(res.data))
            .catch(console.error);
        
        localStorage.setItem('hdl_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('hdl_user');
    }
  }, [user]);

  // Persistir entidade selecionada
  useEffect(() => {
    if (selectedEntity.id) localStorage.setItem('vector_entity', JSON.stringify(selectedEntity));
    else localStorage.removeItem('vector_entity');
  }, [selectedEntity]);

  // --- HANDLERS ---
  const handleLogin = (loginData) => {
      localStorage.setItem('hdl_token', loginData.token);
      localStorage.setItem('hdl_user', JSON.stringify(loginData.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${loginData.token}`;
      setUser(loginData.user);
      setActiveTab(loginData.user.role === 'SUPER_ADMIN' ? 'admin_panel' : 'dashboard');
  };

  const handleLogout = () => {
    localStorage.clear(); 
    setUser(null);
    setSelectedEntity({ type: null, id: null, name: '' });
    window.location.reload();
  };

  const handleImpersonate = (targetUser, token) => {
    localStorage.setItem('hdl_token', token);
    localStorage.setItem('hdl_user', JSON.stringify(targetUser));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(targetUser); 
    setActiveTab('dashboard'); 
    window.location.reload();
  };

  // Se não estiver logado
  if (!user) return <Login onLogin={handleLogin} apiBase={API_BASE} />;

  // Renderização Principal (Layout Fixo)
  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 overflow-hidden">
      
      {/* SIDEBAR - Componente Estático (Não recria ao mudar activeTab) */}
      <Sidebar 
          user={user} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isCollapsed={isSidebarCollapsed} 
          setIsCollapsed={setSidebarCollapsed} 
          onLogout={handleLogout}
      />

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-500 ease-in-out">
        
        {/* Header Superior (Fixo) */}
        {activeTab !== 'admin_panel' && (
          <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40 px-10 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-xl transition-all hover:scale-105">
                  <LayoutDashboard size={22}/>
               </div>
               <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase italic hidden md:block">
                  {activeTab === 'costs' ? 'Gestão Financeira' : activeTab.replace('_', ' ')}
               </h2>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner group focus-within:ring-2 focus-within:ring-blue-500/20 transition-all hover:border-blue-300">
                 <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg">
                    {selectedEntity.type === 'group' ? <Layers size={16}/> : <Building2 size={16}/>}
                 </div>
                 <select 
                    value={selectedEntity.id ? `${selectedEntity.type}:${selectedEntity.id}` : ''}
                    onChange={(e) => {
                      if (!e.target.value) { setSelectedEntity({ type: null, id: null, name: '' }); return; }
                      const [type, id] = e.target.value.split(':');
                      const found = type === 'group' ? groups.find(g => g.id === Number(id)) : companies.find(c => c.id === Number(id));
                      setSelectedEntity({ type, id: Number(id), name: found?.trade_name || found?.name });
                    }}
                    className="bg-transparent border-none text-slate-700 font-black text-xs outline-none px-4 py-2 cursor-pointer uppercase tracking-widest min-w-[200px]"
                 >
                    <option value="">SELECIONE UNIDADE</option>
                    <optgroup label="EMPRESAS">
                      {companies.map(c => <option key={c.id} value={`company:${c.id}`}>🏢 {c.trade_name || c.name}</option>)}
                    </optgroup>
                    {groups.length > 0 && (
                        <optgroup label="GRUPOS">
                            {groups.map(g => <option key={g.id} value={`group:${g.id}`}>💎 {g.name}</option>)}
                        </optgroup>
                    )}
                 </select>
                 {selectedEntity.id && (
                    <button onClick={() => setSelectedEntity({ type: null, id: null, name: '' })} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="Limpar Seleção"><XCircle size={16}/></button>
                 )}
              </div>
            </div>
          </header>
        )}

        {/* Conteúdo Dinâmico (Com Scroll Suave e Independente) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-0 scroll-smooth custom-scrollbar bg-[#F8FAFC]">
            {activeTab === 'admin_panel' ? (
                <AdminPanel apiBase={API_BASE} onImpersonate={handleImpersonate} />
            ) : (
                !selectedEntity.id && activeTab !== 'companies' && activeTab !== 'audit' ? (
                    <div className="h-full flex flex-col items-center justify-center p-12 animate-in fade-in zoom-in duration-500">
                        <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner"><Building2 size={48} className="text-slate-300" /></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">Seleção de Escopo Necessária</h2>
                        <p className="text-slate-500 mb-10 text-center font-medium leading-relaxed max-w-sm">Para visualizar algoritmos e dados, conecte-se a uma de suas empresas ou grupos cadastrados.</p>
                        <button onClick={() => setActiveTab('companies')} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1 active:scale-95">Gerenciar Estrutura</button>
                    </div>
                ) : (
                    <>
                        {activeTab === 'dashboard' && <Dashboard companyId={selectedEntity.type === 'company' ? selectedEntity.id : null} groupId={selectedEntity.type === 'group' ? selectedEntity.id : null} apiBase={API_BASE} />}
                        {activeTab === 'costs' && (
                            selectedEntity.type === 'group' 
                            ? <GroupRestriction moduleName="Gestão Financeira Integrada" />
                            : <CostManagement apiBase={API_BASE} selectedCompanyId={selectedEntity.id} />
                        )}
                        {activeTab === 'pricing' && (
                            selectedEntity.type === 'group' 
                            ? <GroupRestriction moduleName="Simulador de Preços Industrial" />
                            : <PricingSimulator apiBase={API_BASE} selectedCompanyId={selectedEntity.id} />
                        )}
                        {activeTab === 'products_manager' && (
                             selectedEntity.type === 'group' 
                             ? <GroupRestriction moduleName="Gestão de Cadastro" />
                             : <ProductManager apiBase={API_BASE} selectedCompanyId={selectedEntity.id} />
                        )}
                        {activeTab === 'entries' && (
                            selectedEntity.type === 'group'
                            ? <GroupRestriction moduleName="Gestão de Lançamentos" />
                            : <FinancialEntries companyId={selectedEntity.id} apiBase={API_BASE} />
                        )}
                        {activeTab === 'dre' && <DRE selectedCompanyId={selectedEntity.type === 'company' ? selectedEntity.id : null} apiBase={API_BASE} />}
                        {activeTab === 'companies' && <Companies apiBase={API_BASE} onSelectCompany={(id, name) => { setSelectedEntity({ type: 'company', id, name }); setActiveTab('dashboard'); }} />}
                        {activeTab === 'partners' && <Partners apiBase={API_BASE} selectedCompanyId={selectedEntity.id} />}
                        {activeTab === 'audit' && <AuditLogs apiBase={API_BASE} />}
                        {activeTab === 'analytical' && <AnalyticalProjections globalCompanyId={selectedEntity.type === 'company' ? selectedEntity.id : null} apiBase={API_BASE} />}
                        {activeTab === 'inteligencia' && (
                            selectedEntity.type === 'group' 
                            ? <GroupRestriction moduleName="Monitor de Saúde BI" />
                            : <IntelligenceHub companyId={selectedEntity.id} apiBase={API_BASE} onNavigate={setActiveTab} />
                        )}
                        {activeTab === 'questor' && <QuestorManager apiBase={API_BASE} companyId={selectedEntity.id} />}
                    </>
                )
            )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default App;