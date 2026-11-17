// Abas CUSTO FIXO e PRO-LABORE: uma linha por item, valor mensal e a parte de
// cada canal (valor × apropriação do canal no painel), como nas planilhas.
import React from 'react';
import { Trash2 } from 'lucide-react';
import http from '../../services/http';
import { IconButton } from '../../components/ui';
import { useConfirm } from '../../components/ui/useConfirm';
import { CalcCell, NumberCell, SheetFrame, TextCell } from '../../components/ui/sheet';
import { pct } from '../../utils/format';

const EstruturaSheet = ({ ctx, config }) => {
  const { painel, run, companyId } = ctx;
  const [confirm, confirmDialog] = useConfirm();
  const rows = ctx[config.dataKey];
  const canais = painel.canais;
  const total = rows.reduce((acc, r) => acc + Number(r[config.valueField] || 0), 0);
  const parts = [config.dataKey, 'painel'];

  const update = (row, body) => run(() => http.put(`/${config.endpoint}/${row.id}`, body), parts);
  const create = (name) => run(() => http.post(`/${config.endpoint}`, { company_id: companyId, [config.nameField]: name, [config.valueField]: 0 }), parts);
  const remove = async (row) => {
    const ok = await confirm({
      title: `Remover “${row[config.nameField]}”?`,
      description: 'O valor sai do total mensal e do rateio entre os canais.',
      confirmLabel: 'Remover', danger: true,
    });
    if (ok) run(() => http.delete(`/${config.endpoint}/${row.id}`), parts);
  };

  return (
    <div className="space-y-3">
      {confirmDialog}
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{config.title}</h2>
        <p className="text-[13px] text-ink-2 mt-0.5">{config.description}</p>
      </div>
      <SheetFrame>
        <table className="sheet min-w-[760px]">
          <thead>
            <tr>
              <th className="text-left sticky-col min-w-[260px]">{config.nameLabel}</th>
              <th className="text-right w-[150px]">Valor mensal</th>
              {canais.map((c) => (
                <th key={c.id} className="text-right min-w-[130px]">
                  <span className="block">{c.name}</span>
                  <span className="block text-[10px] font-normal normal-case text-ink-3">{pct(Number(c[config.shareField] || 0), 0)} do total</span>
                </th>
              ))}
              <th className="w-10" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <TextCell className="sticky-col" value={row[config.nameField]} required label={config.nameLabel} onCommit={(v) => update(row, { [config.nameField]: v })} />
                <NumberCell value={Number(row[config.valueField])} label={`Valor de ${row[config.nameField]}`} min={0} onCommit={(v) => update(row, { [config.valueField]: v })} />
                {canais.map((c) => <CalcCell key={c.id} value={Number(row[config.valueField]) * Number(c[config.shareField] || 0) / 100} />)}
                <td className="cell text-center"><IconButton size="sm" variant="danger" icon={Trash2} label={`Remover ${row[config.nameField]}`} onClick={() => remove(row)} /></td>
              </tr>
            ))}
            <tr>
              <TextCell key={`novo-${rows.length}`} className="sticky-col" value="" placeholder={`+ ${config.newLabel}`} label={config.newLabel} onCommit={(v) => v && create(v)} />
              <CalcCell>{''}</CalcCell>
              {canais.map((c) => <CalcCell key={c.id}>{''}</CalcCell>)}
              <td className="cell" />
            </tr>
            <tr className="total">
              <td className="cell sticky-col">Total ({rows.length})</td>
              <td className="cell text-right num">{total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              {canais.map((c) => (
                <td key={c.id} className="cell text-right num">{(total * Number(c[config.shareField] || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              ))}
              <td className="cell" />
            </tr>
          </tbody>
        </table>
      </SheetFrame>
      <p className="text-xs text-ink-3">
        Para incluir, digite na última linha. Os percentuais de cada canal vêm da linha “{config.shareLabel}” do Painel.
      </p>
    </div>
  );
};

export const CustoFixoSheet = ({ ctx }) => (
  <EstruturaSheet
    ctx={ctx}
    config={{
      title: 'Custo fixo',
      description: 'Despesas que a empresa tem todo mês, independentemente de quanto vende: aluguel, energia, honorários, sistemas…',
      dataKey: 'fixed', endpoint: 'fixed-expenses', nameField: 'name', valueField: 'amount',
      nameLabel: 'Despesa', newLabel: 'nova despesa fixa', shareField: 'fixed_cost_share_percent', shareLabel: 'Apropriação custo fixo',
    }}
  />
);

export const ProLaboreSheet = ({ ctx }) => (
  <EstruturaSheet
    ctx={ctx}
    config={{
      title: 'Pró-labore',
      description: 'Retirada mensal de cada sócio. Entra no preço como estrutura, rateada entre os canais.',
      dataKey: 'prolabore', endpoint: 'prolabore', nameField: 'partner_name', valueField: 'total_cost',
      nameLabel: 'Sócio', newLabel: 'novo sócio', shareField: 'prolabore_share_percent', shareLabel: 'Apropriação pró-labore',
    }}
  />
);
