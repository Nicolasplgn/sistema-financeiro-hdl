require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const run = async () => {
  try {
    // 1. Conectar ao MySQL sem especificar o banco de dados
    console.log('Conectando ao MySQL...');
    const connection = await mysql.createConnection(dbConfig);

    // 2. Criar o Banco de Dados se não existir
    console.log('Criando banco de dados "financeiro"...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS financeiro`);
    await connection.end(); // Fecha essa conexão inicial

    // 3. Conectar agora ESPECIFICAMENTE no banco 'financeiro'
    const pool = mysql.createPool({
      ...dbConfig,
      database: 'financeiro',
    });

    const conn = await pool.getConnection();
    console.log('Conectado ao banco "financeiro"!');

    // Criar Tabela de Usuários
    await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255) UNIQUE,
          password VARCHAR(255), -- Em produção usariamos hash
          role ENUM('admin', 'manager', 'client') DEFAULT 'client',
          company_id INT, -- Se for NULL, é admin global ou vê todas
          FOREIGN KEY (company_id) REFERENCES companies(id)
        )
      `);
  
      // Inserir Usuários de Teste
      console.log('Inserindo usuários...');
      await conn.query(`
          INSERT IGNORE INTO users (email, password, name, role, company_id) VALUES 
          ('admin@hdl.com', '123456', 'Administrador HDL', 'admin', NULL),
          ('cliente@empresa.com', '123456', 'Cliente MGP', 'client', 1)
      `);


    // 4. Criar Tabela de Empresas
    await conn.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);

    // 5. Criar Tabela de Lançamentos
    await conn.query(`
      CREATE TABLE IF NOT EXISTS monthly_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
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
        
        purchases_total DECIMAL(15,2) DEFAULT 0,
        expenses_total DECIMAL(15,2) DEFAULT 0,
        
        notes TEXT,
        created_by INT,
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_entry (company_id, period_start)
      )
    `);

    // 6. Inserir Dados Fictícios
    console.log('Inserindo dados de exemplo...');
    
    // Empresa Teste
    await conn.query(`INSERT IGNORE INTO companies (id, name) VALUES (1, 'MGP TELECOM LTDA')`);

    // Lançamentos Jan a Mar (Exemplo)
    const entries = [
        ['2025-01-01', 1109556.69, 60202.96, 9389.74, 43267.84, 220.39, 124258.50, 50000.00],
        ['2025-02-01', 1074338.73, 56443.86, 9872.24, 45489.37, 260.29, 110000.00, 45000.00],
        ['2025-03-01', 1083870.82, 57171.28, 8971.59, 41341.26, 97.62, 115000.00, 48000.00],
    ];

    for (const ent of entries) {
        await conn.query(`
            INSERT INTO monthly_entries (
                company_id, period_start, period_end, 
                revenue_service, tax_icms, tax_pis, tax_cofins, tax_iss,
                purchases_total, expenses_total
            ) VALUES (1, ?, LAST_DAY(?), ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE revenue_service = VALUES(revenue_service)
        `, [ent[0], ent[0], ent[1], ent[2], ent[3], ent[4], ent[5], ent[6], ent[7]]);
    }

    console.log('✅ Tudo pronto! Banco criado e populado.');
    process.exit();
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
};

run();