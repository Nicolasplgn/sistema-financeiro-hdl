const fs = require('fs');
const readline = require('readline');
const mysql = require('mysql2/promise');

// ⚠️ ATENÇÃO: Confirme se a senha está correta
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // <--- SE TIVER SENHA NO SEU MYSQL, COLOQUE AQUI
    database: 'financeiro' // Nome do seu banco atual
};

// ID da empresa (Pelo seu print, a tabela companies tem dados. 
// Use o ID 1 ou verifique no phpMyAdmin qual ID quer usar)
const COMPANY_ID = 1; 

const parseCurrency = (str) => {
    if (!str) return 0.0;
    let cleanStr = str.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0.0 : num;
};

const parsePercent = (str) => {
    if (!str) return 0.0;
    let cleanStr = str.replace('%', '').replace(',', '.').trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0.0 : num;
};

async function processLineByLine(filePath) {
    const connection = await mysql.createConnection(dbConfig);
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentProductId = null;
    let isReadingBOM = false;

    console.log("🚀 Iniciando importação no banco 'financeiro'...");

    for await (const line of rl) {
        const columns = line.split(';');

        // Detecta Produto (BIKE...)
        if (columns[0] && (columns[0].toUpperCase().startsWith('BIKE') || columns[0].toUpperCase().startsWith('SUTIA'))) {
            const productName = columns[0].trim();
            console.log(`\n🚲 Produto: ${productName}`);
            
            const [prodResult] = await connection.execute(
                'INSERT INTO products (company_id, name) VALUES (?, ?)',
                [COMPANY_ID, productName]
            );
            currentProductId = prodResult.insertId;
            isReadingBOM = false;
            continue;
        }

        // Detecta Cabeçalho BOM
        if (columns[0] && (columns[0].includes('Componentes') || columns[0].includes('LYCRA'))) {
            isReadingBOM = true;
            continue;
        }

        // Lê Materiais
        if (isReadingBOM && currentProductId) {
            const materialName = columns[0] ? columns[0].trim() : '';
            if (!materialName || materialName.toUpperCase().includes('TOTAL') || materialName.toUpperCase().includes('FRETE')) continue;

            const ncm = columns[1] ? columns[1].trim() : '';
            const priceImp = parseCurrency(columns[2]);
            const priceNac = parseCurrency(columns[3]);
            const ipi = parsePercent(columns[4]);

            if (priceImp === 0 && priceNac === 0) continue;

            // Busca ou Cria Material
            let materialId;
            const [rows] = await connection.execute('SELECT id FROM materials WHERE name = ? AND company_id = ?', [materialName, COMPANY_ID]);

            if (rows.length > 0) {
                materialId = rows[0].id;
            } else {
                const [matResult] = await connection.execute(
                    `INSERT INTO materials (company_id, name, ncm, price_imported, price_national, ipi_percent) VALUES (?, ?, ?, ?, ?, ?)`,
                    [COMPANY_ID, materialName, ncm, priceImp, priceNac, ipi]
                );
                materialId = matResult.insertId;
            }

            // Liga Material ao Produto
            await connection.execute('INSERT INTO product_boms (product_id, material_id, quantity) VALUES (?, ?, 1)', [currentProductId, materialId]);
            process.stdout.write('.');
        }
    }
    console.log("\n\n✅ Importação Concluída!");
    await connection.end();
}

const csvFile = process.argv[2] || 'combine.csv';
processLineByLine(csvFile).catch(err => console.error(err));