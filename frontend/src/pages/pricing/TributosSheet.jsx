// Aba TRIBUTOS: os três quadros da aba "TRIBUTOS <canal> <modelo>" da planilha.
import React from 'react';
import { Alert, Loading, Stat } from '../../components/ui';
import { CalcCell, SheetFrame } from '../../components/ui/sheet';
import { brl, pct, REGIME_LABEL, STATUS_LABEL } from '../../utils/format';
import ModelChannelPicker from './ModelChannelPicker';
import { usePriceCalc } from './usePriceCalc';

const Bloco = ({ title, description, children }) => (
  <section className="space-y-2">
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="text-xs text-ink-2 mt-0.5">{description}</p>}
    </div>
    <SheetFrame>{children}</SheetFrame>
  </section>
);

const TributosSheet = ({ ctx }) => {
  const { painel, selection, setSelection, setFeedback } = ctx;
  const { result, loading } = usePriceCalc({ ...selection, version: painel, setFeedback });

  if (painel.produtos.length === 0 || painel.canais.length === 0) {
    return <Alert tone="info">Para ver os tributos é preciso ter ao menos um canal (aba Painel) e um modelo (aba Fichas técnicas).</Alert>;
  }

  const t = result?.tributos;
  const m = result?.markup;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Tributos</h2>
        <p className="text-[13px] text-ink-2 mt-0.5">
          Quanto de imposto a venda gera, quanto a compra dos componentes já deu de crédito e quanto sobra para pagar, por unidade vendida.
        </p>
      </div>

      <ModelChannelPicker painel={painel} selection={selection} setSelection={setSelection} />

      {!result && loading && <Loading label="Calculando…" />}

      {t && m && (
        <>
          {m.status !== 'OK' && (
            <Alert tone="warning" title={STATUS_LABEL[m.status]}>
              {m.motivo} Sem preço de venda não há imposto da venda para calcular (na planilha aparece #DIV/0!). Os créditos da compra aparecem abaixo.
            </Alert>
          )}

          {t.devido && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Preço de venda" value={brl(t.venda.preco_venda)} />
              <Stat label="Impostos da venda" value={brl(t.venda.total)} hint="IPI + PIS + COFINS + DIFAL + ICMS" />
              <Stat label="Total devido por unidade" value={brl(t.devido.total)} tone="neg" hint="Débitos − créditos + IR/CSLL" />
              <Stat label="Alíquota efetiva" value={pct(t.devido.aliquota_efetiva)} tone="brand" hint="Total devido ÷ preço" />
            </div>
          )}

          <Bloco title={`${REGIME_LABEL[result.regime]} — venda do produto final`} description="Alíquotas do canal (Painel) aplicadas sobre o preço de venda sugerido.">
            <table className="sheet min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-left">Item</th>
                  <th className="text-right">Preço de venda</th>
                  <th className="text-right">IPI</th><th className="text-right">PIS</th><th className="text-right">COFINS</th>
                  <th className="text-right">DIFAL</th><th className="text-right">ICMS</th><th className="text-right">Total imposto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell text-ink-2">Alíquota</td>
                  <CalcCell>{''}</CalcCell>
                  {['ipi', 'pis', 'cofins', 'difal', 'icms'].map((k) => <CalcCell key={k} value={t.venda.aliquotas[k]} format="percent" />)}
                  <CalcCell>{''}</CalcCell>
                </tr>
                <tr>
                  <td className="cell font-medium">{result.produto.sku || result.produto.name}</td>
                  <CalcCell value={t.venda.preco_venda} strong />
                  {['ipi', 'pis', 'cofins', 'difal', 'icms'].map((k) => <CalcCell key={k} value={t.venda[k]} />)}
                  <CalcCell value={t.venda.total} strong />
                </tr>
              </tbody>
            </table>
          </Bloco>

          <Bloco title="Compra — créditos da ficha técnica" description="Impostos pagos na compra dos componentes que a empresa pode abater. O “total” segue a planilha: soma IPI, PIS, COFINS e outros créditos, sem o ICMS.">
            <table className="sheet min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-left">Item</th>
                  <th className="text-right">IPI</th><th className="text-right">PIS</th><th className="text-right">COFINS</th>
                  <th className="text-right">Outros créditos</th><th className="text-right">ICMS</th><th className="text-right">Total imposto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell font-medium">{result.produto.sku || result.produto.name}</td>
                  {['ipi', 'pis', 'cofins', 'outros_creditos', 'icms'].map((k) => <CalcCell key={k} value={t.compra[k]} />)}
                  <CalcCell value={t.compra.total} strong />
                </tr>
              </tbody>
            </table>
          </Bloco>

          <Bloco title="Imposto devido" description={`Venda − compra, tributo a tributo, mais IR (${pct(result.parametros.ir_percent, 0)}) e CSLL (${pct(result.parametros.csll_percent, 0)}) sobre o lucro antes do IR/CS.`}>
            <table className="sheet min-w-[900px]">
              <thead>
                <tr>
                  <th className="text-left">Item</th>
                  <th className="text-right">IPI</th><th className="text-right">PIS devido</th><th className="text-right">COFINS devido</th>
                  <th className="text-right">DIFAL</th><th className="text-right">ICMS</th><th className="text-right">Total impostos</th>
                  <th className="text-right">IR</th><th className="text-right">CSLL</th><th className="text-right">Total</th><th className="text-right">Alíq. efetiva</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell font-medium">{result.produto.sku || result.produto.name}</td>
                  {t.devido
                    ? (
                      <>
                        {['ipi', 'pis', 'cofins', 'difal', 'icms', 'total_impostos', 'ir', 'csll'].map((k) => <CalcCell key={k} value={t.devido[k]} />)}
                        <CalcCell value={t.devido.total} strong />
                        <CalcCell value={t.devido.aliquota_efetiva} format="percent" strong />
                      </>
                    )
                    : <td colSpan={10} className="calc text-center text-ink-3">sem preço de venda</td>}
                </tr>
              </tbody>
            </table>
          </Bloco>
        </>
      )}
    </div>
  );
};

export default TributosSheet;
