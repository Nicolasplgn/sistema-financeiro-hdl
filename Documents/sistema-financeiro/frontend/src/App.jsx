import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, DollarSign, TrendingUp, Building2, 
  ChevronLeft, ChevronRight, LogOut, Users, ShieldAlert,
  UserCircle, FileText, XCircle, Briefcase, Zap
} from 'lucide-react';

// REMOVI A IMPORTAÇÃO DE IMAGEM PARA NÃO DAR ERRO
// import vectorLogo from './assets/vector-logo.png'; 

// Importação das Páginas
import Dashboard from './pages/Dashboard';
import FinancialEntries from './pages/FinancialEntries';
import Projections from './pages/Projections';
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
    } catch (e) {
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
          const company = res.data.find(c => c.id === selectedCompanyId);
          if (company) setSelectedCompanyName(company.trade_name || company.name);
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

  const handleDisconnectCompany = () => {
    setSelectedCompanyId(null);
    localStorage.removeItem('hdl_company_id');
    setActiveTab('companies');
  };

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      title={isSidebarCollapsed ? label : ''}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative
        ${activeTab === id 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }
        ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}
      `}
    >
      <Icon size={20} className={`flex-shrink-0 ${activeTab === id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
      {!isSidebarCollapsed && (
        <span className="font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300">
          {label}
        </span>
      )}
    </button>
  );

  if (!user) return <Login onLogin={setUser} apiBase={API_BASE} />;

  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* SIDEBAR */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 h-screen fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out flex flex-col border-r border-slate-800 shadow-2xl`}>
        
        {/* HEADER DA SIDEBAR COM LOGO "V" (FEITA EM CÓDIGO) */}
        <div className="h-24 flex items-center justify-center border-b border-slate-800 relative shrink-0 bg-black/20">
          <div className={`flex items-center justify-center transition-all duration-300 gap-3 ${isSidebarCollapsed ? 'px-0' : 'px-4'}`}>
            
            {/* LOGO VECTOR FEITA COM CSS (Não precisa de imagem) */}
            <div className={`flex items-center justify-center bg-blue-600 rounded-lg text-white font-extrabold shadow-lg shadow-blue-900/50 transform -skew-x-12
                ${isSidebarCollapsed ? 'w-10 h-10 text-2xl' : 'w-10 h-10 text-2xl'}`}>
                V
            </div>

            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg leading-none tracking-tight">VECTOR</span>
                <span className="text-blue-500 text-[9px] font-bold uppercase tracking-[0.2em]">Connect</span>
              </div>
            )}
          </div>

          <button 
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} 
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-blue-600 rounded-full text-white flex items-center justify-center shadow-lg border border-slate-800 hover:bg-blue-500 transition z-50"
          >
            {isSidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
          {!isSidebarCollapsed && <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 animate-fade-in">Principal</p>}
          <SidebarItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem id="dre" icon={FileText} label="DRE Gerencial" />
          <SidebarItem id="entries" icon={DollarSign} label="Lançamentos" />
          <SidebarItem id="projections" icon={TrendingUp} label="Inteligência" />
          
          <div className="my-4 border-t border-slate-800/50 mx-2"></div>
          
          {!isSidebarCollapsed && <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 animate-fade-in">Gestão</p>}
          <SidebarItem id="companies" icon={Building2} label="Empresas" />
          <SidebarItem id="partners" icon={Users} label="Parceiros" />
          <SidebarItem id="audit" icon={ShieldAlert} label="Auditoria" />
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-900 to-slate-800 flex items-center justify-center text-white border border-slate-700 flex-shrink-0 font-bold">
                {user.full_name.charAt(0)}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col overflow-hidden animate-fade-in">
                  <p className="text-sm font-bold text-white truncate max-w-[120px]">{user.full_name.split(' ')[0]}</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[120px]">Admin</p>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className={`text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition p-2 rounded-lg ${isSidebarCollapsed ? 'w-full flex justify-center' : ''}`} title="Sair do Sistema"><LogOut size={20} /></button>
          </div>
        </div>
      </aside>

      <main className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        
        {/* HEADER SUPERIOR */}
        <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40 px-8 flex items-center justify-between shadow-sm/50 backdrop-blur-sm bg-white/90">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              {activeTab === 'companies' ? <Building2 size={24}/> : activeTab === 'entries' ? <DollarSign size={24}/> : activeTab === 'dre' ? <FileText size={24}/> : activeTab === 'projections' ? <TrendingUp size={24}/> : activeTab === 'partners' ? <Users size={24}/> : activeTab === 'audit' ? <ShieldAlert size={24}/> : <LayoutDashboard size={24}/>}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {activeTab === 'dashboard' && 'Visão Geral'}
                {activeTab === 'dre' && 'Demonstrativo de Resultados'}
                {activeTab === 'entries' && 'Gestão Financeira'}
                {activeTab === 'projections' && 'Business Intelligence'}
                {activeTab === 'companies' && 'Minhas Empresas'}
                {activeTab === 'partners' && 'Parceiros & Fornecedores'}
                {activeTab === 'audit' && 'Logs de Segurança'}
              </h2>
            </div>
          </div>
          
          {/* IDENTIFICAÇÃO DA EMPRESA (LADO DIREITO) */}
          <div className="flex items-center gap-4">
            {selectedCompanyId ? (
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Ambiente Conectado</span>
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg shadow-sm transition-all hover:shadow-md hover:border-blue-300 group">
                  <div className="p-1 bg-blue-100 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Briefcase size={16} />
                  </div>
                  <span className="text-sm font-bold text-blue-800 pr-2 border-r border-blue-200">
                    {selectedCompanyName || 'Carregando...'}
                  </span>
                  <button 
                    onClick={handleDisconnectCompany}
                    className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-wide pl-1"
                    title="Trocar de empresa"
                  >
                    <XCircle size={14} /> Sair
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
                <ShieldAlert size={18} className="text-amber-500" />
                <span className="text-sm font-bold text-amber-700">Selecione uma Empresa</span>
              </div>
            )}
          </div>
        </header>

        <div className="p-0">
          {!selectedCompanyId && activeTab !== 'companies' && activeTab !== 'audit' ? (
            <div className="h-[80vh] flex flex-col items-center justify-center animate-fade-in">
              <div className="bg-slate-100 p-6 rounded-full mb-6"><Building2 size={48} className="text-slate-400" /></div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Nenhuma Empresa Selecionada</h2>
              <p className="text-slate-500 mb-8 max-w-md text-center leading-relaxed">Para acessar os dados financeiros, você precisa selecionar ou cadastrar uma empresa primeiro.</p>
              <button onClick={() => setActiveTab('companies')} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition hover:-translate-y-1">Selecionar Empresa</button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard companyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'dre' && <DRE selectedCompanyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'entries' && <FinancialEntries companyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'projections' && <Projections globalCompanyId={selectedCompanyId} apiBase={API_BASE} />}
              {activeTab === 'companies' && <Companies apiBase={API_BASE} onSelectCompany={(id) => { setSelectedCompanyId(id); setActiveTab('dashboard'); }} />}
              {activeTab === 'partners' && <Partners apiBase={API_BASE} selectedCompanyId={selectedCompanyId} />}
              {activeTab === 'audit' && <AuditLogs apiBase={API_BASE} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;