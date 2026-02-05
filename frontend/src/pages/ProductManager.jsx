import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Package, Box, Plus, Trash2, Search, Save, 
  DollarSign, Barcode, FileText, CheckCircle2, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

const ProductManager = ({ apiBase, selectedCompanyId }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  
  const [activeTab, setActiveTab] = useState('materials');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  
  const [matForm, setMatForm] = useState({ name: '', ncm: '', price_national: '', price_imported: '', ipi_percent: '', is_national: true });
  const [prodForm, setProdForm] = useState({ name: '', sku: '' });

  const fetchData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const endpoint = activeTab === 'materials' ? '/api/materials-full' : '/api/products-list';
      const res = await axios.get(`${BASE_URL}${endpoint}?companyId=${selectedCompanyId}`);
      setList(res.data);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [selectedCompanyId, activeTab]);

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${BASE_URL}/api/materials`, { ...matForm, company_id: selectedCompanyId });
      setMatForm({ name: '', ncm: '', price_national: '', price_imported: '', ipi_percent: '', is_national: true });
      fetchData();
    } catch (error) { alert('Erro ao salvar'); }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${BASE_URL}/api/products`, { ...prodForm, company_id: selectedCompanyId });
      setProdForm({ name: '', sku: '' });
      fetchData();
    } catch (error) { alert('Erro ao salvar'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza? Isso afeta o cálculo.')) return;
    try {
      const endpoint = activeTab === 'materials' ? `/api/materials/${id}` : `/api/products/${id}`;
      await axios.delete(`${BASE_URL}${endpoint}`);
      fetchData();
    } catch (error) { alert('Erro ao deletar'); }
  };

  if (!selectedCompanyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><Package size={48} className="mb-4 opacity-20"/><p>Selecione uma empresa.</p></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic flex items-center gap-3">
            <Box className="text-blue-600" size={32}/> Gestão de Cadastro
          </h1>
          <p className="text-slate-400 font-medium text-xs mt-1 uppercase tracking-widest">
            Produtos Acabados & Insumos
          </p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <button onClick={() => setActiveTab('materials')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'materials' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Box size={16}/> Insumos / Peças
            </button>
            <button onClick={() => setActiveTab('products')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'products' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Package size={16}/> Produtos Finais
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 sticky top-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Plus size={18} className="text-emerald-500"/> Novo {activeTab === 'materials' ? 'Insumo' : 'Produto'}
                </h3>
                {activeTab === 'materials' ? (
                    <form onSubmit={handleSaveMaterial} className="space-y-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Nome</label><input required type="text" value={matForm.name} onChange={e => setMatForm({...matForm, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-700 outline-none" placeholder="Ex: Pedal"/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">NCM</label><input type="text" value={matForm.ncm} onChange={e => setMatForm({...matForm, ncm: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-mono font-bold" placeholder="0000.00"/></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">IPI %</label><input type="number" step="0.01" value={matForm.ipi_percent} onChange={e => setMatForm({...matForm, ipi_percent: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold" placeholder="0.00"/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">R$ Nacional</label><input type="number" step="0.01" value={matForm.price_national} onChange={e => setMatForm({...matForm, price_national: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-emerald-600" placeholder="0.00"/></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">R$ Imp.</label><input type="number" step="0.01" value={matForm.price_imported} onChange={e => setMatForm({...matForm, price_imported: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-blue-600" placeholder="0.00"/></div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"><input type="checkbox" checked={matForm.is_national} onChange={e => setMatForm({...matForm, is_national: e.target.checked})} className="w-5 h-5 accent-blue-600 rounded cursor-pointer"/><span className="text-xs font-bold text-slate-500">Origem Nacional?</span></div>
                        <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"><Save size={16}/> Salvar</button>
                    </form>
                ) : (
                    <form onSubmit={handleSaveProduct} className="space-y-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Nome da Bike</label><input required type="text" value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-bold text-slate-700 outline-none" placeholder="Ex: Bike MTB"/></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">SKU</label><input type="text" value={prodForm.sku} onChange={e => setProdForm({...prodForm, sku: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 font-mono font-bold" placeholder="COD-001"/></div>
                        <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"><Save size={16}/> Salvar</button>
                    </form>
                )}
            </div>
        </div>
        <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Cadastrados</h3>
                    <span className="text-[10px] font-bold text-slate-300">{list.length} itens</span>
                </div>
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                    {loading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-300"/></div> : list.length === 0 ? <div className="p-10 text-center text-slate-300 text-xs font-bold uppercase">Vazio</div> : (
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-slate-50">
                                {list.map((item) => (
                                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="p-5"><p className="font-bold text-slate-700 text-sm">{item.name}</p></td>
                                        {activeTab === 'materials' && <td className="p-5 text-right"><p className="text-sm font-mono font-black text-emerald-600">R$ {Number(item.price_national).toFixed(2)}</p></td>}
                                        <td className="p-5 text-right"><button onClick={() => handleDelete(item.id)} className="p-2 text-slate-300 hover:text-rose-500 rounded-xl transition-all"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProductManager;