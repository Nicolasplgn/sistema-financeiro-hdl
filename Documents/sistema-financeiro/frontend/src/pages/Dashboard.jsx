import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import ReportTable from '../components/ReportTable';
import FinancialCharts from '../components/FinancialCharts';
import { Filter, TrendingUp, DollarSign, Wallet, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const { selectedCompany } = useAuth();
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCompany?.id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await api.post('/report', { companyIds: [selectedCompany.id], startDate, endDate });
        setReportData(response.data);
      } catch (error) { setReportData(null); } finally { setLoading(false); }
    };
    fetchData();
  }, [selectedCompany, startDate, endDate]);

  if (!selectedCompany) return <div className="h-full flex items-center justify-center text-slate-400">Selecione uma empresa.</div>;

  const summary = reportData?.summary || { totalRevenue: 0, totalTaxes: 0, totalProfit: 0 };
  const toBRL = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-800">Visão Geral: <span className="text-blue-600">{selectedCompany.name}</span></h2>
        <div className="flex gap-2 bg-slate-50 p-2 rounded-lg border">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm" />
            <span className="text-slate-300">|</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm" />
        </div>
      </div>

      {loading ? <div className="animate-pulse h-64 bg-slate-200 rounded-xl"></div> : !reportData?.months?.length ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed"><AlertCircle size={48} className="text-slate-300 mb-2" /><p className="text-slate-500">Sem dados.</p></div>
      ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border"><p className="text-sm font-bold text-slate-500 uppercase">Faturamento</p><h3 className="text-3xl font-bold text-slate-800 mt-2">{toBRL(summary.totalRevenue)}</h3></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border"><p className="text-sm font-bold text-slate-500 uppercase">Impostos</p><h3 className="text-3xl font-bold text-slate-800 mt-2">{toBRL(summary.totalTaxes)}</h3></div>
                <div className="bg-white p-6 rounded-xl shadow-sm border"><p className="text-sm font-bold text-slate-500 uppercase">Lucro Líquido</p><h3 className={`text-3xl font-bold mt-2 ${summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{toBRL(summary.totalProfit)}</h3></div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border"><FinancialCharts monthlyData={reportData.months} totals={summary} /></div>
            <div className="bg-white p-6 rounded-xl shadow-sm border"><ReportTable reportData={reportData} companyName={selectedCompany.name} period={`${startDate} até ${endDate}`} /></div>
          </>
      )}
    </div>
  );
};

export default Dashboard;