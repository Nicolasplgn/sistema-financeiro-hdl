'use strict';

/**
 * LEITOR DAS PLANILHAS DE MARKUP (CSV exportado do Excel, separador ";").
 *
 * Lê a pasta backend/markup_files e devolve:
 *   - os DADOS DIGITÁVEIS (painel, fichas técnicas, custo fixo, folha, pró-labore),
 *     que alimentam o sistema;
 *   - os RESULTADOS que o Excel calculou (markup, tributos, totais), usados só
 *     para conferir se o motor do sistema chega nos mesmos números.
 *
 * Os CSV guardam apenas o valor exibido (2 casas); as fórmulas e as casas
 * decimais escondidas do Excel não vêm no arquivo.
 */

const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------------------
// Utilitários de texto e número (formato brasileiro)
// ----------------------------------------------------------------------------

const cleanCell = (v) => (v === undefined || v === null ? '' : String(v).replace(/ /g, ' ').trim());

/** "MARKUP EXPORTAÇÃO 4" → "MARKUP EXPORTACAO 4" */
const normalize = (v) => cleanCell(v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();

const isExcelError = (v) => /^#(DIV\/0!|N\/A|REF!|VALUE!|VALOR!|NAME\?|NOME\?|NUM!)/i.test(cleanCell(v));

/**
 * "R$ 3.000,00" → 3000 | " 529,76 " → 529.76 | "R$ -" → 0 | "#DIV/0!" → null | "" → null
 */
const parseNumberBR = (v) => {
    let s = cleanCell(v);
    if (s === '' || isExcelError(s)) return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    s = s.replace(/R\$/gi, '').replace(/%/g, '').replace(/\s/g, '');
    if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
    if (s === '' || s === '-') return 0;
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return negative ? -n : n;
};

/** Igual a parseNumberBR, mas célula vazia vale 0. */
const numberOrZero = (v) => parseNumberBR(v) ?? 0;

/** "19/05/2025" → "2025-05-19" */
const parseDateBR = (v) => {
    const m = cleanCell(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

/** CSV com ";" e aspas opcionais; devolve matriz de strings. */
const parseCsv = (content) => {
    const text = (Buffer.isBuffer(content) ? content.toString('utf8') : String(content)).replace(/^﻿/, '');
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else cell += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === ';') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
    return rows;
};

const findRow = (rows, predicate, from = 0) => {
    for (let i = from; i < rows.length; i++) if (predicate(rows[i], i)) return i;
    return -1;
};

// ----------------------------------------------------------------------------
// Canais
// ----------------------------------------------------------------------------

const CHANNEL_KEYS = Object.freeze(['ONLINE', 'B2B_PR', 'B2B_FORA', 'EXPORTACAO']);

const channelKeyFromText = (text) => {
    const t = normalize(text);
    if (t.includes('ONLINE')) return 'ONLINE';
    if (t.includes('EXPORT')) return 'EXPORTACAO';
    if (t.includes('FORA')) return 'B2B_FORA';
    if (t.includes('B2B') || /\bPR\b/.test(t)) return 'B2B_PR';
    return null;
};

/** Classifica um arquivo da pasta pelo nome. */
const classifyFile = (fileName) => {
    const name = normalize(path.parse(fileName).name);
    if (name === 'PAINEL') return { type: 'painel' };
    if (name === 'CUSTO FIXO') return { type: 'custoFixo' };
    if (name === 'FOLHA') return { type: 'folha' };
    if (name === 'PRO-LABORE' || name === 'PRO LABORE') return { type: 'proLabore' };

    let m = name.match(/^FICHA TECNICA\s*(\d+)$/);
    if (m) return { type: 'ficha', model: Number(m[1]) };

    m = name.match(/^(MARKUP|TRIBUTOS)\s+(.*?)\s*(\d+)$/);
    if (m) {
        const channel = channelKeyFromText(m[2]);
        if (channel) return { type: m[1] === 'MARKUP' ? 'markup' : 'tributos', channel, model: Number(m[3]) };
    }
    return { type: 'desconhecido' };
};

// ----------------------------------------------------------------------------
// PAINEL
// ----------------------------------------------------------------------------

const PAINEL_ROWS = Object.freeze([
    { label: 'APROPIACAO CUSTO FIXO', field: 'fixed_cost_share_percent' },
    { label: 'APROPIACAO PRO-LABORE', field: 'prolabore_share_percent' },
    { label: 'APROPIACAO SALARIO', field: 'payroll_share_percent' },
    { label: 'META DE VENDA', field: 'sales_target' },
    { label: 'LUCRO', field: 'profit_margin_percent' },
    { label: 'ICMS', field: 'icms_out_percent' },
    { label: 'DIFAL', field: 'difal_out_percent' },
    { label: 'PIS', field: 'pis_out_percent' },
    { label: 'COFINS', field: 'cofins_out_percent' },
    { label: 'IR /CSSL', field: 'ir_csll_percent' },
    { label: 'COMISSAO VENDAS', field: 'commission_percent' },
    { label: 'PROPAGANDA', field: 'marketing_percent' },
    { label: 'FRETE DA ENTREGA', field: 'freight_percent' },
    { label: 'INADIMPLENCIA', field: 'default_rate_percent' },
    { label: 'CUSTO FINANCEIRO', field: 'financial_cost_percent' },
    { label: 'DESCONTO A VISTA (POR DENTRO)', field: 'cash_discount_percent' },
    { label: 'IPI - FAIXA 1', field: 'ipi_tier1_percent' },
    { label: 'IPI - FAIXA 2', field: 'ipi_tier2_percent' },
]);

function parsePainel(rows) {
    const headerIdx = findRow(rows, (r) => normalize(r[0]) === 'DIGITAVEL');
    if (headerIdx < 0) throw new Error('PAINEL: linha "DIGITAVEL" não encontrada.');

    const channels = [];
    rows[headerIdx].forEach((cell, idx) => {
        if (idx === 0) return;
        const text = cleanCell(cell);
        if (!text || normalize(text) === 'DADOS') return;
        channels.push({ col: idx, name: text, key: channelKeyFromText(text) ?? `CANAL_${channels.length + 1}` });
    });

    for (const def of PAINEL_ROWS) {
        const idx = findRow(rows, (r) => normalize(r[0]) === def.label, headerIdx + 1);
        if (idx < 0) throw new Error(`PAINEL: linha "${def.label}" não encontrada.`);
        for (const ch of channels) ch[def.field] = numberOrZero(rows[idx][ch.col]);
    }

    // Rateio das despesas fixas por modelo.
    const codesIdx = findRow(rows, (r) => normalize(r[0]).startsWith('RATEIO TOTAL'));
    const models = [];
    let rateioTotal = false;
    if (codesIdx >= 0) {
        const codes = rows[codesIdx];
        const values = rows[codesIdx + 1] ?? [];
        rateioTotal = numberOrZero(values[0]) === 1;
        for (let n = 1; n <= 10; n++) {
            const code = cleanCell(codes[n]);
            if (!code && parseNumberBR(values[n]) === null) continue;
            models.push({ model: n, code, allocation_percent: numberOrZero(values[n]) });
        }
    }

    return {
        channels: channels.map(({ col, ...rest }, i) => ({ ...rest, sort_order: i + 1 })),
        models,
        rateio_total: rateioTotal,
    };
}

// ----------------------------------------------------------------------------
// FICHA TECNICA
// ----------------------------------------------------------------------------

/** "BIKE:. 2 - x52 - Bicicleta Aro 29 ..." → { model: 2, code: "X52", name: "Bicicleta Aro 29 ..." } */
const parseFichaTitle = (title) => {
    const text = cleanCell(title);
    const m = text.match(/^BIKE\s*:?\.?\s*(\d+)\s*-\s*([^-]+?)\s*-\s*(.+)$/i);
    if (m) return { model: Number(m[1]), code: m[2].trim().toUpperCase(), name: m[3].trim() };
    return { model: null, code: null, name: text };
};

function parseFichaTecnica(rows) {
    const title = parseFichaTitle(rows[0]?.[0]);
    const paramRow = rows[1] ?? [];
    const settings = {
        pis_credit_percent: parseNumberBR(paramRow[8]) ?? parseNumberBR(paramRow[9]),
        cofins_credit_percent: parseNumberBR(paramRow[10]) ?? parseNumberBR(paramRow[11]),
        icms_credit_imported_percent: parseNumberBR(paramRow[13]),
        icms_credit_national_percent: parseNumberBR(paramRow[14]),
    };

    // A linha de totais é a primeira, depois do cabeçalho, sem nome e com os dois custos.
    const totalsIdx = findRow(rows, (r) => cleanCell(r[0]) === '' && parseNumberBR(r[15]) !== null && parseNumberBR(r[16]) !== null, 3);
    const lastItemRow = totalsIdx < 0 ? rows.length : totalsIdx;

    const items = [];
    for (let i = 3; i < lastItemRow; i++) {
        const r = rows[i];
        const name = cleanCell(r[0]);
        if (!name) continue;
        const imported = parseNumberBR(r[2]);
        const national = parseNumberBR(r[3]);
        if (imported === null && national === null) continue; // linha sem valor digitado (ex.: FRETE)
        items.push({
            name,
            ncm: cleanCell(r[1]),
            imported: imported ?? 0,
            national: national ?? 0,
            ipi_percent: numberOrZero(r[4]),
            quantity: 1,
            esperado: {
                com_ipi: parseNumberBR(r[5]),
                pis_importado: parseNumberBR(r[8]), pis_nacional: parseNumberBR(r[9]),
                cofins_importado: parseNumberBR(r[10]), cofins_nacional: parseNumberBR(r[11]),
                ipi: parseNumberBR(r[12]),
                icms_importado: parseNumberBR(r[13]), icms_nacional: parseNumberBR(r[14]),
            },
        });
    }

    const t = totalsIdx >= 0 ? rows[totalsIdx] : [];
    return {
        ...title,
        title: cleanCell(rows[0]?.[0]),
        settings,
        items,
        esperado: {
            importado: parseNumberBR(t[2]), nacional: parseNumberBR(t[3]), com_ipi: parseNumberBR(t[5]),
            pis_importado: parseNumberBR(t[8]), pis_nacional: parseNumberBR(t[9]),
            cofins_importado: parseNumberBR(t[10]), cofins_nacional: parseNumberBR(t[11]),
            ipi: parseNumberBR(t[12]),
            icms_importado: parseNumberBR(t[13]), icms_nacional: parseNumberBR(t[14]),
            custo_lucro_real: parseNumberBR(t[15]), custo_lucro_presumido: parseNumberBR(t[16]),
        },
    };
}

// ----------------------------------------------------------------------------
// CUSTO FIXO / PRO-LABORE / FOLHA
// ----------------------------------------------------------------------------

function parseCustoFixo(rows) {
    const items = [];
    let esperado = null;
    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        const name = cleanCell(r[0]);
        if (!name) continue;
        // A planilha tem duas colunas de valor (B e C); o rateio usa a soma das duas.
        const parcelas = [numberOrZero(r[1]), numberOrZero(r[2])];
        if (normalize(name) === 'TOTAL') {
            esperado = {
                total: parcelas[0] + parcelas[1],
                por_canal: [3, 4, 5, 6].map((c) => numberOrZero(r[c])),
            };
            break;
        }
        items.push({
            name,
            parcelas,
            amount: parcelas[0] + parcelas[1],
            esperado_por_canal: [3, 4, 5, 6].map((c) => numberOrZero(r[c])),
        });
    }
    return { items, esperado };
}

function parseProLabore(rows) {
    const items = [];
    let esperado = null;
    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        const name = cleanCell(r[0]);
        const value = parseNumberBR(r[1]);
        if (value === null) continue;
        if (!name) {
            esperado = { total: value, por_canal: [2, 3, 4, 5].map((c) => numberOrZero(r[c])) };
            break;
        }
        items.push({ partner_name: name, total_cost: value });
    }
    return { items, esperado };
}

function parseFolha(rows) {
    const attendance = parseNumberBR(rows[0]?.[5]);
    const employees = [];
    let esperado = null;
    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        const name = cleanCell(r[2]);
        if (!name) {
            if (cleanCell(r[0]) === '' && parseNumberBR(r[17]) !== null && parseNumberBR(r[4]) !== null) {
                esperado = {
                    salario: numberOrZero(r[4]),
                    custo: numberOrZero(r[17]),
                    por_canal: [21, 22, 23, 24].map((c) => numberOrZero(r[c])),
                };
                break;
            }
            continue;
        }
        employees.push({
            company: cleanCell(r[0]),
            cost_center: cleanCell(r[1]),
            employee_name: name,
            admission_date: parseDateBR(r[3]),
            base_salary: numberOrZero(r[4]),
            overtime: numberOrZero(r[6]),
            bonus: numberOrZero(r[7]),
            commission: numberOrZero(r[8]),
            transport_voucher: numberOrZero(r[15]),
            meal_voucher: numberOrZero(r[16]),
            esperado: {
                adicional_assiduidade: numberOrZero(r[5]),
                remuneracao: numberOrZero(r[9]),
                decimo_terceiro: numberOrZero(r[10]),
                ferias: numberOrZero(r[11]),
                terco_ferias: numberOrZero(r[12]),
                fgts: numberOrZero(r[13]),
                multa_fgts: numberOrZero(r[14]),
                custo: numberOrZero(r[17]),
            },
        });
    }
    return { attendance_bonus_percent: attendance, employees, esperado };
}

// ----------------------------------------------------------------------------
// MARKUP e TRIBUTOS (somente resultados calculados pelo Excel, para conferência)
// ----------------------------------------------------------------------------

const MARKUP_ENCARGOS = Object.freeze([
    { label: 'ICMS', key: 'icms' },
    { label: 'DIFAL', key: 'difal' },
    { label: 'PIS', key: 'pis' },
    { label: 'COFINS', key: 'cofins' },
    { label: 'IR /CSSL', key: 'ir_csll' },
    { label: 'COMISSAO VENDAS', key: 'comissao', prefix: true },
    { label: 'PROPAGANDA', key: 'propaganda' },
    { label: 'FRETE DA ENTREGA', key: 'frete' },
    { label: 'INADIMPLENCIA', key: 'inadimplencia' },
    { label: 'CUSTO FINANCEIRO', key: 'custo_financeiro' },
    { label: 'PRO-LABORE', key: 'pro_labore' },
    { label: 'DESCONTO A VISTA (POR DENTRO)', key: 'desconto_a_vista' },
    { label: 'DESPESAS FIXAS MENSAIS', key: 'despesas_fixas' },
    { label: 'SALARIOS FIXOS MENSAIS', key: 'salarios' },
    { label: 'MARGEM DE LUCRO ANTES DO IR/CS', key: 'margem_lucro' },
]);

function parseMarkup(rows) {
    const byLabel = (label, prefix = false, from = 0) => findRow(rows, (r) => {
        const t = normalize(r[0]);
        return prefix ? t.startsWith(label) : t === label;
    }, from);

    const encargos = {};
    for (const def of MARKUP_ENCARGOS) {
        const idx = byLabel(def.label, def.prefix);
        if (idx >= 0) encargos[def.key] = { valor: parseNumberBR(rows[idx][1]), percentual: parseNumberBR(rows[idx][2]) };
    }

    const totalIdx = byLabel('TOTAL');
    const atribIdx = byLabel('VALOR DE VENDA ATRIBUIDO');
    const compraIdx = byLabel('PRECO DE COMPRA', false, Math.max(atribIdx, 0));
    const vendaIdx = byLabel('PRECO DE VENDA SUGERIDO', false, Math.max(atribIdx, 0));
    const descontoIdx = byLabel('VLR SOMADO C/ DESCONTO', true);
    const qtdIdx = byLabel('QUANTIDADE DE BIKE PRODUZIDA', true);
    const lucroIdx = byLabel('MARGEM DE LUCRO ANTES DO IR/CS');
    const at = (idx, col) => (idx >= 0 ? parseNumberBR(rows[idx][col]) : null);

    return {
        title: cleanCell(rows[0]?.[0]),
        encargos,
        total_percentual: at(totalIdx, 2),
        valor_venda_atribuido: at(atribIdx, 1),
        ipi_faixa: at(atribIdx, 3),
        preco_compra: at(compraIdx, 1),
        ipi_percentual: at(compraIdx, 3),
        preco_venda_sugerido: at(vendaIdx, 1),
        ipi_valor: at(vendaIdx, 2),
        preco_venda_com_ipi: at(vendaIdx, 3),
        valor_com_desconto_fora: at(descontoIdx, 1),
        desconto_fora_valor: at(descontoIdx, 2),
        valor_venda_liquido: at(descontoIdx, 3),
        quantidade_mes: at(qtdIdx, 1),
        lucro: {
            antes_ir_cs: at(lucroIdx, 4), ir_cs: at(lucroIdx, 5),
            liquido_unitario: at(lucroIdx, 6), liquido_total: at(lucroIdx, 7),
        },
    };
}

function parseTributos(rows) {
    const vendaIdx = findRow(rows, (r) => normalize(r[0]).startsWith('LUCRO REAL - VENDA'));
    const compraIdx = findRow(rows, (r) => normalize(r[0]).startsWith('LUCRO REAL - COMPRA'));
    const devidoIdx = findRow(rows, (r) => r.some((c) => normalize(c).startsWith('IMPOSTO DEVIDO')));
    const v = vendaIdx >= 0 ? rows[vendaIdx + 2] ?? [] : [];
    const c = compraIdx >= 0 ? rows[compraIdx + 2] ?? [] : [];
    const d = devidoIdx >= 0 ? rows[devidoIdx + 3] ?? [] : [];
    const n = parseNumberBR;
    return {
        venda: {
            aliquotas: { ipi: n(v[2]), pis: n(v[3]), cofins: n(v[4]), difal: n(v[5]), icms: n(v[8]), margem_liquida: n(v[16]) },
            preco_venda: n(v[9]), ipi: n(v[10]), pis: n(v[11]), cofins: n(v[12]), difal: n(v[13]), icms: n(v[14]), total: n(v[15]),
        },
        compra: { ipi: n(c[10]), pis: n(c[11]), cofins: n(c[12]), outros_creditos: n(c[13]), icms: n(c[14]), total: n(c[15]) },
        devido: {
            ipi: n(d[2]), pis: n(d[3]), cofins: n(d[4]), difal: n(d[5]), icms: n(d[6]),
            total_impostos: n(d[7]), ir: n(d[8]), csll: n(d[9]), total: n(d[10]), aliquota_efetiva: n(d[11]),
        },
    };
}

// ----------------------------------------------------------------------------
// Leitura da pasta inteira
// ----------------------------------------------------------------------------

/**
 * @param {Array<{name: string, content: Buffer|string}>} files
 */
function parsePlanilhas(files) {
    const out = {
        painel: null, custoFixo: null, folha: null, proLabore: null,
        fichas: {}, markups: {}, tributos: {}, ignorados: [],
    };
    for (const file of files) {
        const info = classifyFile(file.name);
        if (info.type === 'desconhecido') { out.ignorados.push(file.name); continue; }
        const rows = parseCsv(file.content);
        if (info.type === 'painel') out.painel = parsePainel(rows);
        else if (info.type === 'custoFixo') out.custoFixo = parseCustoFixo(rows);
        else if (info.type === 'folha') out.folha = parseFolha(rows);
        else if (info.type === 'proLabore') out.proLabore = parseProLabore(rows);
        else if (info.type === 'ficha') out.fichas[info.model] = parseFichaTecnica(rows);
        else if (info.type === 'markup') (out.markups[info.channel] ??= {})[info.model] = parseMarkup(rows);
        else if (info.type === 'tributos') (out.tributos[info.channel] ??= {})[info.model] = parseTributos(rows);
    }
    return out;
}

function readPlanilhasDir(dir) {
    if (!fs.existsSync(dir)) throw new Error(`Pasta de planilhas não encontrada: ${dir}`);
    const files = fs.readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.csv'))
        .map((f) => ({ name: f, content: fs.readFileSync(path.join(dir, f)) }));
    return parsePlanilhas(files);
}

/**
 * Converte o que foi lido das planilhas no cadastro que o sistema usa:
 * parâmetros, canais (colunas do painel), produtos com ficha técnica e rateio,
 * custos fixos, folha e pró-labore.
 */
function toCadastro(planilhas) {
    const { painel, fichas, custoFixo, folha, proLabore, markups } = planilhas;
    if (!painel) throw new Error('A planilha PAINEL é obrigatória.');

    const fichaNumbers = Object.keys(fichas).map(Number).sort((a, b) => a - b);
    const firstFicha = fichas[fichaNumbers[0]];

    const settings = { rateio_total: painel.rateio_total };
    for (const [key, value] of Object.entries(firstFicha?.settings ?? {})) {
        if (value !== null && value !== undefined) settings[key] = value;
    }
    if (folha?.attendance_bonus_percent !== null && folha?.attendance_bonus_percent !== undefined) {
        settings.attendance_bonus_percent = folha.attendance_bonus_percent;
    }

    const products = fichaNumbers.map((n) => {
        const ficha = fichas[n];
        const model = painel.models.find((m) => m.model === n);
        const ipiTiers = {};
        for (const ch of painel.channels) {
            const tier = markups?.[ch.key]?.[n]?.ipi_faixa;
            ipiTiers[ch.key] = tier === 1 ? 1 : 2;
        }
        return {
            sort_order: n,
            sku: ficha.code || model?.code || `MODELO-${n}`,
            name: ficha.name,
            allocation_percent: model?.allocation_percent ?? 0,
            ipi_tiers: ipiTiers,
            items: ficha.items.map(({ esperado, ...item }) => item),
        };
    });

    return {
        settings,
        channels: painel.channels,
        products,
        fixedExpenses: (custoFixo?.items ?? []).filter((i) => i.amount !== 0).map((i) => ({ name: i.name, amount: i.amount })),
        payroll: (folha?.employees ?? []).map(({ esperado, ...emp }) => emp),
        prolabore: (proLabore?.items ?? []).filter((i) => i.total_cost !== 0),
    };
}

module.exports = {
    CHANNEL_KEYS,
    cleanCell,
    normalize,
    parseNumberBR,
    parseDateBR,
    parseCsv,
    classifyFile,
    channelKeyFromText,
    parsePainel,
    parseFichaTecnica,
    parseCustoFixo,
    parseProLabore,
    parseFolha,
    parseMarkup,
    parseTributos,
    parsePlanilhas,
    readPlanilhasDir,
    toCadastro,
};
