require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = 4000;

// --- CONFIGURAÇÃO ---
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'financeiro',
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  waitForConnections: true,
  connectionLimit: 10
});

const amountOrZero = (v) => Number(v) || 0;
const logAction = async (uid, uname, act, det) => { 
  try { 
    await pool.execute('INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?, ?, ?, ?)', [uid || 0, uname || 'Sistema', act, det]); 
  } catch(e){ console.error("Erro log:", e.message); } 
};

// =================================================================================
// 1. ROTAS UTILITÁRIAS (CNPJ)
// =================================================================================
app.get('/api/utils/cnpj/:cnpj', async (req, res) => {
    const cnpj = req.params.cnpj.replace(/\D/g, ''); 
    if (cnpj.length !== 14) return res.status(400).json({ message: 'CNPJ inválido' });
    try {
        const r1 = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 5000, httpsAgent });
        return res.json({ taxId: cnpj, name: r1.data.razao_social, tradeName: r1.data.nome_fantasia || r1.data.razao_social, taxRegime: r1.data.opcao_pelo_simples ? 'SIMPLES' : 'LUCRO_PRESUMIDO' });
    } catch (err1) {
        try {
            const r2 = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, { timeout: 8000, httpsAgent });
            if (r2.data.status === "ERROR") throw new Error(r2.data.message);
            return res.json({ taxId: cnpj, name: r2.data.nome, tradeName: r2.data.fantasia || r2.data.nome, taxRegime: 'LUCRO_PRESUMIDO' });
        } catch (err2) { return res.status(500).json({ message: 'Erro ao consultar CNPJ', details: err2.message }); }
    }
});

// =================================================================================
// 2. ROTAS DE EMPRESAS
// =================================================================================
app.get('/api/companies', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM companies ORDER BY name ASC');
        res.json(rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/companies', async (req, res) => {
    const { name, trade_name, tax_id, tax_regime } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO companies (name, trade_name, tax_id, tax_regime) VALUES (?, ?, ?, ?)',
            [name, trade_name, tax_id, tax_regime]
        );
        await logAction(0, 'Admin', 'CREATE_COMPANY', `Criou empresa ${name}`);
        res.json({ id: result.insertId, name, trade_name, tax_id, tax_regime });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.put('/api/companies/:id', async (req, res) => {
    const { name, trade_name, tax_id, tax_regime } = req.body;
    try {
        await pool.execute(
            'UPDATE companies SET name=?, trade_name=?, tax_id=?, tax_regime=? WHERE id=?',
            [name, trade_name, tax_id, tax_regime, req.params.id]
        );
        await logAction(0, 'Admin', 'UPDATE_COMPANY', `Editou empresa ID ${req.params.id}`);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/companies/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM companies WHERE id=?', [req.params.id]);
        await logAction(0, 'Admin', 'DELETE_COMPANY', `Excluiu empresa ID ${req.params.id}`);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// =================================================================================
// 3. ROTAS DE PARCEIROS
// =================================================================================
app.get('/api/partners/:companyId', async (req, res) => {
    try { 
        const [rows] = await pool.execute('SELECT * FROM partners WHERE company_id = ? ORDER BY name ASC', [req.params.companyId]); 
        res.json(rows); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/partners', async (req, res) => {
    const { company_id, name, tax_id, type, phone, email } = req.body;
    try { 
        await pool.execute('INSERT INTO partners (company_id, name, tax_id, type, phone, email) VALUES (?, ?, ?, ?, ?, ?)', [company_id, name, tax_id, type, phone, email]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/partners/:id', async (req, res) => {
    try { 
        await pool.execute('DELETE FROM partners WHERE id = ?', [req.params.id]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =================================================================================
// 4. ROTAS DE LANÇAMENTOS (Com vínculo de Parceiros e Detalhes)
// =================================================================================
app.get('/api/entries', async (req, res) => {
    const { companyId, month } = req.query;

    if (!companyId) return res.status(400).json({ message: 'ID da empresa é obrigatório' });

    try {
        let sql = `
            SELECT m.*, 
            p1.name as top_client_name, 
            p2.name as top_supplier_name
            FROM monthly_entries m
            LEFT JOIN partners p1 ON m.top_client_id = p1.id
            LEFT JOIN partners p2 ON m.top_supplier_id = p2.id
            WHERE m.company_id = ?`;
            
        const params = [companyId];

        if (month) {
            sql += ' AND m.period_start = ?';
            params.push(month);
            const [rows] = await pool.execute(sql, params);
            
            // Se encontrou o mês, busca os detalhes (itens)
            if (rows.length > 0) {
                const entryId = rows[0].id;
                try {
                    const [details] = await pool.execute('SELECT * FROM entry_details WHERE entry_id = ?', [entryId]);
                    return res.json({ ...rows[0], details });
                } catch (errDetails) {
                    return res.json({ ...rows[0], details: [] });
                }
            }
            return res.json(null);
        } else {
            sql += ' ORDER BY m.period_start DESC';
            const [rows] = await pool.execute(sql, params);
            res.json(rows);
        }
    } catch (error) { 
        res.status(500).json({ message: error.message }); 
    }
});

app.get('/api/entries/history', async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ message: 'ID obrigatório' });
    try {
        const [rows] = await pool.execute(
            `SELECT id, period_start, 
            (revenue_resale + revenue_product + revenue_service + revenue_rent + revenue_other) as total_revenue,
            (tax_icms + tax_pis + tax_cofins + tax_iss + tax_irpj + tax_csll + tax_difal + tax_additional_irpj + tax_fust + tax_funtell) as total_taxes,
            (purchases_total + expenses_total) as total_costs
            FROM monthly_entries WHERE company_id = ? ORDER BY period_start DESC`,
            [companyId]
        );
        res.json(rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/entries', async (req, res) => {
    const data = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.execute(
            'SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?',
            [data.companyId, data.periodStart]
        );

        let entryId;
        const flds = {
            revenue_resale: data.revenue.resale, revenue_product: data.revenue.product,
            revenue_service: data.revenue.service, revenue_rent: data.revenue.rent, revenue_other: data.revenue.other,
            tax_icms: data.taxes.icms, tax_difal: data.taxes.difal, tax_iss: data.taxes.iss,
            tax_pis: data.taxes.pis, tax_cofins: data.taxes.cofins, tax_csll: data.taxes.csll,
            tax_irpj: data.taxes.irpj, tax_additional_irpj: data.taxes.additionalIrpj,
            tax_fust: data.taxes.fust || 0, tax_funtell: data.taxes.funtell || 0,
            purchases_total: data.purchasesTotal, expenses_total: data.expensesTotal, notes: data.notes
        };

        if (existing.length > 0) {
            entryId = existing[0].id;
            const upd = Object.keys(flds).map(k => `${k} = ?`).join(', ');
            await connection.execute(`UPDATE monthly_entries SET ${upd} WHERE id = ?`, [...Object.values(flds), entryId]);
        } else {
            const cols = ['company_id', 'period_start', 'period_end', ...Object.keys(flds)];
            const vals = [data.companyId, data.periodStart, data.periodEnd, ...Object.values(flds)];
            const ph = cols.map(() => '?').join(', ');
            const [resInsert] = await connection.execute(`INSERT INTO monthly_entries (${cols.join(', ')}) VALUES (${ph})`, vals);
            entryId = resInsert.insertId;
        }

        // Deleta detalhes antigos e insere novos
        await connection.execute('DELETE FROM entry_details WHERE entry_id = ?', [entryId]);
        
        if (data.details && data.details.length > 0) {
            for (const item of data.details) {
                if (item.partner_id && item.amount > 0) {
                    await connection.execute(
                        'INSERT INTO entry_details (entry_id, partner_id, type, amount) VALUES (?, ?, ?, ?)',
                        [entryId, item.partner_id, item.type, item.amount]
                    );
                }
            }
        }

        // Atualiza Tops
        const [topClient] = await connection.execute(
            `SELECT partner_id FROM entry_details WHERE entry_id = ? AND type = 'REVENUE' ORDER BY amount DESC LIMIT 1`, 
            [entryId]
        );
        const [topSupplier] = await connection.execute(
            `SELECT partner_id FROM entry_details WHERE entry_id = ? AND type = 'EXPENSE' ORDER BY amount DESC LIMIT 1`, 
            [entryId]
        );

        await connection.execute(
            `UPDATE monthly_entries SET top_client_id = ?, top_supplier_id = ? WHERE id = ?`,
            [topClient[0]?.partner_id || null, topSupplier[0]?.partner_id || null, entryId]
        );

        await connection.commit();
        await logAction(0, 'Admin', 'UPSERT_ENTRY', `Atualizou lançamentos de ${data.periodStart}`);
        res.json({ success: true });

    } catch (e) {
        await connection.rollback();
        console.error("Erro transação:", e);
        res.status(500).json({ message: e.message });
    } finally {
        connection.release();
    }
});

app.delete('/api/entries', async (req, res) => {
    const { companyId, month } = req.query;
    try {
        await pool.execute('DELETE FROM monthly_entries WHERE company_id = ? AND period_start = ?', [companyId, month]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/entries/last-reference/:companyId', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM monthly_entries WHERE company_id = ? ORDER BY period_start DESC LIMIT 1`, [req.params.companyId]);
        if (rows.length === 0) return res.json(null);
        const { id, period_start, period_end, created_at, updated_at, ...dataToClone } = rows[0];
        return res.json(dataToClone);
    } catch (error) { res.status(500).json({ message: 'Erro ao buscar referência' }); }
});

// =================================================================================
// 5. INTELIGÊNCIA (PROJEÇÕES)
// =================================================================================
app.get('/api/intelligence/projections', async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ message: 'ID necessário' });

    try {
        const [comp] = await pool.execute('SELECT tax_regime FROM companies WHERE id = ?', [companyId]);
        const regime = comp[0]?.tax_regime || 'SIMPLES';
        
        const [hist] = await pool.execute(
            `SELECT period_start, 
             (revenue_resale + revenue_product + revenue_service + revenue_rent + revenue_other) as revenue,
             (purchases_total + expenses_total) as expenses,
             (tax_icms + tax_pis + tax_cofins + tax_iss + tax_irpj + tax_csll) as taxes
             FROM monthly_entries 
             WHERE company_id = ? 
             ORDER BY period_start ASC`, 
            [companyId]
        );

        const dataset = hist.map(h => ({
            period: h.period_start.substring(0, 7),
            revenue: Number(h.revenue),
            expenses: Number(h.expenses),
            taxes: Number(h.taxes),
            profit: Number(h.revenue) - Number(h.expenses) - Number(h.taxes),
            type: 'REAL'
        }));

        const totalRev = dataset.reduce((a, b) => a + b.revenue, 0);
        const totalTax = dataset.reduce((a, b) => a + b.taxes, 0);
        const avgTaxRate = totalRev > 0 ? totalTax / totalRev : 0.06;

        const LIMITS = { SIMPLES: 4800000, LUCRO_PRESUMIDO: 78000000, LUCRO_REAL: 0 };
        const regimeLimit = LIMITS[regime] || 0;

        res.json({
            dataset,
            regime: { name: regime, limit: regimeLimit },
            averages: { taxRate: avgTaxRate }
        });
    } catch (error) {
        console.error('Erro projections:', error);
        res.status(500).json({ message: 'Erro ao gerar projeções' });
    }
});

// =================================================================================
// 6. RELATÓRIOS (DRE e RANKING e DASHBOARD)
// =================================================================================

// 6.1 DRE
app.get('/api/reports/dre', async (req, res) => {
    const { companyId, year } = req.query;
    if (!companyId) return res.status(400).json({ message: 'ID da empresa necessário' });

    const selectedYear = year || new Date().getFullYear();
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    try {
        const [rows] = await pool.execute(
            `SELECT * FROM monthly_entries 
             WHERE company_id = ? AND period_start >= ? AND period_start <= ?
             ORDER BY period_start ASC`,
            [companyId, startDate, endDate]
        );

        const dre = Array(12).fill(null).map((_, i) => ({
            month: i + 1, grossRevenue: 0, deductions: 0, netRevenue: 0,
            variableCosts: 0, grossProfit: 0, expenses: 0, netResult: 0
        }));

        rows.forEach(r => {
            let monthIndex = 0;
            if (r.period_start && typeof r.period_start === 'string') {
                const parts = r.period_start.split('-'); 
                monthIndex = parseInt(parts[1], 10) - 1; 
            } else {
                monthIndex = new Date(r.period_start).getUTCMonth();
            }

            if (dre[monthIndex]) {
                const revenue = amountOrZero(r.revenue_resale) + amountOrZero(r.revenue_product) + amountOrZero(r.revenue_service) + amountOrZero(r.revenue_rent) + amountOrZero(r.revenue_other);
                const taxes = amountOrZero(r.tax_icms) + amountOrZero(r.tax_pis) + amountOrZero(r.tax_cofins) + amountOrZero(r.tax_iss) + amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll) + amountOrZero(r.tax_difal) + amountOrZero(r.tax_additional_irpj) + amountOrZero(r.tax_fust) + amountOrZero(r.tax_funtell);
                const costs = amountOrZero(r.purchases_total);
                const expenses = amountOrZero(r.expenses_total);

                dre[monthIndex].grossRevenue += revenue;
                dre[monthIndex].deductions += taxes;
                dre[monthIndex].netRevenue += (revenue - taxes);
                dre[monthIndex].variableCosts += costs;
                dre[monthIndex].grossProfit += (revenue - taxes - costs);
                dre[monthIndex].expenses += expenses;
                dre[monthIndex].netResult += (revenue - taxes - costs - expenses);
            }
        });

        res.json(dre);
    } catch (error) { res.status(500).json({ message: 'Erro ao gerar DRE' }); }
});

// 6.2 RANKING DE PARCEIROS
app.get('/api/reports/partners-ranking', async (req, res) => {
    const { companyId, startDate, endDate } = req.query;
    
    if (!companyId || !startDate || !endDate) return res.status(400).json({ message: 'ID obrigatório' });

    try {
        const [clients] = await pool.execute(`
            SELECT p.name, COUNT(d.id) as occurrences, SUM(d.amount) as value
            FROM entry_details d
            JOIN monthly_entries m ON d.entry_id = m.id
            JOIN partners p ON d.partner_id = p.id
            WHERE m.company_id = ? AND m.period_start >= ? AND m.period_start <= ? AND d.type = 'REVENUE'
            GROUP BY p.id ORDER BY value DESC LIMIT 100
        `, [companyId, startDate, endDate]);

        const [suppliers] = await pool.execute(`
            SELECT p.name, COUNT(d.id) as occurrences, SUM(d.amount) as value
            FROM entry_details d
            JOIN monthly_entries m ON d.entry_id = m.id
            JOIN partners p ON d.partner_id = p.id
            WHERE m.company_id = ? AND m.period_start >= ? AND m.period_start <= ? AND d.type = 'EXPENSE'
            GROUP BY p.id ORDER BY value DESC LIMIT 100
        `, [companyId, startDate, endDate]);

        res.json({ clients, suppliers });
    } catch (error) { res.status(500).json({ message: 'Erro ao gerar ranking' }); }
});

// 6.3 DASHBOARD GERAL (Report) - COM DETALHAMENTO DE IMPOSTOS
app.post('/api/report', async (req, res) => {
    const { companyIds, startDate, endDate } = req.body;
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM monthly_entries 
             WHERE company_id IN (?) AND period_start >= ? AND period_start <= ? 
             ORDER BY period_start ASC`,
            [companyIds[0], startDate, endDate]
        );

        const summary = { totalRevenue: 0, totalProfit: 0, totalTaxes: 0, totalCosts: 0, tax_icms: 0, tax_pis: 0, tax_cofins: 0, tax_iss: 0, tax_irpj: 0, tax_csll: 0 };
        const months = rows.map(r => {
            const rev = amountOrZero(r.revenue_resale) + amountOrZero(r.revenue_product) + amountOrZero(r.revenue_service) + amountOrZero(r.revenue_rent) + amountOrZero(r.revenue_other);
            
            // Impostos detalhados
            const icms = amountOrZero(r.tax_icms);
            const pis = amountOrZero(r.tax_pis);
            const cofins = amountOrZero(r.tax_cofins);
            const iss = amountOrZero(r.tax_iss);
            const irpj_csll = amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll) + amountOrZero(r.tax_additional_irpj);
            const outros = amountOrZero(r.tax_difal) + amountOrZero(r.tax_fust) + amountOrZero(r.tax_funtell);

            const taxTotal = icms + pis + cofins + iss + irpj_csll + outros;
            const cost = amountOrZero(r.purchases_total) + amountOrZero(r.expenses_total);
            
            summary.totalRevenue += rev; 
            summary.totalTaxes += taxTotal; 
            summary.totalCosts += cost; 
            summary.totalProfit += (rev - taxTotal - cost);
            summary.tax_icms += icms; 
            summary.tax_pis += pis; 
            summary.tax_cofins += cofins;
            summary.tax_iss += iss; 
            summary.tax_irpj += amountOrZero(r.tax_irpj); 
            summary.tax_csll += amountOrZero(r.tax_csll);

            return { 
                monthKey: r.period_start.substring(0, 7), 
                totalRevenue: rev, 
                totalTaxes: taxTotal, 
                totalPurchases: amountOrZero(r.purchases_total), 
                totalExpenses: amountOrZero(r.expenses_total), 
                profit: rev - taxTotal - cost,
                // Detalhes para gráfico de barras
                tax_icms: icms,
                tax_pis: pis,
                tax_cofins: cofins,
                tax_iss: iss,
                tax_irpj_csll: irpj_csll
            };
        });

        res.json({ months, summary });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// 7. AUTH & LOGS
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if (email === 'admin@hdl.com' && password === 'admin123') return res.json({ user: { id: 1, full_name: 'Admin', email, role: 'ADMIN' } });
        const [u] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (u.length === 0 || u[0].password_hash !== password) return res.status(401).json({ message: 'Inválido' });
        await logAction(u[0].id, u[0].full_name, 'LOGIN', 'Login realizado');
        res.json({ user: { id: u[0].id, full_name: u[0].full_name, email, role: u[0].role, company_id: u[0].company_id } });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/audit-logs', async (req, res) => {
    try { 
        const { startDate, endDate } = req.query;
        let sql = 'SELECT * FROM audit_logs';
        let params = [];
        if (startDate && endDate) {
             sql += ' WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC';
             params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
        } else {
             sql += ' ORDER BY timestamp DESC LIMIT 100';
        }
        const [rows] = await pool.execute(sql, params); 
        res.json(rows); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));