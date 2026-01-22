import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, DollarSign, Building2, ChevronLeft, ChevronRight, 
  LogOut, Users, ShieldAlert, FileText, Wallet, CloudLightning, 
  Tag, Box, Activity, BrainCircuit, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

const MainLayout = ({ user, onLogout, selectedEntity, onSelectEntity, companies, groups }) => {
  // Inicializa o estado 'collapsed' lendo do localStorage para persistir entre refreshes
  const [collapsed, setCollapsed] = useState(() => {
      return localStorage.getItem('vector_sidebar_collapsed') === 'true';
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Salva a preferência da sidebar sempre que mudar
  useEffect(() => {
      localStorage.setItem('vector_sidebar_collapsed', collapsed);
  }, [collapsed]);

  const menuItems = [
    { section: 'Master Control', role: 'SUPER_ADMIN', items: [
      { id: '/admin', icon: ShieldAlert, label: 'Central de Clientes', color: 'text-rose-500' }
    ]},
    { section: 'Inteligência', items: [
      { id: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
      { id: '/pricing', icon: Tag, label: 'Simulador Preços', color: 'text-amber-500' },
      { id: '/products', icon: Box, label: 'Cadastro / Custos', color: 'text-emerald-500' },
      { id: '/bi', icon: BrainCircuit, label: 'Monitor de Saúde', color: 'text-emerald-500' },
      { id: '/projections', icon: Activity, label: 'Projeções BI', color: 'text-blue-400' },
    ]},
    { section: 'Financeiro', items: [
      { id: '/dre', icon: FileText, label: 'DRE Gerencial' },
      { id: '/entries', icon: DollarSign, label: 'Lançamentos' },
      { id: '/costs', icon: Wallet, label: 'Gestão Financeira', color: 'text-rose-500' },
    ]},
    { section: 'Gestão', items: [
      { id: '/companies', icon: Building2, label: 'Unidades & Grupos' },
      { id: '/partners', icon: Users, label: 'Parceiros' },
      { id: '/audit', icon: ShieldAlert, label: 'Logs & Auditoria', color: 'text-slate-400' },
      { id: '/questor', icon: CloudLightning, label: 'Integração Questor', color: 'text-purple-500' },
    ]}
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100 overflow-hidden">
      
      {/* SIDEBAR - Fixa e com Scroll Próprio */}
      <aside 
        className={`${collapsed ? 'w-24' : 'w-72'} bg-slate-900 h-full flex-shrink-0 transition-all duration-300 z-50 shadow-2xl flex flex-col`}
      >
        {/* Logo Area (Fixo no topo da Sidebar) */}
        <div className="h-24 flex items-center justify-center border-b border-white/5 relative shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-900/50 shrink-0">V</div>
            {!collapsed && (
              <div className="whitespace-nowrap">
                <h1 className="text-white font-black text-lg tracking-tight">VECTOR</h1>
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.3em]">Enterprise</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-blue-600 rounded-full text-white flex items-center justify-center shadow-lg hover:scale-110 transition border-2 border-slate-900 z-50"
          >
            {collapsed ? <ChevronRight size={12}/> : <ChevronLeft size={12}/>}
          </button>
        </div>

        {/* Navigation (Scrollável) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-4 space-y-8 custom-scrollbar">
          {menuItems.map((group, idx) => {
            // Filtra se for exclusivo de Super Admin
            if (group.role && user?.role !== group.role) return null;

            return (
              <div key={idx}>
                {!collapsed && (
                  <p className="px-3 text-[10px] font-black text-rose-500/80 uppercase tracking-[0.2em] mb-3 animate-in fade-in slide-in-from-left-2 duration-300">
                    {group.section}
                  </p>
                )}
                <div className="space-y-1">
                  {group.items.map(item => {
                    const active = location.pathname === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.id)}
                        title={collapsed ? item.label : ''}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-200 group relative
                          ${active ? 'bg-white/10 text-white shadow-lg backdrop-blur-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                          ${collapsed ? 'justify-center' : ''}
                        `}
                      >
                        <item.icon size={20} className={`${active ? 'text-blue-400' : item.color || 'text-slate-400'} transition-colors shrink-0`} />
                        {!collapsed && <span className="text-sm font-bold tracking-tight truncate">{item.label}</span>}
                        {active && !collapsed && (
                          <motion.div layoutId="active-indicator" className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* User Footer (Fixo no fundo da Sidebar) */}
        <div className="p-4 border-t border-white/5 bg-black/20 shrink-0">
          <div className={`flex items-center ${collapsed ? 'justify-center flex-col gap-4' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white font-black shadow-inner shrink-0 text-sm uppercase">
              {user?.full_name?.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{user?.full_name?.split(' ')[0]}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider truncate">{user?.role}</p>
              </div>
            )}
            <button onClick={onLogout} title="Sair" className="text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition shrink-0"><LogOut size={18}/></button>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (COM SCROLL INDEPENDENTE) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Topbar Glass (Fixo) */}
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-4">
             <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg">
                {menuItems.flatMap(g => g.items).find(i => i.id === location.pathname)?.icon({size: 20}) || <LayoutDashboard size={20}/>}
             </div>
             <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase italic hidden md:block">
                {menuItems.flatMap(g => g.items).find(i => i.id === location.pathname)?.label || 'Dashboard'}
             </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
                <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 pr-3 transition-all hover:border-blue-300 shadow-sm">
                    <div className="p-2 bg-slate-100 rounded-xl mr-2 text-slate-500">
                        {selectedEntity.type === 'group' ? <Layers size={16}/> : <Building2 size={16}/>}
                    </div>
                    <select 
                        className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest min-w-[180px] cursor-pointer"
                        value={selectedEntity.id ? `${selectedEntity.type}:${selectedEntity.id}` : ''}
                        onChange={(e) => onSelectEntity(e.target.value)}
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
                </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 scroll-smooth custom-scrollbar">
            <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;