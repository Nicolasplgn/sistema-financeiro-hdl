// Integração Questor: arquivo TXT de lançamentos contábeis de cada mês.
import React, { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import { Download, FileText } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Loading, Page, PageHeader } from '../components/ui';
import { monthLabel } from '../utils/format';

const QuestorManager = ({ companyId, onNavigate }) => {
  const [history, setHistory] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    http.get('/entries/history', { params: { companyId } })
      .then((r) => alive && setHistory({ companyId, list: r.data }))
      .catch((e) => alive && setError(errorMessage(e, 'Erro ao carregar os meses.')));
    return () => { alive = false; };
  }, [companyId]);

  const open = async (entry) => {
    setSelected(entry.id);
    setPreview(null);
    try {
      const r = await http.get(`/integration/questor-preview/${entry.id}`);
      setPreview(r.data);
    } catch (e) { setSelected(null); setError(errorMessage(e, 'Erro ao gerar o arquivo.')); }
  };

  return (
    <Page>
      <PageHeader
        title="Integração Questor"
        description="Gera, para cada mês, o arquivo de lançamentos contábeis no layout de importação do Questor, a partir do detalhamento analítico do mês."
      >
        <Alert tone="warning" className="mt-3">O envio automático ainda depende do acesso ao webservice da contabilidade. Por enquanto, baixe o arquivo e envie ao escritório.</Alert>
      </PageHeader>
      {error && <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>}

      {!history || history.companyId !== companyId ? <Loading /> : history.list.length === 0 ? (
        <Card><EmptyState title="Nenhum mês lançado" description="Lance um mês primeiro." action={<Button onClick={() => onNavigate('lancamentos')}>Ir para Lançamentos do mês</Button>} /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card padded={false}>
            <p className="px-4 pt-4 pb-2 text-xs font-medium text-ink-3">Meses lançados</p>
            <ul className="pb-2">
              {history.list.map((h) => (
                <li key={h.id}>
                  <button onClick={() => open(h)} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-2 ${selected === h.id ? 'bg-brand-soft text-brand font-medium' : ''}`}>
                    {monthLabel(h.period_start.slice(0, 7))}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            {!selected ? (
              <EmptyState icon={FileText} title="Escolha um mês" description="Clique em um mês ao lado para ver o arquivo." />
            ) : !preview ? <Loading label="Gerando o arquivo…" /> : (
              <>
                <CardHeader
                  title={`Arquivo de ${monthLabel(preview.period)}`}
                  description={`${preview.lines} lançamento(s) a partir do detalhamento analítico do mês.`}
                  actions={<Button variant="primary" icon={Download} disabled={!preview.txt} onClick={() => saveAs(new Blob([preview.txt], { type: 'text/plain;charset=utf-8' }), `questor_${preview.period}.txt`)}>Baixar .txt</Button>}
                />
                {preview.lines === 0 ? (
                  <Alert tone="info">Este mês não tem detalhamento analítico. Adicione as linhas em “Lançamentos do mês” para gerar o arquivo.</Alert>
                ) : (
                  <>
                    {preview.withoutAccount > 0 && <Alert tone="warning" className="mb-3"><Badge tone="warn">{preview.withoutAccount}</Badge> linha(s) estão em categorias sem conta contábil do Questor e saem como “CONTA_GENERICA”.</Alert>}
                    <pre className="text-xs num bg-surface-2 border border-line rounded-lg p-4 overflow-x-auto scroll-thin max-h-[60vh] text-ink-2">{preview.txt}</pre>
                  </>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
};

export default QuestorManager;
