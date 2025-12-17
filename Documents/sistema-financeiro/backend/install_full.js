require('dotenv').config();
const mysql = require('mysql2/promise');

const run = async () => {
  let connection;
  try {
    // 1. Conexão INICIAL (Sem banco de dados, apenas para criar)
    console.log('🔌 Conectando ao MySQL (Root)...');
    connection = await mysql.createConnection({
      host: '127.0.0.1', // IP Fixo para evitar ETIMEDOUT
      user: 'root',
      password: '',
      port: 3306
    });

    // 2. Criar o Banco
    console.log('🔨 Criando banco de dados "financeiro"...');
    await connection.query('DROP DATABASE IF EXISTS financeiro');
    await connection.query('CREATE DATABASE financeiro');
    await connection.query('USE financeiro'); // Seleciona o banco criado

    // 3. Criar Tabelas
    console.log(' Criando tabelas...');
    
    // Grupos
    await connection.query(`
        CREATE TABLE company_groups (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    // Empresas
    await connection.query(`
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

    // Usuários
    await connection.query(`
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

    // Auditoria
    await connection.query(`
        CREATE TABLE audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            user_name VARCHAR(100),
            action VARCHAR(50),
            details TEXT,
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Lançamentos
    await connection.query(`
        CREATE TABLE monthly_entries (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            company_id BIGINT UNSIGNED NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            revenue_resale DECIMAL(15,2) DEFAULT 0,
            revenue_product DECIMAL(15,2) DEFAULT 0,
            revenue_service DECIMAL(15,2) DEFAULT 0,
            revenue_rent DECIMAL(15,2) DEFAULT 0,
            revenue_other DECIMAL(15,2) DEFAULT 0,
            tax_icms DECIMAL(15,2) DEFAULT 0,
            tax_difal DECIMAL(15,2) DEFAULT 0,
            tax_iss DECIMAL(15,2) DEFAULT 0,
            tax_fust DECIMAL(15,2) DEFAULT 0,
            tax_funtell DECIMAL(15,2) DEFAULT 0,
            tax_pis DECIMAL(15,2) DEFAULT 0,
            tax_cofins DECIMAL(15,2) DEFAULT 0,
            tax_csll DECIMAL(15,2) DEFAULT 0,
            tax_irpj DECIMAL(15,2) DEFAULT 0,
            tax_additional_irpj DECIMAL(15,2) DEFAULT 0,
            purchases_total DECIMAL(15,2),
            expenses_total DECIMAL(15,2),
            notes TEXT,
            created_by BIGINT UNSIGNED,
            updated_by BIGINT UNSIGNED,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_entries_company FOREIGN KEY (company_id) REFERENCES companies(id),
            CONSTRAINT uc_company_period UNIQUE (company_id, period_start, period_end)
        )
    `);

    // 4. Inserir Dados Básicos
    console.log('🌱 Inserindo empresa e admin...');
    await connection.query(`
        INSERT INTO companies (name, trade_name, tax_id) 
        VALUES ('MGP TELECOM LTDA', 'MGP Telecom', '00.000.000/0001-00')
    `);

    await connection.query(`
        INSERT INTO users (full_name, email, password_hash, role, is_active) 
        VALUES ('Admin HDL', 'admin@hdl.com', '123456', 'ADMIN', 1)
    `);

    // 5. Inserir Dados Históricos (Jan - Nov)
    console.log('📈 Gerando histórico financeiro (Jan-Nov)...');
    
    // Pega IDs recém criados
    const [companies] = await connection.query("SELECT id FROM companies LIMIT 1");
    const [users] = await connection.query("SELECT id FROM users LIMIT 1");
    const companyId = companies[0].id;
    const userId = users[0].id;

    const months = [
      '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', 
      '2025-05-01', '2025-06-01', '2025-07-01', '2025-08-01',
      '2025-09-01', '2025-10-01', '2025-11-01' 
      // Dezembro fica vazio propositalmente
    ];

    for (const startDate of months) {
      const dateObj = new Date(startDate);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      const factor = 1 + (Math.random() * 0.2 - 0.1); // Variação
      
      const revService = 120000 * factor;
      const revProduct = 35000 * factor;
      const icms = revProduct * 0.18;
      const iss = revService * 0.05;
      const pis = (revService + revProduct) * 0.0065;
      const cofins = (revService + revProduct) * 0.03;
      const irpj = (revService + revProduct) * 0.048;
      const csll = (revService + revProduct) * 0.0288;
      const purchases = 25000 * factor;
      const expenses = 40000 * factor;

      await connection.query(`
        INSERT INTO monthly_entries (
          company_id, period_start, period_end,
          revenue_service, revenue_product,
          tax_icms, tax_iss, tax_pis, tax_cofins, tax_irpj, tax_csll,
          purchases_total, expenses_total,
          created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        companyId, startDate, endDate,
        revService, revProduct, icms, iss, pis, cofins, irpj, csll,
        purchases, expenses, userId, userId
      ]);
    }

    console.log('✅ INSTALAÇÃO COMPLETA! Banco recriado e populado.');
    process.exit();

  } catch (err) {
    console.error('❌ Erro Fatal:', err);
    process.exit(1);
  }
};

run();