require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { parseISO, isValid } = require('date-fns');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'financeiro',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// --- FUNÇÕES AUXILIARES ---
const amountOrZero = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const optionalAmount = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const mapCompanyRow = (row) => ({
  id: row.id,
  name: row.name,
  tradeName: row.trade_name,
  taxId: row.tax_id,
  groupId: row.group_id
});

const fetchAllCompanies = async () => {
  const [rows] = await pool.query('SELECT id, name, trade_name, tax_id, group_id FROM companies ORDER BY name ASC');
  return rows.map(mapCompanyRow);
};

// --- ROTAS DA API ---

// 1. Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 2. Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Dados incompletos.' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(400).json({ message: 'Usuário não encontrado.' });

    const user = rows[0];
    if (user.password !== password) return res.status(400).json({ message: 'Senha incorreta.' });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ message: 'Login OK', user: userWithoutPassword, token: 'fake-jwt' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

// 3. Relatório Financeiro Detalhado
app.post('/api/report', async (req, res, next) => {
  try {
    const { companyIds, startDate, endDate } = req.body || {};

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ message: 'Selecione ao menos uma empresa.' });
    }

    const uniqueCompanyIds = [...new Set(companyIds.map((id) => Number(id)).filter(Number.isFinite))];
    const placeholders = uniqueCompanyIds.map(() => '?').join(',');

    const sql = `
      SELECT
        DATE_FORMAT(me.period_start, '%Y-%m') AS monthKey,
        MAX(me.period_start) as fullDate,
        
        -- FATURAMENTO
        SUM(me.revenue_resale) as rev_resale,
        SUM(me.revenue_product) as rev_product,
        SUM(me.revenue_service) as rev_service,
        SUM(me.revenue_rent) as rev_rent,
        SUM(me.revenue_other) as rev_other,
        SUM(me.revenue_resale + me.revenue_product + me.revenue_service + me.revenue_rent + me.revenue_other) AS totalRevenue,

        -- IMPOSTOS DETALHADOS
        SUM(me.tax_icms) as tax_icms,
        SUM(me.tax_difal) as tax_difal,
        SUM(me.tax_iss) as tax_iss,
        SUM(me.tax_fust) as tax_fust,
        SUM(me.tax_funtell) as tax_funtell,
        SUM(me.tax_pis) as tax_pis,
        SUM(me.tax_cofins) as tax_cofins,
        SUM(me.tax_csll) as tax_csll,
        SUM(me.tax_irpj) as tax_irpj,
        SUM(me.tax_additional_irpj) as tax_additional_irpj,
        
        SUM(me.tax_icms + me.tax_difal + me.tax_iss + me.tax_fust + me.tax_funtell +
            me.tax_pis + me.tax_cofins + me.tax_csll + me.tax_irpj + me.tax_additional_irpj) AS totalTaxes,

        -- CUSTOS E DESPESAS
        SUM(IFNULL(me.purchases_total, 0)) AS totalPurchases,
        SUM(IFNULL(me.expenses_total, 0)) AS totalExpenses

      FROM monthly_entries me
      WHERE me.company_id IN (${placeholders})
        AND me.period_start >= ?
        AND me.period_end <= ?
      GROUP BY monthKey
      ORDER BY monthKey ASC;
    `;

    const [rows] = await pool.query(sql, [...uniqueCompanyIds, startDate, endDate]);

    const monthlyData = rows.map((row) => {
      const r = (val) => Number(val) || 0;
      const profit = r(row.totalRevenue) - r(row.totalTaxes) - r(row.totalPurchases) - r(row.totalExpenses);
      
      return { 
        ...row,
        rev_resale: r(row.rev_resale), rev_product: r(row.rev_product), rev_service: r(row.rev_service), 
        rev_rent: r(row.rev_rent), rev_other: r(row.rev_other), totalRevenue: r(row.totalRevenue),
        tax_icms: r(row.tax_icms), tax_difal: r(row.tax_difal), tax_iss: r(row.tax_iss),
        tax_fust: r(row.tax_fust), tax_funtell: r(row.tax_funtell), tax_pis: r(row.tax_pis),
        tax_cofins: r(row.tax_cofins), tax_csll: r(row.tax_csll), tax_irpj: r(row.tax_irpj),
        tax_additional_irpj: r(row.tax_additional_irpj), totalTaxes: r(row.totalTaxes),
        totalPurchases: r(row.totalPurchases), totalExpenses: r(row.totalExpenses),
        profit 
      };
    });

    const initialSummary = {
        rev_resale: 0, rev_product: 0, rev_service: 0, rev_rent: 0, rev_other: 0, totalRevenue: 0,
        tax_icms: 0, tax_difal: 0, tax_iss: 0, tax_fust: 0, tax_funtell: 0, tax_pis: 0, tax_cofins: 0, tax_csll: 0, tax_irpj: 0, tax_additional_irpj: 0, totalTaxes: 0,
        totalPurchases: 0, totalExpenses: 0, totalProfit: 0
    };

    const summary = monthlyData.reduce((acc, row) => {
        Object.keys(initialSummary).forEach(key => {
            acc[key] = (acc[key] || 0) + (row[key] || 0);
        });
        acc.totalProfit = acc.totalRevenue - acc.totalTaxes - acc.totalPurchases - acc.totalExpenses;
        return acc;
    }, initialSummary);

    return res.json({ months: monthlyData, summary });
  } catch (error) {
    next(error);
  }
});

// 4. Salvar Lançamento (Upsert)
app.post('/api/entries', async (req, res, next) => {
  try {
    const { companyId, periodStart, periodEnd, revenue, taxes, purchasesTotal, expensesTotal, notes, userId } = req.body;
    
    const sql = `
      INSERT INTO monthly_entries (
        company_id, period_start, period_end,
        revenue_resale, revenue_product, revenue_service, revenue_rent, revenue_other,
        tax_icms, tax_difal, tax_iss, tax_fust, tax_funtell, tax_pis, tax_cofins, tax_csll, tax_irpj, tax_additional_irpj,
        purchases_total, expenses_total, notes, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        revenue_resale=VALUES(revenue_resale), revenue_product=VALUES(revenue_product), revenue_service=VALUES(revenue_service),
        revenue_rent=VALUES(revenue_rent), revenue_other=VALUES(revenue_other),
        tax_icms=VALUES(tax_icms), tax_difal=VALUES(tax_difal), tax_iss=VALUES(tax_iss),
        tax_fust=VALUES(tax_fust), tax_funtell=VALUES(tax_funtell), tax_pis=VALUES(tax_pis),
        tax_cofins=VALUES(tax_cofins), tax_csll=VALUES(tax_csll), tax_irpj=VALUES(tax_irpj), tax_additional_irpj=VALUES(tax_additional_irpj),
        purchases_total=VALUES(purchases_total), expenses_total=VALUES(expenses_total), notes=VALUES(notes), updated_at=NOW()
    `;

    const r = amountOrZero;
    const params = [
      companyId, periodStart, periodEnd,
      r(revenue.resale), r(revenue.product), r(revenue.service), r(revenue.rent), r(revenue.other),
      r(taxes.icms), r(taxes.difal), r(taxes.iss), r(taxes.fust), r(taxes.funtell), r(taxes.pis), r(taxes.cofins), r(taxes.csll), r(taxes.irpj), r(taxes.additionalIrpj),
      optionalAmount(purchasesTotal), optionalAmount(expensesTotal), notes, userId
    ];

    await pool.execute(sql, params);
    res.status(201).json({ message: 'Salvo.' });
  } catch (error) {
    next(error);
  }
});

// 5. Buscar Lançamento (GET)
app.get('/api/entries', async (req, res, next) => {
  try {
    const { companyId, month } = req.query;
    const [rows] = await pool.query('SELECT * FROM monthly_entries WHERE company_id = ? AND period_start = ?', [companyId, month]);
    res.json(rows[0] || null);
  } catch (error) {
    next(error);
  }
});

// 6. Listar Empresas
app.get('/api/companies', async (req, res, next) => {
  try {
    const companies = await fetchAllCompanies();
    res.json(companies);
  } catch (error) {
    next(error);
  }
});

// 7. Criar Empresa
app.post('/api/companies', async (req, res, next) => {
  try {
    const { name, tradeName, taxId } = req.body;
    const [result] = await pool.execute('INSERT INTO companies (name, trade_name, tax_id) VALUES (?, ?, ?)', [name, tradeName, taxId]);
    const [rows] = await pool.query('SELECT * FROM companies WHERE id = ?', [result.insertId]);
    res.status(201).json(mapCompanyRow(rows[0]));
  } catch (error) {
    next(error);
  }
});

// 8. Editar Empresa
app.put('/api/companies/:id', async (req, res, next) => {
  try {
    const { name, tradeName, taxId } = req.body;
    await pool.execute('UPDATE companies SET name=?, trade_name=?, tax_id=? WHERE id=?', [name, tradeName, taxId, req.params.id]);
    res.json({ message: 'Atualizado.' });
  } catch (error) {
    next(error);
  }
});

// 9. Excluir Empresa
app.delete('/api/companies/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM monthly_entries WHERE company_id = ?', [id]);
    await pool.execute('UPDATE users SET company_id = NULL WHERE company_id = ?', [id]);
    const [result] = await pool.execute('DELETE FROM companies WHERE id = ?', [id]);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Empresa não encontrada.' });
    res.json({ message: 'Empresa excluída.' });
  } catch (error) {
    next(error);
  }
});

// Middleware de Erro
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erro interno.' });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));