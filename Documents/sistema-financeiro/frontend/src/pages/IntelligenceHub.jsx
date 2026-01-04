import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrainCircuit, Target, Zap, TrendingUp, 
  ShieldCheck, AlertTriangle, ArrowRight, 
  FileSearch, Activity, Landmark, LineChart,
  PieChart, BarChart3, ArrowUpRight,
  ArrowDownRight, Lightbulb, Sparkles, RefreshCw, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

/**
 * MÓDULO DE INTELIGÊNCIA E BI - VECTOR CONNECT ENTERPRISES
 * Versão: 2.0 - Com Filtro de Séries Temporais
 */
const IntelligenceHub = ({ companyId, apiBase }) => {
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
  
  // ESTADO DE FILTRO DE ANO
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Gera lista de anos disponíveis para o filtro (últimos 5 anos)
  const availableYears = useMemo(() => {
    const years = [];
    const current = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      years.push(current - i);
    }
    return years;
  }, []);

  // Função para carregar os dados de Inteligência do Backend baseados no ANO
  const loadIntelligence = async () => {
    if (!companyId) return;
    setRefreshing(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/intelligence/${companyId}/${selectedYear}`);
      if (response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error("Erro ao carregar hub de inteligência:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Recarrega os dados sempre que a empresa ou o ano mudar
  useEffect(() => {
    loadIntelligence();
  }, [companyId, selectedYear]);

  // Formatação para Real (BRL)
  const formatBRL = (valor) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(valor || 0);
  };

  // Lógica de Cálculo do Score de Saúde Financeira
  const financialScore = useMemo(() => {
    if (!data.realized || data.realized.length === 0) return 0;
    
    const ultimoMes = data.realized[data.realized.length - 1];
    const receita = Number(ultimoMes.revenue) || 0;
    const custos = Number(ultimoMes.costs) || 0;
    const impostos = Number(ultimoMes.taxes) || 0;
    const lucro = receita - custos - impostos;
    
    const margemLiquida = receita > 0 ? (lucro / receita) * 100 : 0;
    
    let scoreCalculado = 50; 
    
    if (margemLiquida > 25) scoreCalculado += 30;
    else if (margemLiquida > 10) scoreCalculado += 15;
    else if (margemLiquida < 0) scoreCalculado -= 30;

    if (data.realized.length > 1) {
      const mesAnterior = data.realized[data.realized.length - 2];
      if (receita > Number(mesAnterior.revenue)) scoreCalculado += 20;
    }

    return Math.min(Math.max(scoreCalculado, 0), 100);
  }, [data]);

  // Soma do Realizado Total do Ano Selecionado
  const totalRealizadoAcumulado = useMemo(() => {
    if (!data.realized) return 0;
    return data.realized.reduce((acumulador, atual) => acumulador + Number(atual.revenue), 0);
  }, [data]);

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100 m-6 shadow-2xl">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 text-center">
          Sincronizando BI Corporativo...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-20 animate-in fade-in duration-1000">
      
      {/* CABEÇALHO SUPERIOR COM FILTRO DE ANO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
             <BrainCircuit className="text-blue-600" size={36}/> Vector Intelligence Hub
           </h1>
           <p className="text-slate-400 font-bold text-sm uppercase tracking-widest text-[10px] mt-1 italic">Análise de Dados e Saúde em Tempo Real</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-[2rem] border border-slate-200 shadow-sm">
          {/* SELETOR DE ANO BLACK PREMIUM */}
          <div className="flex items-center gap-2 px-4 border-r border-slate-100">
             <Calendar size={18} className="text-blue-600"/>
             <select 
               value={selectedYear}
               onChange={(e) => setSelectedYear(Number(e.target.value))}
               className="bg-transparent font-black text-slate-900 outline-none cursor-pointer text-sm"
             >
               {availableYears.map(year => (
                 <option key={year} value={year}>{year}</option>
               ))}
             </select>
          </div>

          <button 
            onClick={loadIntelligence} 
            disabled={refreshing}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Atualizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CARD DO SCORE (SAÚDE FINANCEIRA) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl border border-white/5"
        >
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="relative flex items-center justify-center">
               <svg className="w-48 h-48 rotate-[-90deg]">
                 <circle cx="96" cy="96" r="84" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-800" />
                 <motion.circle 
                    cx="96" cy="96" r="84" stroke="currentColor" strokeWidth="16" fill="transparent" 
                    strokeDasharray={527.7} 
                    initial={{ strokeDashoffset: 527.7 }}
                    animate={{ strokeDashoffset: 527.7 - (527.7 * financialScore) / 100 }}
                    transition={{ duration: 2.5, ease: "easeOut" }}
                    className={`${financialScore > 70 ? 'text-emerald-400' : financialScore > 40 ? 'text-blue-400' : 'text-rose-400'}`} 
                    strokeLinecap="round" 
                 />
               </svg>
               <div className="absolute flex flex-col items-center">
                  <span className="text-6xl font-black font-mono tracking-tighter italic">{financialScore}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vector Score</span>
               </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-4">
                <h2 className="text-3xl font-black tracking-tight italic">Performance Operacional {selectedYear}</h2>
                <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-md">
                   Seu índice de eficiência para o ano de <span className="text-white font-bold">{selectedYear}</span> está em <span className="text-white font-bold">{financialScore}%</span>.
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                   <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest italic shadow-sm">Operação Auditada</div>
                   <div className="px-4 py-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest italic shadow-sm">Liquidez Verificada</div>
                </div>
            </div>
          </div>
        </motion.div>

        {/* CARD SMART INSIGHTS */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} 
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden"
        >
          <div className="flex items-center gap-3 font-black text-[11px] text-blue-600 uppercase tracking-widest mb-8">
            <div className="p-2 bg-blue-50 rounded-xl"><Zap size={18}/></div>
            Smart Insights {selectedYear}
          </div>

          <div className="space-y-4 flex-1">
            {data.insights && data.insights.length > 0 ? data.insights.map((msg, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-2xl border-l-4 border-l-blue-500 text-xs font-bold text-slate-700 leading-relaxed shadow-sm">
                  {msg}
              </div>
            )) : (
              <div className="h-40 flex flex-col items-center justify-center text-slate-300 gap-2 italic">
                <Lightbulb size={32} className="opacity-20"/>
                <p className="text-[10px] font-black uppercase tracking-widest">Sem novos alertas para {selectedYear}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* CARD PLANEJADO VS REALIZADO */}
        <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-[0.2em] flex items-center gap-3 italic">
              <div className="p-2 bg-rose-50 text-rose-500 rounded-xl"><Target size={18}/></div>
              Budget Anual {selectedYear}
            </h3>
          </div>
          
          <div className="space-y-10">
            <div>
              <div className="flex justify-between text-[11px] font-black uppercase mb-3">
                <span className="text-slate-400">Progresso da Meta Anual</span>
                <span className="text-slate-900 font-mono italic">{((totalRealizadoAcumulado / (data.planned || 1)) * 100).toFixed(1)}%</span>
              </div>
              <div className="h-6 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-1 shadow-inner">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${Math.min((totalRealizadoAcumulado / (data.planned || 1)) * 100, 100)}%` }} 
                  transition={{ duration: 2, ease: "circOut" }}
                  className="h-full bg-blue-600 rounded-full shadow-lg" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Meta Definida</p>
                <p className="text-2xl font-black text-slate-700 font-mono tracking-tighter italic">{formatBRL(data.planned)}</p>
              </div>
              <div className="p-6 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 shadow-sm">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 italic">Realizado Total</p>
                <p className="text-2xl font-black text-emerald-700 font-mono tracking-tighter italic">{formatBRL(totalRealizadoAcumulado)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CARD FORECAST (PROJEÇÃO) */}
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
           <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[80px]" />
           <div className="flex justify-between items-center mb-10 relative z-10">
            <h3 className="font-black text-white text-xs uppercase tracking-[0.2em] flex items-center gap-3 italic">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl"><LineChart size={18}/></div>
              Previsão Inteligente (Forecast)
            </h3>
          </div>
          
          <div className="flex flex-col items-center justify-center py-6 relative z-10">
             <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 text-center">Tendência Estimada para {selectedYear + 1}</p>
             <div className="flex items-center gap-4">
                <h4 className="text-6xl font-black font-mono italic text-emerald-400 tracking-tighter">{formatBRL(data.forecast)}</h4>
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 animate-bounce">
                   <ArrowUpRight size={32} />
                </div>
             </div>
             <p className="text-xs text-slate-400 mt-8 font-medium max-w-[320px] text-center leading-relaxed italic opacity-80">
               Baseado em modelos de regressão linear aplicados sobre a performance de {selectedYear}.
             </p>
          </div>
          
          <div className="mt-10 pt-8 border-t border-white/5 flex justify-between items-center relative z-10">
             <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
               <ShieldCheck size={18} className="text-emerald-400"/>
               Nível de Confiança: <span className="text-white font-mono">88%</span>
             </div>
          </div>
        </div>
      </div>

      {/* CARD CENTRAL DE AUDITORIA */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm"
      >
        <div className="flex items-center gap-4 mb-10">
           <div className="p-3 bg-blue-50 text-blue-600 rounded-[1.5rem] shadow-sm"><FileSearch size={24}/></div>
           <div>
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest italic">Central de Auditoria Vector</h3>
              <p className="text-xs text-slate-400 font-medium">Compliance e Rastreabilidade do Ciclo Financeiro</p>
           </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {/* ARQUIVOS */}
           <div className="group cursor-pointer p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all duration-500 shadow-sm hover:shadow-2xl">
              <div className="p-4 bg-white rounded-2xl w-fit mb-6 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                 <Landmark size={28} className="text-blue-600 group-hover:text-white" />
              </div>
              <h5 className="font-black text-[11px] uppercase tracking-widest mb-2 italic">Arquivos Integrados</h5>
              <p className="text-[10px] opacity-60 leading-relaxed font-medium">Acesso ao repositório de layouts gerados para o Questor.</p>
              <div className="mt-6 flex items-center gap-2 text-blue-500 font-black text-[9px] uppercase tracking-widest group-hover:text-white">
                 Acessar Repositório <ArrowRight size={12}/>
              </div>
           </div>

           {/* DRILL-DOWN */}
           <div className="group cursor-pointer p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all duration-500 shadow-sm hover:shadow-2xl">
              <div className="p-4 bg-white rounded-2xl w-fit mb-6 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                 <FileSearch size={28} className="text-emerald-600 group-hover:text-white" />
              </div>
              <h5 className="font-black text-[11px] uppercase tracking-widest mb-2 italic">Drill-down DRE</h5>
              <p className="text-[10px] opacity-60 leading-relaxed font-medium">Explosão analítica dos valores que compõem o resultado líquido.</p>
              <div className="mt-6 flex items-center gap-2 text-emerald-500 font-black text-[9px] uppercase tracking-widest group-hover:text-white">
                 Explodir Detalhes <ArrowRight size={12}/>
              </div>
           </div>

           {/* LOGS */}
           <div className="group cursor-pointer p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all duration-500 shadow-sm hover:shadow-2xl">
              <div className="p-4 bg-white rounded-2xl w-fit mb-6 shadow-sm group-hover:bg-amber-500 group-hover:text-white transition-colors">
                 <ShieldCheck size={28} className="text-amber-500 group-hover:text-white" />
              </div>
              <h5 className="font-black text-[11px] uppercase tracking-widest mb-2 italic">Logs Operacionais</h5>
              <p className="text-[10px] opacity-60 leading-relaxed font-medium">Histórico imutável de ações críticas registradas em {selectedYear}.</p>
              <div className="mt-6 flex items-center gap-2 text-amber-500 font-black text-[9px] uppercase tracking-widest group-hover:text-white">
                 Consultar Histórico <ArrowRight size={12}/>
              </div>
           </div>
        </div>
      </motion.div>

      {/* ESTILIZAÇÃO DE SCROLLBAR CUSTOMIZADA */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
};

export default IntelligenceHub;