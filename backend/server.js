require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios');
const https = require('https');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');

// IMPORTAÇÃO DOS SERVIÇOS
// Se não tiver o arquivo questorService.js, comente a linha abaixo
const { 
    generateQuestorLayout, 
    generateNFSeXML
} = require('./services/questorService');

const PricingService = require('./services/PricingService');

const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'vector_secret_key_secure_2026';

// CONFIGURAÇÃO DE MIDDLEWARES
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// AGENTE HTTPS
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// CONFIGURAÇÃO DE UPLOAD (MULTER)
const upload = multer({ storage: multer.memoryStorage() });

// POOL DE CONEXÃO AO BANCO DE DADOS
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

// =================================================================================
// FUNÇÕES UTILITÁRIAS
// =================================================================================

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
        console.log(`LOG [${action}]: ${details}`);
    } catch(error){ 
        console.error("Erro ao salvar log de auditoria:", error.message); 
    } 
};

// =================================================================================
// MIDDLEWARE DE AUTENTICAÇÃO (JWT)
// =================================================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido ou expirado' });
        }
        req.user = user;
        next();
    });
};

// =================================================================================
// INICIALIZAÇÃO E MIGRAÇÃO DO BANCO DE DADOS
// =================================================================================

const addColumnIfNotExists = async (conn, table, columnDef) => {
    try {
        await conn.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
        console.log(`✅ Coluna adicionada: ${columnDef.split(' ')[0]} em ${table}`);
    } catch (error) {
        // Ignora erro 1060 (Duplicate column name)
        if (error.errno !== 1060) {
            console.error(`Erro ao adicionar coluna ${columnDef}:`, error.message);
        }
    }
};

const initDb = async () => {
    try {
        const conn = await pool.getConnection();
        
        // 1. Logs de Auditoria
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                user_name VARCHAR(100),
                action VARCHAR(50),
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Usuários
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(255),
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                role ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CLIENT') DEFAULT 'CLIENT',
                company_id INT,
                max_companies INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Empresas
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS companies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                trade_name VARCHAR(150),
                tax_id VARCHAR(30),
                tax_regime VARCHAR(50),
                group_id INT,
                owner_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Despesas Fixas
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS fixed_expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED NOT NULL,
                name VARCHAR(150) NOT NULL,
                amount DECIMAL(15,2) DEFAULT 0.00,
                category VARCHAR(50) DEFAULT 'GERAL',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // 5. Folha de Pagamento
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS payroll_expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED NOT NULL,
                employee_name VARCHAR(150) NOT NULL,
                role VARCHAR(100),
                total_cost DECIMAL(15,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // 6. Pro-labore
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS prolabore_expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED NOT NULL,
                partner_name VARCHAR(150) NOT NULL,
                total_cost DECIMAL(15,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // 7. Canais de Venda (Sales Channels)
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS sales_channels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED NOT NULL,
                name VARCHAR(150),
                icms_out_percent DECIMAL(5,2) DEFAULT 0,
                pis_out_percent DECIMAL(5,2) DEFAULT 0,
                cofins_out_percent DECIMAL(5,2) DEFAULT 0,
                commission_percent DECIMAL(5,2) DEFAULT 0,
                marketing_percent DECIMAL(5,2) DEFAULT 0,
                profit_margin_percent DECIMAL(5,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // 8. Materiais
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS materials (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED,
                name VARCHAR(150),
                ncm VARCHAR(20),
                price_national DECIMAL(15,2),
                price_imported DECIMAL(15,2),
                ipi_percent DECIMAL(5,2),
                is_national BOOLEAN,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // 9. Produtos
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED,
                name VARCHAR(150),
                sku VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // 10. BOM (Ficha Técnica)
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS product_boms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT,
                material_id INT,
                quantity DECIMAL(10,4),
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
            )
        `);

        // 11. Lançamentos Mensais
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS monthly_entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED,
                period_start DATE,
                period_end DATE,
                revenue_resale DECIMAL(15,2),
                revenue_product DECIMAL(15,2),
                revenue_service DECIMAL(15,2),
                revenue_rent DECIMAL(15,2),
                revenue_other DECIMAL(15,2),
                tax_icms DECIMAL(15,2),
                tax_difal DECIMAL(15,2),
                tax_iss DECIMAL(15,2),
                tax_pis DECIMAL(15,2),
                tax_cofins DECIMAL(15,2),
                tax_csll DECIMAL(15,2),
                tax_irpj DECIMAL(15,2),
                tax_additional_irpj DECIMAL(15,2),
                tax_fust DECIMAL(15,2),
                tax_funtell DECIMAL(15,2),
                purchases_total DECIMAL(15,2),
                expenses_total DECIMAL(15,2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // 12. Detalhes de Lançamento
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS entry_details (
                id INT AUTO_INCREMENT PRIMARY KEY,
                entry_id INT,
                partner_id INT,
                category_id INT,
                type ENUM('REVENUE','EXPENSE'),
                amount DECIMAL(15,2),
                description VARCHAR(255),
                FOREIGN KEY (entry_id) REFERENCES monthly_entries(id) ON DELETE CASCADE
            )
        `);
        
        // 13. Grupos de Empresas
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS company_groups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150),
                description TEXT
            )
        `);

        // 14. Parceiros (Clientes/Fornecedores)
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS partners (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED,
                name VARCHAR(150),
                tax_id VARCHAR(30),
                type ENUM('CLIENT','SUPPLIER','BOTH'),
                phone VARCHAR(50),
                email VARCHAR(150),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // 15. Categorias Financeiras
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150),
                type ENUM('REVENUE','EXPENSE'),
                questor_account_code VARCHAR(50)
            )
        `);

        // 16. Metas Orçamentárias
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS budget_goals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id BIGINT UNSIGNED,
                year INT,
                planned_amount DECIMAL(15,2),
                UNIQUE KEY unique_goal (company_id, year),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
        `);

        // --- MIGRAÇÃO DE COLUNAS NOVAS ---
        await addColumnIfNotExists(conn, 'sales_channels', 'ipi_out_percent DECIMAL(5,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'difal_out_percent DECIMAL(5,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'ir_csll_percent DECIMAL(5,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'default_rate_percent DECIMAL(5,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'freight_percent DECIMAL(5,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'freight_value DECIMAL(15,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'financial_cost_percent DECIMAL(5,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'fixed_expenses_rate_percent DECIMAL(5,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'payroll_rate_percent DECIMAL(5,2) DEFAULT 0.00');
        await addColumnIfNotExists(conn, 'sales_channels', 'administrative_cost_percent DECIMAL(5,2) DEFAULT 0.00');
        
        // Garante usuário Super Admin padrão
        await conn.execute(`
            INSERT IGNORE INTO users (id, full_name, email, password_hash, role) 
            VALUES (1, 'Vector Master', 'admin@vector.com', '123456', 'SUPER_ADMIN')
        `);

        console.log("✅ Banco de Dados Inicializado e Estrutura Verificada.");
        conn.release();
    } catch (error) {
        console.error("❌ Erro Crítico na Inicialização do DB:", error);
    }
};

// =================================================================================
// ROTA DE AUTENTICAÇÃO (PÚBLICA)
// =================================================================================

app.post('/api/auth/login', async (request, response) => {
    const { email, password } = request.body;
    try {
        const [u] = await pool.execute(
            'SELECT * FROM users WHERE email = ? AND password_hash = ?', 
            [email, password]
        );
        
        if (u.length === 0) {
            return response.status(401).json({ message: 'Credenciais Inválidas' });
        }
        
        const user = u[0];
        
        // Gera o Token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, company_id: user.company_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Loga a ação de login
        await logAction(user.id, user.full_name, 'LOGIN', 'Realizou login no sistema.');

        response.json({ user, token });
    } catch (error) { 
        response.status(500).json({ message: error.message }); 
    }
});

// =================================================================================
// MIDDLEWARE DE PROTEÇÃO (Tudo abaixo exige Token)
// =================================================================================
app.use(authenticateToken);

// =================================================================================
// ROTAS ADMINISTRAÇÃO (SUPER ADMIN - GOD MODE)
// =================================================================================

// Listar Usuários
app.get('/api/admin/users', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Sem permissão.' });
    }
    try {
        const query = `
            SELECT u.id, u.full_name, u.email, u.role, u.max_companies, u.created_at,
            (SELECT COUNT(*) FROM companies c WHERE c.owner_id = u.id) as companies_used
            FROM users u
            ORDER BY u.created_at DESC
        `;
        const [rows] = await pool.execute(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar Usuário
app.post('/api/admin/users', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Sem permissão.' });
    }
    const { full_name, email, password, role, max_companies } = req.body;
    try {
        const [exists] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (exists.length > 0) {
            return res.status(400).json({ message: 'E-mail já cadastrado.' });
        }
        
        const [result] = await pool.execute(
            'INSERT INTO users (full_name, email, password_hash, role, max_companies) VALUES (?, ?, ?, ?, ?)',
            [full_name, email, password, role || 'ADMIN', max_companies || 1]
        );
        
        await logAction(req.user.id, 'SuperAdmin', 'CREATE_USER', `Criou usuário: ${email}`);
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar Usuário
app.put('/api/admin/users/:id', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Sem permissão.' });
    const { max_companies, role, password } = req.body;
    try {
        let query = 'UPDATE users SET max_companies = ?, role = ?';
        let params = [max_companies, role];
        if(password) { query += ', password_hash = ?'; params.push(password); }
        query += ' WHERE id = ?';
        params.push(req.params.id);

        await pool.execute(query, params);
        await logAction(req.user.id, 'SuperAdmin', 'UPDATE_USER', `Atualizou usuário ID: ${req.params.id}`);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Deletar Usuário
app.delete('/api/admin/users/:id', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Sem permissão.' });
    }
    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        await logAction(req.user.id, 'SuperAdmin', 'DELETE_USER', `Excluiu usuário ID: ${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Impersonate (Entrar na conta do cliente)
app.post('/api/admin/impersonate', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Sem permissão.' });
    }
    const { targetUserId } = req.body;
    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [targetUserId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }
        
        const targetUser = users[0];
        const token = jwt.sign(
            { id: targetUser.id, email: targetUser.email, role: targetUser.role, company_id: targetUser.company_id },
            JWT_SECRET,
            { expiresIn: '4h' }
        );

        await logAction(req.user.id, req.user.email, 'IMPERSONATE', `Acessou conta de: ${targetUser.email}`);
        res.json({ user: targetUser, token, isImpersonating: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =================================================================================
// ROTAS DE CUSTOS (Fixos, Folha, Pro-labore)
// =================================================================================

// Fixos
app.get('/api/fixed-expenses', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM fixed_expenses WHERE company_id = ? ORDER BY name', [req.query.companyId]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/fixed-expenses', async (req, res) => {
    const { company_id, name, amount } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO fixed_expenses (company_id, name, amount) VALUES (?, ?, ?)',
            [company_id, name, amount]
        );
        res.json({ success: true, id: result.insertId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/fixed-expenses/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM fixed_expenses WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Folha
app.get('/api/payroll', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM payroll_expenses WHERE company_id = ? ORDER BY employee_name', [req.query.companyId]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/payroll', async (req, res) => {
    const { company_id, employee_name, role, total_cost } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO payroll_expenses (company_id, employee_name, role, total_cost) VALUES (?, ?, ?, ?)',
            [company_id, employee_name, role, total_cost]
        );
        res.json({ success: true, id: result.insertId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/payroll/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM payroll_expenses WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Pro-labore
app.get('/api/prolabore', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM prolabore_expenses WHERE company_id = ? ORDER BY partner_name', [req.query.companyId]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/prolabore', async (req, res) => {
    const { company_id, partner_name, total_cost } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO prolabore_expenses (company_id, partner_name, total_cost) VALUES (?, ?, ?)',
            [company_id, partner_name, total_cost]
        );
        res.json({ success: true, id: result.insertId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/prolabore/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM prolabore_expenses WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =================================================================================
// ROTAS DE CANAIS DE VENDA (MARKUP E TRIBUTAÇÃO)
// =================================================================================

// Listar
app.get('/api/sales-channels', async (req, res) => {
    try {
        const { companyId } = req.query;
        // Prioriza a empresa, mas se não tiver canais, pode mostrar os da matriz (ID 1)
        const [rows] = await pool.execute(
            'SELECT * FROM sales_channels WHERE company_id = ? OR company_id = 1 ORDER BY name',
            [companyId || 0]
        );
        
        // Remove duplicatas (prioridade para a empresa atual)
        const unique = []; 
        const names = new Set();
        rows.sort((a,b) => (a.company_id == companyId ? -1 : 1)).forEach(r => { 
            if(!names.has(r.name)){ names.add(r.name); unique.push(r); }
        });
        
        res.json(unique);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Criar
app.post('/api/sales-channels', async (req, res) => {
    const { company_id, name } = req.body;
    try {
        const [resDb] = await pool.execute(
            `INSERT INTO sales_channels (company_id, name) VALUES (?, ?)`, 
            [company_id, name]
        );
        await logAction(req.user.id, req.user.email, 'CREATE_BLOCK', `Criou bloco: ${name}`);
        res.json({success: true, id: resDb.insertId});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Deletar
app.delete('/api/sales-channels/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM sales_channels WHERE id = ?', [req.params.id]);
        await logAction(req.user.id, req.user.email, 'DELETE_BLOCK', `Excluiu bloco ID: ${req.params.id}`);
        res.json({success: true});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Atualizar (PUT) - Mapeando TODOS os campos da planilha
app.put('/api/sales-channels/:id', async (req, res) => {
    const { 
        icms_out_percent, pis_out_percent, cofins_out_percent, 
        ipi_out_percent, difal_out_percent, ir_csll_percent,
        commission_percent, marketing_percent, freight_percent,
        default_rate_percent, financial_cost_percent,
        fixed_expenses_rate_percent, payroll_rate_percent,
        administrative_cost_percent, profit_margin_percent, freight_value 
    } = req.body;

    try {
        await pool.execute(`
            UPDATE sales_channels SET 
            icms_out_percent=?, pis_out_percent=?, cofins_out_percent=?, 
            ipi_out_percent=?, difal_out_percent=?, ir_csll_percent=?,
            commission_percent=?, marketing_percent=?, freight_percent=?,
            default_rate_percent=?, financial_cost_percent=?, 
            fixed_expenses_rate_percent=?, payroll_rate_percent=?, administrative_cost_percent=?,
            profit_margin_percent=?, freight_value=?
            WHERE id=?
        `, [
            icms_out_percent||0, pis_out_percent||0, cofins_out_percent||0, 
            ipi_out_percent||0, difal_out_percent||0, ir_csll_percent||0,
            commission_percent||0, marketing_percent||0, freight_percent||0,
            default_rate_percent||0, financial_cost_percent||0, 
            fixed_expenses_rate_percent||0, payroll_rate_percent||0, administrative_cost_percent||0,
            profit_margin_percent||0, freight_value||0,
            req.params.id
        ]);
        
        res.json({success: true});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// =================================================================================
// ROTAS DE CADASTRO (MATERIAIS E PRODUTOS)
// =================================================================================

app.post('/api/materials', async (req, res) => { 
    try { 
        const [r] = await pool.execute(
            `INSERT INTO materials (company_id, name, ncm, price_national, price_imported, ipi_percent, is_national) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [req.body.company_id, req.body.name, req.body.ncm, req.body.price_national, req.body.price_imported, req.body.ipi_percent, req.body.is_national ? 1 : 0]
        ); 
        res.json({success:true, id:r.insertId}); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.get('/api/materials-full', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT * FROM materials WHERE company_id = ? ORDER BY id DESC LIMIT 100', [req.query.companyId]); 
        res.json(r); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.delete('/api/materials/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM materials WHERE id = ?', [req.params.id]); 
        res.json({success:true}); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/products', async (req, res) => { 
    try { 
        const [r] = await pool.execute('INSERT INTO products (company_id, name, sku) VALUES (?, ?, ?)', [req.body.company_id, req.body.name, req.body.sku]); 
        res.json({success:true, id:r.insertId}); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.delete('/api/products/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id]); 
        res.json({success:true}); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.get('/api/products-list', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT id, name, sku FROM products WHERE company_id = ? ORDER BY name ASC', [req.query.companyId || 0]); 
        res.json(r); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

// =================================================================================
// ROTAS DE PRICING (CÁLCULO)
// =================================================================================

app.get('/api/price-calc', async (req, res) => { 
    try { 
        const r = await PricingService.calculateProductPrice(req.query.productId, req.query.channelId); 
        res.json(r); 
    } catch (e) { res.status(500).json({error: e.message}); } 
});

// =================================================================================
// ROTAS DE ENTIDADES (EMPRESAS, PARCEIROS, GRUPOS)
// =================================================================================

// CNPJ Lookup
app.get('/api/utils/cnpj/:cnpj', async (req, res) => { 
    const cnpj = req.params.cnpj.replace(/\D/g, ''); 
    try { 
        const r = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); 
        res.json({
            taxId: cnpj, 
            name: r.data.razao_social, 
            tradeName: r.data.nome_fantasia || r.data.razao_social, 
            taxRegime: r.data.opcao_pelo_simples?'SIMPLES':'LUCRO_PRESUMIDO'
        }); 
    } catch (e) { res.status(500).json({message: 'Erro CNPJ'}); } 
});

// Grupos
app.get('/api/groups', async (req, res) => { 
    try { const [r] = await pool.execute('SELECT * FROM company_groups ORDER BY name'); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/groups', async (req, res) => { 
    try { const [r] = await pool.execute('INSERT INTO company_groups (name, description) VALUES (?, ?)', [req.body.name, req.body.description]); res.json({id: r.insertId}); } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.delete('/api/groups/:id', async (req, res) => { 
    try { 
        await pool.execute('UPDATE companies SET group_id = NULL WHERE group_id = ?', [req.params.id]); 
        await pool.execute('DELETE FROM company_groups WHERE id = ?', [req.params.id]); 
        res.json({success:true}); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

// Empresas (Com Verificação de Limites SaaS)
app.get('/api/companies', async (req, res) => { 
    try { 
        let query = 'SELECT * FROM companies';
        let params = [];
        
        // Se NÃO for Super Admin, vê apenas as suas empresas
        if (req.user.role !== 'SUPER_ADMIN') {
            query += ' WHERE owner_id = ?';
            params.push(req.user.id);
        }
        
        query += ' ORDER BY name';
        const [r] = await pool.execute(query, params); 
        res.json(r); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/companies', async (req, res) => { 
    const userId = req.user.id;
    const userRole = req.user.role; // Pega a role do token JWT
    
    try { 
        // Lógica de Limite (SaaS)
        // Se for SUPER_ADMIN, ignora a verificação de limite
        if (userRole !== 'SUPER_ADMIN') {
            const [usage] = await pool.execute('SELECT COUNT(*) as count FROM companies WHERE owner_id = ?', [userId]);
            const [userLimit] = await pool.execute('SELECT max_companies FROM users WHERE id = ?', [userId]);
            
            const currentCount = usage[0].count;
            const limit = userLimit[0].max_companies;

            if (currentCount >= limit) {
                return res.status(403).json({ error: `Limite de licenças atingido. Você possui ${currentCount} de ${limit} unidades permitidas.` });
            }
        }

        const [r] = await pool.execute(
            'INSERT INTO companies (name, trade_name, tax_id, tax_regime, group_id, owner_id) VALUES (?, ?, ?, ?, ?, ?)', 
            [req.body.name, req.body.trade_name, req.body.tax_id, req.body.tax_regime, req.body.group_id, userId]
        ); 
        await logAction(req.user.id, req.user.email, 'CREATE_COMPANY', `Criou: ${req.body.name}`); 
        res.json({id: r.insertId}); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

// ATUALIZAR EMPRESA (PUT)
app.put('/api/companies/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const companyId = req.params.id;
        const { name, trade_name, tax_id, tax_regime, group_id } = req.body;

        // 1. Verificação de Segurança (Só o dono ou Super Admin pode editar)
        if (req.user.role !== 'SUPER_ADMIN') {
            const [check] = await conn.execute('SELECT id FROM companies WHERE id = ? AND owner_id = ?', [companyId, req.user.id]);
            if (check.length === 0) {
                return res.status(403).json({ message: 'Sem permissão para editar esta empresa.' });
            }
        }

        // 2. Executa a Atualização
        await conn.execute(
            `UPDATE companies SET 
                name = ?, 
                trade_name = ?, 
                tax_id = ?, 
                tax_regime = ?, 
                group_id = ? 
            WHERE id = ?`,
            [name, trade_name, tax_id, tax_regime, group_id || null, companyId]
        );

        await logAction(req.user.id, req.user.email, 'UPDATE_COMPANY', `Atualizou dados da empresa ID: ${companyId}`);
        res.json({ success: true });

    } catch (e) {
        console.error("Erro ao atualizar empresa:", e);
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

// DELETE COMPANY (FORÇA BRUTA - FK OFF - CORRIGIDO HIERARQUIA)
app.delete('/api/companies/:id', async (req, res) => { 
    const conn = await pool.getConnection();
    try { 
        const companyId = req.params.id;

        // 1. Verificação de Segurança
        if (req.user.role !== 'SUPER_ADMIN') {
            const [check] = await conn.execute('SELECT id FROM companies WHERE id = ? AND owner_id = ?', [companyId, req.user.id]);
            if (check.length === 0) {
                conn.release();
                return res.status(403).json({ message: 'Sem permissão.' });
            }
        }
        
        // 2. Desligar verificação de FK
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        // 3. Limpeza de tabelas "Netas" (que não têm company_id direto)
        // entry_details -> monthly_entries -> companies
        await conn.execute(
            'DELETE FROM entry_details WHERE entry_id IN (SELECT id FROM monthly_entries WHERE company_id = ?)', 
            [companyId]
        );

        // product_boms -> products -> companies
        await conn.execute(
            'DELETE FROM product_boms WHERE product_id IN (SELECT id FROM products WHERE company_id = ?)', 
            [companyId]
        );

        // 4. Limpeza de tabelas "Filhas" diretas
        const directTables = [
            'monthly_entries',
            'fixed_expenses',
            'payroll_expenses',
            'prolabore_expenses',
            'sales_channels',
            'materials',
            'products',
            'partners',
            'budget_goals'
        ];

        for (const t of directTables) {
            await conn.execute(`DELETE FROM ${t} WHERE company_id = ?`, [companyId]);
        }

        // 5. Desvincular usuários
        await conn.execute('UPDATE users SET company_id = NULL WHERE company_id = ?', [companyId]);

        // 6. Deletar a empresa
        await conn.execute('DELETE FROM companies WHERE id = ?', [companyId]);

        // 7. Religar FK
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        
        await logAction(req.user.id, req.user.email, 'DELETE_COMPANY', `Excluiu empresa ID: ${companyId}`); 
        res.json({ success: true }); 

    } catch (e) { 
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.error("ERRO AO DELETAR:", e);
        res.status(500).json({ error: e.message }); 
    } finally { 
        conn.release(); 
    }
});

// Parceiros
app.get('/api/partners/:companyId', async (req, res) => { 
    try { const [r] = await pool.execute('SELECT * FROM partners WHERE company_id = ? ORDER BY name', [req.params.companyId]); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/partners', async (req, res) => { 
    try { await pool.execute('INSERT INTO partners (company_id, name, tax_id, type, phone, email) VALUES (?, ?, ?, ?, ?, ?)', [req.body.company_id, req.body.name, req.body.tax_id, req.body.type, req.body.phone, req.body.email]); res.json({success:true}); } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.delete('/api/partners/:id', async (req, res) => { 
    try { await pool.execute('DELETE FROM partners WHERE id = ?', [req.params.id]); res.json({success:true}); } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.get('/api/categories', async (req, res) => { 
    try { const [r] = await pool.execute('SELECT * FROM categories'); res.json(r); } catch (e) { res.status(500).json(e); } 
});

// =================================================================================
// MÓDULO: LANÇAMENTOS E RELATÓRIOS (DRE / BI)
// =================================================================================

app.get('/api/entries', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT * FROM monthly_entries WHERE company_id = ? AND period_start = ?', [req.query.companyId, req.query.month]); 
        if(r.length){ 
            const [d] = await pool.execute('SELECT * FROM entry_details WHERE entry_id = ?', [r[0].id]); 
            res.json({...r[0], details:d}); 
        } else res.json(null); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.post('/api/entries', async (req, res) => { 
    const { companyId, periodStart, revenue, taxes, purchasesTotal, expensesTotal, notes, details } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [existing] = await conn.execute('SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?', [companyId, periodStart]);
        let entryId;
        const vals = [
            amountOrZero(revenue.resale), amountOrZero(revenue.product), amountOrZero(revenue.service), amountOrZero(revenue.rent), amountOrZero(revenue.other),
            amountOrZero(taxes.icms), amountOrZero(taxes.difal), amountOrZero(taxes.iss), amountOrZero(taxes.pis), amountOrZero(taxes.cofins), amountOrZero(taxes.csll), amountOrZero(taxes.irpj), amountOrZero(taxes.additionalIrpj), amountOrZero(taxes.fust), amountOrZero(taxes.funtell),
            amountOrZero(purchasesTotal), amountOrZero(expensesTotal), notes || ''
        ];
        
        if (existing.length) {
            entryId = existing[0].id;
            await conn.execute(
                'UPDATE monthly_entries SET revenue_resale=?, revenue_product=?, revenue_service=?, revenue_rent=?, revenue_other=?, tax_icms=?, tax_difal=?, tax_iss=?, tax_pis=?, tax_cofins=?, tax_csll=?, tax_irpj=?, tax_additional_irpj=?, tax_fust=?, tax_funtell=?, purchases_total=?, expenses_total=?, notes=? WHERE id=?', 
                [...vals, entryId]
            );
        } else {
            const [r] = await conn.execute(
                'INSERT INTO monthly_entries (revenue_resale, revenue_product, revenue_service, revenue_rent, revenue_other, tax_icms, tax_difal, tax_iss, tax_pis, tax_cofins, tax_csll, tax_irpj, tax_additional_irpj, tax_fust, tax_funtell, purchases_total, expenses_total, notes, company_id, period_start, period_end) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', 
                [...vals, companyId, periodStart, periodStart]
            );
            entryId = r.insertId;
        }
        
        await conn.execute('DELETE FROM entry_details WHERE entry_id = ?', [entryId]);
        if(details) {
            for(let d of details) {
                await conn.execute(
                    'INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description) VALUES (?,?,?,?,?,?)', 
                    [entryId, d.partner_id, d.category_id, d.type, d.amount, d.description]
                );
            }
        }
        
        await conn.commit();
        await logAction(req.user.id, req.user.email, 'UPSERT_ENTRY', `Consolidou mês: ${periodStart}`);
        res.json({success:true, id:entryId});
    } catch (e) { 
        await conn.rollback(); 
        res.status(500).json({ error: e.message }); 
    } finally { conn.release(); }
});

// ROTA DE CLONAGEM DE MÊS
app.post('/api/entries/clone', authenticateToken, async (req, res) => {
    const { companyId, sourceMonth, targetMonth } = req.body;
    const conn = await pool.getConnection();

    try {
        console.log(`[CLONE] Iniciando clonagem de ${sourceMonth} para ${targetMonth} (Empresa: ${companyId})`);

        // 1. Busca os dados do mês de origem
        const [source] = await conn.execute(
            'SELECT * FROM monthly_entries WHERE company_id = ? AND period_start = ?', 
            [companyId, sourceMonth + '-01']
        );

        if (source.length === 0) {
            console.log("[CLONE] Origem não encontrada");
            return res.status(404).json({ error: 'Mês de origem não possui dados lançados.' });
        }
        
        const originEntry = source[0];

        // 2. Verifica se o destino já existe
        const [targetCheck] = await conn.execute(
            'SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?', 
            [companyId, targetMonth + '-01']
        );

        if (targetCheck.length > 0) {
            console.log("[CLONE] Destino já existe");
            return res.status(400).json({ error: 'Mês de destino já possui lançamentos. Exclua o mês de destino antes de clonar.' });
        }

        await conn.beginTransaction();

        // 3. Cria o novo lançamento (cabeçalho)
        const [y, m] = targetMonth.split('-');
        const lastDay = new Date(y, m, 0).getDate();
        const periodEnd = `${y}-${m}-${lastDay}`;

        const [result] = await conn.execute(`
            INSERT INTO monthly_entries (
                company_id, period_start, period_end, 
                revenue_resale, revenue_product, revenue_service, revenue_rent, revenue_other,
                tax_icms, tax_difal, tax_iss, tax_pis, tax_cofins, tax_csll, tax_irpj, tax_additional_irpj, tax_fust, tax_funtell,
                purchases_total, expenses_total, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            companyId, targetMonth + '-01', periodEnd,
            originEntry.revenue_resale, originEntry.revenue_product, originEntry.revenue_service, originEntry.revenue_rent, originEntry.revenue_other,
            originEntry.tax_icms, originEntry.tax_difal, originEntry.tax_iss, originEntry.tax_pis, originEntry.tax_cofins, originEntry.tax_csll, originEntry.tax_irpj, originEntry.tax_additional_irpj, originEntry.tax_fust, originEntry.tax_funtell,
            originEntry.purchases_total, originEntry.expenses_total, `Clonado de ${sourceMonth}`
        ]);

        const newEntryId = result.insertId;

        // 4. Copia os detalhes (entry_details)
        const [details] = await conn.execute('SELECT * FROM entry_details WHERE entry_id = ?', [originEntry.id]);
        
        for (const det of details) {
            await conn.execute(`
                INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [newEntryId, det.partner_id, det.category_id, det.type, det.amount, det.description]);
        }

        await conn.commit();
        await logAction(req.user.id, req.user.email, 'CLONE_MONTH', `Clonou ${sourceMonth} para ${targetMonth}`);
        console.log("[CLONE] Sucesso!");
        
        res.json({ success: true });

    } catch (error) {
        await conn.rollback();
        console.error("[CLONE] Erro:", error);
        res.status(500).json({ error: error.message });
    } finally {
        conn.release();
    }
});

// --- ROTA DE HISTÓRICO CORRIGIDA PARA RETORNAR TUDO ---
app.get('/api/entries/history', async (req, res) => {
    const { companyId } = req.query;
    try {
        const query = `
            SELECT * FROM monthly_entries 
            WHERE company_id = ? 
            ORDER BY period_start DESC
        `;
        const [rows] = await pool.execute(query, [companyId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/entries', async (req, res) => {
    try {
        await pool.execute('DELETE FROM monthly_entries WHERE company_id = ? AND period_start = ?', [req.query.companyId, req.query.month]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/report', async (req, res) => { 
    try { 
        const companyIds = Array.isArray(req.body.companyIds) && req.body.companyIds.length > 0 
            ? req.body.companyIds 
            : [req.body.companyId || 0];

        // 1. Dados Mensais (Gráfico de Evolução)
        const query = `
            SELECT 
                DATE_FORMAT(period_start, '%Y-%m') as month_key,
                SUM(COALESCE(revenue_resale,0) + COALESCE(revenue_product,0) + COALESCE(revenue_service,0) + COALESCE(revenue_rent,0) + COALESCE(revenue_other,0)) as total_revenue,
                SUM(COALESCE(tax_icms,0) + COALESCE(tax_difal,0) + COALESCE(tax_pis,0) + COALESCE(tax_cofins,0) + COALESCE(tax_iss,0) + COALESCE(tax_irpj,0) + COALESCE(tax_additional_irpj,0) + COALESCE(tax_csll,0) + COALESCE(tax_fust,0) + COALESCE(tax_funtell,0)) as total_taxes,
                SUM(COALESCE(tax_icms,0)) as tax_icms,
                SUM(COALESCE(tax_pis,0)) as tax_pis,
                SUM(COALESCE(tax_cofins,0)) as tax_cofins,
                SUM(COALESCE(tax_iss,0)) as tax_iss,
                SUM(COALESCE(tax_irpj,0) + COALESCE(tax_csll,0)) as tax_irpj_csll,
                SUM(COALESCE(purchases_total,0)) as total_purchases,
                SUM(COALESCE(expenses_total,0)) as total_expenses
            FROM monthly_entries 
            WHERE company_id IN (${companyIds.join(',')}) 
            AND period_start >= ? AND period_start <= ? 
            GROUP BY month_key
            ORDER BY month_key ASC
        `;

        const [rows] = await pool.execute(query, [req.body.startDate, req.body.endDate]); 

        const months = rows.map(row => ({ 
            monthKey: row.month_key, 
            totalRevenue: Number(row.total_revenue), 
            totalTaxes: Number(row.total_taxes),
            tax_icms: Number(row.tax_icms),
            tax_pis: Number(row.tax_pis),
            tax_cofins: Number(row.tax_cofins),
            tax_iss: Number(row.tax_iss),
            tax_irpj_csll: Number(row.tax_irpj_csll),
            totalPurchases: Number(row.total_purchases), 
            totalExpenses: Number(row.total_expenses), 
            profit: Number(row.total_revenue) - Number(row.total_taxes) - Number(row.total_purchases) - Number(row.total_expenses)
        }));
        
        const summary = months.reduce((acc, curr) => ({
            totalRevenue: acc.totalRevenue + curr.totalRevenue,
            totalProfit: acc.totalProfit + curr.profit,
            totalTaxes: acc.totalTaxes + curr.totalTaxes,
            totalCosts: acc.totalCosts + curr.totalPurchases + curr.totalExpenses
        }), { totalRevenue: 0, totalProfit: 0, totalTaxes: 0, totalCosts: 0 });

        // 2. Dados Analíticos (Gráfico de Categorias) - AGORA TRAZ TUDO (REVENUE E EXPENSE)
        const [categories] = await pool.execute(
            `SELECT c.name, ed.type, SUM(ed.amount) as total 
             FROM entry_details ed 
             JOIN monthly_entries me ON ed.entry_id = me.id 
             JOIN categories c ON ed.category_id = c.id 
             WHERE me.company_id IN (${companyIds.join(',')}) 
             AND me.period_start >= ? AND me.period_start <= ? 
             GROUP BY c.name, ed.type
             ORDER BY total DESC`, 
            [req.body.startDate, req.body.endDate]
        ); 
        
        res.json({ months, summary, categories }); 

    } catch (e) { 
        console.error("Erro Report:", e);
        res.status(500).json({ error: e.message }); 
    } 
});

// ROTA DE INTELIGÊNCIA COM FORECAST REAL (REGRESSÃO LINEAR)
app.get('/api/intelligence/:companyId/:year', async (req, res) => { 
    try { 
        const { companyId, year } = req.params;

        // 1. Busca os dados realizados agrupados por mês
        const [realized] = await pool.execute(
            `SELECT MONTH(period_start) as month, 
             SUM(revenue_resale + revenue_product + revenue_service + revenue_other) as revenue, 
             SUM(purchases_total + expenses_total) as costs, 
             SUM(tax_icms + tax_iss + tax_pis + tax_cofins + tax_irpj + tax_csll) as taxes 
             FROM monthly_entries 
             WHERE company_id = ? AND YEAR(period_start) = ? 
             GROUP BY MONTH(period_start)
             ORDER BY month ASC`, 
            [companyId, year]
        ); 

        // 2. Busca a Meta
        const [p] = await pool.execute(
            'SELECT planned_amount as goal FROM budget_goals WHERE company_id = ? AND year = ?', 
            [companyId, year]
        ); 

        // 3. Algoritmo de Forecast (Regressão Linear Simples)
        let forecast = 0;
        const n = realized.length;

        if (n >= 2) {
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            
            realized.forEach((row, index) => {
                const x = index + 1; // Mês 1, 2, 3... (sequencial na amostra)
                const y = Number(row.revenue);
                
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumXX += x * x;
            });

            // Fórmulas da Regressão Linear (y = mx + b)
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            
            // Projeta o próximo mês (n + 1)
            forecast = (slope * (n + 1)) + intercept;
        } else if (n === 1) {
            // Se só tiver 1 mês, a previsão é igual ao realizado (média simples)
            forecast = Number(realized[0].revenue);
        }

        // Garante que não dê negativo (se a tendência for de queda brusca)
        forecast = Math.max(0, forecast);

        res.json({
            realized, 
            planned: p[0]?.goal || 0, 
            forecast: forecast 
        }); 

    } catch (e) { 
        console.error("Erro Intelligence:", e);
        res.status(500).json({ error: e.message }); 
    } 
});

// 1. Criar ou Atualizar Meta (POST)
app.post('/api/intelligence/goals', authenticateToken, async (req, res) => { 
    try { 
        const { companyId, year, plannedAmount } = req.body;
        // O comando ON DUPLICATE KEY UPDATE garante que se já existir, ele atualiza
        await pool.execute(
            'INSERT INTO budget_goals (company_id, year, planned_amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE planned_amount = ?', 
            [companyId, year, plannedAmount, plannedAmount]
        ); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

// 2. EXCLUIR META (A QUE ESTAVA FALTANDO - Erro 404)
app.delete('/api/intelligence/goals', authenticateToken, async (req, res) => {
    try {
        const { companyId, year } = req.query; // Recebe via parâmetros da URL
        await pool.execute(
            'DELETE FROM budget_goals WHERE company_id = ? AND year = ?',
            [companyId, year]
        );
        res.json({ success: true, message: 'Meta removida com sucesso.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/intelligence/projections', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT period_start, (revenue_resale+revenue_product+revenue_service+revenue_other) as revenue, (purchases_total+expenses_total) as expenses, (tax_icms+tax_pis+tax_cofins+tax_iss+tax_irpj+tax_csll) as taxes FROM monthly_entries WHERE company_id = ?', [req.query.companyId]); 
        const dataset = r.map(x => ({period: x.period_start.substring(0,7), revenue: Number(x.revenue), expenses: Number(x.expenses), taxes: Number(x.taxes), profit: Number(x.revenue)-Number(x.expenses)-Number(x.taxes)})); 
        res.json({dataset}); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.get('/api/reports/dre', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT * FROM monthly_entries WHERE company_id = ? AND YEAR(period_start) = ?', [req.query.companyId, req.query.year]); 
        const dre=Array(12).fill(null).map((_,i)=>({month:i+1, grossRevenue:0, deductions:0, netRevenue:0, variableCosts:0, grossProfit:0, expenses:0, netResult:0})); 
        r.forEach(x => { 
            const m = parseInt(x.period_start.split('-')[1])-1; 
            const rev=Number(x.revenue_resale)+Number(x.revenue_product)+Number(x.revenue_service)+Number(x.revenue_rent)+Number(x.revenue_other); 
            const tax=Number(x.tax_icms)+Number(x.tax_pis)+Number(x.tax_cofins)+Number(x.tax_iss)+Number(x.tax_irpj)+Number(x.tax_csll); 
            dre[m].grossRevenue=rev; dre[m].deductions=tax; dre[m].netRevenue=rev-tax; dre[m].variableCosts=Number(x.purchases_total); dre[m].expenses=Number(x.expenses_total); dre[m].grossProfit=dre[m].netRevenue-dre[m].variableCosts; dre[m].netResult=dre[m].grossProfit-dre[m].expenses; 
        }); 
        res.json(dre); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

app.get('/api/audit-logs', async (req, res) => { 
    try { const [r] = await pool.execute('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100'); res.json(r); } catch (e) { res.status(500).json(e); } 
});

// =================================================================================
// ROTA: DRE DETALHADA PARA EXPORTAÇÃO (EXCEL)
// =================================================================================
app.get('/api/reports/dre/detailed', authenticateToken, async (req, res) => {
    try {
        const { companyId, year } = req.query;

        // 1. Busca todos os detalhes analíticos do ano agrupados por categoria
        const [details] = await pool.execute(`
            SELECT 
                c.name as category_name,
                ed.type,
                SUM(ed.amount) as total_value
            FROM entry_details ed
            JOIN monthly_entries me ON ed.entry_id = me.id
            JOIN categories c ON ed.category_id = c.id
            WHERE me.company_id = ? AND YEAR(me.period_start) = ?
            GROUP BY c.name, ed.type
            ORDER BY ed.type DESC, total_value DESC
        `, [companyId, year]);

        // 2. Busca os impostos totais do ano (campos fixos da tabela principal)
        const [taxTotals] = await pool.execute(`
            SELECT 
                SUM(tax_icms + tax_difal + tax_iss + tax_pis + tax_cofins + tax_csll + tax_irpj + tax_additional_irpj + tax_fust + tax_funtell) as total_taxes
            FROM monthly_entries
            WHERE company_id = ? AND YEAR(period_start) = ?
        `, [companyId, year]);

        // 3. Formata os dados para o padrão que o Frontend (DRE.jsx) espera
        const reportRows = [];

        // Adicionar Receitas
        reportRows.push({ type: 'S', code: '1', desc: 'RECEITA OPERACIONAL BRUTA', value: 0 });
        let totalRevenue = 0;
        details.filter(d => d.type === 'REVENUE').forEach(d => {
            reportRows.push({ type: 'I', code: '1.1', desc: d.category_name, value: Number(d.total_value) });
            totalRevenue += Number(d.total_value);
        });
        reportRows[0].value = totalRevenue;

        // Adicionar Deduções (Impostos)
        const totalTaxes = Number(taxTotals[0].total_taxes || 0);
        reportRows.push({ type: 'S', code: '2', desc: '(-) DEDUÇÕES E IMPOSTOS', value: totalTaxes * -1 });

        // Receita Líquida
        reportRows.push({ type: 'S', code: '3', desc: '(=) RECEITA LÍQUIDA', value: totalRevenue - totalTaxes });

        // Adicionar Despesas / Custos
        reportRows.push({ type: 'S', code: '4', desc: '(-) CUSTOS E DESPESAS OPERACIONAIS', value: 0 });
        let totalExpenses = 0;
        details.filter(d => d.type === 'EXPENSE').forEach(d => {
            reportRows.push({ type: 'I', code: '4.1', desc: d.category_name, value: Number(d.total_value) * -1 });
            totalExpenses += Number(d.total_value);
        });
        reportRows[3].value = totalExpenses * -1;

        // Resultado Final
        reportRows.push({ type: 'S', code: '5', desc: '(=) RESULTADO LÍQUIDO DO EXERCÍCIO', value: (totalRevenue - totalTaxes - totalExpenses) });

        res.json(reportRows);

    } catch (e) {
        console.error("Erro ao gerar DRE detalhada:", e);
        res.status(500).json({ error: e.message });
    }
});

// =================================================================================
// ROTA DE IMPORTAÇÃO DE DRE (EXCEL)
// =================================================================================
// ROTA DE IMPORTAÇÃO DE DRE (COM GERAÇÃO AUTOMÁTICA DE CATEGORIAS)
app.post('/api/import/dre', authenticateToken, upload.single('file'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        if (!req.file) throw new Error("Nenhum arquivo enviado.");

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        
        // Mapeamento de Meses (Colunas)
        const monthsMap = { 3: '01', 4: '02', 5: '03', 6: '04', 7: '05', 8: '06', 9: '07', 10: '08', 11: '09', 12: '10', 13: '11', 14: '12' };
        const yearMatch = req.file.originalname.match(/20\d{2}/);
        const year = yearMatch ? yearMatch[0] : new Date().getFullYear();

        // 1. Garante que as categorias existem no banco
        const categoriesMap = {};
        const catsToCreate = [
            { name: 'Receita Bruta (Importada)', type: 'REVENUE' },
            { name: 'Impostos e Deduções', type: 'EXPENSE' },
            { name: 'Custos Variáveis', type: 'EXPENSE' },
            { name: 'Despesas Operacionais', type: 'EXPENSE' }
        ];

        for (const cat of catsToCreate) {
            // Tenta achar ou criar
            await conn.execute('INSERT IGNORE INTO categories (name, type) VALUES (?, ?)', [cat.name, cat.type]);
            const [rows] = await conn.execute('SELECT id FROM categories WHERE name = ?', [cat.name]);
            categoriesMap[cat.name] = rows[0].id;
        }

        await conn.beginTransaction();

        let count = 0;
        // Estrutura temporária para agrupar por mês
        const monthData = {}; 

        // 2. Lê a planilha e agrupa
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const accountName = (row[0] || '').toString().toLowerCase();

            // Identifica qual categoria essa linha representa
            let catId = null;
            let type = null;
            let dbColumn = null; // Qual coluna do monthly_entries atualizar

            if (accountName.includes('receita bruta') || accountName.includes('faturamento')) {
                catId = categoriesMap['Receita Bruta (Importada)'];
                type = 'REVENUE';
                dbColumn = 'revenue_product';
            } else if (accountName.includes('impostos') || accountName.includes('deduções')) {
                catId = categoriesMap['Impostos e Deduções'];
                type = 'EXPENSE';
                dbColumn = 'tax_icms'; // Simplificação: joga tudo em ICMS se for genérico, ou soma
            } else if (accountName.includes('custos variáveis') || accountName.includes('cmv')) {
                catId = categoriesMap['Custos Variáveis'];
                type = 'EXPENSE';
                dbColumn = 'purchases_total';
            } else if (accountName.includes('despesas operacionais')) {
                catId = categoriesMap['Despesas Operacionais'];
                type = 'EXPENSE';
                dbColumn = 'expenses_total';
            }

            if (!catId) continue; // Pula linhas de cabeçalho ou totais irrelevantes

            // Processa colunas de meses
            for (let colIndex = 3; colIndex <= 14; colIndex++) {
                const month = monthsMap[colIndex];
                if (!month) continue;
                
                const periodStart = `${year}-${month}-01`;
                const value = parseFloat((row[colIndex] || '').toString().replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

                if (value === 0) continue;

                if (!monthData[periodStart]) {
                    monthData[periodStart] = { 
                        revenue: 0, taxes: 0, purchases: 0, expenses: 0, 
                        details: [] 
                    };
                }

                // Soma nos totais
                if (dbColumn === 'revenue_product') monthData[periodStart].revenue += value;
                if (dbColumn === 'tax_icms') monthData[periodStart].taxes += value;
                if (dbColumn === 'purchases_total') monthData[periodStart].purchases += value;
                if (dbColumn === 'expenses_total') monthData[periodStart].expenses += value;

                // Adiciona ao detalhe para o gráfico de categorias
                monthData[periodStart].details.push({
                    category_id: catId,
                    type: type,
                    amount: value,
                    description: row[0] // Usa o nome da conta original da planilha (ex: "(-) Custos Variáveis")
                });
            }
        }

        // 3. Salva no Banco (Lançamento Mensal + Detalhes)
        for (const [periodStart, data] of Object.entries(monthData)) {
            // Upsert do Mês
            const [existing] = await conn.execute('SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?', [req.body.companyId, periodStart]);
            let entryId;
            
            // Calcula último dia
            const [y, m] = periodStart.split('-');
            const lastDay = new Date(y, m, 0).getDate();
            const periodEnd = `${y}-${m}-${lastDay}`;

            if (existing.length > 0) {
                entryId = existing[0].id;
                await conn.execute(`
                    UPDATE monthly_entries SET 
                    revenue_product = ?, tax_icms = ?, purchases_total = ?, expenses_total = ?, notes = ?
                    WHERE id = ?
                `, [data.revenue, data.taxes, data.purchases, data.expenses, `Importado Auto ${year}`, entryId]);
                
                // Limpa detalhes antigos para não duplicar na reimportação
                await conn.execute('DELETE FROM entry_details WHERE entry_id = ?', [entryId]);
            } else {
                const [ins] = await conn.execute(`
                    INSERT INTO monthly_entries 
                    (company_id, period_start, period_end, revenue_product, tax_icms, purchases_total, expenses_total, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [req.body.companyId, periodStart, periodEnd, data.revenue, data.taxes, data.purchases, data.expenses, `Importado Auto ${year}`]);
                entryId = ins.insertId;
            }

            // Insere os Detalhes (Isso que alimenta o gráfico de categorias!)
            for (const detail of data.details) {
                await conn.execute(`
                    INSERT INTO entry_details (entry_id, category_id, type, amount, description)
                    VALUES (?, ?, ?, ?, ?)
                `, [entryId, detail.category_id, detail.type, detail.amount, detail.description]);
            }
            count++;
        }

        await conn.commit();
        res.json({ success: true, message: `Processado com sucesso! ${count} meses gerados com detalhes.` });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ error: "Erro na importação: " + error.message });
    } finally {
        conn.release();
    }
});
// ROTA DE RANKING DE PARCEIROS (CURVA ABC)
app.get('/api/reports/partners-ranking', async (req, res) => {
    try {
        const { companyId, startDate, endDate } = req.query;

        // Query para Clientes (Receita)
        const [clients] = await pool.execute(`
            SELECT p.name, SUM(ed.amount) as value
            FROM entry_details ed
            JOIN partners p ON ed.partner_id = p.id
            JOIN monthly_entries me ON ed.entry_id = me.id
            WHERE me.company_id = ? 
            AND me.period_start >= ? AND me.period_start <= ?
            AND ed.type = 'REVENUE'
            GROUP BY p.name
            ORDER BY value DESC
            LIMIT 5
        `, [companyId, startDate, endDate]);

        // Query para Fornecedores (Despesa)
        const [suppliers] = await pool.execute(`
            SELECT p.name, SUM(ed.amount) as value
            FROM entry_details ed
            JOIN partners p ON ed.partner_id = p.id
            JOIN monthly_entries me ON ed.entry_id = me.id
            WHERE me.company_id = ? 
            AND me.period_start >= ? AND me.period_start <= ?
            AND ed.type = 'EXPENSE'
            GROUP BY p.name
            ORDER BY value DESC
            LIMIT 5
        `, [companyId, startDate, endDate]);

        res.json({ clients, suppliers });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Inicialização do Servidor
initDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n==================================================`);
        console.log(`🚀 VECTOR SERVER OPERACIONAL NA PORTA ${PORT}`);
        console.log(`✅ Segurança JWT Ativada`);
        console.log(`✅ Banco de Dados Conectado`);
        console.log(`Autoria de Nicolas Pereira Lucas Gonçalves - desenvolvedor full stack`);
        console.log(`==================================================\n`);
    });
});