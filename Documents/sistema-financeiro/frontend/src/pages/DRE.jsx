import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Filter, Download, Wallet } from 'lucide-react';

const DRE = ({ apiBase, selectedCompanyId }) => {
  // Inicia sempre com o ano atual do sistema
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Gera lista dinâmica de anos (2 pra trás, 2 pra frente do atual)
  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const fetchDRE = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/reports/dre`, {
        params: { companyId: selectedCompanyId, year }
      });
      setData(res.data);
    } catch (error) {
      console.error("Erro DRE", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDRE();
  }, [selectedCompanyId, year, apiBase]);

  const getTotal = (field) => data.reduce((acc, curr) => acc + curr[field], 0);
  const f = (v) => v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
  const p = (val, total) => total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '-';

  const rows = [
    { label: '(+) RECEITA BRUTA', field: 'grossRevenue', style: 'text-blue-700 font-bold bg-blue-50/50' },
    { label: '(-) Impostos / Deduções', field: 'deductions', style: 'text-rose-600' },
    { label: '(=) RECEITA LÍQUIDA', field: 'netRevenue', style: 'font-bold bg-gray-100/50 text-slate-800' },
    { label: '(-) Custos Variáveis (CMV)', field: 'variableCosts', style: 'text-amber-600' },
    { label: '(=) MARGEM DE CONTRIBUIÇÃO', field: 'grossProfit', style: 'font-bold bg-gray-100/50 text-slate-800' },
    { label: '(-) Despesas Operacionais', field: 'expenses', style: 'text-slate-500' },
    { label: '(=) RESULTADO LÍQUIDO', field: 'netResult', style: 'font-extrabold text-sm border-t-2 border-slate-200 bg-slate-50' },
  ];

  // Função para exportar CSV nativo
  const handleExport = () => {
    if (data.length === 0) return alert("Sem dados para exportar");
    
    let csv = "Conta;Total Ano;AV %;Jan;Fev;Mar;Abr;Mai;Jun;Jul;Ago;Set;Out;Nov;Dez\n";
    const totalRev = getTotal('grossRevenue');

    rows.forEach(row => {
      const totalVal = getTotal(row.field);
      const av = row.field !== 'grossRevenue' ? p(totalVal, totalRev) : '100%';
      let line = `${row.label};"${f(totalVal)}";${av}`;
      
      data.forEach(m => {
        line += `;"${f(m[row.field])}"`;
      });
      csv += line + "\n";
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `DRE_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedCompanyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><FileText size={48} className="mb-4 opacity-20"/><p>Selecione uma empresa.</p></div>;

  return (
    <div className="p-4 w-full animate-fade-in pb-20">
      
      {/* Header Otimizado */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-emerald-600" size={28} /> DRE Gerencial
          </h1>
          <p className="text-slate-500 text-sm mt-1">Visão contábil detalhada do exercício de {year}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Filtro de Ano */}
          <div className="bg-white border border-slate-200 rounded-xl flex items-center px-3 py-2 shadow-sm h-11">
            <Filter size={16} className="text-slate-400 mr-2"/>
            <select 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))} 
              className="bg-transparent outline-none text-sm font-bold text-slate-700 cursor-pointer"
            >
              {yearsList.map(y => (
                 <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* BOTÃO EXPORTAR ESTILIZADO (DESTAQUE) */}
          <button 
            onClick={handleExport} 
            className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-500 hover:-translate-y-0.5 transition-all shadow-lg shadow-emerald-600/30 h-11"
          >
            <Download size={18}/> 
            <span>Baixar Planilha</span>
          </button>
        </div>
      </div>

      {/* Tabela DRE */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col max-h-[75vh]">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin"></div>
            Calculando resultados...
          </div>
        ) : (
          <div className="overflow-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            <table className="w-full text-xs whitespace-nowrap border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-30 shadow-sm">
                <tr className="text-slate-500 text-left">
                  <th className="p-3 w-64 uppercase tracking-wider font-bold sticky left-0 bg-slate-50 z-20 border-b border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    Estrutura
                  </th>
                  <th className="p-3 text-right min-w-[100px] font-bold bg-slate-100 border-b border-r border-slate-200 text-slate-700">
                    TOTAL ANO
                  </th>
                  <th className="p-3 text-right w-20 font-bold bg-slate-100 border-b border-r border-slate-200 text-emerald-600">
                    A.V. %
                  </th>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <th key={i} className="p-3 text-right font-medium min-w-[100px] border-b border-slate-100">
                      {new Date(0, i).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const totalValue = getTotal(row.field);
                  const totalRevenue = getTotal('grossRevenue');
                  const isResult = row.field === 'netResult';

                  return (
                    <tr key={idx} className={`hover:bg-blue-50/30 transition-colors group ${row.style}`}>
                      {/* Coluna Fixa: Rótulo */}
                      <td className={`py-2.5 px-3 sticky left-0 z-10 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${row.style.includes('bg-') ? row.style.split(' ').find(c => c.startsWith('bg-')) : 'bg-white group-hover:bg-blue-50/30'}`}>
                        {row.label}
                      </td>
                      
                      {/* Coluna Total */}
                      <td className={`py-2.5 px-3 text-right font-mono border-r border-slate-100 bg-slate-50/50 group-hover:bg-blue-50/30 ${isResult ? (totalValue >= 0 ? 'text-emerald-600' : 'text-rose-600') : ''}`}>
                        {f(totalValue)}
                      </td>
                      
                      {/* Coluna A.V. % */}
                      <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-400 border-r border-slate-100 bg-slate-50/50 group-hover:bg-blue-50/30">
                        {row.field !== 'grossRevenue' ? p(totalValue, totalRevenue) : '100%'}
                      </td>

                      {/* Colunas Meses */}
                      {data.map((m, i) => (
                        <td key={i} className={`py-2.5 px-3 text-right font-mono ${isResult ? (m[row.field] >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold') : ''}`}>
                          {m[row.field] !== 0 ? f(m[row.field]) : <span className="text-slate-200 text-[10px]">-</span>}
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
      
      {/* Legenda */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50/50 px-4 py-3 rounded-lg border border-emerald-100 flex items-start gap-3">
            <div className="p-1 bg-emerald-100 rounded text-emerald-600 mt-0.5"><Filter size={14}/></div>
            <div>
              <h4 className="font-bold text-emerald-800 text-xs mb-0.5">Análise Vertical (A.V. %)</h4>
              <p className="text-[11px] text-emerald-700 leading-tight">Percentual que cada custo representa sobre a Receita Bruta Total.</p>
            </div>
        </div>
        <div className="bg-blue-50/50 px-4 py-3 rounded-lg border border-blue-100 flex items-start gap-3">
            <div className="p-1 bg-blue-100 rounded text-blue-600 mt-0.5"><Wallet size={14}/></div>
            <div>
              <h4 className="font-bold text-blue-800 text-xs mb-0.5">Margem de Contribuição</h4>
              <p className="text-[11px] text-blue-700 leading-tight">Receita menos custos variáveis e impostos. É o lucro bruto da operação.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DRE;