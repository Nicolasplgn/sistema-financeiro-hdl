// Importação da contabilidade: DRE anual em Excel ou balancetes mensais em CSV.
import React, { useState } from 'react';
import { CheckCircle2, FileSpreadsheet, ListPlus, Plus, Upload, X } from 'lucide-react';
import http, { errorMessage } from '../services/http';
import { Alert, Button, Field, IconButton, Input, Loading, Modal } from './ui';
import { brl } from '../utils/format';

const nextMonth = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const ImportModal = ({ open, onClose, companyId, onSuccess }) => {
  const [format, setFormat] = useState(null); // 'excel' | 'csv'
  const [excelFile, setExcelFile] = useState(null);
  const [batch, setBatch] = useState([{ id: 1, period: '', file: null }]);
  const [status, setStatus] = useState('idle'); // idle | uploading | done | error
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState([]);

  const reset = () => {
    setFormat(null); setExcelFile(null); setBatch([{ id: 1, period: '', file: null }]);
    setStatus('idle'); setMessage(''); setProgress({ current: 0, total: 0 }); setLogs([]);
  };
  const close = () => { reset(); onClose(); };

  const uploadExcel = async () => {
    setStatus('uploading');
    const fd = new FormData();
    fd.append('file', excelFile);
    fd.append('companyId', companyId);
    try {
      const res = await http.post('/import/dre', fd);
      setStatus('done');
      setMessage(res.data.message || 'DRE anual importada.');
      onSuccess?.({ format: 'excel' });
    } catch (e) {
      setStatus('error');
      setMessage(errorMessage(e, 'Erro ao importar a planilha. Confira se segue o modelo da DRE anual.'));
    }
  };

  const uploadBatch = async () => {
    setStatus('uploading');
    setProgress({ current: 0, total: batch.length });
    let ok = 0;
    let fail = 0;
    const results = [];
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      setProgress({ current: i + 1, total: batch.length });
      const fd = new FormData();
      fd.append('file', item.file);
      fd.append('companyId', companyId);
      fd.append('period', item.period);
      try {
        const res = await http.post('/import/balancete', fd);
        ok++;
        results.push({ period: res.data.period || item.period, ok: true, result: res.data.summary?.resultado, receitas: res.data.summary?.receitas, audit: res.data.summary?.audit, layout: res.data.layout, questor: res.data.questor });
      } catch (e) {
        fail++;
        results.push({ period: item.period, ok: false, error: errorMessage(e, 'Falha ao ler o arquivo.') });
      }
    }
    setLogs(results);
    setStatus(fail && !ok ? 'error' : 'done');
    setMessage(`${ok} mês(es) importado(s)${fail ? `, ${fail} com falha` : ''}.`);
    onSuccess?.({ format: 'csv', period: batch.length === 1 && ok ? batch[0].period : undefined });
  };

  const footer = status === 'done' || status === 'error'
    ? <Button variant="primary" onClick={close}>Concluir</Button>
    : format === 'excel'
      ? <><Button onClick={() => setFormat(null)}>Voltar</Button><Button variant="primary" icon={Upload} onClick={uploadExcel} disabled={!excelFile || status === 'uploading'}>Importar DRE</Button></>
      : format === 'csv'
        ? <><Button onClick={() => setFormat(null)}>Voltar</Button><Button variant="primary" icon={Upload} onClick={uploadBatch} disabled={status === 'uploading' || batch.some((b) => !b.file)}>Importar {batch.length} arquivo(s)</Button></>
        : <Button onClick={close}>Cancelar</Button>;

  return (
    <Modal open={open} onClose={close} title="Importar da contabilidade" description="Traz os valores prontos da contabilidade para os lançamentos do mês." footer={footer} size="md">
      {status === 'uploading' && <Loading label={progress.total > 1 ? `Lendo arquivo ${progress.current} de ${progress.total}…` : 'Lendo o arquivo…'} />}

      {(status === 'done' || status === 'error') && (
        <div className="space-y-3">
          <Alert tone={status === 'error' ? 'error' : logs.some((l) => !l.ok) ? 'warning' : 'success'}>{message}</Alert>
          {logs.map((l) => (
            <div key={l.period} className="p-3 rounded-lg border border-line text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{l.period}</span>
                {l.ok ? <span className={`num ${l.result >= 0 ? 'text-pos' : 'text-neg'}`}>Resultado {brl(l.result)}</span> : <span className="text-neg">{l.error}</span>}
              </div>
              {l.ok && l.questor && (
                <div className="text-xs text-ink-2 mt-1 space-y-0.5">
                  <p>Balancete do Questor{l.questor.empresa ? ` · ${l.questor.empresa}` : ''}</p>
                  <p>{l.questor.usadas} contas de resultado usadas de {l.questor.analiticas} analíticas · faturamento {brl(l.receitas)}</p>
                  {l.questor.confere_com_totais !== null && (
                    <p className={l.questor.confere_com_totais ? 'text-pos' : 'text-neg'}>
                      {l.questor.confere_com_totais ? 'Débitos e créditos conferem com os totais do Questor.' : 'Atenção: a soma das contas não fecha com os totais do Questor.'}
                    </p>
                  )}
                  {l.questor.classificadas_pelo_saldo.length > 0 && <p className="text-warn">Classificadas pelo saldo (nome não reconhecido): {l.questor.classificadas_pelo_saldo.join(', ')}</p>}
                  {l.audit?.ignored > 0 && <p>Pagamentos de empréstimos fora do resultado: {brl(l.audit.ignoredValue)}</p>}
                </div>
              )}
              {l.ok && !l.questor && l.audit && (
                <p className="text-xs text-ink-2 mt-1">
                  {l.audit.processed} contas lidas · faturamento {brl(l.receitas)}
                  {l.audit.ignored > 0 && ` · ${l.audit.ignored} contas de empréstimos/patrimônio separadas da DRE (${brl(l.audit.ignoredValue)})`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {status === 'idle' && !format && (
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { id: 'excel', icon: FileSpreadsheet, title: 'DRE anual (Excel)', text: 'Uma planilha com os 12 meses nas colunas (.xlsx). Lança o ano inteiro de uma vez.' },
            { id: 'csv', icon: ListPlus, title: 'Balancetes mensais (CSV)', text: 'Balancete Débito Crédito do Questor, um arquivo por mês. O sistema lê o mês, separa as contas de resultado e monta a DRE.' },
          ].map((o) => (
            <button key={o.id} onClick={() => setFormat(o.id)} className="text-left p-4 rounded-xl border border-line hover:border-brand hover:bg-surface-2 transition-colors">
              <o.icon size={22} className="text-brand" />
              <p className="mt-3 font-medium text-ink">{o.title}</p>
              <p className="mt-1 text-xs text-ink-2 leading-relaxed">{o.text}</p>
            </button>
          ))}
        </div>
      )}

      {status === 'idle' && format === 'excel' && (
        <Field label="Arquivo da DRE" hint="XLSX, XLS ou CSV com os meses nas colunas.">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} className="block w-full text-sm text-ink-2 file:mr-3 file:h-9 file:px-4 file:rounded-lg file:border file:border-line file:bg-surface-2 file:text-ink file:font-medium file:cursor-pointer" />
        </Field>
      )}

      {status === 'idle' && format === 'csv' && (
        <div className="space-y-3">
          <Alert tone="info" title="Como exportar do Questor">
            Relatórios → Contábeis → Balancete (Texto) → <strong>Balancete - Débito Crédito</strong>, com a data inicial e final do mesmo mês.
            Na visualização, clique em exportar e escolha <strong>CSV (Somente os textos para abrir no excel)</strong>. Um arquivo por mês; não precisa apagar nenhuma coluna.
            O mês é lido do próprio arquivo.
          </Alert>
          {batch.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end p-3 rounded-lg border border-line bg-surface-2">
              <Field label="Mês (opcional no Questor)" className="sm:w-48">
                <Input type="month" value={item.period} onChange={(e) => setBatch((b) => b.map((x) => (x.id === item.id ? { ...x, period: e.target.value } : x)))} />
              </Field>
              <Field label="Arquivo .csv" className="flex-1 min-w-0">
                <label className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-dashed border-line-strong bg-surface cursor-pointer text-sm hover:border-brand">
                  <span className={`truncate ${item.file ? 'text-ink' : 'text-ink-3'}`}>{item.file ? item.file.name : 'Escolher arquivo…'}</span>
                  {item.file ? <CheckCircle2 size={16} className="text-pos shrink-0" /> : <Upload size={16} className="text-ink-3 shrink-0" />}
                  <input type="file" accept=".csv,.txt" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setBatch((b) => b.map((x) => (x.id === item.id ? { ...x, file: f } : x))); }} />
                </label>
              </Field>
              {batch.length > 1 && <IconButton icon={X} label="Remover este mês" variant="danger" onClick={() => setBatch((b) => b.filter((x) => x.id !== item.id))} />}
            </div>
          ))}
          <Button size="sm" icon={Plus} onClick={() => setBatch((b) => [...b, { id: Date.now(), period: nextMonth(b[b.length - 1]?.period), file: null }])}>Adicionar mês</Button>
        </div>
      )}
    </Modal>
  );
};

export default ImportModal;
