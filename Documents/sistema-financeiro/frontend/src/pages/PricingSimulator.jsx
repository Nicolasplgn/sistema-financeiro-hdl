import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Card, CardHeader } from '../components/ui/Card'; 
import { 
  Calculator, Tag, Truck, Percent, 
  AlertCircle, Package, Globe, 
  Loader2, Layers, Briefcase, Landmark, CheckCircle, Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PricingSimulator = ({ apiBase, selectedCompanyId }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;

  // --- ESTADOS ---
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  
  const [activeTab, setActiveTab] = useState('tributos'); 
  const [fetchingBase, setFetchingBase] = useState(false);
  
  const [sim, setSim] = useState({
    custoIndustrial: 0, frete: 0,
    icmsOut: 0, pisOut: 0, cofinsOut: 0,
    comissao: 0, marketing: 0, custoFixo: 0, 
    financeiro: 0, administrativo: 0,  
    margemLucro: 0
  });

  // --- CARREGAR DADOS INICIAIS ---
  useEffect(() => {
    if (!selectedCompanyId) return;
    const loadData = async () => {
      try {
        const [resProd, resChan] = await Promise.all([
          axios.get(`${BASE_URL}/api/products-list?companyId=${selectedCompanyId}`),
          axios.get(`${BASE_URL}/api/sales-channels?companyId=${selectedCompanyId}`)
        ]);
        setProducts(resProd.data);
        setChannels(resChan.data);
      } catch (err) { console.error(err); }
    };
    loadData();
  }, [selectedCompanyId, BASE_URL]);

  // --- CARREGAR DADOS AO SELECIONAR PRODUTO/CANAL ---
  useEffect(() => {
    if (!selectedProduct || !selectedChannel) return;
    const fetchBaseValues = async () => {
      setFetchingBase(true);
      try {
        const res = await axios.get(`${BASE_URL}/api/price-calc`, {
          params: { productId: selectedProduct, channelId: selectedChannel }
        });
        const data = res.data;
        if (data.status === 'success') {
            setSim({
              custoIndustrial: parseFloat(data.custos.industrial_total),
              frete: parseFloat(data.parametros_canal.frete_valor),
              icmsOut: parseFloat(data.parametros_canal.icms_out),
              pisOut: parseFloat(data.parametros_canal.pis_out),
              cofinsOut: parseFloat(data.parametros_canal.cofins_out),
              comissao: parseFloat(data.parametros_canal.comissao),
              marketing: parseFloat(data.parametros_canal.marketing),
              custoFixo: parseFloat(data.parametros_canal.custo_fixo),
              financeiro: parseFloat(data.parametros_canal.financeiro || 0),
              administrativo: parseFloat(data.parametros_canal.administrativo || 0),
              margemLucro: parseFloat(data.parametros_canal.margem_lucro)
            });
        }
      } catch (err) { console.error(err); } finally { setFetchingBase(false); }
    };
    fetchBaseValues();
  }, [selectedProduct, selectedChannel, BASE_URL]);

  // --- FUNÇÃO: CARREGAR PADRÃO (BASEADO NAS PLANILHAS) ---
  const handleLoadStandard = () => {
    if(!confirm("Aplicar o Padrão Industrial (Lucro Real)? Isso substituirá os valores atuais.")) return;
    
    setSim(prev => ({
        ...prev,
        // PADRÃO TRIBUTÁRIO (Baseado em seus CSVs)
        icmsOut: 12.00,  // Padrão PR ou Interestadual comum
        pisOut: 1.65,    // Lucro Real Padrão
        cofinsOut: 7.60, // Lucro Real Padrão
        
        // PADRÃO OPERACIONAL (Médias de mercado)
        comissao: 3.00,
        marketing: 2.00,
        custoFixo: 5.00,      // Estimativa base
        financeiro: 2.50,     // Antecipação/Juros
        administrativo: 4.00, // Folha ADM
        
        // MARGEM ALVO
        margemLucro: 15.00
    }));
  };

  // --- CÁLCULOS (Engine) ---
  const results = useMemo(() => {
    const totalImpostos = sim.icmsOut + sim.pisOut + sim.cofinsOut;
    const totalOperacional = sim.comissao + sim.marketing + sim.custoFixo + sim.financeiro + sim.administrativo;
    const totalDeducoesPerc = totalImpostos + totalOperacional + sim.margemLucro;
    const divisor = 1 - (totalDeducoesPerc / 100);

    let precoVenda = 0;
    let status = 'ok';
    if (divisor <= 0.01) status = 'erro';
    else precoVenda = (sim.custoIndustrial + sim.frete) / divisor; 

    const vImpostos = precoVenda * (totalImpostos / 100);
    const vOperacional = precoVenda * (totalOperacional / 100);
    const vLucro = precoVenda * (sim.margemLucro / 100);

    return { precoVenda, divisor, totalDeducoesPerc, vImpostos, vOperacional, vLucro, status };
  }, [sim]);

  // --- COMPONENTES VISUAIS INTERNOS ---
  const PricingInput = ({ label, value, onChange, icon: Icon, color = 'text-slate-400', suffix = '%' }) => (
    <div className="group bg-slate-50 p-4 rounded-2xl border border-slate-200 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 hover:shadow-md hover:border-slate-300">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2 group-focus-within:text-blue-600 transition-colors">
        {Icon && <Icon size={12} className={color}/>} {label}
      </label>
      <div className="flex items-center gap-2">
        {suffix === 'R$' && <span className="text-xs font-bold text-slate-400">R$</span>}
        <input 
          type="number" 
          step="0.01"
          value={value} 
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)} 
          className="w-full bg-transparent font-black text-slate-900 text-lg outline-none"
        />
        {suffix === '%' && <span className="text-xs font-bold text-slate-400">%</span>}
      </div>
    </div>
  );

  // --- RENDERIZAÇÃO ---
  if (!selectedCompanyId) return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-slate-300">
      <Calculator size={64} className="mb-4 opacity-20"/>
      <p className="font-black uppercase tracking-widest text-xs">Selecione uma empresa para iniciar</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 pb-32">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic flex items-center gap-3">
            <Tag className="text-blue-600" size={36}/> Simulador de Preços
          </h1>
          <p className="text-slate-400 font-medium text-xs mt-2 uppercase tracking-widest ml-1">
            Metodologia Markup Divisor (Inside Tax)
          </p>
        </div>
      </div>

      {/* SELETOR DE CONTEXTO */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-3 block ml-1">Produto Base (Ficha Técnica)</label>
            <div className="relative group">
              <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20}/>
              <select 
                value={selectedProduct} 
                onChange={(e) => setSelectedProduct(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <option value="">Selecione o Produto...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-3 block ml-1">Perfil de Venda (Canal)</label>
            <div className="relative group">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20}/>
              <select 
                value={selectedChannel} 
                onChange={(e) => setSelectedChannel(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <option value="">Selecione o Perfil...</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Card>

      <AnimatePresence mode='wait'>
        {(selectedProduct && selectedChannel && !fetchingBase) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* COLUNA ESQUERDA: PARÂMETROS */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* TABS E BOTÃO DE PADRÃO */}
              <div className="flex gap-2">
                  <div className="flex-1 flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
                    <button onClick={() => setActiveTab('tributos')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'tributos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Tributação</button>
                    <button onClick={() => setActiveTab('operacional')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'operacional' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Operacional</button>
                    <button onClick={() => setActiveTab('custos')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'custos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Custos Ind.</button>
                  </div>
                  
                  {/* BOTÃO DE PADRÃO INDUSTRIAL */}
                  <button 
                    onClick={handleLoadStandard}
                    className="bg-white border border-slate-200 text-blue-600 px-4 rounded-2xl shadow-sm hover:bg-blue-50 transition-all flex items-center justify-center tooltip-trigger"
                    title="Carregar Padrão Industrial (Reset)"
                  >
                    <Wand2 size={20} />
                  </button>
              </div>

              <Card className="min-h-[420px]">
                {activeTab === 'tributos' && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6"><Landmark size={18} className="text-blue-600"/> Impostos de Saída (Faturamento)</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <PricingInput label="ICMS (Saída)" value={sim.icmsOut} onChange={(v) => setSim({...sim, icmsOut: v})} color="text-blue-500" />
                      <PricingInput label="PIS" value={sim.pisOut} onChange={(v) => setSim({...sim, pisOut: v})} color="text-amber-500" />
                      <PricingInput label="COFINS" value={sim.cofinsOut} onChange={(v) => setSim({...sim, cofinsOut: v})} color="text-amber-500" />
                    </div>
                    <div className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-2"><Percent size={16} className="text-slate-400"/> Carga Tributária Total:</span> 
                      <span className="font-black text-lg text-slate-900">{(sim.icmsOut + sim.pisOut + sim.cofinsOut).toFixed(2)}%</span>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'operacional' && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6"><Layers size={18} className="text-rose-600"/> Despesas de Venda & Rateio</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <PricingInput label="Comissões" value={sim.comissao} onChange={v => setSim({...sim, comissao: v})} color="text-rose-500" />
                      <PricingInput label="Marketing" value={sim.marketing} onChange={v => setSim({...sim, marketing: v})} color="text-rose-500" />
                      <PricingInput label="Custo Fixo (Rateio)" value={sim.custoFixo} onChange={v => setSim({...sim, custoFixo: v})} color="text-slate-500" />
                      <PricingInput label="Financeiro (Juros)" value={sim.financeiro} onChange={(v) => setSim({...sim, financeiro: v})} icon={Briefcase} color="text-slate-500" />
                      <PricingInput label="Adm/Pessoal" value={sim.administrativo} onChange={(v) => setSim({...sim, administrativo: v})} icon={Briefcase} color="text-slate-500" />
                      <PricingInput label="Frete Médio" value={sim.frete} onChange={v => setSim({...sim, frete: v})} suffix="R$" icon={Truck} color="text-blue-500" />
                    </div>
                  </motion.div>
                )}

                {activeTab === 'custos' && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6"><Package size={18} className="text-emerald-600"/> Custo Industrial (BOM)</h3>
                    <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200 text-center">
                      <p className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-widest">Custo Base (Matéria Prima - Créditos)</p>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-lg font-black text-slate-400 mt-2">R$</span>
                        <input type="number" value={sim.custoIndustrial} onChange={(e) => setSim({...sim, custoIndustrial: parseFloat(e.target.value) || 0})} className="bg-transparent font-black text-5xl text-slate-900 outline-none w-48 text-center"/>
                      </div>
                      <p className="text-[10px] text-slate-400 italic flex items-center justify-center gap-1"><CheckCircle size={10}/> Recuperado automaticamente do cadastro</p>
                    </div>
                  </motion.div>
                )}
              </Card>
            </div>

            {/* COLUNA DIREITA: RESULTADOS */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* SLIDER DE MARGEM (CARD ESCURO) */}
              <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl group-hover:bg-blue-600/30 transition-all duration-700"/>
                
                <div className="relative z-10">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 block flex items-center gap-2">
                        <Tag size={14}/> Margem Líquida Alvo
                    </label>
                    <div className="flex items-baseline gap-2 mb-10">
                        <span className="text-7xl font-black tracking-tighter italic">{sim.margemLucro.toFixed(1)}%</span>
                        <span className="text-sm font-bold text-slate-500">sobre venda</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" max="60" step="0.5" 
                        value={sim.margemLucro} 
                        onChange={e => setSim({...sim, margemLucro: parseFloat(e.target.value)})}
                        className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                    />
                    <div className="flex justify-between mt-3 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        <span>Min 0%</span>
                        <span>Max 60%</span>
                    </div>
                </div>
              </div>

              {/* CARD DE RESULTADO FINAL */}
              <Card className={`border-2 transition-all duration-500 ${results.status === 'erro' ? 'border-rose-100 bg-rose-50' : 'border-emerald-100 bg-white'}`}>
                {results.status === 'erro' ? (
                  <div className="text-center py-10 animate-pulse">
                    <div className="inline-flex p-4 bg-rose-100 text-rose-600 rounded-full mb-4"><AlertCircle size={32}/></div>
                    <h3 className="text-xl font-black text-rose-700 tracking-tight">Margem Impraticável</h3>
                    <p className="text-rose-500 text-xs font-bold uppercase tracking-widest mt-2">Deduções ultrapassam 100%.</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-8">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Preço Sugerido de Venda</p>
                        <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">
                            {results.precoVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h2>
                        <div className="inline-flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Divisor: <span className="text-blue-600">{results.divisor.toFixed(4)}</span></span>
                            <div className="w-px h-3 bg-slate-200"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deduções: <span className="text-rose-500">{results.totalDeducoesPerc.toFixed(2)}%</span></span>
                        </div>
                    </div>

                    <div className="space-y-3 border-t border-slate-100 pt-6">
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-bold text-slate-500 uppercase tracking-wide">Custo Industrial + Frete</span>
                        <span className="font-black text-slate-700 bg-slate-50 px-2 py-1 rounded-lg">{(sim.custoIndustrial + sim.frete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-bold text-slate-500 uppercase tracking-wide">Impostos & Taxas</span>
                        <span className="font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">- {(results.vImpostos + results.vOperacional).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-4 mt-2 border-t border-dashed border-slate-200 items-center">
                        <span className="font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2"><Tag size={14}/> Lucro Real</span>
                        <span className="font-black text-emerald-600 text-lg bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">+ {results.vLucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOADER INICIAL DE DADOS DO PRODUTO */}
      {fetchingBase && (
        <div className="h-60 flex flex-col items-center justify-center text-blue-600 bg-white/50 backdrop-blur-sm rounded-[3rem] mt-8 border border-white/20 shadow-xl">
            <Loader2 size={40} className="animate-spin mb-4"/>
            <p className="font-black uppercase tracking-widest text-[10px]">Carregando Ficha Técnica...</p>
        </div>
      )}
    </div>
  );
};

export default PricingSimulator;