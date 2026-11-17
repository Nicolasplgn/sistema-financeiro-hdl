import React from 'react';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import { Alert, Button, Card, CardHeader, Stat, StepFlow } from '../../components/ui';
import { brl, pct, STATUS_LABEL } from '../../utils/format';

/** Aba de entrada: o caminho das planilhas, o que já está preenchido e os preços. */
const InicioSheet = ({ ctx }) => {
  const { painel, fixed, payroll, prolabore, goTo, openImport, setSelection } = ctx;
  const totais = painel.totais_mensais;
  const estrutura = totais.fixed + totais.payroll + totais.prolabore;
  const comFicha = painel.produtos.filter((p) => p.itens > 0).length;
  const comPreco = painel.precos.filter((p) => p.status === 'OK').length;
  const canaisComMeta = painel.canais.filter((c) => Number(c.sales_target) > 0).length;
  const vazio = painel.canais.length === 0 && painel.produtos.length === 0 && fixed.length === 0;

  const steps = [
    {
      title: 'Custos da estrutura',
      description: 'Custo fixo, folha e pró-labore do mês. É o que a empresa gasta para existir, venda ou não venda.',
      status: `${brl(estrutura)} por mês`,
      done: fixed.length > 0 && payroll.length > 0,
      onClick: () => goTo('custo-fixo'),
    },
    {
      title: 'Painel de rateio',
      description: 'Para cada canal: meta de venda, quanto da estrutura ele absorve, alíquotas e despesas de venda.',
      status: `${painel.canais.length} canais · ${canaisComMeta} com meta`,
      done: canaisComMeta > 0 && painel.avisos.length === 0,
      onClick: () => goTo('painel'),
    },
    {
      title: 'Fichas técnicas',
      description: 'Componentes de cada modelo. Dão o custo de compra, já sem os créditos de impostos.',
      status: `${comFicha} de ${painel.produtos.length} modelos com ficha`,
      done: painel.produtos.length > 0 && comFicha === painel.produtos.length,
      onClick: () => goTo('fichas'),
    },
    {
      title: 'Markup',
      description: 'Preço sugerido = custo de compra ÷ (1 − soma dos encargos sobre a venda).',
      status: `${comPreco} preços calculados`,
      done: comPreco > 0,
      onClick: () => goTo('markup'),
    },
    {
      title: 'Tributos',
      description: 'Impostos da venda menos os créditos da compra: quanto de imposto sobra para pagar.',
      status: comPreco > 0 ? 'Pronto para conferir' : 'Depende do markup',
      done: comPreco > 0,
      onClick: () => goTo('tributos'),
    },
  ];

  const precoDe = (productId, channelId) => painel.precos.find((x) => x.product_id === productId && x.channel_id === channelId);

  return (
    <div className="space-y-6">
      {vazio && (
        <Alert tone="info" title="Esta empresa ainda não tem a planilha de preços preenchida">
          <span className="block mb-3">Você pode preencher aba por aba, ou carregar de uma vez as planilhas de markup que você já usa no Excel.</span>
          <Button size="sm" variant="primary" icon={FileSpreadsheet} onClick={openImport}>Carregar planilhas</Button>
        </Alert>
      )}

      <div>
        <h2 className="text-[15px] font-semibold text-ink mb-1">Como funciona</h2>
        <p className="text-sm text-ink-2 mb-4">Siga as abas da esquerda para a direita. Clique em um passo para abrir a aba.</p>
        <StepFlow steps={steps} />
      </div>

      {painel.avisos.length > 0 && (
        <Alert tone="warning" title="Ajustes pendentes no painel">
          <ul className="list-disc pl-4 space-y-0.5">{painel.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Custo fixo / mês" value={brl(totais.fixed)} />
        <Stat label="Folha / mês" value={brl(totais.payroll)} hint={`${payroll.length} funcionários`} />
        <Stat label="Pró-labore / mês" value={brl(totais.prolabore)} hint={`${prolabore.length} sócios`} />
        <Stat label="Estrutura mensal" value={brl(estrutura)} tone="brand" />
      </div>

      <Card padded={false}>
        <div className="p-5 pb-0">
          <CardHeader
            title="Preços de venda sugeridos"
            description="Preço com IPI de cada modelo em cada canal. Clique em um preço para ver o markup completo."
          />
        </div>
        {painel.produtos.length === 0 || painel.canais.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-2">Cadastre canais no Painel e modelos nas Fichas técnicas para ver os preços.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin px-5 pb-5">
            <table className="sheet min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left sticky-col">Modelo</th>
                  <th className="text-right">Custo de compra</th>
                  {painel.canais.map((c) => <th key={c.id} className="text-right">{c.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {painel.produtos.map((p, i) => (
                  <tr key={p.id}>
                    <td className="cell sticky-col bg-surface">
                      <span className="text-ink-3 num mr-2">{i + 1}</span>
                      <span className="font-medium">{p.sku || '—'}</span>
                      <span className="text-ink-3 ml-2 text-xs hidden xl:inline">{p.name}</span>
                    </td>
                    <td className="calc text-right num">{p.itens > 0 ? brl(p.custo) : 'sem ficha'}</td>
                    {painel.canais.map((c) => {
                      const preco = precoDe(p.id, c.id);
                      return (
                        <td key={c.id} className="cell text-right">
                          <button
                            className="w-full text-right hover:text-brand"
                            onClick={() => { setSelection({ productId: p.id, channelId: c.id }); goTo('markup'); }}
                            title={preco?.motivo || 'Abrir o markup'}
                          >
                            {preco?.status === 'OK'
                              ? <span className="font-semibold num">{brl(preco.preco_venda_com_ipi)}</span>
                              : <span className="text-xs text-ink-3">{STATUS_LABEL[preco?.status] || '—'}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink-3">
              “Sem base de rateio” é o #DIV/0! da planilha: o canal não tem meta de venda ou o modelo está com 0% no rateio.
              {!painel.parametros.rateio_total && ' Para calcular todos os modelos, ligue “Rateio total” no Painel.'}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="A conta do preço" description="O mesmo raciocínio da aba MARKUP da planilha." />
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-surface-2 border border-line">
            <p className="font-medium text-ink">1. Custo de compra</p>
            <p className="text-ink-2 mt-1">Soma dos componentes da ficha com IPI, menos os créditos de PIS, COFINS, IPI e ICMS (no Lucro Real).</p>
          </div>
          <div className="p-4 rounded-lg bg-surface-2 border border-line">
            <p className="font-medium text-ink">2. Encargos sobre a venda</p>
            <p className="text-ink-2 mt-1">Impostos, comissão, frete, custo financeiro, lucro desejado e a parte da estrutura do canal. Exemplo: {pct(87.17)}.</p>
          </div>
          <div className="p-4 rounded-lg bg-surface-2 border border-line">
            <p className="font-medium text-ink">3. Preço sugerido</p>
            <p className="text-ink-2 mt-1">Custo ÷ (1 − encargos). Assim cada encargo vira exatamente o seu percentual do preço final.</p>
          </div>
        </div>
        <Button className="mt-4" variant="ghost" size="sm" onClick={() => goTo('painel')}>Começar pelo painel <ArrowRight size={14} /></Button>
      </Card>
    </div>
  );
};

export default InicioSheet;
