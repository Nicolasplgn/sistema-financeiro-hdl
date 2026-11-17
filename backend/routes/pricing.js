'use strict';

/**
 * Rotas do módulo de precificação (custos de estrutura, painel de rateio,
 * canais, insumos, produtos/fichas técnicas, markup e tributos).
 * Montadas em /api, depois do middleware de autenticação.
 */

const express = require('express');
const path = require('path');

const engine = require('../services/pricing/engine');
const planilhas = require('../services/pricing/planilhas');
const { importCadastro } = require('../services/pricing/importer');
const {
    createPricingService, HttpError, CHANNEL_FIELDS, PAYROLL_FIELDS, materialToItem,
} = require('../services/PricingService');

const DEFAULT_PLANILHAS_DIR = path.join(__dirname, '..', 'markup_files');

const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};
const text = (v, max = 255) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));

module.exports = function createPricingRouter({ pool, upload, logAction = async () => {} }) {
    const router = express.Router();
    const service = createPricingService(pool);

    /** Envolve o handler: erros viram JSON com o status adequado. */
    const route = (handler) => async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            const status = error.status || 500;
            if (status >= 500) console.error('[precificação]', error);
            res.status(status).json({ error: error.message });
        }
    };

    /** Só o SUPER_ADMIN, o dono da empresa ou um usuário vinculado a ela. */
    const assertCompany = async (req, companyId) => {
        if (!companyId) throw new HttpError(400, 'Informe a empresa (companyId).');
        const company = await service.getCompany(companyId);
        const user = req.user || {};
        const allowed = user.role === 'SUPER_ADMIN'
            || String(company.owner_id) === String(user.id)
            || (user.company_id && String(user.company_id) === String(company.id));
        if (!allowed) throw new HttpError(403, 'Sem permissão para esta empresa.');
        return company;
    };

    const TABLES = new Set(['fixed_expenses', 'payroll_expenses', 'prolabore_expenses', 'sales_channels', 'materials', 'products']);

    /** Acha o registro pelo id e confere o acesso à empresa dele. */
    const assertRow = async (req, table, id) => {
        if (!TABLES.has(table)) throw new HttpError(500, 'Tabela inválida.');
        const [rows] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
        if (rows.length === 0) throw new HttpError(404, 'Registro não encontrado.');
        await assertCompany(req, rows[0].company_id);
        return rows[0];
    };

    const user = (req) => [req.user?.id, req.user?.email];

    // =========================================================================
    // CUSTO FIXO
    // =========================================================================
    router.get('/fixed-expenses', route(async (req, res) => {
        await assertCompany(req, req.query.companyId);
        const [rows] = await pool.execute('SELECT * FROM fixed_expenses WHERE company_id = ? ORDER BY name', [req.query.companyId]);
        res.json(rows);
    }));

    router.post('/fixed-expenses', route(async (req, res) => {
        await assertCompany(req, req.body.company_id);
        if (!text(req.body.name)) throw new HttpError(400, 'Informe a descrição da despesa.');
        const [r] = await pool.execute(
            'INSERT INTO fixed_expenses (company_id, name, amount, category) VALUES (?, ?, ?, ?)',
            [req.body.company_id, text(req.body.name, 150), num(req.body.amount), text(req.body.category, 50) || 'GERAL'],
        );
        res.json({ success: true, id: r.insertId });
    }));

    router.put('/fixed-expenses/:id', route(async (req, res) => {
        const row = await assertRow(req, 'fixed_expenses', req.params.id);
        await pool.execute('UPDATE fixed_expenses SET name = ?, amount = ? WHERE id = ?', [
            text(req.body.name, 150) || row.name,
            req.body.amount === undefined ? row.amount : num(req.body.amount),
            row.id,
        ]);
        res.json({ success: true });
    }));

    router.delete('/fixed-expenses/:id', route(async (req, res) => {
        const row = await assertRow(req, 'fixed_expenses', req.params.id);
        await pool.execute('DELETE FROM fixed_expenses WHERE id = ?', [row.id]);
        res.json({ success: true });
    }));

    // =========================================================================
    // FOLHA
    // =========================================================================
    const payrollValues = async (companyId, body, current = {}) => {
        const detalhado = body.base_salary !== undefined && body.base_salary !== null && body.base_salary !== '';
        const merged = { ...current };
        for (const f of PAYROLL_FIELDS) if (body[f] !== undefined) merged[f] = body[f] === '' || body[f] === null ? 0 : num(body[f]);
        const settings = await service.getSettings(companyId);
        const usaCalculo = detalhado || (current.base_salary !== null && current.base_salary !== undefined && body.total_cost === undefined);
        return {
            employee_name: text(body.employee_name, 150) || current.employee_name,
            role: body.role === undefined ? current.role ?? null : text(body.role, 100) || null,
            cost_center: body.cost_center === undefined ? current.cost_center ?? null : text(body.cost_center, 100) || null,
            admission_date: body.admission_date === undefined ? current.admission_date ?? null : body.admission_date || null,
            base_salary: usaCalculo ? num(merged.base_salary) : null,
            overtime: usaCalculo ? num(merged.overtime) : 0,
            bonus: usaCalculo ? num(merged.bonus) : 0,
            commission: usaCalculo ? num(merged.commission) : 0,
            transport_voucher: usaCalculo ? num(merged.transport_voucher) : 0,
            meal_voucher: usaCalculo ? num(merged.meal_voucher) : 0,
            total_cost: usaCalculo
                ? engine.calcFolhaFuncionario(merged, settings).custo
                : num(body.total_cost ?? current.total_cost),
        };
    };

    router.get('/payroll', route(async (req, res) => {
        await assertCompany(req, req.query.companyId);
        res.json(await service.listPayroll(req.query.companyId));
    }));

    router.post('/payroll', route(async (req, res) => {
        await assertCompany(req, req.body.company_id);
        const v = await payrollValues(req.body.company_id, req.body);
        if (!v.employee_name) throw new HttpError(400, 'Informe o nome do funcionário.');
        const [r] = await pool.execute(
            `INSERT INTO payroll_expenses (company_id, employee_name, role, cost_center, admission_date, base_salary, overtime, bonus,
                commission, transport_voucher, meal_voucher, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.body.company_id, v.employee_name, v.role, v.cost_center, v.admission_date, v.base_salary, v.overtime, v.bonus,
                v.commission, v.transport_voucher, v.meal_voucher, v.total_cost],
        );
        res.json({ success: true, id: r.insertId, total_cost: v.total_cost });
    }));

    router.put('/payroll/:id', route(async (req, res) => {
        const row = await assertRow(req, 'payroll_expenses', req.params.id);
        const v = await payrollValues(row.company_id, req.body, row);
        await pool.execute(
            `UPDATE payroll_expenses SET employee_name = ?, role = ?, cost_center = ?, admission_date = ?, base_salary = ?, overtime = ?,
                bonus = ?, commission = ?, transport_voucher = ?, meal_voucher = ?, total_cost = ? WHERE id = ?`,
            [v.employee_name, v.role, v.cost_center, v.admission_date, v.base_salary, v.overtime, v.bonus,
                v.commission, v.transport_voucher, v.meal_voucher, v.total_cost, row.id],
        );
        res.json({ success: true, total_cost: v.total_cost });
    }));

    router.delete('/payroll/:id', route(async (req, res) => {
        const row = await assertRow(req, 'payroll_expenses', req.params.id);
        await pool.execute('DELETE FROM payroll_expenses WHERE id = ?', [row.id]);
        res.json({ success: true });
    }));

    // =========================================================================
    // PRO-LABORE
    // =========================================================================
    router.get('/prolabore', route(async (req, res) => {
        await assertCompany(req, req.query.companyId);
        const [rows] = await pool.execute('SELECT * FROM prolabore_expenses WHERE company_id = ? ORDER BY partner_name', [req.query.companyId]);
        res.json(rows);
    }));

    router.post('/prolabore', route(async (req, res) => {
        await assertCompany(req, req.body.company_id);
        if (!text(req.body.partner_name)) throw new HttpError(400, 'Informe o nome do sócio.');
        const [r] = await pool.execute(
            'INSERT INTO prolabore_expenses (company_id, partner_name, total_cost) VALUES (?, ?, ?)',
            [req.body.company_id, text(req.body.partner_name, 150), num(req.body.total_cost)],
        );
        res.json({ success: true, id: r.insertId });
    }));

    router.put('/prolabore/:id', route(async (req, res) => {
        const row = await assertRow(req, 'prolabore_expenses', req.params.id);
        await pool.execute('UPDATE prolabore_expenses SET partner_name = ?, total_cost = ? WHERE id = ?', [
            text(req.body.partner_name, 150) || row.partner_name,
            req.body.total_cost === undefined ? row.total_cost : num(req.body.total_cost),
            row.id,
        ]);
        res.json({ success: true });
    }));

    router.delete('/prolabore/:id', route(async (req, res) => {
        const row = await assertRow(req, 'prolabore_expenses', req.params.id);
        await pool.execute('DELETE FROM prolabore_expenses WHERE id = ?', [row.id]);
        res.json({ success: true });
    }));

    // =========================================================================
    // CANAIS DE VENDA (colunas do PAINEL)
    // =========================================================================
    router.get('/sales-channels', route(async (req, res) => {
        await assertCompany(req, req.query.companyId);
        res.json(await service.listChannels(req.query.companyId));
    }));

    router.post('/sales-channels', route(async (req, res) => {
        await assertCompany(req, req.body.company_id);
        const name = text(req.body.name, 100);
        if (!name) throw new HttpError(400, 'Informe o nome do canal.');
        const [[{ next }]] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM sales_channels WHERE company_id = ?', [req.body.company_id]);
        // Grava todas as linhas do painel explicitamente (o que não veio entra como 0),
        // para o canal novo não herdar valores padrão antigos das colunas do banco.
        const [r] = await pool.execute(
            `INSERT INTO sales_channels (company_id, name, sort_order${CHANNEL_FIELDS.map((f) => `, ${f}`).join('')})
             VALUES (?, ?, ?${CHANNEL_FIELDS.map(() => ', ?').join('')})`,
            [req.body.company_id, name, next, ...CHANNEL_FIELDS.map((f) => num(req.body[f]))],
        );
        await logAction(...user(req), 'CANAL_CRIADO', `Canal "${name}" criado na empresa ${req.body.company_id}.`);
        res.json({ success: true, id: r.insertId });
    }));

    router.put('/sales-channels/:id', route(async (req, res) => {
        const row = await assertRow(req, 'sales_channels', req.params.id);
        const sets = [];
        const values = [];
        for (const f of [...CHANNEL_FIELDS, 'sort_order']) {
            if (req.body[f] === undefined) continue;
            sets.push(`${f} = ?`);
            values.push(num(req.body[f]));
        }
        if (text(req.body.name)) { sets.push('name = ?'); values.push(text(req.body.name, 100)); }
        if (sets.length > 0) await pool.execute(`UPDATE sales_channels SET ${sets.join(', ')} WHERE id = ?`, [...values, row.id]);
        res.json({ success: true });
    }));

    router.delete('/sales-channels/:id', route(async (req, res) => {
        const row = await assertRow(req, 'sales_channels', req.params.id);
        await pool.execute('DELETE FROM product_channel_settings WHERE channel_id = ?', [row.id]);
        await pool.execute('DELETE FROM sales_channels WHERE id = ?', [row.id]);
        await logAction(...user(req), 'CANAL_EXCLUIDO', `Canal "${row.name}" excluído da empresa ${row.company_id}.`);
        res.json({ success: true });
    }));

    // =========================================================================
    // INSUMOS
    // =========================================================================
    /** O insumo tem origem (importado/nacional) e UM preço sem IPI, gravado na coluna da origem. */
    const materialValues = (body, current = {}) => {
        const isNational = body.is_national === undefined
            ? Boolean(Number(current.is_national ?? 1))
            : body.is_national === true || body.is_national === 1 || body.is_national === '1' || body.is_national === 'true';
        const currentItem = materialToItem({ ...current, quantity: 1 });
        const informed = body.price ?? (isNational ? body.price_national : body.price_imported);
        const price = informed === undefined || informed === null || informed === ''
            ? currentItem.imported + currentItem.national
            : num(informed);
        return {
            name: text(body.name) || current.name,
            ncm: body.ncm === undefined ? current.ncm ?? '' : text(body.ncm, 20),
            ipi_percent: body.ipi_percent === undefined ? num(current.ipi_percent) : num(body.ipi_percent),
            is_national: isNational ? 1 : 0,
            price_national: isNational ? price : 0,
            price_imported: isNational ? 0 : price,
        };
    };

    router.get('/materials-full', route(async (req, res) => {
        await assertCompany(req, req.query.companyId);
        const [rows] = await pool.execute(
            `SELECT m.*, (SELECT COUNT(*) FROM product_boms pb WHERE pb.material_id = m.id) AS used_in
             FROM materials m WHERE m.company_id = ? ORDER BY m.name, m.id`,
            [req.query.companyId],
        );
        res.json(rows.map((m) => {
            const item = materialToItem(m);
            const isNational = item.imported > 0 ? 0 : item.national > 0 ? 1 : Number(m.is_national) ? 1 : 0;
            return { ...m, is_national: isNational, price: item.imported + item.national, used_in: Number(m.used_in) };
        }));
    }));

    router.post('/materials', route(async (req, res) => {
        await assertCompany(req, req.body.company_id);
        const v = materialValues(req.body);
        if (!v.name) throw new HttpError(400, 'Informe o nome do insumo.');
        const [r] = await pool.execute(
            'INSERT INTO materials (company_id, name, ncm, price_national, price_imported, ipi_percent, is_national) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.body.company_id, v.name, v.ncm, v.price_national, v.price_imported, v.ipi_percent, v.is_national],
        );
        res.json({ success: true, id: r.insertId });
    }));

    router.put('/materials/:id', route(async (req, res) => {
        const row = await assertRow(req, 'materials', req.params.id);
        const v = materialValues(req.body, row);
        await pool.execute(
            'UPDATE materials SET name = ?, ncm = ?, price_national = ?, price_imported = ?, ipi_percent = ?, is_national = ? WHERE id = ?',
            [v.name, v.ncm, v.price_national, v.price_imported, v.ipi_percent, v.is_national, row.id],
        );
        res.json({ success: true });
    }));

    router.delete('/materials/:id', route(async (req, res) => {
        const row = await assertRow(req, 'materials', req.params.id);
        const [used] = await pool.execute(
            'SELECT DISTINCT p.name FROM product_boms pb JOIN products p ON p.id = pb.product_id WHERE pb.material_id = ?',
            [row.id],
        );
        if (used.length > 0) {
            throw new HttpError(409, `Insumo em uso na ficha técnica de: ${used.map((u) => u.name).join(', ')}. Remova-o das fichas antes de excluir.`);
        }
        await pool.execute('DELETE FROM materials WHERE id = ?', [row.id]);
        res.json({ success: true });
    }));

    // =========================================================================
    // PRODUTOS E FICHA TÉCNICA
    // =========================================================================
    router.get('/products-list', route(async (req, res) => {
        await assertCompany(req, req.query.companyId);
        const company = await service.getCompany(req.query.companyId);
        const settings = await service.getSettings(req.query.companyId);
        const products = await service.listProducts(req.query.companyId);
        const boms = await service.loadBomItems(products.map((p) => p.id));
        res.json(products.map((p) => {
            const ficha = engine.calcFichaTecnica(boms.get(Number(p.id)), settings, company.tax_regime);
            return { ...p, allocation_percent: num(p.allocation_percent), itens: ficha.linhas.length, custo: ficha.custo, custos: ficha.custos };
        }));
    }));

    router.post('/products', route(async (req, res) => {
        await assertCompany(req, req.body.company_id);
        const name = text(req.body.name);
        if (!name) throw new HttpError(400, 'Informe o nome do produto.');
        const [[{ next }]] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products WHERE company_id = ?', [req.body.company_id]);
        const [r] = await pool.execute(
            'INSERT INTO products (company_id, name, sku, sort_order, allocation_percent) VALUES (?, ?, ?, ?, ?)',
            [req.body.company_id, name, text(req.body.sku, 100) || null, next, num(req.body.allocation_percent)],
        );
        res.json({ success: true, id: r.insertId });
    }));

    router.put('/products/:id', route(async (req, res) => {
        const row = await assertRow(req, 'products', req.params.id);
        await pool.execute('UPDATE products SET name = ?, sku = ?, sort_order = ?, allocation_percent = ? WHERE id = ?', [
            text(req.body.name) || row.name,
            req.body.sku === undefined ? row.sku : text(req.body.sku, 100) || null,
            req.body.sort_order === undefined ? row.sort_order : Math.round(num(req.body.sort_order)),
            req.body.allocation_percent === undefined ? row.allocation_percent : num(req.body.allocation_percent),
            row.id,
        ]);
        res.json({ success: true });
    }));

    router.delete('/products/:id', route(async (req, res) => {
        const row = await assertRow(req, 'products', req.params.id);
        await pool.execute('DELETE FROM product_boms WHERE product_id = ?', [row.id]);
        await pool.execute('DELETE FROM product_channel_settings WHERE product_id = ?', [row.id]);
        await pool.execute('DELETE FROM products WHERE id = ?', [row.id]);
        res.json({ success: true });
    }));

    /** Ficha técnica calculada, com as mesmas colunas da planilha. */
    router.get('/pricing/ficha/:productId', route(async (req, res) => {
        await assertRow(req, 'products', req.params.productId);
        res.json(await service.getFicha(req.params.productId));
    }));

    /** Itens crus da ficha (compatibilidade). */
    router.get('/product-boms/:productId', route(async (req, res) => {
        await assertRow(req, 'products', req.params.productId);
        const [rows] = await pool.execute(
            `SELECT pb.*, m.name, m.ncm, m.price_national, m.price_imported, m.ipi_percent, m.is_national
             FROM product_boms pb JOIN materials m ON pb.material_id = m.id
             WHERE pb.product_id = ? ORDER BY pb.id`,
            [req.params.productId],
        );
        res.json(rows);
    }));

    /** Regrava a ficha técnica inteira do produto. */
    router.post('/product-boms', route(async (req, res) => {
        const product = await assertRow(req, 'products', req.body.product_id);
        const materials = Array.isArray(req.body.materials) ? req.body.materials : [];
        const ids = [...new Set(materials.map((m) => Number(m.material_id)).filter(Boolean))];
        if (ids.length > 0) {
            const [valid] = await pool.query('SELECT id FROM materials WHERE company_id = ? AND id IN (?)', [product.company_id, ids]);
            if (valid.length !== ids.length) throw new HttpError(400, 'A ficha contém insumo que não pertence a esta empresa.');
        }
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute('DELETE FROM product_boms WHERE product_id = ?', [product.id]);
            for (const m of materials) {
                if (!Number(m.material_id) || num(m.quantity) <= 0) continue;
                await conn.execute('INSERT INTO product_boms (product_id, material_id, quantity) VALUES (?, ?, ?)', [product.id, Number(m.material_id), num(m.quantity)]);
            }
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
        res.json({ success: true, ...(await service.getFicha(product.id)) });
    }));

    // =========================================================================
    // PAINEL, MARKUP E TRIBUTOS
    // =========================================================================
    router.get('/pricing/settings', route(async (req, res) => {
        await assertCompany(req, req.query.companyId);
        res.json(await service.getSettings(req.query.companyId));
    }));

    router.put('/pricing/settings', route(async (req, res) => {
        await assertCompany(req, req.body.company_id);
        res.json(await service.saveSettings(req.body.company_id, req.body));
    }));

    router.get('/pricing/painel', route(async (req, res) => {
        await assertCompany(req, req.query.companyId);
        res.json(await service.getPainel(req.query.companyId));
    }));

    router.put('/pricing/painel', route(async (req, res) => {
        await assertCompany(req, req.body.company_id);
        const painel = await service.savePainel(req.body.company_id, req.body);
        await logAction(...user(req), 'PAINEL_RATEIO', `Painel de rateio atualizado na empresa ${req.body.company_id}.`);
        res.json(painel);
    }));

    /** Markup + tributos gravados de um produto em um canal. */
    router.get('/price-calc', route(async (req, res) => {
        if (!req.query.productId || !req.query.channelId) throw new HttpError(400, 'Informe productId e channelId.');
        await assertRow(req, 'products', req.query.productId);
        res.json(await service.calculate(req.query.productId, req.query.channelId));
    }));

    /** Simulação: mesmos cálculos com valores alternativos, sem gravar. */
    router.post('/pricing/simulate', route(async (req, res) => {
        if (!req.body.productId || !req.body.channelId) throw new HttpError(400, 'Informe productId e channelId.');
        await assertRow(req, 'products', req.body.productId);
        res.json(await service.calculate(req.body.productId, req.body.channelId, req.body.overrides || {}));
    }));

    /**
     * Carrega as planilhas de markup na empresa. Com arquivos CSV no upload
     * (campo "files") usa esses; sem upload, usa a pasta backend/markup_files.
     * `substituir=true` apaga antes o cadastro de precificação da empresa.
     */
    router.post('/pricing/import-planilhas', upload.array('files', 200), route(async (req, res) => {
        const companyId = req.body.companyId || req.body.company_id;
        await assertCompany(req, companyId);
        const substituir = req.body.substituir === true || req.body.substituir === 'true' || req.body.substituir === '1';

        const uploaded = (req.files || []).map((f) => ({
            // multer entrega o nome em latin1; os arquivos têm acento (EXPORTAÇÃO).
            name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
            content: f.buffer,
        }));
        const dados = uploaded.length > 0 ? planilhas.parsePlanilhas(uploaded) : planilhas.readPlanilhasDir(DEFAULT_PLANILHAS_DIR);
        if (!dados.painel) throw new HttpError(400, 'A planilha PAINEL não foi encontrada entre os arquivos.');

        const resumo = await importCadastro(pool, companyId, planilhas.toCadastro(dados), { substituir });
        await logAction(...user(req), 'IMPORTACAO_PLANILHAS',
            `Planilhas de markup carregadas na empresa ${companyId} (${substituir ? 'substituindo' : 'mesclando'}): ${JSON.stringify(resumo)}`);
        res.json({ success: true, origem: uploaded.length > 0 ? 'upload' : 'markup_files', ignorados: dados.ignorados, resumo });
    }));

    return router;
};
