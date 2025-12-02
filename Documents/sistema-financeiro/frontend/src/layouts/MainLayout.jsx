import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LayoutDashboard, Building2, LogOut, Menu, ChevronDown, UserCircle, FileText } from 'lucide-react';

const MainLayout = () => {
  const { user, logout, selectedCompany, setSelectedCompany } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [companies, setCompanies] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await api.get('/companies');
        const list = Array.isArray(response.data) ? response.data : [];
        setCompanies(list);
        if (list.length > 0 && !selectedCompany) setSelectedCompany(list[0]); 
      } catch (error) {
        setCompanies([]);
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, [selectedCompany, setSelectedCompany]);

  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Lançamentos', icon: FileText, path: '/entries' },
    ...(user?.role === 'admin' ? [{ label: 'Gerenciar Empresas', icon: Building2, path: '/companies' }] : []),
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col shadow-2xl z-20`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-700">
          <h1 className="text-xl font-bold text-blue-400">{sidebarOpen ? 'HDL GESTÃO' : 'HDL'}</h1>
        </div>
        <nav className="flex-1 py-6 space-y-2 px-3">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center p-3 rounded-xl transition-all ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                <item.icon className="w-6 h-6" />
                {sidebarOpen && <span className="ml-3 font-medium text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
            <button onClick={() => { logout(); navigate('/'); }} className="w-full flex items-center justify-center p-2 rounded-lg bg-slate-800 text-red-400 hover:bg-red-600 hover:text-white">
                {sidebarOpen ? 'Sair' : <LogOut size={16}/>}
            </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}><Menu className="w-6 h-6 text-slate-500" /></button>
          <div className="flex items-center space-x-4">
            <span className="text-xs font-semibold text-slate-400 uppercase hidden sm:block">Empresa:</span>
            <div className="relative">
                <select value={selectedCompany?.id || ''} onChange={(e) => setSelectedCompany(companies.find(c => c.id === Number(e.target.value)))} disabled={loadingCompanies} className="bg-slate-100 border border-slate-200 py-2 pl-4 pr-10 rounded-lg font-semibold min-w-[200px]">
                    {loadingCompanies ? <option>Carregando...</option> : companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-6"><Outlet /></main>
      </div>
    </div>
  );
};

export default MainLayout;