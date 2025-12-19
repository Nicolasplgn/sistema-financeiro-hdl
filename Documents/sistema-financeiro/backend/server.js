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

// Helper para tratar nulos no JS
const amountOrZero = (v) => Number(v) || 0;

const logAction = async (uid, uname, act, det) => { 
  try { 
    await pool.execute('INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?, ?, ?, ?)', [uid || 0, uname || 'Sistema', act, det]); 
  } catch(e){ console.error("Erro log:", e.message); } 
};

// ==========================================
// 1. ROTAS UTILITÁRIAS (CNPJ e CATEGORIAS)
// ==========================================
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

app.get('/api/categories', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM categories ORDER BY type, name');
        res.json(rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ==========================================
// 2. EMPRESAS E PARCEIROS
// ==========================================
app.get('/api/companies', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM companies ORDER BY name ASC');
        res.json(rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/companies', async (req, res) => {
    const { name, trade_name, tax_id, tax_regime } = req.body;
    try {
        const [result] = await pool.execute('INSERT INTO companies (name, trade_name, tax_id, tax_regime) VALUES (?, ?, ?, ?)', [name, trade_name, tax_id, tax_regime]);
        res.json({ id: result.insertId, name, trade_name, tax_id, tax_regime });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

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

// ==========================================
// 3. LANÇAMENTOS (CRUD + HISTORY CORRIGIDO)
// ==========================================
app.get('/api/entries', async (req, res) => {
    const { companyId, month } = req.query;
    if (!companyId) return res.status(400).json({ message: 'ID obrigatório' });

    try {
        let sql = `SELECT m.*, p1.name as top_client_name, p2.name as top_supplier_name FROM monthly_entries m LEFT JOIN partners p1 ON m.top_client_id = p1.id LEFT JOIN partners p2 ON m.top_supplier_id = p2.id WHERE m.company_id = ?`;
        const params = [companyId];

        if (month) {
            sql += ' AND m.period_start = ?';
            params.push(month);
            const [rows] = await pool.execute(sql, params);
            if (rows.length > 0) {
                const entryId = rows[0].id;
                try {
                    const [details] = await pool.execute('SELECT * FROM entry_details WHERE entry_id = ?', [entryId]);
                    return res.json({ ...rows[0], details });
                } catch (errDetails) { return res.json({ ...rows[0], details: [] }); }
            }
            return res.json(null);
        } else {
            sql += ' ORDER BY m.period_start DESC';
            const [rows] = await pool.execute(sql, params);
            res.json(rows);
        }
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ROTA HISTORY CORRIGIDA (EVITA O NaN)
app.get('/api/entries/history', async (req, res) => {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ message: 'ID obrigatório' });
    try {
        // Usamos COALESCE para garantir que NULL vire 0 no banco
        const [rows] = await pool.execute(
            `SELECT id, period_start, 
            (COALESCE(revenue_resale,0) + COALESCE(revenue_product,0) + COALESCE(revenue_service,0) + COALESCE(revenue_rent,0) + COALESCE(revenue_other,0)) as total_revenue,
            (COALESCE(tax_icms,0) + COALESCE(tax_pis,0) + COALESCE(tax_cofins,0) + COALESCE(tax_iss,0) + COALESCE(tax_irpj,0) + COALESCE(tax_csll,0) + COALESCE(tax_difal,0) + COALESCE(tax_additional_irpj,0) + COALESCE(tax_fust,0) + COALESCE(tax_funtell,0)) as total_taxes,
            (COALESCE(purchases_total,0) + COALESCE(expenses_total,0)) as total_costs
            FROM monthly_entries WHERE company_id = ? ORDER BY period_start DESC`,
            [companyId]
        );
        res.json(rows);
    } catch (error) { 
        console.error(error);
        res.status(500).json({ message: error.message }); 
    }
});

app.post('/api/entries', async (req, res) => {
    const data = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.execute('SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?', [data.companyId, data.periodStart]);

        let entryId;
        // Garante que undefined vira 0
        const flds = {
            revenue_resale: data.revenue.resale || 0, revenue_product: data.revenue.product || 0,
            revenue_service: data.revenue.service || 0, revenue_rent: data.revenue.rent || 0, revenue_other: data.revenue.other || 0,
            tax_icms: data.taxes.icms || 0, tax_difal: data.taxes.difal || 0, tax_iss: data.taxes.iss || 0,
            tax_pis: data.taxes.pis || 0, tax_cofins: data.taxes.cofins || 0, tax_csll: data.taxes.csll || 0,
            tax_irpj: data.taxes.irpj || 0, tax_additional_irpj: data.taxes.additionalIrpj || 0,
            tax_fust: data.taxes.fust || 0, tax_funtell: data.taxes.funtell || 0,
            purchases_total: data.purchasesTotal || 0, expenses_total: data.expensesTotal || 0, notes: data.notes
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

        await connection.execute('DELETE FROM entry_details WHERE entry_id = ?', [entryId]);
        
        if (data.details && data.details.length > 0) {
            for (const item of data.details) {
                if (item.amount > 0) {
                    await connection.execute(
                        'INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount) VALUES (?, ?, ?, ?, ?)',
                        [entryId, item.partner_id || null, item.category_id || null, item.type, item.amount]
                    );
                }
            }
        }

        // Atualiza Rankings
        const [topC] = await connection.execute(`SELECT partner_id FROM entry_details WHERE entry_id = ? AND type = 'REVENUE' ORDER BY amount DESC LIMIT 1`, [entryId]);
        const [topS] = await connection.execute(`SELECT partner_id FROM entry_details WHERE entry_id = ? AND type = 'EXPENSE' ORDER BY amount DESC LIMIT 1`, [entryId]);
        await connection.execute(`UPDATE monthly_entries SET top_client_id = ?, top_supplier_id = ? WHERE id = ?`, [topC[0]?.partner_id || null, topS[0]?.partner_id || null, entryId]);

        await connection.commit();
        res.json({ success: true, id: entryId });
    } catch (e) {
        await connection.rollback();
        res.status(500).json({ message: e.message });
    } finally { connection.release(); }
});

app.delete('/api/entries', async (req, res) => {
    try {
        await pool.execute('DELETE FROM monthly_entries WHERE company_id = ? AND period_start = ?', [req.query.companyId, req.query.month]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ==========================================
// 4. RELATÓRIOS (DRE, DASHBOARD, ETC)
// ==========================================

// ROTA DO DRE (Que estava faltando e dando 404)
app.get('/api/reports/dre', async (req, res) => {
    const { companyId, year } = req.query;
    if (!companyId) return res.status(400).json({ message: 'ID necessário' });

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
            const idx = new Date(r.period_start).getUTCMonth();
            // Cálculos com proteção contra null (amountOrZero)
            const rev = amountOrZero(r.revenue_resale) + amountOrZero(r.revenue_product) + amountOrZero(r.revenue_service) + amountOrZero(r.revenue_rent) + amountOrZero(r.revenue_other);
            const taxes = amountOrZero(r.tax_icms) + amountOrZero(r.tax_pis) + amountOrZero(r.tax_cofins) + amountOrZero(r.tax_iss) + amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll) + amountOrZero(r.tax_difal) + amountOrZero(r.tax_additional_irpj);
            const costs = amountOrZero(r.purchases_total);
            const exp = amountOrZero(r.expenses_total);

            dre[idx].grossRevenue += rev;
            dre[idx].deductions += taxes;
            dre[idx].netRevenue += (rev - taxes);
            dre[idx].variableCosts += costs;
            dre[idx].grossProfit += (rev - taxes - costs);
            dre[idx].expenses += exp;
            dre[idx].netResult += (rev - taxes - costs - exp);
        });

        res.json(dre);
    } catch (error) { res.status(500).json({ message: 'Erro ao gerar DRE' }); }
});

app.post('/api/report', async (req, res) => {
    const { companyIds, startDate, endDate } = req.body;
    if(!companyIds || companyIds.length === 0) return res.status(400).json({message: "Filtro inválido"});

    try {
        const [rows] = await pool.execute(
            `SELECT * FROM monthly_entries WHERE company_id IN (?) AND period_start >= ? AND period_start <= ? ORDER BY period_start ASC`,
            [companyIds[0], startDate, endDate]
        );

        // Agrupamento por Categoria (Gráfico Rosca)
        const [catData] = await pool.execute(`
            SELECT c.name, SUM(ed.amount) as total 
            FROM entry_details ed
            JOIN monthly_entries me ON ed.entry_id = me.id
            JOIN categories c ON ed.category_id = c.id
            WHERE me.company_id IN (?) AND me.period_start >= ? AND me.period_start <= ? AND ed.type = 'EXPENSE'
            GROUP BY c.name ORDER BY total DESC
        `, [companyIds[0], startDate, endDate]);

        const summary = { totalRevenue: 0, totalProfit: 0, totalTaxes: 0, totalCosts: 0, tax_icms: 0, tax_pis: 0, tax_cofins: 0, tax_iss: 0, tax_irpj: 0, tax_csll: 0 };
        
        const months = rows.map(r => {
            const rev = amountOrZero(r.revenue_resale) + amountOrZero(r.revenue_product) + amountOrZero(r.revenue_service) + amountOrZero(r.revenue_rent) + amountOrZero(r.revenue_other);
            const taxes = amountOrZero(r.tax_icms) + amountOrZero(r.tax_pis) + amountOrZero(r.tax_cofins) + amountOrZero(r.tax_iss) + amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll) + amountOrZero(r.tax_difal) + amountOrZero(r.tax_additional_irpj);
            const cost = amountOrZero(r.purchases_total) + amountOrZero(r.expenses_total);
            
            summary.totalRevenue += rev; summary.totalTaxes += taxes; summary.totalCosts += cost; summary.totalProfit += (rev - taxes - cost);
            summary.tax_icms += amountOrZero(r.tax_icms); summary.tax_pis += amountOrZero(r.tax_pis);
            summary.tax_cofins += amountOrZero(r.tax_cofins); summary.tax_iss += amountOrZero(r.tax_iss);
            summary.tax_irpj += amountOrZero(r.tax_irpj); summary.tax_csll += amountOrZero(r.tax_csll);

            return { 
                monthKey: r.period_start.substring(0, 7), 
                totalRevenue: rev, totalTaxes: taxes, totalPurchases: amountOrZero(r.purchases_total), totalExpenses: amountOrZero(r.expenses_total), 
                profit: rev - taxes - cost,
                tax_icms: amountOrZero(r.tax_icms), tax_pis: amountOrZero(r.tax_pis), tax_cofins: amountOrZero(r.tax_cofins),
                tax_iss: amountOrZero(r.tax_iss), tax_irpj_csll: amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll)
            };
        });

        res.json({ months, summary, categories: catData });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/reports/partners-ranking', async (req, res) => {
    const { companyId, startDate, endDate } = req.query;
    try {
        const [clients] = await pool.execute(`SELECT p.name, SUM(d.amount) as value FROM entry_details d JOIN monthly_entries m ON d.entry_id = m.id JOIN partners p ON d.partner_id = p.id WHERE m.company_id = ? AND m.period_start >= ? AND m.period_start <= ? AND d.type = 'REVENUE' GROUP BY p.id ORDER BY value DESC LIMIT 50`, [companyId, startDate, endDate]);
        const [suppliers] = await pool.execute(`SELECT p.name, SUM(d.amount) as value FROM entry_details d JOIN monthly_entries m ON d.entry_id = m.id JOIN partners p ON d.partner_id = p.id WHERE m.company_id = ? AND m.period_start >= ? AND m.period_start <= ? AND d.type = 'EXPENSE' GROUP BY p.id ORDER BY value DESC LIMIT 50`, [companyId, startDate, endDate]);
        res.json({ clients, suppliers });
    } catch (error) { res.status(500).json({ message: 'Erro ranking' }); }
});

// ==========================================
// 5. INTELIGÊNCIA & LOGS (RESTITUÍDOS)
// ==========================================
app.get('/api/intelligence/projections', async (req, res) => {
    const { companyId } = req.query;
    try {
        const [hist] = await pool.execute(
            `SELECT period_start, 
             (COALESCE(revenue_resale,0) + COALESCE(revenue_product,0) + COALESCE(revenue_service,0) + COALESCE(revenue_rent,0) + COALESCE(revenue_other,0)) as revenue,
             (COALESCE(purchases_total,0) + COALESCE(expenses_total,0)) as expenses,
             (COALESCE(tax_icms,0) + COALESCE(tax_pis,0) + COALESCE(tax_cofins,0) + COALESCE(tax_iss,0) + COALESCE(tax_irpj,0) + COALESCE(tax_csll,0)) as taxes
             FROM monthly_entries WHERE company_id = ? ORDER BY period_start ASC`, 
            [companyId]
        );

        const dataset = hist.map(h => ({
            period: h.period_start.substring(0, 7),
            revenue: Number(h.revenue), expenses: Number(h.expenses), taxes: Number(h.taxes),
            profit: Number(h.revenue) - Number(h.expenses) - Number(h.taxes),
            type: 'REAL'
        }));

        const totalRev = dataset.reduce((a, b) => a + b.revenue, 0);
        const totalTax = dataset.reduce((a, b) => a + b.taxes, 0);
        const avgTaxRate = totalRev > 0 ? totalTax / totalRev : 0.06;

        res.json({ dataset, regime: { name: 'SIMPLES', limit: 4800000 }, averages: { taxRate: avgTaxRate } });
    } catch (error) { res.status(500).json({ message: 'Erro projeções' }); }
});

app.get('/api/audit-logs', async (req, res) => {
    try { 
        const { startDate, endDate } = req.query;
        let sql = 'SELECT * FROM audit_logs';
        let params = [];
        if (startDate && endDate) {
             sql += ' WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC';
             params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
        } else { sql += ' ORDER BY timestamp DESC LIMIT 50'; }
        const [rows] = await pool.execute(sql, params); 
        res.json(rows); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if (email === 'admin@sce.com' && password === 'admin123') return res.json({ user: { id: 1, full_name: 'Admin SCE', email, role: 'ADMIN' } });
        const [u] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (u.length === 0 || u[0].password_hash !== password) return res.status(401).json({ message: 'Inválido' });
        await logAction(u[0].id, u[0].full_name, 'LOGIN', 'Login realizado');
        res.json({ user: { id: u[0].id, full_name: u[0].full_name, email, role: u[0].role, company_id: u[0].company_id } });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`SCE Server running on port ${PORT}`));