'use strict';

/**
 * Carrega as planilhas de markup (PAINEL, FICHA TECNICA, CUSTO FIXO, FOLHA,
 * PRO-LABORE) em uma empresa. Substitui os antigos importCSV.js,
 * importChannels.js e restoreChannels.js.
 *
 *   node importPlanilhas.js --conferir
 *       Não toca no banco: lê a pasta, calcula tudo e mostra os preços ao lado
 *       dos que o Excel calculou.
 *
 *   node importPlanilhas.js --empresa=14
 *       Mescla o cadastro das planilhas na empresa 14 (atualiza o que tem o
 *       mesmo nome/código, acrescenta o resto, não apaga nada).
 *
 *   node importPlanilhas.js --empresa=14 --substituir
 *       Apaga antes canais, produtos, insumos, fichas, custos fixos, folha e
 *       pró-labore da empresa 14 e carrega só o que está nas planilhas.
 *
 *   --pasta=CAMINHO   pasta dos CSV (padrão: ./markup_files)
 */

const path = require('path');
const engine = require('./services/pricing/engine');
const planilhas = require('./services/pricing/planilhas');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
};

const brl = (v) => (v === null || v === undefined ? '#DIV/0!' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

function conferir(dados, cadastro) {
    const totais = {
        fixed: cadastro.fixedExpenses.reduce((acc, i) => acc + i.amount, 0),
        prolabore: cadastro.prolabore.reduce((acc, i) => acc + i.total_cost, 0),
        payroll: cadastro.payroll.reduce((acc, emp) => acc + engine.calcFolhaFuncionario(emp, cadastro.settings).custo, 0),
    };

    console.log('\nTOTAIS MENSAIS                 sistema            planilha');
    console.log(`  Custo fixo            ${brl(totais.fixed).padStart(16)}  ${brl(dados.custoFixo?.esperado?.total).padStart(16)}`);
    console.log(`  Folha                 ${brl(totais.payroll).padStart(16)}  ${brl(dados.folha?.esperado?.custo).padStart(16)}`);
    console.log(`  Pró-labore            ${brl(totais.prolabore).padStart(16)}  ${brl(dados.proLabore?.esperado?.total).padStart(16)}`);

    console.log('\nCUSTO DE COMPRA (Lucro Real)   sistema            planilha');
    for (const p of cadastro.products) {
        const ficha = engine.calcFichaTecnica(p.items, cadastro.settings, 'LUCRO_REAL');
        const esperado = dados.fichas[p.sort_order].esperado.custo_lucro_real;
        console.log(`  ${String(p.sort_order).padStart(2)} ${p.sku.padEnd(6)} ${String(p.items.length).padStart(3)} itens  ${brl(ficha.custo).padStart(14)}  ${brl(esperado).padStart(16)}`);
    }

    console.log('\nPREÇO DE VENDA SUGERIDO        sistema            planilha');
    for (const ch of cadastro.channels) {
        for (const p of cadastro.products) {
            const r = engine.calcPreco({
                items: p.items, regime: 'LUCRO_REAL', channel: ch, totals: totais,
                allocationPercent: p.allocation_percent, ipiTier: p.ipi_tiers[ch.key], settings: cadastro.settings,
            });
            const esperado = dados.markups?.[ch.key]?.[p.sort_order]?.preco_venda_sugerido ?? null;
            if (r.markup.status !== 'OK' && esperado === null) continue; // #DIV/0! dos dois lados
            console.log(`  ${ch.name.padEnd(24)} ${p.sku.padEnd(5)} ${brl(r.markup.preco_venda_sugerido).padStart(14)}  ${brl(esperado).padStart(16)}`);
        }
    }
    console.log('  (demais combinações: #DIV/0! na planilha e "sem base" no sistema — canal sem meta ou modelo com 0% de rateio)\n');
}

async function main() {
    const dir = path.resolve(option('pasta') || path.join(__dirname, 'markup_files'));
    const dados = planilhas.readPlanilhasDir(dir);
    const cadastro = planilhas.toCadastro(dados);

    console.log(`Planilhas lidas de ${dir}`);
    console.log(`  ${cadastro.channels.length} canais, ${cadastro.products.length} produtos, ${cadastro.fixedExpenses.length} custos fixos, `
        + `${cadastro.payroll.length} funcionários, ${cadastro.prolabore.length} pró-labores`);
    if (dados.ignorados.length > 0) console.log(`  Arquivos ignorados: ${dados.ignorados.join(', ')}`);

    if (flag('conferir')) { conferir(dados, cadastro); return; }

    const companyId = option('empresa');
    if (!companyId) {
        console.error('\nInforme a empresa: --empresa=ID   (ou use --conferir para só calcular, sem gravar)');
        process.exitCode = 1;
        return;
    }

    const pool = require('./db');
    const { ensurePricingSchema } = require('./services/pricing/schema');
    const { importCadastro } = require('./services/pricing/importer');
    try {
        await ensurePricingSchema(pool);
        const resumo = await importCadastro(pool, companyId, cadastro, { substituir: flag('substituir') });
        console.log(`\nCadastro carregado na empresa ${companyId} (${resumo.substituiu ? 'substituindo o anterior' : 'mesclando com o existente'}):`);
        console.log(JSON.stringify(resumo, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error('\nFalha na importação:', error.message);
    process.exitCode = 1;
});
