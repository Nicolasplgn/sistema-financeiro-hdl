// Aba FOLHA: "PLANILHA DE CUSTO MENSAL FOLHA", com as mesmas colunas.
import React from 'react';
import { Trash2 } from 'lucide-react';
import http from '../../services/http';
import { IconButton } from '../../components/ui';
import { useConfirm } from '../../components/ui/useConfirm';
import { CalcCell, NumberCell, SheetFrame, TextCell } from '../../components/ui/sheet';
import { money, pct } from '../../utils/format';

const FolhaSheet = ({ ctx }) => {
  const { painel, payroll, run, companyId } = ctx;
  const [confirm, confirmDialog] = useConfirm();
  const canais = painel.canais;
  const p = painel.parametros;
  const parts = ['payroll', 'painel'];
  const total = payroll.reduce((acc, e) => acc + Number(e.total_cost || 0), 0);

  const update = (emp, body) => run(() => http.put(`/payroll/${emp.id}`, body), parts);
  const create = (name) => run(() => http.post('/payroll', { company_id: companyId, employee_name: name, base_salary: 0 }), parts);
  const remove = async (emp) => {
    const ok = await confirm({ title: `Remover ${emp.employee_name}?`, description: 'O custo sai do total da folha e do rateio entre os canais.', confirmLabel: 'Remover', danger: true });
    if (ok) run(() => http.delete(`/payroll/${emp.id}`), parts);
  };

  const sum = (key) => payroll.reduce((acc, e) => acc + Number(e.calculo?.[key] || 0), 0);

  return (
    <div className="space-y-3">
      {confirmDialog}
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Folha de pagamento</h2>
        <p className="text-[13px] text-ink-2 mt-0.5">
          Digite o salário e os adicionais. O sistema calcula assiduidade ({pct(p.attendance_bonus_percent, 0)} do salário), 13º e férias (1/12 cada), 1/3 de férias,
          FGTS ({pct(p.fgts_percent, 0)}) e multa ({pct(p.fgts_fine_percent, 0)} do FGTS).
        </p>
      </div>
      <SheetFrame maxHeight="70vh">
        <table className="sheet min-w-[1900px]">
          <thead className="sticky top-0 z-[3]">
            <tr>
              <th className="text-left sticky-col min-w-[240px]">Nome</th>
              <th className="text-left min-w-[130px]">Cargo / centro de custo</th>
              <th className="text-left w-[130px]">Admissão</th>
              <th className="text-right">Salário</th>
              <th className="text-right">Adic. assiduidade</th>
              <th className="text-right">Horas extras</th>
              <th className="text-right">Gratificação</th>
              <th className="text-right">Comissão</th>
              <th className="text-right">Sal.+grat.+com.</th>
              <th className="text-right">13º</th>
              <th className="text-right">Férias</th>
              <th className="text-right">1/3 férias</th>
              <th className="text-right">FGTS</th>
              <th className="text-right">Multa 40%</th>
              <th className="text-right">Vale transporte</th>
              <th className="text-right">Vale alimentação</th>
              <th className="text-right">Custo</th>
              {canais.map((c) => (
                <th key={c.id} className="text-right">
                  <span className="block">{c.name}</span>
                  <span className="block text-[10px] font-normal normal-case text-ink-3">{pct(Number(c.payroll_share_percent || 0), 0)}</span>
                </th>
              ))}
              <th className="w-10" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {payroll.map((emp) => {
              const c = emp.calculo;
              const n = (field) => (
                <NumberCell value={c ? Number(emp[field] || 0) : null} label={`${field} de ${emp.employee_name}`} min={0} onCommit={(v) => update(emp, { [field]: v })} />
              );
              return (
                <tr key={emp.id}>
                  <TextCell className="sticky-col" value={emp.employee_name} required label="Nome" onCommit={(v) => update(emp, { employee_name: v })} />
                  <TextCell value={emp.role || emp.cost_center || ''} label="Cargo" onCommit={(v) => update(emp, { role: v })} />
                  <td className="input">
                    <input type="date" className="sheet-input" aria-label={`Admissão de ${emp.employee_name}`} defaultValue={emp.admission_date?.slice(0, 10) || ''} key={emp.admission_date || 'vazio'} onBlur={(e) => e.target.value !== (emp.admission_date?.slice(0, 10) || '') && update(emp, { admission_date: e.target.value || null })} />
                  </td>
                  <NumberCell value={c ? Number(emp.base_salary || 0) : null} label={`Salário de ${emp.employee_name}`} min={0} onCommit={(v) => update(emp, { base_salary: v })} />
                  <CalcCell value={c?.adicional_assiduidade} />
                  {n('overtime')}
                  {n('bonus')}
                  {n('commission')}
                  <CalcCell value={c?.remuneracao} />
                  <CalcCell value={c?.decimo_terceiro} />
                  <CalcCell value={c?.ferias} />
                  <CalcCell value={c?.terco_ferias} />
                  <CalcCell value={c?.fgts} />
                  <CalcCell value={c?.multa_fgts} />
                  {n('transport_voucher')}
                  {n('meal_voucher')}
                  {c
                    ? <CalcCell value={emp.total_cost} strong />
                    : <NumberCell value={Number(emp.total_cost)} label={`Custo total de ${emp.employee_name}`} min={0} onCommit={(v) => update(emp, { total_cost: v })} />}
                  {canais.map((ch) => <CalcCell key={ch.id} value={emp.total_cost * Number(ch.payroll_share_percent || 0) / 100} />)}
                  <td className="cell text-center"><IconButton size="sm" variant="danger" icon={Trash2} label={`Remover ${emp.employee_name}`} onClick={() => remove(emp)} /></td>
                </tr>
              );
            })}
            <tr>
              <TextCell key={`novo-${payroll.length}`} className="sticky-col" value="" placeholder="+ novo funcionário" label="Novo funcionário" onCommit={(v) => v && create(v)} />
              <td colSpan={16 + canais.length + 1} className="calc" />
            </tr>
            <tr className="total">
              <td className="cell sticky-col">Total ({payroll.length})</td>
              <td className="cell" /><td className="cell" />
              {['salario', 'adicional_assiduidade', 'horas_extras', 'gratificacao', 'comissao', 'remuneracao', 'decimo_terceiro', 'ferias', 'terco_ferias', 'fgts', 'multa_fgts', 'vale_transporte', 'vale_alimentacao'].map((k) => (
                <td key={k} className="cell text-right num">{money(sum(k))}</td>
              ))}
              <td className="cell text-right num">{money(total)}</td>
              {canais.map((ch) => <td key={ch.id} className="cell text-right num">{money(total * Number(ch.payroll_share_percent || 0) / 100)}</td>)}
              <td className="cell" />
            </tr>
          </tbody>
        </table>
      </SheetFrame>
      <p className="text-xs text-ink-3">
        Para incluir, digite o nome na última linha e depois o salário. Linhas sem salário (cadastros antigos) usam o custo total digitado na coluna “Custo”;
        ao digitar o salário, a linha passa a ser calculada.
      </p>
    </div>
  );
};

export default FolhaSheet;
