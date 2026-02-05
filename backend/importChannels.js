const fs = require('fs');
const path = require('path');
const pool = require('./db'); 

// Caminho da pasta de markups
const argPath = process.argv[2];
const MARKUP_FOLDER = argPath ? path.resolve(argPath) : path.join(__dirname, 'markup_files');

// FUNÇÃO INTELIGENTE PARA ACHAR A EMPRESA
async function getValidCompanyId(connection) {
    // 1. Tenta achar a empresa ID 1
    const [rows1] = await connection.execute('SELECT id FROM companies WHERE id = 1');
    if (rows1.length > 0) return rows1[0].id;

    // 2. Se não achar a 1, pega a primeira que encontrar
    const [rowsAny] = await connection.execute('SELECT id FROM companies LIMIT 1');
    if (rowsAny.length > 0) {
        console.log(`⚠️ Empresa ID 1 não existe. Usando Empresa ID ${rowsAny[0].id} encontrada.`);
        return rowsAny[0].id;
    }

    // 3. Se não tiver nenhuma empresa, CRIA UMA PADRÃO
    console.log("⚠️ Nenhuma empresa encontrada. Criando 'Matriz Vector' automaticamente...");
    const [res] = await connection.execute(
        "INSERT INTO companies (name, trade_name, tax_id, tax_regime) VALUES (?, ?, ?, ?)",
        ['Matriz Vector', 'Vector Connect', '00.000.000/0001-00', 'LUCRO_REAL']
    );
    console.log(`✅ Empresa criada com sucesso. ID: ${res.insertId}`);
    return res.insertId;
}

async function importChannels() {
    console.log(`🚀 Buscando arquivos em: ${MARKUP_FOLDER}`);

    try {
        if (!fs.existsSync(MARKUP_FOLDER)) {
            console.error(`❌ Pasta não encontrada: ${MARKUP_FOLDER}`);
            process.exit(1);
        }

        const files = fs.readdirSync(MARKUP_FOLDER);
        const connection = await pool.getConnection();

        // --- AQUI ESTÁ A CORREÇÃO DO ERRO ---
        const COMPANY_ID = await getValidCompanyId(connection);
        // ------------------------------------

        console.log(`📂 Encontrados ${files.length} arquivos. Vinculando à Empresa ID: ${COMPANY_ID}`);

        let count = 0;

        for (const file of files) {
            if (file.startsWith('.')) continue;

            const channelName = path.parse(file).name.toUpperCase().trim();
            
            // INTELIGÊNCIA DE TAXAS
            let icmsOut = 12.00; 
            let pisOut = 1.65;
            let cofinsOut = 7.60;
            
            if (channelName.includes('EXPORT') || channelName.includes('EXPORTAÇÃO')) {
                icmsOut = 0.00; pisOut = 0.00; cofinsOut = 0.00;
            }
            else if (channelName.includes('ONLINE') || channelName.includes('ECOMMERCE')) {
                icmsOut = 18.00; 
            }
            else if (channelName.includes('PR') && !channelName.includes('FORA')) {
                icmsOut = 18.00; 
            }

            const query = `
                INSERT INTO sales_channels 
                (company_id, name, icms_out_percent, pis_out_percent, cofins_out_percent, profit_margin_percent, fixed_cost_allocation_percent)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    icms_out_percent = VALUES(icms_out_percent),
                    pis_out_percent = VALUES(pis_out_percent),
                    cofins_out_percent = VALUES(cofins_out_percent)
            `;

            await connection.execute(query, [COMPANY_ID, channelName, icmsOut, pisOut, cofinsOut, 15.00, 5.00]);
            
            process.stdout.write('.');
            count++;
        }

        connection.release();
        console.log(`\n\n✅ Sucesso! ${count} canais vinculados à empresa ${COMPANY_ID}.`);
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Erro fatal:", error.message);
        process.exit(1);
    }
}

importChannels();