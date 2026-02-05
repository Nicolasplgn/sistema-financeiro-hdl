// ARQUIVO: services/questorService.js
const generateQuestorLayout = (entry, details, companyTaxId) => {
    let layout = "";
    const dateStr = entry.period_start.replace(/-/g, '').substring(0, 8);
    const cnpjFormatted = (companyTaxId || "00000000000000").replace(/\D/g, '').padStart(14, '0');

    layout += `000${cnpjFormatted}${dateStr}VECTOR_CONNECT_BI_v3\n`;

    const totalRev = Number(entry.revenue_resale) + Number(entry.revenue_product) + Number(entry.revenue_service);
    if (totalRev > 0) {
        layout += `100${dateStr}REC_OPERACIONAL_BRUTA`.padEnd(50) + `${String(totalRev.toFixed(2)).replace('.', '').padStart(15, '0')}C\n`;
    }

    details.forEach((item) => {
        const type = item.type === 'REVENUE' ? 'C' : 'D';
        const desc = (item.description || 'LANCAMENTO ANALITICO').substring(0, 30).toUpperCase();
        const code = (item.questor_account_code || '999').padStart(10, '0');
        layout += `300${dateStr}${desc}`.padEnd(50) + `${code}${String(Number(item.amount).toFixed(2)).replace('.', '').padStart(15, '0')}${type}\n`;
    });

    return layout;
};

const generateNFSeXML = (data) => {
    return `<?xml version="1.0" encoding="UTF-8"?><NFSe><Empresa>${data.taxId}</Empresa><Valor>${data.amount}</Valor></NFSe>`;
};

module.exports = { generateQuestorLayout, generateNFSeXML };