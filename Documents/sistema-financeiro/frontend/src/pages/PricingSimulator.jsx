import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Calculator, Tag, Truck, Percent, 
  TrendingUp, AlertCircle, CheckCircle2, 
  Package, Globe, ChevronRight, Loader2,
  Layers, Coins, Scale, Save, RotateCcw, Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PricingSimulator = ({ apiBase, selectedCompanyId }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;

  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [activeTab, setActiveTab] = useState('tributos'); 
  const [fetchingBase, setFetchingBase] = useState(false);
  
  // Estado da Simulação (Campos da Planilha)
  const [sim, setSim] = useState({
    custoIndustrial: 0,
    frete: 0,
    icmsOut: 0,
    pisOut: 0,
    cofinsOut: 0,
    comissao: 0,
    marketing: 0,
    custoFixo: 0,
    extrasOperacionais: 0, // Salários, Financeiro, Pro-labore
    margemLucro: 0
  });

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
              extrasOperacionais: parseFloat(data.parametros_canal.extras_operacionais || 0),
              margemLucro: parseFloat(data.parametros_canal.margem_lucro)
            });
        }
      } catch (err) { console.error(err); } finally { setFetchingBase(false); }
    };
    fetchBaseValues();
  }, [selectedProduct, selectedChannel, BASE_URL]);

  const results = useMemo(() => {
    const totalImpostos = sim.icmsOut + sim.pisOut + sim.cofinsOut;
    const totalOperacional = sim.comissao + sim.marketing + sim.custoFixo + sim.extrasOperacionais;
    const totalDeducoesPerc = totalImpostos + totalOperacional + sim.margemLucro;
    const divisor = 1 - (totalDeducoesPerc / 100);

    let precoVenda = 0;
    let status = 'ok';
    
    if (divisor <= 0.01) {
      status = 'erro';
    } else {
      precoVenda = (sim.custoIndustrial + sim.frete) / divisor;
    }

    const vImpostos = precoVenda * (totalImpostos / 100);
    const vOperacional = precoVenda * (totalOperacional / 100);
    const vLucro = precoVenda * (sim.margemLucro / 100);

    return { precoVenda, divisor, totalDeducoesPerc, vImpostos, vOperacional, vLucro, status };
  }, [sim]);

  const InputCell = ({ label, value, onChange, icon: Icon, color }) => (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
      <div className="flex justify-between items-center mb-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          {Icon && <Icon size={12} className={color}/>} {label}
        </label>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-transparent font-black text-slate-900 text-lg outline-none" step="0.01" />
        <span className="text-xs font-bold text-slate-400">%</span>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic flex items-center gap-3">
            <Calculator className="text-blue-600" size={32}/> Simulador de Preços
          </h1>
          <p className="text-slate-400 font-medium text-xs mt-1 uppercase tracking-widest">Baseado no Modelo Markup Divisor (Lucro Real)</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Produto (Ficha Técnica)</label>
            <div className="relative group">
              <Package className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20}/>
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer">
                <option value="">Selecione o Produto...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
        </div>
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Canal de Referência</label>
            <div className="relative group">
              <Globe className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20}/>
              <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer">
                <option value="">Selecione o Canal...</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
        </div>
      </div>

      <AnimatePresence mode='wait'>
        {(selectedProduct && selectedChannel && !fetchingBase) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                <button onClick={() => setActiveTab('tributos')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'tributos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Tributação</button>
                <button onClick={() => setActiveTab('operacional')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'operacional' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Operacional</button>
                <button onClick={() => setActiveTab('custos')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'custos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Custos Ind.</button>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 min-h-[400px]">
                {activeTab === 'tributos' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6"><Scale size={18} className="text-blue-600"/> Impostos de Saída</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InputCell label="ICMS Saída" value={sim.icmsOut} onChange={(v) => setSim({...sim, icmsOut: v})} color="text-blue-500" />
                      <InputCell label="PIS (Faturamento)" value={sim.pisOut} onChange={(v) => setSim({...sim, pisOut: v})} color="text-amber-500" />
                      <InputCell label="COFINS" value={sim.cofinsOut} onChange={(v) => setSim({...sim, cofinsOut: v})} color="text-amber-500" />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl text-blue-800 text-xs font-bold flex items-center gap-3"><Percent size={16}/> Carga Tributária: <span className="font-black text-lg">{(sim.icmsOut + sim.pisOut + sim.cofinsOut).toFixed(2)}%</span></div>
                  </motion.div>
                )}

                {activeTab === 'operacional' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6"><Layers size={18} className="text-rose-600"/> Despesas de Venda</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InputCell label="Comissões" value={sim.comissao} onChange={(v) => setSim({...sim, comissao: v})} color="text-rose-500" />
                      <InputCell label="Marketing / Ads" value={sim.marketing} onChange={(v) => setSim({...sim, marketing: v})} color="text-rose-500" />
                      <InputCell label="Custo Fixo (Rateio)" value={sim.custoFixo} onChange={(v) => setSim({...sim, custoFixo: v})} color="text-slate-500" />
                      <InputCell label="Extras (Salários/Financ)" value={sim.extrasOperacionais} onChange={(v) => setSim({...sim, extrasOperacionais: v})} icon={Briefcase} color="text-slate-500" />
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Truck size={12} className="text-slate-600"/> Frete Médio (R$)</label>
                        <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-400">R$</span><input type="number" value={sim.frete} onChange={(e) => setSim({...sim, frete: parseFloat(e.target.value) || 0})} className="w-full bg-transparent font-black text-slate-900 text-lg outline-none"/></div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'custos' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6"><Package size={18} className="text-emerald-600"/> Custo Industrial</h3>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-xs text-slate-500 mb-2 font-bold">Custo Base (Matéria Prima - Créditos)</p>
                      <div className="flex items-center gap-3"><span className="text-lg font-black text-slate-400">R$</span><input type="number" value={sim.custoIndustrial} onChange={(e) => setSim({...sim, custoIndustrial: parseFloat(e.target.value) || 0})} className="w-full bg-transparent font-black text-3xl text-slate-900 outline-none"/></div>
                      <p className="text-[10px] text-slate-400 mt-2 italic">* Valor calculado automaticamente.</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600 rounded-full blur-[80px] opacity-50"/>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Margem de Lucro Desejada</label>
                <div className="flex items-end gap-2 mb-6"><span className="text-5xl font-black tracking-tighter">{sim.margemLucro.toFixed(2)}%</span></div>
                <input type="range" min="0" max="50" step="0.1" value={sim.margemLucro} onChange={(e) => setSim({...sim, margemLucro: parseFloat(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
              </div>

              <div className={`p-8 rounded-[2.5rem] shadow-xl border transition-all duration-500 ${results.status === 'erro' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
                {results.status === 'erro' ? (
                  <div className="text-center py-10"><AlertCircle size={48} className="text-rose-500 mx-auto mb-4"/><h3 className="text-xl font-black text-rose-600">Margem Impossível</h3><p className="text-rose-400 text-sm mt-2">Deduções ultrapassam 100%.</p></div>
                ) : (
                  <>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Preço de Venda Sugerido</p>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-2">R$ {results.precoVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                    <div className="flex items-center gap-2 mb-8"><span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Divisor: {results.divisor.toFixed(4)}</span><span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Carga Total: {results.totalDeducoesPerc.toFixed(2)}%</span></div>
                    <div className="space-y-3 border-t border-slate-100 pt-6">
                      <div className="flex justify-between text-xs"><span className="font-bold text-slate-500">Impostos Pagos</span><span className="font-black text-rose-500">- R$ {results.vImpostos.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs"><span className="font-bold text-slate-500">Desp. Operacionais</span><span className="font-black text-rose-500">- R$ {results.vOperacional.toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs pt-2 border-t border-slate-50"><span className="font-black text-slate-800 uppercase tracking-widest">Lucro Líquido</span><span className="font-black text-emerald-600 text-lg">+ R$ {results.vLucro.toFixed(2)}</span></div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {fetchingBase && <div className="h-60 flex flex-col items-center justify-center text-blue-500"><Loader2 size={40} className="animate-spin mb-4"/><p className="font-black uppercase tracking-widest text-xs">Carregando Ficha Técnica...</p></div>}
    </div>
  );
};

export default PricingSimulator;