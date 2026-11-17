// Lançamentos do mês: uma "folha" por competência, com receitas, tributos,
// custos e o detalhamento analítico (clientes, fornecedores, categorias).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Pencil, Save, Trash2, Upload } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Badge, Button, Card, CardHeader, Feedback, Field, IconButton, Input, Modal, Page, PageHeader, SheetLegend, Stat, Textarea } from '../components/ui';
import { useConfirm } from '../components/ui/useConfirm';
import { CalcCell, NumberCell, SelectCell, SheetFrame, TextCell } from '../components/ui/sheet';
import ImportModal from '../components/ImportModal';
import { brl, money, monthLabel, pct } from '../utils/format';

const EMPTY = {
  revenue: { resale: 0, product: 0, service: 0, rent: 0, other: 0 },
  taxes: { icms: 0, difal: 0, iss: 0, pis: 0, cofins: 0, irpj: 0, additionalIrpj: 0, csll: 0, fust: 0, funtell: 0 },
  purchasesTotal: 0,
  expensesTotal: 0,
  notes: '',
};

const REVENUE_ROWS = [
  { key: 'resale', label: 'Revenda de mercadorias' },
  { key: 'product', label: 'Venda de produção própria' },
  { key: 'service', label: 'Prestação de serviços' },
  { key: 'rent', label: 'Aluguéis' },
];
const TAX_ROWS = [
  { key: 'icms', label: 'ICMS / DAS (Simples Nacional)' },
  { key: 'difal', label: 'DIFAL' },
  { key: 'iss', label: 'ISS' },
  { key: 'pis', label: 'PIS' },
  { key: 'cofins', label: 'COFINS' },
  { key: 'irpj', label: 'IRPJ' },
  { key: 'additionalIrpj', label: 'Adicional de IRPJ' },
  { key: 'csll', label: 'CSLL' },
  { key: 'fust', label: 'FUST (telecom)' },
  { key: 'funtell', label: 'FUNTTEL (telecom)' },
];

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const shiftMonth = (key, offset) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + offset, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const fromEntry = (d) => ({
  revenue: { resale: +d.revenue_resale || 0, product: +d.revenue_product || 0, service: +d.revenue_service || 0, rent: +d.revenue_rent || 0, other: +d.revenue_other || 0 },
  taxes: { icms: +d.tax_icms || 0, difal: +d.tax_difal || 0, iss: +d.tax_iss || 0, pis: +d.tax_pis || 0, cofins: +d.tax_cofins || 0, irpj: +d.tax_irpj || 0, additionalIrpj: +d.tax_additional_irpj || 0, csll: +d.tax_csll || 0, fust: +d.tax_fust || 0, funtell: +d.tax_funtell || 0 },
  purchasesTotal: +d.purchases_total || 0,
  expensesTotal: +d.expenses_total || 0,
  notes: d.notes || '',
});

const totalsOf = (form) => {
  const operational = REVENUE_ROWS.reduce((a, r) => a + Number(form.revenue[r.key] || 0), 0);
  const other = Number(form.revenue.other || 0);
  const taxes = Object.values(form.taxes).reduce((a, b) => a + Number(b || 0), 0);
  const costs = Number(form.purchasesTotal || 0) + Number(form.expensesTotal || 0);
  const profit = operational + other - taxes - costs;
  return { operational, other, taxes, costs, profit, margin: operational > 0 ? (profit / operational) * 100 : null };
};

const FinancialEntries = ({ companyId }) => {
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('hdl_user')); } catch { return null; } }, []);
  const [confirm, confirmDialog] = useConfirm();
  const [month, setMonth] = useState(thisMonth);
  const [form, setForm] = useState(EMPTY);
  const [details, setDetails] = useState([]);
  const [loadedMonth, setLoadedMonth] = useState(null);
  const [exists, setExists] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState([]);
  const [partners, setPartners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [entryVersion, setEntryVersion] = useState(0);

  // Cadastros de apoio
  useEffect(() => {
    let alive = true;
    Promise.all([http.get(`/partners/${companyId}`), http.get('/categories')])
      .then(([p, c]) => {
        if (!alive) return;
        setPartners(p.data);
        const seen = new Set();
        setCategories(c.data.filter((x) => { const k = `${x.name}|${x.type}`; if (seen.has(k)) return false; seen.add(k); return true; }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [companyId]);

  useEffect(() => {
    let alive = true;
    http.get('/entries/history', { params: { companyId } }).then((r) => alive && setHistory(r.data)).catch(() => {});
    return () => { alive = false; };
  }, [companyId, historyVersion]);

  // Mês aberto
  useEffect(() => {
    let alive = true;
    http.get('/entries', { params: { companyId, month: `${month}-01` } })
      .then((r) => {
        if (!alive) return;
        const d = r.data;
        setForm(d ? fromEntry(d) : EMPTY);
        setDetails(d?.details ? d.details.map((x, i) => ({ ...x, _key: `${x.id ?? i}` })) : []);
        setExists(Boolean(d));
        setDirty(false);
        setLoadedMonth(month);
      })
      .catch((e) => alive && setFeedback({ tone: 'error', text: errorMessage(e, 'Erro ao abrir o mês.') }));
    return () => { alive = false; };
  }, [companyId, month, entryVersion]);

  const totals = useMemo(() => totalsOf(form), [form]);
  const edit = (updater) => { setForm(updater); setDirty(true); };
  const setRevenue = (key, v) => edit((f) => ({ ...f, revenue: { ...f.revenue, [key]: v } }));
  const setTax = (key, v) => edit((f) => ({ ...f, taxes: { ...f.taxes, [key]: v } }));

  const changeMonth = useCallback(async (next) => {
    if (dirty && !(await confirm({ title: 'Sair sem salvar?', description: `As alterações de ${monthLabel(month)} ainda não foram salvas e serão perdidas.`, confirmLabel: 'Sair sem salvar', danger: true }))) return;
    setMonth(next);
  }, [dirty, confirm, month]);

  const save = async () => {
    setSaving(true);
    try {
      await http.post('/entries', {
        companyId, periodStart: `${month}-01`, userId: user?.id, userName: user?.full_name,
        ...form, details: details.map(({ _key, ...d }) => d),
      });
      setDirty(false);
      setExists(true);
      setHistoryVersion((v) => v + 1);
      setFeedback({ tone: 'success', text: `${monthLabel(month)} salvo.` });
    } catch (e) {
      setFeedback({ tone: 'error', text: errorMessage(e, 'Erro ao salvar o mês.') });
    } finally { setSaving(false); }
  };

  const removeMonth = async (periodStart) => {
    const key = periodStart.slice(0, 7);
    if (!(await confirm({ title: `Excluir ${monthLabel(key)}?`, description: 'Apaga os valores e o detalhamento deste mês. A DRE e a visão geral deixam de contar este mês.', confirmLabel: 'Excluir mês', danger: true }))) return;
    try {
      await http.delete('/entries', { params: { companyId, month: periodStart } });
      setHistoryVersion((v) => v + 1);
      if (key === month) { setForm(EMPTY); setDetails([]); setExists(false); setDirty(false); }
      setFeedback({ tone: 'success', text: `${monthLabel(key)} excluído.` });
    } catch (e) { setFeedback({ tone: 'error', text: errorMessage(e, 'Erro ao excluir o mês.') }); }
  };

  const cloneMonth = async () => {
    if (!cloneTarget || cloneTarget === month) return;
    try {
      await http.post('/entries/clone', { companyId, sourceMonth: month, targetMonth: cloneTarget });
      setCloneOpen(false);
      setHistoryVersion((v) => v + 1);
      setFeedback({ tone: 'success', text: `${monthLabel(month)} copiado para ${monthLabel(cloneTarget)}.` });
      setCloneTarget('');
    } catch (e) { setFeedback({ tone: 'error', text: errorMessage(e, 'Erro ao copiar o mês.') }); }
  };

  // Detalhamento analítico
  const editDetail = (key, patch) => { setDetails((ds) => ds.map((d) => (d._key === key ? { ...d, ...patch } : d))); setDirty(true); };
  const addDetail = () => { setDetails((ds) => [...ds, { _key: `n${Date.now()}`, type: 'EXPENSE', category_id: '', partner_id: '', description: '', amount: 0 }]); setDirty(true); };
  const removeDetail = (key) => { setDetails((ds) => ds.filter((d) => d._key !== key)); setDirty(true); };
  const detailsIn = details.filter((d) => d.type === 'REVENUE').reduce((a, d) => a + Number(d.amount || 0), 0);
  const detailsOut = details.filter((d) => d.type !== 'REVENUE').reduce((a, d) => a + Number(d.amount || 0), 0);

  const ready = loadedMonth === month;

  return (
    <Page wide>
      {confirmDialog}
      <PageHeader
        title="Lançamentos do mês"
        description="Cada mês (competência) é uma folha: digite os valores nas células amarelas e clique em Salvar. A DRE e a visão geral são montadas a partir daqui."
        actions={(
          <>
            <div className="flex items-center gap-1">
              <IconButton variant="secondary" icon={ChevronLeft} label="Mês anterior" onClick={() => changeMonth(shiftMonth(month, -1))} />
              <Input type="month" aria-label="Competência" value={month} onChange={(e) => e.target.value && changeMonth(e.target.value)} className="w-44" />
              <IconButton variant="secondary" icon={ChevronRight} label="Próximo mês" onClick={() => changeMonth(shiftMonth(month, 1))} />
            </div>
            <Button icon={Upload} onClick={() => setImportOpen(true)}>Importar da contabilidade</Button>
            <Button icon={Copy} onClick={() => setCloneOpen(true)} disabled={!exists}>Copiar para outro mês</Button>
            <Button variant="primary" icon={Save} loading={saving} onClick={save} disabled={!ready}>Salvar {monthLabel(month)}</Button>
          </>
        )}
      >
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SheetLegend />
          {ready && (exists ? <Badge tone="pos">Mês já lançado</Badge> : <Badge>Mês ainda não lançado</Badge>)}
          {dirty && <Badge tone="warn">Alterações não salvas</Badge>}
        </div>
      </PageHeader>

      <Feedback value={feedback} onClose={() => setFeedback(null)} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Faturamento" value={brl(totals.operational)} hint={totals.other ? `+ ${brl(totals.other)} de outras receitas` : 'Receita operacional'} />
        <Stat label="Tributos" value={brl(totals.taxes)} tone="warn" />
        <Stat label="Compras e despesas" value={brl(totals.costs)} tone="neg" />
        <Stat label="Resultado do mês" value={brl(totals.profit)} tone={totals.profit >= 0 ? 'pos' : 'neg'} hint={totals.margin === null ? 'sem faturamento' : `margem ${pct(totals.margin, 1)}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card padded={false} className="p-5">
          <CardHeader title={`Resultado de ${monthLabel(month)}`} description="Receitas − tributos − compras − despesas." />
          <SheetFrame>
            <table className="sheet">
              <thead><tr><th className="text-left">Conta</th><th className="text-right w-[180px]">Valor (R$)</th></tr></thead>
              <tbody>
                <tr className="group"><td colSpan={2}>Receitas</td></tr>
                {REVENUE_ROWS.map((r) => (
                  <tr key={r.key}><td className="cell">{r.label}</td><NumberCell value={form.revenue[r.key]} label={r.label} min={0} disabled={!ready} onCommit={(v) => setRevenue(r.key, v)} /></tr>
                ))}
                <tr><td className="cell">Faturamento operacional</td><CalcCell value={totals.operational} strong /></tr>
                <tr><td className="cell" title="Receitas fora da atividade principal (financeiras, venda de bens…)">Outras receitas (não operacionais)</td><NumberCell value={form.revenue.other} label="Outras receitas" min={0} disabled={!ready} onCommit={(v) => setRevenue('other', v)} /></tr>

                <tr className="group"><td colSpan={2}>Tributos sobre o faturamento</td></tr>
                {TAX_ROWS.map((r) => (
                  <tr key={r.key}><td className="cell">{r.label}</td><NumberCell value={form.taxes[r.key]} label={r.label} min={0} disabled={!ready} onCommit={(v) => setTax(r.key, v)} /></tr>
                ))}
                <tr><td className="cell">Total de tributos</td><CalcCell value={totals.taxes} strong /></tr>

                <tr className="group"><td colSpan={2}>Custos e despesas</td></tr>
                <tr><td className="cell" title="Mercadorias e matéria-prima compradas (CMV)">Compras diretas</td><NumberCell value={form.purchasesTotal} label="Compras diretas" min={0} disabled={!ready} onCommit={(v) => edit((f) => ({ ...f, purchasesTotal: v }))} /></tr>
                <tr><td className="cell" title="Aluguel, salários, energia, honorários…">Despesas operacionais</td><NumberCell value={form.expensesTotal} label="Despesas operacionais" min={0} disabled={!ready} onCommit={(v) => edit((f) => ({ ...f, expensesTotal: v }))} /></tr>

                <tr className="total"><td className="cell">Resultado do mês</td><td className={`cell text-right num ${totals.profit >= 0 ? 'text-pos' : 'text-neg'}`}>{money(totals.profit)}</td></tr>
              </tbody>
            </table>
          </SheetFrame>
          <Field label="Observações do mês" className="mt-4">
            <Textarea value={form.notes} disabled={!ready} onChange={(e) => edit((f) => ({ ...f, notes: e.target.value }))} placeholder="Informações importantes para o fechamento…" />
          </Field>
        </Card>

        <Card padded={false} className="p-5">
          <CardHeader
            title="Detalhamento analítico"
            description="Opcional: de quem veio e para quem foi o dinheiro. Alimenta o ranking de clientes e fornecedores e as categorias da visão geral."
            actions={<Button size="sm" onClick={addDetail} disabled={!ready}>+ Adicionar linha</Button>}
          />
          <SheetFrame maxHeight="560px">
            <table className="sheet min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left w-[110px]">Tipo</th>
                  <th className="text-left">Categoria</th>
                  <th className="text-left">Cliente / fornecedor</th>
                  <th className="text-left">Histórico</th>
                  <th className="text-right w-[130px]">Valor</th>
                  <th className="w-10" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {details.map((d) => (
                  <tr key={d._key}>
                    <SelectCell value={d.type} label="Tipo" onChange={(v) => editDetail(d._key, { type: v, category_id: '', partner_id: '' })}>
                      <option value="REVENUE">Entrada</option>
                      <option value="EXPENSE">Saída</option>
                    </SelectCell>
                    <SelectCell value={d.category_id ?? ''} label="Categoria" onChange={(v) => editDetail(d._key, { category_id: v })}>
                      <option value="">Escolha…</option>
                      {categories.filter((c) => c.type === d.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </SelectCell>
                    <SelectCell value={d.partner_id ?? ''} label="Cliente ou fornecedor" onChange={(v) => editDetail(d._key, { partner_id: v })}>
                      <option value="">—</option>
                      {partners.filter((p) => (d.type === 'REVENUE' ? p.type !== 'SUPPLIER' : p.type !== 'CLIENT')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </SelectCell>
                    <TextCell value={d.description || ''} label="Histórico" onCommit={(v) => editDetail(d._key, { description: v })} />
                    <NumberCell value={Number(d.amount || 0)} label="Valor" min={0} onCommit={(v) => editDetail(d._key, { amount: v })} />
                    <td className="cell text-center"><IconButton size="sm" variant="danger" icon={Trash2} label="Remover linha" onClick={() => removeDetail(d._key)} /></td>
                  </tr>
                ))}
                {details.length === 0 && <tr><td colSpan={6} className="calc text-center text-ink-3 h-12">Nenhuma linha. Clique em “Adicionar linha”.</td></tr>}
                {details.length > 0 && (
                  <tr className="total">
                    <td className="cell" colSpan={4}>Entradas {brl(detailsIn)} · Saídas {brl(detailsOut)}</td>
                    <td className="cell text-right num">{money(detailsIn - detailsOut)}</td>
                    <td className="cell" />
                  </tr>
                )}
              </tbody>
            </table>
          </SheetFrame>
          <p className="mt-2 text-xs text-ink-3">As linhas são gravadas junto com o mês, no botão Salvar. Cadastre clientes e fornecedores em “Clientes e fornecedores”.</p>
        </Card>
      </div>

      <Card padded={false}>
        <div className="p-5 pb-3"><CardHeader className="mb-0" title="Meses lançados" description="Clique em Abrir para editar um mês." /></div>
        <SheetFrame className="px-5 pb-5">
          <table className="sheet min-w-[640px]">
            <thead>
              <tr><th className="text-left">Competência</th><th className="text-right">Faturamento</th><th className="text-right">Tributos</th><th className="text-right">Compras e despesas</th><th className="text-right">Resultado</th><th className="w-24" aria-label="Ações" /></tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const t = totalsOf(fromEntry(h));
                const key = h.period_start.slice(0, 7);
                return (
                  <tr key={h.id} className={key === month ? 'bg-brand-soft' : undefined}>
                    <td className="cell font-medium">{monthLabel(key)}</td>
                    <td className="cell text-right num">{money(t.operational)}</td>
                    <td className="cell text-right num">{money(t.taxes)}</td>
                    <td className="cell text-right num">{money(t.costs)}</td>
                    <td className={`cell text-right num font-medium ${t.profit >= 0 ? 'text-pos' : 'text-neg'}`}>{money(t.profit)}</td>
                    <td className="cell">
                      <div className="flex justify-end gap-1">
                        <IconButton size="sm" icon={Pencil} label={`Abrir ${monthLabel(key)}`} onClick={() => changeMonth(key)} />
                        <IconButton size="sm" variant="danger" icon={Trash2} label={`Excluir ${monthLabel(key)}`} onClick={() => removeMonth(h.period_start)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 && <tr><td colSpan={6} className="calc text-center text-ink-3 h-12">Nenhum mês lançado ainda.</td></tr>}
            </tbody>
          </table>
        </SheetFrame>
      </Card>

      <Modal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        title="Copiar mês"
        description={`Copia os valores e o detalhamento de ${monthLabel(month)} para outro mês. Útil quando os meses se repetem.`}
        size="sm"
        footer={<><Button onClick={() => setCloneOpen(false)}>Cancelar</Button><Button variant="primary" onClick={cloneMonth} disabled={!cloneTarget || cloneTarget === month}>Copiar</Button></>}
      >
        <Field label="Copiar para" hint={cloneTarget === month ? 'Escolha um mês diferente do atual.' : undefined}>
          <Input type="month" value={cloneTarget} onChange={(e) => setCloneTarget(e.target.value)} />
        </Field>
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        companyId={companyId}
        onSuccess={() => {
          setHistoryVersion((v) => v + 1);
          setEntryVersion((v) => v + 1);
        }}
      />
    </Page>
  );
};

export default FinancialEntries;
