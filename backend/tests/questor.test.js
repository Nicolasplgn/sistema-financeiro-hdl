'use strict';

/**
 * Leitor do balancete do Questor ("Balancete - Débito Crédito" exportado em CSV).
 * O arquivo de exemplo segue o layout do guia de exportação do Questor:
 * cabeçalho com empresa e período, colunas Conta | S | Classificação |
 * Saldo Ant. | (vazia) | Débito | Crédito | Saldo, linha em branco a cada
 * conta sintética e cabeçalho repetido na quebra de página. Está gravado em
 * Latin-1, como sai do Windows.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const questor = require('../services/import/questorBalancete');
const dre = require('../services/dre/engine');

const buffer = fs.readFileSync(path.join(__dirname, 'fixtures', 'questor_balancete_2026-03.csv'));
const text = questor.decodeText(buffer);

const totals = (mapped) => mapped.reduce((acc, m) => ({ ...acc, [m.column]: (acc[m.column] || 0) + m.value }), {});
const near = (a, b) => Math.abs(a - b) < 0.005;

test('reconhece o layout e o período do arquivo', () => {
    assert.ok(questor.detect(text));
    const r = questor.parse(text);
    assert.equal(r.periodo.mesInicio, '2026-03');
    assert.equal(r.periodo.mesFim, '2026-03');
    assert.equal(r.empresa, 'INDUSTRIA EXEMPLO LTDA');
    assert.ok(r.accounts.some((a) => a.descricao === 'DISPONÍVEL'), 'acentos lidos do arquivo Latin-1');
});

test('números no formato do Questor', () => {
    assert.equal(questor.parseValue('233.921,03'), 233921.03);
    assert.equal(questor.parseValue('0'), 0);
    assert.equal(questor.parseValue('(1.234,50)'), -1234.5);
    assert.equal(questor.parseValue('1.234,50 C'), -1234.5);
    assert.equal(questor.parseValue('1.234,50D'), 1234.5);
    assert.equal(questor.parseValue(''), null);
});

test('soma só as analíticas, e elas fecham com os totais do Questor', () => {
    const r = questor.parse(text);
    assert.ok(r.accounts.find((a) => a.classificacao === '1.1.01.001').sintetica);
    assert.ok(!r.accounts.find((a) => a.classificacao === '1.1.01.001.001').sintetica);
    assert.ok(r.audit.conferencia.confere, JSON.stringify(r.audit.conferencia));
});

test('cada conta de resultado cai na coluna certa', () => {
    const t = totals(questor.parse(text).mapped);
    assert.ok(near(t.revenue_product, 100000 - 2000), 'vendas menos devoluções');
    assert.ok(near(t.revenue_service, 8000));
    assert.ok(near(t.revenue_other, 350), 'rendimento de aplicação');
    assert.ok(near(t.tax_icms, 12000));
    assert.ok(near(t.tax_pis, 1650));
    assert.ok(near(t.tax_cofins, 7600));
    assert.ok(near(t.purchases_total, 40000), 'custo, mesmo sob o grupo "CUSTOS E DESPESAS"');
    assert.ok(near(t.expenses_total, 18000 + 1440 + 4500 + 1000 + 800 + 150), 'despesas, com estorno de energia');
    assert.ok(near(t.tax_irpj, 1500));
    assert.ok(near(t.tax_additional_irpj, 300));
    assert.ok(near(t.tax_csll, 900));
    assert.ok(near(t.patrimonial_movements, 6000), 'pagamento de empréstimo fica fora do resultado');
    assert.equal(t.revenue_resale, undefined);
});

test('lucro do balancete = lucro da DRE montada com ele', () => {
    const r = questor.parse(text);
    const t = totals(r.mapped);
    const entry = { id: 1, period_start: '2026-03-01', ...t };
    const details = r.mapped
        .filter((m) => ['expenses_total', 'purchases_total', 'revenue_other'].includes(m.column))
        .map((m) => ({
            entry_id: 1, type: m.entryType, amount: m.value, description: m.description,
            category_name: { expenses_total: 'Despesas Operacionais (Balancete)', purchases_total: 'CPV / Compras / Fretes (Balancete)', revenue_other: 'Outras Receitas (Balancete)' }[m.column],
        }));
    const d = dre.buildYear({ entries: [entry], details, regime: 'LUCRO_REAL' });
    const line = (id) => d.lines.find((l) => l.id === id).values[2];
    // Receitas 108.000 − devoluções 2.000 + financeira 350 − impostos 21.250 − custo 40.000 − despesas 25.890 − IR/CSLL 2.700
    assert.ok(near(line('lucro_liquido'), 108000 - 2000 + 350 - 21250 - 40000 - 25890 - 2700));
    assert.ok(near(line('desp_pessoal'), -19440));
    assert.ok(near(line('desp_financeiras'), -950));
    assert.ok(near(line('rec_financeiras'), 350));
    assert.ok(d.conferencia.confere);
});

test('arquivo que não é do Questor não é reconhecido', () => {
    assert.equal(questor.detect('ID;Classificação;Tipo;Descrição;Entrada;Saída;Saldo\n1;1;S;RECEITAS;0;0;0'), false);
});
