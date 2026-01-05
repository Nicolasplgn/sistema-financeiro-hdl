import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, Download, Calendar, ChevronRight, ArrowRight, ScrollText
} from 'lucide-react';
import { motion } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const DRE = ({ apiBase, selectedCompanyId }) => {
  // CONFIGURAÇÕES DE ESTADO
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // GERAÇÃO DA LISTA DE ANOS (5 ANOS DE JANELA)
  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 5 }, (valor, index) => currentYear - 2 + index);

  // ESTRUTURA DO RELATÓRIO (LINHAS)
  const reportRows = [
    { id: 'grossRevenue', label: '1. Receita Operacional Bruta', color: 'text-blue-600', bold: true },
    { id: 'deductions', label: '(-) Impostos e Deduções', color: 'text-rose-500' },
    { id: 'netRevenue', label: '2. Receita Líquida', color: 'text-slate-900', bg: 'bg-slate-50', bold: true },
    { id: 'variableCosts', label: '(-) Custos Variáveis (CMV/CSV)', color: 'text-rose-500' },
    { id: 'grossProfit', label: '3. Margem de Contribuição', color: 'text-slate-900', bg: 'bg-slate-100', bold: true },
    { id: 'expenses', label: '(-) Despesas Operacionais', color: 'text-rose-500' },
    { id: 'netResult', label: '4. Resultado Líquido (EBITDA)', color: 'text-emerald-600', bold: true, bg: 'bg-emerald-50' },
  ];

  // BUSCA DE DADOS NO BACKEND
  const fetchDRE = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const response = await axios.get(`${apiBase}/api/reports/dre`, {
        params: { companyId: selectedCompanyId, year: year }
      });
      setData(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Erro ao buscar relatório DRE:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDRE();
  }, [selectedCompanyId, year, apiBase]);

  // FUNÇÕES AUXILIARES DE CÁLCULO E FORMATAÇÃO
  const formatBRL = (val) => {
    const num = Number(val);
    if (isNaN(num) || num === 0) return '-';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const calculateTotal = (field) => data.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
  const totalGrossRevenue = calculateTotal('grossRevenue');

  const calculateAV = (val, total) => {
      if (!total || total === 0) return '0.0%';
      return ((val / total) * 100).toFixed(1) + '%';
  };

  // EXPORTAÇÃO EXCEL DETALHADA
  const handleExportDetailed = async () => {
    if (!selectedCompanyId) return;
    setExporting(true);
    
    try {
        const response = await axios.get(`${apiBase}/api/reports/dre/detailed`, {
            params: { companyId: selectedCompanyId, year: year }
        });
        
        const detailedData = response.data || [];
        if (detailedData.length === 0) return alert("Sem dados para exportar.");

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`DRE Analítica ${year}`);
        
        sheet.mergeCells('A1:D2');
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'VECTOR CONNECT | DRE ANALÍTICA DETALHADA';
        titleCell.font = { name: 'Arial Black', size: 14, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        sheet.getRow(4).values = ['TIPO', 'CÓDIGO', 'DESCRIÇÃO DA CONTA', 'VALOR ACUMULADO'];
        const header = sheet.getRow(4);
        header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        header.eachCell(cell => { 
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
            cell.alignment = { horizontal: 'center' };
        });

        detailedData.forEach(row => {
            const r = sheet.addRow([row.type, row.code, row.desc, row.value]);
            if (row.type === 'S') {
                r.font = { bold: true };
                r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            }
            if (row.value < 0) {
                r.getCell(4).font = { color: { argb: 'FFFF0000' }, bold: row.type === 'S' };
            } else if (row.type === 'S' && row.value > 0) {
                r.getCell(4).font = { color: { argb: 'FF10B981' }, bold: true };
            }
            r.getCell(4).numFmt = '"R$" #,##0.00';
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(2).alignment = { horizontal: 'center' };
        });

        sheet.getColumn(1).width = 10;
        sheet.getColumn(2).width = 15;
        sheet.getColumn(3).width = 60;
        sheet.getColumn(4).width = 25;

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `DRE_Analitica_Vector_${year}.xlsx`);

    } catch (error) {
        console.error("Erro exportação:", error);
        alert("Erro ao gerar relatório detalhado.");
    } finally {
        setExporting(false);
    }
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
    <div className="p-8 max-w-[1600px] mx-auto animate-in fade-in pb-20">
      
      {/* HEADER DO RELATÓRIO */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
        <div>
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
            onClick={handleExportDetailed} 
            disabled={exporting}
            className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50"
          >
            {exporting ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/> : <Download size={18}/>}
            Exportar Excel
          </button>
        </div>
      </div>

      {/* AVISO DE SCROLL (PARA MONITOR MENOR) */}
      <div className="flex items-center justify-end gap-2 text-slate-400 mb-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
         <ScrollText size={14}/> Role para o lado para ver o ano completo <ArrowRight size={14}/>
      </div>

      {/* TABELA DRE COM SCROLL TITAN */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col relative">
        {loading ? (
          <div className="p-24 text-center text-slate-400 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="font-black text-[10px] uppercase tracking-widest">Calculando Resultados...</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar pb-6">
            {/* Largura mínima grande para forçar scroll horizontal quando necessário */}
            <table className="w-full text-left border-collapse min-w-[2400px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {/* COLUNA CONGELADA (STICKY) */}
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-30 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] w-80 border-r border-slate-200">
                    Estrutura de Contas
                  </th>
                  {Array.from({ length: 12 }).map((valorMes, indexMes) => (
                    <th key={indexMes} className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[140px]">
                      {new Date(0, indexMes).toLocaleDateString('pt-BR', { month: 'short' })}.
                    </th>
                  ))}
                  <th className="p-6 text-right text-[10px] font-black text-slate-900 uppercase tracking-widest bg-slate-100/50 border-l border-slate-200 min-w-[160px]">
                    Total Ano
                  </th>
                  <th className="p-6 text-right text-[10px] font-black text-blue-600 uppercase tracking-widest min-w-[100px]">
                    AV %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {reportRows.map((row) => {
                  const rowTotal = calculateTotal(row.id);
                  const av = totalGrossRevenue > 0 ? (rowTotal / totalGrossRevenue) * 100 : 0;

                  return (
                    <tr key={row.id} className={`group hover:bg-blue-50/10 transition-colors ${row.bg || ''}`}>
                      {/* COLUNA CONGELADA (STICKY) */}
                      <td className={`p-6 sticky left-0 z-20 border-r border-slate-100 ${row.bg || 'bg-white group-hover:bg-blue-50/10'} font-black text-slate-700 uppercase tracking-tight flex items-center gap-3 h-full shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]`}>
                        {row.bold ? <ChevronRight size={14} className="text-emerald-500 shrink-0"/> : <div className="w-3.5"/>}
                        <span className={row.color}>{row.label}</span>
                      </td>
                      
                      {/* 12 MESES */}
                      {data.map((monthData, idx) => (
                        <td key={idx} className={`p-6 text-right font-mono font-bold ${row.color} opacity-90 text-sm`}>
                          {formatBRL(monthData[row.id])}
                        </td>
                      ))}
                      
                      {/* Preenche meses vazios caso o banco não retorne todos */}
                      {Array.from({length: 12 - data.length}).map((_, i) => <td key={`empty-${i}`} className="p-6 text-right text-slate-300">-</td>)}

                      {/* TOTAIS */}
                      <td className="p-6 text-right font-mono font-black text-slate-900 bg-slate-50/50 border-l border-slate-100 text-sm">
                         {formatBRL(rowTotal)}
                      </td>
                      <td className="p-6 text-right font-mono font-bold text-blue-600 text-sm">
                         {av.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSS CUSTOMIZADO PARA A BARRA DE ROLAGEM TITAN */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Barra de fundo (Track) */
        .custom-scrollbar::-webkit-scrollbar { 
            height: 18px; /* Altura maior para facilitar o clique */
        }
        .custom-scrollbar::-webkit-scrollbar-track { 
            background: #e2e8f0; 
            border-radius: 9px; 
            margin: 0 4px; /* Margem lateral para não colar */
        }
        /* Botão de arrastar (Thumb) - COR ESCURA (BLACK PREMIUM) */
        .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: #1e293b; /* Slate-800: Escuro e visível */
            border-radius: 9px; 
            border: 4px solid #e2e8f0; /* Borda cria efeito de pílula flutuante */
        }
        /* Hover no botão */
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
            background: #0f172a; /* Slate-900: Quase preto no hover */
            cursor: pointer;
        }
      `}} />
    </div>
  );
};

export default DRE;