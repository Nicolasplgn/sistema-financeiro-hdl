'use strict';

/**
 * LEITOR DO BALANCETE EXPORTADO PELO QUESTOR
 * ---------------------------------------------------------------------------
 * Layout do relatório "Relatórios → Contábeis → Balancete (Texto) →
 * Balancete - Débito Crédito", exportado em "CSV (Somente os textos para abrir
 * no excel)", conforme o guia "Exportando os balancetes do sistema Questor":
 *
 *   0080  CIQ   05/10/2017 16:45 Pág:0001          ← empresa / emissão
 *   Período: 01/09/2017 a 30/09/2017
 *   Balancete – Societário
 *   Balancete
 *   Valores expressos em Reais (R$)
 *   Conta;S;Classificação;Saldo Ant.;;Débito;Crédito;Saldo
 *   1;S;1  ATIVO;233.921,03;;0;0;233.921,03       ← "S" = conta sintética
 *   5;;1.1.01.001.001  Caixa;3.423,27;;0;0;3.423,27
 *
 * As colunas são achadas pelo nome do cabeçalho (a coluna vazia entre
 * "Saldo Ant." e "Débito" pode ou não existir). A classificação e o nome da
 * conta vêm na mesma célula; se houver uma coluna "Descrição", ela é usada.
 *
 * O resultado do mês vem do MOVIMENTO (Débito e Crédito), não do saldo:
 *   receita = crédito − débito; custo, despesa e imposto = débito − crédito.
 * Só as contas analíticas são somadas (as sintéticas são os totais delas).
 *
 * O plano de contas muda de escritório para escritório, então a conta é
 * classificada pelo NOME dela e dos grupos acima dela (RECEITAS, DEDUÇÕES,
 * CUSTOS, DESPESAS…), e não por números fixos de classificação.
 */

/** Texto do arquivo: UTF-8 quando válido, senão Windows-1252/Latin-1 (padrão das exportações do Questor). */
const decodeText = (buffer) => {
    const utf8 = buffer.toString('utf8');
    const invalido = String.fromCharCode(0xfffd); // aparece quando o arquivo não é UTF-8
    const texto = utf8.includes(invalido) ? buffer.toString('latin1') : utf8;
    return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto; // remove o BOM
};

const clean = (v) => String(v ?? '').replace(/ /g, ' ').replace(/^"|"$/g, '').trim();
const norm = (v) => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ');

/** "233.921,03" | "0" | "(1.234,00)" | "1.234,00 D" | "-5,00" → número (null se não for número) */
function parseValue(raw) {
    let s = clean(raw);
    if (s === '' || s === '-') return s === '-' ? 0 : null;
    let sign = 1;
    if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
    const dc = s.match(/\s*([DC])$/i);
    if (dc) { if (dc[1].toUpperCase() === 'C') sign *= -1; s = s.slice(0, -dc[0].length); }
    if (s.startsWith('-')) { sign *= -1; s = s.slice(1); }
    s = s.replace(/R\$\s*/i, '').trim();
    if (!/^[\d.,]+$/.test(s)) return null;
    const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\.(?=\d{3}(\D|$))/g, ''));
    return Number.isFinite(n) ? sign * n : null;
}

function splitCsv(text) {
    const delimiter = (text.slice(0, 4000).match(/;/g) || []).length >= (text.slice(0, 4000).match(/,/g) || []).length / 2 ? ';' : ',';
    return text.replace(/^﻿/, '').split(/\r?\n/).map((line) => {
        const cols = [];
        let cur = '';
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
            else if (ch === delimiter && !quoted) { cols.push(cur); cur = ''; }
            else cur += ch;
        }
        cols.push(cur);
        return cols;
    });
}

/** Linha de cabeçalho: tem "Classificação" (ou "Conta") e as colunas de débito e crédito. */
function findHeader(rows) {
    for (let i = 0; i < Math.min(rows.length, 80); i++) {
        const cells = rows[i].map(norm);
        const has = (re) => cells.findIndex((c) => re.test(c));
        const deb = has(/^DEBITOS?$/);
        const cred = has(/^CREDITOS?$/);
        const cls = has(/^CLASSIFICACAO/);
        if (deb >= 0 && cred >= 0 && cls >= 0) {
            return {
                index: i,
                conta: has(/^CONTA$|^COD/),
                sintetica: cells.findIndex((c) => c === 'S' || c === 'T' || c === 'TIPO'),
                classificacao: cls,
                descricao: has(/^DESCRICAO|^NOME/),
                saldoAnterior: has(/^SALDO ANT/),
                debito: deb,
                credito: cred,
                saldo: cells.findIndex((c, idx) => /^SALDO( ATUAL| FINAL)?$/.test(c) && idx > cred),
            };
        }
    }
    return null;
}

function detect(text) {
    return Boolean(findHeader(splitCsv(text)));
}

function parsePeriod(text) {
    const m = text.match(/Per[ií]odo:?\s*(\d{2})\/(\d{2})\/(\d{4})\s*(?:a|at[ée]|-)\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (!m) return null;
    return { inicio: `${m[3]}-${m[2]}-${m[1]}`, fim: `${m[6]}-${m[5]}-${m[4]}`, mesInicio: `${m[3]}-${m[2]}`, mesFim: `${m[6]}-${m[5]}` };
}

// -----------------------------------------------------------------------------
// Classificação das contas de resultado → colunas do lançamento mensal
// -----------------------------------------------------------------------------

const RE = {
    patrimonial: /^(ATIVO|PASSIVO|PATRIMONIO|COMPENSA|CONTAS DE COMPENSA)/,
    encerramento: /APURACAO|ENCERRAMENTO|RESULTADO DO EXERCICIO|LUCROS? (OU PREJUIZOS? )?ACUMULADOS|TRANSFERENCIA DE RESULTADO/,
    deducao: /DEDUC|DEVOLUC|CANCELAMENT|ABATIMENT|IMPOSTOS? (E CONTRIBUICOES )?(INCIDENTES )?SOBRE (AS )?(VENDAS|FATURAMENTO|RECEITA)|TRIBUTOS SOBRE (VENDAS|RECEITA)/,
    devolucao: /DEVOLUC|CANCELAMENT|ABATIMENT|DESCONTOS? INCONDICIONA/,
    tributoLucro: /IMPOSTO DE RENDA|\bIRPJ\b|CONTRIBUICAO SOCIAL|\bCSLL\b|PROVISAO PARA (O )?(IR|IMPOSTO)/,
    custo: /\bCUSTOS?\b|\bCPV\b|\bCMV\b|\bCSP\b/,
    despesa: /DESPESA/,
    receita: /RECEITA|FATURAMENTO|VENDAS?\b/,
    receitaNaoOperacional: /FINANCEIR|NAO OPERACION|OUTRAS RECEITAS|RENDIMENT|JUROS|DESCONTOS? OBTIDO|GANHO|RECUPERAC|VARIACAO CAMBIAL ATIVA|ALIENACAO/,
    emprestimo: /EMPRESTIMO|FINANCIAMENTO/,
};

function taxColumn(desc) {
    if (/DIFAL|DIFERENCIAL DE ALIQUOTA/.test(desc)) return 'tax_difal';
    if (/\bICMS\b|SIMPLES|\bDAS\b/.test(desc)) return 'tax_icms';
    if (/\bPIS\b/.test(desc)) return 'tax_pis';
    if (/COFINS/.test(desc)) return 'tax_cofins';
    if (/\bISS\b|ISSQN/.test(desc)) return 'tax_iss';
    if (/\bFUST\b/.test(desc)) return 'tax_fust';
    if (/FUNTTEL|FUNTEL/.test(desc)) return 'tax_funtell';
    return null;
}

function revenueColumn(text) {
    if (/SERVIC/.test(text)) return 'revenue_service';
    if (/REVENDA|MERCADORIA/.test(text)) return 'revenue_resale';
    if (/ALUGUE|LOCAC/.test(text)) return 'revenue_rent';
    return 'revenue_product';
}

/**
 * @returns {{column, value, entryType, description, rule}|null}
 * value positivo = aumenta a coluna (receita na receita, despesa na despesa).
 */
function classify(account) {
    const own = norm(account.descricao);
    const path = account.caminho.map(norm);
    const top = path[0] || own;
    const all = [...path, own].join(' / ');
    const description = `${account.classificacao} ${clean(account.descricao)}`.trim();
    const devedor = account.debito - account.credito; // natureza devedora (custo/despesa/imposto)
    const credor = -devedor;                           // natureza credora (receita)
    const mk = (column, value, entryType, rule) => ({ column, value, entryType, description, rule });

    if (RE.patrimonial.test(top)) {
        // Pagamentos de empréstimos e financiamentos: saem do caixa, não do resultado.
        if (/^PASSIVO/.test(top) && RE.emprestimo.test(all) && account.debito > 0) {
            return mk('patrimonial_movements', account.debito, 'EXPENSE', 'Pagamento de empréstimo/financiamento (fora do resultado)');
        }
        return null;
    }
    if (RE.encerramento.test(all)) return null;

    if (RE.deducao.test(all) && !RE.tributoLucro.test(all)) {
        const tax = taxColumn(own) || taxColumn(all);
        if (tax) return mk(tax, devedor, 'EXPENSE', 'Dedução da receita (imposto sobre vendas)');
        // Devoluções, cancelamentos, abatimentos e IPI destacado: reduzem a receita.
        return mk(revenueColumn(all), -devedor, 'REVENUE', 'Dedução da receita (devolução/abatimento) abatida da receita');
    }
    if (RE.tributoLucro.test(all)) {
        if (/CONTRIBUICAO SOCIAL|CSLL/.test(own) || (!/IMPOSTO DE RENDA|IRPJ/.test(own) && /CONTRIBUICAO SOCIAL|CSLL/.test(all))) {
            return mk('tax_csll', devedor, 'EXPENSE', 'CSLL sobre o lucro');
        }
        return mk(/ADICIONAL/.test(own) ? 'tax_additional_irpj' : 'tax_irpj', devedor, 'EXPENSE', 'IRPJ sobre o lucro');
    }
    // Decide pelo nome mais próximo da conta: a própria conta, depois o grupo
    // logo acima, e assim por diante. Grupos ambíguos ("CUSTOS E DESPESAS",
    // "RECEITAS E DESPESAS FINANCEIRAS") passam a decisão para o nível de cima.
    for (const seg of [own, ...path.slice().reverse()]) {
        const c = RE.custo.test(seg);
        const d = RE.despesa.test(seg);
        const r = RE.receita.test(seg);
        if (c && !d && !r) return mk('purchases_total', devedor, 'EXPENSE', 'Custo das vendas');
        if (d && !c && !r) return mk('expenses_total', devedor, 'EXPENSE', 'Despesa operacional');
        if (r && !c && !d) {
            if (RE.receitaNaoOperacional.test(all)) return mk('revenue_other', credor, 'REVENUE', 'Receita financeira / outras receitas');
            return mk(revenueColumn(all), credor, 'REVENUE', 'Receita operacional');
        }
    }
    // Conta de resultado sem nome reconhecível: decide pela natureza do movimento.
    return devedor >= 0
        ? mk('expenses_total', devedor, 'EXPENSE', 'Classificada como despesa pelo saldo devedor')
        : mk('revenue_other', credor, 'REVENUE', 'Classificada como outra receita pelo saldo credor');
}

/**
 * Lê o CSV do Questor.
 * @returns {{ layout, empresa, periodo, accounts, mapped, audit }}
 */
function parse(text) {
    const rows = splitCsv(text);
    const h = findHeader(rows);
    if (!h) throw new Error('Não encontrei o cabeçalho do balancete (Conta / Classificação / Débito / Crédito).');

    const periodo = parsePeriod(text);
    // Primeira linha do relatório: "0080  NOME DA EMPRESA   05/10/2017 16:45 Pág:0001"
    const firstLine = rows.slice(0, h.index).map((r) => clean(r.filter((c) => clean(c)).join(' '))).find((l) => l && !/^Per[ií]odo/i.test(l));
    const empresa = firstLine ? firstLine.replace(/\s*\d{2}\/\d{2}\/\d{4}.*$/, '').replace(/^\d+\s+/, '').replace(/\s+/g, ' ').trim() || null : null;

    const accounts = [];
    for (let i = h.index + 1; i < rows.length; i++) {
        const r = rows[i];
        const clsCell = clean(r[h.classificacao]);
        const m = clsCell.match(/^(\d+(?:[.\-]\d+)*)\s*(.*)$/);
        if (!m) continue; // linhas em branco, quebras de página, cabeçalhos repetidos
        const debito = parseValue(r[h.debito]);
        const credito = parseValue(r[h.credito]);
        if (debito === null && credito === null) continue;
        const descricao = h.descricao >= 0 && clean(r[h.descricao]) ? clean(r[h.descricao]) : clean(m[2]);
        const marca = h.sintetica >= 0 ? norm(r[h.sintetica]) : '';
        accounts.push({
            conta: h.conta >= 0 ? clean(r[h.conta]) : '',
            classificacao: m[1],
            descricao,
            sinteticaMarcada: marca === 'S' || marca === 'T',
            saldoAnterior: parseValue(r[h.saldoAnterior]) ?? 0,
            debito: Math.abs(debito ?? 0),
            credito: Math.abs(credito ?? 0),
            saldo: h.saldo >= 0 ? parseValue(r[h.saldo]) ?? 0 : null,
        });
    }
    if (accounts.length === 0) throw new Error('O balancete não tem contas com valores de débito e crédito.');

    // Sintética = marcada com "S" ou que tem contas abaixo dela na classificação.
    const byCls = new Map(accounts.map((a) => [a.classificacao, a]));
    const isParent = (a) => accounts.some((b) => b !== a && b.classificacao.startsWith(`${a.classificacao}.`));
    for (const a of accounts) {
        a.sintetica = a.sinteticaMarcada || isParent(a);
        const parts = a.classificacao.split('.');
        a.caminho = parts.slice(0, -1).map((_, i) => byCls.get(parts.slice(0, i + 1).join('.'))?.descricao).filter(Boolean);
    }

    const analiticas = accounts.filter((a) => !a.sintetica);
    const mapped = [];
    const audit = { contas_lidas: accounts.length, analiticas: analiticas.length, usadas: 0, patrimoniais_ignoradas: 0, por_saldo: [], regras: {} };
    for (const a of analiticas) {
        const c = classify(a);
        if (!c) { audit.patrimoniais_ignoradas++; continue; }
        if (Math.abs(c.value) < 0.005) continue;
        mapped.push(c);
        audit.usadas++;
        audit.regras[c.rule] = (audit.regras[c.rule] || 0) + 1;
        if (/pelo saldo/.test(c.rule)) audit.por_saldo.push(c.description);
    }

    // Conferência: o movimento das contas analíticas tem de fechar com o das
    // sintéticas de primeiro nível (os totais do próprio Questor).
    const level1 = accounts.filter((a) => !a.classificacao.includes('.') && a.sintetica);
    if (level1.length > 0) {
        const sum = (list, k) => list.reduce((s, a) => s + a[k], 0);
        audit.conferencia = {
            debito_analiticas: sum(analiticas, 'debito'),
            debito_totais: sum(level1, 'debito'),
            credito_analiticas: sum(analiticas, 'credito'),
            credito_totais: sum(level1, 'credito'),
        };
        audit.conferencia.confere = Math.abs(audit.conferencia.debito_analiticas - audit.conferencia.debito_totais) < 0.05
            && Math.abs(audit.conferencia.credito_analiticas - audit.conferencia.credito_totais) < 0.05;
    }

    return { layout: 'questor', empresa, periodo, accounts, mapped, audit };
}

module.exports = { decodeText, detect, parse, parseValue, parsePeriod, classify };
