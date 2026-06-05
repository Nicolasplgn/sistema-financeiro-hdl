// ARQUIVO: backend/seed_realista.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'financeiro',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    waitForConnections: true,
    connectionLimit: 5
});

const cleanAndSeed = async () => {
    const conn = await pool.getConnection();
    try {
        console.log("🚀 Iniciando limpeza e semeadura do banco de dados...");
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        // 1. LIMPAR TODAS AS TABELAS TRANSACIONAIS E DE CADASTROS
        const tables = [
            'entry_details', 'monthly_entries', 'product_boms', 'products', 
            'materials', 'fixed_expenses', 'payroll_expenses', 'prolabore_expenses', 
            'sales_channels', 'partners', 'categories', 'companies', 'budget_goals'
        ];
        for (const t of tables) {
            await conn.query(`TRUNCATE TABLE ${t}`);
            console.log(`✓ Tabela ${t} limpa.`);
        }

        // 2. CADASTRAR A EMPRESA FAKE (ID: 14 para bater com seus testes)
        await conn.execute(`
            INSERT INTO companies (id, name, trade_name, tax_id, tax_regime, owner_id) 
            VALUES (14, 'VECTOR SOLUCOES DIGITAIS LTDA', 'Vector Tech Demo', '12.345.678/0001-90', 'LUCRO_REAL', 1)
        `);
        console.log("✓ Empresa Demo (ID 14) cadastrada.");

        // 3. CADASTRAR CATEGORIAS DO SISTEMA (DRE / Balancete)
        const categoriesData = [
            { id: 1, name: 'Venda de Produtos (Balancete)', type: 'REVENUE' },
            { id: 2, name: 'Prestação de Serviços (Balancete)', type: 'REVENUE' },
            { id: 3, name: 'Outras Receitas (Balancete)', type: 'REVENUE' },
            { id: 4, name: 'ICMS / DAS Simples (Balancete)', type: 'EXPENSE' },
            { id: 5, name: 'PIS (Balancete)', type: 'EXPENSE' },
            { id: 6, name: 'COFINS (Balancete)', type: 'EXPENSE' },
            { id: 7, name: 'ISS (Balancete)', type: 'EXPENSE' },
            { id: 8, name: 'CSLL (Balancete)', type: 'EXPENSE' },
            { id: 9, name: 'IRPJ (Balancete)', type: 'EXPENSE' },
            { id: 10, name: 'CPV / Compras / Fretes (Balancete)', type: 'EXPENSE' },
            { id: 11, name: 'Despesas Operacionais (Balancete)', type: 'EXPENSE' }
        ];
        for (const cat of categoriesData) {
            await conn.execute('INSERT INTO categories (id, name, type) VALUES (?, ?, ?)', [cat.id, cat.name, cat.type]);
        }
        console.log("✓ Categorias operacionais cadastradas.");

        // 4. CADASTRAR PARCEIROS (Clientes e Fornecedores para os Rankings)
        const partnersData = [
            // CLIENTES
            { id: 1, company_id: 14, name: 'LOJAS RENNER S.A.', type: 'CLIENT' },
            { id: 2, company_id: 14, name: 'RIACHUELO MODAS S.A.', type: 'CLIENT' },
            { id: 3, company_id: 14, name: 'C&A MODAS BRASIL', type: 'CLIENT' },
            { id: 4, company_id: 14, name: 'LOJAS AMERICANAS S.A.', type: 'CLIENT' },
            { id: 5, company_id: 14, name: 'DISTRIBUIDOR VIP SUL', type: 'CLIENT' },
            // FORNECEDORES
            { id: 6, company_id: 14, name: 'SHIMANO BRASIL COMPONENTES', type: 'SUPPLIER' },
            { id: 7, company_id: 14, name: 'FABRICA DE QUADROS BRASIL', type: 'SUPPLIER' },
            { id: 8, company_id: 14, name: 'PNEUS PIRELLI LTDA', type: 'SUPPLIER' },
            { id: 9, company_id: 14, name: 'EMBALAGENS PREMIUM S.A.', type: 'SUPPLIER' },
            { id: 10, company_id: 14, name: 'COPEL DISTRIBUIÇÃO (ENERGIA)', type: 'SUPPLIER' }
        ];
        for (const p of partnersData) {
            await conn.execute('INSERT INTO partners (id, company_id, name, type) VALUES (?, ?, ?, ?)', [p.id, p.company_id, p.name, p.type]);
        }
        console.log("✓ Parceiros comerciais (Clientes/Fornecedores) cadastrados.");

        // 5. CADASTRAR CANAIS DE VENDA (Com todas as taxas do Markup)
        await conn.execute(`
            INSERT INTO sales_channels (
                id, company_id, name, icms_out_percent, pis_out_percent, cofins_out_percent, ipi_out_percent,
                difal_out_percent, ir_csll_percent, commission_percent, marketing_percent, freight_percent,
                default_rate_percent, financial_cost_percent, fixed_expenses_rate_percent, payroll_rate_percent,
                administrative_cost_percent, profit_margin_percent, freight_value
            ) VALUES 
            (1, 14, 'MERCADO LIVRE', 12.00, 1.65, 7.60, 0.00, 0.00, 0.00, 16.00, 3.00, 0.00, 1.50, 2.50, 5.00, 3.00, 2.00, 15.00, 18.00),
            (2, 14, 'LOJA FISICA', 18.00, 1.65, 7.60, 0.00, 0.00, 0.00, 0.00, 4.00, 0.00, 0.50, 1.50, 8.00, 10.00, 4.00, 25.00, 0.00),
            (3, 14, 'DISTRIBUIDOR B2B', 4.00, 1.65, 7.60, 5.00, 2.00, 1.20, 2.00, 1.00, 5.00, 2.00, 1.00, 3.00, 2.00, 1.00, 10.00, 150.00)
        `);
        console.log("✓ Canais de Venda e taxas de Markup configurados.");

        // 6. CADASTRAR INSUMOS (MATERIAIS)
        const materialsData = [
            { id: 1, name: 'Quadro de Alumínio MTB', price_national: 350.00, ipi_percent: 10.00, is_national: 1 },
            { id: 2, name: 'Par de Pneus Pirelli', price_national: 120.00, ipi_percent: 5.00, is_national: 1 },
            { id: 3, name: 'Guidão Ergonômico Pro', price_national: 85.00, ipi_percent: 0.00, is_national: 1 },
            { id: 4, name: 'Quadro Carbono Speed', price_national: 1200.00, ipi_percent: 12.00, is_national: 0 },
            { id: 5, name: 'Grupo de Transmissão Shimano', price_national: 450.00, ipi_percent: 8.00, is_national: 0 },
            { id: 6, name: 'Freio Hidráulico Completo', price_national: 160.00, ipi_percent: 5.00, is_national: 1 },
            { id: 7, name: 'Selim Gel Confort', price_national: 75.00, ipi_percent: 0.00, is_national: 1 },
            { id: 8, name: 'Embalagem de Papelão Reforçada', price_national: 15.00, ipi_percent: 0.00, is_national: 1 }
        ];
        for (const m of materialsData) {
            await conn.execute('INSERT INTO materials (id, company_id, name, price_national, price_imported, ipi_percent, is_national) VALUES (?, 14, ?, ?, ?, ?, ?)', [m.id, m.name, m.price_national, m.price_national, m.ipi_percent, m.is_national]);
        }
        console.log("✓ Insumos de produção cadastrados.");

        // 7. CADASTRAR PRODUTOS FINAIS
        await conn.execute("INSERT INTO products (id, company_id, name, sku) VALUES (1, 14, 'Bicicleta MTB Extreme 29', 'BIKE-MTB-001')");
        await conn.execute("INSERT INTO products (id, company_id, name, sku) VALUES (2, 14, 'Bicicleta Speed Carbon Pro', 'BIKE-SPD-002')");
        console.log("✓ Produtos finais cadastrados.");

        // 8. CADASTRAR FICHA TÉCNICA (BOM)
        const bomsData = [
            // MTB usa: Quadro Alumínio (1), Pneus (1), Guidão (1), Shimano (1), Freio (1), Selim (1), Embalagem (1)
            { product_id: 1, material_id: 1, quantity: 1 },
            { product_id: 1, material_id: 2, quantity: 1 },
            { product_id: 1, material_id: 3, quantity: 1 },
            { product_id: 1, material_id: 5, quantity: 1 },
            { product_id: 1, material_id: 6, quantity: 1 },
            { product_id: 1, material_id: 7, quantity: 1 },
            { product_id: 1, material_id: 8, quantity: 1 },
            // Speed usa: Quadro Carbono (1), Pneus (1), Guidão (1), Shimano (1), Freio (1), Selim (1), Embalagem (1)
            { product_id: 2, material_id: 4, quantity: 1 },
            { product_id: 2, material_id: 2, quantity: 1 },
            { product_id: 2, material_id: 3, quantity: 1 },
            { product_id: 2, material_id: 5, quantity: 1 },
            { product_id: 2, material_id: 6, quantity: 1 },
            { product_id: 2, material_id: 7, quantity: 1 },
            { product_id: 2, material_id: 8, quantity: 1 }
        ];
        for (const b of bomsData) {
            await conn.execute('INSERT INTO product_boms (product_id, material_id, quantity) VALUES (?, ?, ?)', [b.product_id, b.material_id, b.quantity]);
        }
        console.log("✓ Ficha técnica (BOM) amarrada aos produtos.");

        // 9. CADASTRAR DESPESAS OPERACIONAIS FIXAS, FOLHA, PROLABORE
        await conn.execute("INSERT INTO fixed_expenses (company_id, name, amount, category) VALUES (14, 'ALUGUEL DA FÁBRICA', 4500.00, 'GERAL')");
        await conn.execute("INSERT INTO fixed_expenses (company_id, name, amount, category) VALUES (14, 'ENERGIA INDUSTRIAL', 1994.87, 'GERAL')");
        await conn.execute("INSERT INTO fixed_expenses (company_id, name, amount, category) VALUES (14, 'HONORÁRIOS CONTÁBEIS', 3156.97, 'GERAL')");
        await conn.execute("INSERT INTO payroll_expenses (company_id, employee_name, role, total_cost) VALUES (14, 'JOÃO DA SILVA (Mecanico)', 'Mecanico Senior', 86875.95)");
        await conn.execute("INSERT INTO prolabore_expenses (company_id, partner_name, total_cost) VALUES (14, 'SÓCIO MAIORITÁRIO JOICE', 5770.76)");
        console.log("✓ Custos operacionais fixos cadastrados.");

        // 10. CADASTRAR LANÇAMENTOS MENSAIS (4 MESES DE DRE EM 2026)
        const entries = [
            {
                id: 1, period: '2026-01', resale: 0, product: 206516.69, service: 0, rent: 0, other: 3.39,
                icms: 1949.32, iss: 15.27, pis: 0, cofins: 0, csll: 0, irpj: 0, purchases: 115147.05, expenses: 60181.34, patrimonial: 23928.34
            },
            {
                id: 2, period: '2026-02', resale: 0, product: 376684.23, service: 0, rent: 0, other: 353611.22,
                icms: 14762.88, iss: 0, pis: 0, cofins: 0, csll: 165.28, irpj: 183.64, purchases: 35541.01, expenses: 176032.49, patrimonial: 85108.69
            },
            {
                id: 3, period: '2026-03', resale: 0, product: 194603.00, service: 0, rent: 0, other: 174.20,
                icms: 9404.76, iss: 0, pis: 1924.54, cofins: 8864.53, csll: 0, irpj: 0, purchases: 92886.87, expenses: 70135.15, patrimonial: 120597.79
            },
            {
                id: 4, period: '2026-04', resale: 0, product: 279608.77, service: 0, rent: 0, other: 4332.82,
                icms: 2245.79, iss: 0, pis: 99.79, cofins: 460.61, csll: 0, irpj: 0, purchases: 58733.69, expenses: 140461.13, patrimonial: 94316.30
            }
        ];

        for (const e of entries) {
            await conn.execute(`
                INSERT INTO monthly_entries (
                    id, company_id, period_start, period_end, revenue_resale, revenue_product, revenue_service,
                    revenue_rent, revenue_other, tax_icms, tax_difal, tax_iss, tax_pis, tax_cofins, tax_csll,
                    tax_irpj, tax_additional_irpj, tax_fust, tax_funtell, purchases_total, expenses_total, patrimonial_movements, notes
                ) VALUES (?, 14, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, ?, ?, ?, 'Seeder Realista')`,
                [
                    e.id, `${e.period}-01`, `${e.period}-28`, e.resale, e.product, e.service,
                    e.rent, e.other, e.icms, e.iss, e.pis, e.cofins, e.csll, e.irpj, e.purchases, e.expenses, e.patrimonial
                ]
            );

            // Adiciona detalhamento analítico simulado para preencher os gráficos de categoria e de rankings
            // Detalhe de Receita (Americanas)
            await conn.execute('INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description) VALUES (?, 1, 1, "REVENUE", ?, "Venda Lote Bikes")', [e.id, e.product * 0.6]);
            // Detalhe de Receita (Renner)
            await conn.execute('INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description) VALUES (?, 2, 1, "REVENUE", ?, "Venda Lote Bikes")', [e.id, e.product * 0.4]);
            // Detalhe de Custo (Quadro S.A)
            await conn.execute('INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description) VALUES (?, 7, 10, "EXPENSE", ?, "Insumos Metal")', [e.id, e.purchases]);
            // Detalhe de Imposto (DAS)
            await conn.execute('INSERT INTO entry_details (entry_id, partner_id, category_id, type, amount, description) VALUES (?, 10, 4, "EXPENSE", ?, "DAS Guia")', [e.id, e.icms]);
        }
        console.log("✓ Lançamentos Mensais (DRE de Jan a Abr/2026) criados.");

        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log("\n⭐️ BANCO DE DADOS VECTOR PRONTO PARA A APRESENTAÇÃO!");
        process.exit(0);
    } catch (e) {
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.error("❌ Erro no Seeder:", e.message);
        process.exit(1);
    } finally {
        conn.release();
    }
};

cleanAndSeed();