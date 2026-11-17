// Clientes do sistema (somente SUPER_ADMIN): usuários, licenças e acesso às contas.
import React, { useEffect, useMemo, useState } from 'react';
import { LogIn, Pencil, Search, Trash2, UserPlus } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Badge, Button, Card, EmptyState, Feedback, Field, IconButton, Input, Loading, Modal, Page, PageHeader, Select, Stat } from '../components/ui';
import { useConfirm } from '../components/ui/useConfirm';

const ROLE_LABEL = { SUPER_ADMIN: 'Administrador Vector', ADMIN: 'Cliente', MANAGER: 'Gestor', CLIENT: 'Consulta' };
const EMPTY = { full_name: '', email: '', password: '', role: 'ADMIN', max_companies: 1 };

const AdminPanel = ({ onImpersonate }) => {
  const [confirm, confirmDialog] = useConfirm();
  const [users, setUsers] = useState(null);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [createForm, setCreateForm] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let alive = true;
    http.get('/admin/users')
      .then((r) => alive && setUsers(r.data))
      .catch((e) => alive && setFeedback({ tone: 'error', text: errorMessage(e, 'Erro ao carregar os usuários.') }));
    return () => { alive = false; };
  }, [version]);

  const list = useMemo(() => (users || []).filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  }), [users, search]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await http.post('/admin/users', createForm);
      setCreateForm(null);
      setVersion((v) => v + 1);
      setFeedback({ tone: 'success', text: `Usuário ${createForm.email} criado.` });
    } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao criar o usuário.') }); }
  };

  const update = async (e) => {
    e.preventDefault();
    try {
      await http.put(`/admin/users/${editForm.id}`, { role: editForm.role, max_companies: Number(editForm.max_companies), password: editForm.password || undefined });
      setEditForm(null);
      setVersion((v) => v + 1);
      setFeedback({ tone: 'success', text: 'Dados atualizados.' });
    } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao atualizar.') }); }
  };

  const remove = async (u) => {
    if (!(await confirm({ title: `Excluir ${u.full_name}?`, description: 'A pessoa perde o acesso ao sistema. As empresas dela continuam cadastradas.', confirmLabel: 'Excluir usuário', danger: true }))) return;
    try { await http.delete(`/admin/users/${u.id}`); setVersion((v) => v + 1); } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao excluir.') }); }
  };

  const impersonate = async (u) => {
    if (!(await confirm({ title: `Entrar como ${u.full_name}?`, description: 'Você verá o sistema exatamente como este cliente vê. Para voltar, saia e entre de novo com o seu usuário.', confirmLabel: 'Entrar na conta' }))) return;
    try {
      const r = await http.post('/admin/impersonate', { targetUserId: u.id });
      if (r.data.user) onImpersonate(r.data.user, r.data.token);
    } catch (err) { setFeedback({ tone: 'error', text: errorMessage(err, 'Erro ao acessar a conta.') }); }
  };

  return (
    <Page>
      {confirmDialog}
      <PageHeader
        title="Clientes do sistema"
        description="Cada cliente é um usuário que cadastra as próprias empresas, até o limite de licenças."
        actions={<Button variant="primary" icon={UserPlus} onClick={() => setCreateForm({ ...EMPTY })}>Novo cliente</Button>}
      />
      <Feedback value={feedback} onClose={() => setFeedback(null)} />

      {users && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Usuários" value={users.length} />
          <Stat label="Clientes" value={users.filter((u) => u.role !== 'SUPER_ADMIN').length} />
          <Stat label="Empresas cadastradas" value={users.reduce((a, u) => a + Number(u.companies_used || 0), 0)} />
          <Stat label="No limite de licenças" value={users.filter((u) => u.role !== 'SUPER_ADMIN' && Number(u.companies_used) >= Number(u.max_companies)).length} tone="warn" />
        </div>
      )}

      <Card padded={false}>
        <div className="p-4 border-b border-line"><Input prefix={<Search size={15} />} placeholder="Buscar por nome ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {users === null ? <Loading /> : list.length === 0 ? <EmptyState title="Ninguém encontrado" /> : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-surface-2 text-xs text-ink-2">
                <tr><th className="text-left font-medium px-4 py-2.5">Usuário</th><th className="text-left font-medium px-4 py-2.5">Perfil</th><th className="text-left font-medium px-4 py-2.5">Licenças</th><th className="text-left font-medium px-4 py-2.5">Desde</th><th className="w-48" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((u) => {
                  const unlimited = u.role === 'SUPER_ADMIN';
                  const full = !unlimited && Number(u.companies_used) >= Number(u.max_companies);
                  return (
                    <tr key={u.id} className="hover:bg-surface-2">
                      <td className="px-4 py-2.5"><p className="font-medium">{u.full_name}</p><p className="text-xs text-ink-3">{u.email}</p></td>
                      <td className="px-4 py-2.5"><Badge tone={unlimited ? 'neg' : 'neutral'}>{ROLE_LABEL[u.role] || u.role}</Badge></td>
                      <td className="px-4 py-2.5">
                        {unlimited ? <span className="text-ink-3">ilimitado</span> : (
                          <div className="w-32">
                            <p className={`num text-xs ${full ? 'text-neg' : 'text-ink-2'}`}>{u.companies_used} de {u.max_companies} empresas</p>
                            <div className="mt-1 h-1.5 rounded-full bg-surface-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min((u.companies_used / u.max_companies) * 100, 100)}%`, background: full ? 'var(--neg)' : 'var(--pos)' }} /></div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-ink-2 num">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {!unlimited && <Button size="sm" icon={LogIn} onClick={() => impersonate(u)}>Entrar</Button>}
                          <IconButton icon={Pencil} label={`Editar ${u.full_name}`} onClick={() => setEditForm({ ...u, password: '' })} />
                          <IconButton icon={Trash2} variant="danger" label={`Excluir ${u.full_name}`} onClick={() => remove(u)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={Boolean(createForm)} onClose={() => setCreateForm(null)} title="Novo cliente" footer={<><Button onClick={() => setCreateForm(null)}>Cancelar</Button><Button variant="primary" type="submit" form="form-usuario">Criar</Button></>}>
        {createForm && (
          <form id="form-usuario" onSubmit={create} className="space-y-4">
            <Field label="Nome completo"><Input required value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} /></Field>
            <Field label="E-mail de acesso"><Input required type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></Field>
            <Field label="Senha provisória" hint="Combine com o cliente de trocar no primeiro acesso."><Input required value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Perfil">
                <Select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                  <option value="ADMIN">Cliente</option>
                  <option value="SUPER_ADMIN">Administrador Vector</option>
                </Select>
              </Field>
              <Field label="Licenças (empresas)"><Input type="number" min="1" disabled={createForm.role === 'SUPER_ADMIN'} value={createForm.max_companies} onChange={(e) => setCreateForm({ ...createForm, max_companies: e.target.value })} /></Field>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(editForm)} onClose={() => setEditForm(null)} title={editForm ? `Editar ${editForm.full_name}` : ''} size="sm" footer={<><Button onClick={() => setEditForm(null)}>Cancelar</Button><Button variant="primary" type="submit" form="form-editar-usuario">Salvar</Button></>}>
        {editForm && (
          <form id="form-editar-usuario" onSubmit={update} className="space-y-4">
            <Field label="Perfil">
              <Select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Licenças (empresas)" hint={`Usando ${editForm.companies_used}.`}><Input type="number" min="1" value={editForm.max_companies} onChange={(e) => setEditForm({ ...editForm, max_companies: e.target.value })} /></Field>
            <Field label="Nova senha (opcional)"><Input value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Deixe em branco para manter" /></Field>
          </form>
        )}
      </Modal>
    </Page>
  );
};

export default AdminPanel;
