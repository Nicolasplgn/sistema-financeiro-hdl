// Histórico de ações: quem fez o quê e quando.
import React, { useEffect, useMemo, useState } from 'react';
import { Filter, History, Search } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Loading, Page, PageHeader } from '../components/ui';

const toneOf = (action = '') => {
  const a = action.toUpperCase();
  if (/DELETE|EXCLU/.test(a)) return 'neg';
  if (/UPDATE|EDIT|PAINEL/.test(a)) return 'warn';
  if (/INSERT|CREATE|CRIAD|IMPORT/.test(a)) return 'pos';
  if (/LOGIN/.test(a)) return 'brand';
  return 'neutral';
};

const AuditLogs = () => {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ start: '', end: '' });
  const [applied, setApplied] = useState({ start: '', end: '' });

  useEffect(() => {
    let alive = true;
    const params = applied.start && applied.end ? { startDate: applied.start, endDate: applied.end } : {};
    http.get('/audit-logs', { params })
      .then((r) => { if (alive) { setLogs(r.data); setError(null); } })
      .catch((e) => alive && setError(errorMessage(e, 'Erro ao carregar o histórico.')));
    return () => { alive = false; };
  }, [applied]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = new Map();
    (logs || [])
      .filter((l) => !q || [l.user_name, l.action, l.details].some((v) => (v || '').toLowerCase().includes(q)))
      .forEach((l) => {
        const raw = new Date(l.timestamp).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const day = raw.charAt(0).toUpperCase() + raw.slice(1);
        if (!out.has(day)) out.set(day, []);
        out.get(day).push(l);
      });
    return [...out.entries()];
  }, [logs, search]);

  return (
    <Page>
      <PageHeader title="Histórico de ações" description="Registro de logins, importações, alterações no painel de preços e exclusões." />
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Buscar" className="flex-1 min-w-[220px]"><Input prefix={<Search size={15} />} placeholder="Usuário, ação ou detalhe…" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
          <Field label="De"><Input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></Field>
          <Field label="Até"><Input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></Field>
          <Button icon={Filter} onClick={() => setApplied(range)} disabled={Boolean(range.start) !== Boolean(range.end)}>Filtrar período</Button>
        </div>
      </Card>
      {error && <Alert tone="error">{error}</Alert>}
      {logs === null ? <Loading /> : groups.length === 0 ? (
        <Card><EmptyState icon={History} title="Nenhum registro" description="Não há ações para este filtro." /></Card>
      ) : groups.map(([day, items]) => (
        <Card key={day} padded={false}>
          <div className="px-4 py-2.5 border-b border-line bg-surface-2 rounded-t-xl text-sm font-medium flex justify-between">
            <span>{day}</span><span className="text-ink-3 text-xs normal-case">{items.length} ações</span>
          </div>
          <ul className="divide-y divide-line">
            {items.map((l) => (
              <li key={l.id} className="px-4 py-2.5 flex flex-wrap items-start gap-x-4 gap-y-1 text-sm">
                <span className="num text-ink-3 w-12 shrink-0">{new Date(l.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="w-40 shrink-0 truncate">{l.user_name || 'Sistema'}</span>
                <Badge tone={toneOf(l.action)}>{l.action}</Badge>
                <span className="flex-1 min-w-[240px] text-ink-2 break-words">{l.details}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </Page>
  );
};

export default AuditLogs;
