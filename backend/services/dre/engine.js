'use strict';

/**
 * DRE — DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO
 * ---------------------------------------------------------------------------
 * Monta a DRE na estrutura do art. 187 da Lei 6.404/76 e do CPC 26 a partir
 * dos lançamentos mensais (monthly_entries) e do detalhamento por conta
 * (entry_details, vindo dos balancetes importados ou digitado).
 *
 * O lucro líquido final é exatamente o mesmo resultado dos lançamentos
 * (receitas − tributos − compras − despesas); a DRE só reorganiza os valores
 * nas linhas contábeis. Isso é conferido em `conferencia`.
 *
 * Valores: positivos = soma no resultado; negativos = reduzem o resultado.
 */

const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

/** Corrige texto UTF-8 que foi gravado como Latin-1 ("SALÃRIOS" → "SALÁRIOS"). */
function fixMojibake(text) {
    const s = String(text ?? '');
    if (!/[ÃÂ][\u0080-ÿ]/.test(s)) return s.replace(/\s+/g, ' ').trim();
    try {
        const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return decoded.replace(/\s+/g, ' ').trim();
    } catch {
        return s.replace(/\s+/g, ' ').trim();
    }
}

const normalize = (s) => fixMojibake(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// -----------------------------------------------------------------------------
// Classificação das contas de despesa e de "outras receitas" por natureza
// -----------------------------------------------------------------------------

const EXPENSE_GROUPS = Object.freeze([
    {
        id: 'desp_financeiras',
        label: 'Despesas financeiras',
        test: /JUROS|TARIFA|DESPESAS? BANC|IOF|MA?U?NUTENCAO DE CONTA|CONTA CORRENTE|ENCARGOS? FINANC|PRESTAMISTA|EMPRESTIMO|FINANCIAMENTO|TAXAS? (DE )?CARTAO|CARTAO DE CREDITO|ANTECIPACAO|DESCONTOS? CONCEDIDO|VARIACAO CAMBIAL PASSIVA|MULTA DE MORA/,
    },
    {
        id: 'desp_pessoal',
        label: 'Despesas com pessoal',
        test: /SALARI|ORDENADO|FGTS|INSS|VALE|PRO.?LABORE|FERIAS|13|DECIMO|RESCIS|EXAME|MEDICINA|LAUDO|REFEIC|ALIMENTA|TRANSPORTE|SEGURO DE VIDA|UNIFORME|\bEPI|GRATIFIC|HORAS? EXTRA|BENEFICIO|PLANO DE SAUDE|ASSISTENCIA MEDICA|ESTAGI|TREINAMENTO/,
    },
    {
        id: 'desp_comerciais',
        label: 'Despesas comerciais',
        test: /COMISS|FRETES? (S\/|SOBRE )?VENDA|PUBLICIDADE|PROPAGANDA|MARKETING|BRINDE|COMERCIAL|VIAGE|REPRESENTA|FEIRA|AMOSTRA|MARKETPLACE/,
    },
    {
        id: 'desp_tributarias',
        label: 'Despesas tributárias',
        test: /IMPOSTO|TAXAS?\b|IPTU|IPVA|ALVARA|MULTA|CONTRIBUICAO SINDICAL|SINDICA|EMOLUMENTO/,
    },
]);
const DEFAULT_EXPENSE_GROUP = { id: 'desp_administrativas', label: 'Despesas administrativas e gerais' };

const FINANCIAL_REVENUE = /RENDIMENT|JUROS|APLICAC|DESCONTOS? OBTIDO|VARIACAO CAMBIAL ATIVA|RECEITAS? FINANC/;

function classifyExpense(description) {
    const d = normalize(description);
    const group = EXPENSE_GROUPS.find((g) => g.test.test(d));
    return group ? { id: group.id, label: group.label } : DEFAULT_EXPENSE_GROUP;
}

function classifyOtherRevenue(description) {
    return FINANCIAL_REVENUE.test(normalize(description))
        ? { id: 'rec_financeiras', label: 'Receitas financeiras' }
        : { id: 'outras_receitas', label: 'Outras receitas' };
}

// Categorias criadas pela importação de balancete → em que coluna caem.
const CATEGORY_COLUMN = [
    { test: /^DESPESAS OPERACIONAIS/, column: 'expenses_total' },
    { test: /^CPV|COMPRAS/, column: 'purchases_total' },
    { test: /^OUTRAS RECEITAS/, column: 'revenue_other' },
];

function detailColumn(detail) {
    const cat = normalize(detail.category_name || '');
    const hit = CATEGORY_COLUMN.find((c) => c.test.test(cat));
    if (hit) return hit.column;
    // Detalhe digitado à mão: saída sem categoria de balancete conta como despesa operacional
    if (detail.type === 'EXPENSE' && !/\(BALANCETE\)/.test(cat)) return 'expenses_total';
    return null;
}

// -----------------------------------------------------------------------------
// Estrutura da DRE
// -----------------------------------------------------------------------------

/**
 * kind: 'group' (título com filhos), 'item', 'subtotal', 'result'
 * sign: +1 receita, −1 dedução/custo/despesa (o valor já sai com sinal)
 */
function structure(regime) {
    const simples = regime === 'SIMPLES';
    return [
        { id: 'receita_bruta', code: '1', label: 'RECEITA OPERACIONAL BRUTA', kind: 'group' },
        { id: 'rec_produtos', code: '1.1', label: 'Venda de produtos', parent: 'receita_bruta', kind: 'item' },
        { id: 'rec_mercadorias', code: '1.2', label: 'Revenda de mercadorias', parent: 'receita_bruta', kind: 'item' },
        { id: 'rec_servicos', code: '1.3', label: 'Prestação de serviços', parent: 'receita_bruta', kind: 'item' },
        { id: 'rec_alugueis', code: '1.4', label: 'Receita de aluguéis', parent: 'receita_bruta', kind: 'item' },

        { id: 'deducoes', code: '2', label: '(−) DEDUÇÕES DA RECEITA BRUTA', kind: 'group' },
        { id: 'ded_icms', code: '2.1', label: simples ? 'Simples Nacional (DAS)' : 'ICMS sobre vendas', parent: 'deducoes', kind: 'item' },
        { id: 'ded_difal', code: '2.2', label: 'ICMS DIFAL', parent: 'deducoes', kind: 'item' },
        { id: 'ded_pis', code: '2.3', label: 'PIS sobre faturamento', parent: 'deducoes', kind: 'item' },
        { id: 'ded_cofins', code: '2.4', label: 'COFINS sobre faturamento', parent: 'deducoes', kind: 'item' },
        { id: 'ded_iss', code: '2.5', label: 'ISS sobre serviços', parent: 'deducoes', kind: 'item' },
        { id: 'ded_telecom', code: '2.6', label: 'FUST / FUNTTEL', parent: 'deducoes', kind: 'item' },

        { id: 'receita_liquida', code: '3', label: '(=) RECEITA OPERACIONAL LÍQUIDA', kind: 'subtotal' },

        { id: 'custos', code: '4', label: '(−) CUSTO DAS VENDAS (CPV / CMV / CSP)', kind: 'group' },
        { id: 'custo_vendas', code: '4.1', label: 'Custo dos produtos, mercadorias e serviços vendidos', parent: 'custos', kind: 'item' },

        { id: 'lucro_bruto', code: '5', label: '(=) LUCRO BRUTO', kind: 'subtotal' },

        { id: 'despesas', code: '6', label: '(−) DESPESAS OPERACIONAIS', kind: 'group' },
        { id: 'desp_pessoal', code: '6.1', label: 'Despesas com pessoal', parent: 'despesas', kind: 'item' },
        { id: 'desp_comerciais', code: '6.2', label: 'Despesas comerciais', parent: 'despesas', kind: 'item' },
        { id: 'desp_administrativas', code: '6.3', label: 'Despesas administrativas e gerais', parent: 'despesas', kind: 'item' },
        { id: 'desp_tributarias', code: '6.4', label: 'Despesas tributárias', parent: 'despesas', kind: 'item' },
        { id: 'desp_nao_detalhadas', code: '6.5', label: 'Despesas operacionais sem detalhamento', parent: 'despesas', kind: 'item' },

        { id: 'resultado_operacional', code: '7', label: '(=) RESULTADO OPERACIONAL (EBIT)', kind: 'subtotal' },

        { id: 'resultado_financeiro', code: '8', label: '(±) RESULTADO FINANCEIRO', kind: 'group' },
        { id: 'rec_financeiras', code: '8.1', label: 'Receitas financeiras', parent: 'resultado_financeiro', kind: 'item' },
        { id: 'desp_financeiras', code: '8.2', label: '(−) Despesas financeiras', parent: 'resultado_financeiro', kind: 'item' },

        { id: 'outros_resultados', code: '9', label: '(±) OUTRAS RECEITAS E DESPESAS', kind: 'group' },
        { id: 'outras_receitas', code: '9.1', label: 'Outras receitas', parent: 'outros_resultados', kind: 'item' },

        { id: 'lair', code: '10', label: '(=) RESULTADO ANTES DO IR E DA CSLL', kind: 'subtotal' },

        { id: 'tributos_lucro', code: '11', label: '(−) PROVISÃO PARA IR E CSLL', kind: 'group' },
        { id: 'irpj', code: '11.1', label: 'IRPJ (inclui adicional)', parent: 'tributos_lucro', kind: 'item' },
        { id: 'csll', code: '11.2', label: 'CSLL', parent: 'tributos_lucro', kind: 'item' },

        { id: 'lucro_liquido', code: '12', label: '(=) LUCRO (PREJUÍZO) LÍQUIDO DO EXERCÍCIO', kind: 'result' },
    ];
}

/** Valores de um mês, já com sinal, por id de linha. */
function monthValues(entry, details) {
    const v = {};
    const e = entry || {};
    v.rec_produtos = num(e.revenue_product);
    v.rec_mercadorias = num(e.revenue_resale);
    v.rec_servicos = num(e.revenue_service);
    v.rec_alugueis = num(e.revenue_rent);
    v.ded_icms = -num(e.tax_icms);
    v.ded_difal = -num(e.tax_difal);
    v.ded_pis = -num(e.tax_pis);
    v.ded_cofins = -num(e.tax_cofins);
    v.ded_iss = -num(e.tax_iss);
    v.ded_telecom = -(num(e.tax_fust) + num(e.tax_funtell));
    v.custo_vendas = -num(e.purchases_total);
    v.irpj = -(num(e.tax_irpj) + num(e.tax_additional_irpj));
    v.csll = -num(e.tax_csll);

    // Despesas operacionais: detalhamento por natureza, limitado ao total lançado.
    const expensesTotal = num(e.expenses_total);
    const expenseDetails = details.filter((d) => detailColumn(d) === 'expenses_total' && num(d.amount) > 0);
    const detailedSum = expenseDetails.reduce((acc, d) => acc + num(d.amount), 0);
    const groups = { desp_pessoal: 0, desp_comerciais: 0, desp_administrativas: 0, desp_tributarias: 0, desp_financeiras: 0 };
    const accounts = [];
    let expenseCoverage = 0;
    if (expenseDetails.length > 0 && detailedSum <= expensesTotal + 0.01) {
        for (const d of expenseDetails) {
            const g = classifyExpense(d.description || d.category_name);
            groups[g.id] += num(d.amount);
            accounts.push({ line: g.id, description: fixMojibake(d.description || d.category_name), amount: -num(d.amount) });
        }
        expenseCoverage = detailedSum;
    }
    v.desp_pessoal = -groups.desp_pessoal;
    v.desp_comerciais = -groups.desp_comerciais;
    v.desp_administrativas = -groups.desp_administrativas;
    v.desp_tributarias = -groups.desp_tributarias;
    v.desp_financeiras = -groups.desp_financeiras;
    v.desp_nao_detalhadas = -(expensesTotal - expenseCoverage);

    // Outras receitas: separa as financeiras quando o detalhamento permite.
    const otherTotal = num(e.revenue_other);
    const otherDetails = details.filter((d) => detailColumn(d) === 'revenue_other' && num(d.amount) > 0);
    const otherSum = otherDetails.reduce((acc, d) => acc + num(d.amount), 0);
    let finRevenue = 0;
    if (otherDetails.length > 0 && otherSum <= otherTotal + 0.01) {
        for (const d of otherDetails) {
            const g = classifyOtherRevenue(d.description);
            if (g.id === 'rec_financeiras') finRevenue += num(d.amount);
            accounts.push({ line: g.id, description: fixMojibake(d.description || d.category_name), amount: num(d.amount) });
        }
    }
    v.rec_financeiras = finRevenue;
    v.outras_receitas = otherTotal - finRevenue;

    // Custo das vendas: contas do balancete, só para o detalhamento.
    const costDetails = details.filter((d) => detailColumn(d) === 'purchases_total' && num(d.amount) > 0);
    const costSum = costDetails.reduce((acc, d) => acc + num(d.amount), 0);
    if (costDetails.length > 0 && costSum <= num(e.purchases_total) + 0.01) {
        for (const d of costDetails) accounts.push({ line: 'custo_vendas', description: fixMojibake(d.description || d.category_name), amount: -num(d.amount) });
    }

    // Subtotais
    const sum = (ids) => ids.reduce((acc, id) => acc + v[id], 0);
    v.receita_bruta = sum(['rec_produtos', 'rec_mercadorias', 'rec_servicos', 'rec_alugueis']);
    v.deducoes = sum(['ded_icms', 'ded_difal', 'ded_pis', 'ded_cofins', 'ded_iss', 'ded_telecom']);
    v.receita_liquida = v.receita_bruta + v.deducoes;
    v.custos = v.custo_vendas;
    v.lucro_bruto = v.receita_liquida + v.custos;
    v.despesas = sum(['desp_pessoal', 'desp_comerciais', 'desp_administrativas', 'desp_tributarias', 'desp_nao_detalhadas']);
    v.resultado_operacional = v.lucro_bruto + v.despesas;
    v.resultado_financeiro = v.rec_financeiras + v.desp_financeiras;
    v.outros_resultados = v.outras_receitas;
    v.lair = v.resultado_operacional + v.resultado_financeiro + v.outros_resultados;
    v.tributos_lucro = v.irpj + v.csll;
    v.lucro_liquido = v.lair + v.tributos_lucro;

    // Sem "-0" nas células vazias
    for (const k of Object.keys(v)) if (v[k] === 0) v[k] = 0;

    // Resultado conforme os lançamentos (para conferência)
    const taxesAll = ['tax_icms', 'tax_difal', 'tax_iss', 'tax_pis', 'tax_cofins', 'tax_csll', 'tax_irpj', 'tax_additional_irpj', 'tax_fust', 'tax_funtell']
        .reduce((acc, k) => acc + num(e[k]), 0);
    const lancamentos = num(e.revenue_product) + num(e.revenue_resale) + num(e.revenue_service) + num(e.revenue_rent) + num(e.revenue_other)
        - taxesAll - num(e.purchases_total) - expensesTotal;

    return {
        values: v,
        accounts,
        lancamentos,
        expensesTotal,
        expenseCoverage,
        patrimonial: num(e.patrimonial_movements),
    };
}

/**
 * @param {object} p
 * @param {Array} p.entries   monthly_entries do ano (com period_start)
 * @param {Array} p.details   entry_details do ano (com entry_id, category_name, type, amount, description)
 * @param {string} p.regime
 */
function buildYear({ entries = [], details = [], regime = 'LUCRO_REAL' }) {
    const lines = structure(regime);
    const byMonth = Array.from({ length: 12 }, () => null);
    for (const e of entries) {
        const m = e.period_start instanceof Date ? e.period_start.getMonth() : Number(String(e.period_start).slice(5, 7)) - 1;
        if (m >= 0 && m < 12) byMonth[m] = e;
    }
    const detailsByEntry = new Map();
    for (const d of details) {
        if (!detailsByEntry.has(d.entry_id)) detailsByEntry.set(d.entry_id, []);
        detailsByEntry.get(d.entry_id).push(d);
    }

    const months = byMonth.map((e, i) => {
        const r = monthValues(e, e ? detailsByEntry.get(e.id) || [] : []);
        return {
            month: i + 1,
            hasEntry: Boolean(e),
            hasDetails: r.expenseCoverage > 0,
            ...r,
        };
    });

    const out = lines.map((line) => {
        const values = months.map((m) => m.values[line.id] ?? 0);
        return { ...line, values, total: values.reduce((a, b) => a + b, 0) };
    });

    // Contas (analítico), consolidadas por linha + descrição, com os 12 meses
    const accountMap = new Map();
    months.forEach((m, i) => {
        for (const a of m.accounts) {
            const key = `${a.line}|${normalize(a.description)}`;
            if (!accountMap.has(key)) accountMap.set(key, { line: a.line, description: a.description, values: Array(12).fill(0) });
            accountMap.get(key).values[i] += a.amount;
        }
    });
    const accounts = [...accountMap.values()]
        .map((a) => ({ ...a, total: a.values.reduce((x, y) => x + y, 0) }))
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    const totalLancamentos = months.reduce((a, m) => a + m.lancamentos, 0);
    const lucro = out.find((l) => l.id === 'lucro_liquido').total;
    const expensesTotal = months.reduce((a, m) => a + m.expensesTotal, 0);
    const expenseCoverage = months.reduce((a, m) => a + m.expenseCoverage, 0);

    return {
        lines: out,
        accounts,
        months: months.map(({ month, hasEntry, hasDetails, lancamentos, patrimonial }) => ({ month, hasEntry, hasDetails, lancamentos, patrimonial })),
        conferencia: {
            lucro_dre: lucro,
            lucro_lancamentos: totalLancamentos,
            diferenca: lucro - totalLancamentos,
            confere: Math.abs(lucro - totalLancamentos) < 0.005,
            meses_lancados: months.filter((m) => m.hasEntry).length,
            meses_sem_lancamento: months.filter((m) => !m.hasEntry).map((m) => m.month),
            despesas_detalhadas_percentual: expensesTotal > 0 ? (expenseCoverage / expensesTotal) * 100 : null,
            saidas_capital: months.reduce((a, m) => a + m.patrimonial, 0),
        },
    };
}

module.exports = {
    structure,
    buildYear,
    monthValues,
    classifyExpense,
    classifyOtherRevenue,
    fixMojibake,
    EXPENSE_GROUPS,
};
