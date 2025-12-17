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

    // 1. Pegar o ID da empresa e do usuário
    const [companies] = await conn.query("SELECT id FROM companies LIMIT 1");
    const [users] = await conn.query("SELECT id FROM users LIMIT 1");

    if (companies.length === 0 || users.length === 0) {
      console.log('❌ Nenhuma empresa ou usuário encontrado. Rode o recreate_db.js primeiro.');
      process.exit();
    }

    const companyId = companies[0].id;
    const userId = users[0].id;

    console.log(`🌱 Inserindo dados para a empresa ID: ${companyId}...`);

    // 2. Gerar dados para todos os meses de 2025
    const months = [
      '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', 
      '2025-05-01', '2025-06-01', '2025-07-01', '2025-08-01',
      '2025-09-01', '2025-10-01', '2025-11-01', '2025-12-01'
    ];

    for (const startDate of months) {
      // Calcular último dia do mês
      const dateObj = new Date(startDate);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      // Valores aleatórios realistas
      const revService = Math.floor(Math.random() * (150000 - 100000) + 100000); // 100k a 150k
      const revProduct = Math.floor(Math.random() * (50000 - 20000) + 20000);    // 20k a 50k
      
      // Impostos aproximados
      const icms = revProduct * 0.18;
      const iss = revService * 0.05;
      const pis = (revService + revProduct) * 0.0065;
      const cofins = (revService + revProduct) * 0.03;
      const irpj = (revService + revProduct) * 0.048; // Presumido aprox
      const csll = (revService + revProduct) * 0.0288;

      const purchases = Math.floor(Math.random() * 40000) + 10000;
      const expenses = Math.floor(Math.random() * 30000) + 15000;

      await conn.query(`
        INSERT INTO monthly_entries (
          company_id, period_start, period_end,
          revenue_service, revenue_product,
          tax_icms, tax_iss, tax_pis, tax_cofins, tax_irpj, tax_csll,
          purchases_total, expenses_total,
          created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE revenue_service = VALUES(revenue_service)
      `, [
        companyId, startDate, endDate,
        revService, revProduct,
        icms, iss, pis, cofins, irpj, csll,
        purchases, expenses,
        userId, userId
      ]);
    }

    console.log('✅ Dados financeiros inseridos com sucesso!');
    process.exit();

  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
};

run();