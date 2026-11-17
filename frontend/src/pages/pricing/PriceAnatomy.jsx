// Esquema visual da formação do preço (aba MARKUP) e composição de cada R$ 100.
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { brl, pct } from '../../utils/format';
import { composition } from './priceComposition';

const Box = ({ label, value, sub, strong }) => (
  <div className={`rounded-xl border px-4 py-3 min-w-[150px] ${strong ? 'border-brand bg-brand-soft' : 'border-line bg-surface'}`}>
    <p className="text-[11px] font-medium text-ink-3 uppercase tracking-wide">{label}</p>
    <p className={`num font-semibold ${strong ? 'text-2xl text-ink' : 'text-lg text-ink'}`}>{value}</p>
    {sub && <p className="text-[11px] text-ink-2 mt-0.5">{sub}</p>}
  </div>
);

const Op = ({ children }) => (
  <div className="flex flex-col items-center justify-center text-ink-3 px-1 shrink-0">
    <ArrowRight size={16} />
    <span className="text-[11px] num whitespace-nowrap mt-0.5">{children}</span>
  </div>
);

/** Custo → ÷(1 − encargos) → preço → + IPI → ÷(1 − desconto) → preço de tabela. */
export const PriceFlow = ({ m }) => (
  <div className="flex items-stretch gap-1 overflow-x-auto scroll-thin pb-1">
    <Box label="Preço de compra" value={brl(m.preco_compra)} sub="da ficha técnica" />
    <Op>÷ (1 − {pct(m.total_percentual)})</Op>
    <Box label="Preço sugerido" value={brl(m.preco_venda_sugerido)} sub={`encargos de ${pct(m.total_percentual)}`} strong />
    <Op>+ IPI {pct(m.ipi_percentual)}</Op>
    <Box label="Preço com IPI" value={brl(m.preco_venda_com_ipi)} sub={`IPI ${brl(m.ipi_valor)}`} />
    <Op>÷ (1 − {pct(m.desconto_fora_percentual, 0)})</Op>
    <Box label="Preço de tabela" value={brl(m.valor_com_desconto_fora)} sub={`dá ${pct(m.desconto_fora_percentual, 0)} de desconto e volta ao preço`} />
  </div>
);

/** Barra "de cada R$ 100 do preço sugerido". */
export const CompositionBar = ({ m }) => {
  const parts = composition(m);
  return (
    <div>
      <div className="flex h-9 rounded-lg overflow-hidden border border-line">
        {parts.filter((p) => p.percent > 0.05).map((p) => (
          <div key={p.id} className="h-full flex items-center justify-center text-[11px] font-semibold text-white num overflow-hidden" style={{ width: `${p.percent}%`, background: p.color }} title={`${p.label}: ${pct(p.percent, 1)}`}>
            {p.percent >= 6 ? pct(p.percent, 0) : ''}
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {parts.map((p) => (
          <div key={p.id} className="text-sm">
            <p className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} /><span className="font-medium">{p.label}</span></p>
            <p className="num text-ink-2 ml-[18px]">{brl(p.value)} · {pct(p.percent, 1)}</p>
            {p.items.length > 0 && <p className="text-[11px] text-ink-3 ml-[18px] leading-snug">{p.items.map((i) => `${i.label} ${pct(i.percentual, 1)}`).join(' · ')}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
