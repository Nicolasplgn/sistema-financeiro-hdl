import React from 'react';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ReportTable = ({ reportData, companyName, period }) => {
  if (!reportData) return null;
  const { months, summary } = reportData;
  const showPurchases = summary.totalPurchases > 0;
  const showExpenses = summary.totalExpenses > 0;
  
  // FORMATAÇÃO BRASILEIRA PADRÃO
  const toBRL = (val) => {
    if (val === undefined || val === null) return '-';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const toPct = (val, total) => {
    return total ? ((val / total) * 100).toFixed(2).replace('.', ',') + '%' : '0,00%';
  };

  const formatMonth = (iso) => { 
    const [y, m] = iso.split('-'); 
    return `${m}/${y.slice(2)}`; 
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text(`Relatório: ${companyName}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${period}`, 14, 20);

    doc.autoTable({
        head: [['Mês', 'Faturamento', 'Impostos', 'Compras', 'Despesas', 'Lucro']],
        body: months.map(m => [
            formatMonth(m.monthKey), 
            toBRL(m.totalRevenue), 
            toBRL(m.totalTaxes), 
            showPurchases ? toBRL(m.totalPurchases) : '-', 
            showExpenses ? toBRL(m.totalExpenses) : '-', 
            toBRL(m.profit)
        ]),
        startY: 25,
        theme: 'grid',
        styles: { fontSize: 8, halign: 'right' },
        headStyles: { fillColor: [30, 41, 59], halign: 'center' }, // Cor Slate-800
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } } // Primeira coluna alinhada à esq
    });
    doc.save('relatorio_financeiro.pdf');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-500 uppercase tracking-wide text-sm">Detalhamento Mensal</h3>
          <button onClick={exportPDF} className="flex items-center gap-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition-colors">
            <Download size={14}/> Exportar PDF
          </button>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full text-sm text-right bg-white">
          <thead className="bg-slate-800 text-white uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Mês</th>
              <th className="px-4 py-3 bg-slate-700">Faturamento</th>
              <th className="px-2 py-3">ICMS</th>
              <th className="px-2 py-3">PIS/COF</th>
              <th className="px-2 py-3">ISS</th>
              <th className="px-2 py-3">IRPJ/CSLL</th>
              <th className="px-2 py-3 bg-slate-100 text-slate-900 border-l border-slate-300 font-bold">Total Imp.</th>
              {showPurchases && <th className="px-4 py-3 text-red-200 bg-slate-700">Compras</th>}
              {showExpenses && <th className="px-4 py-3 text-red-200 bg-slate-700">Despesas</th>}
              <th className="px-4 py-3 bg-yellow-500 text-yellow-900 font-bold">Lucro Líquido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {months.map((r) => (
              <tr key={r.monthKey} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-left font-bold text-slate-700">{formatMonth(r.monthKey)}</td>
                <td className="px-4 py-2.5 font-bold text-slate-800 bg-slate-50/50">{toBRL(r.totalRevenue)}</td>
                <td className="px-2 py-2.5 text-xs text-slate-500">{toBRL(r.tax_icms + r.tax_difal)}</td>
                <td className="px-2 py-2.5 text-xs text-slate-500">{toBRL(r.tax_pis + r.tax_cofins)}</td>
                <td className="px-2 py-2.5 text-xs text-slate-500">{toBRL(r.tax_iss)}</td>
                <td className="px-2 py-2.5 text-xs text-slate-500">{toBRL(r.tax_irpj + r.tax_csll + r.tax_additional_irpj)}</td>
                <td className="px-2 py-2.5 font-bold text-red-600 bg-red-50 border-l border-red-100">{toBRL(r.totalTaxes)}</td>
                {showPurchases && <td className="px-4 py-2.5 text-red-500">{toBRL(r.totalPurchases)}</td>}
                {showExpenses && <td className="px-4 py-2.5 text-red-500">{toBRL(r.totalExpenses)}</td>}
                <td className={`px-4 py-2.5 font-bold border-l-2 ${r.profit >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-500' : 'text-red-600 bg-red-50 border-red-500'}`}>
                    {toBRL(r.profit)}
                </td>
              </tr>
            ))}
            {/* LINHA DE TOTAIS */}
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
              <td className="px-4 py-3 text-left">TOTAL</td>
              <td className="px-4 py-3">{toBRL(summary.totalRevenue)}</td>
              <td className="px-2 py-3 text-xs opacity-50">-</td>
              <td className="px-2 py-3 text-xs opacity-50">-</td>
              <td className="px-2 py-3 text-xs opacity-50">-</td>
              <td className="px-2 py-3 text-xs opacity-50">-</td>
              <td className="px-2 py-3 text-red-700 bg-red-100 border-l border-red-200">{toBRL(summary.totalTaxes)}</td>
              {showPurchases && <td className="px-4 py-3 text-red-700">{toBRL(summary.totalPurchases)}</td>}
              {showExpenses && <td className="px-4 py-3 text-red-700">{toBRL(summary.totalExpenses)}</td>}
              <td className="px-4 py-3 bg-yellow-200 text-yellow-900 border-l-2 border-yellow-400">{toBRL(summary.totalProfit)}</td>
            </tr>
            {/* LINHA DE % */}
            <tr className="bg-white text-[11px] text-slate-500 italic border-t border-slate-200">
              <td className="px-4 py-2 text-left font-semibold">Margem %</td>
              <td className="px-4 py-2">100%</td>
              <td colSpan="4" className="text-center bg-slate-50/50">---</td>
              <td className="px-2 py-2 font-bold text-red-600 bg-red-50 border-l border-red-100">
                  {toPct(summary.totalTaxes, summary.totalRevenue)}
              </td>
              {showPurchases && <td className="px-4 py-2">{toPct(summary.totalPurchases, summary.totalRevenue)}</td>}
              {showExpenses && <td className="px-4 py-2">{toPct(summary.totalExpenses, summary.totalRevenue)}</td>}
              <td className="px-4 py-2 font-bold bg-yellow-50 text-slate-800 border-l-2 border-yellow-200">
                  {toPct(summary.totalProfit, summary.totalRevenue)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ReportTable;