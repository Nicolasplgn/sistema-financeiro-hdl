'use strict';

/**
 * Carrega o cadastro lido das planilhas (planilhas.toCadastro) em uma empresa:
 * parâmetros, canais do PAINEL, produtos + fichas técnicas, faixas de IPI,
 * custos fixos, folha e pró-labore.
 *
 *   substituir = false → mescla: atualiza o que tem o mesmo nome/código e
 *                        acrescenta o resto; nada é apagado.
 *   substituir = true  → apaga antes todo o cadastro de precificação da
 *                        empresa (canais, produtos, insumos, fichas, custos
 *                        fixos, folha e pró-labore).
 *
 * Tudo roda em uma transação: ou entra inteiro, ou não entra nada.
 */

const engine = require('./engine');
const { SETTINGS_FIELDS, CHANNEL_FIELDS } = require('../PricingService');

const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.00005;

async function importCadastro(pool, companyId, cadastro, { substituir = false } = {}) {
    const conn = await pool.getConnection();
    const resumo = {
        substituiu: substituir,
        canais: { criados: 0, atualizados: 0 },
        produtos: { criados: 0, atualizados: 0 },
        insumos: { criados: 0, reaproveitados: 0 },
        itens_ficha: 0,
        custos_fixos: { criados: 0, atualizados: 0 },
        folha: { criados: 0, atualizados: 0 },
        pro_labore: { criados: 0, atualizados: 0 },
    };

    try {
        const [company] = await conn.execute('SELECT id FROM companies WHERE id = ?', [companyId]);
        if (company.length === 0) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 });

        await conn.beginTransaction();

        if (substituir) {
            await conn.execute('DELETE FROM product_channel_settings WHERE product_id IN (SELECT id FROM products WHERE company_id = ?)', [companyId]);
            await conn.execute('DELETE FROM product_boms WHERE product_id IN (SELECT id FROM products WHERE company_id = ?)', [companyId]);
            for (const table of ['products', 'materials', 'sales_channels', 'fixed_expenses', 'payroll_expenses', 'prolabore_expenses']) {
                await conn.execute(`DELETE FROM ${table} WHERE company_id = ?`, [companyId]);
            }
        }

        // ---- parâmetros -----------------------------------------------------
        const [currentSettings] = await conn.execute('SELECT * FROM pricing_settings WHERE company_id = ?', [companyId]);
        const settings = engine.mergeSettings({ ...(currentSettings[0] ?? {}), ...cadastro.settings });
        await conn.execute(
            `INSERT INTO pricing_settings (company_id, ${SETTINGS_FIELDS.join(', ')})
             VALUES (?, ${SETTINGS_FIELDS.map(() => '?').join(', ')})
             ON DUPLICATE KEY UPDATE ${SETTINGS_FIELDS.map((f) => `${f} = VALUES(${f})`).join(', ')}`,
            [companyId, ...SETTINGS_FIELDS.map((f) => (f === 'rateio_total' ? (settings[f] ? 1 : 0) : settings[f]))],
        );

        // ---- canais (colunas do PAINEL) -------------------------------------
        const channelIdByKey = {};
        for (const ch of cadastro.channels) {
            const fields = [...CHANNEL_FIELDS, 'sort_order'];
            const values = fields.map((f) => Number(ch[f]) || 0);
            const [found] = await conn.execute('SELECT id FROM sales_channels WHERE company_id = ? AND name = ? LIMIT 1', [companyId, ch.name]);
            if (found.length > 0) {
                await conn.execute(`UPDATE sales_channels SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`, [...values, found[0].id]);
                channelIdByKey[ch.key] = found[0].id;
                resumo.canais.atualizados++;
            } else {
                const [r] = await conn.execute(
                    `INSERT INTO sales_channels (company_id, name, ${fields.join(', ')}) VALUES (?, ?, ${fields.map(() => '?').join(', ')})`,
                    [companyId, ch.name, ...values],
                );
                channelIdByKey[ch.key] = r.insertId;
                resumo.canais.criados++;
            }
        }

        // ---- insumos + produtos + fichas técnicas ---------------------------
        const [existingMaterials] = await conn.execute(
            'SELECT id, name, ncm, price_national, price_imported, ipi_percent FROM materials WHERE company_id = ?',
            [companyId],
        );
        // Nome sem o sufixo " [CÓDIGO]" que esta importação acrescenta a homônimos.
        const baseName = (name) => String(name ?? '').replace(/ \[[^\]]+\]$/, '');
        const materials = existingMaterials.map((m) => ({ ...m, base: baseName(m.name) }));

        /**
         * O mesmo componente pode ter preço diferente em fichas diferentes
         * (ex.: "Camara de Ar" custa 14,92 nas aro 29 e 10,70 na aro 26). Só
         * reaproveita o insumo quando nome, NCM, preços e IPI são idênticos;
         * senão cria outro, identificado pelo código do modelo.
         */
        const resolveMaterial = async (item, sku) => {
            const ncm = (item.ncm || '').slice(0, 20);
            const same = materials.find((m) => m.base === item.name && (m.ncm || '') === ncm
                && near(m.price_imported, item.imported) && near(m.price_national, item.national) && near(m.ipi_percent, item.ipi_percent));
            if (same) { resumo.insumos.reaproveitados++; return same.id; }

            const nameTaken = materials.some((m) => m.base === item.name);
            const name = (nameTaken ? `${item.name} [${sku}]` : item.name).slice(0, 255);
            const [r] = await conn.execute(
                'INSERT INTO materials (company_id, name, ncm, price_national, price_imported, ipi_percent, is_national) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [companyId, name, ncm, item.national, item.imported, item.ipi_percent, item.imported > 0 ? 0 : 1],
            );
            materials.push({
                id: r.insertId, name, base: item.name, ncm,
                price_national: item.national, price_imported: item.imported, ipi_percent: item.ipi_percent,
            });
            resumo.insumos.criados++;
            return r.insertId;
        };

        for (const product of cadastro.products) {
            let productId;
            const [found] = await conn.execute('SELECT id FROM products WHERE company_id = ? AND sku = ? LIMIT 1', [companyId, product.sku]);
            if (found.length > 0) {
                productId = found[0].id;
                await conn.execute('UPDATE products SET name = ?, sort_order = ?, allocation_percent = ? WHERE id = ?', [product.name, product.sort_order, product.allocation_percent, productId]);
                await conn.execute('DELETE FROM product_boms WHERE product_id = ?', [productId]);
                resumo.produtos.atualizados++;
            } else {
                const [r] = await conn.execute(
                    'INSERT INTO products (company_id, name, sku, sort_order, allocation_percent) VALUES (?, ?, ?, ?, ?)',
                    [companyId, product.name, product.sku, product.sort_order, product.allocation_percent],
                );
                productId = r.insertId;
                resumo.produtos.criados++;
            }

            // Uma linha da ficha com valor nas duas colunas vira dois insumos.
            for (const item of product.items) {
                const parts = item.imported !== 0 && item.national !== 0
                    ? [{ ...item, name: `${item.name} (importado)`, national: 0 }, { ...item, name: `${item.name} (nacional)`, imported: 0 }]
                    : [item];
                for (const part of parts) {
                    const materialId = await resolveMaterial(part, product.sku);
                    await conn.execute('INSERT INTO product_boms (product_id, material_id, quantity) VALUES (?, ?, ?)', [productId, materialId, part.quantity ?? 1]);
                    resumo.itens_ficha++;
                }
            }

            for (const [key, tier] of Object.entries(product.ipi_tiers ?? {})) {
                if (!channelIdByKey[key]) continue;
                await conn.execute(
                    `INSERT INTO product_channel_settings (product_id, channel_id, ipi_tier) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE ipi_tier = VALUES(ipi_tier)`,
                    [productId, channelIdByKey[key], tier === 1 ? 1 : 2],
                );
            }
        }

        // ---- custo fixo -----------------------------------------------------
        for (const item of cadastro.fixedExpenses) {
            const [found] = await conn.execute('SELECT id FROM fixed_expenses WHERE company_id = ? AND name = ? LIMIT 1', [companyId, item.name]);
            if (found.length > 0) {
                await conn.execute('UPDATE fixed_expenses SET amount = ? WHERE id = ?', [item.amount, found[0].id]);
                resumo.custos_fixos.atualizados++;
            } else {
                await conn.execute('INSERT INTO fixed_expenses (company_id, name, amount) VALUES (?, ?, ?)', [companyId, item.name, item.amount]);
                resumo.custos_fixos.criados++;
            }
        }

        // ---- folha ----------------------------------------------------------
        for (const emp of cadastro.payroll) {
            const custo = engine.calcFolhaFuncionario(emp, settings).custo;
            const values = [
                emp.cost_center || null, emp.admission_date || null, emp.base_salary,
                emp.overtime, emp.bonus, emp.commission, emp.transport_voucher, emp.meal_voucher, custo,
            ];
            const [found] = await conn.execute('SELECT id FROM payroll_expenses WHERE company_id = ? AND employee_name = ? LIMIT 1', [companyId, emp.employee_name]);
            if (found.length > 0) {
                await conn.execute(
                    `UPDATE payroll_expenses SET cost_center = ?, admission_date = ?, base_salary = ?, overtime = ?, bonus = ?,
                        commission = ?, transport_voucher = ?, meal_voucher = ?, total_cost = ? WHERE id = ?`,
                    [...values, found[0].id],
                );
                resumo.folha.atualizados++;
            } else {
                await conn.execute(
                    `INSERT INTO payroll_expenses (company_id, employee_name, cost_center, admission_date, base_salary, overtime, bonus,
                        commission, transport_voucher, meal_voucher, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [companyId, emp.employee_name, ...values],
                );
                resumo.folha.criados++;
            }
        }

        // ---- pró-labore -----------------------------------------------------
        for (const item of cadastro.prolabore) {
            const [found] = await conn.execute('SELECT id FROM prolabore_expenses WHERE company_id = ? AND partner_name = ? LIMIT 1', [companyId, item.partner_name]);
            if (found.length > 0) {
                await conn.execute('UPDATE prolabore_expenses SET total_cost = ? WHERE id = ?', [item.total_cost, found[0].id]);
                resumo.pro_labore.atualizados++;
            } else {
                await conn.execute('INSERT INTO prolabore_expenses (company_id, partner_name, total_cost) VALUES (?, ?, ?)', [companyId, item.partner_name, item.total_cost]);
                resumo.pro_labore.criados++;
            }
        }

        await conn.commit();
        return resumo;
    } catch (error) {
        try { await conn.rollback(); } catch { /* conexão já encerrada */ }
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = { importCadastro };
