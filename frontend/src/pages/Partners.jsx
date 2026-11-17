// Clientes e fornecedores da empresa (usados no detalhamento dos lançamentos).
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Users } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Badge, Button, Card, EmptyState, Feedback, Field, IconButton, Input, Loading, Modal, Page, PageHeader, Tabs } from '../components/ui';
import { useConfirm } from '../components/ui/useConfirm';

const TYPE_LABEL = { CLIENT: 'Cliente', SUPPLIER: 'Fornecedor', BOTH: 'Cliente e fornecedor' };
const EMPTY = { name: '', tax_id: '', type: 'CLIENT', phone: '', email: '' };

const formatDoc = (d) => {
  const n = String(d || '').replace(/\D/g, '');
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return d || '—';
};

const Partners = ({ companyId }) => {
  const [confirm, confirmDialog] = useConfirm();
  const [partners, setPartners] = useState(null);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [form, setForm] = useState(null);
  const [lookup, setLookup] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let alive = true;
    http.get(`/partners/${companyId}`)
      .then((r) => alive && setPartners({ companyId, list: r.data }))
      .catch((e) => alive && setFeedback({ tone: 'error', text: errorMessage(e, 'Erro ao carregar os parceiros.') }));
    return () => { alive = false; };
  }, [companyId, version]);

  const list = useMemo(() => (partners?.list || []).filter((p) => {
    const q = search.trim().toLowerCase();
    return (filter === 'ALL' || p.type === filter || p.type === 'BOTH')
      && (!q || p.name.toLowerCase().includes(q) || String(p.tax_id || '').includes(q.replace(/\D/g, '') || q));
  }), [partners, search, filter]);

  const lookupCnpj = async () => {
    const doc = form.tax_id.replace(/\D/g, '');
    if (doc.length !== 14) { setFeedback({ tone: 'warning', text: 'A busca automática funciona só com CNPJ (14 números). CPF é preenchido à mão.' }); return; }
    setLookup(true);
    try { const r = await http.get(`/utils/cnpj/${doc}`); setForm((f) => ({ ...f, tax_id: doc, name: r.data.name })); }
    catch { setFeedback({ tone: 'warning', text: 'Não foi possível consultar este CNPJ. Preencha à mão.' }); }
    finally { setLookup(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      await http.post('/partners', { ...form, tax_id: form.tax_id.replace(/\D/g, ''), company_id: companyId });
      setForm(null);
      setVersion((v) => v + 1);
      setFeedback({ tone: 'success', text: `${TYPE_LABEL[form.type]} “${form.name}” cadastrado.` });
    } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao salvar.') }); }
  };

  const remove = async (p) => {
    if (!(await confirm({ title: `Excluir “${p.name}”?`, description: 'Os lançamentos já feitos com este parceiro continuam, mas ficam sem o nome dele.', confirmLabel: 'Excluir', danger: true }))) return;
    try { await http.delete(`/partners/${p.id}`); setVersion((v) => v + 1); } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao excluir.') }); }
  };

  return (
    <Page>
      {confirmDialog}
      <PageHeader
        title="Clientes e fornecedores"
        description="Cadastre quem compra e quem vende para a empresa. Eles aparecem no detalhamento dos lançamentos e no ranking da visão geral."
        actions={<Button variant="primary" icon={Plus} onClick={() => setForm({ ...EMPTY })}>Novo cadastro</Button>}
      />
      <Feedback value={feedback} onClose={() => setFeedback(null)} />

      <Card padded={false}>
        <div className="p-4 border-b border-line flex flex-wrap gap-3 items-center">
          <Input prefix={<Search size={15} />} placeholder="Buscar por nome ou documento…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[220px]" />
          <Tabs value={filter} onChange={setFilter} items={[{ id: 'ALL', label: 'Todos' }, { id: 'CLIENT', label: 'Clientes' }, { id: 'SUPPLIER', label: 'Fornecedores' }]} />
        </div>
        {!partners || partners.companyId !== companyId ? <Loading /> : list.length === 0 ? (
          <EmptyState icon={Users} title={partners.list.length ? 'Nada encontrado' : 'Nenhum cadastro ainda'} description={partners.list.length ? 'Tente outra busca ou filtro.' : 'Cadastre os principais clientes e fornecedores.'} />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-ink-2">
                <tr><th className="text-left font-medium px-4 py-2.5">Nome</th><th className="text-left font-medium px-4 py-2.5">Tipo</th><th className="text-left font-medium px-4 py-2.5">CPF / CNPJ</th><th className="text-left font-medium px-4 py-2.5">Contato</th><th className="w-12" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5"><Badge tone={p.type === 'CLIENT' ? 'pos' : p.type === 'SUPPLIER' ? 'warn' : 'brand'}>{TYPE_LABEL[p.type] || p.type}</Badge></td>
                    <td className="px-4 py-2.5 num text-ink-2">{formatDoc(p.tax_id)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{[p.email, p.phone].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-2"><IconButton size="sm" variant="danger" icon={Trash2} label={`Excluir ${p.name}`} onClick={() => remove(p)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title="Novo cliente ou fornecedor"
        footer={<><Button onClick={() => setForm(null)}>Cancelar</Button><Button variant="primary" type="submit" form="form-parceiro">Salvar</Button></>}
      >
        {form && (
          <form id="form-parceiro" onSubmit={save} className="space-y-4">
            <Field label="Tipo">
              <Tabs value={form.type} onChange={(type) => setForm({ ...form, type })} items={[{ id: 'CLIENT', label: 'Cliente' }, { id: 'SUPPLIER', label: 'Fornecedor' }, { id: 'BOTH', label: 'Os dois' }]} />
            </Field>
            <Field label="CPF ou CNPJ" hint="Com CNPJ, clique em Buscar para preencher o nome pela Receita.">
              <div className="flex gap-2">
                <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="Somente números" />
                <Button icon={Search} loading={lookup} onClick={lookupCnpj}>Buscar</Button>
              </div>
            </Field>
            <Field label="Nome / razão social"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
          </form>
        )}
      </Modal>
    </Page>
  );
};

export default Partners;
