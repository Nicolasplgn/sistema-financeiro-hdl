require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'financeiro',
  multipleStatements: true // Permite rodar vários comandos de uma vez
});

const run = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('🔌 Conectado ao banco!');

    console.log('⚠️  Apagando tabelas antigas...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DROP TABLE IF EXISTS monthly_entry_totals'); // View
    await conn.query('DROP TABLE IF EXISTS monthly_entries');
    await conn.query('DROP TABLE IF EXISTS audit_logs');
    await conn.query('DROP TABLE IF EXISTS users');
    await conn.query('DROP TABLE IF EXISTS companies');
    await conn.query('DROP TABLE IF EXISTS company_groups');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('🔨 Criando nova estrutura...');

    // 1. Grupos
    await conn.query(`
        CREATE TABLE company_groups (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    // 2. Empresas
    await conn.query(`
        CREATE TABLE companies (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            trade_name VARCHAR(150),
            tax_id VARCHAR(30) UNIQUE,
            group_id BIGINT UNSIGNED,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_companies_group FOREIGN KEY (group_id) REFERENCES company_groups(id)
        )
    `);

    // 3. Usuários (Com full_name e password_hash)
    await conn.query(`
        CREATE TABLE users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            company_id BIGINT UNSIGNED,
            group_id BIGINT UNSIGNED,
            full_name VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('ADMIN','MANAGER','CLIENT') NOT NULL DEFAULT 'MANAGER',
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id),
            CONSTRAINT fk_users_group FOREIGN KEY (group_id) REFERENCES company_groups(id)
        )
    `);

    // 4. Auditoria
    await conn.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            user_name VARCHAR(100),
            action VARCHAR(50),
            details TEXT,
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 5. Lançamentos Mensais
    await conn.query(`
        CREATE TABLE monthly_entries (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            company_id BIGINT UNSIGNED NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            revenue_resale DECIMAL(15,2) NOT NULL DEFAULT 0,
            revenue_product DECIMAL(15,2) NOT NULL DEFAULT 0,
            revenue_service DECIMAL(15,2) NOT NULL DEFAULT 0,
            revenue_rent DECIMAL(15,2) NOT NULL DEFAULT 0,
            revenue_other DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_icms DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_difal DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_iss DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_fust DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_funtell DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_pis DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_cofins DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_csll DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_irpj DECIMAL(15,2) NOT NULL DEFAULT 0,
            tax_additional_irpj DECIMAL(15,2) NOT NULL DEFAULT 0,
            purchases_total DECIMAL(15,2),
            expenses_total DECIMAL(15,2),
            notes TEXT,
            created_by BIGINT UNSIGNED,
            updated_by BIGINT UNSIGNED,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_entries_company FOREIGN KEY (company_id) REFERENCES companies(id),
            CONSTRAINT fk_entries_created_by FOREIGN KEY (created_by) REFERENCES users(id),
            CONSTRAINT fk_entries_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
            CONSTRAINT uc_company_period UNIQUE (company_id, period_start, period_end)
        )
    `);

    // 6. View (Opcional mas útil)
    await conn.query(`
        CREATE OR REPLACE VIEW monthly_entry_totals AS
        SELECT
            me.id, me.company_id, me.period_start, me.period_end,
            (me.revenue_resale + me.revenue_product + me.revenue_service + me.revenue_rent + me.revenue_other) AS total_revenue,
            (me.tax_icms + me.tax_difal + me.tax_iss + me.tax_fust + me.tax_funtell + me.tax_pis + me.tax_cofins + me.tax_csll + me.tax_irpj + me.tax_additional_irpj) AS total_taxes,
            me.purchases_total, me.expenses_total
        FROM monthly_entries me
    `);

    console.log('🌱 Inserindo dados padrão...');
    
    // Inserir Empresa Padrão
    await conn.query(`
        INSERT INTO companies (name, trade_name, tax_id) 
        VALUES ('MGP TELECOM LTDA', 'MGP Telecom', '00.000.000/0001-00')
    `);

    // Inserir Usuário Admin
    // ATENÇÃO: role 'ADMIN' maiúsculo conforme sua definição do banco
    await conn.query(`
        INSERT INTO users (full_name, email, password_hash, role, is_active) 
        VALUES ('Admin HDL', 'admin@hdl.com', '123456', 'ADMIN', 1)
    `);

    console.log('✅ Banco de dados atualizado com sucesso!');
    process.exit();

  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
};

run();