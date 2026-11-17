import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { brlShort } from './format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Cores das séries — legíveis no tema claro e no escuro. */
export const SERIES = {
  revenue: '#3b82f6',
  profit: '#10b981',
  loss: '#ef4444',
  taxes: '#f59e0b',
  purchases: '#8b5cf6',
  expenses: '#ec4899',
  margin: '#64748b',
  palette: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'],
};

/** Opções base dos gráficos usando as cores do tema atual (lidas na hora do desenho). */
export const baseChartOptions = ({ percentAxis = false, stacked = false } = {}) => {
  const ink2 = cssVar('--ink-2');
  const ink3 = cssVar('--ink-3');
  const line = cssVar('--line');
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { color: ink2, usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
      tooltip: {
        callbacks: {
          label: (c) => `${c.dataset.label}: ${c.dataset.yAxisID === 'y1' ? `${Number(c.raw).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : Number(c.raw).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        },
      },
    },
    scales: {
      x: { stacked, grid: { display: false }, ticks: { color: ink3 }, border: { color: line } },
      y: { stacked, beginAtZero: true, grid: { color: line }, border: { display: false }, ticks: { color: ink3, callback: (v) => brlShort(v) } },
      ...(percentAxis ? { y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { color: ink3, callback: (v) => `${v}%` } } } : {}),
    },
  };
};
