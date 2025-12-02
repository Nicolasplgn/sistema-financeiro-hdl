import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title);

const FinancialCharts = ({ monthlyData, totals }) => {
  if (!monthlyData?.length) return null;

  const labels = monthlyData.map(m => { 
      const [y, mo] = m.monthKey.split('-'); 
      return `${mo}/${y.slice(2)}`; 
  });

  // Função para formatar Tooltips e Eixos em R$
  const formatBRL = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        ticks: {
          callback: (value) => formatBRL(value) // Formata o eixo Y
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += formatBRL(context.parsed.y); // Formata o valor ao passar o mouse
            }
            return label;
          }
        }
      }
    }
  };

  // Opções específicas para Pizza (não tem eixo Y)
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            let value = context.raw;
            return `${label}: ${formatBRL(value)}`;
          }
        }
      }
    }
  };

  const pieData = {
    labels: ['ICMS', 'PIS/COF', 'ISS', 'IRPJ/CSLL', 'OUTROS'],
    datasets: [{ 
      data: [
        totals.tax_icms + totals.tax_difal, 
        totals.tax_pis + totals.tax_cofins, 
        totals.tax_iss, 
        totals.tax_irpj + totals.tax_csll + totals.tax_additional_irpj, 
        totals.tax_fust + totals.tax_funtell
      ], 
      backgroundColor: ['#3b82f6','#f59e0b','#8b5cf6','#ef4444','#10b981'] 
    }]
  };

  const barData = {
    labels: ['ICMS', 'PIS', 'COFINS', 'ISS', 'IRPJ'],
    datasets: [{ 
      label: 'Fatia do Faturamento (%)', 
      data: [
        (totals.tax_icms/totals.totalRevenue)*100, 
        (totals.tax_pis/totals.totalRevenue)*100, 
        (totals.tax_cofins/totals.totalRevenue)*100, 
        (totals.tax_iss/totals.totalRevenue)*100, 
        ((totals.tax_irpj+totals.tax_additional_irpj)/totals.totalRevenue)*100
      ], 
      backgroundColor: '#6366f1' 
    }]
  };

  // Ajuste para o gráfico de barras mostrar % no tooltip
  const barOptions = JSON.parse(JSON.stringify(commonOptions)); // Copia opções
  barOptions.scales.y.ticks.callback = (val) => val + '%';
  barOptions.plugins.tooltip.callbacks.label = (ctx) => ctx.dataset.label + ': ' + ctx.raw.toFixed(2) + '%';

  let accRev = 0, accTax = 0;
  const lineData = {
    labels,
    datasets: [
      { label: 'Faturamento Acum.', data: monthlyData.map(d => accRev += d.totalRevenue), borderColor: '#10b981', tension: 0.3 },
      { label: 'Impostos Acum.', data: monthlyData.map(d => accTax += d.totalTaxes), borderColor: '#ef4444', tension: 0.3 }
    ]
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-4 h-80 rounded border shadow-sm">
          <h3 className="text-xs font-bold uppercase mb-2 text-slate-500">Evolução Acumulada (R$)</h3>
          <div className="h-64"><Line data={lineData} options={commonOptions} /></div>
      </div>
      <div className="bg-white p-4 h-80 rounded border shadow-sm">
          <h3 className="text-xs font-bold uppercase mb-2 text-slate-500">Distribuição (R$)</h3>
          <div className="h-64 flex justify-center"><Pie data={pieData} options={pieOptions} /></div>
      </div>
      <div className="bg-white p-4 h-80 rounded border shadow-sm">
          <h3 className="text-xs font-bold uppercase mb-2 text-slate-500">Impacto Percentual (%)</h3>
          <div className="h-64"><Bar data={barData} options={barOptions} /></div>
      </div>
    </div>
  );
};
export default FinancialCharts;