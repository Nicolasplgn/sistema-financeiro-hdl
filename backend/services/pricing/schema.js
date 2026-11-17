'use strict';

/**
 * Estrutura de banco do módulo de precificação.
 *
 * Só ACRESCENTA: cria tabelas que faltam e colunas que faltam. Nada é apagado
 * nem alterado, então bancos já em uso continuam com os dados que tinham.
 * As colunas antigas de taxa digitada (fixed_expenses_rate_percent,
 * payroll_rate_percent, administrative_cost_percent, freight_value,
 * ipi_out_percent, fixed_cost_allocation_percent) permanecem na tabela, mas o
 * cálculo não as usa mais: nas planilhas esses percentuais são derivados do
 * rateio (custo ÷ meta de venda), não digitados.
 */

const TABLES = [
    `CREATE TABLE IF NOT EXISTS fixed_expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(150) NOT NULL,
        amount DECIMAL(15,2) DEFAULT 0.00,
        category VARCHAR(50) DEFAULT 'GERAL',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS payroll_expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        employee_name VARCHAR(150) NOT NULL,
        role VARCHAR(100),
        total_cost DECIMAL(15,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prolabore_expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        partner_name VARCHAR(150) NOT NULL,
        total_cost DECIMAL(15,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sales_channels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED,
        name VARCHAR(255),
        ncm VARCHAR(20),
        price_national DECIMAL(15,4) DEFAULT 0,
        price_imported DECIMAL(15,4) DEFAULT 0,
        ipi_percent DECIMAL(5,2) DEFAULT 0,
        is_national BOOLEAN DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id BIGINT UNSIGNED,
        name VARCHAR(255),
        sku VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS product_boms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT,
        material_id INT,
        quantity DECIMAL(10,4)
    )`,
    // Cabeçalho da FICHA TECNICA, IR/CSLL da aba TRIBUTOS, desconto por fora do
    // MARKUP, encargos da FOLHA e a chave "Rateio Total?" do PAINEL.
    `CREATE TABLE IF NOT EXISTS pricing_settings (
        company_id BIGINT UNSIGNED PRIMARY KEY,
        pis_credit_percent DECIMAL(7,4) NOT NULL DEFAULT 1.65,
        cofins_credit_percent DECIMAL(7,4) NOT NULL DEFAULT 7.65,
        icms_credit_imported_percent DECIMAL(7,4) NOT NULL DEFAULT 4,
        icms_credit_national_percent DECIMAL(7,4) NOT NULL DEFAULT 12,
        ir_percent DECIMAL(7,4) NOT NULL DEFAULT 15,
        csll_percent DECIMAL(7,4) NOT NULL DEFAULT 9,
        outside_discount_percent DECIMAL(7,4) NOT NULL DEFAULT 5,
        attendance_bonus_percent DECIMAL(7,4) NOT NULL DEFAULT 5,
        fgts_percent DECIMAL(7,4) NOT NULL DEFAULT 8,
        fgts_fine_percent DECIMAL(7,4) NOT NULL DEFAULT 40,
        rateio_total TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    // "Faixa do IPI (1 ou 2)" de cada aba MARKUP <canal> <modelo>.
    `CREATE TABLE IF NOT EXISTS product_channel_settings (
        product_id INT NOT NULL,
        channel_id INT NOT NULL,
        ipi_tier TINYINT NOT NULL DEFAULT 2,
        PRIMARY KEY (product_id, channel_id)
    )`,
];

const COLUMNS = {
    sales_channels: [
        // Alíquotas e despesas de venda (linhas do PAINEL)
        ['icms_out_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['difal_out_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['pis_out_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['cofins_out_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['ir_csll_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['commission_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['marketing_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['freight_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['default_rate_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['financial_cost_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['cash_discount_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['profit_margin_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['ipi_tier1_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['ipi_tier2_percent', 'DECIMAL(5,2) DEFAULT 0'],
        // Rateio da estrutura (linhas APROPIAÇÃO e META DE VENDA do PAINEL)
        ['sales_target', 'DECIMAL(15,2) DEFAULT 0'],
        ['fixed_cost_share_percent', 'DECIMAL(7,4) DEFAULT 0'],
        ['prolabore_share_percent', 'DECIMAL(7,4) DEFAULT 0'],
        ['payroll_share_percent', 'DECIMAL(7,4) DEFAULT 0'],
        ['sort_order', 'INT DEFAULT 0'],
    ],
    products: [
        ['sku', 'VARCHAR(100)'],
        // "Modelo ... por ordem de venda" e "Rateio das Despesas Fixas" do PAINEL
        ['sort_order', 'INT DEFAULT 0'],
        ['allocation_percent', 'DECIMAL(7,4) DEFAULT 0'],
    ],
    materials: [
        ['ncm', 'VARCHAR(20)'],
        ['price_national', 'DECIMAL(15,4) DEFAULT 0'],
        ['price_imported', 'DECIMAL(15,4) DEFAULT 0'],
        ['ipi_percent', 'DECIMAL(5,2) DEFAULT 0'],
        ['is_national', 'BOOLEAN DEFAULT 1'],
    ],
    // Colunas da planilha FOLHA. base_salary NULL = registro antigo, em que só
    // o custo total foi informado.
    payroll_expenses: [
        ['cost_center', 'VARCHAR(100)'],
        ['admission_date', 'DATE NULL'],
        ['base_salary', 'DECIMAL(15,2) NULL'],
        ['overtime', 'DECIMAL(15,2) DEFAULT 0'],
        ['bonus', 'DECIMAL(15,2) DEFAULT 0'],
        ['commission', 'DECIMAL(15,2) DEFAULT 0'],
        ['transport_voucher', 'DECIMAL(15,2) DEFAULT 0'],
        ['meal_voucher', 'DECIMAL(15,2) DEFAULT 0'],
    ],
    fixed_expenses: [
        ['category', "VARCHAR(50) DEFAULT 'GERAL'"],
    ],
};

async function existingColumns(conn, table) {
    const [rows] = await conn.query(
        'SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table],
    );
    return new Set(rows.map((r) => r.name));
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} conn
 * @returns {Promise<string[]>} colunas criadas nesta execução ("tabela.coluna")
 */
async function ensurePricingSchema(conn) {
    for (const ddl of TABLES) await conn.query(ddl);

    const added = [];
    for (const [table, columns] of Object.entries(COLUMNS)) {
        const existing = await existingColumns(conn, table);
        for (const [name, definition] of columns) {
            if (existing.has(name)) continue;
            await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
            added.push(`${table}.${name}`);
        }

        // Migração única: o antigo "IPI de saída" vira o IPI das duas faixas.
        if (table === 'sales_channels' && added.includes('sales_channels.ipi_tier2_percent') && existing.has('ipi_out_percent')) {
            await conn.query('UPDATE sales_channels SET ipi_tier1_percent = ipi_out_percent, ipi_tier2_percent = ipi_out_percent WHERE ipi_out_percent > 0');
        }
        if (table === 'sales_channels' && added.includes('sales_channels.sort_order')) {
            await conn.query('UPDATE sales_channels SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL');
        }
        if (table === 'products' && added.includes('products.sort_order')) {
            await conn.query('UPDATE products SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL');
        }
    }
    return added;
}

module.exports = { ensurePricingSchema };
