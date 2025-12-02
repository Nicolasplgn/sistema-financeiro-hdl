require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'financeiro',
});

const run = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('🔌 Conectado ao banco!');

    // 1. DESLIGA a proteção de chave estrangeira
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Apaga a tabela antiga
    console.log('🗑️  Apagando tabela antiga...');
    await conn.query('DROP TABLE IF EXISTS companies');

    // 3. Cria a tabela nova com a estrutura COMPLETA (trade_name, tax_id, etc)
    console.log('🔨 Criando nova tabela...');
    await conn.query(`
      CREATE TABLE companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        trade_name VARCHAR(255),
        tax_id VARCHAR(50),
        group_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Insere a empresa MGP TELECOM (Forçando ID 1 para não quebrar vínculos)
    console.log('🏢 Cadastrando MGP Telecom...');
    await conn.query(`
      INSERT INTO companies (id, name, trade_name, tax_id) 
      VALUES (1, 'MGP TELECOM LTDA', 'MGP Telecom', '00.000.000/0001-00')
    `);

    // 5. LIGA a proteção de volta
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✅ SUCESSO! Estrutura corrigida.');
    process.exit();
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
};

run();