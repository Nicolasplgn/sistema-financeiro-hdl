'use strict';

/**
 * MOTOR DE PRECIFICAÇÃO
 * ---------------------------------------------------------------------------
 * Reprodução, fórmula por fórmula, da pasta de planilhas de markup
 * (backend/markup_files): PAINEL, FICHA TECNICA n, CUSTO FIXO, FOLHA,
 * PRO-LABORE, MARKUP <canal> n e TRIBUTOS <canal> n.
 *
 * Este arquivo é puro: não acessa banco, não arredonda e não formata.
 * Percentuais entram como "pontos percentuais" (12 = 12%), iguais aos das
 * planilhas e das colunas do banco.
 *
 * Encadeamento das planilhas:
 *
 *   FICHA TECNICA ──► custo de compra (Lucro Real / Lucro Presumido)
 *   CUSTO FIXO, FOLHA, PRO-LABORE ──► totais mensais
 *   PAINEL ──► apropriação por canal, meta de venda, alíquotas, rateio por modelo
 *   MARKUP  = custo de compra ÷ (1 − Σ encargos sobre a venda)
 *   TRIBUTOS = débitos da venda − créditos da compra (+ IR/CSLL sobre o lucro)
 */

const DEFAULT_SETTINGS = Object.freeze({
    // Cabeçalho da FICHA TECNICA (linha 2)
    pis_credit_percent: 1.65,
    cofins_credit_percent: 7.65,
    icms_credit_imported_percent: 4,
    icms_credit_national_percent: 12,
    // TRIBUTOS: "IR 0,15" e "CSLL 0,09"
    ir_percent: 15,
    csll_percent: 9,
    // MARKUP: "VLR SOMADO C/ DESCONTO 5% P/ FORA"
    outside_discount_percent: 5,
    // FOLHA: adicional de assiduidade (5%), FGTS (8%) e multa (40%)
    attendance_bonus_percent: 5,
    fgts_percent: 8,
    fgts_fine_percent: 40,
    // PAINEL: "Rateio Total? 1 p/ sim, 0 p/ não"
    rateio_total: false,
});

const REGIMES = Object.freeze(['LUCRO_REAL', 'LUCRO_PRESUMIDO', 'SIMPLES']);

const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};
const frac = (v) => num(v) / 100;

const mergeSettings = (settings = {}) => {
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        const value = settings[key];
        if (value === undefined || value === null || value === '') continue;
        out[key] = key === 'rateio_total' ? Boolean(Number(value)) : num(value);
    }
    return out;
};

const normalizeRegime = (regime) => (REGIMES.includes(regime) ? regime : 'LUCRO_REAL');

// =============================================================================
// FICHA TECNICA
// =============================================================================

/**
 * Cada linha da ficha tem o valor do componente SEM IPI em uma de duas colunas
 * (importado ou nacional), o % de IPI e, a partir daí:
 *
 *   valor com IPI        = (importado + nacional) × (1 + IPI%)
 *   crédito PIS          = valor sem IPI × 1,65%
 *   crédito COFINS       = valor sem IPI × 7,65%
 *   crédito IPI          = valor sem IPI × IPI%
 *   crédito ICMS         = importado × 4%  |  nacional × 12%
 *
 *   CUSTO LUCRO REAL      = Σ com IPI − (PIS + COFINS + IPI + ICMS)
 *   CUSTO LUCRO PRESUMIDO = Σ com IPI − (IPI + ICMS)
 *
 * O Simples Nacional não existe na planilha; como não há crédito a tomar, o
 * custo é o valor com IPI.
 *
 * @param {Array<{name, ncm, imported, national, ipi_percent, quantity}>} items
 *        `imported` e `national` são valores unitários sem IPI.
 */
function calcFichaTecnica(items = [], settings = {}, regime = 'LUCRO_REAL') {
    const s = mergeSettings(settings);
    const reg = normalizeRegime(regime);

    const totais = {
        importado: 0, nacional: 0, sem_ipi: 0, com_ipi: 0,
        pis_importado: 0, pis_nacional: 0,
        cofins_importado: 0, cofins_nacional: 0,
        ipi: 0, icms_importado: 0, icms_nacional: 0,
    };

    const linhas = items.map((item) => {
        const qtd = item.quantity === undefined || item.quantity === null ? 1 : num(item.quantity);
        const importado = num(item.imported) * qtd;
        const nacional = num(item.national) * qtd;
        const semIpi = importado + nacional;
        const ipi = semIpi * frac(item.ipi_percent);

        const linha = {
            material_id: item.material_id ?? null,
            nome: item.name ?? '',
            ncm: item.ncm ?? '',
            quantidade: qtd,
            ipi_percentual: num(item.ipi_percent),
            importado,
            nacional,
            sem_ipi: semIpi,
            com_ipi: semIpi + ipi,
            pis_importado: importado * frac(s.pis_credit_percent),
            pis_nacional: nacional * frac(s.pis_credit_percent),
            cofins_importado: importado * frac(s.cofins_credit_percent),
            cofins_nacional: nacional * frac(s.cofins_credit_percent),
            ipi,
            icms_importado: importado * frac(s.icms_credit_imported_percent),
            icms_nacional: nacional * frac(s.icms_credit_national_percent),
        };

        for (const key of Object.keys(totais)) totais[key] += linha[key];
        return linha;
    });

    totais.pis = totais.pis_importado + totais.pis_nacional;
    totais.cofins = totais.cofins_importado + totais.cofins_nacional;
    totais.icms = totais.icms_importado + totais.icms_nacional;

    const custos = {
        lucro_real: totais.com_ipi - (totais.pis + totais.cofins + totais.ipi + totais.icms),
        lucro_presumido: totais.com_ipi - (totais.ipi + totais.icms),
        simples: totais.com_ipi,
    };

    // Créditos efetivamente aproveitados no regime da empresa.
    const creditos = { ipi: 0, pis: 0, cofins: 0, icms: 0 };
    if (reg !== 'SIMPLES') {
        creditos.ipi = totais.ipi;
        creditos.icms = totais.icms;
    }
    if (reg === 'LUCRO_REAL') {
        creditos.pis = totais.pis;
        creditos.cofins = totais.cofins;
    }

    const custo = reg === 'LUCRO_REAL' ? custos.lucro_real
        : reg === 'LUCRO_PRESUMIDO' ? custos.lucro_presumido
        : custos.simples;

    return {
        regime: reg,
        parametros: {
            pis_credito: s.pis_credit_percent,
            cofins_credito: s.cofins_credit_percent,
            icms_importado: s.icms_credit_imported_percent,
            icms_nacional: s.icms_credit_national_percent,
        },
        linhas,
        totais,
        custos,
        creditos,
        custo,
    };
}

// =============================================================================
// FOLHA
// =============================================================================

/**
 * Linha da planilha FOLHA:
 *
 *   adic. assiduidade = salário × 5%
 *   salário+grat+com  = salário + assiduidade + horas extras + gratificação + comissão
 *   13º = férias      = (salário+grat+com) ÷ 12
 *   1/3 férias        = férias ÷ 3
 *   FGTS              = (salário+grat+com + 13º + férias + 1/3) × 8%
 *   multa 40%         = FGTS × 40%
 *   CUSTO             = tudo acima + vale transporte + vale alimentação
 */
function calcFolhaFuncionario(emp = {}, settings = {}) {
    const s = mergeSettings(settings);
    const salario = num(emp.base_salary);
    const assiduidade = salario * frac(s.attendance_bonus_percent);
    const horasExtras = num(emp.overtime);
    const gratificacao = num(emp.bonus);
    const comissao = num(emp.commission);
    const remuneracao = salario + assiduidade + horasExtras + gratificacao + comissao;
    const decimoTerceiro = remuneracao / 12;
    const ferias = remuneracao / 12;
    const tercoFerias = ferias / 3;
    const fgts = (remuneracao + decimoTerceiro + ferias + tercoFerias) * frac(s.fgts_percent);
    const multaFgts = fgts * frac(s.fgts_fine_percent);
    const valeTransporte = num(emp.transport_voucher);
    const valeAlimentacao = num(emp.meal_voucher);

    return {
        salario,
        adicional_assiduidade: assiduidade,
        horas_extras: horasExtras,
        gratificacao,
        comissao,
        remuneracao,
        decimo_terceiro: decimoTerceiro,
        ferias,
        terco_ferias: tercoFerias,
        fgts,
        multa_fgts: multaFgts,
        vale_transporte: valeTransporte,
        vale_alimentacao: valeAlimentacao,
        custo: remuneracao + decimoTerceiro + ferias + tercoFerias + fgts + multaFgts
            + valeTransporte + valeAlimentacao,
    };
}

// =============================================================================
// PAINEL — apropriação dos custos de estrutura por canal
// =============================================================================

/**
 * CUSTO FIXO / PRO-LABORE / FOLHA: o total mensal é distribuído entre os canais
 * pelos percentuais de apropriação do PAINEL (ex.: 0% / 10% / 90% / 0%).
 */
function calcApropriacaoCanal(channel = {}, totals = {}) {
    return {
        custo_fixo: num(totals.fixed) * frac(channel.fixed_cost_share_percent),
        pro_labore: num(totals.prolabore) * frac(channel.prolabore_share_percent),
        salarios: num(totals.payroll) * frac(channel.payroll_share_percent),
    };
}

/** Percentual do IPI de saída conforme a "Faixa do IPI (1 ou 2)" do markup. */
function ipiDaFaixa(channel = {}, tier = 2) {
    return Number(tier) === 1 ? num(channel.ipi_tier1_percent) : num(channel.ipi_tier2_percent);
}

// =============================================================================
// MARKUP
// =============================================================================

const ENCARGOS_VARIAVEIS = Object.freeze([
    { key: 'icms', label: 'ICMS', field: 'icms_out_percent', grupo: 'tributo' },
    { key: 'difal', label: 'DIFAL', field: 'difal_out_percent', grupo: 'tributo' },
    { key: 'pis', label: 'PIS', field: 'pis_out_percent', grupo: 'tributo' },
    { key: 'cofins', label: 'COFINS', field: 'cofins_out_percent', grupo: 'tributo' },
    { key: 'ir_csll', label: 'IR / CSLL', field: 'ir_csll_percent', grupo: 'tributo' },
    { key: 'comissao', label: 'Comissão de vendas', field: 'commission_percent', grupo: 'venda' },
    { key: 'propaganda', label: 'Propaganda', field: 'marketing_percent', grupo: 'venda' },
    { key: 'frete', label: 'Frete da entrega', field: 'freight_percent', grupo: 'venda' },
    { key: 'inadimplencia', label: 'Inadimplência', field: 'default_rate_percent', grupo: 'venda' },
    { key: 'custo_financeiro', label: 'Custo financeiro', field: 'financial_cost_percent', grupo: 'venda' },
]);

/**
 * Planilha MARKUP <canal> <modelo>.
 *
 *   VALOR DE VENDA ATRIBUÍDO = meta de venda do canal × rateio do modelo
 *   encargo variável (R$)    = valor atribuído × %
 *   pró-labore / despesas fixas / salários (R$)
 *                            = total mensal × apropriação do canal × rateio do modelo
 *   representatividade (%)   = R$ ÷ valor atribuído
 *   TOTAL                    = Σ encargos + margem de lucro
 *   PREÇO DE VENDA SUGERIDO  = preço de compra ÷ (1 − TOTAL)
 *   IPI                      = preço × IPI da faixa → preço com IPI
 *   VLR C/ DESCONTO 5% P/ FORA = preço com IPI ÷ (1 − 5%)
 *   QUANTIDADE PRODUZIDA MÊS = valor atribuído ÷ preço de venda
 *   lucro antes do IR/CS     = preço × margem → IR/CS (15% + 9%) → lucro líquido
 *
 * Quando o valor atribuído é zero a planilha mostra #DIV/0!; aqui o resultado
 * vem com status SEM_BASE e sem preço.
 */
function calcMarkup({
    custoCompra,
    channel = {},
    totals = {},
    allocationPercent = 100,
    ipiTier = 2,
    settings = {},
} = {}) {
    const s = mergeSettings(settings);
    const rateio = s.rateio_total ? 1 : frac(allocationPercent);
    const custo = num(custoCompra);
    const valorAtribuido = num(channel.sales_target) * rateio;
    const temBase = valorAtribuido > 0;
    const apropriacao = calcApropriacaoCanal(channel, totals);

    const variavel = (def) => {
        const percentual = num(channel[def.field]);
        return {
            key: def.key, label: def.label, grupo: def.grupo, origem: 'painel',
            percentual, valor: valorAtribuido * (percentual / 100),
        };
    };
    const rateado = (key, label, totalCanal) => {
        const valor = totalCanal * rateio;
        return {
            key, label, grupo: 'estrutura', origem: 'rateio',
            valor, percentual: temBase ? (valor / valorAtribuido) * 100 : null,
        };
    };

    // Mesma ordem das linhas da planilha.
    const encargos = [
        ...ENCARGOS_VARIAVEIS.map(variavel),
        rateado('pro_labore', 'Pró-labore', apropriacao.pro_labore),
        {
            key: 'desconto_a_vista', label: 'Desconto à vista (por dentro)', grupo: 'venda', origem: 'painel',
            percentual: num(channel.cash_discount_percent),
            valor: valorAtribuido * frac(channel.cash_discount_percent),
        },
        rateado('despesas_fixas', 'Despesas fixas mensais', apropriacao.custo_fixo),
        rateado('salarios', 'Salários fixos mensais', apropriacao.salarios),
        {
            key: 'margem_lucro', label: 'Margem de lucro antes do IR/CS', grupo: 'margem', origem: 'painel',
            percentual: num(channel.profit_margin_percent),
            valor: valorAtribuido * frac(channel.profit_margin_percent),
        },
    ];

    const ipiPercentual = ipiDaFaixa(channel, ipiTier);
    const base = {
        valor_venda_atribuido: valorAtribuido,
        rateio_percentual: rateio * 100,
        apropriacao_canal: apropriacao,
        encargos,
        preco_compra: custo,
        ipi_faixa: Number(ipiTier) === 1 ? 1 : 2,
        ipi_percentual: ipiPercentual,
        desconto_fora_percentual: s.outside_discount_percent,
    };

    const indefinido = (status, motivo) => ({
        status, motivo, ...base,
        total_percentual: null, divisor: null,
        preco_venda_sugerido: null, ipi_valor: null, preco_venda_com_ipi: null,
        valor_com_desconto_fora: null, desconto_fora_valor: null, valor_venda_liquido: null,
        quantidade_mes: null,
        lucro: { antes_ir_cs: null, ir_cs: null, liquido_unitario: null, liquido_total: null },
    });

    if (!temBase) {
        return indefinido('SEM_BASE', num(channel.sales_target) <= 0
            ? 'O canal não tem meta de venda no painel de rateio.'
            : 'O modelo está com 0% no rateio das despesas fixas.');
    }

    const totalPercentual = encargos.reduce((acc, e) => acc + e.percentual, 0);
    const divisor = 1 - totalPercentual / 100;

    if (custo <= 0) {
        return { ...indefinido('SEM_CUSTO', 'O produto não tem ficha técnica com custo.'), total_percentual: totalPercentual, divisor };
    }
    if (divisor <= 0) {
        return {
            ...indefinido('INVIAVEL', 'Os encargos sobre a venda somam 100% ou mais; não existe preço que feche a conta.'),
            total_percentual: totalPercentual, divisor,
        };
    }

    const preco = custo / divisor;
    const ipiValor = preco * (ipiPercentual / 100);
    const precoComIpi = preco + ipiValor;
    const valorComDesconto = precoComIpi / (1 - frac(s.outside_discount_percent));
    const descontoValor = valorComDesconto * frac(s.outside_discount_percent);
    const quantidade = valorAtribuido / preco;

    const lucroAntes = preco * frac(channel.profit_margin_percent);
    const irCs = lucroAntes * (frac(s.ir_percent) + frac(s.csll_percent));
    const lucroLiquido = lucroAntes - irCs;

    return {
        status: 'OK', motivo: null, ...base,
        total_percentual: totalPercentual,
        divisor,
        preco_venda_sugerido: preco,
        ipi_valor: ipiValor,
        preco_venda_com_ipi: precoComIpi,
        valor_com_desconto_fora: valorComDesconto,
        desconto_fora_valor: descontoValor,
        valor_venda_liquido: valorComDesconto - descontoValor,
        quantidade_mes: quantidade,
        lucro: {
            antes_ir_cs: lucroAntes,
            ir_cs: irCs,
            liquido_unitario: lucroLiquido,
            liquido_total: lucroLiquido * quantidade,
        },
    };
}

// =============================================================================
// TRIBUTOS
// =============================================================================

/**
 * Planilha TRIBUTOS <canal> <modelo>, três quadros:
 *
 *   VENDA   : IPI, PIS, COFINS, DIFAL e ICMS sobre o preço de venda sugerido
 *   COMPRA  : créditos vindos da ficha técnica. O "TOTAL IMPOSTO" da planilha
 *             soma IPI + PIS + COFINS + outros créditos e deixa o ICMS de fora
 *             (36,44 + 7,35 + 34,07 = 77,85 no modelo 2); mantido igual.
 *   DEVIDO  : venda − compra, tributo a tributo, mais IR (15%) e CSLL (9%)
 *             sobre o lucro antes do IR/CS; alíquota efetiva = total ÷ preço.
 */
function calcTributos({ markup, ficha, channel = {}, settings = {} } = {}) {
    const s = mergeSettings(settings);
    const creditos = ficha?.creditos ?? { ipi: 0, pis: 0, cofins: 0, icms: 0 };
    const outrosCreditos = 0;

    const compra = {
        aliquotas: {
            pis: s.pis_credit_percent,
            cofins: s.cofins_credit_percent,
            icms_importado: s.icms_credit_imported_percent,
            icms_nacional: s.icms_credit_national_percent,
        },
        ipi: creditos.ipi,
        pis: creditos.pis,
        cofins: creditos.cofins,
        outros_creditos: outrosCreditos,
        icms: creditos.icms,
        total: creditos.ipi + creditos.pis + creditos.cofins + outrosCreditos,
        total_com_icms: creditos.ipi + creditos.pis + creditos.cofins + outrosCreditos + creditos.icms,
    };

    const aliquotasVenda = {
        ipi: markup?.ipi_percentual ?? 0,
        pis: num(channel.pis_out_percent),
        cofins: num(channel.cofins_out_percent),
        difal: num(channel.difal_out_percent),
        icms: num(channel.icms_out_percent),
        margem_liquida: num(channel.profit_margin_percent),
    };

    if (!markup || markup.status !== 'OK') {
        return { status: markup?.status ?? 'SEM_BASE', venda: { aliquotas: aliquotasVenda }, compra, devido: null };
    }

    const preco = markup.preco_venda_sugerido;
    const venda = {
        aliquotas: aliquotasVenda,
        preco_venda: preco,
        ipi: preco * (aliquotasVenda.ipi / 100),
        pis: preco * (aliquotasVenda.pis / 100),
        cofins: preco * (aliquotasVenda.cofins / 100),
        difal: preco * (aliquotasVenda.difal / 100),
        icms: preco * (aliquotasVenda.icms / 100),
    };
    venda.total = venda.ipi + venda.pis + venda.cofins + venda.difal + venda.icms;

    const devido = {
        ipi: venda.ipi - compra.ipi,
        pis: venda.pis - compra.pis,
        cofins: venda.cofins - compra.cofins,
        difal: venda.difal,
        icms: venda.icms - compra.icms,
    };
    devido.total_impostos = devido.ipi + devido.pis + devido.cofins + devido.difal + devido.icms;
    devido.ir = markup.lucro.antes_ir_cs * frac(s.ir_percent);
    devido.csll = markup.lucro.antes_ir_cs * frac(s.csll_percent);
    devido.total = devido.total_impostos + devido.ir + devido.csll;
    devido.aliquota_efetiva = preco > 0 ? (devido.total / preco) * 100 : null;

    return { status: 'OK', venda, compra, devido };
}

// =============================================================================
// CÁLCULO COMPLETO (ficha → markup → tributos)
// =============================================================================

function calcPreco({
    items = [], regime = 'LUCRO_REAL', channel = {}, totals = {},
    allocationPercent = 100, ipiTier = 2, settings = {},
} = {}) {
    const ficha = calcFichaTecnica(items, settings, regime);
    const markup = calcMarkup({
        custoCompra: ficha.custo, channel, totals, allocationPercent, ipiTier, settings,
    });
    const tributos = calcTributos({ markup, ficha, channel, settings });
    return { ficha, markup, tributos };
}

module.exports = {
    DEFAULT_SETTINGS,
    REGIMES,
    ENCARGOS_VARIAVEIS,
    mergeSettings,
    normalizeRegime,
    calcFichaTecnica,
    calcFolhaFuncionario,
    calcApropriacaoCanal,
    ipiDaFaixa,
    calcMarkup,
    calcTributos,
    calcPreco,
};
