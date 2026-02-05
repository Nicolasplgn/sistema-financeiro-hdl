import React, { useRef, useEffect, useState } from 'react';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  Title,
  Filler 
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';

// Registra componentes, incluindo Filler para áreas preenchidas no gráfico de linha
ChartJS.register(
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale, 
  PointElement, LineElement, BarElement, Title, Filler
);

const FinancialCharts = ({ monthlyData, totals }) => {
  const chartRef = useRef(null);
  const [gradientRevenue, setGradientRevenue] = useState('rgba(16, 185, 129, 0.2)');
  const [gradientTax, setGradientTax] = useState('rgba(239, 68, 68, 0.2)');

  if (!monthlyData?.length) return null;

  // Formatação BR
  const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const labels = monthlyData.map(m => { const [y, mo] = m.monthKey.split('-'); return `${mo}/${y.slice(2)}`; });

  // --- CONFIGURAÇÕES GERAIS DE INTERATIVIDADE ---
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',    // Mostra dados de todas as linhas ao passar o mouse no eixo X
      intersect: false, // Não precisa passar exatamente em cima do ponto
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart', // Animação suave na entrada
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true, // Bolinhas em vez de quadrados na legenda
          padding: 20,
          font: { family: "'Inter', sans-serif", size: 12 }
        },
        onHover: (evt, item, legend) => {
          document.body.style.cursor = 'pointer'; // Mãozinha ao passar na legenda
        },
        onLeave: (evt, item, legend) => {
          document.body.style.cursor = 'default';
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)', // Fundo escuro (Slate-900)
        titleFont: { size: 13, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif", weight: 'bold' },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (ctx) => {
            let label = ctx.dataset.label || '';
            if (label) label += ': ';
            if (ctx.parsed.y !== null) label += formatBRL(ctx.parsed.y);
            return label;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false } }, // Limpa linhas verticais
      y: { 
        border: { dash: [4, 4] }, // Linhas pontilhadas
        grid: { color: '#f1f5f9' },
        ticks: { 
          callback: (val) => val >= 1000 ? `${val/1000}k` : val, // Simplifica eixo Y (10k, 20k)
          font: { size: 10 }
        } 
      }
    },
    hover: {
      mode: 'index',
      intersect: false
    }
  };

  // --- DADOS DO GRÁFICO DE LINHA (ÁREA) ---
  // Criamos um efeito de gradiente no canvas para ficar bonito
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) {
      const ctx = chart.ctx;
      // Gradiente Verde
      const gradRev = ctx.createLinearGradient(0, 0, 0, 400);
      gradRev.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
      gradRev.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      setGradientRevenue(gradRev);

      // Gradiente Vermelho
      const gradTax = ctx.createLinearGradient(0, 0, 0, 400);
      gradTax.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
      gradTax.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
      setGradientTax(gradTax);
    }
  }, [monthlyData]);

  let accRev = 0, accTax = 0;
  const lineData = {
    labels,
    datasets: [
      { 
        label: 'Faturamento Acumulado', 
        data: monthlyData.map(d => accRev += d.totalRevenue), 
        borderColor: '#10b981', // Verde Emerald
        backgroundColor: gradientRevenue,
        fill: true, // Preenche a área abaixo da linha
        tension: 0.4, // Curva suave
        pointRadius: 4,
        pointHoverRadius: 8, // Aumenta bolinha ao passar mouse
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2,
      },
      { 
        label: 'Impostos Acumulados', 
        data: monthlyData.map(d => accTax += d.totalTaxes), 
        borderColor: '#ef4444', // Vermelho Rose
        backgroundColor: gradientTax,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2,
      }
    ]
  };

  // --- DADOS DA PIZZA (HOVER EXPANSIVO) ---
  const pieData = {
    labels: ['ICMS/DIFAL', 'PIS/COFINS', 'ISS', 'IRPJ/CSLL', 'OUTROS'],
    datasets: [{ 
      data: [
        totals.tax_icms+totals.tax_difal, 
        totals.tax_pis+totals.tax_cofins, 
        totals.tax_iss, 
        totals.tax_irpj+totals.tax_csll+totals.tax_additional_irpj, 
        totals.tax_fust+totals.tax_funtell
      ], 
      backgroundColor: ['#3b82f6','#f59e0b','#8b5cf6','#ef4444','#10b981'],
      hoverOffset: 15, // A fatia "pula" para fora quando passa o mouse
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };
  
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 10 } },
      tooltip: commonOptions.plugins.tooltip
    }
  };

  // --- DADOS DE BARRAS ---
  const barData = {
    labels: ['ICMS', 'PIS', 'COFINS', 'ISS', 'IRPJ'],
    datasets: [{ 
      label: 'Impacto %', 
      data: [
        (totals.tax_icms/totals.totalRevenue)*100, 
        (totals.tax_pis/totals.totalRevenue)*100, 
        (totals.tax_cofins/totals.totalRevenue)*100, 
        (totals.tax_iss/totals.totalRevenue)*100, 
        ((totals.tax_irpj+totals.tax_additional_irpj)/totals.totalRevenue)*100
      ], 
      backgroundColor: ['#3b82f6','#f59e0b','#f59e0b','#8b5cf6','#ef4444'],
      borderRadius: 6, // Arredonda o topo das barras
      barPercentage: 0.6,
    }]
  };

  const barOptions = JSON.parse(JSON.stringify(commonOptions));
  barOptions.scales.y.ticks.callback = (val) => val + '%';
  barOptions.plugins.tooltip.callbacks.label = (ctx) => ctx.dataset.label + ': ' + ctx.raw.toFixed(2) + '%';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* GRÁFICO DE LINHA (PRINCIPAL) */}
      <div className="bg-white p-6 h-[400px] rounded-2xl border border-slate-100 shadow-sm md:col-span-3 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wide">Evolução Acumulada (R$)</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Ao Vivo</span>
          </div>
          <div className="h-[320px]">
            {/* ref é usado para criar o gradiente */}
            <Line ref={chartRef} data={lineData} options={commonOptions} />
          </div>
      </div>

      {/* PIZZA */}
      <div className="bg-white p-6 h-80 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xs font-bold uppercase mb-2 text-slate-500 tracking-wide">Distribuição Tributária</h3>
          <div className="h-60 flex justify-center"><Pie data={pieData} options={pieOptions} /></div>
      </div>

      {/* BARRAS */}
      <div className="bg-white p-6 h-80 rounded-2xl border border-slate-100 shadow-sm md:col-span-2 hover:shadow-md transition-shadow">
          <h3 className="text-xs font-bold uppercase mb-2 text-slate-500 tracking-wide">Impacto Percentual (%)</h3>
          <div className="h-60"><Bar data={barData} options={barOptions} /></div>
      </div>
    </div>
  );
};

export default FinancialCharts;