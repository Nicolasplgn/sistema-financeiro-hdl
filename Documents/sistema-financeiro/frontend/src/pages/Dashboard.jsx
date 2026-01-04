import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Wallet, TrendingUp, TrendingDown, Building2, Printer, 
  PieChart, Loader, X, FileText, Table as TableIcon, Filter, 
  RotateCcw, BarChart3, Layers, AlertTriangle, FileSpreadsheet, MessageCircle,
  Users, ShoppingBag, Trophy, Medal, FileCode, Receipt, Activity, Target
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
      <div className={`w-10 h-10 rounded-full ${rankColor} flex items-center justify-center text-xs font-black shrink-0 shadow-sm`}>
        {RankIcon ? RankIcon : `#${rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-sm font-black text-slate-700 truncate max-w-[150px] uppercase tracking-tighter" title={name}>{name}</span>
          <div className="text-right">
            <span className={`block text-sm font-mono font-black tracking-tighter ${colorText}`}>
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

const PremiumCard = ({ title, value, sub, icon: Icon, color, children }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group flex flex-col justify-between h-full">
    <div>
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className={`p-4 rounded-2xl bg-opacity-10 ${color.replace('text-', 'bg-')} ${color}`}>
                <Icon size={24} />
            </div>
        </div>
        <div className="relative z-10">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
            <h3 className={`text-4xl font-black tracking-tighter italic ${color}`}>{value}</h3>
            <p className="text-xs text-slate-400 mt-2 font-medium">{sub}</p>
        </div>
    </div>
    {children && <div className="mt-4">{children}</div>}
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
      } catch (error) { console.error("Erro dashboard:", error); } finally { setLoading(false); }
    };
    fetchData();
  }, [companyId, period, BASE_URL]);

  // --- FUNÇÕES DE EXPORTAÇÃO CORRIGIDAS ---

  const handleExportExcel = async () => {
    if (!reportData || !reportData.months.length) return alert("Sem dados para exportar.");
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório BI Vector');

    worksheet.mergeCells('A1:E2');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'VECTOR CONNECT ENTERPRISES | MASTER BI REPORT';
    titleCell.font = { name: 'Arial Black', size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headerRow = worksheet.getRow(4);
    headerRow.values = ['COMPETÊNCIA', 'FATURAMENTO', 'IMPOSTOS', 'SAÍDAS (CUSTOS)', 'LUCRO LÍQUIDO'];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; });

    reportData.months.forEach((m) => {
        const row = worksheet.addRow([
            m.monthKey, 
            Number(m.totalRevenue), 
            Number(m.totalTaxes), 
            (Number(m.totalPurchases) + Number(m.totalExpenses)), 
            Number(m.profit)
        ]);
        [2, 3, 4, 5].forEach(col => { row.getCell(col).numFmt = '"R$" #,##0.00'; });
    });

    worksheet.columns = [{ width: 20 }, { width: 25 }, { width: 25 }, { width: 25 }, { width: 25 }];
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Relatorio_BI_Vector_${period.start}.xlsx`);
  };

  const handleExportHTML = () => {
    if (!reportData) return alert("Sem dados.");
    const s = reportData.summary;
    const margin = s.totalRevenue > 0 ? ((s.totalProfit / s.totalRevenue) * 100).toFixed(1) : 0;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>Vector Connect BI Report</title>
        <style>
            body { font-family: sans-serif; padding: 40px; background: #f8fafc; }
            .card { background: white; padding: 30px; border-radius: 25px; box-shadow: 0 10px 15px rgba(0,0,0,0.1); }
            h1 { color: #0f172a; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #0f172a; color: white; padding: 12px; text-align: left; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Vector Connect | BI Report</h1>
            <p>Período: ${period.start} a ${period.end}</p>
            <p>Faturamento Total: ${formatCurrency(s.totalRevenue)}</p>
            <p>Lucro Total: ${formatCurrency(s.totalProfit)} (Margem: ${margin}%)</p>
            <table>
                <thead><tr><th style="text-align:left">Mês</th><th>Receita</th><th>Saídas</th><th>Resultado</th></tr></thead>
                <tbody>
                    ${reportData.months.map(m => `
                        <tr><td style="text-align:left">${m.monthKey}</td><td>${formatCurrency(m.totalRevenue)}</td><td>${formatCurrency(m.totalTaxes + m.totalPurchases + m.totalExpenses)}</td><td>${formatCurrency(m.profit)}</td></tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </body>
    </html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `Relatorio_BI_Vector.html`; link.click();
  };

  const handleShareWhatsApp = () => {
    if (!reportData?.summary) return;
    const s = reportData.summary;
    const margin = s.totalRevenue > 0 ? ((s.totalProfit / s.totalRevenue) * 100).toFixed(1) : 0;
    const text = `📊 *Vector Connect Financeiro*\n💰 Fat: ${formatCurrency(s.totalRevenue)}\n📉 Saídas: ${formatCurrency(s.totalCosts + s.totalTaxes)}\n✅ Lucro: ${formatCurrency(s.totalProfit)}\n📈 Margem: ${margin}%`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
        const canvas = await html2canvas(printRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
        pdf.save(`Relatorio_BI_Executivo.pdf`);
    } finally { setGeneratingPdf(false); }
  };

  // --- FUNÇÃO VER DADOS (FIXED) ---
  const openTable = (type, title, dataType = 'REVENUE') => {
    if (!reportData) return;
    setDetailModal({
        open: true,
        type: type,
        title: title,
        data: type === 'TAXES' ? reportData.summary : type === 'CATEGORIES' ? reportData.categories : reportData.months,
        dataType: dataType
    });
  };

  if (!companyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400 font-black uppercase tracking-widest italic opacity-40">Selecione uma Unidade de Negócio</div>;
  if (loading || !reportData) return <div className="h-full flex items-center justify-center"><Loader className="animate-spin text-blue-600" size={48}/></div>;

  const { months, summary, categories } = reportData;
  const totalCategories = categories?.reduce((acc, curr) => acc + Number(curr.total), 0) || 0;
  const marginValue = summary.totalRevenue > 0 ? ((summary.totalProfit / summary.totalRevenue) * 100) : 0;

  // --- OPÇÕES DE GRÁFICOS ---
  const fullInteractionOptions = { 
    responsive: true, maintainAspectRatio: false, 
    interaction: { mode: 'index', intersect: false }, 
    scales: { 
        x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }, 
        y: { position: 'left', beginAtZero: true, grid: { borderDash: [4, 4] }, ticks: { font: { family: 'monospace' } } }, 
        y1: { position: 'right', grid: { drawOnChartArea: false }, display: true, ticks: { callback: (v) => `${v}%`, font: { weight: 'bold' } } } 
    },
    plugins: {
        legend: { position: 'bottom', labels: { font: { weight: 'bold' }, usePointStyle: true } },
        tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', titleFont: { size: 14, weight: 'bold' }, padding: 12, cornerRadius: 12 }
    }
  };

  const mixedChartData = {
    labels: months.map(m => m.monthKey),
    datasets: [
      { type: 'line', label: 'Margem (%)', data: months.map(m => m.totalRevenue > 0 ? ((m.profit / m.totalRevenue) * 100).toFixed(1) : 0), borderColor: '#8B5CF6', backgroundColor: '#8B5CF6', borderWidth: 2, borderDash: [5, 5], tension: 0.4, pointRadius: 0, yAxisID: 'y1', order: 0 },
      { type: 'line', label: 'Faturamento', data: months.map(m => m.totalRevenue), borderColor: '#2563EB', borderWidth: 4, tension: 0.4, fill: false, pointRadius: 4, yAxisID: 'y', order: 1 },
      { type: 'bar', label: 'Lucro Líquido', data: months.map(m => m.profit), backgroundColor: months.map(m => m.profit >= 0 ? '#10B981' : '#EF4444'), borderRadius: 8, yAxisID: 'y', order: 2 }
    ]
  };

  return (
    <div className="p-4 space-y-10 w-full max-w-[1600px] mx-auto pb-20 animate-fade-in">
      <div ref={printRef} className="bg-slate-50 p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
        
        {/* CABEÇALHO EXECUTIVO */}
        <div className="flex flex-col xl:flex-row justify-between items-center gap-10 border-b border-slate-200 pb-12 mb-12">
          <div className="flex-1 text-center xl:text-left">
            <h1 className="text-7xl font-black text-slate-900 tracking-tighter italic leading-tight">{getGreeting()}, Diretor.</h1>
            <p className="text-slate-400 mt-4 font-black text-[11px] uppercase tracking-[0.4em] flex justify-center xl:justify-start items-center gap-3 italic">
               <Activity size={16} className="text-blue-600"/> RESUMO CORPORATIVO DE BI
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-3">
                <button onClick={handleShareWhatsApp} className="px-8 py-5 bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-1"><MessageCircle size={18}/> WHATSAPP</button>
                <button onClick={handleExportExcel} className="px-8 py-5 bg-slate-900 hover:bg-black text-white rounded-2xl shadow-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:-translate-y-1"><FileSpreadsheet size={18}/> EXCEL</button>
                <button onClick={handleExportHTML} className="px-8 py-5 bg-white border border-slate-200 text-slate-700 rounded-2xl shadow-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 hover:-translate-y-1"><FileCode size={18}/> WEB</button>
                <div className="h-10 w-px bg-slate-300 mx-1"></div>
                <button onClick={() => setPeriod({ start: `${new Date().getFullYear()}-01`, end: `${new Date().getFullYear()}-12` })} className="p-5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 shadow-sm transition-all hover:rotate-180"><RotateCcw size={22}/></button>
            </div>
            
            <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-inner">
                <Filter size={20} className="text-slate-400 ml-3"/>
                <input type="month" value={period.start} onChange={(e) => setPeriod({...period, start: e.target.value})} className="border-none bg-transparent text-slate-900 font-black text-sm outline-none uppercase min-w-[180px] cursor-pointer"/>
                <span className="text-slate-300 font-black">➜</span>
                <input type="month" value={period.end} onChange={(e) => setPeriod({...period, end: e.target.value})} className="border-none bg-transparent text-slate-900 font-black text-sm outline-none uppercase min-w-[180px] cursor-pointer"/>
            </div>
          </div>
        </div>

        {/* KPIS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <PremiumCard title="Faturamento Bruto" value={formatCurrency(summary.totalRevenue)} sub="Receita Acumulada" icon={Wallet} color="text-blue-600"/>
          <PremiumCard title="Margem Líquida" value={`${marginValue.toFixed(1)}%`} sub={`Status: ${marginValue > 20 ? 'Excelente' : 'Estável'}`} icon={Target} color="text-indigo-600">
             <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(marginValue, 100)}%` }} className="h-full bg-indigo-600" /></div>
          </PremiumCard>
          <PremiumCard title="Lucro Líquido" value={formatCurrency(summary.totalProfit)} sub="Resultado Final" icon={TrendingUp} color={summary.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}/>
          <PremiumCard title="Fluxo de Saída" value={formatCurrency(summary.totalTaxes + summary.totalCosts)} sub="Custos e Impostos" icon={TrendingDown} color="text-rose-600"/>
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-10">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm col-span-2">
            <div className="flex justify-between items-center mb-10"><h3 className="font-black text-slate-900 text-[11px] uppercase tracking-[0.3em] flex items-center gap-3"><BarChart3 className="text-blue-600" size={20}/> Evolução de Performance</h3><button onClick={() => openTable('EVOLUTION', 'Histórico Mensal de Receita', 'REVENUE')} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 font-black text-[10px] uppercase tracking-widest flex gap-2 items-center transition-all shadow-sm"><TableIcon size={18}/> Ver Dados</button></div>
            <div className="h-96"><Bar data={mixedChartData} options={fullInteractionOptions} /></div>
          </div>
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative text-center">
            <div className="flex justify-between items-center mb-10"><h3 className="font-black text-slate-900 text-[11px] uppercase tracking-[0.3em] flex items-center gap-3"><PieChart className="text-blue-600" size={20}/> Categorias</h3><button onClick={() => openTable('CATEGORIES', 'Detalhamento por Categoria')} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"><TableIcon size={20}/></button></div>
            <div className="h-96 flex flex-col items-center justify-center relative">
                {categories?.length > 0 ? (
                    <><Doughnut data={{ labels: categories?.map(c => c.name) || [], datasets: [{ data: categories?.map(c => c.total) || [], backgroundColor: ['#0F172A', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'], borderWidth: 0 }] }} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: true, position: 'bottom', labels: { font: { weight: 'bold', size: 10 }, usePointStyle: true, padding: 20 } }, tooltip: { enabled: false } } }} /><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-24"><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 italic"> Despesa Total </span><span className="text-3xl font-black text-slate-900 tracking-tighter italic"> {formatCurrency(totalCategories)} </span></div></>
                ) : (<p className="text-slate-300 font-black text-[11px] uppercase italic">Aguardando Lançamentos...</p>)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm"><div className="flex justify-between items-center mb-10"><h3 className="font-black text-slate-900 text-[11px] uppercase tracking-[0.3em] flex items-center gap-3"><Layers className="text-blue-600" size={20}/> Estrutura de Gastos</h3><button onClick={() => openTable('EVOLUTION', 'Custos Analíticos', 'EXPENSE')} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"><TableIcon size={18}/></button></div><div className="h-80"><Bar data={{ labels: months.map(m => m.monthKey), datasets: [{ label: 'Impostos', data: months.map(m => m.totalTaxes), backgroundColor: '#F59E0B', borderRadius: 4 }, { label: 'Compras', data: months.map(m => m.totalPurchases), backgroundColor: '#6366F1', borderRadius: 4 }, { label: 'Despesas', data: months.map(m => m.totalExpenses), backgroundColor: '#EC4899', borderRadius: 4 }] }} options={fullInteractionOptions} /></div></div>
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm"><div className="flex justify-between items-center mb-10"><h3 className="font-black text-slate-900 text-[11px] uppercase tracking-[0.3em] flex items-center gap-3"><Receipt className="text-slate-900" size={20}/> Matriz Tributária</h3><button onClick={() => openTable('TAXES', 'Detalhamento de Impostos')} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"><TableIcon size={18}/></button></div><div className="h-80"><Bar data={{ labels: months.map(m => m.monthKey), datasets: [{ label: 'ICMS', data: months.map(m => m.tax_icms), backgroundColor: '#2563EB' }, { label: 'PIS', data: months.map(m => m.tax_pis), backgroundColor: '#F59E0B' }, { label: 'COFINS', data: months.map(m => m.tax_cofins), backgroundColor: '#10B981' }, { label: 'ISS', data: months.map(m => m.tax_iss), backgroundColor: '#8B5CF6' }, { label: 'IRPJ/CSLL', data: months.map(m => m.tax_irpj_csll), backgroundColor: '#EF4444' }] }} options={fullInteractionOptions} /></div></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[550px]"><div className="flex justify-between items-center mb-10 text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 italic"><span className="flex items-center gap-3"><Users className="text-blue-600" size={22}/> Top Parceiros</span><Trophy className="text-yellow-500" size={22}/></div><div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">{rankingData.clients.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-20 font-black">Vazio</div>) : (rankingData.clients.map((c, i) => <RankingItem key={i} rank={i+1} name={c.name} value={c.value} maxValue={maxClientVal} type="client" />))}</div></div>
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[550px]"><div className="flex justify-between items-center mb-10 text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 italic"><span className="flex items-center gap-3"><ShoppingBag className="text-rose-600" size={22}/> Matriz de Fornecedores</span></div><div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">{rankingData.suppliers.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-20 font-black">Vazio</div>) : (rankingData.suppliers.map((s, i) => <RankingItem key={i} rank={i+1} name={s.name} value={s.value} maxValue={maxSupplierVal} type="supplier" />))}</div></div>
        </div>
      </div>

      <div className="flex justify-end gap-5"><button onClick={handleDownloadPdf} disabled={generatingPdf} className="bg-slate-900 hover:bg-black text-white px-12 py-6 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center gap-4 hover:-translate-y-2">{generatingPdf ? <Loader className="animate-spin" size={20}/> : <><Printer size={20} /> Exportar Relatório Master</>}</button></div>

      {/* MODAL DE TABELAS */}
      <AnimatePresence>
        {detailModal.open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl flex justify-center items-center z-50 p-6" onClick={() => setDetailModal({ ...detailModal, open: false })}>
                <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="bg-white w-full max-w-6xl rounded-[4rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="p-10 border-b flex justify-between items-center bg-slate-50"><h2 className="font-black text-slate-900 uppercase tracking-[0.3em] text-sm flex items-center gap-4 italic"><FileText className="text-blue-600" size={24}/> {detailModal.title}</h2><button onClick={() => setDetailModal({ ...detailModal, open: false })} className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors rounded-2xl"><X size={32}/></button></div>
                    <div className="p-10 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left"><thead className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] border-b border-slate-100"><tr><th className="pb-6">Descrição Item</th><th className="pb-6 text-right">Valor Consolidado</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {detailModal.type === 'CATEGORIES' ? (
                                    detailModal.data.map((r, i) => (<tr key={i} className="hover:bg-slate-50 group"><td className="py-6 font-black text-slate-700 text-base uppercase italic">{r.name}</td><td className="py-6 text-right font-mono font-black text-slate-900 text-lg">{formatCurrency(r.total)}</td></tr>))
                                ) : detailModal.type === 'TAXES' ? (
                                    [{l: 'ICMS', v: detailModal.data.tax_icms}, {l: 'PIS', v: detailModal.data.tax_pis}, {l: 'COFINS', v: detailModal.data.tax_cofins}, {l: 'ISS', v: detailModal.data.tax_iss}, {l: 'IRPJ', v: detailModal.data.tax_irpj}, {l: 'CSLL', v: detailModal.data.tax_csll}].sort((a,b)=>b.v-a.v).map((r, i) => (<tr key={i} className="hover:bg-slate-50 group"><td className="py-6 font-black text-slate-700 uppercase italic text-base">{r.l}</td><td className="py-6 text-right font-mono font-black text-blue-600 text-lg">{formatCurrency(r.v)}</td></tr>))
                                ) : (
                                    detailModal.data.map((r, i) => (<tr key={i} className="hover:bg-slate-50 group"><td className="py-6 font-black text-slate-700 text-base italic">{r.monthKey}</td><td className="py-6 text-right font-mono font-black text-slate-900 text-lg">{formatCurrency(detailModal.dataType === 'EXPENSE' ? (Number(r.totalTaxes || 0) + Number(r.purchases_total || 0) + Number(r.expenses_total || 0)) : r.total_revenue || r.totalRevenue)}</td></tr>))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; border: 2px solid #f8fafc; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; } @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }`}</style>
    </div>
  );
};

export default Dashboard;