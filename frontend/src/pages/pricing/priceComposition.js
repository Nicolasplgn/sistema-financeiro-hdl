// Divisão do preço sugerido em custo, impostos, despesas de venda, estrutura e lucro.
export const GROUPS = [
  { id: 'custo', label: 'Custo de compra', color: '#64748b', keys: [] },
  { id: 'tributos', label: 'Impostos sobre a venda', color: '#f59e0b', keys: ['icms', 'difal', 'pis', 'cofins', 'ir_csll'] },
  { id: 'venda', label: 'Despesas de venda', color: '#8b5cf6', keys: ['comissao', 'propaganda', 'frete', 'inadimplencia', 'custo_financeiro', 'desconto_a_vista'] },
  { id: 'estrutura', label: 'Estrutura (rateio)', color: '#3b82f6', keys: ['pro_labore', 'despesas_fixas', 'salarios'] },
  { id: 'lucro', label: 'Lucro antes do IR/CS', color: '#10b981', keys: ['margem_lucro'] },
];

/** Divide o preço sugerido nos grupos acima (em R$ e em % do preço). */
export const composition = (m) => {
  const preco = m.preco_venda_sugerido;
  return GROUPS.map((g) => {
    const percent = g.id === 'custo'
      ? (m.preco_compra / preco) * 100
      : m.encargos.filter((e) => g.keys.includes(e.key)).reduce((a, e) => a + e.percentual, 0);
    return { ...g, percent, value: (preco * percent) / 100, items: m.encargos.filter((e) => g.keys.includes(e.key) && Math.abs(e.percentual) > 0.0001) };
  });
};
