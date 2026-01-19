import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, DollarSign, Building2, ChevronLeft, ChevronRight, 
  LogOut, Users, ShieldAlert, FileText, Wallet, CloudLightning, 
  Tag, Box, Activity, BrainCircuit, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

const MainLayout = ({ user, onLogout, selectedEntity, onSelectEntity, companies, groups }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { section: 'Inteligência', items: [
      { id: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
      { id: '/pricing', icon: Tag, label: 'Precificação', color: 'text-amber-500' },
      { id: '/bi', icon: BrainCircuit, label: 'Monitor BI', color: 'text-emerald-500' },
      { id: '/projections', icon: Activity, label: 'Projeções', color: 'text-blue-400' },
    ]},
    { section: 'Financeiro', items: [
      { id: '/entries', icon: DollarSign, label: 'Lançamentos' },
      { id: '/costs', icon: Wallet, label: 'Gestão de Custos', color: 'text-rose-500' },
      { id: '/dre', icon: FileText, label: 'DRE Gerencial' },
    ]},
    { section: 'Gestão', items: [
      { id: '/companies', icon: Building2, label: 'Estrutura Corp.' },
      { id: '/partners', icon: Users, label: 'Parceiros' },
      { id: '/questor', icon: CloudLightning, label: 'Integração', color: 'text-purple-500' },
    ]}
  ];

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-blue-100">
      
      {/* SIDEBAR */}
      <aside className={`${collapsed ? 'w-24' : 'w-72'} bg-slate-900 h-screen fixed transition-all duration-500 z-50 shadow-2xl flex flex-col`}>
        {/* Logo Area */}
        <div className="h-24 flex items-center justify-center border-b border-white/5 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-900/50">V</div>
            {!collapsed && (
              <div>
                <h1 className="text-white font-black text-lg tracking-tight">VECTOR</h1>
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.3em]">Enterprise</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-blue-600 rounded-full text-white flex items-center justify-center shadow-lg hover:scale-110 transition border-2 border-slate-900"
          >
            {collapsed ? <ChevronRight size={12}/> : <ChevronLeft size={12}/>}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar">
          {menuItems.map((group, idx) => (
            <div key={idx}>
              {!collapsed && <p className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{group.section}</p>}
              <div className="space-y-1">
                {group.items.map(item => {
                  const active = location.pathname === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group
                        ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                        ${collapsed ? 'justify-center' : ''}
                      `}
                    >
                      <item.icon size={20} className={`${active ? 'text-white' : item.color || 'text-slate-400'} transition-colors`} />
                      {!collapsed && <span className="text-sm font-bold tracking-tight">{item.label}</span>}
                      {active && !collapsed && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white font-black shadow-inner">
              {user?.full_name?.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{user?.full_name?.split(' ')[0]}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider">{user?.role}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={onLogout} className="text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition"><LogOut size={18}/></button>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className={`flex-1 transition-all duration-500 ${collapsed ? 'ml-24' : 'ml-72'}`}>
        
        {/* Topbar Glass */}
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
             {/* Breadcrumbs or Page Title logic here */}
             <h2 className="text-xl font-black text-slate-800 tracking-tight italic uppercase">
                {menuItems.flatMap(g => g.items).find(i => i.id === location.pathname)?.label || 'Dashboard'}
             </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Entity Selector */}
            <div className="relative group">
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-2xl p-1 pr-4 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                    <div className="p-2 bg-white rounded-xl shadow-sm mr-3 text-blue-600">
                        {selectedEntity.type === 'group' ? <Layers size={18}/> : <Building2 size={18}/>}
                    </div>
                    <select 
                        className="bg-transparent border-none outline-none text-xs font-black text-slate-700 uppercase tracking-widest min-w-[200px] cursor-pointer"
                        value={selectedEntity.id ? `${selectedEntity.type}:${selectedEntity.id}` : ''}
                        onChange={(e) => onSelectEntity(e.target.value)}
                    >
                        <option value="">Selecione a Unidade</option>
                        <optgroup label="EMPRESAS">
                            {companies.map(c => <option key={c.id} value={`company:${c.id}`}>{c.trade_name || c.name}</option>)}
                        </optgroup>
                        <optgroup label="GRUPOS">
                            {groups.map(g => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                        </optgroup>
                    </select>
                </div>
            </div>
          </div>
        </header>

        <div className="p-8">
            <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;