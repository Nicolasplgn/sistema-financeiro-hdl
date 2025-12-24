import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Wallet, TrendingUp, TrendingDown, Building2, Printer, 
  PieChart, Loader, X, FileText, Table as TableIcon, Filter, 
  RotateCcw, BarChart3, Layers, AlertTriangle, FileSpreadsheet, MessageCircle,
  Users, ShoppingBag, Trophy, Medal, FileCode, Receipt
} from 'lucide-react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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

  // --- FUNÇÕES AUXILIARES ---
  const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  // CORREÇÃO: Função getGreeting adicionada de volta
  const getGreeting = () => { 
    const h = new Date().getHours(); 
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getLastDayOfMonth = (ym) => { 
    if (!ym) return 30; 
    const [y, m] = ym.split('-'); 
    return new Date(y, +m, 0).getDate(); 
  };

  useEffect(() => {
    if (!companyId) return;
    const fetchData = async () => {
      setLoading(true);
      const startDate = `${period.start}-01`;
      const endDate = `${period.end}-${getLastDayOfMonth(period.end)}`;
      try {
        const [resReport, resRanking] = await Promise.all([
            axios.post(`${BASE_URL}/api/report`, { companyIds: [companyId], startDate, endDate }),
            axios.get(`${BASE_URL}/api/reports/partners-ranking`, { params: { companyId, startDate, endDate } })
        ]);
        
        if (resReport.data) setReportData(resReport.data);
        if (resRanking.data) setRankingData(resRanking.data);
        
      } catch (error) { 
        console.error("Erro dashboard:", error); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, [companyId, period, BASE_URL]);

  // --- EXPORTAÇÕES ---

  const handleExportExcel = async () => {
    if (!reportData || !reportData.months.length) return alert("Sem dados para exportar.");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório Gerencial');

    worksheet.mergeCells('A1:E2');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Vector Financ | Relatório Financeiro';
    titleCell.font = { name: 'Arial', family: 4, size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A3:E3');
    const periodCell = worksheet.getCell('A3');
    periodCell.value = `Período: ${period.start} a ${period.end}`;
    periodCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headerRow = worksheet.getRow(5);
    headerRow.values = ['Mês', 'Receita Bruta', 'Impostos', 'Custos/Despesas', 'Lucro Líquido'];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { horizontal: 'center' };
    });

    reportData.months.forEach((m) => {
        const row = worksheet.addRow([m.monthKey, m.totalRevenue, m.totalTaxes, m.totalPurchases + m.totalExpenses, m.profit]);
        row.getCell(2).numFmt = '"R$" #,##0.00';
        row.getCell(3).numFmt = '"R$" #,##0.00';
        row.getCell(4).numFmt = '"R$" #,##0.00';
        const profitCell = row.getCell(5);
        profitCell.numFmt = '"R$" #,##0.00';
        profitCell.font = { bold: true, color: { argb: m.profit >= 0 ? 'FF10B981' : 'FFEF4444' } };
    });

    worksheet.columns = [{ width: 15 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Relatorio_Vector Financ_${period.start}.xlsx`);
  };

  // --- WHATSAPP CORRIGIDO ---
  const handleShareWhatsApp = () => {
    if (!reportData?.summary) return alert("Aguarde o carregamento.");
    const s = reportData.summary;
    const margin = s.totalRevenue > 0 ? ((s.totalProfit / s.totalRevenue) * 100).toFixed(1) : 0;
    
    // FORMATO EXATO QUE VOCÊ PEDIU
    const text = 
`📊 Vector Financeiro
Resumo ${period.start} a ${period.end}

💰 Fat: ${formatCurrency(s.totalRevenue)}
📉 Saídas: ${formatCurrency(s.totalCosts + s.totalTaxes)}
✅ Lucro: ${formatCurrency(s.totalProfit)}
📈 Margem: ${margin}%`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleExportHTML = () => {
    if (!reportData) return;
    const s = reportData.summary;
    const margin = s.totalRevenue > 0 ? ((s.totalProfit / s.totalRevenue) * 100).toFixed(1) : 0;
    const htmlContent = `<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8"><title>Relatório Vector Financ</title><style>body{font-family:sans-serif;padding:40px;background:#f8fafc}.card{background:white;padding:20px;border-radius:16px;box-shadow:0 4px 6px rgba(0,0,0,0.05);margin-bottom:20px;border:1px solid #e2e8f0}.header h1{color:#2563eb;margin:0}table{width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden}th,td{padding:12px;border-bottom:1px solid #e2e8f0;text-align:right}th{background:#f1f5f9;text-align:left}.pos{color:#10b981;font-weight:bold}.neg{color:#ef4444;font-weight:bold}</style></head><body><div class="header"><h1>Vector Financ | Relatório</h1><p>${period.start} a ${period.end}</p></div><div class="card"><p><strong>Faturamento:</strong> ${formatCurrency(s.totalRevenue)}</p><p><strong>Lucro:</strong> ${formatCurrency(s.totalProfit)} (${margin}%)</p></div><table><thead><tr><th>Mês</th><th>Receita</th><th>Impostos</th><th>Custos</th><th>Lucro</th></tr></thead><tbody>${reportData.months.map(m=>`<tr><td style="text-align:left">${m.monthKey}</td><td>${formatCurrency(m.totalRevenue)}</td><td>${formatCurrency(m.totalTaxes)}</td><td>${formatCurrency(m.totalPurchases+m.totalExpenses)}</td><td class="${m.profit>=0?'pos':'neg'}">${formatCurrency(m.profit)}</td></tr>`).join('')}</tbody></table></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `Relatorio_${period.start}.html`; link.click();
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`Relatorio_Vector Financ_${period.start}.pdf`);
    } catch (err) { alert("Erro PDF."); } finally { setGeneratingPdf(false); }
  };

  const openTable = (type, title, dataType = 'REVENUE') => { if (reportData) setDetailModal({ open: true, type, title, data: type === 'TAXES' ? reportData.summary : reportData.months, dataType }); };

  const calculateRegimeRisk = (data) => {
    if (!data?.months?.length) return null;
    const projected = data.summary.totalRevenue || 0;
    if (projected > 4800000) return { exceeds: true, percentage: 10, currentRegime: 'SIMPLES' };
    return null;
  };

  const maxClientVal = rankingData.clients.length > 0 ? Math.max(...rankingData.clients.map(c => Number(c.value))) : 0;
  const maxSupplierVal = rankingData.suppliers.length > 0 ? Math.max(...rankingData.suppliers.map(s => Number(s.value))) : 0;

  if (!companyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><Building2 size={48} className="mb-4 opacity-20"/><p>Selecione uma empresa.</p></div>;
  if (loading || !reportData) return <div className="h-full flex items-center justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  const { months, summary, categories } = reportData;
  const regimeRisk = calculateRegimeRisk(reportData);

  // --- CONFIGURAÇÕES DOS GRÁFICOS (OPTIONS) ---
  const commonOptions = { 
    responsive: true, 
    maintainAspectRatio: false, 
    interaction: { mode: 'index', intersect: false }, 
    scales: { 
        x: { grid: { display: false } }, 
        y: { position: 'left', beginAtZero: true, grid: { borderDash: [4, 4] } }, 
        y1: { position: 'right', grid: { drawOnChartArea: false }, display: true } 
    },
    plugins: {
        legend: { position: 'bottom' }
    }
  };

  const stackedOptions = { 
    ...commonOptions, 
    scales: { 
        x: { stacked: true, grid: { display: false } }, 
        y: { stacked: true, beginAtZero: true } 
    } 
  };

  // --- DADOS DOS GRÁFICOS ---
  const mixedChartData = {
    labels: months.map(m => m.monthKey),
    datasets: [
      { type: 'line', label: 'Margem (%)', data: months.map(m => m.totalRevenue > 0 ? ((m.profit / m.totalRevenue) * 100).toFixed(1) : 0), borderColor: '#8B5CF6', backgroundColor: '#8B5CF6', borderWidth: 2, borderDash: [5, 5], tension: 0.4, pointRadius: 0, yAxisID: 'y1', order: 0 },
      { type: 'line', label: 'Faturamento', data: months.map(m => m.totalRevenue), borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, yAxisID: 'y', order: 1 },
      { type: 'bar', label: 'Lucro Líquido', data: months.map(m => m.profit), backgroundColor: months.map(m => m.profit >= 0 ? '#10B981' : '#EF4444'), borderRadius: 4, barPercentage: 0.5, yAxisID: 'y', order: 2 }
    ]
  };

  const categoryChartData = {
    labels: categories?.map(c => c.name) || [],
    datasets: [{
        data: categories?.map(c => c.total) || [],
        backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'],
        borderWidth: 0
    }]
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm col-span-2">
            <div className="flex justify-between mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="text-blue-600" size={20}/> Evolução</h3><button onClick={() => openTable('EVOLUTION', 'Mensal', 'REVENUE')} className="text-xs bg-slate-50 hover:bg-blue-50 px-3 py-1 rounded-lg border border-slate-200 text-slate-600 font-bold flex gap-1 items-center"><TableIcon size={14}/> Dados</button></div>
            <div className="h-72"><Bar data={mixedChartData} options={commonOptions} /></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm col-span-1">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChart className="text-orange-500" size={20}/> Categorias</h3>
            <div className="h-72 flex items-center justify-center relative">{categories?.length > 0 ? (<Doughnut data={categoryChartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }} />) : (<p className="text-slate-400 text-sm">Sem dados.</p>)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><div className="flex justify-between mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Layers className="text-indigo-600" size={20}/> Estrutura de Custos</h3><button onClick={() => openTable('EVOLUTION', 'Custos', 'EXPENSE')} className="text-xs bg-slate-50 hover:bg-indigo-50 px-3 py-1 rounded-lg border border-slate-200 text-slate-600 font-bold flex gap-1 items-center"><TableIcon size={14}/> Dados</button></div><div className="h-64"><Bar data={stackedChartData} options={stackedOptions} /></div></div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col"><div className="flex justify-between mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><PieChart className="text-slate-400" size={20}/> Tributos</h3><button onClick={() => openTable('TAXES', 'Impostos', 'REVENUE')} className="text-xs bg-slate-50 hover:bg-blue-50 px-3 py-1 rounded-lg border border-slate-200 text-slate-600 font-bold flex gap-1 items-center"><TableIcon size={14}/> Dados</button></div><div className="flex-1 flex items-center justify-center h-64"><Bar data={taxesChartData} options={stackedOptions} /></div></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-96">
                <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Users className="text-emerald-600" size={20}/> Top Clientes</h3><Trophy size={18} className="text-yellow-500" /></div>
                <div className="flex-1 overflow-y-auto pr-2">
                    {rankingData.clients.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <Users size={48} className="mb-2" />
                            <span className="text-sm font-medium">Sem dados no período</span>
                        </div>
                    ) : (
                        rankingData.clients.map((c, i) => <RankingItem key={i} rank={i+1} name={c.name} value={c.value} maxValue={maxClientVal} type="client" />)
                    )}
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-96">
                <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-800 flex items-center gap-2"><ShoppingBag className="text-rose-600" size={20}/> Top Fornecedores</h3></div>
                <div className="flex-1 overflow-y-auto pr-2">
                    {rankingData.suppliers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <ShoppingBag size={48} className="mb-2" />
                            <span className="text-sm font-medium">Sem dados no período</span>
                        </div>
                    ) : (
                        rankingData.suppliers.map((s, i) => <RankingItem key={i} rank={i+1} name={s.name} value={s.value} maxValue={maxSupplierVal} type="supplier" />)
                    )}
                </div>
            </div>
        </div>
      </div>
      <div className="flex justify-end"><button onClick={handleDownloadPdf} disabled={generatingPdf} className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg disabled:opacity-70">{generatingPdf ? <Loader className="animate-spin" size={16}/> : <><Printer size={16} /> Baixar PDF</>}</button></div>
      
      <AnimatePresence>{detailModal.open && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={() => setDetailModal({ ...detailModal, open: false })}><motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}><div className="p-4 border-b flex justify-between items-center bg-slate-50"><h2 className="font-bold text-lg flex items-center gap-2"><FileText className="text-blue-600"/> {detailModal.title}</h2><button onClick={() => setDetailModal({ ...detailModal, open: false })}><X className="text-slate-400 hover:text-red-500"/></button></div><div className="p-4 overflow-y-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3 text-right">Valor</th></tr></thead><tbody className="divide-y">{detailModal.type === 'TAXES' ? ([{l: 'ICMS', v: detailModal.data.tax_icms}, {l: 'PIS', v: detailModal.data.tax_pis}, {l: 'COFINS', v: detailModal.data.tax_cofins}, {l: 'ISS', v: detailModal.data.tax_iss}, {l: 'IRPJ', v: detailModal.data.tax_irpj}, {l: 'CSLL', v: detailModal.data.tax_csll}].sort((a,b) => b.v - a.v).map((r, i) => <tr key={i}><td className="p-3 font-medium">{r.l}</td><td className="p-3 text-right">{formatCurrency(r.v)}</td></tr>)) : (detailModal.data.map((r, i) => { let val = 0; if (detailModal.dataType === 'EXPENSE') val = Number(r.totalTaxes) + Number(r.totalPurchases) + Number(r.totalExpenses); else val = Number(r.totalRevenue); return (<tr key={i}><td className="p-3 font-medium">{r.monthKey}</td><td className="p-3 text-right font-bold text-blue-600">{formatCurrency(val)}</td></tr>); }))}</tbody></table></div></motion.div></motion.div>)}</AnimatePresence>
    </div>
  );
};

export default Dashboard;