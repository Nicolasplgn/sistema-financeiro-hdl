import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, DollarSign, TrendingUp, Building2, 
  ChevronLeft, ChevronRight, LogOut, Users, ShieldAlert,
  FileText, XCircle, Briefcase, Zap, BrainCircuit, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Importação das Páginas
import Dashboard from './pages/Dashboard';
import FinancialEntries from './pages/FinancialEntries';
import IntelligenceHub from './pages/IntelligenceHub'; // BI Monitor
import AnalyticalProjections from './pages/AnalyticalProjections'; // BI Analítico (Anterior)
import Companies from './pages/Companies';
import Partners from './pages/Partners';
import AuditLogs from './pages/AuditLogs';
import DRE from './pages/DRE';
import Login from './pages/Login';

const API_BASE = `http://${window.location.hostname}:4000`;

const App = () => {
  const getInitialState = (key) => {
    try {
      const item = localStorage.getItem(key);
      if (!item || item === "undefined") return null;
      return JSON.parse(item);
    } catch (error) {
      localStorage.removeItem(key);
      return null;
    }
  };

  const [user, setUser] = useState(() => getInitialState('hdl_user'));
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => getInitialState('hdl_company_id'));
  const [selectedCompanyName, setSelectedCompanyName] = useState(''); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem('hdl_user', JSON.stringify(user));
    else localStorage.removeItem('hdl_user');
  }, [user]);

  useEffect(() => {
    if (selectedCompanyId) {
      localStorage.setItem('hdl_company_id', JSON.stringify(selectedCompanyId));
      axios.get(`${API_BASE}/api/companies`)
        .then(res => {
          const companyFound = res.data.find(c => c.id === selectedCompanyId);
          if (companyFound) setSelectedCompanyName(companyFound.trade_name || companyFound.name);
        })
        .catch(err => console.error(err));
    } else {
      localStorage.removeItem('hdl_company_id');
      setSelectedCompanyName('');
    }
  }, [selectedCompanyId]);

  const handleLogout = () => {
    setUser(null);
    setSelectedCompanyId(null);
    localStorage.clear();
    window.location.reload();
  };

  const SidebarItem = ({ id, icon: Icon, label, color = "text-slate-400" }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-300 group relative
        ${activeTab === id 
          ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 translate-x-1' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }
        ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}
      `}
    >
      <Icon size={20} className={`flex-shrink-0 ${activeTab === id ? 'text-white' : color}`} />
      {!isSidebarCollapsed && <span className="font-bold text-sm tracking-tight">{label}</span>}
      {activeTab === id && !isSidebarCollapsed && (
        <motion.div layoutId="active" className="absolute right-3 w-1.5 h-1.5 bg-white rounded-full" />
      )}
    </button>
  );

  if (!user) return <Login onLogin={setUser} apiBase={API_BASE} />;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* SIDEBAR */}
      <aside className={`${isSidebarCollapsed ? 'w-24' : 'w-72'} bg-slate-900 h-screen fixed left-0 top-0 z-50 transition-all duration-500 flex flex-col border-r border-slate-800 shadow-2xl`}>
        <div className="h-24 flex items-center justify-center border-b border-white/5 relative shrink-0">
          <div className={`flex items-center transition-all duration-500 gap-4 ${isSidebarCollapsed ? 'px-0' : 'px-6'}`}>
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-600/30 transform rotate-3">V</div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <span className="text-white font-black text-xl tracking-tighter leading-none">VECTOR</span>
                <span className="text-blue-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1">Enterprise</span>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-blue-600 rounded-full text-white flex items-center justify-center shadow-2xl border-2 border-slate-900 hover:bg-blue-500 transition-all z-50">
            {isSidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-8 px-4 space-y-2 custom-scrollbar">
          {!isSidebarCollapsed && <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 opacity-50">Inteligência</p>}
          <SidebarItem id="dashboard" icon={LayoutDashboard} label="Visão Geral" />
          <SidebarItem id="inteligencia" icon={BrainCircuit} label="Monitor de Saúde" color="text-emerald-500" />
          <SidebarItem id="analytical" icon={Activity} label="Projeções BI" color="text-blue-400" />
          
          <div className="my-6 border-t border-white/5 mx-2"></div>
          
          {!isSidebarCollapsed && <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 opacity-50">Financeiro</p>}
          <SidebarItem id="dre" icon={FileText} label="DRE Gerencial" />
          <SidebarItem id="entries" icon={DollarSign} label="Lançamentos" />
          
          <div className="my-6 border-t border-white/5 mx-2"></div>
          
          {!isSidebarCollapsed && <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 opacity-50">Gestão</p>}
          <SidebarItem id="companies" icon={Building2} label="Empresas" />
          <SidebarItem id="partners" icon={Users} label="Parceiros" />
          <SidebarItem id="audit" icon={ShieldAlert} label="Logs" color="text-amber-500" />
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20 shrink-0">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg uppercase">{user.full_name.charAt(0)}</div>
              {!isSidebarCollapsed && <p className="text-sm font-black text-white truncate">{user.full_name.split(' ')[0]}</p>}
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-rose-500 transition-all p-2.5 rounded-xl"><LogOut size={20} /></button>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO */}
      <main className={`flex-1 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'ml-24' : 'ml-72'}`}>
        
        <header className="h-24 border-b border-slate-200 sticky top-0 z-40 px-10 flex items-center justify-between backdrop-blur-xl bg-white/80 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-xl">
              {activeTab === 'dashboard' && <LayoutDashboard size={22}/>}
              {activeTab === 'inteligencia' && <BrainCircuit size={22}/>}
              {activeTab === 'analytical' && <Activity size={22}/>}
              {activeTab === 'dre' && <FileText size={22}/>}
              {activeTab === 'entries' && <DollarSign size={22}/>}
              {activeTab === 'companies' && <Building2 size={22}/>}
              {activeTab === 'partners' && <Users size={22}/>}
              {activeTab === 'audit' && <ShieldAlert size={22}/>}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {activeTab === 'dashboard' && 'Dashboard de Performance'}
                {activeTab === 'inteligencia' && 'Intelligence Hub & BI'}
                {activeTab === 'analytical' && 'Projeções Analíticas'}
                {activeTab === 'dre' && 'Demonstrativo de Resultados'}
                {activeTab === 'entries' && 'Gestão de Lançamentos'}
                {activeTab === 'companies' && 'Central de Unidades'}
                {activeTab === 'partners' && 'Stakeholders & Contatos'}
                {activeTab === 'audit' && 'Logs do Sistema'}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {selectedCompanyId ? (
              <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl shadow-xl">
                <Briefcase size={16} className="text-blue-500" />
                <span className="text-sm font-black text-white tracking-tight">{selectedCompanyName || 'Empresa'}</span>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button onClick={() => { setSelectedCompanyId(null); setActiveTab('companies'); }} className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-widest">
                  <XCircle size={14} /> Trocar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-amber-500 px-6 py-3 rounded-2xl shadow-lg cursor-pointer font-black text-xs text-amber-950 uppercase tracking-widest" onClick={() => setActiveTab('companies')}>
                <ShieldAlert size={18} /> Selecionar Empresa
              </div>
            )}
          </div>
        </header>

        <div className="p-0 animate-in fade-in duration-1000">
          {!selectedCompanyId && activeTab !== 'companies' && activeTab !== 'audit' ? (
            <div className="h-[70vh] flex flex-col items-center justify-center p-12">
                <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner"><Building2 size={48} className="text-slate-300" /></div>
                <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">Conexão Necessária</h2>
                <p className="text-slate-500 mb-10 text-center font-medium leading-relaxed max-w-sm">Para visualizar algoritmos e dados, conecte-se a uma de suas empresas cadastradas.</p>
                <button onClick={() => setActiveTab('companies')} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all">Selecionar Unidade</button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard companyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'inteligencia' && <IntelligenceHub companyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'analytical' && <AnalyticalProjections globalCompanyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'dre' && <DRE selectedCompanyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'entries' && <FinancialEntries companyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'companies' && <Companies apiBase={API_BASE} onSelectCompany={(id) => { setSelectedCompanyId(id); setActiveTab('dashboard'); }} />}
              {activeTab === 'partners' && <Partners apiBase={API_BASE} selectedCompanyId={selectedCompanyId} />}
              {activeTab === 'audit' && <AuditLogs apiBase={API_BASE} />}
            </>
          )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default App;