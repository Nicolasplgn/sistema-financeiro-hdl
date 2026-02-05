import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, DollarSign, Building2, LineChart, 
  LogOut, ChevronLeft, ChevronRight, PieChart 
} from 'lucide-react';
import { motion } from 'framer-motion';

const Sidebar = ({ onLogout, isCollapsed, toggleSidebar }) => {
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard Geral', path: '/dashboard' },
    { icon: DollarSign, label: 'Lançamentos', path: '/entries' },
    { label: 'ESTRATÉGIA', isHeader: true },
    { icon: Building2, label: 'Minhas Empresas', path: '/companies' },
    { icon: LineChart, label: 'Business Intelligence', path: '/projections' },
  ];

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-slate-900 text-white transition-all duration-300 z-50 flex flex-col border-r border-slate-800 ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      {/* Header da Sidebar */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
        {!isCollapsed && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 font-bold text-lg tracking-tight"
          >
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <PieChart size={20} className="text-white" />
            </div>
            <span>HDL <span className="text-blue-500">Gestão</span></span>
          </motion.div>
        )}
        
        {/* Botão de Toggle (Minimizar) */}
        <button 
          onClick={toggleSidebar}
          className={`p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition ${isCollapsed ? 'mx-auto' : ''}`}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item, index) => {
          if (item.isHeader) {
            return !isCollapsed && (
              <div key={index} className="px-3 mt-6 mb-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {item.label}
                </p>
              </div>
            );
          }

          return (
            <NavLink
              key={index}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                ${isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <item.icon size={22} className={`shrink-0 ${!isCollapsed ? '' : ''}`} />
              
              {!isCollapsed ? (
                <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
              ) : (
                // Tooltip quando minimizado
                <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-slate-700 shadow-xl">
                  {item.label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={onLogout}
          className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition group relative ${isCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={20} />
          {!isCollapsed ? (
            <span className="font-medium text-sm">Desconectar</span>
          ) : (
            <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Sair
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;