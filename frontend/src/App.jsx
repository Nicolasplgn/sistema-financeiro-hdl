import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  LayoutDashboard, FileText, HeartPulse, TrendingUp, ClipboardList, Users, Calculator,
  Building2, CloudUpload, History, ShieldCheck, LogOut, Moon, Sun, Menu, ChevronsLeft, ChevronsRight, Layers,
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import DRE from './pages/dre/DrePage';
import IntelligenceHub from './pages/IntelligenceHub';
import AnalyticalProjections from './pages/AnalyticalProjections';
import FinancialEntries from './pages/FinancialEntries';
import Partners from './pages/Partners';
import PricingWorkspace from './pages/pricing/PricingWorkspace';
import Companies from './pages/Companies';
import QuestorManager from './pages/QuestorManager';
import AuditLogs from './pages/AuditLogs';
import AdminPanel from './pages/AdminPanel';
import Login from './pages/Login';

import http from './services/http';
import { useTheme } from './hooks/useTheme';
import { Button, EmptyState } from './components/ui';
import { cx } from './utils/cx';
import { REGIME_LABEL } from './utils/format';

/**
 * Menu organizado pelo que a pessoa quer fazer.
 * scope: 'company' = precisa de uma empresa; 'any' = empresa ou grupo; 'none' = não depende.
 */
const NAV = [
  {
    section: 'Acompanhar',
    items: [
      { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard, scope: 'any', description: 'Faturamento, saídas e lucro do período escolhido.' },
      { id: 'dre', label: 'DRE', icon: FileText, scope: 'company', description: 'Demonstração do resultado, mês a mês, como na planilha da contabilidade.' },
      { id: 'saude', label: 'Saúde financeira', icon: HeartPulse, scope: 'company', description: 'Nota de saúde, meta do ano e alertas automáticos.' },
      { id: 'projecoes', label: 'Projeções', icon: TrendingUp, scope: 'company', description: 'Simule crescimento, custos e quanto tempo o caixa aguenta.' },
    ],
  },
  {
    section: 'Registrar',
    items: [
      { id: 'lancamentos', label: 'Lançamentos do mês', icon: ClipboardList, scope: 'company', description: 'Receitas, tributos e despesas de cada competência.' },
      { id: 'parceiros', label: 'Clientes e fornecedores', icon: Users, scope: 'company', description: 'Cadastro usado no detalhamento dos lançamentos.' },
    ],
  },
  {
    section: 'Formação de preço',
    items: [
      { id: 'precificacao', label: 'Planilha de preços', icon: Calculator, scope: 'company', description: 'Custos, painel de rateio, fichas técnicas, markup e tributos — as mesmas abas das planilhas.' },
    ],
  },
  {
    section: 'Configurar',
    items: [
      { id: 'empresas', label: 'Empresas e grupos', icon: Building2, scope: 'none', description: 'Cadastre as empresas (CNPJ, regime tributário) e agrupe-as.' },
      { id: 'questor', label: 'Integração Questor', icon: CloudUpload, scope: 'company', description: 'Gere o arquivo de lançamentos para a contabilidade.' },
      { id: 'auditoria', label: 'Histórico de ações', icon: History, scope: 'none', description: 'Quem fez o quê e quando.' },
    ],
  },
  {
    section: 'Administração',
    role: 'SUPER_ADMIN',
    items: [
      { id: 'admin', label: 'Clientes do sistema', icon: ShieldCheck, scope: 'none', description: 'Usuários, licenças e acesso às contas dos clientes.' },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, role: g.role })));

// Abas salvas pela versão anterior da tela.
const LEGACY_TABS = {
  inteligencia: 'saude', analytical: 'projecoes', entries: 'lancamentos', partners: 'parceiros',
  costs: 'precificacao', pricing: 'precificacao', products_manager: 'precificacao',
  companies: 'empresas', audit: 'auditoria', admin_panel: 'admin',
};

const readJson = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};

// ============================================================================ menu lateral
const Sidebar = ({ user, active, onSelect, collapsed, onToggle, mobileOpen, onCloseMobile, onLogout }) => (
  <>
    {mobileOpen && <div className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden" onClick={onCloseMobile} />}
    <aside
      className={cx(
        'print:hidden fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-ink transition-all duration-200 shrink-0',
        collapsed ? 'lg:w-[68px]' : 'lg:w-64',
        mobileOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:translate-x-0',
      )}
    >
      <div className={cx('h-16 flex items-center border-b border-white/5 shrink-0', collapsed ? 'lg:justify-center px-4 lg:px-0' : 'px-4')}>
        <div className="w-9 h-9 rounded-lg bg-brand text-white font-bold flex items-center justify-center shrink-0">V</div>
        <div className={cx('ml-3 leading-tight', collapsed && 'lg:hidden')}>
          <p className="text-sm font-semibold text-white">Vector Connect</p>
          <p className="text-[11px] text-sidebar-ink-2">Gestão financeira</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-thin py-4 px-3 space-y-5" aria-label="Menu principal">
        {NAV.map((group) => {
          if (group.role && user?.role !== group.role) return null;
          return (
            <div key={group.section}>
              <p className={cx('px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-ink-2', collapsed && 'lg:hidden')}>{group.section}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.id === active;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => { onSelect(item.id); onCloseMobile(); }}
                        title={collapsed ? item.label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={cx(
                          'w-full flex items-center gap-3 h-9 px-2.5 rounded-lg text-sm transition-colors',
                          collapsed && 'lg:justify-center lg:px-0',
                          isActive ? 'bg-sidebar-active text-white font-medium' : 'text-sidebar-ink hover:bg-white/5 hover:text-white',
                        )}
                      >
                        <item.icon size={17} className={cx('shrink-0', isActive ? 'text-brand' : 'text-sidebar-ink-2')} />
                        <span className={cx('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3 shrink-0">
        <div className={cx('flex items-center gap-3', collapsed && 'lg:flex-col')}>
          <div className="w-8 h-8 rounded-full bg-white/10 text-white text-sm font-semibold flex items-center justify-center shrink-0 uppercase">{user.full_name?.charAt(0)}</div>
          <div className={cx('flex-1 min-w-0', collapsed && 'lg:hidden')}>
            <p className="text-sm text-white truncate">{user.full_name}</p>
            <p className="text-[11px] text-sidebar-ink-2 truncate">{user.email}</p>
          </div>
          <button onClick={onLogout} className="p-2 rounded-lg text-sidebar-ink-2 hover:text-white hover:bg-white/5" title="Sair" aria-label="Sair"><LogOut size={16} /></button>
        </div>
        <button onClick={onToggle} className="hidden lg:flex mt-2 w-full items-center justify-center h-8 rounded-lg text-sidebar-ink-2 hover:text-white hover:bg-white/5" aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /><span className="ml-1 text-xs">Recolher</span></>}
        </button>
      </div>
    </aside>
  </>
);

// ============================================================================ seletor de empresa
const ScopeSelector = ({ companies, groups, entity, onChange }) => {
  const value = entity.id ? `${entity.type}:${entity.id}` : '';
  const company = entity.type === 'company' ? companies.find((c) => c.id === entity.id) : null;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative min-w-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">
          {entity.type === 'group' ? <Layers size={15} /> : <Building2 size={15} />}
        </span>
        <select
          aria-label="Empresa ou grupo em uso"
          value={value}
          onChange={(e) => {
            if (!e.target.value) { onChange({ type: null, id: null, name: '' }); return; }
            const [type, rawId] = e.target.value.split(':');
            const id = Number(rawId);
            const found = type === 'group' ? groups.find((g) => g.id === id) : companies.find((c) => c.id === id);
            onChange({ type, id, name: found?.trade_name || found?.name || '' });
          }}
          className="h-9 max-w-[52vw] sm:max-w-xs pl-9 pr-8 rounded-lg border border-line bg-surface text-sm text-ink font-medium outline-none focus:border-brand cursor-pointer truncate"
        >
          <option value="">Escolha a empresa…</option>
          {companies.length > 0 && (
            <optgroup label="Empresas">
              {companies.map((c) => <option key={c.id} value={`company:${c.id}`}>{c.trade_name || c.name}</option>)}
            </optgroup>
          )}
          {groups.length > 0 && (
            <optgroup label="Grupos (visão consolidada)">
              {groups.map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      {company?.tax_regime && <span className="hidden md:inline text-xs text-ink-3 whitespace-nowrap">{REGIME_LABEL[company.tax_regime] || company.tax_regime}</span>}
    </div>
  );
};

// ============================================================================ aplicação
const App = () => {
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState(() => readJson('hdl_user', null));
  const [entity, setEntity] = useState(() => readJson('vector_entity', { type: null, id: null, name: '' }));
  const [active, setActive] = useState(() => {
    const saved = localStorage.getItem('vector_active_tab');
    const mapped = LEGACY_TABS[saved] || saved;
    if (mapped && ALL_ITEMS.some((i) => i.id === mapped)) return mapped;
    return readJson('hdl_user', null)?.role === 'SUPER_ADMIN' ? 'admin' : 'dashboard';
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vector_sidebar_collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);

  const logout = useCallback(() => {
    ['hdl_token', 'hdl_user', 'vector_entity', 'vector_active_tab'].forEach((k) => localStorage.removeItem(k));
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
    setEntity({ type: null, id: null, name: '' });
  }, []);

  // Telas antigas ainda usam o axios global: mantém o token nele também.
  useEffect(() => {
    const token = localStorage.getItem('hdl_token');
    if (user && token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  }, [user]);

  useEffect(() => {
    window.addEventListener('vector:session-expired', logout);
    return () => window.removeEventListener('vector:session-expired', logout);
  }, [logout]);

  // Empresas e grupos do seletor; recarrega quando a tela de empresas avisa (scopesVersion).
  const [scopesVersion, setScopesVersion] = useState(0);
  const loadScopes = useCallback(() => setScopesVersion((v) => v + 1), []);
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    Promise.all([http.get('/companies'), http.get('/groups')])
      .then(([c, g]) => { if (alive) { setCompanies(c.data); setGroups(g.data); } })
      .catch(() => { /* a sessão expirada é tratada pelo interceptor */ });
    return () => { alive = false; };
  }, [user, scopesVersion]);


  useEffect(() => { if (user) localStorage.setItem('vector_active_tab', active); }, [active, user]);
  useEffect(() => { localStorage.setItem('vector_sidebar_collapsed', String(collapsed)); }, [collapsed]);
  useEffect(() => {
    if (entity.id) localStorage.setItem('vector_entity', JSON.stringify(entity));
    else localStorage.removeItem('vector_entity');
  }, [entity]);

  const handleLogin = ({ user: loggedUser, token }) => {
    localStorage.setItem('hdl_token', token);
    localStorage.setItem('hdl_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
    setActive(loggedUser.role === 'SUPER_ADMIN' ? 'admin' : 'dashboard');
  };

  const handleImpersonate = (targetUser, token) => {
    localStorage.setItem('hdl_token', token);
    localStorage.setItem('hdl_user', JSON.stringify(targetUser));
    localStorage.removeItem('vector_entity');
    setEntity({ type: null, id: null, name: '' });
    setUser(targetUser);
    setActive('dashboard');
  };

  const item = useMemo(() => ALL_ITEMS.find((i) => i.id === active) || ALL_ITEMS[0], [active]);

  if (!user) return <Login onLogin={handleLogin} />;

  // Empresa salva que não existe mais (ou é de outro usuário) conta como nenhuma.
  const scopesLoaded = companies.length > 0 || groups.length > 0;
  const scope = !entity.id || !scopesLoaded || (entity.type === 'group' ? groups : companies).some((x) => x.id === entity.id)
    ? entity : { type: null, id: null, name: '' };
  const companyId = scope.type === 'company' ? scope.id : null;
  const groupId = scope.type === 'group' ? scope.id : null;
  const company = companies.find((c) => c.id === companyId) || null;

  const renderPage = () => {
    if (item.scope !== 'none' && !scope.id) {
      return (
        <EmptyState
          icon={Building2}
          title="Escolha uma empresa para começar"
          description={companies.length > 0
            ? 'Use o seletor no topo da tela. Tudo o que você vir e lançar fica ligado à empresa escolhida.'
            : 'Ainda não há empresas cadastradas. Cadastre a primeira em “Empresas e grupos”.'}
          action={<Button variant="primary" icon={Building2} onClick={() => setActive('empresas')}>Ir para Empresas e grupos</Button>}
          className="min-h-[60vh]"
        />
      );
    }
    if (item.scope === 'company' && groupId) {
      return (
        <EmptyState
          icon={Layers}
          title={`“${item.label}” funciona por empresa`}
          description="Um grupo junta várias empresas e só a Visão geral mostra o consolidado. Escolha uma empresa do grupo no seletor do topo."
          className="min-h-[60vh]"
        />
      );
    }
    const common = { companyId, company, onNavigate: setActive };
    switch (item.id) {
      case 'dashboard': return <Dashboard companyId={companyId} groupId={groupId} companies={companies} />;
      case 'dre': return <DRE {...common} />;
      case 'saude': return <IntelligenceHub {...common} />;
      case 'projecoes': return <AnalyticalProjections {...common} />;
      case 'lancamentos': return <FinancialEntries {...common} />;
      case 'parceiros': return <Partners {...common} />;
      case 'precificacao': return <PricingWorkspace key={companyId} {...common} />;
      case 'empresas': return <Companies onChanged={loadScopes} onSelectCompany={(c) => { setEntity({ type: 'company', id: c.id, name: c.trade_name || c.name }); setActive('dashboard'); }} />;
      case 'questor': return <QuestorManager {...common} />;
      case 'auditoria': return <AuditLogs />;
      case 'admin': return <AdminPanel onImpersonate={handleImpersonate} />;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink print:block print:h-auto print:overflow-visible">
      <Sidebar
        user={user}
        active={active}
        onSelect={setActive}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0 print:block">
        <header className="print:hidden h-16 shrink-0 border-b border-line bg-surface flex items-center gap-3 px-4 sm:px-6">
          <button className="lg:hidden p-2 -ml-2 rounded-lg text-ink-2 hover:bg-surface-3" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate flex items-center gap-2"><item.icon size={16} className="text-brand shrink-0" /> {item.label}</p>
            <p className="hidden sm:block text-xs text-ink-3 truncate">{item.description}</p>
          </div>
          {item.scope !== 'none' && <ScopeSelector companies={companies} groups={groups} entity={scope} onChange={setEntity} />}
          <button onClick={toggleTheme} className="w-9 h-9 rounded-lg border border-line text-ink-2 hover:bg-surface-3 flex items-center justify-center shrink-0" title={isDark ? 'Usar tema claro' : 'Usar tema escuro'} aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto scroll-thin print:overflow-visible">{renderPage()}</main>
      </div>
    </div>
  );
};

export default App;
