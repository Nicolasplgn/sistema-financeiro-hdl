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

    // 1. Limpa tudo antes para garantir que não duplique
    console.log('🧹 Limpando lançamentos antigos...');
    await conn.query('DELETE FROM monthly_entries');

    // 2. Pega ID da empresa
    const [companies] = await conn.query("SELECT id FROM companies LIMIT 1");
    const [users] = await conn.query("SELECT id FROM users LIMIT 1");

    if (!companies.length) {
      console.log('❌ Nenhuma empresa cadastrada.');
      process.exit();
    }

    const companyId = companies[0].id;
    const userId = users.length ? users[0].id : null;

    console.log(`🌱 Gerando histórico de JAN a NOV...`);

    // ARRAY APENAS ATÉ NOVEMBRO (Mês 11)
    const months = [
      '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', 
      '2025-05-01', '2025-06-01', '2025-07-01', '2025-08-01',
      '2025-09-01', '2025-10-01', '2025-11-01' 
      // Note que 2025-12-01 NÃO está aqui propositalmente
    ];

    for (const startDate of months) {
      const dateObj = new Date(startDate);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      // Valores variáveis para o gráfico ficar bonito (sobe e desce)
      const factor = 1 + (Math.random() * 0.2 - 0.1); // Variação de 10%
      
      const revService = 120000 * factor;
      const revProduct = 35000 * factor;
      
      // Impostos calculados
      const icms = revProduct * 0.18;
      const iss = revService * 0.05;
      const pis = (revService + revProduct) * 0.0065;
      const cofins = (revService + revProduct) * 0.03;
      const irpj = (revService + revProduct) * 0.048;
      const csll = (revService + revProduct) * 0.0288;

      const purchases = 25000 * factor;
      const expenses = 40000 * factor;

      await conn.query(`
        INSERT INTO monthly_entries (
          company_id, period_start, period_end,
          revenue_service, revenue_product,
          tax_icms, tax_iss, tax_pis, tax_cofins, tax_irpj, tax_csll,
          purchases_total, expenses_total,
          created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        companyId, startDate, endDate,
        revService, revProduct,
        icms, iss, pis, cofins, irpj, csll,
        purchases, expenses,
        userId, userId
      ]);
    }

    console.log('✅ Histórico criado com sucesso (Dezembro está vazio)!');
    process.exit();

  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
};

run();