'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const dre = require('../services/dre/engine');

const entry = (month, fields) => ({ id: month, period_start: `2026-${String(month).padStart(2, '0')}-01`, ...fields });
const line = (result, id) => result.lines.find((l) => l.id === id);

test('estrutura completa da DRE e lucro igual ao dos lançamentos', () => {
    const r = dre.buildYear({
        regime: 'LUCRO_REAL',
        entries: [entry(1, {
            revenue_product: 100000, revenue_resale: 20000, revenue_service: 5000, revenue_rent: 1000, revenue_other: 3000,
            tax_icms: 12000, tax_difal: 500, tax_pis: 1650, tax_cofins: 7600, tax_iss: 250, tax_fust: 10, tax_funtell: 5,
            tax_irpj: 1500, tax_additional_irpj: 200, tax_csll: 900,
            purchases_total: 40000, expenses_total: 30000,
        })],
        details: [],
    });
    const v = (id) => line(r, id).values[0];
    assert.equal(v('receita_bruta'), 126000);
    assert.equal(v('deducoes'), -22015);
    assert.equal(v('receita_liquida'), 103985);
    assert.equal(v('lucro_bruto'), 63985);
    assert.equal(v('desp_nao_detalhadas'), -30000);
    assert.equal(v('resultado_operacional'), 33985);
    assert.equal(v('outras_receitas'), 3000);
    assert.equal(v('lair'), 36985);
    assert.equal(v('irpj'), -1700);
    assert.equal(v('lucro_liquido'), 36985 - 2600);
    assert.ok(r.conferencia.confere, 'lucro da DRE = lucro dos lançamentos');
    assert.deepEqual(r.conferencia.meses_sem_lancamento, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // A soma das linhas filhas fecha com o grupo
    for (const g of r.lines.filter((l) => l.kind === 'group')) {
        const children = r.lines.filter((l) => l.parent === g.id);
        assert.ok(Math.abs(children.reduce((a, c) => a + c.total, 0) - g.total) < 1e-9, g.id);
    }
});

test('despesas classificadas por natureza e financeiras no resultado financeiro', () => {
    const r = dre.buildYear({
        entries: [entry(4, { revenue_product: 50000, revenue_other: 1000, purchases_total: 10000, expenses_total: 20000 })],
        details: [
            { entry_id: 4, type: 'EXPENSE', amount: 8000, description: 'SALÃ\u0081RIOS ADMINISTRATIVO', category_name: 'Despesas Operacionais (Balancete)' },
            { entry_id: 4, type: 'EXPENSE', amount: 1000, description: 'FGTS', category_name: 'Despesas Operacionais (Balancete)' },
            { entry_id: 4, type: 'EXPENSE', amount: 1500, description: 'COMISSÃO', category_name: 'Despesas Operacionais (Balancete)' },
            { entry_id: 4, type: 'EXPENSE', amount: 2000, description: 'ALUGUEL', category_name: 'Despesas Operacionais (Balancete)' },
            { entry_id: 4, type: 'EXPENSE', amount: 500, description: 'IMPOSTOS E TAXAS', category_name: 'Despesas Operacionais (Balancete)' },
            { entry_id: 4, type: 'EXPENSE', amount: 1200, description: 'JUROS BANCÁRIOS', category_name: 'Despesas Operacionais (Balancete)' },
            { entry_id: 4, type: 'EXPENSE', amount: 300, description: 'TAXAS CARTAO DE CREDITO', category_name: 'Despesas Operacionais (Balancete)' },
            { entry_id: 4, type: 'REVENUE', amount: 400, description: 'RENDIMENTOS DE APLICAÇÃO', category_name: 'Outras Receitas (Balancete)' },
            { entry_id: 4, type: 'REVENUE', amount: 600, description: 'VENDA DE SUCATA', category_name: 'Outras Receitas (Balancete)' },
            { entry_id: 4, type: 'EXPENSE', amount: 10000, description: 'INSUMOS', category_name: 'CPV / Compras / Fretes (Balancete)' },
        ],
    });
    const v = (id) => line(r, id).values[3];
    assert.equal(v('desp_pessoal'), -9000);
    assert.equal(v('desp_comerciais'), -1500);
    assert.equal(v('desp_administrativas'), -2000);
    assert.equal(v('desp_tributarias'), -500);
    assert.equal(v('desp_financeiras'), -1500);
    assert.equal(v('desp_nao_detalhadas'), -(20000 - 14500));
    assert.equal(v('rec_financeiras'), 400);
    assert.equal(v('outras_receitas'), 600);
    assert.equal(v('resultado_financeiro'), -1100);
    assert.ok(r.conferencia.confere);
    assert.equal(Math.round(r.conferencia.despesas_detalhadas_percentual), 73);
    // Texto com acentuação corrigida no analítico
    assert.ok(r.accounts.some((a) => a.description === 'SALÁRIOS ADMINISTRATIVO' && a.line === 'desp_pessoal'));
    assert.ok(r.accounts.some((a) => a.line === 'custo_vendas' && a.total === -10000));
});

test('detalhamento maior que o total lançado não é usado (evita dupla contagem)', () => {
    const r = dre.buildYear({
        entries: [entry(2, { revenue_product: 1000, expenses_total: 100 })],
        details: [{ entry_id: 2, type: 'EXPENSE', amount: 500, description: 'ALUGUEL', category_name: 'Despesas Operacionais (Balancete)' }],
    });
    assert.equal(line(r, 'desp_administrativas').values[1], 0);
    assert.equal(line(r, 'desp_nao_detalhadas').values[1], -100);
    assert.ok(r.conferencia.confere);
});

test('Simples Nacional: a linha do imposto vira DAS', () => {
    assert.equal(dre.structure('SIMPLES').find((l) => l.id === 'ded_icms').label, 'Simples Nacional (DAS)');
    assert.equal(dre.fixMojibake('HONORÃ\u0081RIOS CONTABEIS'), 'HONORÁRIOS CONTABEIS');
    assert.equal(dre.fixMojibake('Texto já certo'), 'Texto já certo');
});
