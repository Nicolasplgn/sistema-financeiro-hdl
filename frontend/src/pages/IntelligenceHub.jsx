// Saúde financeira: nota do último mês, meta anual, previsão e alertas.
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileText, History, Lightbulb, RefreshCw, Target, Trash2, CloudUpload } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Alert, Button, Card, CardHeader, Field, Input, Loading, Modal, Page, PageHeader, Select, Stat } from '../components/ui';
import { brl, pct, toNumber } from '../utils/format';

/** Nota de 0 a 100: começa em 50, sobe com margem boa e crescimento, cai com prejuízo. */
const scoreOf = (realized) => {
  if (!realized?.length) return null;
  const last = realized[realized.length - 1];
  const rev = Number(last.revenue) || 0;
  const margin = rev > 0 ? ((rev - Number(last.costs || 0) - Number(last.taxes || 0)) / rev) * 100 : 0;
  let s = 50;
  if (margin > 25) s += 30; else if (margin > 10) s += 15; else if (margin < 0) s -= 30;
  if (realized.length > 1 && rev > Number(realized[realized.length - 2].revenue)) s += 20;
  return { score: Math.min(Math.max(s, 0), 100), margin, grew: realized.length > 1 && rev > Number(realized[realized.length - 2].revenue) };
};

const ScoreGauge = ({ score }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score > 70 ? 'var(--pos)' : score > 40 ? 'var(--brand)' : 'var(--neg)';
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0" role="img" aria-label={`Nota ${score} de 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fontSize="28" fontWeight="600" fill="var(--ink)">{score}</text>
      <text x="60" y="78" textAnchor="middle" fontSize="11" fill="var(--ink-3)">de 100</text>
    </svg>
  );
};

const IntelligenceHub = ({ companyId, onNavigate }) => {
  const [year, setYear] = useState(() => Number(localStorage.getItem('vector_bi_year')) || new Date().getFullYear());
  const [data, setData] = useState(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [saving, setSaving] = useState(false);
  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i), []);

  useEffect(() => { localStorage.setItem('vector_bi_year', String(year)); }, [year]);

  useEffect(() => {
    let alive = true;
    http.get(`/intelligence/${companyId}/${year}`)
      .then((r) => { if (alive) { setData({ ...r.data, key: `${companyId}-${year}` }); setError(null); } })
      .catch((e) => alive && setError(errorMessage(e, 'Erro ao carregar os indicadores.')));
    return () => { alive = false; };
  }, [companyId, year, version]);

  if (error && !data) return <Page><Alert tone="error">{error}</Alert></Page>;
  if (!data || data.key !== `${companyId}-${year}`) return <Loading label="Calculando os indicadores…" />;

  const health = scoreOf(data.realized);
  const realizedTotal = (data.realized || []).reduce((a, m) => a + Number(m.revenue || 0), 0);
  const planned = Number(data.planned || 0);
  const goalPct = planned > 0 ? (realizedTotal / planned) * 100 : null;

  const saveGoal = async () => {
    setSaving(true);
    try {
      await http.post('/intelligence/goals', { companyId, year, plannedAmount: toNumber(goalText) });
      setGoalOpen(false);
      setVersion((v) => v + 1);
    } catch (e) { setError(errorMessage(e, 'Erro ao salvar a meta.')); } finally { setSaving(false); }
  };
  const deleteGoal = async () => {
    setSaving(true);
    try {
      await http.delete('/intelligence/goals', { params: { companyId, year } });
      setGoalOpen(false);
      setVersion((v) => v + 1);
    } catch (e) { setError(errorMessage(e, 'Erro ao remover a meta.')); } finally { setSaving(false); }
  };

  return (
    <Page>
      <PageHeader
        title="Saúde financeira"
        description="Um resumo rápido de como a empresa está, com base nos lançamentos do ano."
        actions={(
          <>
            <Select aria-label="Ano" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>
            <Button icon={Target} onClick={() => { setGoalText(planned ? planned.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''); setGoalOpen(true); }}>Meta de {year}</Button>
            <Button icon={RefreshCw} onClick={() => setVersion((v) => v + 1)}>Atualizar</Button>
          </>
        )}
      />
      {error && <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Nota de saúde" description="Calculada sobre o último mês lançado." />
          {health ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ScoreGauge score={health.score} />
              <div className="text-sm text-ink-2 space-y-2">
                <p>A nota começa em 50 e muda assim:</p>
                <ul className="space-y-1">
                  <li>• Margem do último mês: <strong className="text-ink">{pct(health.margin, 1)}</strong> {health.margin > 25 ? '(acima de 25%: +30)' : health.margin > 10 ? '(entre 10% e 25%: +15)' : health.margin < 0 ? '(prejuízo: −30)' : '(até 10%: +0)'}</li>
                  <li>• Faturamento {health.grew ? 'cresceu em relação ao mês anterior: +20' : 'não cresceu em relação ao mês anterior: +0'}</li>
                </ul>
              </div>
            </div>
          ) : <p className="text-sm text-ink-3">Nenhum mês lançado em {year}.</p>}
        </Card>

        <Card>
          <CardHeader title="Alertas automáticos" icon={Lightbulb} />
          {data.insights?.length ? (
            <ul className="space-y-2">{data.insights.map((msg) => <li key={msg} className="text-sm p-3 rounded-lg bg-surface-2 border border-line leading-relaxed">{msg}</li>)}</ul>
          ) : <p className="text-sm text-ink-3">Nada a reportar.</p>}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label={`Faturamento realizado em ${year}`} value={brl(realizedTotal)} />
        <Stat label={`Meta de ${year}`} value={planned ? brl(planned) : 'Sem meta'} hint={planned ? undefined : 'Defina no botão “Meta”'} />
        <Stat label="Previsão para o próximo mês" value={brl(Number(data.forecast || 0))} hint="Estimativa pela tendência dos meses lançados" tone="brand" />
      </div>

      {goalPct !== null && (
        <Card>
          <div className="flex justify-between text-sm mb-2"><span className="font-medium">Andamento da meta</span><span className="num">{pct(goalPct, 1)}</span></div>
          <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(goalPct, 100)}%` }} /></div>
          <p className="text-xs text-ink-3 mt-2">Faltam {brl(Math.max(planned - realizedTotal, 0))} para chegar à meta.</p>
        </Card>
      )}

      <Card>
        <CardHeader title="Atalhos" />
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { id: 'dre', icon: FileText, title: 'DRE gerencial', text: 'Resultado mês a mês e exportação analítica.' },
            { id: 'questor', icon: CloudUpload, title: 'Integração Questor', text: 'Arquivo de lançamentos para a contabilidade.' },
            { id: 'auditoria', icon: History, title: 'Histórico de ações', text: 'Quem alterou o quê no sistema.' },
          ].map((a) => (
            <button key={a.id} onClick={() => onNavigate(a.id)} className="text-left p-4 rounded-xl border border-line hover:border-brand hover:bg-surface-2 transition-colors">
              <a.icon size={18} className="text-brand" />
              <p className="mt-2 font-medium text-sm text-ink">{a.title}</p>
              <p className="text-xs text-ink-2 mt-0.5">{a.text}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-brand">Abrir <ArrowRight size={12} /></span>
            </button>
          ))}
        </div>
      </Card>

      <Modal
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title={`Meta de faturamento de ${year}`}
        size="sm"
        footer={(
          <>
            {planned > 0 && <Button variant="danger-ghost" icon={Trash2} onClick={deleteGoal} disabled={saving} className="mr-auto">Remover meta</Button>}
            <Button onClick={() => setGoalOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={saveGoal} disabled={!toNumber(goalText)}>Salvar meta</Button>
          </>
        )}
      >
        <Field label="Faturamento esperado no ano" hint="Exemplo: 1.200.000,00">
          <Input prefix="R$" inputMode="decimal" autoFocus value={goalText} onChange={(e) => setGoalText(e.target.value)} />
        </Field>
      </Modal>
    </Page>
  );
};

export default IntelligenceHub;
