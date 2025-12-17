import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Wallet, TrendingUp, TrendingDown, Building2, Printer, 
  PieChart, Loader, X, FileText, Table as TableIcon, Filter, 
  RotateCcw, BarChart3, Layers, AlertTriangle, FileSpreadsheet, MessageCircle,
  Users, ShoppingBag, ArrowRight, Trophy, Medal, FileCode
} from 'lucide-react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx'; // Certifique-se de ter rodado: npm install xlsx
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);

// --- COMPONENTE DE RANKING VISUAL ---
const RankingItem = ({ rank, name, value, maxValue, type }) => {
  const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const isClient = type === 'client';
  const colorBar = isClient ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-orange-400';
  const colorText = isClient ? 'text-emerald-700' : 'text-rose-700';
  const colorBgIcon = isClient ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600';
  const initials = name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '??';
  
  let RankIcon = null;
  let rankColor = 'bg-slate-100 text-slate-500';
  
  if (rank === 1) { RankIcon = <Trophy size={16} />; rankColor = 'bg-yellow-100 text-yellow-600 ring-2 ring-yellow-200'; }
  else if (rank === 2) { RankIcon = <Medal size={16} />; rankColor = 'bg-gray-100 text-gray-500 ring-2 ring-gray-200'; }
  else if (rank === 3) { RankIcon = <Medal size={16} />; rankColor = 'bg-orange-50 text-orange-600 ring-2 ring-orange-100'; }

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors rounded-lg px-2">
      <div className={`w-10 h-10 rounded-full ${rankColor} flex items-center justify-center text-xs font-bold shrink-0 shadow-sm`}>
        {RankIcon ? RankIcon : `#${rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]" title={name}>{name}</span>
          <div className="text-right">
            <span className={`block text-sm font-mono font-bold ${colorText}`}>
              {Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex relative">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${percent}%` }} 
            transition={{ duration: 1, ease: "easeOut", delay: rank * 0.1 }} 
            className={`h-full rounded-full ${colorBar} shadow-sm`}
          />
        </div>
      </div>
    </div>
  );
};

const PremiumCard = ({ title, value, sub, icon: Icon, color }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-')} ${color}`}>
        <Icon size={24} />
      </div>
    </div>
    <div className="relative z-10">
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
      <p className="text-xs text-slate-400 mt-2 font-medium">{sub}</p>
    </div>
  </motion.div>
);

const Dashboard = ({ companyId, apiBase }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  const [reportData, setReportData] = useState(null);
  const [rankingData, setRankingData] = useState({ clients: [], suppliers: [] });
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, type: null, data: null, title: '', dataType: 'REVENUE' });
  const [period, setPeriod] = useState({ start: `${new Date().getFullYear()}-01`, end: `${new Date().getFullYear()}-12` });
  const printRef = useRef();

  const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
  const getLastDayOfMonth = (ym) => { if (!ym) return 30; const [y, m] = ym.split('-'); return new Date(y, +m, 0).getDate(); };

  useEffect(() => {
    if (!companyId) return;
    const fetchData = async () => {
      setLoading(true);
      const startDate = `${period.start}-01`;
      const lastDay = getLastDayOfMonth(period.end);
      const endDate = `${period.end}-${lastDay}`;
      try {
        const [resReport, resRanking] = await Promise.all([
            axios.post(`${BASE_URL}/api/report`, { companyIds: [companyId], startDate, endDate }),
            axios.get(`${BASE_URL}/api/reports/partners-ranking`, { params: { companyId, startDate, endDate } })
        ]);
        if (resReport.data) setReportData(resReport.data);
        if (resRanking.data) setRankingData(resRanking.data);
      } catch (error) { console.error("Erro dashboard:", error); } finally { setLoading(false); }
    };
    fetchData();
  }, [companyId, period, BASE_URL]);

  // --- 1. EXPORTAÇÃO EXCEL (ATUALIZADA) ---
  const handleExportExcel = () => {
    if (!reportData || !reportData.months.length) return alert("Sem dados para exportar.");
    
    const dataToExport = reportData.months.map(m => ({
      'Mês': m.monthKey,
      'Receita Bruta': m.totalRevenue,
      'Impostos': m.totalTaxes,
      'Compras (Custos)': m.totalPurchases,
      'Despesas Operacionais': m.totalExpenses,
      'Lucro Líquido': m.profit,
      'Margem %': m.totalRevenue > 0 ? ((m.profit / m.totalRevenue) * 100).toFixed(2) + '%' : '0%'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório SCE");
    // Nome do arquivo com a marca
    XLSX.writeFile(workbook, `SCE_Relatorio_${period.start}.xlsx`);
  };

  // --- 2. WHATSAPP (ATUALIZADO) ---
  const handleShareWhatsApp = () => {
    if (!reportData?.summary) return alert("Aguarde o carregamento dos dados.");
    const s = reportData.summary;
    const margin = s.totalRevenue > 0 ? ((s.totalProfit / s.totalRevenue) * 100).toFixed(1) : 0;
    
    const text = 
      `*📊 SCE - Start's Control Enterprises*\n` +
      `_Resumo Financeiro - ${period.start} a ${period.end}_\n\n` +
      `💰 *Faturamento:* ${formatCurrency(s.totalRevenue)}\n` +
      `📉 *Saídas:* ${formatCurrency(s.totalCosts + s.totalTaxes)}\n` +
      `----------------------------------\n` +
      `✅ *LUCRO:* ${formatCurrency(s.totalProfit)}\n` +
      `📈 *Margem:* ${margin}%\n\n` +
      `_Gerado via Sistema SCE_`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- 3. EXPORTAÇÃO HTML (ATUALIZADA) ---
  const handleExportHTML = () => {
    if (!reportData) return;
    const htmlContent = `
      <html>
        <head>
          <title>Relatório SCE - Start's Control</title>
          <style>
            body{font-family:sans-serif;padding:30px;background:#f8fafc}
            .card{background:white;padding:20px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.05);margin-bottom:20px}
            h1{color:#1e293b} th{text-align:right;background:#f1f5f9;padding:10px} td{text-align:right;padding:10px;border-bottom:1px solid #eee}
            .profit{color:#10b981;font-weight:bold} .loss{color:#ef4444;font-weight:bold}
          </style>
        </head>
        <body>
          <h1>SCE - Start's Control Enterprises</h1>
          <p>Relatório Financeiro: ${period.start} a ${period.end}</p>
          <div class="card">
            <table style="width:100%">
              <thead><tr><th style="text-align:left">Mês</th><th>Faturamento</th><th>Impostos</th><th>Custos</th><th>Lucro</th></tr></thead>
              <tbody>
                ${reportData.months.map(m => `<tr><td style="text-align:left"><strong>${m.monthKey}</strong></td><td>${formatCurrency(m.totalRevenue)}</td><td>${formatCurrency(m.totalTaxes)}</td><td>${formatCurrency(m.totalPurchases + m.totalExpenses)}</td><td class="${m.profit >= 0 ? 'profit' : 'loss'}">${formatCurrency(m.profit)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
          <center style="color:#94a3b8;font-size:12px">SCE System 2025</center>
        </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SCE_Relatorio_${period.start}.html`;
    link.click();
  };

  // --- 4. PDF (ATUALIZADO) ---
  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`SCE_Relatorio_${period.start}.pdf`);
    } catch (err) { alert("Erro PDF."); } finally { setGeneratingPdf(false); }
  };

  const openTable = (type, title, dataType = 'REVENUE') => { if (reportData) setDetailModal({ open: true, type, title, data: type === 'TAXES' ? reportData.summary : reportData.months, dataType }); };

  const calculateRegimeRisk = (data, currentPeriod) => {
    if (!data?.months?.length) return null;
    const projected = data.summary.totalRevenue || 0;
    if (projected > 4800000) return { exceeds: true, percentage: 10, currentRegime: 'SIMPLES' };
    return null;
  };

  const maxClientVal = rankingData.clients.length > 0 ? Math.max(...rankingData.clients.map(c => Number(c.value))) : 0;
  const maxSupplierVal = rankingData.suppliers.length > 0 ? Math.max(...rankingData.suppliers.map(s => Number(s.value))) : 0;

  if (!companyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><Building2 size={48} className="mb-4 opacity-20"/><p>Selecione uma empresa.</p></div>;
  if (loading || !reportData) return <div className="h-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  const { months, summary } = reportData;
  const regimeRisk = calculateRegimeRisk(reportData, period);

  const mixedChartData = {
    labels: months.map(m => m.monthKey),
    datasets: [
      { type: 'line', label: 'Margem (%)', data: months.map(m => m.totalRevenue > 0 ? ((m.profit / m.totalRevenue) * 100).toFixed(1) : 0), borderColor: '#8B5CF6', backgroundColor: '#8B5CF6', borderWidth: 2, borderDash: [5, 5], tension: 0.4, pointRadius: 0, yAxisID: 'y1', order: 0 },
      { type: 'line', label: 'Faturamento', data: months.map(m => m.totalRevenue), borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, yAxisID: 'y', order: 1 },
      { type: 'bar', label: 'Lucro Líquido', data: months.map(m => m.profit), backgroundColor: months.map(m => m.profit >= 0 ? '#10B981' : '#EF4444'), borderRadius: 4, barPercentage: 0.5, yAxisID: 'y', order: 2 }
    ]
  };

  const stackedChartData = {
    labels: months.map(m => m.monthKey),
    datasets: [
      { label: 'Impostos', data: months.map(m => m.totalTaxes), backgroundColor: '#F59E0B', borderRadius: 2 },
      { label: 'Compras', data: months.map(m => m.totalPurchases), backgroundColor: '#6366F1', borderRadius: 2 },
      { label: 'Despesas', data: months.map(m => m.totalExpenses), backgroundColor: '#EC4899', borderRadius: 2 },
    ]
  };

  const taxesChartData = {
    labels: months.map(m => m.monthKey),
    datasets: [
        { label: 'ICMS', data: months.map(m => m.tax_icms), backgroundColor: '#3B82F6' },
        { label: 'PIS', data: months.map(m => m.tax_pis), backgroundColor: '#F59E0B' },
        { label: 'COFINS', data: months.map(m => m.tax_cofins), backgroundColor: '#10B981' },
        { label: 'ISS', data: months.map(m => m.tax_iss), backgroundColor: '#8B5CF6' },
        { label: 'IRPJ/CSLL', data: months.map(m => m.tax_irpj_csll), backgroundColor: '#EF4444' }
    ]
  };

  const commonOptions = { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false } }, y: { position: 'left', beginAtZero: true, grid: { borderDash: [4, 4] } }, y1: { position: 'right', grid: { drawOnChartArea: false } } } };
  const stackedOptions = { ...commonOptions, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } };
  const doughnutData = { labels: ['ICMS', 'PIS', 'COFINS', 'ISS', 'IRPJ/CSLL'], datasets: [{ data: [summary.tax_icms, summary.tax_pis, summary.tax_cofins, summary.tax_iss, (summary.tax_irpj + summary.tax_csll)], backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444'], borderWidth: 0 }] };

  return (
    <div className="p-2 space-y-8 animate-fade-in max-w-7xl mx-auto pb-20">
      <div ref={printRef} className="bg-slate-50 p-6 rounded-xl">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-6 mb-6">
          <div><h1 className="text-3xl font-bold text-slate-800 tracking-tight">{getGreeting()}, Gestor.</h1><p className="text-slate-500 mt-1">Resumo de <span className="font-bold text-blue-600">{period.start} a {period.end}</span></p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleShareWhatsApp} className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold transition-all"><MessageCircle size={16}/> WhatsApp</button>
            <button onClick={handleExportExcel} className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold transition-all"><FileSpreadsheet size={16}/> Excel</button>
            <button onClick={handleExportHTML} className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold transition-all"><FileCode size={16}/> Web</button>
            <div className="h-8 w-px bg-slate-300 mx-2 hidden md:block"></div>
            <button onClick={() => setPeriod({ start: `${new Date().getFullYear()}-01`, end: `${new Date().getFullYear()}-12` })} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 transition shadow-sm"><RotateCcw size={18}/></button>
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm"><Filter size={16} className="text-slate-400 ml-2"/><input type="month" value={period.start} onChange={(e) => setPeriod({...period, start: e.target.value})} className="border-none bg-transparent text-slate-600 font-medium text-sm w-32 outline-none"/><span className="text-slate-300">até</span><input type="month" value={period.end} onChange={(e) => setPeriod({...period, end: e.target.value})} className="border-none bg-transparent text-slate-600 font-medium text-sm w-32 outline-none"/></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <PremiumCard title="Faturamento" value={formatCurrency(summary.totalRevenue)} sub="Entradas Brutas" icon={Wallet} color="text-blue-600"/>
          <PremiumCard title="Lucro Líquido" value={formatCurrency(summary.totalProfit)} sub={`Margem Real: ${summary.totalRevenue > 0 ? ((summary.totalProfit/summary.totalRevenue)*100).toFixed(1) : 0}%`} icon={TrendingUp} color={summary.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}/>
          <PremiumCard title="Despesas Totais" value={formatCurrency(summary.totalTaxes + summary.totalCosts)} sub="Impostos + Custos" icon={TrendingDown} color="text-rose-600"/>
        </div>

        {regimeRisk && regimeRisk.exceeds && (<div className="mb-8 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm flex items-start gap-4"><AlertTriangle className="text-amber-600 mt-1"/><div><h3 className="font-bold text-amber-800">Alerta: {regimeRisk.currentRegime}</h3><p className="text-sm text-amber-700">Projeção excede o limite em {regimeRisk.percentage}%.</p></div></div>)}

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="text-blue-600" size={20}/> Evolução</h3><button onClick={() => openTable('EVOLUTION', 'Mensal', 'REVENUE')} className="text-xs bg-slate-50 hover:bg-blue-50 px-3 py-1 rounded-lg border border-slate-200 text-slate-600 font-bold flex gap-1 items-center"><TableIcon size={14}/> Dados</button></div>
            <div className="h-72"><Bar data={mixedChartData} options={commonOptions} /></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><div className="flex justify-between mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Layers className="text-indigo-600" size={20}/> Estrutura de Custos</h3><button onClick={() => openTable('EVOLUTION', 'Custos', 'EXPENSE')} className="text-xs bg-slate-50 hover:bg-indigo-50 px-3 py-1 rounded-lg border border-slate-200 text-slate-600 font-bold flex gap-1 items-center"><TableIcon size={14}/> Dados</button></div><div className="h-64"><Bar data={stackedChartData} options={stackedOptions} /></div></div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col"><div className="flex justify-between mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><PieChart className="text-slate-400" size={20}/> Tributos</h3><button onClick={() => openTable('TAXES', 'Impostos', 'REVENUE')} className="text-xs bg-slate-50 hover:bg-blue-50 px-3 py-1 rounded-lg border border-slate-200 text-slate-600 font-bold flex gap-1 items-center"><TableIcon size={14}/> Dados</button></div><div className="flex-1 flex items-center justify-center h-64"><Bar data={taxesChartData} options={stackedOptions} /></div></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Users className="text-emerald-600" size={20}/> Top Clientes (Receita)</h3><Trophy size={18} className="text-yellow-500" /></div>
                <div className="flex-1 overflow-y-auto h-96 pr-2 scrollbar-thin">
                    {rankingData.clients.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados</div> : <div className="flex flex-col gap-1">{rankingData.clients.map((c, i) => <RankingItem key={i} rank={i+1} name={c.name} value={c.value} maxValue={maxClientVal} type="client" />)}</div>}
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-800 flex items-center gap-2"><ShoppingBag className="text-rose-600" size={20}/> Top Fornecedores (Despesa)</h3></div>
                <div className="flex-1 overflow-y-auto h-96 pr-2 scrollbar-thin">
                    {rankingData.suppliers.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados</div> : <div className="flex flex-col gap-1">{rankingData.suppliers.map((s, i) => <RankingItem key={i} rank={i+1} name={s.name} value={s.value} maxValue={maxSupplierVal} type="supplier" />)}</div>}
                </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end"><button onClick={handleDownloadPdf} disabled={generatingPdf} className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg disabled:opacity-70">{generatingPdf ? <Loader className="animate-spin" size={16}/> : <><Printer size={16} /> Baixar PDF</>}</button></div>
      
      <AnimatePresence>{detailModal.open && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={() => setDetailModal({ ...detailModal, open: false })}><motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}><div className="p-4 border-b flex justify-between items-center bg-slate-50"><h2 className="font-bold text-lg flex items-center gap-2"><FileText className="text-blue-600"/> {detailModal.title}</h2><button onClick={() => setDetailModal({ ...detailModal, open: false })}><X className="text-slate-400 hover:text-red-500"/></button></div><div className="p-4 overflow-y-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3 text-right">Valor</th></tr></thead><tbody className="divide-y">{detailModal.type === 'TAXES' ? ([{l: 'ICMS', v: detailModal.data.tax_icms}, {l: 'PIS', v: detailModal.data.tax_pis}, {l: 'COFINS', v: detailModal.data.tax_cofins}, {l: 'ISS', v: detailModal.data.tax_iss}, {l: 'IRPJ', v: detailModal.data.tax_irpj}, {l: 'CSLL', v: detailModal.data.tax_csll}].sort((a,b) => b.v - a.v).map((r, i) => <tr key={i}><td className="p-3 font-medium">{r.l}</td><td className="p-3 text-right">{formatCurrency(r.v)}</td></tr>)) : (detailModal.data.map((r, i) => { 
                let val = 0;
                if (detailModal.dataType === 'EXPENSE') val = Number(r.totalTaxes) + Number(r.totalPurchases) + Number(r.totalExpenses);
                else val = Number(r.totalRevenue);
                return (<tr key={i}><td className="p-3 font-medium">{r.monthKey}</td><td className="p-3 text-right font-bold text-blue-600">{formatCurrency(val)}</td></tr>);
      }))}</tbody></table></div></motion.div></motion.div>)}</AnimatePresence>
    </div>
  );
};

export default Dashboard;