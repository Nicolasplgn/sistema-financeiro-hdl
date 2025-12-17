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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// Algoritmo de Regressão Linear Simples
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
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-3">
        <div className={`p-2 rounded-lg bg-opacity-10 ${colorClass} ${colorClass.replace('bg-', 'text-')}`}>
            <Icon size={20} />
        </div>
    </div>
    <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
    <p className="text-xs text-slate-500 font-medium uppercase mt-1">{title}</p>
    <p className="text-xs text-slate-400 mt-2">{sub}</p>
  </div>
);

const Projections = ({ globalCompanyId, apiBase }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  
  // Estados de Controle
  const [growthRate, setGrowthRate] = useState(0); 
  const [costRate, setCostRate] = useState(0);
  const [currentCash, setCurrentCash] = useState(''); 
  const [viewScenario, setViewScenario] = useState('ALL'); 

  const f = (v) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    if (!globalCompanyId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/intelligence/projections?companyId=${globalCompanyId}`);
        if (res.ok) {
            const json = await res.json();
            setData(json);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchData();
  }, [globalCompanyId, BASE_URL]);

  const applyAutoTrend = () => {
    if (!data || !data.dataset) return;
    const revenues = data.dataset.filter(d => d.type === 'REAL').map(d => d.revenue);
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

  // --- CÁLCULO DOS CENÁRIOS COM CORREÇÃO DE DESPESA ZERADA ---
  const scenarios = useMemo(() => {
    if (!data || !data.dataset) return null;

    const lastReal = data.dataset[data.dataset.length - 1]; 
    if (!lastReal) return null;

    // CORREÇÃO INTELIGENTE:
    // Se a despesa do último mês for 0 (lançamento incompleto), 
    // calcula a média de despesas de todo o histórico para usar como base.
    let baseExpenses = Number(lastReal.expenses);
    if (baseExpenses === 0) {
        const realHistory = data.dataset.filter(d => d.type === 'REAL');
        const totalHistExpenses = realHistory.reduce((acc, curr) => acc + Number(curr.expenses), 0);
        baseExpenses = totalHistExpenses / (realHistory.length || 1);
    }

    const baseRevenue = Number(lastReal.revenue);
    const taxRate = data.averages?.taxRate || 0.06;

    const months = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const date = new Date();
        date.setMonth(date.getMonth() + monthNum);
        const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const monthIndex = date.getMonth(); 

        let seasonalityFactor = 1;
        if (monthIndex === 10 || monthIndex === 11) seasonalityFactor = 1.1; 
        if (monthIndex === 0 || monthIndex === 1) seasonalityFactor = 0.9;   

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

  // Cálculo de Runway
  const runwayData = useMemo(() => {
    if (!scenarios || !currentCash) return { months: 0, burnRate: 0 };
    
    const cashNumeric = parseFloat(currentCash.replace(/\./g, '').replace(',', '.'));
    const burnRate = scenarios.avgExpenses;
    
    // Se mesmo com a correção a despesa for 0, retorna aviso visual
    if (burnRate <= 0) return { months: "∞", burnRate: 0, infinite: true };
    
    const result = cashNumeric / burnRate;
    
    return { months: result.toFixed(1), burnRate, infinite: false };
  }, [currentCash, scenarios]);

  const seasonalityMap = useMemo(() => {
    if (!data?.dataset) return [];
    
    const realData = data.dataset.filter(d => d.type === 'REAL');
    if (realData.length === 0) return [];
    
    const maxRev = Math.max(...realData.map(d => d.revenue));
    
    return realData.map(d => {
        const intensity = (d.revenue / maxRev) * 100; 
        let color = 'bg-rose-100 text-rose-600';
        if (intensity > 40) color = 'bg-amber-100 text-amber-600';
        if (intensity > 75) color = 'bg-emerald-100 text-emerald-600';
        if (intensity > 90) color = 'bg-emerald-500 text-white';
        
        return { 
            month: d.period, 
            intensity, 
            color, 
            val: d.revenue 
        };
    }).slice(-12); 
  }, [data]);

  if (!globalCompanyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><Target size={48} className="mb-4 opacity-20"/><p>Selecione uma empresa.</p></div>;
  if (!scenarios) return <div className="h-96 flex items-center justify-center text-blue-600"><RefreshCw className="animate-spin mr-2"/> Processando Inteligência...</div>;

  const chartData = {
    labels: scenarios.months.map(m => m.label),
    datasets: [
        { label: 'Otimista', data: scenarios.months.map(m => m.optimistic), borderColor: '#10B981', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, hidden: viewScenario !== 'ALL' && viewScenario !== 'OPTIMISTIC', tension: 0.4 },
        { label: 'Realista', data: scenarios.months.map(m => m.realistic), borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, fill: true, hidden: viewScenario !== 'ALL' && viewScenario !== 'REALISTIC', tension: 0.4 },
        { label: 'Pessimista', data: scenarios.months.map(m => m.pessimistic), borderColor: '#F43F5E', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, hidden: viewScenario !== 'ALL' && viewScenario !== 'PESSIMISTIC', tension: 0.4 },
        { label: 'Custo Projetado', data: scenarios.months.map(m => m.expenses), borderColor: '#64748B', borderWidth: 1, pointRadius: 0, tension: 0.4 }
    ]
  };

  return (
    <div className="p-2 space-y-6 animate-fade-in max-w-7xl mx-auto pb-20">
      
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="text-purple-600"/> Inteligência Financeira</h1>
            <p className="text-slate-500 text-sm mt-1">Simulação de cenários futuros baseados em IA estatística.</p>
        </div>
        <button onClick={applyAutoTrend} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-200 transition-all hover:scale-105"><Wand2 size={16} /> IA: Calcular Tendência Real</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
                <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Sliders size={18}/> Parâmetros</h3><button onClick={handleReset} className="text-xs font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1 transition-colors bg-slate-50 px-2 py-1 rounded border border-slate-200"><RotateCcw size={12} /> Reset</button></div>
                <div className="space-y-6">
                    <div><div className="flex justify-between mb-2"><label className="text-xs font-bold text-slate-500 uppercase">Crescimento</label><span className="text-sm font-bold text-blue-600">{growthRate}%</span></div><input type="range" min="-10" max="10" step="0.1" value={growthRate} onChange={e => setGrowthRate(e.target.value)} className="w-full accent-blue-600 h-2 bg-slate-100 rounded-lg cursor-pointer"/></div>
                    <div><div className="flex justify-between mb-2"><label className="text-xs font-bold text-slate-500 uppercase">Inflação Custos</label><span className="text-sm font-bold text-rose-600">{costRate}%</span></div><input type="range" min="-5" max="10" step="0.1" value={costRate} onChange={e => setCostRate(e.target.value)} className="w-full accent-rose-600 h-2 bg-slate-100 rounded-lg cursor-pointer"/></div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100"><p className="text-xs font-bold text-slate-400 uppercase mb-3">Filtro de Cenário</p><div className="flex gap-2"><button onClick={() => setViewScenario('ALL')} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${viewScenario === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>Todos</button><button onClick={() => setViewScenario('OPTIMISTIC')} className="p-2 rounded-lg border border-slate-200 text-emerald-600 hover:bg-emerald-50"><ArrowUpRight size={16}/></button><button onClick={() => setViewScenario('PESSIMISTIC')} className="p-2 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50"><ArrowDownRight size={16}/></button></div></div>
            </div>

            {/* Calculadora de Runway - ATUALIZADA */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
                <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-white/10 rounded-lg"><Hourglass size={20} className="text-amber-400"/></div><div><h3 className="font-bold text-sm">Calculadora de Runway</h3><p className="text-[10px] text-slate-400">Tempo de vida do caixa</p></div></div>
                
                <div className="mb-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Saldo em Caixa Atual</label>
                    <div className="relative"><span className="absolute left-3 top-2.5 text-slate-500 text-sm">R$</span><input type="text" value={currentCash} onChange={handleCashChange} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono tracking-wide" placeholder="0,00"/></div>
                </div>

                {currentCash ? (
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-center">
                        <span className="text-xs text-slate-400 block mb-1">
                            {runwayData.burnRate > 0 ? `Gasto Médio: ${f(runwayData.burnRate)}/mês` : 'Sem histórico de despesas.'}
                        </span>
                        <div className="my-1 border-t border-slate-700/50"></div>
                        <span className="text-xs text-slate-400 block mt-2">Sua empresa sobrevive por:</span>
                        
                        {runwayData.infinite ? (
                             <span className="text-xl font-bold text-blue-400">Indeterminado (Sem Custos)</span>
                        ) : (
                             <span className={`text-2xl font-bold ${runwayData.months < 3 ? 'text-rose-500' : 'text-emerald-400'}`}>{runwayData.months} Meses</span>
                        )}

                        {runwayData.months < 3 && !runwayData.infinite && <p className="text-[10px] text-rose-400 mt-1 flex items-center justify-center gap-1"><AlertTriangle size={10}/> Atenção! Caixa Crítico</p>}
                    </div>
                ) : (
                    <p className="text-xs text-slate-600 text-center italic">Digite o saldo para calcular.</p>
                )}
            </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col"><div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Activity size={18}/> Projeção de 12 Meses</h3><span className="text-xl font-bold text-slate-800">{f(scenarios.totalRev)} <span className="text-xs text-slate-400 font-normal">Acumulado</span></span></div><div className="flex-1 min-h-[250px]"><Chart type='line' data={chartData} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { grid: { borderDash: [4, 4] }, ticks: { callback: (v) => `R$ ${v/1000}k` } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom' } } }} /></div></div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4"><Calendar size={18} className="text-indigo-500"/> Sazonalidade Histórica</h3>
                <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                    {seasonalityMap.map((m, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 group relative">
                            <div className={`w-full h-12 rounded-lg ${m.color} flex items-center justify-center shadow-sm transition-all hover:scale-105`}>{m.intensity > 80 ? <Sun size={14} className="animate-pulse"/> : m.intensity < 30 ? <Snowflake size={14}/> : null}</div>
                            <span className="text-[10px] font-bold text-slate-500">{m.month.split('-')[1]}</span>
                            <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">{f(m.val)}</div>
                        </div>
                    ))}
                    {seasonalityMap.length === 0 && <p className="col-span-12 text-center text-sm text-slate-400 py-4">Dados insuficientes para gerar mapa de calor.</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <KpiCard title="Lucro Projetado (12 Meses)" value={f(scenarios.totalProfit)} sub="Baseado no cenário realista." colorClass="bg-emerald-500" icon={Wallet}/>
                <KpiCard title="Ponto de Equilíbrio (Mês)" value={f(scenarios.totalRev / 12 * 0.7)} sub="Meta mínima para cobrir custos." colorClass="bg-blue-500" icon={Target}/>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Projections;