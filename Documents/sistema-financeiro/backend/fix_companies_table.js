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
    console.log('🔌 Conectado ao banco de dados!');

    // 1. Apaga a tabela antiga (para garantir que recrie com a estrutura certa)
    // CUIDADO: Isso apaga as empresas cadastradas. Como é dev, tudo bem.
    console.log('🗑️  Recriando estrutura da tabela companies...');
    await conn.query('DROP TABLE IF EXISTS companies');

    // 2. Cria a tabela com TODAS as colunas que o server.js pede
    await conn.query(`
      CREATE TABLE companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        trade_name VARCHAR(255),
        tax_id VARCHAR(50),      -- CNPJ
        group_id INT,            -- ID do Grupo
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Insere a empresa padrão de novo
    console.log('🏢 Inserindo empresa padrão...');
    await conn.query(`
      INSERT INTO companies (id, name, trade_name, tax_id) 
      VALUES (1, 'MGP TELECOM LTDA', 'MGP Telecom', '00.000.000/0001-00')
    `);

    // 4. Garante que o usuário admin tenha acesso a todas ou null
    // (Opcional, só para garantir integridade)
    await conn.query(`UPDATE users SET company_id = NULL WHERE role = 'admin'`);

    console.log('✅ Tabela de empresas corrigida com sucesso!');
    process.exit();
  } catch (err) {
    console.error('❌ Erro ao corrigir tabela:', err);
    process.exit(1);
  }
};

run();