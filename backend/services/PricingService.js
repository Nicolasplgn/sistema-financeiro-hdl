'use strict';

/**
 * Serviço de precificação: busca o cadastro no banco e entrega ao motor
 * (services/pricing/engine.js). Nenhuma fórmula mora aqui.
 */

const engine = require('./pricing/engine');

const SETTINGS_FIELDS = Object.keys(engine.DEFAULT_SETTINGS);

/** Campos do canal que vêm do PAINEL e podem ser gravados/simulados. */
const CHANNEL_FIELDS = Object.freeze([
    'sales_target',
    'fixed_cost_share_percent', 'prolabore_share_percent', 'payroll_share_percent',
    'profit_margin_percent',
    'icms_out_percent', 'difal_out_percent', 'pis_out_percent', 'cofins_out_percent', 'ir_csll_percent',
    'commission_percent', 'marketing_percent', 'freight_percent', 'default_rate_percent',
    'financial_cost_percent', 'cash_discount_percent',
    'ipi_tier1_percent', 'ipi_tier2_percent',
]);

const PAYROLL_FIELDS = Object.freeze(['base_salary', 'overtime', 'bonus', 'commission', 'transport_voucher', 'meal_voucher']);

const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

/**
 * Um insumo tem UM preço sem IPI, na coluna "importado" ou na "nacional" da
 * ficha técnica. Cadastros antigos gravaram o mesmo preço nas duas colunas e
 * usavam is_national para escolher; nesse caso a origem marcada decide.
 */
const materialToItem = (row) => {
    let imported = num(row.price_imported);
    let national = num(row.price_national);
    if (imported > 0 && national > 0) {
        if (Number(row.is_national)) imported = 0; else national = 0;
    }
    return {
        material_id: row.material_id ?? row.id,
        name: row.name,
        ncm: row.ncm || '',
        imported,
        national,
        ipi_percent: num(row.ipi_percent),
        quantity: row.quantity === undefined || row.quantity === null ? 1 : num(row.quantity),
    };
};

/** Custo mensal de uma linha da folha: calculado pelos componentes ou, em registros antigos, o total informado. */
const payrollRowCost = (row, settings) => {
    if (row.base_salary === null || row.base_salary === undefined) {
        return { detalhado: false, calculo: null, custo: num(row.total_cost) };
    }
    const calculo = engine.calcFolhaFuncionario(row, settings);
    return { detalhado: true, calculo, custo: calculo.custo };
};

function createPricingService(pool) {
    // ------------------------------------------------------------------ leitura

    async function getCompany(companyId) {
        const [rows] = await pool.execute('SELECT id, name, trade_name, tax_regime, owner_id FROM companies WHERE id = ?', [companyId]);
        if (rows.length === 0) throw new HttpError(404, 'Empresa não encontrada.');
        return rows[0];
    }

    async function getSettings(companyId) {
        const [rows] = await pool.execute('SELECT * FROM pricing_settings WHERE company_id = ?', [companyId]);
        return engine.mergeSettings(rows[0] ?? {});
    }

    async function saveSettings(companyId, body = {}, conn = pool) {
        const current = await getSettings(companyId);
        const next = engine.mergeSettings({ ...current, ...body });
        const values = SETTINGS_FIELDS.map((f) => (f === 'rateio_total' ? (next[f] ? 1 : 0) : next[f]));
        await conn.execute(
            `INSERT INTO pricing_settings (company_id, ${SETTINGS_FIELDS.join(', ')})
             VALUES (?, ${SETTINGS_FIELDS.map(() => '?').join(', ')})
             ON DUPLICATE KEY UPDATE ${SETTINGS_FIELDS.map((f) => `${f} = VALUES(${f})`).join(', ')}`,
            [companyId, ...values],
        );
        return next;
    }

    async function listPayroll(companyId, settings) {
        const s = settings ?? await getSettings(companyId);
        const [rows] = await pool.execute('SELECT * FROM payroll_expenses WHERE company_id = ? ORDER BY employee_name', [companyId]);
        return rows.map((row) => {
            const { detalhado, calculo, custo } = payrollRowCost(row, s);
            return { ...row, detalhado, calculo, total_cost: custo };
        });
    }

    async function getTotals(companyId, settings) {
        const s = settings ?? await getSettings(companyId);
        const [[fixed]] = await pool.execute('SELECT COALESCE(SUM(amount), 0) AS total FROM fixed_expenses WHERE company_id = ?', [companyId]);
        const [[prolabore]] = await pool.execute('SELECT COALESCE(SUM(total_cost), 0) AS total FROM prolabore_expenses WHERE company_id = ?', [companyId]);
        const payroll = (await listPayroll(companyId, s)).reduce((acc, row) => acc + row.total_cost, 0);
        return { fixed: num(fixed.total), prolabore: num(prolabore.total), payroll };
    }

    async function listChannels(companyId) {
        const [rows] = await pool.execute('SELECT * FROM sales_channels WHERE company_id = ? ORDER BY sort_order, id', [companyId]);
        return rows;
    }

    async function listProducts(companyId) {
        const [rows] = await pool.execute(
            'SELECT id, company_id, name, sku, sort_order, allocation_percent FROM products WHERE company_id = ? ORDER BY sort_order, id',
            [companyId],
        );
        return rows;
    }

    /** Itens das fichas técnicas de vários produtos de uma vez: Map(productId → itens). */
    async function loadBomItems(productIds) {
        const map = new Map(productIds.map((id) => [Number(id), []]));
        if (productIds.length === 0) return map;
        const [rows] = await pool.query(
            `SELECT pb.id AS bom_id, pb.product_id, pb.material_id, pb.quantity,
                    m.name, m.ncm, m.price_national, m.price_imported, m.ipi_percent, m.is_national
             FROM product_boms pb
             JOIN materials m ON m.id = pb.material_id
             WHERE pb.product_id IN (?)
             ORDER BY pb.id`,
            [productIds],
        );
        for (const row of rows) map.get(Number(row.product_id))?.push(materialToItem(row));
        return map;
    }

    /** Faixas de IPI gravadas: Map("produto:canal" → 1|2). Sem registro, vale a faixa 2. */
    async function loadIpiTiers(productIds) {
        const map = new Map();
        if (productIds.length === 0) return map;
        const [rows] = await pool.query('SELECT product_id, channel_id, ipi_tier FROM product_channel_settings WHERE product_id IN (?)', [productIds]);
        for (const row of rows) map.set(`${row.product_id}:${row.channel_id}`, Number(row.ipi_tier) === 1 ? 1 : 2);
        return map;
    }

    async function getProduct(productId) {
        const [rows] = await pool.execute(
            'SELECT id, company_id, name, sku, sort_order, allocation_percent FROM products WHERE id = ?',
            [productId],
        );
        if (rows.length === 0) throw new HttpError(404, 'Produto não encontrado.');
        return rows[0];
    }

    async function getChannel(channelId) {
        const [rows] = await pool.execute('SELECT * FROM sales_channels WHERE id = ?', [channelId]);
        if (rows.length === 0) throw new HttpError(404, 'Canal de venda não encontrado.');
        return rows[0];
    }

    // ------------------------------------------------------------------ cálculos

    /** Ficha técnica calculada de um produto (custo no regime da empresa). */
    async function getFicha(productId) {
        const produto = await getProduct(productId);
        const company = await getCompany(produto.company_id);
        const settings = await getSettings(produto.company_id);
        const items = (await loadBomItems([produto.id])).get(Number(produto.id));
        return {
            produto,
            regime: engine.normalizeRegime(company.tax_regime),
            ficha: engine.calcFichaTecnica(items, settings, company.tax_regime),
        };
    }

    /**
     * Markup + tributos de um produto em um canal.
     * `overrides` serve à simulação e não grava nada:
     *   { channel: { <campo do painel>: valor }, allocation_percent, ipi_tier, rateio_total }
     */
    async function calculate(productId, channelId, overrides = {}) {
        const produto = await getProduct(productId);
        const canalGravado = await getChannel(channelId);
        if (String(produto.company_id) !== String(canalGravado.company_id)) {
            throw new HttpError(400, 'Produto e canal pertencem a empresas diferentes.');
        }
        const company = await getCompany(produto.company_id);
        const settingsGravadas = await getSettings(produto.company_id);
        const totals = await getTotals(produto.company_id, settingsGravadas);
        const items = (await loadBomItems([produto.id])).get(Number(produto.id));
        const tiers = await loadIpiTiers([produto.id]);

        const channel = { ...canalGravado };
        for (const field of CHANNEL_FIELDS) {
            const value = overrides.channel?.[field];
            if (value !== undefined && value !== null && value !== '') channel[field] = num(value);
        }
        const settings = overrides.rateio_total === undefined
            ? settingsGravadas
            : { ...settingsGravadas, rateio_total: Boolean(overrides.rateio_total) };
        const allocationPercent = overrides.allocation_percent === undefined || overrides.allocation_percent === null || overrides.allocation_percent === ''
            ? num(produto.allocation_percent)
            : num(overrides.allocation_percent);
        const ipiTier = Number(overrides.ipi_tier) === 1 || Number(overrides.ipi_tier) === 2
            ? Number(overrides.ipi_tier)
            : tiers.get(`${produto.id}:${canalGravado.id}`) ?? 2;

        const resultado = engine.calcPreco({
            items, regime: company.tax_regime, channel, totals, allocationPercent, ipiTier, settings,
        });

        return {
            empresa: { id: company.id, nome: company.trade_name || company.name },
            regime: resultado.ficha.regime,
            produto: { ...produto, allocation_percent: allocationPercent },
            canal: channel,
            canal_gravado: canalGravado,
            parametros: settings,
            totais_mensais: totals,
            simulado: Object.keys(overrides).length > 0,
            ...resultado,
        };
    }

    /**
     * O PAINEL inteiro: parâmetros, totais mensais, canais com a apropriação em
     * R$, modelos com custo e rateio, e a matriz de preços modelo × canal.
     */
    async function getPainel(companyId) {
        const company = await getCompany(companyId);
        const settings = await getSettings(companyId);
        const totals = await getTotals(companyId, settings);
        const channels = await listChannels(companyId);
        const products = await listProducts(companyId);
        const productIds = products.map((p) => p.id);
        const boms = await loadBomItems(productIds);
        const tiers = await loadIpiTiers(productIds);

        const canais = channels.map((ch) => ({ ...ch, apropriacao: engine.calcApropriacaoCanal(ch, totals) }));

        const precos = [];
        const produtos = products.map((p) => {
            const ficha = engine.calcFichaTecnica(boms.get(Number(p.id)), settings, company.tax_regime);
            const ipiTiers = {};
            for (const ch of channels) {
                const tier = tiers.get(`${p.id}:${ch.id}`) ?? 2;
                ipiTiers[ch.id] = tier;
                const m = engine.calcMarkup({
                    custoCompra: ficha.custo, channel: ch, totals,
                    allocationPercent: num(p.allocation_percent), ipiTier: tier, settings,
                });
                precos.push({
                    product_id: p.id, channel_id: ch.id,
                    status: m.status, motivo: m.motivo,
                    valor_venda_atribuido: m.valor_venda_atribuido,
                    total_percentual: m.total_percentual,
                    preco_venda_sugerido: m.preco_venda_sugerido,
                    ipi_percentual: m.ipi_percentual,
                    preco_venda_com_ipi: m.preco_venda_com_ipi,
                    valor_com_desconto_fora: m.valor_com_desconto_fora,
                    quantidade_mes: m.quantidade_mes,
                    lucro_liquido_total: m.lucro.liquido_total,
                });
            }
            return {
                ...p,
                allocation_percent: num(p.allocation_percent),
                itens: ficha.linhas.length,
                custo: ficha.custo,
                custos: ficha.custos,
                ipi_tiers: ipiTiers,
            };
        });

        const soma = (list, field) => list.reduce((acc, item) => acc + num(item[field]), 0);
        const somas = {
            fixed_cost_share_percent: soma(channels, 'fixed_cost_share_percent'),
            prolabore_share_percent: soma(channels, 'prolabore_share_percent'),
            payroll_share_percent: soma(channels, 'payroll_share_percent'),
            sales_target: soma(channels, 'sales_target'),
            allocation_percent: soma(products, 'allocation_percent'),
        };

        const fora = (v) => Math.abs(v - 100) > 0.005;
        const avisos = [];
        if (channels.length > 0) {
            if (fora(somas.fixed_cost_share_percent)) avisos.push(`A apropriação do custo fixo entre os canais soma ${somas.fixed_cost_share_percent.toFixed(2)}% (deveria somar 100%).`);
            if (fora(somas.prolabore_share_percent)) avisos.push(`A apropriação do pró-labore entre os canais soma ${somas.prolabore_share_percent.toFixed(2)}% (deveria somar 100%).`);
            if (fora(somas.payroll_share_percent)) avisos.push(`A apropriação dos salários entre os canais soma ${somas.payroll_share_percent.toFixed(2)}% (deveria somar 100%).`);
        }
        if (products.length > 0 && !settings.rateio_total && fora(somas.allocation_percent)) {
            avisos.push(`O rateio das despesas fixas entre os modelos soma ${somas.allocation_percent.toFixed(2)}% (deveria somar 100%).`);
        }

        return {
            empresa: { id: company.id, nome: company.trade_name || company.name },
            regime: engine.normalizeRegime(company.tax_regime),
            parametros: settings,
            totais_mensais: totals,
            canais,
            produtos,
            precos,
            somas,
            avisos,
        };
    }

    // ------------------------------------------------------------------ gravação

    /**
     * Grava o PAINEL de uma vez (transação): parâmetros, linhas digitáveis de
     * cada canal, rateio/ordem dos modelos e faixas de IPI.
     */
    async function savePainel(companyId, body = {}) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            if (body.parametros) await saveSettings(companyId, body.parametros, conn);

            for (const ch of body.canais ?? []) {
                const sets = [];
                const values = [];
                for (const field of [...CHANNEL_FIELDS, 'sort_order']) {
                    if (ch[field] === undefined) continue;
                    sets.push(`${field} = ?`);
                    values.push(num(ch[field]));
                }
                if (typeof ch.name === 'string' && ch.name.trim()) { sets.push('name = ?'); values.push(ch.name.trim()); }
                if (sets.length === 0) continue;
                const [r] = await conn.execute(
                    `UPDATE sales_channels SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`,
                    [...values, ch.id, companyId],
                );
                if (r.affectedRows === 0) {
                    const [exists] = await conn.execute('SELECT id FROM sales_channels WHERE id = ? AND company_id = ?', [ch.id, companyId]);
                    if (exists.length === 0) throw new HttpError(400, `Canal ${ch.id} não pertence a esta empresa.`);
                }
            }

            for (const p of body.produtos ?? []) {
                const sets = [];
                const values = [];
                if (p.allocation_percent !== undefined) { sets.push('allocation_percent = ?'); values.push(num(p.allocation_percent)); }
                if (p.sort_order !== undefined) { sets.push('sort_order = ?'); values.push(Math.round(num(p.sort_order))); }
                if (sets.length === 0) continue;
                await conn.execute(`UPDATE products SET ${sets.join(', ')} WHERE id = ? AND company_id = ?`, [...values, p.id, companyId]);
            }

            for (const t of body.faixas_ipi ?? []) {
                const [ok] = await conn.execute(
                    `SELECT p.id FROM products p JOIN sales_channels c ON c.company_id = p.company_id
                     WHERE p.id = ? AND c.id = ? AND p.company_id = ?`,
                    [t.product_id, t.channel_id, companyId],
                );
                if (ok.length === 0) throw new HttpError(400, 'Faixa de IPI: produto ou canal de outra empresa.');
                await conn.execute(
                    `INSERT INTO product_channel_settings (product_id, channel_id, ipi_tier) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE ipi_tier = VALUES(ipi_tier)`,
                    [t.product_id, t.channel_id, Number(t.ipi_tier) === 1 ? 1 : 2],
                );
            }

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
        return getPainel(companyId);
    }

    return {
        getCompany, getSettings, saveSettings,
        listPayroll, getTotals, listChannels, listProducts,
        getProduct, getChannel, loadBomItems,
        getFicha, calculate, getPainel, savePainel,
    };
}

module.exports = {
    createPricingService,
    HttpError,
    CHANNEL_FIELDS,
    PAYROLL_FIELDS,
    SETTINGS_FIELDS,
    materialToItem,
    payrollRowCost,
};
