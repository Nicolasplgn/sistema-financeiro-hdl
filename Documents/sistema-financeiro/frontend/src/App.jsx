import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, DollarSign, Building2, ChevronLeft, ChevronRight, LogOut, Users, ShieldAlert,
  FileText, XCircle, Briefcase, Zap, BrainCircuit, Activity, Layers, Target, CloudLightning, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const API_BASE = `http://${window.location.hostname}:4000`;

// COMPONENTE DE BLOQUEIO PARA GRUPOS (VISUAL PREMIUM)
const GroupRestriction = ({ moduleName }) => (
  <div className="h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
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
      O módulo <strong>{moduleName}</strong> requer dados granulares e está disponível apenas na visualização individual por unidade.
    </p>
    <div className="px-6 py-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl text-xs font-black uppercase tracking-widest">
      Selecione uma empresa específica para acessar
    </div>
  </div>
);

const App = () => {
  // Estado de Usuário persistido
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('hdl_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
  });

  // Estado da Entidade Selecionada (Pode ser 'company' ou 'group')
  const [selectedEntity, setSelectedEntity] = useState(() => {
    try {
      const stored = localStorage.getItem('vector_entity');
      return stored ? JSON.parse(stored) : { type: null, id: null, name: '' };
    } catch (e) { return { type: null, id: null, name: '' }; }
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Listas para o dropdown de seleção
  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);

  // Carrega dados iniciais ao logar
  useEffect(() => {
    if (user) {
        axios.get(`${API_BASE}/api/companies`).then(res => setCompanies(res.data)).catch(err => console.error(err));
        axios.get(`${API_BASE}/api/groups`).then(res => setGroups(res.data)).catch(err => console.error(err));
        localStorage.setItem('hdl_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('hdl_user');
    }
  }, [user]);

  // Persiste a seleção de entidade
  useEffect(() => {
    if (selectedEntity.id) localStorage.setItem('vector_entity', JSON.stringify(selectedEntity));
    else localStorage.removeItem('vector_entity');
  }, [selectedEntity]);

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setSelectedEntity({ type: null, id: null, name: '' });
    window.location.reload();
  };

  const SidebarItem = ({ id, icon: Icon, label, color = "text-slate-400" }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-300 group relative
        ${activeTab === id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
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
      
      {/* SIDEBAR CORPORATIVA */}
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
          <SidebarItem id="companies" icon={Building2} label="Empresas & Grupos" />
          <SidebarItem id="partners" icon={Users} label="Parceiros" />
          <SidebarItem id="audit" icon={ShieldAlert} label="Logs" color="text-rose-500" />
          <SidebarItem id="questor" icon={CloudLightning} label="Integração Questor" color="text-amber-500" />
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
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-10 flex items-center justify-between shadow-sm">
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
                {activeTab === 'questor' && <CloudLightning size={22}/>}
             </div>
             <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase italic">
                {activeTab === 'companies' ? 'Gestão Corporativa' : 
                 activeTab === 'dashboard' ? 'Performance Executiva' : 
                 activeTab === 'questor' ? 'Bridge Connector' : activeTab}
             </h2>
          </div>
          
          <div className="flex items-center gap-4">
            {/* SELETOR HÍBRIDO PREMIUM */}
            <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner group focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
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
                  className="bg-transparent border-none text-slate-700 font-black text-xs outline-none px-4 py-2 cursor-pointer uppercase tracking-widest min-w-[220px]"
               >
                  <option value="">SELECIONE UNIDADE OU GRUPO</option>
                  <optgroup label="VISÃO CONSOLIDADA (HOLDING)">
                    {groups.map(g => <option key={g.id} value={`group:${g.id}`}>💎 GRUPO: {g.name}</option>)}
                  </optgroup>
                  <optgroup label="VISÃO INDIVIDUAL (EMPRESAS)">
                    {companies.map(c => <option key={c.id} value={`company:${c.id}`}>🏢 {c.trade_name || c.name}</option>)}
                  </optgroup>
               </select>
               {selectedEntity.id && (
                  <button onClick={() => setSelectedEntity({ type: null, id: null, name: '' })} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><XCircle size={16}/></button>
               )}
            </div>
          </div>
        </header>

        <div className="p-0 animate-in fade-in duration-700">
          {!selectedEntity.id && activeTab !== 'companies' && activeTab !== 'audit' ? (
            <div className="h-[70vh] flex flex-col items-center justify-center p-12">
                <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner"><Building2 size={48} className="text-slate-300" /></div>
                <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">Seleção de Escopo Necessária</h2>
                <p className="text-slate-500 mb-10 text-center font-medium leading-relaxed max-w-sm">Para visualizar algoritmos e dados, conecte-se a uma de suas empresas ou grupos cadastrados.</p>
                <button onClick={() => setActiveTab('companies')} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:-translate-y-1">Gerenciar Estrutura</button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard companyId={selectedEntity.type === 'company' ? selectedEntity.id : null} groupId={selectedEntity.type === 'group' ? selectedEntity.id : null} apiBase={API_BASE} />}
              
              {/* LÓGICA DE BLOQUEIO DE GRUPO PARA BI E LANÇAMENTOS */}
              {activeTab === 'inteligencia' && (
                  selectedEntity.type === 'group' 
                    ? <GroupRestriction moduleName="Monitor de Saúde BI" />
                    : <IntelligenceHub companyId={selectedEntity.id} apiBase={API_BASE} onNavigate={setActiveTab} />
              )}
              
              {activeTab === 'entries' && (
                  selectedEntity.type === 'group' 
                    ? <GroupRestriction moduleName="Gestão de Lançamentos" />
                    : <FinancialEntries companyId={selectedEntity.id} apiBase={API_BASE} />
              )}

              {/* DEMAIS MÓDULOS (COMPATÍVEIS COM GRUPO) */}
              {activeTab === 'analytical' && <AnalyticalProjections globalCompanyId={selectedEntity.type === 'company' ? selectedEntity.id : null} apiBase={API_BASE} />}
              {activeTab === 'dre' && <DRE selectedCompanyId={selectedEntity.type === 'company' ? selectedEntity.id : null} apiBase={API_BASE} />}
              {activeTab === 'companies' && <Companies apiBase={API_BASE} onSelectCompany={(id, name) => { setSelectedEntity({ type: 'company', id, name }); setActiveTab('dashboard'); }} />}
              {activeTab === 'partners' && <Partners apiBase={API_BASE} selectedCompanyId={selectedEntity.id} />}
              {activeTab === 'audit' && <AuditLogs apiBase={API_BASE} />}
              {activeTab === 'questor' && <QuestorManager apiBase={API_BASE} companyId={selectedEntity.type === 'company' ? selectedEntity.id : null} />}
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