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

            // TAXAS DO CANAL (SAÍDA)
            let icmsOut = 0, pisOut = 0, cofinsOut = 0;

            if (taxRegime === 'LUCRO_REAL') {
                pisOut = parseFloat(channel.pis_out_percent || 0);
                cofinsOut = parseFloat(channel.cofins_out_percent || 0);
                icmsOut = parseFloat(channel.icms_out_percent || 0);
            } else {
                icmsOut = parseFloat(channel.icms_out_percent || 0); 
            }

            // Custos Operacionais & Markup
            const commission = parseFloat(channel.commission_percent || 0);
            const marketing = parseFloat(channel.marketing_percent || 0);
            const fixedCost = parseFloat(channel.fixed_cost_allocation_percent || 0);
            const profit = parseFloat(channel.profit_margin_percent || 0);
            
            // NOVOS CAMPOS DE MARKUP (Financeiro e Administrativo)
            const financialCost = parseFloat(channel.financial_cost_percent || 0);
            const adminCost = parseFloat(channel.administrative_cost_percent || 0);

            const freightVal = parseFloat(channel.freight_value || 0);
            
            // Cálculo do Divisor
            const totalTaxPercent = icmsOut + pisOut + cofinsOut;
            // Somamos todos os custos operacionais (Comissão + Mkt + Fixo + Financeiro + Adm)
            const totalOpPercent = commission + marketing + fixedCost + financialCost + adminCost;
            
            const totalDeductions = (totalTaxPercent + totalOpPercent + profit) / 100;
            
            const divisor = 1 - totalDeductions;
            
            let finalPrice = 0;
            if (divisor > 0.05) { 
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
                    financeiro: financialCost,
                    administrativo: adminCost,
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