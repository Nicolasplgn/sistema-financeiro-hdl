import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrainCircuit, Target, Zap, TrendingUp, 
  ShieldCheck, ArrowRight, FileSearch, Activity, Landmark, LineChart,
  PieChart, ArrowUpRight, Lightbulb, RefreshCw, Calendar,
  CheckCircle2, Trash2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// =============================================================================
// VECTOR SCORE — SVG responsivo com viewBox
// =============================================================================
const ScoreRing = ({ score }) => {
  const size   = 200;
  const cx     = size / 2;          // 100
  const cy     = size / 2;          // 100
  const r      = 80;
  const circ   = 2 * Math.PI * r;   // ≈ 502.65
  const offset = circ - (circ * score) / 100;

  const color = score > 70 ? '#34d399' : score > 40 ? '#60a5fa' : '#f87171';

  return (
    <div className="relative w-full max-w-[180px] mx-auto aspect-square">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full -rotate-90"
        aria-label={`Score ${score}`}
      >
        {/* Trilha */}
        <circle
          cx={cx} cy={cy} r={r}
          stroke="#1e293b"
          strokeWidth="14"
          fill="none"
        />
        {/* Progresso */}
        <motion.circle
          cx={cx} cy={cy} r={r}
          stroke={color}
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2.2, ease: 'easeOut' }}
        />
      </svg>
      {/* Número centralizado */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-4xl sm:text-5xl font-black font-mono tracking-tighter text-white leading-none"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500 mt-1">
          Score
        </span>
      </div>
    </div>
  );
};

// =============================================================================
// KPI CHIP — usado nos badges do card de score
// =============================================================================
const KpiChip = ({ label, color }) => (
  <span className={`px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest italic ${color}`}>
    {label}
  </span>
);

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
const IntelligenceHub = ({ companyId, apiBase, onNavigate }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  
  const [data, setData] = useState({ realized: [], planned: 0, insights: [], forecast: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedYear, setSelectedYear] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vector_bi_year')) || new Date().getFullYear(); }
    catch(e) { return new Date().getFullYear(); }
  });

  useEffect(() => {
    localStorage.setItem('vector_bi_year', JSON.stringify(selectedYear));
  }, [selectedYear]);

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalValue, setGoalValue]   = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState(false);

  const availableYears = useMemo(() => {
    const c = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => c - i);
  }, []);

  const loadIntelligence = async () => {
    if (!companyId) return;
    setRefreshing(true);
    try {
      const { data: res } = await axios.get(`${BASE_URL}/api/intelligence/${companyId}/${selectedYear}`);
      setData(res);
      setGoalValue(res.planned
        ? parseFloat(res.planned).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        : ''
      );
    } catch (e) { console.error('Erro BI:', e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadIntelligence(); }, [companyId, selectedYear]);

  const handleCurrencyChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setGoalValue(''); return; }
    setGoalValue((parseFloat(raw) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSaveGoal = async () => {
    if (!companyId || !goalValue) return;
    setSavingGoal(true);
    try {
      await axios.post(`${BASE_URL}/api/intelligence/goals`, {
        companyId, year: selectedYear,
        plannedAmount: parseFloat(goalValue.replace(/\./g, '').replace(',', '.'))
      });
      await loadIntelligence();
      setIsGoalModalOpen(false);
    } catch { alert('Erro ao salvar meta.'); }
    finally { setSavingGoal(false); }
  };

  const handleDeleteGoal = async () => {
    if (!companyId || !confirm(`Remover meta de ${selectedYear}?`)) return;
    setDeletingGoal(true);
    try {
      await axios.delete(`${BASE_URL}/api/intelligence/goals`, { params: { companyId, year: selectedYear } });
      setIsGoalModalOpen(false);
      setGoalValue('');
      loadIntelligence();
    } catch { alert('Erro ao deletar meta.'); }
    finally { setDeletingGoal(false); }
  };

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const financialScore = useMemo(() => {
    if (!data.realized?.length) return 0;
    const last   = data.realized[data.realized.length - 1];
    const rev    = Number(last.revenue) || 0;
    const costs  = Number(last.costs)   || 0;
    const taxes  = Number(last.taxes)   || 0;
    const margin = rev > 0 ? ((rev - costs - taxes) / rev) * 100 : 0;
    let s = 50;
    if (margin > 25) s += 30; else if (margin > 10) s += 15; else if (margin < 0) s -= 30;
    if (data.realized.length > 1 && rev > Number(data.realized[data.realized.length - 2].revenue)) s += 20;
    return Math.min(Math.max(s, 0), 100);
  }, [data]);

  const totalAcumulado = useMemo(
    () => (data.realized || []).reduce((a, c) => a + Number(c.revenue), 0),
    [data]
  );

  const budgetPct = Math.min((totalAcumulado / (data.planned || 1)) * 100, 100);

  const auditCards = [
    { label: 'Arquivos Integrados', desc: 'Layouts Questor gerados.', icon: Landmark, target: 'questor', accent: 'text-blue-600 bg-blue-50' },
    { label: 'Drill-down DRE',      desc: 'Explosão analítica do resultado.', icon: PieChart, target: 'dre',     accent: 'text-emerald-600 bg-emerald-50' },
    { label: 'Logs Corporativos',   desc: 'Séries temporais imutáveis.',     icon: ShieldCheck, target: 'audit', accent: 'text-slate-600 bg-slate-100' },
  ];

  // ── Loading ──
  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-14 h-14 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
        Processando Inteligência Vector...
      </p>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24 animate-in fade-in duration-700">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Título */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter italic flex items-center gap-2 truncate">
            <BrainCircuit className="text-blue-600 shrink-0" size={28} />
            <span>Vector Intelligence Hub</span>
          </h1>
          <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest mt-0.5">
            Status Operacional e Projeções de Mercado
          </p>
        </div>

        {/* Controles — empilham em mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de ano */}
          <div className="relative flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl px-3 py-2.5 shadow-sm">
            <Calendar size={15} className="text-blue-600 shrink-0" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent font-black text-slate-900 outline-none cursor-pointer text-sm appearance-none pr-4"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Botão meta */}
          <button
            onClick={() => setIsGoalModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition active:scale-95 shadow-lg"
          >
            <Target size={14} className="text-blue-400" />
            <span className="hidden xs:inline">Meta {selectedYear}</span>
            <span className="xs:hidden">Meta</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadIntelligence}
            disabled={refreshing}
            className="p-2.5 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded-2xl transition shadow-sm active:scale-95"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── LINHA 1: SCORE + INSIGHTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-slate-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl border border-white/5"
        >
          <div className="absolute right-0 top-0 w-64 h-64 sm:w-96 sm:h-96 bg-blue-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            {/* Anel — tamanho máximo controlado */}
            <div className="w-36 sm:w-44 shrink-0">
              <ScoreRing score={financialScore} />
            </div>

            {/* Texto */}
            <div className="flex-1 text-center sm:text-left space-y-4">
              <h2 className="text-xl sm:text-2xl font-black tracking-tighter italic">
                Saúde Operacional
              </h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Seu negócio atingiu{' '}
                <span className="text-white font-black">{financialScore}%</span>{' '}
                de eficiência para o ano de {selectedYear}.
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <KpiChip label="Auditoria OK"     color="bg-white/5 border-white/10 text-emerald-400" />
                <KpiChip label="Dados em Realtime" color="bg-white/5 border-white/10 text-blue-400" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Insights Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0"><Zap size={18} /></div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
              Smart Insights {selectedYear}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-48 sm:max-h-none custom-scrollbar pr-1">
            {data.insights?.length
              ? data.insights.map((msg, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border-l-4 border-l-blue-500 text-xs font-bold text-slate-700 leading-relaxed">
                    {msg}
                  </div>
                ))
              : (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-300 opacity-40">
                  <Lightbulb size={36} />
                  <p className="text-[9px] font-black mt-2 uppercase tracking-widest">Nada a reportar</p>
                </div>
              )
            }
          </div>
        </motion.div>
      </div>

      {/* ── LINHA 2: BUDGET + FORECAST ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Budget */}
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl shrink-0"><Target size={18} /></div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">
                Eficiência do Budget
              </h3>
            </div>
            <span className="text-slate-900 font-black font-mono text-base italic shrink-0">
              {budgetPct.toFixed(1)}%
            </span>
          </div>

          {/* Barra de progresso */}
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-6 shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${budgetPct}%` }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
              className={`h-full rounded-full shadow-sm ${budgetPct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Meta Definida</p>
              <p className="text-sm sm:text-base font-black text-slate-900 font-mono truncate">{fmt(data.planned)}</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1 italic">Realizado {selectedYear}</p>
              <p className="text-sm sm:text-base font-black text-emerald-700 font-mono truncate">{fmt(totalAcumulado)}</p>
            </div>
          </div>
        </div>

        {/* Forecast */}
        <div className="bg-slate-900 rounded-2xl p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none" />

          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0"><LineChart size={18} /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest italic">
              Financial Forecast
            </h3>
          </div>

          <div className="flex flex-col items-center justify-center py-4 relative z-10">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">
              Estimativa Próximo Período
            </p>
            <div className="flex items-center gap-3 w-full justify-center">
              <h4 className="text-2xl sm:text-4xl font-black font-mono italic text-emerald-400 tracking-tighter truncate">
                {fmt(data.forecast)}
              </h4>
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 animate-bounce shrink-0">
                <ArrowUpRight size={24} />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-5 font-medium text-center italic opacity-70 max-w-[200px]">
              Cálculo preditivo com confiança de 88%.
            </p>
          </div>
        </div>
      </div>

      {/* ── LINHA 3: AUDITORIA ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0"><FileSearch size={22} /></div>
          <div>
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight italic">
              Central de Auditoria Vector
            </h3>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
              Compliance e Rastreabilidade do Ciclo BI
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {auditCards.map((item, i) => (
            <button
              key={i}
              onClick={() => onNavigate && onNavigate(item.target)}
              className="group text-left p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all duration-300 shadow-sm hover:shadow-xl active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <div className={`p-3 rounded-2xl w-fit mb-4 transition-colors ${item.accent} group-hover:bg-white/10 group-hover:text-white`}>
                <item.icon size={22} />
              </div>
              <h5 className="font-black text-[11px] uppercase tracking-widest mb-1 italic">{item.label}</h5>
              <p className="text-[11px] opacity-60 leading-relaxed font-bold">{item.desc}</p>
              <div className="mt-4 flex items-center gap-1.5 text-blue-600 font-black text-[9px] uppercase tracking-widest group-hover:text-blue-400 transition-colors">
                Acessar <ArrowRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── MODAL META ── */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          >
            {/* Clica fora para fechar */}
            <div className="absolute inset-0" onClick={() => setIsGoalModalOpen(false)} />

            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
            >
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0"><Target size={24} /></div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tighter italic">Definir Meta Anual</h2>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Competência: {selectedYear}</p>
                  </div>
                </div>

                {/* Input de valor */}
                <div className="flex items-center bg-slate-50 border-2 border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl px-5 py-4 transition-all">
                  <span className="text-blue-600 font-black text-lg mr-2 select-none shrink-0">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={goalValue}
                    onChange={handleCurrencyChange}
                    placeholder="0,00"
                    className="bg-transparent border-none outline-none text-2xl sm:text-4xl font-black text-slate-900 w-full font-mono placeholder-slate-300"
                    autoFocus
                  />
                </div>

                {/* Botões */}
                <div className="flex flex-col xs:flex-row gap-3">
                  <button
                    onClick={() => setIsGoalModalOpen(false)}
                    className="flex-1 py-4 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition order-last xs:order-first"
                  >
                    Cancelar
                  </button>

                  {data.planned > 0 && (
                    <button
                      onClick={handleDeleteGoal}
                      disabled={deletingGoal || savingGoal}
                      className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {deletingGoal ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      Remover
                    </button>
                  )}

                  <button
                    onClick={handleSaveGoal}
                    disabled={savingGoal || deletingGoal || !goalValue}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition shadow-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingGoal ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                    Salvar Meta
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        @media (max-width: 480px) { .xs\\:flex-row { flex-direction: row; } .xs\\:inline { display: inline; } .xs\\:hidden { display: none; } }
      `}} />
    </div>
  );
};

export default IntelligenceHub;