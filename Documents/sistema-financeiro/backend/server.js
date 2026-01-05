require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios');
const https = require('https');

// IMPORTAÇÃO DOS SERVIÇOS DE INTEGRAÇÃO
const { 
    generateQuestorLayout, 
    generateNFSeXML, 
    buildPayload, 
    fetchTaxDebts 
} = require('./services/questorService');

const app = express();
const PORT = 4000;

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
  connectionLimit: 20
});

// FUNÇÃO SEGURA PARA EVITAR NaN
const amountOrZero = (valor) => {
    const num = Number(valor);
    return isNaN(num) ? 0 : num;
};

const logAction = async (userId, userName, action, details) => { 
  try { 
    await pool.execute(
        'INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?, ?, ?, ?)', 
        [userId || 0, userName || 'Sistema', action, details]
    ); 
  } catch(error){ console.error("Erro log:", error.message); } 
};

// =================================================================================
// ROTAS GERAIS E CRUD (MANTIDAS)
// =================================================================================

app.get('/api/utils/cnpj/:cnpj', async (request, response) => {
    const cnpj = request.params.cnpj.replace(/\D/g, ''); 
    try {
        const resBrasil = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 5000, httpsAgent });
        return response.json({ taxId: cnpj, name: resBrasil.data.razao_social, tradeName: resBrasil.data.nome_fantasia || resBrasil.data.razao_social, taxRegime: resBrasil.data.opcao_pelo_simples ? 'SIMPLES' : 'LUCRO_PRESUMIDO' });
    } catch (err) {
        try {
            const resReceita = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, { timeout: 8000, httpsAgent });
            return response.json({ taxId: cnpj, name: resReceita.data.nome, tradeName: resReceita.data.fantasia || resReceita.data.nome, taxRegime: 'LUCRO_PRESUMIDO' });
        } catch (err2) { return response.status(500).json({ message: 'Erro CNPJ' }); }
    }
});

app.get('/api/groups', async (request, response) => {
    try { const [rows] = await pool.execute('SELECT * FROM company_groups ORDER BY name ASC'); response.json(rows); } 
    catch (error) { response.status(500).json({ message: error.message }); }
});

app.post('/api/groups', async (request, response) => {
    const { name, description } = request.body;
    try { const [result] = await pool.execute('INSERT INTO company_groups (name, description) VALUES (?, ?)', [name, description]); response.json({ id: result.insertId, success: true }); } 
    catch (error) { response.status(500).json({ message: error.message }); }
});

app.delete('/api/groups/:id', async (request, response) => {
    try {
        await pool.execute('UPDATE companies SET group_id = NULL WHERE group_id = ?', [request.params.id]);
        await pool.execute('DELETE FROM company_groups WHERE id = ?', [request.params.id]);
        response.json({ success: true });
    } catch (error) { response.status(500).json({ message: error.message }); }
});

app.get('/api/companies', async (request, response) => {
    try { const [rows] = await pool.execute(`SELECT c.*, g.name as group_name FROM companies c LEFT JOIN company_groups g ON c.group_id = g.id ORDER BY c.name ASC`); response.json(rows); } 
    catch (error) { response.status(500).json({ message: error.message }); }
});

app.post('/api/companies', async (request, response) => {
    const { name, trade_name, tax_id, tax_regime, group_id, userName, userId } = request.body;
    try {
        const [result] = await pool.execute('INSERT INTO companies (name, trade_name, tax_id, tax_regime, group_id) VALUES (?, ?, ?, ?, ?)', [name, trade_name, tax_id, tax_regime, group_id || null]);
        await logAction(userId || 0, userName || 'Admin', 'CREATE_COMPANY', `Cadastrou: ${trade_name || name}`);
        response.json({ id: result.insertId, success: true });
    } catch (error) { response.status(500).json({ message: error.message }); }
});

app.put('/api/companies/:id', async (request, response) => {
    const { name, trade_name, tax_id, tax_regime, group_id } = request.body;
    try { await pool.execute('UPDATE companies SET name = ?, trade_name = ?, tax_id = ?, tax_regime = ?, group_id = ? WHERE id = ?', [name, trade_name, tax_id, tax_regime, group_id || null, request.params.id]); response.json({ success: true }); } 
    catch (error) { response.status(500).json({ message: error.message }); }
});

app.delete('/api/companies/:id', async (request, response) => {
    try {
        await pool.execute('DELETE FROM entry_details WHERE entry_id IN (SELECT id FROM monthly_entries WHERE company_id = ?)', [request.params.id]);
        await pool.execute('DELETE FROM monthly_entries WHERE company_id = ?', [request.params.id]);
        await pool.execute('DELETE FROM partners WHERE company_id = ?', [request.params.id]);
        await pool.execute('DELETE FROM budget_goals WHERE company_id = ?', [request.params.id]);
        await pool.execute('DELETE FROM companies WHERE id = ?', [request.params.id]);
        response.json({ success: true });
    } catch (error) { response.status(500).json({ message: error.message }); }
});

app.get('/api/partners/:companyId', async (request, response) => {
    try { const [rows] = await pool.execute('SELECT * FROM partners WHERE company_id = ? ORDER BY name ASC', [request.params.companyId]); response.json(rows); } 
    catch (error) { response.status(500).json({ error: error.message }); }
});

app.post('/api/partners', async (request, response) => {
    const { company_id, name, tax_id, type, phone, email } = request.body;
    try { await pool.execute('INSERT INTO partners (company_id, name, tax_id, type, phone, email) VALUES (?, ?, ?, ?, ?, ?)', [company_id, name, tax_id, type, phone, email]); response.json({ success: true }); } 
    catch (error) { response.status(500).json({ error: error.message }); }
});

app.get('/api/categories', async (request, response) => {
    try { const [rows] = await pool.execute('SELECT * FROM categories ORDER BY type, name'); response.json(rows); } 
    catch (error) { response.status(500).json({ message: error.message }); }
});

// =================================================================================
// LANÇAMENTOS E RELATÓRIOS
// =================================================================================

app.get('/api/entries', async (request, response) => {
    const { companyId, month } = request.query;
    try {
        let sql = `SELECT * FROM monthly_entries WHERE company_id = ?`;
        let params = [companyId];
        if (month) { sql += ` AND period_start = ?`; params.push(month); }
        const [rows] = await pool.execute(sql, params);
        if (month && rows.length > 0) {
            const [details] = await pool.execute('SELECT * FROM entry_details WHERE entry_id = ?', [rows[0].id]);
            return response.json({ ...rows[0], details });
        }
        response.json(month ? null : rows);
    } catch (error) { response.status(500).json({ message: error.message }); }
});

app.post('/api/entries', async (request, response) => {
    const { userName, userId, ...data } = request.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [existing] = await connection.execute('SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?', [data.companyId, data.periodStart]);
        let entryId;
        const fields = {
            revenue_resale: amountOrZero(data.revenue.resale), revenue_product: amountOrZero(data.revenue.product),
            revenue_service: amountOrZero(data.revenue.service), revenue_rent: amountOrZero(data.revenue.rent),
            revenue_other: amountOrZero(data.revenue.other), tax_icms: amountOrZero(data.taxes.icms),
            tax_difal: amountOrZero(data.taxes.difal), tax_iss: amountOrZero(data.taxes.iss),
            tax_pis: amountOrZero(data.taxes.pis), tax_cofins: amountOrZero(data.taxes.cofins),
            tax_csll: amountOrZero(data.taxes.csll), tax_irpj: amountOrZero(data.taxes.irpj),
            tax_additional_irpj: amountOrZero(data.taxes.additionalIrpj), tax_fust: amountOrZero(data.taxes.fust),
            tax_funtell: amountOrZero(data.taxes.funtell), purchases_total: amountOrZero(data.purchasesTotal),
            expenses_total: amountOrZero(data.expensesTotal), notes: data.notes || ''
        };
        if (existing.length > 0) {
            entryId = existing[0].id;
            const updateSql = Object.keys(fields).map(key => `${key} = ?`).join(', ');
            await connection.execute(`UPDATE monthly_entries SET ${updateSql} WHERE id = ?`, [...Object.values(fields), entryId]);
        } else {
            const columns = ['company_id', 'period_start', 'period_end', ...Object.keys(fields)];
            const values = [data.companyId, data.periodStart, data.periodStart, ...Object.values(fields)];
            const [resInsert] = await connection.execute(`INSERT INTO monthly_entries (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
            entryId = resInsert.insertId;
        }
        await connection.execute('DELETE FROM entry_details WHERE entry_id = ?', [entryId]);
        if (data.details?.length > 0) {
            for (const item of data.details) {
                await connection.execute('INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description) VALUES (?, ?, ?, ?, ?, ?)', [entryId, item.partner_id || null, item.category_id || null, item.type, item.amount, item.description || null]);
            }
        }
        await connection.commit();
        await logAction(userId || 0, userName || 'Admin', 'UPSERT_ENTRY', `Consolidou: ${data.periodStart}`);
        response.json({ success: true, id: entryId });
    } catch (error) { await connection.rollback(); response.status(500).json({ message: error.message }); } finally { connection.release(); }
});

app.get('/api/entries/history', async (request, response) => {
    const { companyId } = request.query;
    try {
        const [rows] = await pool.execute(`SELECT id, period_start, (COALESCE(revenue_resale,0) + COALESCE(revenue_product,0) + COALESCE(revenue_service,0) + COALESCE(revenue_other,0)) as total_revenue, (COALESCE(tax_icms,0) + COALESCE(tax_pis,0) + COALESCE(tax_cofins,0) + COALESCE(tax_iss,0) + COALESCE(tax_irpj,0) + COALESCE(tax_csll,0)) as total_taxes, (COALESCE(purchases_total,0) + COALESCE(expenses_total,0)) as total_costs FROM monthly_entries WHERE company_id = ? ORDER BY period_start DESC`, [companyId]);
        response.json(rows);
    } catch (error) { response.status(500).json({ message: error.message }); }
});

app.post('/api/report', async (request, response) => {
    const { companyIds, groupId, startDate, endDate } = request.body;
    try {
        let targetIds = companyIds || [];
        if (groupId) {
            const [groupCompanies] = await pool.execute('SELECT id FROM companies WHERE group_id = ?', [groupId]);
            targetIds = groupCompanies.map(c => c.id);
        }
        if (targetIds.length === 0) return response.json({ months: [], summary: {}, categories: [] });

        const [rows] = await pool.execute(`SELECT period_start, SUM(revenue_resale) as revenue_resale, SUM(revenue_product) as revenue_product, SUM(revenue_service) as revenue_service, SUM(revenue_rent) as revenue_rent, SUM(revenue_other) as revenue_other, SUM(tax_icms) as tax_icms, SUM(tax_pis) as tax_pis, SUM(tax_cofins) as tax_cofins, SUM(tax_iss) as tax_iss, SUM(tax_irpj) as tax_irpj, SUM(tax_csll) as tax_csll, SUM(purchases_total) as purchases_total, SUM(expenses_total) as expenses_total FROM monthly_entries WHERE company_id IN (${targetIds.join(',')}) AND period_start >= ? AND period_start <= ? GROUP BY period_start ORDER BY period_start ASC`, [startDate, endDate]);
        const [catData] = await pool.execute(`SELECT c.name, SUM(ed.amount) as total FROM entry_details ed JOIN monthly_entries me ON ed.entry_id = me.id JOIN categories c ON ed.category_id = c.id WHERE me.company_id IN (${targetIds.join(',')}) AND me.period_start >= ? AND me.period_start <= ? AND ed.type = 'EXPENSE' GROUP BY c.name ORDER BY total DESC`, [startDate, endDate]);

        const summary = { totalRevenue: 0, totalProfit: 0, totalTaxes: 0, totalCosts: 0, tax_icms: 0, tax_pis: 0, tax_cofins: 0, tax_iss: 0, tax_irpj: 0, tax_csll: 0 };
        const months = rows.map(r => {
            const rev = amountOrZero(r.revenue_resale) + amountOrZero(r.revenue_product) + amountOrZero(r.revenue_service) + amountOrZero(r.revenue_rent) + amountOrZero(r.revenue_other);
            const taxes = amountOrZero(r.tax_icms) + amountOrZero(r.tax_pis) + amountOrZero(r.tax_cofins) + amountOrZero(r.tax_iss) + amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll);
            const cost = amountOrZero(r.purchases_total) + amountOrZero(r.expenses_total);
            
            summary.totalRevenue += rev; summary.totalTaxes += taxes; summary.totalCosts += cost; summary.totalProfit += (rev - taxes - cost);
            summary.tax_icms += amountOrZero(r.tax_icms); summary.tax_pis += amountOrZero(r.tax_pis);
            summary.tax_cofins += amountOrZero(r.tax_cofins); summary.tax_iss += amountOrZero(r.tax_iss);
            summary.tax_irpj += amountOrZero(r.tax_irpj); summary.tax_csll += amountOrZero(r.tax_csll);

            return { monthKey: r.period_start.substring(0, 7), totalRevenue: rev, totalTaxes: taxes, totalPurchases: amountOrZero(r.purchases_total), totalExpenses: amountOrZero(r.expenses_total), profit: rev - taxes - cost, tax_icms: amountOrZero(r.tax_icms), tax_pis: amountOrZero(r.tax_pis), tax_cofins: amountOrZero(r.tax_cofins), tax_iss: amountOrZero(r.tax_iss), tax_irpj_csll: amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll) };
        });
        response.json({ months, summary, categories: catData });
    } catch (error) { response.status(500).json({ message: error.message }); }
});

app.get('/api/reports/partners-ranking', async (request, response) => {
    const { companyId, startDate, endDate } = request.query;
    try {
        const [clients] = await pool.execute(`SELECT p.name, SUM(d.amount) as value FROM entry_details d JOIN monthly_entries m ON d.entry_id = m.id JOIN partners p ON d.partner_id = p.id WHERE m.company_id = ? AND m.period_start >= ? AND m.period_start <= ? AND d.type = 'REVENUE' GROUP BY p.id ORDER BY value DESC LIMIT 20`, [companyId, startDate, endDate]);
        const [suppliers] = await pool.execute(`SELECT p.name, SUM(d.amount) as value FROM entry_details d JOIN monthly_entries m ON d.entry_id = m.id JOIN partners p ON d.partner_id = p.id WHERE m.company_id = ? AND m.period_start >= ? AND m.period_start <= ? AND d.type = 'EXPENSE' GROUP BY p.id ORDER BY value DESC LIMIT 20`, [companyId, startDate, endDate]);
        response.json({ clients, suppliers });
    } catch (error) { response.status(500).json({ message: error.message }); }
});

app.get('/api/intelligence/:companyId/:year', async (request, response) => {
    const { companyId, year } = request.params;
    try {
        const [realized] = await pool.execute(`SELECT MONTH(period_start) as month, SUM(revenue_resale + revenue_product + revenue_service + revenue_other) as revenue, SUM(tax_icms + tax_iss + tax_pis + tax_cofins + tax_irpj + tax_csll) as taxes, SUM(purchases_total + expenses_total) as costs FROM monthly_entries WHERE company_id = ? AND YEAR(period_start) = ? GROUP BY MONTH(period_start) ORDER BY month ASC`, [companyId, year]);
        const [planned] = await pool.execute(`SELECT SUM(planned_amount) as goal FROM budget_goals WHERE company_id = ? AND year = ?`, [companyId, year]);
        const avgRev = realized.length > 0 ? (realized.reduce((acc, curr) => acc + Number(curr.revenue), 0) / realized.length) : 0;
        response.json({ realized, planned: planned[0]?.goal || 0, forecast: avgRev * 1.05 });
    } catch (error) { response.status(500).json({ error: error.message }); }
});

app.post('/api/intelligence/goals', async (request, response) => {
    const { companyId, year, plannedAmount } = request.body;
    try { await pool.execute('INSERT INTO budget_goals (company_id, year, planned_amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE planned_amount = ?', [companyId, year, plannedAmount, plannedAmount]); response.json({ success: true }); } 
    catch (error) { response.status(500).json({ error: error.message }); }
});

app.delete('/api/intelligence/goals', async (request, response) => {
    const { companyId, year } = request.query;
    try { await pool.execute('DELETE FROM budget_goals WHERE company_id = ? AND year = ?', [companyId, year]); response.json({ success: true }); } 
    catch (error) { response.status(500).json({ error: error.message }); }
});

app.get('/api/intelligence/projections', async (request, response) => {
    const { companyId } = request.query;
    try {
        const [hist] = await pool.execute(`SELECT period_start, (COALESCE(revenue_resale,0) + COALESCE(revenue_product,0) + COALESCE(revenue_service,0) + COALESCE(revenue_other,0)) as revenue, (COALESCE(purchases_total,0) + COALESCE(expenses_total,0)) as expenses, (COALESCE(tax_icms,0) + COALESCE(tax_pis,0) + COALESCE(tax_cofins,0) + COALESCE(tax_iss,0) + COALESCE(tax_irpj,0) + COALESCE(tax_csll,0)) as taxes FROM monthly_entries WHERE company_id = ? ORDER BY period_start ASC`, [companyId]);
        const dataset = hist.map(h => ({ period: h.period_start.substring(0, 7), revenue: Number(h.revenue), expenses: Number(h.expenses), taxes: Number(h.taxes), profit: Number(h.revenue) - Number(h.expenses) - Number(h.taxes) }));
        response.json({ dataset });
    } catch (error) { response.status(500).json({ message: error.message }); }
});

// =================================================================================
// 5. DRE GERENCIAL (12 MESES - DATA FIX - MODO BLINDADO)
// =================================================================================

app.get('/api/reports/dre', async (request, response) => {
    const { companyId, year } = request.query;
    try {
        const [rows] = await pool.execute(`SELECT * FROM monthly_entries WHERE company_id = ? AND YEAR(period_start) = ? ORDER BY period_start ASC`, [companyId, year]);
        const dre = Array(12).fill(null).map((_, i) => ({ month: i + 1, grossRevenue: 0, deductions: 0, netRevenue: 0, variableCosts: 0, grossProfit: 0, expenses: 0, netResult: 0 }));
        
        rows.forEach(r => {
            // CORREÇÃO CRÍTICA DE DATA: Pega o mês direto da string (YYYY-MM-DD)
            // substring(5, 7) pega o 'MM' (ex: 2024-09-01 -> '09')
            // Subtrai 1 para virar índice do array (0-11)
            const monthStr = r.period_start.substring(5, 7); 
            const idx = parseInt(monthStr) - 1;

            if (idx >= 0 && idx < 12) {
                const rev = amountOrZero(r.revenue_resale) + amountOrZero(r.revenue_product) + amountOrZero(r.revenue_service) + amountOrZero(r.revenue_rent) + amountOrZero(r.revenue_other);
                const tax = amountOrZero(r.tax_icms) + amountOrZero(r.tax_pis) + amountOrZero(r.tax_cofins) + amountOrZero(r.tax_iss) + amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll);
                
                dre[idx].grossRevenue = rev; 
                dre[idx].deductions = tax; 
                dre[idx].netRevenue = rev - tax;
                dre[idx].variableCosts = amountOrZero(r.purchases_total); 
                dre[idx].expenses = amountOrZero(r.expenses_total);
                dre[idx].grossProfit = dre[idx].netRevenue - dre[idx].variableCosts;
                dre[idx].netResult = dre[idx].grossProfit - dre[idx].expenses;
            }
        });
        response.json(dre);
    } catch (error) { response.status(500).json({ message: error.message }); }
});

// =================================================================================
// 4. NOVA ROTA: DRE DETALHADA PARA EXPORTAÇÃO (ANALÍTICA)
// =================================================================================

app.get('/api/reports/dre/detailed', async (request, response) => {
    const { companyId, year } = request.query;
    try {
        if (!companyId || !year) return response.status(400).json({ message: "CompanyId e Year obrigatórios." });
        
        // 1. Totais Sintéticos
        const [rows] = await pool.execute(`SELECT * FROM monthly_entries WHERE company_id = ? AND YEAR(period_start) = ?`, [companyId, year]);
        
        // 2. Detalhes Analíticos (Categorias)
        const [details] = await pool.execute(`
            SELECT ed.amount, ed.type, c.name as category_name
            FROM entry_details ed
            JOIN monthly_entries me ON ed.entry_id = me.id
            JOIN categories c ON ed.category_id = c.id
            WHERE me.company_id = ? AND YEAR(me.period_start) = ?
        `, [companyId, year]);

        // Agrupamento Analítico
        const analyticalExpenses = {};
        const analyticalRevenues = {};

        details.forEach(d => {
            const name = d.category_name || 'Não Classificado';
            const val = amountOrZero(d.amount);
            if (d.type === 'EXPENSE') analyticalExpenses[name] = (analyticalExpenses[name] || 0) + val;
            else analyticalRevenues[name] = (analyticalRevenues[name] || 0) + val;
        });

        // Totais Anuais Sintéticos
        const totals = rows.reduce((acc, r) => {
            acc.grossRevenue += amountOrZero(r.revenue_resale) + amountOrZero(r.revenue_product) + amountOrZero(r.revenue_service) + amountOrZero(r.revenue_rent);
            acc.taxes += amountOrZero(r.tax_icms) + amountOrZero(r.tax_pis) + amountOrZero(r.tax_cofins) + amountOrZero(r.tax_iss) + amountOrZero(r.tax_irpj) + amountOrZero(r.tax_csll);
            acc.costs += amountOrZero(r.purchases_total);
            acc.expenses += amountOrZero(r.expenses_total); 
            acc.otherRevenue += amountOrZero(r.revenue_other);
            return acc;
        }, { grossRevenue: 0, taxes: 0, costs: 0, expenses: 0, otherRevenue: 0 });

        // Montagem da Estrutura Detalhada
        const dre = [];
        
        const totalGross = totals.grossRevenue + totals.otherRevenue;
        dre.push({ type: 'S', code: '1', desc: 'RECEITA OPERACIONAL BRUTA', value: totalGross });
        if (totals.grossRevenue > 0) dre.push({ type: 'A', code: '1.1', desc: 'Faturamento de Serviços/Vendas', value: totals.grossRevenue });
        
        Object.entries(analyticalRevenues).forEach(([name, val], i) => {
            dre.push({ type: 'A', code: `1.2.${i+1}`, desc: name, value: val });
        });

        dre.push({ type: 'S', code: '2', desc: '(-) DEDUÇÕES E IMPOSTOS', value: -totals.taxes });
        
        const netRevenue = totalGross - totals.taxes;
        dre.push({ type: 'S', code: '3', desc: '(=) RECEITA OPERACIONAL LÍQUIDA', value: netRevenue });

        dre.push({ type: 'S', code: '4', desc: '(-) CUSTOS E INSUMOS', value: -totals.costs });

        const grossProfit = netRevenue - totals.costs;
        dre.push({ type: 'S', code: '5', desc: '(=) LUCRO BRUTO', value: grossProfit });

        // Despesas: Tenta usar o detalhado, se não houver, usa o total lançado
        const sumAnalytical = Object.values(analyticalExpenses).reduce((a,b)=>a+b, 0);
        const totalOpExpenses = Math.max(totals.expenses, sumAnalytical); 
        const unclassified = Math.max(0, totalOpExpenses - sumAnalytical);

        dre.push({ type: 'S', code: '6', desc: '(+/-) DESPESAS OPERACIONAIS', value: -totalOpExpenses });
        
        Object.entries(analyticalExpenses).forEach(([name, val], i) => {
            dre.push({ type: 'A', code: `6.${i+1}`, desc: name, value: -val });
        });

        if (unclassified > 0) {
            dre.push({ type: 'A', code: '6.99', desc: 'Outras Despesas Gerais', value: -unclassified });
        }

        const netResult = grossProfit - totalOpExpenses;
        dre.push({ type: 'S', code: '7', desc: '(=) RESULTADO LÍQUIDO DO EXERCÍCIO', value: netResult });

        response.json(dre);

    } catch (error) { 
        response.status(500).json({ message: error.message }); 
    }
});


app.get('/api/audit-logs', async (request, response) => {
    try { const [rows] = await pool.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100"); response.json(rows); } 
    catch (error) { response.status(500).json({ error: error.message }); } 
});

app.post('/api/integration/test-questor', async (request, response) => {
    const { entryId } = request.body; 
    try {
        const [entries] = await pool.execute('SELECT * FROM monthly_entries WHERE id = ?', [entryId]);
        const [details] = await pool.execute('SELECT ed.*, c.questor_account_code FROM entry_details ed JOIN categories c ON ed.category_id = c.id WHERE ed.entry_id = ?', [entryId]);
        const [comp] = await pool.execute('SELECT tax_id FROM companies WHERE id = ?', [entries[0].company_id]);
        response.json({ success: true, preview_txt: generateQuestorLayout(entries[0], details, comp[0]?.tax_id) });
    } catch (error) { response.status(500).json({ error: error.message }); }
});

app.post('/api/auth/login', async (request, response) => {
    const { email, password } = request.body;
    try {
        const [u] = await pool.execute('SELECT * FROM users WHERE email = ? AND password_hash = ?', [email, password]);
        if (u.length === 0) return response.status(401).json({ message: 'Credenciais Inválidas' });
        response.json({ user: u[0] });
    } catch (error) { response.status(500).json({ message: error.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Vector Server On na Porta ${PORT}`));