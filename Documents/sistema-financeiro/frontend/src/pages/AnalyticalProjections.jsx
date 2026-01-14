import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Target, Sliders, AlertTriangle, DollarSign, Wallet,
  RefreshCw, BarChart3, ArrowUpRight, ArrowDownRight, Activity, Calendar, Wand2, RotateCcw,
  Hourglass, Sun, Snowflake
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import api from '../services/api'; // <--- IMPORTAÇÃO CORRETA DA INSTÂNCIA AXIOS

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

/**
 * Algoritmo de Regressão Linear Simples para calcular tendência estatística
 */
const calculateTrend = (values) => {
    const n = values.length;
    if (n < 2) return 0;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    values.forEach((y, x) => {
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avg = sumY / n;
    
    return avg !== 0 ? (slope / avg) * 100 : 0;
};

const KpiCard = ({ title, value, sub, colorClass, icon: Icon }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-opacity-10 ${colorClass} ${colorClass.replace('bg-', 'text-')}`}>
            <Icon size={20} />
        </div>
    </div>
    <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{value}</h3>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{title}</p>
    <p className="text-[11px] text-slate-500 mt-2 font-medium">{sub}</p>
  </div>
);

const AnalyticalProjections = ({ globalCompanyId }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  
  // Estados de Controle de Simulação
  const [growthRate, setGrowthRate] = useState(0); 
  const [costRate, setCostRate] = useState(0);
  const [currentCash, setCurrentCash] = useState(''); 
  const [viewScenario, setViewScenario] = useState('ALL'); 

  const formatBRL = (valor) => valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    if (!globalCompanyId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // --- AQUI ESTÁ A CORREÇÃO: USANDO api.get ---
        // O token JWT será injetado automaticamente pelo interceptor definido em services/api.js
        const response = await api.get(`/api/intelligence/projections`, {
            params: { companyId: globalCompanyId }
        });
        
        setData(response.data);
      } catch (err) { 
          console.error("Erro ao carregar projeções:", err); 
      } finally { 
          setLoading(false); 
      }
    };
    fetchData();
  }, [globalCompanyId]);

  const applyAutoTrend = () => {
    if (!data || !data.dataset) return;
    const revenues = data.dataset.map(d => Number(d.revenue));
    const trend = calculateTrend(revenues);
    setGrowthRate(trend.toFixed(1)); 
    setCostRate((trend * 0.8).toFixed(1)); 
  };

  const handleReset = () => {
    setGrowthRate(0);
    setCostRate(0);
    setViewScenario('ALL');
    setCurrentCash('');
  };

  const handleCashChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) { setCurrentCash(''); return; }
    const amount = Number(rawValue) / 100;
    setCurrentCash(amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const scenarios = useMemo(() => {
    if (!data || !data.dataset || data.dataset.length === 0) return null;

    const lastReal = data.dataset[data.dataset.length - 1]; 
    let baseExpenses = Number(lastReal.expenses);
    
    if (baseExpenses === 0) {
        const totalHistExpenses = data.dataset.reduce((acc, curr) => acc + Number(curr.expenses), 0);
        baseExpenses = totalHistExpenses / (data.dataset.length || 1);
    }

    const baseRevenue = Number(lastReal.revenue);
    const taxRate = 0.15; // Estimativa padrão

    const months = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const date = new Date();
        date.setMonth(date.getMonth() + monthNum);
        const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const monthIndex = date.getMonth(); 

        let seasonalityFactor = 1;
        if (monthIndex === 10 || monthIndex === 11) seasonalityFactor = 1.15; 
        if (monthIndex === 0 || monthIndex === 1) seasonalityFactor = 0.85;   

        const optGrowth = (Number(growthRate) + 5) / 100;
        const revOpt = baseRevenue * Math.pow(1 + optGrowth, monthNum) * seasonalityFactor;
        
        const realGrowth = Number(growthRate) / 100;
        const revReal = baseRevenue * Math.pow(1 + realGrowth, monthNum) * seasonalityFactor;

        const pessGrowth = (Number(growthRate) - 10) / 100;
        const revPess = baseRevenue * Math.pow(1 + pessGrowth, monthNum) * seasonalityFactor;

        const costFactor = Number(costRate) / 100;
        const expenses = baseExpenses * Math.pow(1 + costFactor, monthNum);

        return {
            label,
            optimistic: revOpt,
            realistic: revReal,
            pessimistic: revPess,
            expenses: expenses,
            profitRealistic: revReal - expenses - (revReal * taxRate)
        };
    });

    const totalProfit = months.reduce((acc, curr) => acc + curr.profitRealistic, 0);
    const totalRev = months.reduce((acc, curr) => acc + curr.realistic, 0);
    const avgExpenses = months.reduce((acc, curr) => acc + curr.expenses, 0) / 12;

    return { months, totalProfit, totalRev, avgExpenses };
  }, [data, growthRate, costRate]);

  const runwayData = useMemo(() => {
    if (!scenarios || !currentCash) return { months: 0, burnRate: 0 };
    const cashNumeric = parseFloat(currentCash.replace(/\./g, '').replace(',', '.'));
    const burnRate = scenarios.avgExpenses;
    if (burnRate <= 0) return { months: "∞", burnRate: 0, infinite: true };
    const result = cashNumeric / burnRate;
    return { months: result.toFixed(1), burnRate, infinite: false };
  }, [currentCash, scenarios]);

  const seasonalityMap = useMemo(() => {
    if (!data?.dataset || data.dataset.length === 0) return [];
    const maxRev = Math.max(...data.dataset.map(d => d.revenue));
    return data.dataset.map(d => {
        const intensity = (d.revenue / maxRev) * 100; 
        let color = 'bg-rose-100 text-rose-600';
        if (intensity > 40) color = 'bg-amber-100 text-amber-600';
        if (intensity > 75) color = 'bg-emerald-100 text-emerald-600';
        if (intensity > 90) color = 'bg-emerald-500 text-white';
        return { month: d.period, intensity, color, val: d.revenue };
    }).slice(-12); 
  }, [data]);

  if (!globalCompanyId) return (
    <div className="h-96 flex flex-col items-center justify-center text-slate-400">
      <Target size={48} className="mb-4 opacity-10 animate-pulse"/><p className="font-black uppercase tracking-widest text-xs">Selecione uma empresa para simular cenários</p>
    </div>
  );

  if (loading || !scenarios) return (
    <div className="h-96 flex flex-col items-center justify-center text-blue-600">
      <RefreshCw className="animate-spin mb-4" size={32}/>
      <p className="font-black uppercase tracking-widest text-[10px]">Calculando Algoritmos de Tendência...</p>
    </div>
  );

  const chartData = {
    labels: scenarios.months.map(m => m.label),
    datasets: [
        { label: 'Otimista', data: scenarios.months.map(m => m.optimistic), borderColor: '#10B981', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, hidden: viewScenario !== 'ALL' && viewScenario !== 'OPTIMISTIC', tension: 0.4 },
        { label: 'Realista', data: scenarios.months.map(m => m.realistic), borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderWidth: 3, fill: true, hidden: viewScenario !== 'ALL' && viewScenario !== 'REALISTIC', tension: 0.4 },
        { label: 'Pessimista', data: scenarios.months.map(m => m.pessimistic), borderColor: '#F43F5E', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, hidden: viewScenario !== 'ALL' && viewScenario !== 'PESSIMISTIC', tension: 0.4 },
        { label: 'Despesa Projetada', data: scenarios.months.map(m => m.expenses), borderColor: '#64748B', borderWidth: 1, pointRadius: 0, tension: 0.4 }
    ]
  };

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      
      {/* HEADER DE PROJEÇÕES */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200 pb-8 gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
              <TrendingUp className="text-blue-600" size={32}/> Projeções Analíticas
            </h1>
            <p className="text-slate-400 font-medium text-sm mt-1">Simulação estocástica de fluxos e sazonalidade para 12 meses.</p>
        </div>
        <button 
          onClick={applyAutoTrend} 
          className="bg-slate-900 hover:bg-black text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 shadow-xl transition-all hover:-translate-y-1 active:scale-95"
        >
          <Wand2 size={16} className="text-blue-400" /> Calcular Tendência Real
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="space-y-8">
            {/* CONTROLES DE PARÂMETROS */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest flex items-center gap-2">
                    <Sliders size={16} className="text-blue-500"/> Simulador de Crescimento
                  </h3>
                  <button onClick={handleReset} className="p-2 hover:bg-slate-50 text-slate-400 rounded-lg transition-colors"><RotateCcw size={16} /></button>
                </div>
                
                <div className="space-y-10">
                    <div className="group">
                        <div className="flex justify-between mb-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receita Mensal</label>
                          <span className="text-sm font-black text-blue-600">{growthRate}%</span>
                        </div>
                        <input type="range" min="-15" max="15" step="0.1" value={growthRate} onChange={e => setGrowthRate(e.target.value)} className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"/>
                    </div>
                    <div className="group">
                        <div className="flex justify-between mb-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inflação de Custos</label>
                          <span className="text-sm font-black text-rose-600">{costRate}%</span>
                        </div>
                        <input type="range" min="-5" max="15" step="0.1" value={costRate} onChange={e => setCostRate(e.target.value)} className="w-full accent-rose-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"/>
                    </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Isolar Cenário Visual</p>
                  <div className="flex gap-2">
                    <button onClick={() => setViewScenario('ALL')} className={`flex-1 py-3 text-[10px] font-black rounded-xl border transition-all ${viewScenario === 'ALL' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border-slate-200'}`}>TODOS</button>
                    <button onClick={() => setViewScenario('OPTIMISTIC')} className={`p-3 rounded-xl border transition-all ${viewScenario === 'OPTIMISTIC' ? 'bg-emerald-500 text-white shadow-lg' : 'border-slate-200 text-emerald-600'}`}><ArrowUpRight size={18}/></button>
                    <button onClick={() => setViewScenario('PESSIMISTIC')} className={`p-3 rounded-xl border transition-all ${viewScenario === 'PESSIMISTIC' ? 'bg-rose-500 text-white shadow-lg' : 'border-slate-200 text-rose-600'}`}><ArrowDownRight size={18}/></button>
                  </div>
                </div>
            </div>

            {/* CALCULADORA DE RUNWAY */}
            <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl text-white relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-all" />
                <div className="flex items-center gap-4 mb-8 relative z-10">
                  <div className="p-3 bg-white/5 rounded-2xl text-amber-400"><Hourglass size={24}/></div>
                  <div><h3 className="font-black text-sm uppercase tracking-widest italic">Runway Analysis</h3><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Sobrevivência de Caixa</p></div>
                </div>
                
                <div className="mb-6 relative z-10">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Saldo Bancário Disponível</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-slate-500 text-xs font-bold">R$</span>
                      <input type="text" value={currentCash} onChange={handleCashChange} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-4 text-base text-white focus:ring-2 focus:ring-blue-500/40 outline-none font-mono font-bold transition-all" placeholder="0,00"/>
                    </div>
                </div>

                <div className="relative z-10">
                  {currentCash ? (
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/5 text-center backdrop-blur-sm">
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1">Queima de Caixa Estimada</span>
                          <span className="text-sm font-mono font-bold text-slate-300">{formatBRL(runwayData.burnRate)}/mês</span>
                          <div className="my-4 border-t border-white/5"></div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Sua Empresa sobrevive por</span>
                          <span className={`text-4xl font-black font-mono italic tracking-tighter ${runwayData.months < 4 ? 'text-rose-500' : 'text-emerald-400'}`}>{runwayData.months} Meses</span>
                          {runwayData.months < 4 && <div className="mt-3 flex items-center justify-center gap-2 text-rose-500 font-black text-[9px] uppercase tracking-widest animate-pulse"><AlertTriangle size={12}/> Alerta de Liquidez</div>}
                      </div>
                  ) : (
                      <div className="py-10 text-center border border-dashed border-white/10 rounded-3xl text-slate-600 font-black text-[10px] uppercase tracking-[0.2em]">Insira o saldo para projetar</div>
                  )}
                </div>
            </div>
        </div>

        {/* ÁREA DO GRÁFICO E SAZONALIDADE */}
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest flex items-center gap-3">
                    <Activity size={18} className="text-blue-600"/> Curva de Projeção Linear
                  </h3>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Receita Acumulada 12m</p>
                    <span className="text-2xl font-black text-slate-900 tracking-tighter italic">{formatBRL(scenarios.totalRev)}</span>
                  </div>
                </div>
                <div className="h-[350px]">
                  <Chart type='line' data={chartData} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { grid: { color: '#f1f5f9', borderDash: [5, 5] }, ticks: { font: { weight: 'bold', size: 10 }, callback: (v) => `R$ ${v/1000}k` } }, x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 10 } } } }, plugins: { legend: { display: false } } }} />
                </div>
            </div>

            {/* MAPA DE CALOR DE SAZONALIDADE */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest flex items-center gap-3">
                    <Calendar size={18} className="text-indigo-500"/> Mapa de Calor Sazonal
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimos 12 meses</p>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-12 gap-3">
                    {seasonalityMap.map((item, index) => (
                        <div key={index} className="flex flex-col items-center gap-2 group relative">
                            <motion.div 
                              whileHover={{ scale: 1.1 }}
                              className={`w-full h-14 rounded-2xl ${item.color} flex items-center justify-center shadow-sm transition-all cursor-help`}
                            >
                              {item.intensity > 85 ? <Sun size={18} className="animate-spin-slow"/> : item.intensity < 35 ? <Snowflake size={18}/> : null}
                            </motion.div>
                            <span className="text-[10px] font-black text-slate-400 uppercase">{item.month.split('-')[1]}</span>
                            <div className="absolute bottom-full mb-3 bg-slate-900 text-white text-[10px] font-black px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 shadow-2xl border border-white/10 uppercase tracking-widest">
                               {formatBRL(item.val)}
                            </div>
                        </div>
                    ))}
                    {seasonalityMap.length === 0 && <div className="col-span-12 py-10 text-center text-slate-300 font-black text-[10px] uppercase tracking-widest italic">Aguardando dados históricos suficientes</div>}
                </div>
            </div>

            {/* INDICADORES FINAIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <KpiCard title="Lucro Bruto Projetado" value={formatBRL(scenarios.totalProfit)} sub="Resultado estimado no cenário realista acumulado em 1 ano." colorClass="bg-emerald-500" icon={Wallet}/>
                <KpiCard title="Ponto de Equilíbrio" value={formatBRL(scenarios.totalRev / 12 * 0.72)} sub="Meta mínima mensal necessária para cobrir custos e impostos." colorClass="bg-blue-500" icon={Target}/>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticalProjections;