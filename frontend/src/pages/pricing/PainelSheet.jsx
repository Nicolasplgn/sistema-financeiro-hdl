// Aba PAINEL: o "PAINEL DE RATEIO" da planilha.
import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import http from '../../services/http';
import { Alert, Button, Field, IconButton, Input, Modal, Toggle } from '../../components/ui';
import { useConfirm } from '../../components/ui/useConfirm';
import { CalcCell, NumberCell, SheetFrame } from '../../components/ui/sheet';
import { brl, pct, STATUS_LABEL } from '../../utils/format';

// Linhas digitáveis do painel, na ordem da planilha.
const ROWS = [
  { group: 'Rateio da estrutura', field: 'fixed_cost_share_percent', label: 'Apropriação custo fixo', sum: true, hint: 'Parte do custo fixo que este canal paga' },
  { field: 'prolabore_share_percent', label: 'Apropriação pró-labore', sum: true },
  { field: 'payroll_share_percent', label: 'Apropriação salário', sum: true },
  { field: 'sales_target', label: 'Meta de venda (R$/mês)', format: 'money', sum: true, hint: 'Quanto o canal deve vender por mês' },
  { group: 'Encargos sobre a venda', field: 'profit_margin_percent', label: 'Lucro' },
  { field: 'icms_out_percent', label: 'ICMS' },
  { field: 'difal_out_percent', label: 'DIFAL' },
  { field: 'pis_out_percent', label: 'PIS' },
  { field: 'cofins_out_percent', label: 'COFINS' },
  { field: 'ir_csll_percent', label: 'IR / CSLL' },
  { field: 'commission_percent', label: 'Comissão vendas' },
  { field: 'marketing_percent', label: 'Propaganda' },
  { field: 'freight_percent', label: 'Frete da entrega' },
  { field: 'default_rate_percent', label: 'Inadimplência' },
  { field: 'financial_cost_percent', label: 'Custo financeiro' },
  { field: 'cash_discount_percent', label: 'Desconto à vista (por dentro)' },
  { group: 'IPI na saída', field: 'ipi_tier1_percent', label: 'IPI — faixa 1' },
  { field: 'ipi_tier2_percent', label: 'IPI — faixa 2' },
];

const PARAMS = [
  { field: 'pis_credit_percent', label: 'Crédito de PIS na compra', where: 'Ficha técnica' },
  { field: 'cofins_credit_percent', label: 'Crédito de COFINS na compra', where: 'Ficha técnica' },
  { field: 'icms_credit_imported_percent', label: 'Crédito de ICMS — importado', where: 'Ficha técnica' },
  { field: 'icms_credit_national_percent', label: 'Crédito de ICMS — nacional', where: 'Ficha técnica' },
  { field: 'ir_percent', label: 'IR sobre o lucro', where: 'Markup e tributos' },
  { field: 'csll_percent', label: 'CSLL sobre o lucro', where: 'Markup e tributos' },
  { field: 'outside_discount_percent', label: 'Desconto por fora', where: 'Markup' },
  { field: 'attendance_bonus_percent', label: 'Adicional de assiduidade', where: 'Folha' },
  { field: 'fgts_percent', label: 'FGTS', where: 'Folha' },
  { field: 'fgts_fine_percent', label: 'Multa do FGTS', where: 'Folha' },
];

const PainelSheet = ({ ctx }) => {
  const { painel, savePainel, run, companyId } = ctx;
  const [confirm, confirmDialog] = useConfirm();
  const [newChannel, setNewChannel] = useState(null);
  const [renaming, setRenaming] = useState(null); // { id, name }
  const canais = painel.canais;
  const total = (field) => canais.reduce((acc, c) => acc + Number(c[field] || 0), 0);
  const rateioTotal = Boolean(painel.parametros.rateio_total);

  const setChannel = (id, field, value) => savePainel({ canais: [{ id, [field]: value }] });
  const renameChannel = async () => {
    const name = renaming?.name.trim();
    if (!name) return;
    await savePainel({ canais: [{ id: renaming.id, name }] });
    setRenaming(null);
  };

  const removeChannel = async (c) => {
    const ok = await confirm({
      title: `Excluir o canal “${c.name}”?`,
      description: 'A meta, as alíquotas e a apropriação deste canal serão apagadas. Os preços dele somem da planilha.',
      confirmLabel: 'Excluir canal', danger: true,
    });
    if (ok) run(() => http.delete(`/sales-channels/${c.id}`), ['painel'], `Canal “${c.name}” excluído.`);
  };

  const createChannel = async () => {
    const name = newChannel?.trim();
    if (!name) return;
    setNewChannel(null);
    await run(() => http.post('/sales-channels', { company_id: companyId, name }), ['painel'], `Canal “${name}” criado. Preencha a coluna dele no painel.`);
  };

  const precoDe = (productId, channelId) => painel.precos.find((x) => x.product_id === productId && x.channel_id === channelId);

  return (
    <div className="space-y-8">
      {confirmDialog}

      {/* ---------------------------------------------------------- DIGITÁVEL */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Painel de rateio</h2>
            <p className="text-[13px] text-ink-2 mt-0.5">Uma coluna por canal de venda. As apropriações precisam somar 100% entre os canais.</p>
          </div>
          <Button size="sm" icon={Plus} onClick={() => setNewChannel('')}>Novo canal</Button>
        </div>

        {painel.avisos.length > 0 && (
          <Alert tone="warning" className="mb-3">
            <ul className="list-disc pl-4 space-y-0.5">{painel.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
          </Alert>
        )}

        {canais.length === 0 ? (
          <Alert tone="info">Nenhum canal ainda. Crie os canais em que a empresa vende (ex.: “Vendas B2B dentro do PR”) ou carregue as planilhas.</Alert>
        ) : (
          <SheetFrame>
            <table className="sheet min-w-[860px]">
              <thead>
                <tr>
                  <th className="text-left sticky-col min-w-[240px] align-bottom">Digitável</th>
                  {canais.map((c) => (
                    <th key={c.id} className="text-right min-w-[160px] align-bottom">
                      <span className="block whitespace-normal leading-tight text-ink">{c.name}</span>
                      <span className="flex justify-end gap-0.5 mt-1 -mr-1">
                        <IconButton size="sm" icon={Pencil} label={`Renomear canal ${c.name}`} onClick={() => setRenaming({ id: c.id, name: c.name })} />
                        <IconButton size="sm" variant="danger" icon={Trash2} label={`Excluir canal ${c.name}`} onClick={() => removeChannel(c)} />
                      </span>
                    </th>
                  ))}
                  <th className="text-right w-[130px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const sum = row.sum ? total(row.field) : null;
                  const wrong = row.sum && row.format !== 'money' && Math.abs(sum - 100) > 0.005;
                  return (
                    <React.Fragment key={row.field}>
                      {row.group && <tr className="group"><td colSpan={canais.length + 2}>{row.group}</td></tr>}
                      <tr>
                        <td className="cell sticky-col bg-surface" title={row.hint}>{row.label}</td>
                        {canais.map((c) => (
                          <NumberCell
                            key={c.id}
                            value={Number(c[row.field] || 0)}
                            format={row.format === 'money' ? 'money' : 'percent'}
                            label={`${row.label} — ${c.name}`}
                            onCommit={(v) => setChannel(c.id, row.field, v)}
                          />
                        ))}
                        <CalcCell value={sum} format={row.format === 'money' ? 'money' : 'percent'} strong className={wrong ? '!text-neg' : ''} />
                      </tr>
                    </React.Fragment>
                  );
                })}
                <tr className="group"><td colSpan={canais.length + 2}>Estrutura que cabe a cada canal (calculado)</td></tr>
                {[
                  { key: 'custo_fixo', label: 'Despesas fixas mensais', t: painel.totais_mensais.fixed },
                  { key: 'pro_labore', label: 'Pró-labore', t: painel.totais_mensais.prolabore },
                  { key: 'salarios', label: 'Salários fixos mensais', t: painel.totais_mensais.payroll },
                ].map((row) => (
                  <tr key={row.key}>
                    <td className="cell sticky-col bg-surface">{row.label}</td>
                    {canais.map((c) => (
                      <CalcCell key={c.id} value={c.apropriacao[row.key]} title={Number(c.sales_target) > 0 ? `${pct((c.apropriacao[row.key] / Number(c.sales_target)) * 100)} da meta de venda` : 'Canal sem meta de venda'} />
                    ))}
                    <CalcCell value={row.t} strong />
                  </tr>
                ))}
              </tbody>
            </table>
          </SheetFrame>
        )}
      </section>

      {/* ---------------------------------------------------------- RATEIO POR MODELO */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Rateio das despesas fixas — modelos por ordem de venda</h2>
            <p className="text-[13px] text-ink-2 mt-0.5">Quanto da meta de cada canal vem de cada modelo. Valor de venda atribuído = meta do canal × rateio.</p>
          </div>
          <Toggle
            checked={rateioTotal}
            onChange={(v) => savePainel({ parametros: { rateio_total: v } })}
            label="Rateio total"
            description="Cada modelo absorve 100% da meta e da estrutura (“1 p/ sim” na planilha)"
          />
        </div>
        {painel.produtos.length === 0 ? (
          <Alert tone="info">Nenhum modelo cadastrado. Crie os modelos na aba Fichas técnicas.</Alert>
        ) : (
          <SheetFrame>
            <table className="sheet min-w-[860px]">
              <thead>
                <tr>
                  <th className="text-left sticky-col min-w-[210px]">Modelo</th>
                  {painel.produtos.map((p, i) => <th key={p.id} className="text-right min-w-[96px]">{i + 1}</th>)}
                  <th className="text-right w-[110px]">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="cell sticky-col bg-surface">Código</td>
                  {painel.produtos.map((p) => <CalcCell key={p.id} strong title={p.name}>{p.sku || '—'}</CalcCell>)}
                  <CalcCell>{''}</CalcCell>
                </tr>
                <tr>
                  <td className="cell sticky-col bg-surface">Rateio</td>
                  {painel.produtos.map((p) => (
                    <NumberCell
                      key={p.id}
                      value={Number(p.allocation_percent)}
                      format="percent"
                      disabled={rateioTotal}
                      label={`Rateio do modelo ${p.sku || p.name}`}
                      onCommit={(v) => savePainel({ produtos: [{ id: p.id, allocation_percent: v }] })}
                    />
                  ))}
                  <CalcCell value={rateioTotal ? null : painel.somas.allocation_percent} format="percent" strong className={!rateioTotal && Math.abs(painel.somas.allocation_percent - 100) > 0.005 ? '!text-neg' : ''}>{rateioTotal ? '100% cada' : undefined}</CalcCell>
                </tr>
                <tr>
                  <td className="cell sticky-col bg-surface">Custo de compra</td>
                  {painel.produtos.map((p) => <CalcCell key={p.id} value={p.itens > 0 ? p.custo : null} />)}
                  <CalcCell>{''}</CalcCell>
                </tr>
                <tr className="group"><td colSpan={painel.produtos.length + 2}>Preço de venda sugerido com IPI</td></tr>
                {canais.map((c) => (
                  <tr key={c.id}>
                    <td className="cell sticky-col bg-surface">{c.name}</td>
                    {painel.produtos.map((p) => {
                      const preco = precoDe(p.id, c.id);
                      return (
                        <CalcCell key={p.id} title={preco?.motivo || undefined} strong={preco?.status === 'OK'}>
                          {preco?.status === 'OK' ? brl(preco.preco_venda_com_ipi) : <span className="text-[11px] text-ink-3">{STATUS_LABEL[preco?.status] || '—'}</span>}
                        </CalcCell>
                      );
                    })}
                    <CalcCell>{''}</CalcCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </SheetFrame>
        )}
      </section>

      {/* ---------------------------------------------------------- PARÂMETROS */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink">Parâmetros das planilhas</h2>
        <p className="text-[13px] text-ink-2 mt-0.5 mb-3">Percentuais fixos usados nas outras abas. Normalmente não mudam.</p>
        <SheetFrame>
          <table className="sheet max-w-2xl">
            <thead>
              <tr><th className="text-left">Parâmetro</th><th className="text-left">Usado em</th><th className="text-right w-[140px]">Valor</th></tr>
            </thead>
            <tbody>
              {PARAMS.map((p) => (
                <tr key={p.field}>
                  <td className="cell">{p.label}</td>
                  <td className="calc">{p.where}</td>
                  <NumberCell value={Number(painel.parametros[p.field])} format="percent" label={p.label} onCommit={(v) => savePainel({ parametros: { [p.field]: v } })} />
                </tr>
              ))}
            </tbody>
          </table>
        </SheetFrame>
      </section>

      <Modal
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Renomear canal"
        size="sm"
        footer={<><Button onClick={() => setRenaming(null)}>Cancelar</Button><Button variant="primary" onClick={renameChannel} disabled={!renaming?.name.trim()}>Salvar</Button></>}
      >
        <Field label="Nome do canal">
          <Input autoFocus value={renaming?.name ?? ''} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && renameChannel()} />
        </Field>
      </Modal>

      <Modal
        open={newChannel !== null}
        onClose={() => setNewChannel(null)}
        title="Novo canal de venda"
        description="Vira uma nova coluna do painel. Depois preencha a meta, as apropriações e as alíquotas."
        size="sm"
        footer={<><Button onClick={() => setNewChannel(null)}>Cancelar</Button><Button variant="primary" onClick={createChannel} disabled={!newChannel?.trim()}>Criar canal</Button></>}
      >
        <Field label="Nome do canal">
          <Input autoFocus value={newChannel ?? ''} onChange={(e) => setNewChannel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createChannel()} placeholder="Ex.: Vendas B2B fora do PR" />
        </Field>
      </Modal>
    </div>
  );
};

export default PainelSheet;
