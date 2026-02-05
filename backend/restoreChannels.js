const fs = require('fs');
const path = require('path');
const pool = require('./db'); 

// Caminho da pasta
// Se você passar um argumento no terminal, usa ele. Se não, usa o padrão.
const argPath = process.argv[2];
const MARKUP_FOLDER = argPath ? path.resolve(argPath) : path.join(__dirname, 'markup_files');

// --- FUNÇÃO PARA ACHAR A EMPRESA CORRETA AUTOMATICAMENTE ---
async function getValidCompanyId(connection) {
    // Tenta pegar a primeira empresa que existir no banco
    const [rows] = await connection.execute('SELECT id FROM companies ORDER BY id ASC LIMIT 1');
    
    if (rows.length > 0) {
        return rows[0].id;
    }

    // Se não existir nenhuma, cria uma de emergência
    console.log("⚠️ Nenhuma empresa encontrada. Criando 'Matriz Vector'...");
    const [res] = await connection.execute(
        "INSERT INTO companies (name, trade_name, tax_id, tax_regime) VALUES (?, ?, ?, ?)",
        ['Matriz Vector', 'Vector Connect', '00.000.000/0001-00', 'LUCRO_REAL']
    );
    return res.insertId;
}

async function restoreChannels() {
    console.log(`🚀 Restaurando Tributos e Markups da pasta: ${MARKUP_FOLDER}`);

    try {
        if (!fs.existsSync(MARKUP_FOLDER)) {
            console.error(`❌ Pasta não encontrada: ${MARKUP_FOLDER}`);
            process.exit(1);
        }

        const files = fs.readdirSync(MARKUP_FOLDER);
        const connection = await pool.getConnection();

        // 1. Descobre o ID real da empresa (Corrige o erro de chave estrangeira)
        const COMPANY_ID = await getValidCompanyId(connection);
        console.log(`🏢 Vinculando dados à Empresa ID: ${COMPANY_ID}`);

        console.log(`📂 Processando ${files.length} arquivos...`);

        let count = 0;
        for (const file of files) {
            if (file.startsWith('.')) continue;

            const name = path.parse(file).name.trim(); 
            const upperName = name.toUpperCase();

            // LÓGICA DE FILTRO: 
            // Ignora o que é ficha técnica, folha, etc.
            // Mantém "MARKUP..." e "TRIBUTOS..."
            if (upperName.includes('FICHA TECNICA') || upperName.includes('FOLHA') || upperName === 'CUSTO FIXO' || upperName === 'PAINEL' || upperName === 'DADOS' || upperName === 'PRO-LABORE') {
                continue;
            }

            // Lógica de Taxas (Padrão)
            let icms = 12.00; let pis = 1.65; let cofins = 7.60;
            
            // Ajustes finos baseados no nome do arquivo
            if (upperName.includes('EXPORT')) { icms=0; pis=0; cofins=0; }
            else if (upperName.includes('ONLINE')) { icms=18; } // Geralmente online tem ICMS maior
            
            // Lógica B2B (Custos Extras)
            let financial = 0; let admin = 0;
            if (upperName.includes('B2B')) {
                financial = 4.00; // Financeiro
                admin = 36.19;    // Salários + Pro-labore
            }

            const query = `
                INSERT INTO sales_channels 
                (company_id, name, icms_out_percent, pis_out_percent, cofins_out_percent, financial_cost_percent, administrative_cost_percent, profit_margin_percent, fixed_cost_allocation_percent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    icms_out_percent = VALUES(icms_out_percent),
                    financial_cost_percent = VALUES(financial_cost_percent),
                    administrative_cost_percent = VALUES(administrative_cost_percent)
            `;

            await connection.execute(query, [COMPANY_ID, name, icms, pis, cofins, financial, admin, 15.00, 5.00]);
            process.stdout.write('.');
            count++;
        }

        connection.release();
        console.log(`\n\n✅ Sucesso! ${count} canais (Markups e Tributos) restaurados.`);
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Erro fatal:", error);
        process.exit(1);
    }
}

restoreChannels();