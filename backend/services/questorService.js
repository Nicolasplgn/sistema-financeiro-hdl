const moment = require('moment'); 
const axios = require('axios');

/**
 * Formata data para DD/MM/YYYY (Padrão TXT e XML Questor)
 */
const formatDateQuestor = (dateString) => {
    if (!dateString) return '';
    return moment(dateString).format('DD/MM/YYYY');
};

/**
 * Formata valor monetário para XML (1000.50 -> 1000,50)
 */
const formatValueXML = (value) => {
    if (!value && value !== 0) return '0,00';
    return parseFloat(value).toFixed(2).replace('.', ',');
};

/**
 * Formata valor para TXT (14 posições, sem ponto, com vírgula implícita no layout ou explícita)
 */
const formatValueTXT = (value) => {
    if (!value) return '0000000000000,00';
    let val = parseFloat(value).toFixed(2).replace('.', ',');
    return val.padStart(16, '0');
};

// =============================================================================
// GERADOR DE XML PADRÃO NFSE (MODELO 99) - VERSÃO 2
// =============================================================================
const generateNFSeXML = (entry, companyCnpj, accountantCnpj) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<NOTAS>\n`;
    xml += `  <XML>\n`;

    xml += `    <DATA_EMISSAO>${formatDateQuestor(entry.period_start)}</DATA_EMISSAO>\n`;
    xml += `    <COMPETENCIA>${formatDateQuestor(entry.period_start)}</COMPETENCIA>\n`;
    xml += `    <N_DA_NFSE>${entry.id}</N_DA_NFSE>\n`; 
    
    xml += `    <CODIGO_SERVICO>1.07</CODIGO_SERVICO>\n`; 
    xml += `    <DISCRIMINACAO_DOS_SERVICOS>${entry.notes || 'Prestação de Serviços'}</DISCRIMINACAO_DOS_SERVICOS>\n`;
    xml += `    <VALOR_DOS_SERVICOS>${formatValueXML(entry.revenue_service)}</VALOR_DOS_SERVICOS>\n`;

    xml += `    <CPFCNPJ_PRESTADOR>${companyCnpj.replace(/\D/g, '')}</CPFCNPJ_PRESTADOR>\n`;
    xml += `    <NOME_PRESTADOR>Empresa Emitente</NOME_PRESTADOR>\n`; 
    xml += `    <ESTADO_PRESTADOR>SP</ESTADO_PRESTADOR>\n`; 

    xml += `    <CPFCNPJ_TOMADOR>00000000000000</CPFCNPJ_TOMADOR>\n`; 
    xml += `    <NOME_TOMADOR>CLIENTES DIVERSOS</NOME_TOMADOR>\n`;
    
    xml += `    <ALIQUOTA_ISS>${formatValueXML(entry.tax_iss > 0 ? (entry.tax_iss / entry.revenue_service) * 100 : 0)}</ALIQUOTA_ISS>\n`;
    xml += `    <VL_ISS>${formatValueXML(entry.tax_iss)}</VL_ISS>\n`;
    
    xml += `  </XML>\n`;
    xml += `</NOTAS>`;

    return xml;
};

// =============================================================================
// GERADOR DE LAYOUT TXT (CONTÁBIL)
// =============================================================================
const generateQuestorLayout = (entry, details, companyCnpj) => {
    let txtContent = "";
    details.forEach(item => {
        const dataLcto = formatDateQuestor(entry.period_start);
        const valorFormatado = formatValueTXT(item.amount); 
        const contaCategoria = item.questor_account_code || "CONTA_GENERICA";
        const contaCaixa = "1000"; 
        
        let contaDebito = item.type === 'EXPENSE' ? contaCategoria : contaCaixa;
        let contaCredito = item.type === 'EXPENSE' ? contaCaixa : contaCategoria;

        const line = `C;${companyCnpj};${dataLcto};;DOC${entry.id};${contaDebito};;${contaCredito};;${valorFormatado};100;Lcto via SCE;`;
        txtContent += line + "\r\n";
    });
    return txtContent;
};

// =============================================================================
// BUSCAR DÉBITOS TRIBUTÁRIOS (O RETORNO DO QUESTOR)
// =============================================================================
const fetchTaxDebts = async (companyCnpj, accountantCnpj, token) => {
    // --- SIMULAÇÃO PARA TESTE (APAGUE ISSO QUANDO ENTRAR EM PRODUÇÃO) ---
    return [
        {
            imposto: "DAS - SIMPLES NACIONAL",
            vencimento: moment().add(5, 'days').format('YYYY-MM-DD'),
            valor: 12500.45,
            codigoBarras: "85800000001-1 25000109202-2 40101010101-3 00000000000-0",
            status: "ABERTO"
        },
        {
            imposto: "DARF - IRRF",
            vencimento: moment().add(10, 'days').format('YYYY-MM-DD'),
            valor: 320.10,
            codigoBarras: "85800000000-0 03200109202-2 40101010101-3 00000000000-0",
            status: "ABERTO"
        }
    ];
};

// =============================================================================
// BUILDER DE PAYLOAD (JSON) - V2
// =============================================================================
const buildPayload = (dataContent, companyCnpj, accountantCnpj, type = 'TXT') => {
    if (type === 'TXT') {
        return {
            cnpjCliente: companyCnpj,
            versao: "2.00", 
            grupoLayout: 100, 
            dataDocumentos: new Date().toISOString().split('T')[0], 
            dado: dataContent,
            cnpjContabilidade: [accountantCnpj]
        };
    } 
    else if (type === 'XML') {
        return {
            cnpjCliente: companyCnpj,
            entradaSaidaEnum: 1, 
            tipoDocFiscal: 99,   
            dataDocumento: new Date().toISOString().split('T')[0],
            permissao: [accountantCnpj],
            xmls: [dataContent] 
        };
    }
};

module.exports = { generateQuestorLayout, generateNFSeXML, buildPayload, fetchTaxDebts };