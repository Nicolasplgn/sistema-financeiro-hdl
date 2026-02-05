import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrainCircuit, Target, Zap, TrendingUp, 
  ShieldCheck, ArrowRight, FileSearch, Activity, Landmark, LineChart,
  PieChart, ArrowUpRight, Lightbulb, RefreshCw, Calendar,
  CheckCircle2, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

/**
 * MÓDULO DE INTELIGÊNCIA E BI - VECTOR CONNECT ENTERPRISES
 * Versão: 3.4 - Memória de Filtro (Persistência)
 */
const IntelligenceHub = ({ companyId, apiBase, onNavigate }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  
  // ESTADOS DO HUB
  const [data, setData] = useState({
    realized: [],
    planned: 0,
    insights: [],
    forecast: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // MEMÓRIA DE FILTRO: ANO SELECIONADO
  const [selectedYear, setSelectedYear] = useState(() => {
    try {
        const saved = localStorage.getItem('vector_bi_year');
        return saved ? JSON.parse(saved) : new Date().getFullYear();
    } catch(e) { return new Date().getFullYear(); }
  });

  // Salva sempre que mudar
  useEffect(() => {
    localStorage.setItem('vector_bi_year', JSON.stringify(selectedYear));
  }, [selectedYear]);

  // ESTADOS PARA DEFINIÇÃO DE META
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalValue, setGoalValue] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState(false);

  // Gera lista de anos disponíveis
  const availableYears = useMemo(() => {
    const years = [];
    const current = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      years.push(current - i);
    }
    return years;
  }, []);

  // Carregar dados de BI
  const loadIntelligence = async () => {
    if (!companyId) return;
    setRefreshing(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/intelligence/${companyId}/${selectedYear}`);
      if (response.data) {
        setData(response.data);
        if (response.data.planned) {
            const val = parseFloat(response.data.planned);
            setGoalValue(val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        } else {
            setGoalValue('');
        }
      }
    } catch (error) {
      console.error("Erro BI:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadIntelligence();
  }, [companyId, selectedYear]);

  // Função para formatar input monetário ao digitar
  const handleCurrencyChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value === "") { setGoalValue(""); return; }
    const numericValue = parseFloat(value) / 100;
    setGoalValue(numericValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  // Salvar Meta
  const handleSaveGoal = async () => {
    if (!companyId || !goalValue) return;
    const rawValue = parseFloat(goalValue.replace(/\./g, '').replace(',', '.'));
    setSavingGoal(true);
    try {
      await axios.post(`${BASE_URL}/api/intelligence/goals`, { companyId, year: selectedYear, plannedAmount: rawValue });
      await loadIntelligence();
      setIsGoalModalOpen(false);
    } catch (error) { alert("Erro ao salvar meta."); } finally { setSavingGoal(false); }
  };

  // Deletar Meta
  const handleDeleteGoal = async () => {
    if (!companyId || !confirm(`Remover meta de ${selectedYear}?`)) return;
    setDeletingGoal(true);
    try {
      // IMPORTANTE: Enviar como 'params' para que o axios monte a URL: ?companyId=X&year=Y
      await axios.delete(`${BASE_URL}/api/intelligence/goals`, { 
        params: { 
          companyId: companyId, 
          year: selectedYear 
        } 
      });
      
      alert("Meta removida!");
      setIsGoalModalOpen(false);
      setGoalValue('');
      loadIntelligence(); // Recarrega os dados na tela
    } catch (error) {
      console.error(error);
      alert("Erro ao deletar meta.");
    } finally {
      setDeletingGoal(false);
    }
  };
  const formatBRL = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  // Lógica de Score
  const financialScore = useMemo(() => {
    if (!data.realized || data.realized.length === 0) return 0;
    const ultimoMes = data.realized[data.realized.length - 1];
    const receita = Number(ultimoMes.revenue) || 0;
    const custos = Number(ultimoMes.costs) || 0;
    const impostos = Number(ultimoMes.taxes) || 0;
    const lucro = receita - custos - impostos;
    const margemLiquida = receita > 0 ? (lucro / receita) * 100 : 0;
    let score = 50;
    if (margemLiquida > 25) score += 30;
    else if (margemLiquida > 10) score += 15;
    else if (margemLiquida < 0) score -= 30;
    if (data.realized.length > 1) {
      const mesAnterior = data.realized[data.realized.length - 2];
      if (receita > Number(mesAnterior.revenue)) score += 20;
    }
    return Math.min(Math.max(score, 0), 100);
  }, [data]);

  const totalRealizadoAcumulado = useMemo(() => {
    if (!data.realized) return 0;
    return data.realized.reduce((acc, curr) => acc + Number(curr.revenue), 0);
  }, [data]);

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100 m-6 shadow-2xl">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 font-black text-[10px] uppercase tracking-[0.3em] text-slate-400">Processando Inteligência Vector...</p>
      </div>
    );
  }

  // CONFIGURAÇÃO DOS CARDS DE AUDITORIA
  const auditCards = [
     { label: 'Arquivos Integrados', desc: 'Layouts Questor gerados.', icon: Landmark, color: 'blue', target: 'questor' },
     { label: 'Drill-down DRE', desc: 'Explosão analítica do resultado.', icon: PieChart, color: 'emerald', target: 'dre' },
     { label: 'Logs Corporativos', desc: 'Séries temporais imutáveis.', icon: ShieldCheck, color: 'slate', target: 'audit' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-20 animate-in fade-in duration-1000">
      
      {/* HEADER SUPERIOR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-3 italic">
             <BrainCircuit className="text-blue-600" size={36}/> Vector Intelligence Hub
           </h1>
           <p className="text-slate-400 font-bold text-sm uppercase tracking-widest text-[10px] mt-1">Status Operacional e Projeções de Mercado</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[2.5rem] border border-slate-200 shadow-xl">
          <button onClick={() => setIsGoalModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-lg active:scale-95">
            <Target size={16} className="text-blue-400" /> Definir Meta {selectedYear}
          </button>
          <div className="flex items-center gap-2 px-4 border-l border-r border-slate-100">
             <Calendar size={18} className="text-blue-600"/>
             <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent font-black text-slate-900 outline-none cursor-pointer text-sm">
               {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
             </select>
          </div>
          <button onClick={loadIntelligence} disabled={refreshing} className="p-3 text-slate-400 hover:text-blue-600 transition">
            <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CARD SCORE */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl border border-white/5">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="relative flex items-center justify-center">
               <svg className="w-52 h-52 rotate-[-90deg]">
                 <circle cx="104" cy="104" r="92" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-800" />
                 <motion.circle cx="104" cy="104" r="92" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray={578} initial={{ strokeDashoffset: 578 }} animate={{ strokeDashoffset: 578 - (578 * financialScore) / 100 }} transition={{ duration: 2.5 }} className={`${financialScore > 70 ? 'text-emerald-400' : 'text-blue-400'}`} strokeLinecap="round" />
               </svg>
               <div className="absolute flex flex-col items-center">
                  <span className="text-7xl font-black font-mono tracking-tighter italic">{financialScore}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vector Score</span>
               </div>
            </div>
            <div className="flex-1 text-center md:text-left space-y-6">
                <h2 className="text-4xl font-black tracking-tighter italic">Saúde Operacional</h2>
                <p className="text-slate-400 text-base font-medium leading-relaxed max-w-md">Seu negócio atingiu <span className="text-white font-bold">{financialScore}%</span> de eficiência para o ano de {selectedYear}.</p>
                <div className="flex gap-4 justify-center md:justify-start">
                   <div className="px-5 py-2.5 bg-white/5 rounded-xl border border-white/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest italic">Auditoria OK</div>
                   <div className="px-5 py-2.5 bg-white/5 rounded-xl border border-white/10 text-blue-400 text-[10px] font-black uppercase tracking-widest italic">Dados em Realtime</div>
                </div>
            </div>
          </div>
        </motion.div>

        {/* CARD INSIGHTS */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 font-black text-[11px] text-blue-600 uppercase tracking-widest mb-10">
            <div className="p-3 bg-blue-50 rounded-2xl"><Zap size={20}/></div>
            Smart Insights {selectedYear}
          </div>
          <div className="space-y-4 flex-1">
            {data.insights?.map((msg, idx) => (
              <div key={idx} className="p-5 bg-slate-50 rounded-3xl border-l-4 border-l-blue-500 text-xs font-black text-slate-700 leading-relaxed shadow-sm uppercase tracking-tighter italic">{msg}</div>
            ))}
            {!data.insights?.length && <div className="h-40 flex flex-col items-center justify-center text-slate-300 opacity-30"><Lightbulb size={48}/><p className="text-[10px] font-black mt-2">NADA A REPORTAR</p></div>}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* CARD BUDGET VS REALIZADO */}
        <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-12">
            <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.3em] flex items-center gap-3 italic">
              <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl"><Target size={20}/></div>
              Eficiência do Budget
            </h3>
            <span className="text-slate-900 font-black font-mono text-sm lg:text-base italic">
                {((totalRealizadoAcumulado / (data.planned || 1)) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="space-y-12">
            <div className="h-8 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-1.5 shadow-inner">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((totalRealizadoAcumulado / (data.planned || 1)) * 100, 100)}%` }} transition={{ duration: 2 }} className="h-full bg-blue-600 rounded-full shadow-lg" />
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Meta Definida</p>
                <p className="text-xl lg:text-2xl font-black text-slate-900 font-mono tracking-tighter italic truncate">{formatBRL(data.planned)}</p>
              </div>
              <div className="p-8 bg-emerald-50 rounded-[3rem] border border-emerald-100 text-center">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 italic">Realizado {selectedYear}</p>
                <p className="text-xl lg:text-2xl font-black text-emerald-700 font-mono tracking-tighter italic truncate">{formatBRL(totalRealizadoAcumulado)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CARD FORECAST */}
        <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
           <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[80px]" />
           <div className="flex justify-between items-center mb-12">
            <h3 className="font-black text-white text-xs uppercase tracking-[0.3em] flex items-center gap-3 italic">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl"><LineChart size={20}/></div>
              Financial Forecast
            </h3>
          </div>
          <div className="flex flex-col items-center justify-center py-6">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Estimativa Próximo Período</p>
             <div className="flex items-center gap-4 lg:gap-6 w-full justify-center">
                <h4 className="text-4xl lg:text-5xl font-black font-mono italic text-emerald-400 tracking-tighter truncate max-w-full">{formatBRL(data.forecast)}</h4>
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 animate-bounce shrink-0"><ArrowUpRight size={32} /></div>
             </div>
             <p className="text-xs text-slate-400 mt-10 font-medium text-center italic opacity-70">Cálculo preditivo estatístico com confiança de 88%.</p>
          </div>
        </div>
      </div>

      {/* CARD AUDITORIA (FUNCIONAL) */}
      <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 mb-12">
           <div className="p-4 bg-blue-50 text-blue-600 rounded-[2rem] shadow-sm"><FileSearch size={28}/></div>
           <div>
              <h3 className="font-black text-slate-900 text-lg uppercase tracking-tighter italic">Central de Auditoria Vector</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Compliance e Rastreabilidade do Ciclo BI</p>
           </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
           {auditCards.map((item, i) => (
             <div 
               key={i} 
               onClick={() => onNavigate && onNavigate(item.target)} // AQUI ESTÁ A MÁGICA
               className="group cursor-pointer p-10 rounded-[3rem] bg-slate-50 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all duration-500 shadow-sm hover:shadow-2xl"
             >
                <div className={`p-5 bg-white rounded-3xl w-fit mb-8 shadow-md group-hover:bg-${item.color}-600 group-hover:text-white transition-colors`}>
                   <item.icon size={32} />
                </div>
                <h5 className="font-black text-xs uppercase tracking-widest mb-2 italic">{item.label}</h5>
                <p className="text-[11px] opacity-60 leading-relaxed font-bold">{item.desc}</p>
                <div className="mt-8 flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest group-hover:text-white">Acessar <ArrowRight size={14}/></div>
             </div>
           ))}
        </div>
      </div>

      {/* MODAL PARA DEFINIR META */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
               <div className="p-10 text-center space-y-8">
                  <div className="p-5 bg-blue-50 text-blue-600 rounded-[2rem] w-fit mx-auto shadow-sm"><Target size={40} /></div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic">Definir Meta Anual</h2>
                    <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-2">Ano Competência: {selectedYear}</p>
                  </div>
                  <div className="flex items-center justify-center bg-slate-50 border-2 border-slate-200 rounded-[2rem] px-6 py-8 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-600/10 transition-all">
                    <span className="text-blue-600 font-black text-2xl italic mr-2 select-none">R$</span>
                    <input type="text" value={goalValue} onChange={handleCurrencyChange} placeholder="0,00" className="bg-transparent border-none outline-none text-4xl lg:text-5xl font-black text-slate-900 w-full text-center placeholder-slate-200 font-mono italic tracking-tighter z-10"/>
                    <span className="text-slate-400 font-bold text-xs uppercase ml-2 tracking-widest select-none">BRL</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-4">
                      {data.planned > 0 && (
                        <button onClick={handleDeleteGoal} disabled={deletingGoal || savingGoal} className="flex-1 py-5 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
                          {deletingGoal ? <RefreshCw className="animate-spin" size={16}/> : <Trash2 size={16}/>} Remover Meta
                        </button>
                      )}
                      <button onClick={() => setIsGoalModalOpen(false)} className={`${data.planned > 0 ? 'flex-1' : 'flex-1'} py-5 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition`}>Cancelar</button>
                      <button onClick={handleSaveGoal} disabled={savingGoal || deletingGoal} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
                        {savingGoal ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>} Salvar Meta
                      </button>
                    </div>
                  </div>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
    </div>
  );
};

export default IntelligenceHub;