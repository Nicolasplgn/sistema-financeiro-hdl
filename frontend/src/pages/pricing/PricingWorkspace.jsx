// Planilha de preços: as mesmas abas da pasta de planilhas de markup.
// Cada aba edita uma parte do cadastro; todos os cálculos são do backend
// (backend/services/pricing/engine.js), conferidos contra o Excel.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import http, { errorMessage } from '../../services/http';
import { Button, Feedback, Loading, Page, PageHeader, SheetLegend } from '../../components/ui';
import { WorkbookTabs } from '../../components/ui/sheet';
import { REGIME_LABEL } from '../../utils/format';

import InicioSheet from './InicioSheet';
import PainelSheet from './PainelSheet';
import { CustoFixoSheet, ProLaboreSheet } from './EstruturaSheets';
import FolhaSheet from './FolhaSheet';
import FichasSheet from './FichasSheet';
import MarkupSheet from './MarkupSheet';
import TributosSheet from './TributosSheet';
import ImportPlanilhasModal from './ImportPlanilhasModal';

const SHEETS = [
  { id: 'inicio', label: 'Início', hint: 'Como a planilha funciona e o que falta preencher' },
  { id: 'painel', label: 'Painel', hint: 'Canais, metas, alíquotas e rateio por modelo' },
  { id: 'custo-fixo', label: 'Custo fixo', hint: 'Despesas fixas mensais' },
  { id: 'folha', label: 'Folha', hint: 'Custo mensal de cada funcionário' },
  { id: 'pro-labore', label: 'Pró-labore', hint: 'Retirada mensal dos sócios' },
  { id: 'fichas', label: 'Fichas técnicas', hint: 'Componentes e custo de compra de cada modelo' },
  { id: 'markup', label: 'Markup', hint: 'Preço de venda sugerido por modelo e canal' },
  { id: 'tributos', label: 'Tributos', hint: 'Impostos da venda, créditos da compra e imposto devido' },
];

const PricingWorkspace = ({ companyId }) => {
  const [sheet, setSheet] = useState(() => {
    const saved = localStorage.getItem('vector_pricing_sheet');
    return SHEETS.some((s) => s.id === saved) ? saved : 'inicio';
  });
  const [painel, setPainel] = useState(null);
  const [fixed, setFixed] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [prolabore, setProlabore] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  // Modelo e canal escolhidos nas abas Markup e Tributos (compartilhados entre elas)
  const [selection, setSelection] = useState({ productId: null, channelId: null });

  useEffect(() => { localStorage.setItem('vector_pricing_sheet', sheet); }, [sheet]);

  const params = useMemo(() => ({ companyId }), [companyId]);

  const reload = useCallback(async (parts = ['painel', 'fixed', 'payroll', 'prolabore', 'materials']) => {
    const calls = {
      painel: () => http.get('/pricing/painel', { params }).then((r) => setPainel(r.data)),
      fixed: () => http.get('/fixed-expenses', { params }).then((r) => setFixed(r.data)),
      payroll: () => http.get('/payroll', { params }).then((r) => setPayroll(r.data)),
      prolabore: () => http.get('/prolabore', { params }).then((r) => setProlabore(r.data)),
      materials: () => http.get('/materials-full', { params }).then((r) => setMaterials(r.data)),
    };
    try {
      await Promise.all(parts.map((p) => calls[p]()));
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error, 'Erro ao carregar a planilha de preços.') });
    }
  }, [params]);

  // Carga inicial (a tela é recriada quando a empresa muda: key no App).
  useEffect(() => {
    let alive = true;
    Promise.all(['/pricing/painel', '/fixed-expenses', '/payroll', '/prolabore', '/materials-full'].map((url) => http.get(url, { params })))
      .then(([p, f, pay, pro, mat]) => {
        if (!alive) return;
        setPainel(p.data); setFixed(f.data); setPayroll(pay.data); setProlabore(pro.data); setMaterials(mat.data);
      })
      .catch((error) => alive && setFeedback({ tone: 'error', text: errorMessage(error, 'Erro ao abrir a planilha de preços.') }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [params]);

  // Seleção válida: a escolhida, ou o primeiro modelo/canal com preço calculado.
  const effectiveSelection = useMemo(() => {
    if (!painel) return selection;
    const hasProduct = painel.produtos.some((p) => p.id === selection.productId);
    const hasChannel = painel.canais.some((c) => c.id === selection.channelId);
    if (hasProduct && hasChannel) return selection;
    const ok = painel.precos.find((p) => p.status === 'OK');
    return {
      productId: hasProduct ? selection.productId : ok?.product_id ?? painel.produtos[0]?.id ?? null,
      channelId: hasChannel ? selection.channelId : ok?.channel_id ?? painel.canais[0]?.id ?? null,
    };
  }, [painel, selection]);

  /** Executa uma gravação e recarrega as partes afetadas; erros viram aviso. */
  const run = useCallback(async (action, parts = ['painel'], successText) => {
    try {
      const result = await action();
      await reload(parts);
      if (successText) setFeedback({ tone: 'success', text: successText });
      return result;
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error) });
      return undefined;
    }
  }, [reload]);

  /** Grava campos do painel (canais, produtos, faixas, parâmetros) e atualiza com a resposta. */
  const savePainel = useCallback(async (body) => {
    try {
      const res = await http.put('/pricing/painel', { company_id: companyId, ...body });
      setPainel(res.data);
      if (body.parametros) await reload(['payroll']);
      return res.data;
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error, 'Erro ao gravar no painel.') });
      return undefined;
    }
  }, [companyId, reload]);

  if (loading && !painel) return <Loading label="Abrindo a planilha de preços…" />;

  const ctx = {
    companyId, painel, fixed, payroll, prolabore, materials,
    reload, run, savePainel, setFeedback,
    selection: effectiveSelection, setSelection, goTo: setSheet, openImport: () => setImportOpen(true),
  };

  return (
    <Page wide>
      <PageHeader
        title="Planilha de preços"
        description={`Formação do preço de venda com as mesmas abas da planilha de markup${painel ? ` · regime ${REGIME_LABEL[painel.regime]}` : ''}. Cada alteração é gravada na hora e os resultados se recalculam, como no Excel.`}
        actions={(
          <>
            <Button icon={RefreshCw} onClick={() => reload()}>Atualizar</Button>
            <Button icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Carregar planilhas</Button>
          </>
        )}
      >
        <SheetLegend className="mt-3" />
      </PageHeader>

      <Feedback value={feedback} onClose={() => setFeedback(null)} />

      <div>
        <WorkbookTabs items={SHEETS} value={sheet} onChange={setSheet} />
        <div className="bg-surface border border-t-0 border-line rounded-b-xl p-4 sm:p-5">
          {painel && (
            <>
              {sheet === 'inicio' && <InicioSheet ctx={ctx} />}
              {sheet === 'painel' && <PainelSheet ctx={ctx} />}
              {sheet === 'custo-fixo' && <CustoFixoSheet ctx={ctx} />}
              {sheet === 'folha' && <FolhaSheet ctx={ctx} />}
              {sheet === 'pro-labore' && <ProLaboreSheet ctx={ctx} />}
              {sheet === 'fichas' && <FichasSheet ctx={ctx} />}
              {sheet === 'markup' && <MarkupSheet ctx={ctx} />}
              {sheet === 'tributos' && <TributosSheet ctx={ctx} />}
            </>
          )}
        </div>
      </div>

      <ImportPlanilhasModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        companyId={companyId}
        onDone={async (text) => { setImportOpen(false); await reload(); setFeedback({ tone: 'success', text }); }}
        onError={(text) => setFeedback({ tone: 'error', text })}
      />
    </Page>
  );
};

export default PricingWorkspace;
