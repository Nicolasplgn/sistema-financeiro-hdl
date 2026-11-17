'use strict';

/**
 * Confere o motor de precificação contra os números que o Excel calculou nas
 * planilhas de backend/markup_files.
 *
 *   npm test          (dentro de backend/)
 *
 * Tolerâncias: os CSV trazem só o valor exibido (2 casas). Uma célula calculada
 * a partir de uma única célula digitada bate em ±0,0055; somas de várias
 * linhas acumulam o arredondamento de cada parcela.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const engine = require('../services/pricing/engine');
const planilhas = require('../services/pricing/planilhas');

const DIR = path.join(__dirname, '..', 'markup_files');
const dados = planilhas.readPlanilhasDir(DIR);
const cadastro = planilhas.toCadastro(dados);

const CENTAVO = 0.0055;

const perto = (obtido, esperado, tolerancia, rotulo) => {
    assert.ok(
        Math.abs(obtido - esperado) <= tolerancia,
        `${rotulo}: sistema ${obtido} × planilha ${esperado} (tolerância ${tolerancia})`,
    );
};

const totais = {
    fixed: cadastro.fixedExpenses.reduce((acc, i) => acc + i.amount, 0),
    prolabore: cadastro.prolabore.reduce((acc, i) => acc + i.total_cost, 0),
    payroll: cadastro.payroll.reduce((acc, emp) => acc + engine.calcFolhaFuncionario(emp, cadastro.settings).custo, 0),
};
const canal = (key) => cadastro.channels.find((c) => c.key === key);

test('a pasta de planilhas foi lida por inteiro', () => {
    assert.deepEqual(dados.ignorados, []);
    assert.equal(Object.keys(dados.fichas).length, 10);
    assert.equal(cadastro.channels.length, 4);
    for (const key of planilhas.CHANNEL_KEYS) {
        assert.equal(Object.keys(dados.markups[key]).length, 10, `markups ${key}`);
        assert.equal(Object.keys(dados.tributos[key]).length, 10, `tributos ${key}`);
    }
    assert.deepEqual(cadastro.settings, {
        rateio_total: false,
        pis_credit_percent: 1.65,
        cofins_credit_percent: 7.65,
        icms_credit_imported_percent: 4,
        icms_credit_national_percent: 12,
        attendance_bonus_percent: 5,
    });
});

test('PAINEL: apropriações somam 100% e o rateio por modelo soma 100%', () => {
    for (const field of ['fixed_cost_share_percent', 'prolabore_share_percent', 'payroll_share_percent']) {
        assert.equal(cadastro.channels.reduce((acc, c) => acc + c[field], 0), 100, field);
    }
    assert.equal(cadastro.products.reduce((acc, p) => acc + p.allocation_percent, 0), 100);
    assert.deepEqual(cadastro.products.map((p) => p.sku), ['X32', 'X52', 'X42', 'S60', 'S50', 'S40', 'X41', 'KR1', 'R1', 'FREE']);
});

test('FICHA TECNICA: cada linha (IPI, PIS, COFINS, ICMS) bate com a planilha', () => {
    for (const [n, ficha] of Object.entries(dados.fichas)) {
        const calc = engine.calcFichaTecnica(ficha.items, cadastro.settings, 'LUCRO_REAL');
        assert.equal(calc.linhas.length, ficha.items.length);
        calc.linhas.forEach((linha, i) => {
            for (const [campo, esperado] of Object.entries(ficha.items[i].esperado)) {
                if (esperado === null) continue;
                perto(linha[campo], esperado, CENTAVO, `ficha ${n} / ${linha.nome} / ${campo}`);
            }
        });
    }
});

test('FICHA TECNICA: totais e custos (Lucro Real e Lucro Presumido) dos 10 modelos', () => {
    for (const [n, ficha] of Object.entries(dados.fichas)) {
        const calc = engine.calcFichaTecnica(ficha.items, cadastro.settings, 'LUCRO_REAL');
        const e = ficha.esperado;
        // Somas de até 41 linhas digitadas com 2 casas: folga de 2 centavos.
        const folga = 0.02;
        perto(calc.totais.importado, e.importado, folga, `ficha ${n} importado`);
        perto(calc.totais.nacional, e.nacional, folga, `ficha ${n} nacional`);
        perto(calc.totais.com_ipi, e.com_ipi, folga, `ficha ${n} com IPI`);
        perto(calc.totais.ipi, e.ipi, folga, `ficha ${n} crédito IPI`);
        perto(calc.totais.pis_importado + calc.totais.pis_nacional, e.pis_importado + e.pis_nacional, folga, `ficha ${n} PIS`);
        perto(calc.totais.cofins_importado + calc.totais.cofins_nacional, e.cofins_importado + e.cofins_nacional, folga, `ficha ${n} COFINS`);
        perto(calc.totais.icms_importado, e.icms_importado, folga, `ficha ${n} ICMS importado`);
        perto(calc.totais.icms_nacional, e.icms_nacional, folga, `ficha ${n} ICMS nacional`);
        perto(calc.custos.lucro_real, e.custo_lucro_real, folga, `ficha ${n} custo Lucro Real`);
        perto(calc.custos.lucro_presumido, e.custo_lucro_presumido, folga, `ficha ${n} custo Lucro Presumido`);
    }
});

test('FICHA TECNICA: o regime da empresa escolhe o custo e os créditos', () => {
    const itens = dados.fichas[2].items;
    const real = engine.calcFichaTecnica(itens, cadastro.settings, 'LUCRO_REAL');
    const presumido = engine.calcFichaTecnica(itens, cadastro.settings, 'LUCRO_PRESUMIDO');
    const simples = engine.calcFichaTecnica(itens, cadastro.settings, 'SIMPLES');
    assert.equal(real.custo, real.custos.lucro_real);
    assert.equal(presumido.custo, presumido.custos.lucro_presumido);
    assert.equal(simples.custo, simples.totais.com_ipi);
    assert.equal(presumido.creditos.pis, 0);
    assert.equal(presumido.creditos.cofins, 0);
    assert.ok(presumido.creditos.icms > 0 && presumido.creditos.ipi > 0);
    assert.deepEqual(simples.creditos, { ipi: 0, pis: 0, cofins: 0, icms: 0 });
});

test('FOLHA: custo de cada funcionário e total da folha', () => {
    assert.equal(dados.folha.employees.length, 22);
    for (const emp of dados.folha.employees) {
        const calc = engine.calcFolhaFuncionario(emp, cadastro.settings);
        for (const [campo, esperado] of Object.entries(emp.esperado)) {
            perto(calc[campo], esperado, CENTAVO, `folha / ${emp.employee_name} / ${campo}`);
        }
    }
    perto(totais.payroll, dados.folha.esperado.custo, CENTAVO, 'total da folha');
});

test('CUSTO FIXO, PRO-LABORE e FOLHA: apropriação por canal', () => {
    perto(totais.fixed, dados.custoFixo.esperado.total, CENTAVO, 'total custo fixo');
    perto(totais.prolabore, dados.proLabore.esperado.total, CENTAVO, 'total pró-labore');
    cadastro.channels.forEach((ch, i) => {
        const ap = engine.calcApropriacaoCanal(ch, totais);
        perto(ap.custo_fixo, dados.custoFixo.esperado.por_canal[i], CENTAVO, `custo fixo ${ch.key}`);
        perto(ap.pro_labore, dados.proLabore.esperado.por_canal[i], CENTAVO, `pró-labore ${ch.key}`);
        perto(ap.salarios, dados.folha.esperado.por_canal[i], CENTAVO, `folha ${ch.key}`);
    });
    // Cada despesa fixa, linha a linha, nos quatro canais.
    for (const item of dados.custoFixo.items) {
        cadastro.channels.forEach((ch, i) => {
            perto(item.amount * ch.fixed_cost_share_percent / 100, item.esperado_por_canal[i], CENTAVO, `${item.name} ${ch.key}`);
        });
    }
});

/** Os dois markups que a planilha consegue calcular (modelo 1 nos canais com meta). */
for (const key of ['B2B_PR', 'B2B_FORA']) {
    test(`MARKUP ${key} 1: encargos, preço sugerido, desconto e quantidade`, () => {
        const esperado = dados.markups[key][1];
        const produto = cadastro.products[0];
        const m = engine.calcMarkup({
            custoCompra: esperado.preco_compra, // custo com a precisão que o Excel exibe
            channel: canal(key), totals: totais,
            allocationPercent: produto.allocation_percent,
            ipiTier: produto.ipi_tiers[key],
            settings: cadastro.settings,
        });
        assert.equal(m.status, 'OK');
        assert.equal(m.ipi_faixa, esperado.ipi_faixa);
        perto(m.valor_venda_atribuido, esperado.valor_venda_atribuido, CENTAVO, 'valor atribuído');
        for (const enc of m.encargos) {
            const e = esperado.encargos[enc.key];
            assert.ok(e, `encargo ${enc.key} existe na planilha`);
            if (e.valor !== null) perto(enc.valor, e.valor, CENTAVO, `${enc.key} valor`);
            // "DESPESAS FIXAS MENSAIS" é exibida sem casas decimais (10% / 7%).
            perto(enc.percentual, e.percentual, enc.key === 'despesas_fixas' ? 0.5 : CENTAVO, `${enc.key} %`);
        }
        perto(m.total_percentual, esperado.total_percentual, CENTAVO, 'total %');
        perto(m.preco_venda_sugerido, esperado.preco_venda_sugerido, CENTAVO, 'preço de venda sugerido');
        perto(m.ipi_valor, esperado.ipi_valor, CENTAVO, 'IPI');
        perto(m.preco_venda_com_ipi, esperado.preco_venda_com_ipi, CENTAVO, 'preço com IPI');
        perto(m.valor_com_desconto_fora, esperado.valor_com_desconto_fora, CENTAVO, 'valor com desconto por fora');
        perto(m.desconto_fora_valor, esperado.desconto_fora_valor, CENTAVO, 'desconto');
        perto(m.valor_venda_liquido, esperado.valor_venda_liquido, CENTAVO, 'valor líquido');
        // Exibida sem casas e calculada com o custo de 2 casas: folga de 1 unidade.
        perto(m.quantidade_mes, esperado.quantidade_mes, 1, 'quantidade/mês');
        perto(m.lucro.liquido_total, esperado.lucro.liquido_total, CENTAVO, 'lucro líquido');
    });

    test(`TRIBUTOS ${key} 1: venda, compra e imposto devido`, () => {
        const esperado = dados.tributos[key][1];
        const ficha = engine.calcFichaTecnica(dados.fichas[1].items, cadastro.settings, 'LUCRO_REAL');
        const markup = engine.calcMarkup({
            custoCompra: dados.markups[key][1].preco_compra,
            channel: canal(key), totals: totais, allocationPercent: 100, ipiTier: 2, settings: cadastro.settings,
        });
        const t = engine.calcTributos({ markup, ficha, channel: canal(key), settings: cadastro.settings });
        assert.equal(t.status, 'OK');
        for (const campo of ['preco_venda', 'ipi', 'pis', 'cofins', 'difal', 'icms', 'total']) {
            perto(t.venda[campo], esperado.venda[campo], CENTAVO, `venda ${campo}`);
        }
        // Devido = venda − crédito da ficha; a ficha 1 tem casas escondidas no Excel.
        for (const campo of ['ipi', 'pis', 'cofins', 'difal', 'icms', 'total_impostos', 'ir', 'csll', 'total']) {
            perto(t.devido[campo], esperado.devido[campo], 0.011, `devido ${campo}`);
        }
        perto(t.devido.aliquota_efetiva, esperado.devido.aliquota_efetiva, 0.011, 'alíquota efetiva');
    });
}

test('TRIBUTOS: créditos da compra dos 10 modelos (total sem ICMS, como na planilha)', () => {
    // ERRO DA PLANILHA: a aba "TRIBUTOS online9" busca os créditos na FICHA
    // TECNICA 8 (IPI 36,97) em vez da 9 (IPI 36,44). As outras 39 abas apontam
    // para a ficha do próprio modelo. O sistema usa sempre a ficha do modelo;
    // aqui a conferência dessa aba é feita contra a ficha 8 para registrar o desvio.
    const fichaUsadaPelaPlanilha = (key, n) => (key === 'ONLINE' && Number(n) === 9 ? 8 : n);

    for (const key of planilhas.CHANNEL_KEYS) {
        for (const [n, esperado] of Object.entries(dados.tributos[key])) {
            const ficha = engine.calcFichaTecnica(dados.fichas[fichaUsadaPelaPlanilha(key, n)].items, cadastro.settings, 'LUCRO_REAL');
            const t = engine.calcTributos({ markup: null, ficha, channel: canal(key), settings: cadastro.settings });
            const folga = 0.02;
            perto(t.compra.ipi, esperado.compra.ipi, folga, `${key} ${n} IPI`);
            perto(t.compra.pis, esperado.compra.pis, folga, `${key} ${n} PIS`);
            perto(t.compra.cofins, esperado.compra.cofins, folga, `${key} ${n} COFINS`);
            perto(t.compra.icms, esperado.compra.icms, folga, `${key} ${n} ICMS`);
            perto(t.compra.total, esperado.compra.total, folga, `${key} ${n} total`);
        }
    }
});

test('onde a planilha mostra #DIV/0! o sistema devolve SEM_BASE, sem preço', () => {
    let semBase = 0;
    for (const key of planilhas.CHANNEL_KEYS) {
        for (const produto of cadastro.products) {
            const esperado = dados.markups[key][produto.sort_order];
            const ficha = engine.calcFichaTecnica(produto.items, cadastro.settings, 'LUCRO_REAL');
            const m = engine.calcMarkup({
                custoCompra: ficha.custo, channel: canal(key), totals: totais,
                allocationPercent: produto.allocation_percent, ipiTier: produto.ipi_tiers[key],
                settings: cadastro.settings,
            });
            if (esperado.preco_venda_sugerido === null) {
                semBase++;
                assert.equal(m.status, 'SEM_BASE', `${key} ${produto.sort_order}`);
                assert.equal(m.preco_venda_sugerido, null);
                assert.equal(m.quantidade_mes, null);
            } else {
                assert.equal(m.status, 'OK', `${key} ${produto.sort_order}`);
            }
            // Dados que a planilha exibe mesmo sem preço.
            perto(m.preco_compra, esperado.preco_compra, 0.02, `${key} ${produto.sort_order} preço de compra`);
            perto(m.ipi_percentual, esperado.ipi_percentual, CENTAVO, `${key} ${produto.sort_order} IPI %`);
            perto(m.valor_venda_atribuido, esperado.valor_venda_atribuido, CENTAVO, `${key} ${produto.sort_order} valor atribuído`);
        }
    }
    assert.equal(semBase, 38);
});

test('ponta a ponta a partir dos CSV: preço do modelo 1 dentro de 0,25% da planilha', () => {
    // A ficha 1 soma R$ 7,00 com os valores exibidos e R$ 7,01 no Excel (casas
    // escondidas), então o preço final difere alguns centavos.
    for (const key of ['B2B_PR', 'B2B_FORA']) {
        const produto = cadastro.products[0];
        const r = engine.calcPreco({
            items: produto.items, regime: 'LUCRO_REAL', channel: canal(key), totals: totais,
            allocationPercent: produto.allocation_percent, ipiTier: produto.ipi_tiers[key], settings: cadastro.settings,
        });
        const esperado = dados.markups[key][1].preco_venda_sugerido;
        perto(r.markup.preco_venda_sugerido, esperado, esperado * 0.0025, `preço ${key}`);
    }
});

test('MARKUP: margem de lucro, IPI por faixa, rateio total e casos sem solução', () => {
    const ch = { ...canal('EXPORTACAO'), sales_target: 100000, fixed_cost_share_percent: 10, prolabore_share_percent: 10, payroll_share_percent: 10 };
    const m = engine.calcMarkup({ custoCompra: 397.34, channel: ch, totals: totais, allocationPercent: 50, ipiTier: 1, settings: cadastro.settings });
    assert.equal(m.status, 'OK');
    assert.equal(m.valor_venda_atribuido, 50000);
    assert.equal(m.ipi_percentual, 7.5);
    perto(m.preco_venda_com_ipi, m.preco_venda_sugerido * 1.075, 1e-9, 'IPI faixa 1');
    perto(m.lucro.antes_ir_cs, m.preco_venda_sugerido * 0.05, 1e-9, 'lucro antes do IR/CS');
    perto(m.lucro.ir_cs, m.lucro.antes_ir_cs * 0.24, 1e-9, 'IR 15% + CSLL 9%');
    perto(m.lucro.liquido_total, m.lucro.liquido_unitario * m.quantidade_mes, 1e-6, 'lucro líquido total');
    // O preço é a soma exata de custo + todos os encargos + margem.
    const somaEncargos = m.encargos.reduce((acc, e) => acc + m.preco_venda_sugerido * e.percentual / 100, 0);
    perto(m.preco_compra + somaEncargos, m.preco_venda_sugerido, 1e-9, 'fechamento do preço');

    // O rateio do modelo não muda o preço (só valores absolutos e quantidade).
    const faixa2 = engine.calcMarkup({ custoCompra: 397.34, channel: ch, totals: totais, allocationPercent: 20, ipiTier: 2, settings: cadastro.settings });
    perto(faixa2.preco_venda_sugerido, m.preco_venda_sugerido, 1e-9, 'preço independe do rateio');
    assert.equal(faixa2.ipi_percentual, 10);

    const total = engine.calcMarkup({ custoCompra: 397.34, channel: ch, totals: totais, allocationPercent: 0, ipiTier: 2, settings: { ...cadastro.settings, rateio_total: true } });
    assert.equal(total.status, 'OK');
    assert.equal(total.valor_venda_atribuido, 100000);

    const inviavel = engine.calcMarkup({ custoCompra: 10, channel: { ...ch, commission_percent: 95 }, totals: totais, allocationPercent: 100, settings: cadastro.settings });
    assert.equal(inviavel.status, 'INVIAVEL');
    assert.equal(inviavel.preco_venda_sugerido, null);

    const semCusto = engine.calcMarkup({ custoCompra: 0, channel: ch, totals: totais, allocationPercent: 100, settings: cadastro.settings });
    assert.equal(semCusto.status, 'SEM_CUSTO');
});
