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

// AGENTE HTTPS E UPLOAD
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
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
// FUNÇÕES UTILITÁRIAS GERAIS
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
    } catch(error) { 
        console.error("Erro ao salvar log de auditoria:", error.message); 
    } 
};

// =================================================================================
// FUNÇÕES UTILITÁRIAS — IMPORTAÇÃO DE DRE CSV
// =================================================================================

const parseDreValue = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    
    const str = val.toString()
        .replace(/"/g, '')       // remove aspas CSV
        .replace(/\u00a0/g, '')  // remove espaço não-quebrável (U+00A0)
        .trim();
        
    if (str === '-' || str === '') return 0;
    
    const direct = parseFloat(str);
    if (!isNaN(direct) && !str.includes(',')) return direct;
    
    const cleaned = str
        .replace(/R\$\s*/gi, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim();
        
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

const parseDreCSVToMatrix = (buffer) => {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, ''); // strip BOM
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');

    return lines.map(line => {
        const cols =[];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ';' && !inQuotes) {
                cols.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        cols.push(current);
        return cols;
    });
};

// =================================================================================
// FUNÇÕES UTILITÁRIAS — IMPORTAÇÃO DE BALANCETE CSV
// =================================================================================

const parseBalanceteBR = (str) => {
    if (!str || typeof str !== 'string' || str.trim() === '') return 0;
    const num = parseFloat(str.trim().replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
};

const detectPeriodFromCSV = (text) => {
    const match = text.match(/Emiss[aã]o[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i);
    if (match) {
        const month = match[2].padStart(2, '0');
        const year  = match[3];
        return `${year}-${month}`;
    }
    return null;
};

const parseBalanceteRows = (text) => {
    const lines = text.split('\n');
    const accounts =[];

    // Detecção de delimitador inteligente
    let delimiter = ';';
    const headerSample = lines.slice(0, 5).join('\n');
    if (headerSample.includes('Id,Classificação') || headerSample.includes('Id,Classificacao')) {
        delimiter = ',';
    }

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        
        // Quebra a linha respeitando aspas
        const cols =[];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                cols.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        cols.push(current);

        if (cols.length < 6) continue;

        // Limpa possíveis aspas residuais que sobraram
        const cleanCol = (c) => (c || '').replace(/^"|"$/g, '').trim();

        const id            = cleanCol(cols[0]);
        const classificacao = cleanCol(cols[1]);
        const tipoC         = cleanCol(cols[2]).toUpperCase();
        const descricao     = cleanCol(cols[3]).replace(/\t/g, ' ');
        const entrada       = parseBalanceteBR(cleanCol(cols[4]));
        const saida         = parseBalanceteBR(cleanCol(cols[5]));
        const saldo         = parseBalanceteBR(cleanCol(cols[6]));

        // Ignora cabeçalhos
        if (
            !classificacao || 
            classificacao === 'Classificação' || 
            classificacao === 'Classificacao' ||
            !descricao || 
            descricao === 'Descrição' || 
            !/^\d/.test(id)
        ) {
            continue;
        }

        accounts.push({ 
            id, 
            classificacao: classificacao.replace(',', '.'), 
            tipoC, 
            descricao, 
            entrada, 
            saida, 
            saldo 
        });
    }
    return accounts;
};

const findLeafAccounts = (accounts) => {
    // 1. Se o sistema mandar explicitamente contas Analíticas (ex: tipo 'A' ou diferente de 'T')
    const analytical = accounts.filter(a => a.tipoC === 'A');
    if (analytical.length > 0) return analytical;

    // 2. Normalizador de Hierarquia (O CORAÇÃO DA CORREÇÃO)
    // Transforma "04.01.01" e "4,01" ambos no padrão "4.1.1" e "4.1" para comparação real.
    const normalize = (cls) => {
        if (!cls) return '';
        return cls.replace(/,/g, '.')        // Garante que separador é ponto
                  .split('.')                // Separa os blocos
                  .map(num => parseInt(num, 10)) // Converte '04' para 4 (tira zero à esquerda)
                  .join('.');                // Junta de novo
    };

    // Cria um array só com as classificações normalizadas para checagem rápida
    const allNormCls = accounts.map(a => normalize(a.classificacao));

    // 3. Filtra: Só retorna a conta se ela NÃO for pai de ninguém
    return accounts.filter((acct, index) => {
        const myNormCls = normalize(acct.classificacao);
        
        // Verifica se existe alguma outra conta no array que comece com a "minha classe."
        const isParent = allNormCls.some((otherCls, otherIndex) => {
            return index !== otherIndex && otherCls.startsWith(myNormCls + '.');
        });
        
        // Se NÃO for pai, é uma conta folha (Analítica). Pode somar!
        return !isParent;
    });
};

const REVENUE_PATTERNS =[
    { regex: /VEND.*PROD|PRODUTO\s*ACABADO|MERCAD/i, column: 'revenue_product' },
    { regex: /SERVI[ÇC]|SERVICE/i,                    column: 'revenue_service' },
    { regex: /REVENDA/i,                               column: 'revenue_resale'  },
    { regex: /ALUGUEL|LOCA[ÇC]/i,                      column: 'revenue_rent'    },
];

const TAX_PATTERNS =[
    { regex: /\bPIS\b/i,                                  column: 'tax_pis'             },
    { regex: /COFINS/i,                                   column: 'tax_cofins'          },
    { regex: /\bICMS\b/i,                                 column: 'tax_icms'            },
    { regex: /\bISS\b/i,                                  column: 'tax_iss'             },
    { regex: /\bCSLL\b/i,                                 column: 'tax_csll'            },
    { regex: /IRPJ.*ADICIONAL|ADICIONAL.*IRPJ/i,          column: 'tax_additional_irpj' },
    { regex: /\bIRPJ\b/i,                                 column: 'tax_irpj'            },
    { regex: /\bDAS\b|SIMPLES\s*NACIONAL|SIMPLES\s*FED/i, column: 'tax_icms'            },
    { regex: /DIFAL/i,                                    column: 'tax_difal'           },
    { regex: /\bFUST\b/i,                                 column: 'tax_fust'            },
    { regex: /\bFUNTELL\b/i,                              column: 'tax_funtell'         },
];

const CPV_IN_GROUP2  =[/CPV|CMV|CUSTO.*PROD.*VEND|CUSTO.*MERC.*VEND/i, /FRETE.*COMP|FRETE.*ENTR|FRETE.*MAT/i, /DEVOLU[ÇC]/i, /ABATIMENTO/i];
const EXPENSE_IN_GROUP2 = [/COMISS/i, /DESCONTO\s*CONCEDIDO/i];

const mapAccountToColumns = (account) => {
    const { classificacao, descricao, entrada, saida, saldo } = account;
    const firstChar = classificacao.charAt(0);
    const desc = descricao.toUpperCase();

    if (firstChar === '1') {
        let column = 'revenue_product';
        for (const p of REVENUE_PATTERNS) { 
            if (p.regex.test(desc)) { column = p.column; break; } 
        }
        const value = entrada > 0 ? entrada : Math.abs(saldo);
        if (value <= 0) return null;
        return { column, value, entryType: 'REVENUE', description: descricao };
    }
    
    if (firstChar === '2') {
        for (const p of CPV_IN_GROUP2) { 
            if (p.test(desc)) { 
                const value = saida > 0 ? saida : Math.abs(saldo); 
                if (value <= 0) return null; 
                return { column: 'purchases_total', value, entryType: 'EXPENSE', description: descricao }; 
            } 
        }
        for (const p of EXPENSE_IN_GROUP2) { 
            if (p.test(desc)) { 
                const value = saida > 0 ? saida : Math.abs(saldo); 
                if (value <= 0) return null; 
                return { column: 'expenses_total', value, entryType: 'EXPENSE', description: descricao }; 
            } 
        }
        let column = 'tax_icms';
        for (const p of TAX_PATTERNS) { 
            if (p.regex.test(desc)) { column = p.column; break; } 
        }
        const value = saida > 0 ? saida : Math.abs(saldo);
        if (value <= 0) return null;
        return { column, value, entryType: 'EXPENSE', description: descricao };
    }
    
    if (firstChar === '3') { 
        const value = saida > 0 ? saida : Math.abs(saldo); 
        if (value <= 0) return null; 
        return { column: 'purchases_total', value, entryType: 'EXPENSE', description: descricao }; 
    }
    
    if (parseInt(firstChar) >= 4 && parseInt(firstChar) <= 9) { 
        const value = saida > 0 ? saida : Math.abs(saldo); 
        if (value <= 0) return null; 
        return { column: 'expenses_total', value, entryType: 'EXPENSE', description: descricao }; 
    }
    
    const firstTwo = parseInt(classificacao.substring(0, 2));
    if (!isNaN(firstTwo) && firstTwo >= 10) { 
        const value = saida > 0 ? saida : (entrada > 0 ? entrada : Math.abs(saldo)); 
        if (value <= 0) return null; 
        return { column: 'expenses_total', value, entryType: 'EXPENSE', description: descricao }; 
    }
    
    return null;
};

// =================================================================================
// MIDDLEWARE DE AUTENTICAÇÃO (JWT)
// =================================================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.status(401).json({ message: 'Token não fornecido' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido ou expirado' });
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
        if (error.errno !== 1060) {
            console.error(`Erro ao adicionar coluna ${columnDef}:`, error.message);
        }
    }
};

const initDb = async () => {
    try {
        const conn = await pool.getConnection();
        
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
        
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY, 
                full_name VARCHAR(255), 
                email VARCHAR(255) UNIQUE, 
                password_hash VARCHAR(255), 
                role ENUM('SUPER_ADMIN','ADMIN','MANAGER','CLIENT') DEFAULT 'CLIENT', 
                company_id INT, 
                max_companies INT DEFAULT 1, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
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
        
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS company_groups (
                id INT AUTO_INCREMENT PRIMARY KEY, 
                name VARCHAR(150), 
                description TEXT
            )
        `);
        
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
        
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY, 
                name VARCHAR(150), 
                type ENUM('REVENUE','EXPENSE'), 
                questor_account_code VARCHAR(50)
            )
        `);
        
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

        // Adiciona colunas se não existirem
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
        const [u] = await pool.execute('SELECT * FROM users WHERE email = ? AND password_hash = ?', [email, password]);
        
        if (u.length === 0) {
            return response.status(401).json({ message: 'Credenciais Inválidas' });
        }
        
        const user = u[0];
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, company_id: user.company_id }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        await logAction(user.id, user.full_name, 'LOGIN', 'Realizou login no sistema.');
        response.json({ user, token });
    } catch (error) { 
        response.status(500).json({ message: error.message }); 
    }
});

// =================================================================================
// MIDDLEWARE DE PROTEÇÃO
// =================================================================================
app.use(authenticateToken);

// =================================================================================
// ROTAS ADMINISTRAÇÃO (SUPER ADMIN)
// =================================================================================
app.get('/api/admin/users', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Sem permissão.' });
    try {
        const[rows] = await pool.execute(`
            SELECT u.id, u.full_name, u.email, u.role, u.max_companies, u.created_at, 
            (SELECT COUNT(*) FROM companies c WHERE c.owner_id = u.id) as companies_used 
            FROM users u ORDER BY u.created_at DESC
        `);
        res.json(rows);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.post('/api/admin/users', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Sem permissão.' });
    const { full_name, email, password, role, max_companies } = req.body;
    try {
        const [exists] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (exists.length > 0) return res.status(400).json({ message: 'E-mail já cadastrado.' });
        
        const [result] = await pool.execute(
            'INSERT INTO users (full_name, email, password_hash, role, max_companies) VALUES (?, ?, ?, ?, ?)',[full_name, email, password, role || 'ADMIN', max_companies || 1]
        );
        
        await logAction(req.user.id, 'SuperAdmin', 'CREATE_USER', `Criou usuário: ${email}`);
        res.json({ success: true, id: result.insertId });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.put('/api/admin/users/:id', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Sem permissão.' });
    const { max_companies, role, password } = req.body;
    try {
        let query = 'UPDATE users SET max_companies = ?, role = ?';
        let params = [max_companies, role];
        
        if (password) { 
            query += ', password_hash = ?'; 
            params.push(password); 
        }
        
        query += ' WHERE id = ?'; 
        params.push(req.params.id);
        
        await pool.execute(query, params);
        await logAction(req.user.id, 'SuperAdmin', 'UPDATE_USER', `Atualizou usuário ID: ${req.params.id}`);
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Sem permissão.' });
    try {
        await pool.execute('DELETE FROM users WHERE id = ?',[req.params.id]);
        await logAction(req.user.id, 'SuperAdmin', 'DELETE_USER', `Excluiu usuário ID: ${req.params.id}`);
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

app.post('/api/admin/impersonate', async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Sem permissão.' });
    const { targetUserId } = req.body;
    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?',[targetUserId]);
        if (users.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
        
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
// ROTAS DE CUSTOS E DESPESAS FIXAS
// =================================================================================
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
            'INSERT INTO fixed_expenses (company_id, name, amount) VALUES (?, ?, ?)',[company_id, name, amount]
        ); 
        res.json({ success: true, id: result.insertId }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/fixed-expenses/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM fixed_expenses WHERE id = ?',[req.params.id]); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/payroll', async (req, res) => { 
    try { 
        const [rows] = await pool.execute('SELECT * FROM payroll_expenses WHERE company_id = ? ORDER BY employee_name',[req.query.companyId]); 
        res.json(rows); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/payroll', async (req, res) => { 
    const { company_id, employee_name, role, total_cost } = req.body; 
    try { 
        const [result] = await pool.execute(
            'INSERT INTO payroll_expenses (company_id, employee_name, role, total_cost) VALUES (?, ?, ?, ?)',[company_id, employee_name, role, total_cost]
        ); 
        res.json({ success: true, id: result.insertId }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/payroll/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM payroll_expenses WHERE id = ?',[req.params.id]); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

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
            'INSERT INTO prolabore_expenses (company_id, partner_name, total_cost) VALUES (?, ?, ?)',[company_id, partner_name, total_cost]
        ); 
        res.json({ success: true, id: result.insertId }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/prolabore/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM prolabore_expenses WHERE id = ?',[req.params.id]); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

// =================================================================================
// ROTAS DE CANAIS DE VENDA
// =================================================================================
app.get('/api/sales-channels', async (req, res) => {
    try {
        const { companyId } = req.query;
        const [rows] = await pool.execute('SELECT * FROM sales_channels WHERE company_id = ? OR company_id = 1 ORDER BY name',[companyId || 0]);
        
        const unique =[]; 
        const names = new Set();
        
        rows.sort((a,b) => (a.company_id == companyId ? -1 : 1)).forEach(r => { 
            if(!names.has(r.name)){ 
                names.add(r.name); 
                unique.push(r); 
            } 
        });
        
        res.json(unique);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/sales-channels', async (req, res) => { 
    const { company_id, name } = req.body; 
    try { 
        const [resDb] = await pool.execute(
            `INSERT INTO sales_channels (company_id, name) VALUES (?, ?)`,[company_id, name]
        ); 
        await logAction(req.user.id, req.user.email, 'CREATE_BLOCK', `Criou bloco: ${name}`); 
        res.json({success: true, id: resDb.insertId}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/sales-channels/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM sales_channels WHERE id = ?',[req.params.id]); 
        await logAction(req.user.id, req.user.email, 'DELETE_BLOCK', `Excluiu bloco ID: ${req.params.id}`); 
        res.json({success: true}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.put('/api/sales-channels/:id', async (req, res) => {
    const { 
        icms_out_percent, pis_out_percent, cofins_out_percent, ipi_out_percent, 
        difal_out_percent, ir_csll_percent, commission_percent, marketing_percent, 
        freight_percent, default_rate_percent, financial_cost_percent, 
        fixed_expenses_rate_percent, payroll_rate_percent, administrative_cost_percent, 
        profit_margin_percent, freight_value 
    } = req.body;
    
    try {
        await pool.execute(
            `UPDATE sales_channels SET 
                icms_out_percent=?, pis_out_percent=?, cofins_out_percent=?, ipi_out_percent=?, 
                difal_out_percent=?, ir_csll_percent=?, commission_percent=?, marketing_percent=?, 
                freight_percent=?, default_rate_percent=?, financial_cost_percent=?, fixed_expenses_rate_percent=?, 
                payroll_rate_percent=?, administrative_cost_percent=?, profit_margin_percent=?, freight_value=? 
            WHERE id=?`,[
                icms_out_percent||0, pis_out_percent||0, cofins_out_percent||0, ipi_out_percent||0, 
                difal_out_percent||0, ir_csll_percent||0, commission_percent||0, marketing_percent||0, 
                freight_percent||0, default_rate_percent||0, financial_cost_percent||0, fixed_expenses_rate_percent||0, 
                payroll_rate_percent||0, administrative_cost_percent||0, profit_margin_percent||0, freight_value||0, 
                req.params.id
            ]
        );
        res.json({success: true});
    } catch (e) { 
        res.status(500).json({error: e.message}); 
    }
});

// =================================================================================
// ROTAS DE CADASTRO (MATERIAIS E PRODUTOS) E PRICING
// =================================================================================
app.post('/api/materials', async (req, res) => { 
    try { 
        const [r] = await pool.execute(
            `INSERT INTO materials (company_id, name, ncm, price_national, price_imported, ipi_percent, is_national) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,[req.body.company_id, req.body.name, req.body.ncm, req.body.price_national, req.body.price_imported, req.body.ipi_percent, req.body.is_national ? 1 : 0]
        ); 
        res.json({success:true, id:r.insertId}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/materials-full', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT * FROM materials WHERE company_id = ? ORDER BY id DESC LIMIT 100',[req.query.companyId]); 
        res.json(r); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/materials/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM materials WHERE id = ?', [req.params.id]); 
        res.json({success:true}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/products', async (req, res) => { 
    try { 
        const [r] = await pool.execute(
            'INSERT INTO products (company_id, name, sku) VALUES (?, ?, ?)',[req.body.company_id, req.body.name, req.body.sku]
        ); 
        res.json({success:true, id:r.insertId}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/products/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM products WHERE id = ?',[req.params.id]); 
        res.json({success:true}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/products-list', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT id, name, sku FROM products WHERE company_id = ? ORDER BY name ASC', [req.query.companyId || 0]); 
        res.json(r); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/price-calc', async (req, res) => { 
    try { 
        const r = await PricingService.calculateProductPrice(req.query.productId, req.query.channelId); 
        res.json(r); 
    } catch (e) { 
        res.status(500).json({error: e.message}); 
    } 
});

// =================================================================================
// ROTAS DE ENTIDADES E GRUPOS
// =================================================================================
app.get('/api/utils/cnpj/:cnpj', async (req, res) => { 
    const cnpj = req.params.cnpj.replace(/\D/g, ''); 
    try { 
        const r = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); 
        res.json({ 
            taxId: cnpj, 
            name: r.data.razao_social, 
            tradeName: r.data.nome_fantasia || r.data.razao_social, 
            taxRegime: r.data.opcao_pelo_simples ? 'SIMPLES' : 'LUCRO_PRESUMIDO' 
        }); 
    } catch (e) { 
        res.status(500).json({message: 'Erro CNPJ'}); 
    } 
});

app.get('/api/groups', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT * FROM company_groups ORDER BY name'); 
        res.json(r); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/groups', async (req, res) => { 
    try { 
        const [r] = await pool.execute(
            'INSERT INTO company_groups (name, description) VALUES (?, ?)',[req.body.name, req.body.description]
        ); 
        res.json({id: r.insertId}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/groups/:id', async (req, res) => { 
    try { 
        await pool.execute('UPDATE companies SET group_id = NULL WHERE group_id = ?', [req.params.id]); 
        await pool.execute('DELETE FROM company_groups WHERE id = ?', [req.params.id]); 
        res.json({success:true}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/companies', async (req, res) => { 
    try { 
        let query = 'SELECT * FROM companies'; 
        let params =[];
        
        if (req.user.role !== 'SUPER_ADMIN') { 
            query += ' WHERE owner_id = ?'; 
            params.push(req.user.id); 
        }
        
        query += ' ORDER BY name';
        const [r] = await pool.execute(query, params); 
        res.json(r); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/companies', async (req, res) => { 
    const userId = req.user.id; 
    const userRole = req.user.role;
    
    try { 
        if (userRole !== 'SUPER_ADMIN') {
            const [usage] = await pool.execute('SELECT COUNT(*) as count FROM companies WHERE owner_id = ?', [userId]);
            const [userLimit] = await pool.execute('SELECT max_companies FROM users WHERE id = ?', [userId]);
            
            if (usage[0].count >= userLimit[0].max_companies) {
                return res.status(403).json({ error: `Limite de licenças atingido.` });
            }
        }
        
        const [r] = await pool.execute(
            'INSERT INTO companies (name, trade_name, tax_id, tax_regime, group_id, owner_id) VALUES (?, ?, ?, ?, ?, ?)',[req.body.name, req.body.trade_name, req.body.tax_id, req.body.tax_regime, req.body.group_id, userId]
        ); 
        
        await logAction(req.user.id, req.user.email, 'CREATE_COMPANY', `Criou: ${req.body.name}`); 
        res.json({id: r.insertId}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.put('/api/companies/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const companyId = req.params.id; 
        const { name, trade_name, tax_id, tax_regime, group_id } = req.body;
        
        if (req.user.role !== 'SUPER_ADMIN') {
            const [check] = await conn.execute('SELECT id FROM companies WHERE id = ? AND owner_id = ?',[companyId, req.user.id]);
            if (check.length === 0) return res.status(403).json({ message: 'Sem permissão.' });
        }
        
        await conn.execute(
            `UPDATE companies SET name=?, trade_name=?, tax_id=?, tax_regime=?, group_id=? WHERE id=?`,[name, trade_name, tax_id, tax_regime, group_id || null, companyId]
        );
        
        await logAction(req.user.id, req.user.email, 'UPDATE_COMPANY', `Atualizou empresa ID: ${companyId}`);
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } finally { 
        conn.release(); 
    }
});

app.delete('/api/companies/:id', async (req, res) => { 
    const conn = await pool.getConnection();
    try { 
        const companyId = req.params.id;
        
        if (req.user.role !== 'SUPER_ADMIN') {
            const [check] = await conn.execute('SELECT id FROM companies WHERE id = ? AND owner_id = ?', [companyId, req.user.id]);
            if (check.length === 0) { 
                conn.release(); 
                return res.status(403).json({ message: 'Sem permissão.' }); 
            }
        }
        
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        
        await conn.execute('DELETE FROM entry_details WHERE entry_id IN (SELECT id FROM monthly_entries WHERE company_id = ?)', [companyId]);
        await conn.execute('DELETE FROM product_boms WHERE product_id IN (SELECT id FROM products WHERE company_id = ?)', [companyId]);
        
        const tablesToDelete =[
            'monthly_entries', 'fixed_expenses', 'payroll_expenses', 
            'prolabore_expenses', 'sales_channels', 'materials', 
            'products', 'partners', 'budget_goals'
        ];
        
        for (const t of tablesToDelete) {
            await conn.execute(`DELETE FROM ${t} WHERE company_id = ?`, [companyId]);
        }
        
        await conn.execute('UPDATE users SET company_id = NULL WHERE company_id = ?',[companyId]);
        await conn.execute('DELETE FROM companies WHERE id = ?', [companyId]);
        
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        
        await logAction(req.user.id, req.user.email, 'DELETE_COMPANY', `Excluiu empresa ID: ${companyId}`); 
        res.json({ success: true }); 
        
    } catch (e) { 
        await conn.query('SET FOREIGN_KEY_CHECKS = 1'); 
        res.status(500).json({ error: e.message }); 
    } finally { 
        conn.release(); 
    }
});

app.get('/api/partners/:companyId', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT * FROM partners WHERE company_id = ? ORDER BY name', [req.params.companyId]); 
        res.json(r); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/partners', async (req, res) => { 
    try { 
        await pool.execute(
            'INSERT INTO partners (company_id, name, tax_id, type, phone, email) VALUES (?, ?, ?, ?, ?, ?)',[req.body.company_id, req.body.name, req.body.tax_id, req.body.type, req.body.phone, req.body.email]
        ); 
        res.json({success:true}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/partners/:id', async (req, res) => { 
    try { 
        await pool.execute('DELETE FROM partners WHERE id = ?',[req.params.id]); 
        res.json({success:true}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/categories', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT * FROM categories'); 
        res.json(r); 
    } catch (e) { 
        res.status(500).json(e); 
    } 
});

// =================================================================================
// MÓDULO: LANÇAMENTOS E RELATÓRIOS (DRE / BI)
// =================================================================================

app.get('/api/entries', async (req, res) => { 
    try { 
        const[r] = await pool.execute(
            'SELECT * FROM monthly_entries WHERE company_id = ? AND period_start = ?',
            [req.query.companyId, req.query.month]
        ); 
        
        if(r.length) { 
            const [d] = await pool.execute('SELECT * FROM entry_details WHERE entry_id = ?', [r[0].id]); 
            res.json({...r[0], details:d}); 
        } else {
            res.json(null); 
        }
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/entries', async (req, res) => { 
    const { companyId, periodStart, revenue, taxes, purchasesTotal, expensesTotal, notes, details } = req.body;
    const conn = await pool.getConnection();
    
    try {
        await conn.beginTransaction();
        const [existing] = await conn.execute(
            'SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?',[companyId, periodStart]
        );
        let entryId;
        
        const vals =[
            amountOrZero(revenue.resale), amountOrZero(revenue.product), amountOrZero(revenue.service), 
            amountOrZero(revenue.rent), amountOrZero(revenue.other), amountOrZero(taxes.icms), 
            amountOrZero(taxes.difal), amountOrZero(taxes.iss), amountOrZero(taxes.pis), 
            amountOrZero(taxes.cofins), amountOrZero(taxes.csll), amountOrZero(taxes.irpj), 
            amountOrZero(taxes.additionalIrpj), amountOrZero(taxes.fust), amountOrZero(taxes.funtell), 
            amountOrZero(purchasesTotal), amountOrZero(expensesTotal), notes || ''
        ];
        
        if (existing.length) {
            entryId = existing[0].id;
            await conn.execute(`
                UPDATE monthly_entries SET 
                revenue_resale=?, revenue_product=?, revenue_service=?, revenue_rent=?, revenue_other=?, 
                tax_icms=?, tax_difal=?, tax_iss=?, tax_pis=?, tax_cofins=?, tax_csll=?, tax_irpj=?, 
                tax_additional_irpj=?, tax_fust=?, tax_funtell=?, purchases_total=?, expenses_total=?, notes=? 
                WHERE id=?
            `, [...vals, entryId]);
        } else {
            const [r] = await conn.execute(`
                INSERT INTO monthly_entries (
                    revenue_resale, revenue_product, revenue_service, revenue_rent, revenue_other, 
                    tax_icms, tax_difal, tax_iss, tax_pis, tax_cofins, tax_csll, tax_irpj, 
                    tax_additional_irpj, tax_fust, tax_funtell, purchases_total, expenses_total, 
                    notes, company_id, period_start, period_end
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `,[...vals, companyId, periodStart, periodStart]);
            entryId = r.insertId;
        }
        
        await conn.execute('DELETE FROM entry_details WHERE entry_id = ?', [entryId]);
        
        if(details) { 
            for(let d of details) { 
                await conn.execute(
                    'INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description) VALUES (?,?,?,?,?,?)',[entryId, d.partner_id, d.category_id, d.type, d.amount, d.description]
                ); 
            } 
        }
        
        await conn.commit();
        await logAction(req.user.id, req.user.email, 'UPSERT_ENTRY', `Consolidou mês: ${periodStart}`);
        res.json({success:true, id:entryId});
        
    } catch (e) { 
        await conn.rollback(); 
        res.status(500).json({ error: e.message }); 
    } finally { 
        conn.release(); 
    }
});

app.post('/api/entries/clone', authenticateToken, async (req, res) => {
    const { companyId, sourceMonth, targetMonth } = req.body;
    const conn = await pool.getConnection();
    
    try {
        const [source] = await conn.execute(
            'SELECT * FROM monthly_entries WHERE company_id = ? AND period_start = ?',[companyId, sourceMonth + '-01']
        );
        if (source.length === 0) return res.status(404).json({ error: 'Mês de origem não possui dados lançados.' });
        
        const originEntry = source[0];
        
        const [targetCheck] = await conn.execute(
            'SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?',[companyId, targetMonth + '-01']
        );
        if (targetCheck.length > 0) return res.status(400).json({ error: 'Mês de destino já possui lançamentos. Exclua antes de clonar.' });
        
        await conn.beginTransaction();
        
        const[y, m] = targetMonth.split('-'); 
        const lastDay = new Date(y, m, 0).getDate(); 
        const periodEnd = `${y}-${m}-${lastDay}`;
        
        const[result] = await conn.execute(`
            INSERT INTO monthly_entries (
                company_id, period_start, period_end, revenue_resale, revenue_product, 
                revenue_service, revenue_rent, revenue_other, tax_icms, tax_difal, tax_iss, 
                tax_pis, tax_cofins, tax_csll, tax_irpj, tax_additional_irpj, tax_fust, 
                tax_funtell, purchases_total, expenses_total, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,[
            companyId, targetMonth+'-01', periodEnd, originEntry.revenue_resale, 
            originEntry.revenue_product, originEntry.revenue_service, originEntry.revenue_rent, 
            originEntry.revenue_other, originEntry.tax_icms, originEntry.tax_difal, originEntry.tax_iss, 
            originEntry.tax_pis, originEntry.tax_cofins, originEntry.tax_csll, originEntry.tax_irpj, 
            originEntry.tax_additional_irpj, originEntry.tax_fust, originEntry.tax_funtell, 
            originEntry.purchases_total, originEntry.expenses_total, `Clonado de ${sourceMonth}`
        ]);
        
        const newEntryId = result.insertId;
        
        const[details] = await conn.execute('SELECT * FROM entry_details WHERE entry_id = ?',[originEntry.id]);
        
        for (const det of details) { 
            await conn.execute(`
                INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description) 
                VALUES (?, ?, ?, ?, ?, ?)
            `,[newEntryId, det.partner_id, det.category_id, det.type, det.amount, det.description]); 
        }
        
        await conn.commit();
        await logAction(req.user.id, req.user.email, 'CLONE_MONTH', `Clonou ${sourceMonth} para ${targetMonth}`);
        res.json({ success: true });
        
    } catch (error) { 
        await conn.rollback(); 
        res.status(500).json({ error: error.message }); 
    } finally { 
        conn.release(); 
    }
});

app.get('/api/entries/history', async (req, res) => {
    const { companyId } = req.query;
    try { 
        const[rows] = await pool.execute('SELECT * FROM monthly_entries WHERE company_id = ? ORDER BY period_start DESC', [companyId]); 
        res.json(rows); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.delete('/api/entries', async (req, res) => {
    try { 
        await pool.execute(
            'DELETE FROM monthly_entries WHERE company_id = ? AND period_start = ?',
            [req.query.companyId, req.query.month]
        ); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/report', async (req, res) => { 
    try { 
        const companyIds = Array.isArray(req.body.companyIds) && req.body.companyIds.length > 0 
            ? req.body.companyIds 
            : [req.body.companyId || 0];
            
        const query = `
            SELECT 
                DATE_FORMAT(period_start,'%Y-%m') as month_key, 
                SUM(COALESCE(revenue_resale,0)+COALESCE(revenue_product,0)+COALESCE(revenue_service,0)+COALESCE(revenue_rent,0)+COALESCE(revenue_other,0)) as total_revenue, 
                SUM(COALESCE(tax_icms,0)+COALESCE(tax_difal,0)+COALESCE(tax_pis,0)+COALESCE(tax_cofins,0)+COALESCE(tax_iss,0)+COALESCE(tax_irpj,0)+COALESCE(tax_additional_irpj,0)+COALESCE(tax_csll,0)+COALESCE(tax_fust,0)+COALESCE(tax_funtell,0)) as total_taxes, 
                SUM(COALESCE(tax_icms,0)) as tax_icms, 
                SUM(COALESCE(tax_pis,0)) as tax_pis, 
                SUM(COALESCE(tax_cofins,0)) as tax_cofins, 
                SUM(COALESCE(tax_iss,0)) as tax_iss, 
                SUM(COALESCE(tax_irpj,0)+COALESCE(tax_csll,0)) as tax_irpj_csll, 
                SUM(COALESCE(purchases_total,0)) as total_purchases, 
                SUM(COALESCE(expenses_total,0)) as total_expenses 
            FROM monthly_entries 
            WHERE company_id IN (${companyIds.join(',')}) 
            AND period_start >= ? AND period_start <= ? 
            GROUP BY month_key 
            ORDER BY month_key ASC
        `;
        
        const [rows] = await pool.execute(query,[req.body.startDate, req.body.endDate]); 
        
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
            profit: Number(row.total_revenue)-Number(row.total_taxes)-Number(row.total_purchases)-Number(row.total_expenses) 
        }));
        
        const summary = months.reduce((acc, curr) => ({ 
            totalRevenue: acc.totalRevenue + curr.totalRevenue, 
            totalProfit: acc.totalProfit + curr.profit, 
            totalTaxes: acc.totalTaxes + curr.totalTaxes, 
            totalCosts: acc.totalCosts + curr.totalPurchases + curr.totalExpenses 
        }), { totalRevenue: 0, totalProfit: 0, totalTaxes: 0, totalCosts: 0 });
        
        const [categories] = await pool.execute(`
            SELECT c.name, ed.type, SUM(ed.amount) as total 
            FROM entry_details ed 
            JOIN monthly_entries me ON ed.entry_id=me.id 
            JOIN categories c ON ed.category_id=c.id 
            WHERE me.company_id IN (${companyIds.join(',')}) 
            AND me.period_start >= ? AND me.period_start <= ? 
            GROUP BY c.name, ed.type 
            ORDER BY total DESC
        `,[req.body.startDate, req.body.endDate]); 
        
        res.json({ months, summary, categories }); 
        
    } catch (e) { 
        console.error("Erro Report:", e); 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/intelligence/:companyId/:year', async (req, res) => { 
    try { 
        const { companyId, year } = req.params;
        
        const [realized] = await pool.execute(`
            SELECT MONTH(period_start) as month, 
            SUM(revenue_resale+revenue_product+revenue_service+revenue_other) as revenue, 
            SUM(purchases_total+expenses_total) as costs, 
            SUM(tax_icms+tax_iss+tax_pis+tax_cofins+tax_irpj+tax_csll) as taxes 
            FROM monthly_entries 
            WHERE company_id = ? AND YEAR(period_start) = ? 
            GROUP BY MONTH(period_start) 
            ORDER BY month ASC
        `, [companyId, year]); 
        
        const [p] = await pool.execute(
            'SELECT planned_amount as goal FROM budget_goals WHERE company_id = ? AND year = ?', 
            [companyId, year]
        ); 
        
        let forecast = 0; 
        const n = realized.length;
        
        if (n >= 2) {
            let sumX=0, sumY=0, sumXY=0, sumXX=0;
            realized.forEach((row, index) => { 
                const x = index + 1; 
                const y = Number(row.revenue); 
                sumX += x; 
                sumY += y; 
                sumXY += x * y; 
                sumXX += x * x; 
            });
            const slope = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX); 
            const intercept = (sumY - slope*sumX) / n;
            forecast = (slope * (n+1)) + intercept;
        } else if (n === 1) { 
            forecast = Number(realized[0].revenue); 
        }
        
        forecast = Math.max(0, forecast);
        res.json({ realized, planned: p[0]?.goal || 0, forecast }); 
        
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.post('/api/intelligence/goals', authenticateToken, async (req, res) => { 
    try { 
        const { companyId, year, plannedAmount } = req.body; 
        await pool.execute(
            'INSERT INTO budget_goals (company_id, year, planned_amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE planned_amount = ?',[companyId, year, plannedAmount, plannedAmount]
        ); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.delete('/api/intelligence/goals', authenticateToken, async (req, res) => { 
    try { 
        const { companyId, year } = req.query; 
        await pool.execute(
            'DELETE FROM budget_goals WHERE company_id = ? AND year = ?', 
            [companyId, year]
        ); 
        res.json({ success: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/intelligence/projections', async (req, res) => { 
    try { 
        const [r] = await pool.execute(`
            SELECT period_start, 
            (revenue_resale+revenue_product+revenue_service+revenue_other) as revenue, 
            (purchases_total+expenses_total) as expenses, 
            (tax_icms+tax_pis+tax_cofins+tax_iss+tax_irpj+tax_csll) as taxes 
            FROM monthly_entries 
            WHERE company_id = ?
        `, [req.query.companyId]); 
        
        const dataset = r.map(x => ({
            period: x.period_start.substring(0,7),
            revenue: Number(x.revenue),
            expenses: Number(x.expenses),
            taxes: Number(x.taxes),
            profit: Number(x.revenue) - Number(x.expenses) - Number(x.taxes)
        })); 
        res.json({dataset}); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    } 
});

app.get('/api/reports/dre', async (req, res) => { 
    try { 
        const [r] = await pool.execute(
            'SELECT * FROM monthly_entries WHERE company_id = ? AND YEAR(period_start) = ?',[req.query.companyId, req.query.year]
        ); 
        
        const dre = Array(12).fill(null).map((_,i) => ({
            month: i+1, grossRevenue: 0, deductions: 0, netRevenue: 0, 
            variableCosts: 0, grossProfit: 0, expenses: 0, netResult: 0
        })); 
        
        r.forEach(x => {
            const m = parseInt(x.period_start.split('-')[1]) - 1;
            const rev = Number(x.revenue_resale) + Number(x.revenue_product) + Number(x.revenue_service) + Number(x.revenue_rent) + Number(x.revenue_other);
            const tax = Number(x.tax_icms) + Number(x.tax_pis) + Number(x.tax_cofins) + Number(x.tax_iss) + Number(x.tax_irpj) + Number(x.tax_csll);
            
            dre[m].grossRevenue = rev;
            dre[m].deductions = tax;
            dre[m].netRevenue = rev - tax;
            dre[m].variableCosts = Number(x.purchases_total);
            dre[m].expenses = Number(x.expenses_total);
            dre[m].grossProfit = dre[m].netRevenue - dre[m].variableCosts;
            dre[m].netResult = dre[m].grossProfit - dre[m].expenses;
        }); 
        
        res.json(dre); 
    } catch(e) {
        res.status(500).json({error: e.message});
    } 
});

app.get('/api/audit-logs', async (req, res) => { 
    try { 
        const [r] = await pool.execute('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100'); 
        res.json(r); 
    } catch (e) { 
        res.status(500).json(e); 
    } 
});

// =================================================================================
// ROTA: DRE DETALHADA PARA EXPORTAÇÃO
// =================================================================================
app.get('/api/reports/dre/detailed', authenticateToken, async (req, res) => {
    try {
        const { companyId, year } = req.query;
        
        const[details] = await pool.execute(`
            SELECT c.name as category_name, ed.type, SUM(ed.amount) as total_value 
            FROM entry_details ed 
            JOIN monthly_entries me ON ed.entry_id=me.id 
            JOIN categories c ON ed.category_id=c.id 
            WHERE me.company_id=? AND YEAR(me.period_start)=? 
            GROUP BY c.name, ed.type 
            ORDER BY ed.type DESC, total_value DESC
        `, [companyId, year]);
        
        const [taxTotals] = await pool.execute(`
            SELECT SUM(tax_icms+tax_difal+tax_iss+tax_pis+tax_cofins+tax_csll+tax_irpj+tax_additional_irpj+tax_fust+tax_funtell) as total_taxes 
            FROM monthly_entries 
            WHERE company_id=? AND YEAR(period_start)=?
        `,[companyId, year]);
        
        const reportRows =[];
        
        reportRows.push({ type: 'S', code: '1', desc: 'RECEITA OPERACIONAL BRUTA', value: 0 });
        let totalRevenue = 0;
        
        details.filter(d => d.type === 'REVENUE').forEach(d => { 
            reportRows.push({ type: 'I', code: '1.1', desc: d.category_name, value: Number(d.total_value) }); 
            totalRevenue += Number(d.total_value); 
        });
        reportRows[0].value = totalRevenue;
        
        const totalTaxes = Number(taxTotals[0].total_taxes || 0);
        reportRows.push({ type: 'S', code: '2', desc: '(-) DEDUÇÕES E IMPOSTOS', value: totalTaxes * -1 });
        reportRows.push({ type: 'S', code: '3', desc: '(=) RECEITA LÍQUIDA', value: totalRevenue - totalTaxes });
        reportRows.push({ type: 'S', code: '4', desc: '(-) CUSTOS E DESPESAS OPERACIONAIS', value: 0 });
        
        let totalExpenses = 0;
        details.filter(d => d.type === 'EXPENSE').forEach(d => { 
            reportRows.push({ type: 'I', code: '4.1', desc: d.category_name, value: Number(d.total_value) * -1 }); 
            totalExpenses += Number(d.total_value); 
        });
        reportRows[3].value = totalExpenses * -1;
        
        reportRows.push({ type: 'S', code: '5', desc: '(=) RESULTADO LÍQUIDO DO EXERCÍCIO', value: (totalRevenue - totalTaxes - totalExpenses) });
        
        res.json(reportRows);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// =================================================================================
// ROTA DE IMPORTAÇÃO DE DRE — SUPORTA XLSX E CSV
// =================================================================================
app.post('/api/import/dre', authenticateToken, upload.single('file'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        if (!req.file) throw new Error("Nenhum arquivo enviado.");

        const ext = req.file.originalname.split('.').pop().toLowerCase();
        let data;

        if (ext === 'csv') {
            data = parseDreCSVToMatrix(req.file.buffer);
        } else {
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        }

        const monthsMap = { 3:'01',4:'02',5:'03',6:'04',7:'05',8:'06',9:'07',10:'08',11:'09',12:'10',13:'11',14:'12' };
        const yearMatch = req.file.originalname.match(/20\d{2}/);
        const year = yearMatch ? yearMatch[0] : new Date().getFullYear();

        const categoriesMap = {};
        const catsToCreate =[
            { name: 'Receita Bruta (Importada)', type: 'REVENUE' },
            { name: 'Impostos e Deduções',        type: 'EXPENSE' },
            { name: 'Custos Variáveis',            type: 'EXPENSE' },
            { name: 'Despesas Operacionais',       type: 'EXPENSE' }
        ];

        for (const cat of catsToCreate) {
            await conn.execute('INSERT IGNORE INTO categories (name, type) VALUES (?, ?)',[cat.name, cat.type]);
            const [rows] = await conn.execute('SELECT id FROM categories WHERE name = ?', [cat.name]);
            categoriesMap[cat.name] = rows[0].id;
        }

        await conn.beginTransaction();

        let count = 0;
        const monthData = {};

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[0]) continue;

            const accountName = row[0].toString().toLowerCase();

            let catId = null;
            let type = null;
            let dbColumn = null;

            if (accountName.includes('receita bruta') || accountName.includes('faturamento')) {
                catId = categoriesMap['Receita Bruta (Importada)']; type = 'REVENUE'; dbColumn = 'revenue_product';
            } else if (accountName.includes('impostos') || accountName.includes('deduções') || accountName.includes('deducoes')) {
                catId = categoriesMap['Impostos e Deduções'];        type = 'EXPENSE'; dbColumn = 'tax_icms';
            } else if (accountName.includes('custos variáveis') || accountName.includes('custos variaveis') || accountName.includes('cmv') || accountName.includes('csv')) {
                catId = categoriesMap['Custos Variáveis'];           type = 'EXPENSE'; dbColumn = 'purchases_total';
            } else if (accountName.includes('despesas operacionais')) {
                catId = categoriesMap['Despesas Operacionais'];      type = 'EXPENSE'; dbColumn = 'expenses_total';
            }

            if (!catId) continue; 

            for (let colIndex = 3; colIndex <= 14; colIndex++) {
                const month = monthsMap[colIndex];
                if (!month) continue;

                const periodStart = `${year}-${month}-01`;
                const value = parseDreValue(row[colIndex]);
                if (value === 0) continue;

                if (!monthData[periodStart]) {
                    monthData[periodStart] = { revenue: 0, taxes: 0, purchases: 0, expenses: 0, details:[] };
                }

                if (dbColumn === 'revenue_product')  monthData[periodStart].revenue   += value;
                if (dbColumn === 'tax_icms')          monthData[periodStart].taxes     += value;
                if (dbColumn === 'purchases_total')   monthData[periodStart].purchases += value;
                if (dbColumn === 'expenses_total')    monthData[periodStart].expenses  += value;

                monthData[periodStart].details.push({
                    category_id: catId,
                    type,
                    amount: value,
                    description: row[0].toString()
                });
            }
        }

        for (const[periodStart, mData] of Object.entries(monthData)) {
            const [existing] = await conn.execute(
                'SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?',[req.body.companyId, periodStart]
            );
            
            let entryId;
            const[y, m] = periodStart.split('-');
            const lastDay = new Date(y, m, 0).getDate();
            const periodEnd = `${y}-${m}-${lastDay}`;

            if (existing.length > 0) {
                entryId = existing[0].id;
                await conn.execute(`
                    UPDATE monthly_entries SET 
                    revenue_product=?, tax_icms=?, purchases_total=?, expenses_total=?, notes=? 
                    WHERE id=?
                `,[mData.revenue, mData.taxes, mData.purchases, mData.expenses, `Importado Auto ${year}`, entryId]);
                
                await conn.execute('DELETE FROM entry_details WHERE entry_id = ?', [entryId]);
            } else {
                const [ins] = await conn.execute(`
                    INSERT INTO monthly_entries (
                        company_id, period_start, period_end, revenue_product, 
                        tax_icms, purchases_total, expenses_total, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,[req.body.companyId, periodStart, periodEnd, mData.revenue, mData.taxes, mData.purchases, mData.expenses, `Importado Auto ${year}`]);
                
                entryId = ins.insertId;
            }

            for (const detail of mData.details) {
                await conn.execute(`
                    INSERT INTO entry_details (entry_id, category_id, type, amount, description) 
                    VALUES (?, ?, ?, ?, ?)
                `,[entryId, detail.category_id, detail.type, detail.amount, detail.description]);
            }
            count++;
        }

        await conn.commit();
        await logAction(req.user.id, req.user.email, 'IMPORT_DRE', `Importou DRE ${ext.toUpperCase()} ${year} — empresa ${req.body.companyId} — ${count} meses`);
        res.json({ success: true, message: `DRE ${ext.toUpperCase()} processado com sucesso! ${count} meses gerados.` });

    } catch (error) {
        await conn.rollback();
        console.error('[IMPORT_DRE]', error);
        res.status(500).json({ error: "Erro na importação: " + error.message });
    } finally {
        conn.release();
    }
});

// =================================================================================
// ROTA DE IMPORTAÇÃO DE BALANCETE CONTÁBIL (CSV)
// =================================================================================
app.post('/api/import/balancete', authenticateToken, upload.single('file'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        if (!req.file) throw new Error("Nenhum arquivo enviado.");
        
        const companyId = req.body.companyId;
        if (!companyId) throw new Error("ID da empresa não informado.");

        const text = req.file.buffer.toString('latin1');

        let period = req.body.period;
        if (!period || period.trim() === '') period = detectPeriodFromCSV(text);
        if (!period) throw new Error("Período não encontrado. Informe o mês ou verifique se o arquivo contém 'Emissão: DD/MM/AAAA' no rodapé.");

        const periodStart = `${period}-01`;
        const[y, m] = period.split('-');
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        const periodEnd = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;

        const allAccounts  = parseBalanceteRows(text);
        if (allAccounts.length === 0) throw new Error("Nenhuma conta reconhecida. Formato esperado: Id;Classificação;C;Descrição;Entrada;Saída;Saldo");
        
        const leafAccounts = findLeafAccounts(allAccounts);

        const CAT_DEFS = {
            revenue_product:     { name: 'Venda de Produtos (Balancete)',      type: 'REVENUE' },
            revenue_service:     { name: 'Prestação de Serviços (Balancete)',  type: 'REVENUE' },
            revenue_resale:      { name: 'Revenda de Mercadorias (Balancete)', type: 'REVENUE' },
            revenue_rent:        { name: 'Receita de Aluguel (Balancete)',     type: 'REVENUE' },
            revenue_other:       { name: 'Outras Receitas (Balancete)',        type: 'REVENUE' },
            tax_icms:            { name: 'ICMS / DAS Simples (Balancete)',     type: 'EXPENSE' },
            tax_pis:             { name: 'PIS (Balancete)',                    type: 'EXPENSE' },
            tax_cofins:          { name: 'COFINS (Balancete)',                 type: 'EXPENSE' },
            tax_iss:             { name: 'ISS (Balancete)',                    type: 'EXPENSE' },
            tax_csll:            { name: 'CSLL (Balancete)',                   type: 'EXPENSE' },
            tax_irpj:            { name: 'IRPJ (Balancete)',                   type: 'EXPENSE' },
            tax_difal:           { name: 'DIFAL (Balancete)',                  type: 'EXPENSE' },
            tax_additional_irpj: { name: 'IRPJ Adicional (Balancete)',         type: 'EXPENSE' },
            purchases_total:     { name: 'CPV / Compras / Fretes (Balancete)', type: 'EXPENSE' },
            expenses_total:      { name: 'Despesas Operacionais (Balancete)',  type: 'EXPENSE' },
        };

        const categoriesMap = {};
        for (const[col, cat] of Object.entries(CAT_DEFS)) {
            await conn.execute('INSERT IGNORE INTO categories (name, type) VALUES (?, ?)', [cat.name, cat.type]);
            const[rows] = await conn.execute('SELECT id FROM categories WHERE name = ?', [cat.name]);
            if (rows.length > 0) categoriesMap[col] = rows[0].id;
        }

        const columnTotals = {};
        const detailRows   =[];

        for (const account of leafAccounts) {
            const mapped = mapAccountToColumns(account);
            if (!mapped) continue;
            
            const { column, value, entryType, description } = mapped;
            columnTotals[column] = (columnTotals[column] || 0) + value;
            
            const catId = categoriesMap[column];
            if (catId) {
                detailRows.push({ 
                    category_id: catId, 
                    type: entryType, 
                    amount: value, 
                    description: description.substring(0, 255) 
                });
            }
        }

        if (Object.keys(columnTotals).length === 0) throw new Error("Nenhum valor mapeado. Verifique se há contas nos grupos 1–4.");

        await conn.beginTransaction();

        const [existing] = await conn.execute(
            'SELECT id FROM monthly_entries WHERE company_id = ? AND period_start = ?',[companyId, periodStart]
        );
        
        const notes = `Balancete CSV importado — Competência ${period}`;
        
        const entryData =[
            amountOrZero(columnTotals.revenue_resale), amountOrZero(columnTotals.revenue_product), 
            amountOrZero(columnTotals.revenue_service), amountOrZero(columnTotals.revenue_rent), 
            amountOrZero(columnTotals.revenue_other), amountOrZero(columnTotals.tax_icms), 
            amountOrZero(columnTotals.tax_difal), amountOrZero(columnTotals.tax_iss), 
            amountOrZero(columnTotals.tax_pis), amountOrZero(columnTotals.tax_cofins),
            amountOrZero(columnTotals.tax_csll), amountOrZero(columnTotals.tax_irpj), 
            amountOrZero(columnTotals.tax_additional_irpj), amountOrZero(columnTotals.tax_fust), 
            amountOrZero(columnTotals.tax_funtell), amountOrZero(columnTotals.purchases_total), 
            amountOrZero(columnTotals.expenses_total)
        ];

        let entryId;
        if (existing.length > 0) {
            entryId = existing[0].id;
            await conn.execute(`
                UPDATE monthly_entries SET 
                revenue_resale=?, revenue_product=?, revenue_service=?, revenue_rent=?, revenue_other=?,
                tax_icms=?, tax_difal=?, tax_iss=?, tax_pis=?, tax_cofins=?,
                tax_csll=?, tax_irpj=?, tax_additional_irpj=?, tax_fust=?, tax_funtell=?,
                purchases_total=?, expenses_total=?, notes=? 
                WHERE id=?
            `,[...entryData, notes, entryId]);
            
            await conn.execute('DELETE FROM entry_details WHERE entry_id = ?', [entryId]);
        } else {
            const [ins] = await conn.execute(`
                INSERT INTO monthly_entries (
                    company_id, period_start, period_end, revenue_resale, revenue_product, 
                    revenue_service, revenue_rent, revenue_other, tax_icms, tax_difal, tax_iss, 
                    tax_pis, tax_cofins, tax_csll, tax_irpj, tax_additional_irpj, tax_fust, tax_funtell, 
                    purchases_total, expenses_total, notes
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `,[companyId, periodStart, periodEnd, ...entryData, notes]);
            
            entryId = ins.insertId;
        }

        for (const d of detailRows) {
            await conn.execute(`
                INSERT INTO entry_details (entry_id, category_id, type, amount, description) 
                VALUES (?, ?, ?, ?, ?)
            `,[entryId, d.category_id, d.type, d.amount, d.description]);
        }

        await conn.commit();

        const totalReceitas = Object.entries(columnTotals).filter(([k]) => k.startsWith('revenue_')).reduce((a,[,v]) => a+v, 0);
        const totalImpostos = Object.entries(columnTotals).filter(([k]) => k.startsWith('tax_')).reduce((a,[,v]) => a+v, 0);
        const totalDespesas = amountOrZero(columnTotals.purchases_total) + amountOrZero(columnTotals.expenses_total);

        await logAction(req.user.id, req.user.email, 'IMPORT_BALANCETE', `Importou balancete ${period} — empresa ${companyId} — ${detailRows.length} contas`);
        
        res.json({ 
            success: true, 
            message: `Balancete de ${period} importado! ${detailRows.length} contas processadas.`, 
            period, 
            detected_period: detectPeriodFromCSV(text), 
            summary: { 
                contasProcessadas: leafAccounts.length, 
                totalReceitas, 
                totalImpostos, 
                totalDespesas, 
                resultado: totalReceitas - totalImpostos - totalDespesas 
            } 
        });

    } catch (error) {
        await conn.rollback();
        console.error('[IMPORT_BALANCETE]', error.message);
        res.status(400).json({ error: error.message });
    } finally {
        conn.release();
    }
});

// =================================================================================
// ROTA DE RANKING DE PARCEIROS
// =================================================================================
app.get('/api/reports/partners-ranking', async (req, res) => {
    try {
        const { companyId, startDate, endDate } = req.query;
        
        const[clients] = await pool.execute(`
            SELECT p.name, SUM(ed.amount) as value 
            FROM entry_details ed 
            JOIN partners p ON ed.partner_id=p.id 
            JOIN monthly_entries me ON ed.entry_id=me.id 
            WHERE me.company_id=? AND me.period_start>=? AND me.period_start<=? AND ed.type='REVENUE' 
            GROUP BY p.name 
            ORDER BY value DESC LIMIT 5
        `,[companyId, startDate, endDate]);
        
        const [suppliers] = await pool.execute(`
            SELECT p.name, SUM(ed.amount) as value 
            FROM entry_details ed 
            JOIN partners p ON ed.partner_id=p.id 
            JOIN monthly_entries me ON ed.entry_id=me.id 
            WHERE me.company_id=? AND me.period_start>=? AND me.period_start<=? AND ed.type='EXPENSE' 
            GROUP BY p.name 
            ORDER BY value DESC LIMIT 5
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