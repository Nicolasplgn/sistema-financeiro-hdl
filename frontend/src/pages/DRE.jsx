// DRE gerencial: uma linha por conta do resultado e uma coluna por mês.
import React, { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Alert, Button, Card, Loading, Page, PageHeader, Select } from '../components/ui';
import { SheetFrame } from '../components/ui/sheet';
import { money, MONTHS_SHORT, pct } from '../utils/format';

// sign: como a linha entra no resultado; total: linha de subtotal
const ROWS = [
  { id: 'grossRevenue', label: '1. Receita operacional bruta', total: true },
  { id: 'deductions', label: '(−) Impostos e deduções', sign: -1, hint: 'ICMS/DAS, PIS, COFINS, ISS, IRPJ, CSLL, DIFAL…' },
  { id: 'netRevenue', label: '2. Receita líquida', total: true },
  { id: 'variableCosts', label: '(−) Custos variáveis (compras / CMV)', sign: -1 },
  { id: 'grossProfit', label: '3. Margem de contribuição', total: true },
  { id: 'expenses', label: '(−) Despesas operacionais', sign: -1 },
  { id: 'netResult', label: '4. Resultado líquido', total: true, result: true },
];

const DRE = ({ companyId, company }) => {
  const [year, setYear] = useState(() => Number(localStorage.getItem('vector_dre_year')) || new Date().getFullYear());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i), []);

  useEffect(() => { localStorage.setItem('vector_dre_year', String(year)); }, [year]);

  useEffect(() => {
    let alive = true;
    http.get('/reports/dre', { params: { companyId, year } })
      .then((r) => { if (alive) { setData({ key: `${companyId}-${year}`, rows: Array.isArray(r.data) ? r.data : [] }); setError(null); } })
      .catch((e) => alive && setError(errorMessage(e, 'Erro ao carregar a DRE.')));
    return () => { alive = false; };
  }, [companyId, year]);

  const rows = useMemo(() => {
    const months = data?.rows ?? [];
    const gross = months.reduce((a, m) => a + Number(m.grossRevenue || 0), 0);
    return ROWS.map((r) => {
      const values = Array.from({ length: 12 }, (_, i) => Number(months[i]?.[r.id] || 0));
      const total = values.reduce((a, b) => a + b, 0);
      return { ...r, values, total, av: gross ? (total / gross) * 100 : null };
    });
  }, [data]);

  const hasData = rows[0]?.values.some((v) => v !== 0) || rows.some((r) => r.total !== 0);

  const exportDetailed = async () => {
    setExporting(true);
    try {
      const res = await http.get('/reports/dre/detailed', { params: { companyId, year } });
      const detailed = res.data || [];
      if (detailed.length === 0) { setError('Não há contas detalhadas para exportar neste ano.'); return; }
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`DRE ${year}`);
      ws.addRow([`DRE analítica ${year} — ${company?.trade_name || company?.name || ''}`]).font = { bold: true, size: 14 };
      ws.addRow([]);
      ws.addRow(['Tipo', 'Código', 'Conta', 'Valor acumulado']).font = { bold: true };
      detailed.forEach((row) => {
        const r = ws.addRow([row.type, row.code, row.desc, row.value]);
        if (row.type === 'S') r.font = { bold: true };
        r.getCell(4).numFmt = '"R$" #,##0.00';
      });
      ws.columns = [{ width: 8 }, { width: 16 }, { width: 60 }, { width: 20 }];
      saveAs(new Blob([await wb.xlsx.writeBuffer()]), `DRE_analitica_${year}.xlsx`);
    } catch (e) {
      setError(errorMessage(e, 'Erro ao gerar a DRE analítica.'));
    } finally { setExporting(false); }
  };

  return (
    <Page wide>
      <PageHeader
        title="DRE gerencial"
        description="Demonstração do resultado do exercício. Vem dos lançamentos de cada mês (digitados ou importados da contabilidade). AV% = quanto cada linha representa da receita bruta."
        actions={(
          <>
            <Select aria-label="Ano" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-36">
              {years.map((y) => <option key={y} value={y}>Exercício {y}</option>)}
            </Select>
            <Button icon={Download} loading={exporting} onClick={exportDetailed}>Exportar analítica (Excel)</Button>
          </>
        )}
      />
      {error && <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>}

      {!data || data.key !== `${companyId}-${year}` ? <Loading label="Calculando a DRE…" /> : (
        <Card padded={false}>
          {!hasData && <Alert tone="info" className="m-5 mb-0">Nenhum lançamento em {year}. Registre os meses em “Lançamentos do mês” ou importe a DRE/balancetes.</Alert>}
          <SheetFrame className="p-5">
            <table className="sheet min-w-[1400px]">
              <thead>
                <tr>
                  <th className="text-left sticky-col min-w-[280px]">Conta</th>
                  {MONTHS_SHORT.map((m) => <th key={m} className="text-right min-w-[92px]">{m}/{String(year).slice(2)}</th>)}
                  <th className="text-right min-w-[120px]">Total do ano</th>
                  <th className="text-right min-w-[70px]">AV%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.total ? 'total' : undefined}>
                    <td className="cell sticky-col bg-surface" title={r.hint}>{r.label}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className={`cell text-right num ${r.result ? (v >= 0 ? 'text-pos' : 'text-neg') : r.sign ? 'text-ink-2' : ''}`}>{v === 0 ? '—' : money(r.sign ? -v : v)}</td>
                    ))}
                    <td className={`cell text-right num font-semibold ${r.result ? (r.total >= 0 ? 'text-pos' : 'text-neg') : ''}`}>{money(r.sign ? -r.total : r.total)}</td>
                    <td className="cell text-right num text-ink-2">{pct(r.av, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SheetFrame>
        </Card>
      )}
    </Page>
  );
};

export default DRE;
