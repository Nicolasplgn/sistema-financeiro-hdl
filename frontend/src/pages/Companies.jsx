// Empresas e grupos: cadastro das empresas (CNPJ, regime) e agrupamentos.
import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Feedback, Field, IconButton, Input, Loading, Modal, Page, PageHeader, Select, Textarea } from '../components/ui';
import { useConfirm } from '../components/ui/useConfirm';
import { REGIME_LABEL } from '../utils/format';

const EMPTY = { id: null, name: '', trade_name: '', tax_id: '', tax_regime: 'SIMPLES', group_id: '' };

const Companies = ({ onSelectCompany, onChanged }) => {
  const [confirm, confirmDialog] = useConfirm();
  const [companies, setCompanies] = useState(null);
  const [groups, setGroups] = useState([]);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [groupForm, setGroupForm] = useState(null);
  const [lookup, setLookup] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([http.get('/companies'), http.get('/groups')])
      .then(([c, g]) => { if (alive) { setCompanies(c.data); setGroups(g.data); } })
      .catch((e) => alive && setFeedback({ tone: 'error', text: errorMessage(e, 'Erro ao carregar as empresas.') }));
    return () => { alive = false; };
  }, [version]);

  const refresh = () => { setVersion((v) => v + 1); onChanged?.(); };
  const groupName = (id) => groups.find((g) => g.id === Number(id))?.name;

  const filtered = useMemo(() => (companies || []).filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || [c.name, c.trade_name, c.tax_id, groupName(c.group_id)].some((v) => (v || '').toLowerCase().includes(q));
  }), [companies, groups, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const lookupCnpj = async () => {
    const cnpj = form.tax_id.replace(/\D/g, '');
    if (cnpj.length !== 14) { setFeedback({ tone: 'warning', text: 'Digite os 14 números do CNPJ para buscar.' }); return; }
    setLookup(true);
    try {
      const res = await http.get(`/utils/cnpj/${cnpj}`);
      setForm((f) => ({ ...f, name: res.data.name, trade_name: res.data.tradeName || res.data.name, tax_regime: res.data.taxRegime || f.tax_regime }));
    } catch { setFeedback({ tone: 'warning', text: 'Não foi possível consultar este CNPJ. Preencha os dados à mão.' }); }
    finally { setLookup(false); }
  };

  const saveCompany = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, group_id: form.group_id || null };
      if (form.id) await http.put(`/companies/${form.id}`, payload);
      else await http.post('/companies', payload);
      setForm(null);
      refresh();
      setFeedback({ tone: 'success', text: `Empresa “${form.trade_name || form.name}” salva.` });
    } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao salvar a empresa.') }); }
  };

  const deleteCompany = async (c) => {
    const ok = await confirm({
      title: `Excluir “${c.trade_name || c.name}”?`,
      description: 'Todos os dados ligados a esta empresa serão apagados: lançamentos, DRE, planilha de preços, parceiros e metas. Não pode ser desfeito.',
      confirmLabel: 'Excluir empresa', danger: true,
    });
    if (!ok) return;
    try { await http.delete(`/companies/${c.id}`); refresh(); } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao excluir a empresa.') }); }
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    try { await http.post('/groups', groupForm); setGroupForm(null); refresh(); } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao criar o grupo.') }); }
  };

  const deleteGroup = async (g) => {
    const ok = await confirm({ title: `Excluir o grupo “${g.name}”?`, description: 'As empresas do grupo continuam cadastradas, só ficam sem grupo.', confirmLabel: 'Excluir grupo', danger: true });
    if (!ok) return;
    try { await http.delete(`/groups/${g.id}`); refresh(); } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao excluir o grupo.') }); }
  };

  return (
    <Page>
      {confirmDialog}
      <PageHeader
        title="Empresas e grupos"
        description="Cada empresa tem seus lançamentos, DRE e planilha de preços. O regime tributário define qual custo a ficha técnica usa (Lucro Real, Presumido ou Simples). Grupos somam empresas na Visão geral."
        actions={<><Button icon={Layers} onClick={() => setGroupForm({ name: '', description: '' })}>Novo grupo</Button><Button variant="primary" icon={Plus} onClick={() => setForm({ ...EMPTY })}>Nova empresa</Button></>}
      />
      <Feedback value={feedback} onClose={() => setFeedback(null)} />

      {companies === null ? <Loading /> : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card padded={false}>
            <div className="p-4 border-b border-line">
              <Input prefix={<Search size={15} />} placeholder="Buscar por nome, CNPJ ou grupo…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {filtered.length === 0 ? (
              <EmptyState icon={Building2} title={companies.length ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'} description={companies.length ? 'Tente outra busca.' : 'Cadastre a primeira empresa para começar.'} />
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-surface-2">
                    <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0"><Building2 size={17} /></div>
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-medium text-ink">{c.trade_name || c.name}</p>
                      <p className="text-xs text-ink-3">{c.name !== c.trade_name && c.trade_name ? `${c.name} · ` : ''}CNPJ {c.tax_id || '—'}</p>
                    </div>
                    <Badge tone="brand">{REGIME_LABEL[c.tax_regime] || c.tax_regime || 'Sem regime'}</Badge>
                    {groupName(c.group_id) && <Badge><Layers size={12} /> {groupName(c.group_id)}</Badge>}
                    <div className="flex items-center gap-1">
                      <Button size="sm" onClick={() => onSelectCompany(c)}>Abrir</Button>
                      <IconButton icon={Pencil} label={`Editar ${c.name}`} onClick={() => setForm({ ...EMPTY, ...c, group_id: c.group_id || '' })} />
                      <IconButton icon={Trash2} variant="danger" label={`Excluir ${c.name}`} onClick={() => deleteCompany(c)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Grupos" description="Para ver várias empresas somadas." />
            {groups.length === 0 ? <p className="text-sm text-ink-3">Nenhum grupo criado.</p> : (
              <ul className="space-y-2">
                {groups.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-line">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <p className="text-xs text-ink-3">{(companies || []).filter((c) => Number(c.group_id) === g.id).length} empresa(s)</p>
                    </div>
                    <IconButton size="sm" icon={Trash2} variant="danger" label={`Excluir grupo ${g.name}`} onClick={() => deleteGroup(g)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar empresa' : 'Nova empresa'}
        footer={<><Button onClick={() => setForm(null)}>Cancelar</Button><Button variant="primary" type="submit" form="form-empresa">Salvar</Button></>}
      >
        {form && (
          <form id="form-empresa" onSubmit={saveCompany} className="space-y-4">
            <Field label="CNPJ" hint="Digite e clique em Buscar para preencher a razão social e o regime pela Receita.">
              <div className="flex gap-2">
                <Input required value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="00.000.000/0000-00" />
                <Button icon={Search} loading={lookup} onClick={lookupCnpj}>Buscar</Button>
              </div>
            </Field>
            <Field label="Razão social"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Nome fantasia" hint="Nome curto que aparece no seletor de empresa."><Input value={form.trade_name || ''} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Regime tributário">
                <Select value={form.tax_regime || 'SIMPLES'} onChange={(e) => setForm({ ...form, tax_regime: e.target.value })}>
                  {Object.entries(REGIME_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Grupo">
                <Select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
                  <option value="">Nenhum</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </Field>
            </div>
            {form.id && <Alert tone="info">Mudar o regime muda o custo usado na planilha de preços desta empresa.</Alert>}
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(groupForm)}
        onClose={() => setGroupForm(null)}
        title="Novo grupo"
        size="sm"
        footer={<><Button onClick={() => setGroupForm(null)}>Cancelar</Button><Button variant="primary" type="submit" form="form-grupo">Criar grupo</Button></>}
      >
        {groupForm && (
          <form id="form-grupo" onSubmit={saveGroup} className="space-y-4">
            <Field label="Nome do grupo"><Input required autoFocus value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Ex.: Grupo Vector" /></Field>
            <Field label="Descrição (opcional)"><Textarea value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} /></Field>
            <p className="text-xs text-ink-3">Depois, edite cada empresa e escolha este grupo.</p>
          </form>
        )}
      </Modal>
    </Page>
  );
};

export default Companies;
