import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  FileText, Filter, Download, Wallet, TrendingUp, 
  ArrowDownCircle, BarChart3, PieChart, Calendar, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Printer
} from 'lucide-react';
import { motion } from 'framer-motion';

const DRE = ({ apiBase, selectedCompanyId }) => {
  // CONFIGURAÇÕES DE ESTADO
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // GERAÇÃO DA LISTA DE ANOS (5 ANOS DE JANELA)
  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 5 }, (valor, index) => currentYear - 2 + index);

  // BUSCA DE DADOS NO BACKEND
  const fetchDRE = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const response = await axios.get(`${apiBase}/api/reports/dre`, {
        params: { companyId: selectedCompanyId, year: year }
      });
      setData(response.data);
    } catch (error) {
      console.error("Erro ao buscar relatório DRE:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDRE();
  }, [selectedCompanyId, year, apiBase]);

  // FUNÇÕES AUXILIARES DE CÁLCULO E FORMATAÇÃO
  const getTotal = (field) => data.reduce((acumulador, atual) => acumulador + (Number(atual[field]) || 0), 0);
  
  const formatCurrency = (valor) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(valor || 0);
  };

  const calculateAV = (valor, receitaTotal) => {
    if (!receitaTotal || receitaTotal === 0) return '0.0%';
    return ((valor / receitaTotal) * 100).toFixed(1) + '%';
  };

  // DEFINIÇÃO DA ESTRUTURA DA DRE (ORDEM CONTÁBIL)
  const rows = [
    { label: '1. RECEITA BRUTA OPERACIONAL', field: 'grossRevenue', style: 'text-blue-600 font-black bg-blue-50/30' },
    { label: '(-) Deduções e Impostos', field: 'deductions', style: 'text-rose-500 font-medium' },
    { label: '2. RECEITA LÍQUIDA', field: 'netRevenue', style: 'font-bold bg-slate-100/80 text-slate-900 border-y border-slate-200' },
    { label: '(-) Custos de Mercadorias (CMV)', field: 'variableCosts', style: 'text-amber-600 font-medium' },
    { label: '3. MARGEM DE CONTRIBUIÇÃO', field: 'grossProfit', style: 'font-bold bg-slate-100/80 text-slate-900 border-y border-slate-200' },
    { label: '(-) Despesas Operacionais / Analíticas', field: 'expenses', style: 'text-slate-500 font-medium' },
    { label: '4. RESULTADO LÍQUIDO DO EXERCÍCIO', field: 'netResult', style: 'font-black text-sm bg-slate-900 text-white rounded-b-lg' },
  ];

  // EXPORTAÇÃO PARA CSV (FORMATO EXCEL)
  const handleExportCSV = () => {
    if (data.length === 0) return alert("Não há dados para exportar no momento.");
    
    let csvContent = "Estrutura DRE;Total Anual;Analise Vertical %;Jan;Fev;Mar;Abr;Mai;Jun;Jul;Ago;Set;Out;Nov;Dez\n";
    const totalYearRevenue = getTotal('grossRevenue');

    rows.forEach(linha => {
      const valorTotal = getTotal(linha.field);
      const av = linha.field !== 'grossRevenue' ? calculateAV(valorTotal, totalYearRevenue) : '100%';
      let csvRow = `${linha.label};"${formatCurrency(valorTotal)}";${av}`;
      
      data.forEach(mes => {
        csvRow += `;"${formatCurrency(mes[linha.field])}"`;
      });
      csvContent += csvRow + "\n";
    });

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `DRE_Vector_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedCompanyId) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 bg-white rounded-[2.5rem] border border-slate-100 m-4 shadow-sm">
        <div className="p-6 bg-slate-50 rounded-full mb-4 animate-pulse">
           <FileText size={48} className="opacity-20"/>
        </div>
        <p className="font-black uppercase tracking-[0.2em] text-[10px]">Aguardando seleção de empresa</p>
      </div>
    );
  }

  return (
    <div className="p-6 w-full animate-in fade-in duration-700 pb-20">
      
      {/* CABEÇALHO DO RELATÓRIO */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] tracking-[0.2em] uppercase mb-1">
            <div className="w-8 h-1 bg-emerald-500 rounded-full" /> Financial Report
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
            DRE <span className="text-slate-300 font-light italic">Gerencial</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium">Análise de performance contábil do exercício de {year}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl flex items-center px-4 py-3 shadow-sm ring-1 ring-slate-900/5 transition-all focus-within:ring-emerald-500/20">
            <Calendar size={18} className="text-slate-400 mr-3"/>
            <select 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))} 
              className="bg-transparent outline-none text-sm font-black text-slate-700 cursor-pointer appearance-none pr-4"
            >
              {yearsList.map(itemAno => (
                 <option key={itemAno} value={itemAno}>Exercício {itemAno}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleExportCSV} 
            className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
          >
            <Download size={18}/> 
            Exportar Dados
          </button>
        </div>
      </div>

      {/* QUADRO DE RESUMO RÁPIDO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Faturamento Anual</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{formatCurrency(getTotal('grossRevenue'))}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resultado Líquido</p>
            <p className={`text-2xl font-black font-mono ${getTotal('netResult') >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(getTotal('netResult'))}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Margem Líquida Média</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{calculateAV(getTotal('netResult'), getTotal('grossRevenue'))}</p>
          </motion.div>
      </div>

      {/* TABELA DRE PROCESSADA */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col relative">
        {loading ? (
          <div className="p-24 text-center text-slate-400 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="font-black text-[10px] uppercase tracking-widest">Consolidando Lançamentos Analíticos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100">
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-50 border-r border-slate-100">
                    Estrutura de Resultados
                  </th>
                  <th className="p-6 text-right text-[10px] font-black text-slate-900 uppercase tracking-widest bg-slate-100/50 border-r border-slate-100">
                    Total Acumulado
                  </th>
                  <th className="p-6 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest border-r border-slate-100">
                    A.V. %
                  </th>
                  {Array.from({ length: 12 }).map((valorMes, indexMes) => (
                    <th key={indexMes} className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[120px]">
                      {new Date(0, indexMes).toLocaleDateString('pt-BR', { month: 'short' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((linha, indexLinha) => {
                  const valorTotalAno = getTotal(linha.field);
                  const faturamentoTotalAno = getTotal('grossRevenue');
                  const ehResultadoNegativo = linha.field === 'netResult' && valorTotalAno < 0;

                  return (
                    <tr key={indexLinha} className={`group transition-colors ${linha.style.includes('bg-') ? '' : 'hover:bg-slate-50/50'}`}>
                      {/* COLUNA FIXA: DESCRIÇÃO */}
                      <td className={`p-5 px-6 sticky left-0 z-30 font-bold border-r border-slate-100 shadow-xl shadow-slate-900/5 ${linha.style} ${linha.style.includes('bg-') ? '' : 'bg-white group-hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          <ChevronRight size={14} className="opacity-30" />
                          {linha.label}
                        </div>
                      </td>
                      
                      {/* COLUNA TOTAL ANUAL */}
                      <td className={`p-5 px-6 text-right font-mono font-black border-r border-slate-100 bg-slate-50/30 ${linha.style}`}>
                        {formatCurrency(valorTotalAno)}
                      </td>
                      
                      {/* COLUNA ANALISE VERTICAL */}
                      <td className="p-5 px-6 text-right font-mono font-bold text-[11px] text-slate-400 border-r border-slate-100 bg-slate-50/10">
                        {linha.field !== 'grossRevenue' ? calculateAV(valorTotalAno, faturamentoTotalAno) : '100%'}
                      </td>

                      {/* COLUNAS MENSAIS (DATA) */}
                      {data.map((mesData, indexMesData) => (
                        <td key={indexMesData} className={`p-5 px-6 text-right font-mono text-xs font-bold ${linha.field === 'netResult' ? (mesData[linha.field] >= 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-600'}`}>
                          {mesData[linha.field] !== 0 ? formatCurrency(mesData[linha.field]) : <span className="opacity-20">-</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* RODAPÉ INFORMATIVO */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-start gap-4 shadow-sm">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><BarChart3 size={20}/></div>
            <div>
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-1">Impacto Analítico</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Os valores apresentados incluem automaticamente os lançamentos realizados no módulo analítico (Entradas e Saídas avulsas), permitindo uma visão fiel do fluxo de caixa e competência.</p>
            </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-start gap-4 shadow-xl">
            <div className="p-3 bg-white/10 rounded-2xl text-blue-400"><PieChart size={20}/></div>
            <div>
              <h4 className="font-black text-white text-xs uppercase tracking-widest mb-1">Margem de Contribuição</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Representa o quanto a operação gera de sobra após pagar os custos variáveis e impostos, fundamental para cobrir as despesas fixas e gerar lucro líquido.</p>
            </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
    </div>
  );
};

export default DRE;