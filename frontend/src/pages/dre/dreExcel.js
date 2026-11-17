// Exporta a DRE para Excel com fórmulas: grupos somam as linhas filhas,
// subtotais referenciam as linhas de cima e totais/AV% são calculados na planilha.
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { MONTHS_SHORT, REGIME_LABEL } from '../../utils/format';
import { SUBTOTAL_FORMULAS } from './dreModel';

const ACCOUNTING = '#,##0.00;(#,##0.00);"–"';
const PERCENT = '0.0%;(0.0%);"–"';
const col = (n) => {
  let s = '';
  let x = n;
  while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26); }
  return s;
};

export async function exportDreExcel({ data, avBase }) {
  const { empresa, ano, atual } = data;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vector Connect';
  wb.created = new Date();

  // ------------------------------------------------------------------ DRE
  const ws = wb.addWorksheet(`DRE ${ano}`, { views: [{ state: 'frozen', xSplit: 2, ySplit: 7 }] });
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 52;
  for (let c = 3; c <= 16; c++) ws.getColumn(c).width = 15;

  ws.mergeCells('A1:P1');
  ws.getCell('A1').value = empresa.razao_social || empresa.nome;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.mergeCells('A2:P2');
  ws.getCell('A2').value = `CNPJ ${empresa.cnpj || '—'} · ${REGIME_LABEL[empresa.regime] || empresa.regime}`;
  ws.mergeCells('A3:P3');
  ws.getCell('A3').value = `DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO — 01/01/${ano} a 31/12/${ano}`;
  ws.getCell('A3').font = { bold: true, size: 12 };
  ws.mergeCells('A4:P4');
  ws.getCell('A4').value = `Valores em reais (R$). Estrutura conforme art. 187 da Lei 6.404/76 e CPC 26. AV% sobre a ${avBase === 'receita_liquida' ? 'receita operacional líquida' : 'receita operacional bruta'}.`;
  ws.getCell('A4').font = { italic: true, color: { argb: 'FF64748B' } };

  const headerRow = 7;
  const header = ws.getRow(headerRow);
  header.values = ['Código', 'Descrição', ...MONTHS_SHORT.map((m) => `${m}/${String(ano).slice(2)}`), `Total ${ano}`, 'AV%'];
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { horizontal: 'center', vertical: 'middle' };
  header.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; });
  header.height = 20;

  const rowOf = {};
  const lines = atual.lines;
  lines.forEach((l, i) => { rowOf[l.id] = headerRow + 1 + i; });
  const baseRow = rowOf[avBase];

  lines.forEach((l) => {
    const r = ws.getRow(rowOf[l.id]);
    r.getCell(1).value = l.code;
    r.getCell(2).value = l.kind === 'item' ? `   ${l.label}` : l.label;
    const children = lines.filter((x) => x.parent === l.id);
    for (let m = 0; m < 12; m++) {
      const c = col(3 + m);
      const cell = r.getCell(3 + m);
      if (l.kind === 'group' && children.length) {
        cell.value = { formula: `SUM(${c}${rowOf[children[0].id]}:${c}${rowOf[children[children.length - 1].id]})`, result: l.values[m] };
      } else if (SUBTOTAL_FORMULAS[l.id]) {
        cell.value = { formula: SUBTOTAL_FORMULAS[l.id].map((id) => `${c}${rowOf[id]}`).join('+'), result: l.values[m] };
      } else {
        cell.value = Math.round(l.values[m] * 100) / 100;
      }
      cell.numFmt = ACCOUNTING;
    }
    r.getCell(15).value = { formula: `SUM(C${rowOf[l.id]}:N${rowOf[l.id]})`, result: l.total };
    r.getCell(15).numFmt = ACCOUNTING;
    r.getCell(16).value = { formula: `IF($O$${baseRow}=0,0,O${rowOf[l.id]}/$O$${baseRow})` };
    r.getCell(16).numFmt = PERCENT;

    const strong = l.kind !== 'item';
    r.font = { bold: strong, color: { argb: l.kind === 'item' ? 'FF334155' : 'FF0F172A' } };
    if (l.kind === 'subtotal' || l.kind === 'result') {
      r.eachCell({ includeEmpty: true }, (c, n) => {
        if (n > 16) return;
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: l.kind === 'result' ? 'FFDCFCE7' : 'FFF1F5F9' } };
        c.border = { top: { style: 'thin', color: { argb: 'FF94A3B8' } } };
      });
    }
    if (l.kind === 'result') r.getCell(2).border = { top: { style: 'thin' }, bottom: { style: 'double' } };
  });

  const last = headerRow + lines.length;
  ws.getRow(last + 2).getCell(2).value = 'Conferência: lucro líquido dos lançamentos';
  ws.getRow(last + 2).getCell(15).value = Math.round(atual.conferencia.lucro_lancamentos * 100) / 100;
  ws.getRow(last + 2).getCell(15).numFmt = ACCOUNTING;
  ws.getRow(last + 3).getCell(2).value = 'Diferença (DRE − lançamentos)';
  ws.getRow(last + 3).getCell(15).value = { formula: `O${rowOf.lucro_liquido}-O${last + 2}` };
  ws.getRow(last + 3).getCell(15).numFmt = ACCOUNTING;

  // ------------------------------------------------------------------ Indicadores (fórmulas sobre a aba DRE)
  const ind = wb.addWorksheet('Indicadores');
  ind.getColumn(1).width = 46;
  ind.getColumn(2).width = 18;
  ind.getColumn(3).width = 60;
  const ref = (id) => `'DRE ${ano}'!O${rowOf[id]}`;
  const rows = [
    ['Indicador', 'Valor', 'Fórmula'],
    ['Margem bruta', { formula: `IF(${ref('receita_liquida')}=0,0,${ref('lucro_bruto')}/${ref('receita_liquida')})` }, 'Lucro bruto ÷ receita líquida', PERCENT],
    ['Margem operacional (EBIT)', { formula: `IF(${ref('receita_liquida')}=0,0,${ref('resultado_operacional')}/${ref('receita_liquida')})` }, 'Resultado operacional ÷ receita líquida', PERCENT],
    ['Margem líquida', { formula: `IF(${ref('receita_liquida')}=0,0,${ref('lucro_liquido')}/${ref('receita_liquida')})` }, 'Lucro líquido ÷ receita líquida', PERCENT],
    ['Carga tributária sobre o faturamento', { formula: `IF(${ref('receita_bruta')}=0,0,-(${ref('deducoes')}+${ref('tributos_lucro')})/${ref('receita_bruta')})` }, '(Deduções + IR/CSLL) ÷ receita bruta', PERCENT],
    ['Despesas operacionais ÷ receita líquida', { formula: `IF(${ref('receita_liquida')}=0,0,-${ref('despesas')}/${ref('receita_liquida')})` }, 'Peso da estrutura sobre a receita', PERCENT],
    ['Margem de contribuição', { formula: `IF(${ref('receita_liquida')}=0,0,(${ref('receita_liquida')}+${ref('custos')})/${ref('receita_liquida')})` }, '(Receita líquida − custo das vendas) ÷ receita líquida', PERCENT],
    ['Ponto de equilíbrio do período (receita líquida)', { formula: `IF(B7=0,0,-(${ref('despesas')}+MIN(${ref('resultado_financeiro')},0))/B7)` }, '(Despesas operacionais + financeiras) ÷ margem de contribuição', ACCOUNTING],
  ];
  rows.forEach((r, i) => {
    const row = ind.getRow(i + 1);
    row.values = r.slice(0, 3);
    if (i === 0) row.font = { bold: true };
    else row.getCell(2).numFmt = r[3];
  });

  // ------------------------------------------------------------------ Analítico por conta
  const an = wb.addWorksheet('Analítico por conta');
  an.columns = [{ width: 36 }, { width: 50 }, ...MONTHS_SHORT.map(() => ({ width: 14 })), { width: 16 }];
  const anHeader = an.addRow(['Linha da DRE', 'Conta', ...MONTHS_SHORT.map((m) => `${m}/${String(ano).slice(2)}`), 'Total']);
  anHeader.font = { bold: true };
  const labelOf = Object.fromEntries(lines.map((l) => [l.id, `${l.code} ${l.label}`]));
  atual.accounts.forEach((a) => {
    const r = an.addRow([labelOf[a.line] || a.line, a.description, ...a.values.map((v) => Math.round(v * 100) / 100)]);
    r.getCell(15).value = { formula: `SUM(C${r.number}:N${r.number})`, result: a.total };
    for (let c = 3; c <= 15; c++) r.getCell(c).numFmt = ACCOUNTING;
  });
  an.views = [{ state: 'frozen', ySplit: 1 }];

  // ------------------------------------------------------------------ Notas
  const notas = wb.addWorksheet('Notas');
  notas.getColumn(1).width = 120;
  [
    'NOTAS EXPLICATIVAS',
    '',
    '1. Fonte dos dados: lançamentos mensais do sistema (digitados ou importados dos balancetes da contabilidade).',
    '2. Deduções da receita: ICMS (ou DAS no Simples Nacional), DIFAL, PIS, COFINS, ISS e FUST/FUNTTEL sobre o faturamento.',
    '3. IRPJ (com adicional) e CSLL são apresentados como provisão sobre o lucro, após o resultado antes dos tributos (LAIR).',
    '4. Despesas operacionais classificadas por natureza a partir das contas do balancete: pessoal, comerciais, administrativas e tributárias.',
    '   Juros, tarifas bancárias, IOF, taxas de cartão e seguros de empréstimo são apresentados no resultado financeiro.',
    '   Meses sem detalhamento por conta aparecem em "Despesas operacionais sem detalhamento".',
    '5. Pagamentos de empréstimos e outras movimentações patrimoniais não transitam pelo resultado.',
    `6. Conferência: o lucro líquido desta DRE é igual ao resultado dos lançamentos (diferença de R$ ${atual.conferencia.diferenca.toFixed(2)}).`,
  ].forEach((t, i) => { const r = notas.getRow(i + 1); r.getCell(1).value = t; if (i === 0) r.font = { bold: true, size: 12 }; });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `DRE_${ano}_${(empresa.nome || 'empresa').replace(/\W+/g, '_')}.xlsx`);
}
