'use strict';

/**
 * Relatórios contábeis: DRE completa (estrutura da Lei 6.404/76 e CPC 26).
 */

const express = require('express');
const dre = require('../services/dre/engine');

module.exports = function createReportsRouter({ pool }) {
    const router = express.Router();

    const assertCompany = async (req, companyId) => {
        const [rows] = await pool.execute('SELECT id, name, trade_name, tax_id, tax_regime, owner_id FROM companies WHERE id = ?', [companyId]);
        if (rows.length === 0) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 });
        const c = rows[0];
        const u = req.user || {};
        const allowed = u.role === 'SUPER_ADMIN' || String(c.owner_id) === String(u.id) || (u.company_id && String(u.company_id) === String(c.id));
        if (!allowed) throw Object.assign(new Error('Sem permissão para esta empresa.'), { status: 403 });
        return c;
    };

    const loadYear = async (companyId, year, regime) => {
        const [entries] = await pool.execute(
            'SELECT * FROM monthly_entries WHERE company_id = ? AND YEAR(period_start) = ? ORDER BY period_start',
            [companyId, year],
        );
        let details = [];
        if (entries.length > 0) {
            const [rows] = await pool.query(
                `SELECT ed.entry_id, ed.type, ed.amount, ed.description, c.name AS category_name
                 FROM entry_details ed LEFT JOIN categories c ON c.id = ed.category_id
                 WHERE ed.entry_id IN (?)`,
                [entries.map((e) => e.id)],
            );
            details = rows;
        }
        return dre.buildYear({ entries, details, regime });
    };

    /**
     * GET /api/reports/dre/completa?companyId=14&year=2026
     * Ano pedido + ano anterior (para a análise horizontal) + meta de faturamento.
     */
    router.get('/reports/dre/completa', async (req, res) => {
        try {
            const year = Number(req.query.year) || new Date().getFullYear();
            const company = await assertCompany(req, req.query.companyId);
            const regime = company.tax_regime || 'LUCRO_REAL';
            const [atual, anterior, goals] = await Promise.all([
                loadYear(company.id, year, regime),
                loadYear(company.id, year - 1, regime),
                pool.execute('SELECT planned_amount FROM budget_goals WHERE company_id = ? AND year = ?', [company.id, year]).then(([r]) => r),
            ]);
            res.json({
                empresa: { id: company.id, nome: company.trade_name || company.name, razao_social: company.name, cnpj: company.tax_id, regime },
                ano: year,
                atual,
                anterior: { ano: year - 1, tem_dados: anterior.conferencia.meses_lancados > 0, lines: anterior.lines.map(({ id, values, total }) => ({ id, values, total })) },
                meta_faturamento: goals[0] ? Number(goals[0].planned_amount) : null,
            });
        } catch (e) {
            res.status(e.status || 500).json({ error: e.message });
        }
    });

    return router;
};
