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

    // Apaga TODOS os lançamentos financeiros
    await conn.query('DELETE FROM monthly_entries');
    
    // Zera o contador de logs de auditoria (opcional, para limpar histórico visual)
    // await conn.query('DELETE FROM audit_logs'); 

    console.log('✅ Todos os lançamentos financeiros foram apagados!');
    console.log('Agora o sistema está zerado para uso real.');
    
    process.exit();
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
};

run();