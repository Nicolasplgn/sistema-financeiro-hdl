require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Se tiver senha no .env, o script pega. Se for XAMPP, é vazio.
  database: 'financeiro',
});

const run = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conectado ao banco!');

    // Criar tabela de usuários
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role ENUM('admin', 'manager', 'client') DEFAULT 'client',
        company_id INT,
        FOREIGN KEY (company_id) REFERENCES companies(id)
      )
    `);

    // Criar Admin padrão
    await conn.query(`
        INSERT IGNORE INTO users (email, password, name, role, company_id) VALUES 
        ('admin@hdl.com', '123456', 'Admin HDL', 'admin', NULL)
    `);

    console.log('✅ Tabela Users criada e Admin inserido!');
    process.exit();
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
};

run();