// ARQUIVO: src/pages/ProductManager.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Trash2, Edit3, X, Save, Layers, Beaker, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ProductManager = ({ companyId, selectedCompanyId, apiBase }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  const activeCompanyId = companyId || selectedCompanyId;

  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'materials'
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal de Novo Produto
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '' });

  // Estado para Cadastro de Novo Insumo/Material
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    ncm: '',
    price_national: '',
    price_imported: '',
    ipi_percent: '',
    is_national: true
  });

  // Modal da Ficha Técnica (BOM - Bill of Materials)
  const [isBOMModalOpen, setIsBOMModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [bomItems, setBomItems] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState('');
  
  const [saveStatus, setSaveStatus] = useState(null);

  // Token de autorização
  const getAuthHeader = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('hdl_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchData = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const config = getAuthHeader();
      const [prodRes, matRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/products-list?companyId=${activeCompanyId}`, config),
        axios.get(`${BASE_URL}/api/materials-full?companyId=${activeCompanyId}`, config)
      ]);
      setProducts(prodRes.data);
      setMaterials(matRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados do ProductManager:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (activeCompanyId) {
      fetchData(); 
    }
  }, [activeCompanyId]);

  // ─── GESTÃO DE PRODUTOS ────────────────────────────────────────────────
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${BASE_URL}/api/products`, 
        { company_id: activeCompanyId, name: newProduct.name, sku: newProduct.sku }, 
        getAuthHeader()
      );
      setIsProductModalOpen(false);
      setNewProduct({ name: '', sku: '' });
      fetchData();
    } catch (error) { 
      console.error(error);
      alert("Erro ao salvar produto."); 
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Deseja realmente excluir este produto e sua ficha técnica?")) return;
    try {
      await axios.delete(`${BASE_URL}/api/products/${id}`, getAuthHeader());
      fetchData();
    } catch (error) { alert("Erro ao excluir."); }
  };

  // ─── GESTÃO DE INSUMOS/MATERIAIS ────────────────────────────────────────
  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${BASE_URL}/api/materials`,
        {
          company_id: activeCompanyId,
          name: newMaterial.name,
          ncm: newMaterial.ncm || '',
          price_national: parseFloat(newMaterial.price_national) || 0,
          price_imported: parseFloat(newMaterial.price_imported) || 0,
          ipi_percent: parseFloat(newMaterial.ipi_percent) || 0,
          is_national: newMaterial.is_national ? 1 : 0
        },
        getAuthHeader()
      );
      setIsMaterialModalOpen(false);
      setNewMaterial({ name: '', ncm: '', price_national: '', price_imported: '', ipi_percent: '', is_national: true });
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Erro ao cadastrar insumo.");
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm("Deseja realmente excluir este insumo?")) return;
    try {
      await axios.delete(`${BASE_URL}/api/materials/${id}`, getAuthHeader());
      fetchData();
    } catch (error) {
      alert("Erro ao excluir insumo.");
    }
  };

  // ─── GESTÃO DE FICHA TÉCNICA (BOM) ─────────────────────────────────────
  const openBOMModal = async (product) => {
    setCurrentProduct(product);
    try {
      const res = await axios.get(`${BASE_URL}/api/product-boms/${product.id}`, getAuthHeader());
      setBomItems(res.data);
      setIsBOMModalOpen(true);
    } catch (error) {
      alert("Erro ao carregar Ficha Técnica.");
    }
  };

  const addMaterialToBOM = () => {
    if (!selectedMaterial || !selectedQuantity || Number(selectedQuantity) <= 0) return;
    
    const existingIndex = bomItems.findIndex(item => item.material_id === Number(selectedMaterial));
    if (existingIndex >= 0) {
        const newItems = [...bomItems];
        newItems[existingIndex].quantity = Number(newItems[existingIndex].quantity) + Number(selectedQuantity);
        setBomItems(newItems);
    } else {
        const materialObj = materials.find(m => m.id === Number(selectedMaterial));
        setBomItems([...bomItems, { 
            material_id: materialObj.id, 
            name: materialObj.name, 
            price_national: materialObj.price_national,
            quantity: Number(selectedQuantity) 
        }]);
    }
    setSelectedMaterial('');
    setSelectedQuantity('');
  };

  const removeMaterialFromBOM = (indexToRemove) => {
    setBomItems(bomItems.filter((_, idx) => idx !== indexToRemove));
  };

  const saveBOM = async () => {
    setSaveStatus('saving');
    try {
      await axios.post(`${BASE_URL}/api/product-boms`, {
          product_id: currentProduct.id,
          materials: bomItems.map(item => ({ material_id: item.material_id, quantity: item.quantity }))
      }, getAuthHeader());
      
      setSaveStatus('success');
      setTimeout(() => { setSaveStatus(null); setIsBOMModalOpen(false); }, 1500);
    } catch (error) {
      setSaveStatus('error');
      alert("Erro ao salvar Ficha Técnica.");
    }
  };

  const calculateTotalCost = () => {
    return bomItems.reduce((acc, item) => acc + (Number(item.price_national || 0) * Number(item.quantity || 0)), 0);
  };

  if (!activeCompanyId) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-slate-300">
        <Package size={64} className="mb-4 opacity-20"/>
        <p className="font-black uppercase tracking-widest text-xs">Selecione uma empresa para gerenciar o catálogo</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-500">
      
      {/* CABEÇALHO */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Package className="text-blue-600" /> Cadastro & Custos
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Gerencie seus produtos finais e as matérias-primas</p>
        </div>
        
        {/* SISTEMA DE ABAS PRINCIPAL */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('products')} 
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'products' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Produtos Finais
          </button>
          <button 
            onClick={() => setActiveTab('materials')} 
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'materials' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Insumos & Materiais
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
      ) : (
        <AnimatePresence mode="wait">
          
          {/* ABA 1: PRODUTOS (CÓDIGO ORIGINAL EXPANDIDO) */}
          {activeTab === 'products' && (
            <motion.div key="products-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs text-slate-400 font-black uppercase tracking-widest">Catálogo ({products.length})</span>
                <button onClick={() => setIsProductModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition active:scale-95 flex items-center gap-2">
                  <Plus size={16} /> Novo Produto
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <div key={product.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Package size={20} /></div>
                        <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                      </div>
                      <h3 className="font-black text-lg text-slate-800 tracking-tight leading-tight">{product.name}</h3>
                      <p className="text-xs font-mono font-bold text-slate-400 mt-1">SKU: {product.sku || 'N/A'}</p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-50">
                      <button onClick={() => openBOMModal(product)} className="w-full py-3 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest transition flex items-center justify-center gap-2">
                        <Layers size={16} /> Ficha Técnica
                      </button>
                    </div>
                  </div>
                ))}
                {products.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest">Nenhum produto cadastrado.</div>}
              </div>
            </motion.div>
          )}

          {/* ABA 2: INSUMOS / MATERIAIS (TELA DE CADASTRO NOVA!) */}
          {activeTab === 'materials' && (
            <motion.div key="materials-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs text-slate-400 font-black uppercase tracking-widest">Estoque de Insumos ({materials.length})</span>
                <button onClick={() => setIsMaterialModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition active:scale-95 flex items-center gap-2">
                  <Plus size={16} /> Novo Insumo
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Insumo / Matéria-Prima</th>
                      <th className="px-6 py-4">NCM</th>
                      <th className="px-6 py-4 text-center">Origem</th>
                      <th className="px-6 py-4 text-right">Preço Nacional</th>
                      <th className="px-6 py-4 text-right">IPI (%)</th>
                      <th className="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 font-medium text-sm">
                    {materials.map(mat => (
                      <tr key={mat.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4 font-bold text-slate-800">{mat.name}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">{mat.ncm || 'N/A'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${mat.is_national ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                            {mat.is_national ? 'Nacional' : 'Importado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">R$ {Number(mat.price_national || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-400">{Number(mat.ipi_percent || 0).toFixed(1)}%</td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => handleDeleteMaterial(mat.id)} className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {materials.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum insumo cadastrado para esta empresa.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}

      {/* ── MODAL: CADASTRAR PRODUTO ── */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl p-6 shadow-xl relative">
              <button onClick={() => setIsProductModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Package className="text-blue-600"/> Cadastrar Produto</h2>
              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Nome do Produto Final</label>
                  <input required autoFocus type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Ex: Bicicleta Aro 29" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">SKU / Código Interno</label>
                  <input type="text" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono" placeholder="Ex: BIKE-29-001" />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl mt-4 hover:bg-blue-700 transition active:scale-95">Salvar Produto</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: CADASTRAR INSUMO / MATERIAL ── */}
      <AnimatePresence>
        {isMaterialModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-xl relative">
              <button onClick={() => setIsMaterialModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Beaker className="text-blue-600"/> Cadastrar Insumo</h2>
              <form onSubmit={handleSaveMaterial} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Nome do Insumo</label>
                    <input required autoFocus type="text" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Ex: Quadro de Alumínio" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">NCM</label>
                    <input type="text" value={newMaterial.ncm} onChange={e => setNewMaterial({...newMaterial, ncm: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-center" placeholder="8714.91.00" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">IPI (%)</label>
                    <input type="number" step="0.1" value={newMaterial.ipi_percent} onChange={e => setNewMaterial({...newMaterial, ipi_percent: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-center" placeholder="10.0" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Preço (Nacional)</label>
                    <input required type="number" step="0.01" value={newMaterial.price_national} onChange={e => setNewMaterial({...newMaterial, price_national: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-center" placeholder="350.00" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Origem</label>
                    <select value={newMaterial.is_national} onChange={e => setNewMaterial({...newMaterial, is_national: e.target.value === 'true'})} className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
                      <option value="true">Nacional</option>
                      <option value="false">Importado</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl mt-4 hover:bg-blue-700 transition active:scale-95">Salvar Insumo</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: FICHA TÉCNICA (AMARRAR MATERIAIS) ── */}
      <AnimatePresence>
        {isBOMModalOpen && currentProduct && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
              
                  <div className="bg-slate-900 p-6 flex justify-between items-center shrink-0">
                    <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-1"><Beaker size={12}/> Ficha Técnica / Receita</p>
                      <h2 className="text-xl font-black text-white">{currentProduct.name}</h2>
                    </div>
                    <button onClick={() => setIsBOMModalOpen(false)} className="text-slate-400 hover:text-white transition"><X size={24} /></button>
                  </div>

                  <div className="p-6 bg-slate-50 border-b border-slate-100 flex gap-3 shrink-0">
                    <div className="flex-1">
                      <select value={selectedMaterial} onChange={e => setSelectedMaterial(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500">
                        <option value="" disabled>Selecionar Insumo / Material...</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} (R$ {Number(m.price_national).toFixed(2)})</option>)}
                      </select>
                    </div>
                    <div className="w-32">
                      <input type="number" step="0.0001" placeholder="Qtd." value={selectedQuantity} onChange={e => setSelectedQuantity(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 text-center font-mono" />
                    </div>
                    <button onClick={addMaterialToBOM} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition shadow-sm active:scale-95"><Plus size={20}/></button>
                  </div>

                  <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    {bomItems.length === 0 ? (
                      <div className="text-center py-10 opacity-50"><Layers size={40} className="mx-auto mb-3 text-slate-400"/><p className="font-bold text-slate-600">Nenhum insumo vinculado a este produto.</p></div>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <tr><th className="pb-3">Insumo</th><th className="pb-3 text-center">Quantidade</th><th className="pb-3 text-right">Custo Estimado</th><th className="pb-3"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {bomItems.map((item, idx) => (
                            <tr key={idx} className="group">
                              <td className="py-4 font-bold text-slate-700 text-sm">{item.name}</td>
                              <td className="py-4 text-center font-mono font-bold text-blue-600 bg-blue-50 rounded-lg">{Number(item.quantity).toFixed(2)}</td>
                              <td className="py-4 text-right font-mono font-bold text-slate-600">R$ {(item.quantity * (item.price_national || 0)).toFixed(2)}</td>
                              <td className="py-4 text-right pr-2"><button onClick={() => removeMaterialFromBOM(idx)} className="text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Bruto Materiais</p>
                      <p className="text-xl font-mono font-black text-slate-800">R$ {calculateTotalCost().toFixed(2)}</p>
                    </div>
                    <button onClick={saveBOM} disabled={saveStatus === 'saving'} className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 ${saveStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
                      {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'success' ? <><CheckCircle2 size={18}/> Salvo!</> : <><Save size={18}/> Gravar Ficha</>}
                    </button>
                  </div>

                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }` }} />
        </div>
      );
    };

    export default ProductManager;