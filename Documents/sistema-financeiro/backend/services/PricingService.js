const pool = require('../db');

class PricingService {
    
    async calculateProductPrice(productId, channelId) {
        try {
            // 1. Buscar regime tributário e dados do Produto
            const [products] = await pool.execute(
                'SELECT c.tax_regime, c.id as company_id FROM products p JOIN companies c ON p.company_id = c.id WHERE p.id = ?', 
                [productId]
            );
            
            if (products.length === 0) throw new Error('Produto/Empresa não encontrados');
            const taxRegime = products[0].tax_regime; 

            // 2. Buscar Canal de Venda
            const [channels] = await pool.execute('SELECT * FROM sales_channels WHERE id = ?', [channelId]);
            if (channels.length === 0) throw new Error('Canal de venda não encontrado');
            const channel = channels[0];

            // 3. Buscar Materiais (BOM)
            const [boms] = await pool.execute(`
                SELECT m.*, pb.quantity 
                FROM product_boms pb
                JOIN materials m ON pb.material_id = m.id
                WHERE pb.product_id = ?
            `, [productId]);

            let totalIndustrialCost = 0;

            // CUSTO INDUSTRIAL (ENTRADA)
            for (const item of boms) {
                const rawPrice = item.is_national ? parseFloat(item.price_national) : parseFloat(item.price_imported);
                const ipiVal = rawPrice * (parseFloat(item.ipi_percent) / 100);
                
                let netItemCost = 0;
                let credits = 0;

                if (taxRegime === 'SIMPLES') {
                    netItemCost = rawPrice + ipiVal;
                } else if (taxRegime === 'LUCRO_PRESUMIDO') {
                    const icmsCredit = rawPrice * 0.18; 
                    credits = icmsCredit;
                    netItemCost = (rawPrice + ipiVal) - icmsCredit;
                } else {
                    // LUCRO REAL
                    const pisCredit = rawPrice * 0.0165;
                    const cofinsCredit = rawPrice * 0.0760;
                    const icmsCredit = rawPrice * 0.18; 
                    credits = pisCredit + cofinsCredit + icmsCredit;
                    netItemCost = (rawPrice + ipiVal) - credits;
                }
                
                totalIndustrialCost += (netItemCost * item.quantity);
            }

            // TAXAS DO CANAL (SAÍDA) - BASEADO NA PLANILHA
            let icmsOut = 0, pisOut = 0, cofinsOut = 0;

            if (taxRegime === 'LUCRO_REAL') {
                pisOut = parseFloat(channel.pis_out_percent);
                cofinsOut = parseFloat(channel.cofins_out_percent);
                icmsOut = parseFloat(channel.icms_out_percent);
            } else {
                icmsOut = parseFloat(channel.icms_out_percent); // Simples/Presumido simplificado
            }

            // Custos Operacionais (Mapeando campos extras da planilha)
            // Se o campo não existir no banco ainda, assumimos 0 ou usamos campos genéricos
            const commission = parseFloat(channel.commission_percent);
            const marketing = parseFloat(channel.marketing_percent);
            const fixedCost = parseFloat(channel.fixed_cost_allocation_percent);
            const profit = parseFloat(channel.profit_margin_percent);
            
            // Novos campos implícitos (Financeiro, Pro-labore, Salários)
            // Como ainda não criamos colunas para eles, vamos somar no "Custo Fixo" temporariamente 
            // ou assumir um valor padrão se for B2B PR 1
            let extraOperational = 0;
            if (channel.name.includes('B2B') && channel.name.includes('PR')) {
                 // Valores aproximados da sua planilha para simulação
                 extraOperational = 4.00 + 2.40 + 33.79; // Financeiro + Pro-labore + Salários
            }

            const freightVal = parseFloat(channel.freight_value || 0);
            
            // Cálculo do Divisor
            const totalTaxPercent = icmsOut + pisOut + cofinsOut;
            const totalOpPercent = commission + marketing + fixedCost + extraOperational;
            const totalDeductions = (totalTaxPercent + totalOpPercent + profit) / 100;
            
            const divisor = 1 - totalDeductions;
            
            let finalPrice = 0;
            if (divisor > 0.05) { // Proteção contra divisor zero ou muito baixo
                finalPrice = (totalIndustrialCost + freightVal) / divisor;
            } else {
                finalPrice = 0; // Margem estourada
            }

            return {
                status: 'success',
                meta_dados: {
                    regime: taxRegime,
                    canal: channel.name,
                    divisor_aplicado: divisor.toFixed(4)
                },
                parametros_canal: {
                    icms_out: icmsOut,
                    pis_out: pisOut,
                    cofins_out: cofinsOut,
                    comissao: commission,
                    marketing: marketing,
                    custo_fixo: fixedCost,
                    extras_operacionais: extraOperational, // Financeiro/Salários
                    margem_lucro: profit,
                    frete_valor: freightVal
                },
                custos: {
                    industrial_total: totalIndustrialCost.toFixed(2),
                    frete: freightVal.toFixed(2)
                },
                resultado: {
                    preco_venda_sugerido: finalPrice.toFixed(2),
                    lucro_liquido_reais: (finalPrice * (profit/100)).toFixed(2)
                }
            };

        } catch (error) {
            throw error;
        }
    }
}

module.exports = new PricingService();