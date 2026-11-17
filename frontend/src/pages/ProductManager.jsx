// ARQUIVO: src/pages/ProductManager.jsx
// Cadastro de produtos, insumos e FICHA TECNICA, com as colunas da planilha:
// valor importado/nacional sem IPI, % IPI, valor com IPI, créditos de PIS,
// COFINS, IPI e ICMS e os custos Lucro Real / Lucro Presumido.
// Os cálculos vêm do backend; a tela só edita o cadastro.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Plus, Trash2, Pencil, X, Layers, Beaker, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createPricingApi, errorMessage } from '../services/pricingApi';
import { brl, pct, qty, toNumber, REGIME_LABEL } from '../utils/format';

const emptyMaterial = { id: null, name: '', ncm: '', price: '', ipi_percent: '', is_national: true };
const emptyProduct = { id: null, name: '', sku: '' };
const money = (v) => brl(v).replace('R$', '').trim();
const inputValue = (v) => (v === null || v === undefined || v === '' ? '' : String(Number(v)).replace('.', ','));

const Modal = ({ children, onClose, wide = false }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      className={`bg-white w-full ${wide ? 'max-w-7xl' : 'max-w-lg'} rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200`}
    >
      {children}
    </div>
  </div>
);

const Field = ({ label, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</span>
    {children}
  </label>
);

const inputClass = 'w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 font-bold text-slate-700 text-sm outline-none focus:border-blue-500';

const ProductManager = ({ companyId, selectedCompanyId, apiBase }) => {
  const activeCompanyId = companyId || selectedCompanyId;
  const api = useMemo(() => createPricingApi(apiBase), [apiBase]);

  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [regime, setRegime] = useState('LUCRO_REAL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const [productForm, setProductForm] = useState(null);
  const [materialForm, setMaterialForm] = useState(null);

  // Ficha técnica aberta: { produto, regime, ficha } devolvido pelo backend.
  const [ficha, setFicha] = useState(null);
  const [fichaSaving, setFichaSaving] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState('1');

  const fail = (error, fallback) => setFeedback({ type: 'erro', text: errorMessage(error, fallback) });

  const fetchData = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const params = { companyId: activeCompanyId };
      const [prodRes, matRes, painelRes] = await Promise.all([
        api.get('/products-list', { params }),
        api.get('/materials-full', { params }),
        api.get('/pricing/painel', { params }),
      ]);
      setProducts(prodRes.data);
      setMaterials(matRes.data);
      setRegime(painelRes.data.regime);
    } catch (error) {
      fail(error, 'Erro ao carregar o cadastro.');
    } finally {
      setLoading(false);
    }
  }, [api, activeCompanyId]);

  useEffect(() => { setFeedback(null); fetchData(); }, [fetchData]);

  // ─── PRODUTOS ──────────────────────────────────────────────────────────
  const saveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = { company_id: activeCompanyId, name: productForm.name, sku: productForm.sku };
      if (productForm.id) await api.put(`/products/${productForm.id}`, payload);
      else await api.post('/products', payload);
      setProductForm(null);
      fetchData();
    } catch (error) { fail(error, 'Erro ao salvar o produto.'); }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Excluir "${product.name}" e a ficha técnica dele?`)) return;
    try { await api.delete(`/products/${product.id}`); fetchData(); }
    catch (error) { fail(error, 'Erro ao excluir o produto.'); }
  };

  // ─── INSUMOS ───────────────────────────────────────────────────────────
  const saveMaterial = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        company_id: activeCompanyId,
        name: materialForm.name,
        ncm: materialForm.ncm,
        price: toNumber(materialForm.price),
        ipi_percent: toNumber(materialForm.ipi_percent),
        is_national: materialForm.is_national,
      };
      if (materialForm.id) await api.put(`/materials/${materialForm.id}`, payload);
      else await api.post('/materials', payload);
      setMaterialForm(null);
      fetchData();
    } catch (error) { fail(error, 'Erro ao salvar o insumo.'); }
  };

  const deleteMaterial = async (material) => {
    if (!window.confirm(`Excluir o insumo "${material.name}"?`)) return;
    try { await api.delete(`/materials/${material.id}`); fetchData(); }
    catch (error) { fail(error, 'Erro ao excluir o insumo.'); }
  };

  // ─── FICHA TÉCNICA ─────────────────────────────────────────────────────
  const openFicha = async (product) => {
    try {
      const res = await api.get(`/pricing/ficha/${product.id}`);
      setFicha(res.data);
      setSelectedMaterial('');
      setSelectedQuantity('1');
    } catch (error) { fail(error, 'Erro ao carregar a ficha técnica.'); }
  };

  /** Regrava a ficha inteira e recebe de volta todas as colunas recalculadas. */
  const saveFicha = async (lines) => {
    setFichaSaving(true);
    try {
      const res = await api.post('/product-boms', { product_id: ficha.produto.id, materials: lines });
      setFicha(res.data);
    } catch (error) {
      fail(error, 'Erro ao gravar a ficha técnica.');
    } finally {
      setFichaSaving(false);
    }
  };

  const currentLines = () => ficha.ficha.linhas.map((l) => ({ material_id: l.material_id, quantity: l.quantidade }));

  const addLine = () => {
    const materialId = Number(selectedMaterial);
    const quantity = toNumber(selectedQuantity);
    if (!materialId || quantity <= 0) return;
    const lines = currentLines();
    const existing = lines.find((l) => l.material_id === materialId);
    if (existing) existing.quantity += quantity; else lines.push({ material_id: materialId, quantity });
    setSelectedMaterial('');
    setSelectedQuantity('1');
    saveFicha(lines);
  };

  const removeLine = (index) => saveFicha(currentLines().filter((_, i) => i !== index));

  const changeQuantity = (index, value) => {
    const quantity = toNumber(value);
    const lines = currentLines();
    if (quantity <= 0 || quantity === lines[index].quantity) return;
    lines[index].quantity = quantity;
    saveFicha(lines);
  };

  const closeFicha = () => { setFicha(null); fetchData(); };

  if (!activeCompanyId) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-slate-300">
        <Package size={64} className="mb-4 opacity-20" />
        <p className="font-black uppercase tracking-widest text-xs">Selecione uma empresa para gerenciar o catálogo</p>
      </div>
    );
  }

  const t = ficha?.ficha.totais;
  const custos = ficha?.ficha.custos;

  return (
    <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-500 pb-32">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><Package className="text-blue-600" /> Cadastro & Custos</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Produtos, insumos e ficha técnica · custo no regime {REGIME_LABEL[regime]}</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {[['products', 'Produtos finais'], ['materials', 'Insumos & materiais']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === id ? 'bg-white text-slate-800 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{label}</button>
          ))}
        </div>
      </header>

      {feedback && (
        <div className={`mb-6 flex items-start justify-between gap-3 p-4 rounded-2xl border text-sm font-bold ${feedback.type === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
          <span className="flex items-start gap-2">{feedback.type === 'ok' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}{feedback.text}</span>
          <button onClick={() => setFeedback(null)} aria-label="Fechar aviso"><X size={16} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
      ) : activeTab === 'products' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs text-slate-400 font-black uppercase tracking-widest">Catálogo ({products.length})</span>
            <button onClick={() => setProductForm({ ...emptyProduct })} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition flex items-center gap-2"><Plus size={16} /> Novo produto</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, index) => (
              <div key={product.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl font-mono font-black text-xs">{index + 1} · {product.sku || 'sem código'}</div>
                    <div className="flex gap-2">
                      <button onClick={() => setProductForm({ id: product.id, name: product.name, sku: product.sku || '' })} className="text-slate-300 hover:text-blue-600" aria-label={`Editar ${product.name}`}><Pencil size={16} /></button>
                      <button onClick={() => deleteProduct(product)} className="text-slate-300 hover:text-rose-500" aria-label={`Excluir ${product.name}`}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <h3 className="font-black text-base text-slate-800 tracking-tight leading-tight">{product.name}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Custo de compra</p>
                      <p className="font-mono font-black text-slate-900">{product.itens > 0 ? brl(product.custo) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Componentes</p>
                      <p className="font-mono font-black text-slate-900">{product.itens}</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => openFicha(product)} className="mt-5 w-full py-3 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest transition flex items-center justify-center gap-2"><Layers size={16} /> Ficha técnica</button>
              </div>
            ))}
            {products.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum produto cadastrado.</div>}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs text-slate-400 font-black uppercase tracking-widest">Insumos ({materials.length})</span>
            <button onClick={() => setMaterialForm({ ...emptyMaterial })} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition flex items-center gap-2"><Plus size={16} /> Novo insumo</button>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Insumo / matéria-prima</th>
                  <th className="px-4 py-4">NCM</th>
                  <th className="px-4 py-4 text-center">Origem</th>
                  <th className="px-4 py-4 text-right">Valor sem IPI</th>
                  <th className="px-4 py-4 text-right">IPI</th>
                  <th className="px-4 py-4 text-center">Fichas</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700 font-medium text-sm">
                {materials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-bold text-slate-800">{mat.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{mat.ncm || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${mat.is_national ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{mat.is_national ? 'Nacional' : 'Importado'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">{brl(mat.price, mat.price !== 0 && Math.abs(mat.price) < 1 ? 3 : 2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">{pct(Number(mat.ipi_percent))}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">{mat.used_in}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setMaterialForm({ id: mat.id, name: mat.name, ncm: mat.ncm || '', price: inputValue(mat.price), ipi_percent: inputValue(mat.ipi_percent), is_national: Boolean(mat.is_national) })} className="p-2 text-slate-300 hover:text-blue-600" aria-label={`Editar ${mat.name}`}><Pencil size={15} /></button>
                      <button onClick={() => deleteMaterial(mat)} className="p-2 text-slate-300 hover:text-rose-500" aria-label={`Excluir ${mat.name}`}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
                {materials.length === 0 && <tr><td colSpan="7" className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum insumo cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <>
        {/* ── MODAL: PRODUTO ── */}
        {productForm && (
          <Modal onClose={() => setProductForm(null)}>
            <form onSubmit={saveProduct} className="p-8 space-y-4">
              <h2 className="text-xl font-black flex items-center gap-2 text-slate-900"><Package className="text-blue-600" /> {productForm.id ? 'Editar produto' : 'Novo produto'}</h2>
              <Field label="Nome do produto final"><input required autoFocus value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className={inputClass} placeholder="Ex.: Bicicleta Aro 29 KRW Alumínio 24 Vel" /></Field>
              <Field label="Código / modelo"><input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} className={`${inputClass} font-mono`} placeholder="Ex.: X52" /></Field>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setProductForm(null)} className="flex-1 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── MODAL: INSUMO ── */}
        {materialForm && (
          <Modal onClose={() => setMaterialForm(null)}>
            <form onSubmit={saveMaterial} className="p-8 space-y-4">
              <h2 className="text-xl font-black flex items-center gap-2 text-slate-900"><Beaker className="text-blue-600" /> {materialForm.id ? 'Editar insumo' : 'Novo insumo'}</h2>
              <Field label="Componente / matéria-prima"><input required autoFocus value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} className={inputClass} placeholder="Ex.: Quadro KRW" /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="NCM"><input value={materialForm.ncm} onChange={(e) => setMaterialForm({ ...materialForm, ncm: e.target.value })} className={`${inputClass} font-mono`} placeholder="8714.91.00" /></Field>
                <Field label="Origem">
                  <select value={materialForm.is_national ? 'nacional' : 'importado'} onChange={(e) => setMaterialForm({ ...materialForm, is_national: e.target.value === 'nacional' })} className={`${inputClass} cursor-pointer`}>
                    <option value="nacional">Nacional (crédito de ICMS nacional)</option>
                    <option value="importado">Importado (crédito de ICMS importado)</option>
                  </select>
                </Field>
                <Field label="Valor sem IPI (R$)"><input required inputMode="decimal" value={materialForm.price} onChange={(e) => setMaterialForm({ ...materialForm, price: e.target.value })} className={`${inputClass} font-mono text-right`} placeholder="140,06" /></Field>
                <Field label="IPI (%)"><input inputMode="decimal" value={materialForm.ipi_percent} onChange={(e) => setMaterialForm({ ...materialForm, ipi_percent: e.target.value })} className={`${inputClass} font-mono text-right`} placeholder="6,5" /></Field>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMaterialForm(null)} className="flex-1 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── MODAL: FICHA TÉCNICA ── */}
        {ficha && (
          <Modal wide onClose={closeFicha}>
            <div className="bg-slate-900 p-6 flex justify-between items-center shrink-0">
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-1"><Beaker size={12} /> Ficha técnica {ficha.produto.sku ? `· ${ficha.produto.sku}` : ''}</p>
                <h2 className="text-xl font-black text-white">{ficha.produto.name}</h2>
              </div>
              <div className="flex items-center gap-4">
                {fichaSaving && <span className="text-[11px] font-bold text-blue-300 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Recalculando…</span>}
                <button onClick={closeFicha} className="text-slate-400 hover:text-white" aria-label="Fechar ficha técnica"><X size={24} /></button>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3 shrink-0">
              <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500">
                <option value="">Adicionar componente…</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} — {brl(m.price)} ({m.is_national ? 'nacional' : 'importado'}, IPI {pct(Number(m.ipi_percent))})</option>)}
              </select>
              <input inputMode="decimal" placeholder="Qtd." value={selectedQuantity} onChange={(e) => setSelectedQuantity(e.target.value)} className="md:w-28 bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 text-center font-mono" aria-label="Quantidade" />
              <button onClick={addLine} disabled={!selectedMaterial || fichaSaving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-3 rounded-xl transition flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest"><Plus size={16} /> Adicionar</button>
            </div>

            <div className="flex-1 overflow-auto">
              {ficha.ficha.linhas.length === 0 ? (
                <div className="text-center py-16 text-slate-400"><Layers size={40} className="mx-auto mb-3" /><p className="font-bold">Nenhum componente nesta ficha.</p></div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <tr>
                      <th className="text-left px-5 py-3 min-w-[220px]">Componente</th>
                      <th className="text-left px-2 py-3">NCM</th>
                      <th className="text-center px-2 py-3">Qtd.</th>
                      <th className="text-right px-2 py-3">Importado s/ IPI</th>
                      <th className="text-right px-2 py-3">Nacional s/ IPI</th>
                      <th className="text-right px-2 py-3">% IPI</th>
                      <th className="text-right px-2 py-3">Com IPI</th>
                      <th className="text-right px-2 py-3">PIS {pct(ficha.ficha.parametros.pis_credito)}</th>
                      <th className="text-right px-2 py-3">COFINS {pct(ficha.ficha.parametros.cofins_credito)}</th>
                      <th className="text-right px-2 py-3">IPI crédito</th>
                      <th className="text-right px-2 py-3">ICMS {pct(ficha.ficha.parametros.icms_importado, 0)} imp.</th>
                      <th className="text-right px-2 py-3">ICMS {pct(ficha.ficha.parametros.icms_nacional, 0)} nac.</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-mono text-slate-600">
                    {ficha.ficha.linhas.map((l, index) => (
                      <tr key={`${l.material_id}-${index}`} className="hover:bg-slate-50/60">
                        <td className="px-5 py-2 font-sans font-bold text-slate-800">{l.nome}</td>
                        <td className="px-2 py-2 text-slate-400">{l.ncm || '—'}</td>
                        <td className="px-2 py-2 text-center">
                          <input
                            key={`${l.material_id}-${l.quantidade}`} defaultValue={qty(l.quantidade, Number.isInteger(l.quantidade) ? 0 : 4)} inputMode="decimal"
                            onBlur={(e) => changeQuantity(index, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            className="w-16 text-center bg-blue-50 text-blue-700 font-bold rounded-lg py-1 outline-none focus:ring-2 focus:ring-blue-300" aria-label={`Quantidade de ${l.nome}`}
                          />
                        </td>
                        <td className="px-2 py-2 text-right">{l.importado ? money(l.importado) : '—'}</td>
                        <td className="px-2 py-2 text-right">{l.nacional ? money(l.nacional) : '—'}</td>
                        <td className="px-2 py-2 text-right text-slate-400">{pct(l.ipi_percentual)}</td>
                        <td className="px-2 py-2 text-right font-bold text-slate-800">{money(l.com_ipi)}</td>
                        <td className="px-2 py-2 text-right">{money(l.pis_importado + l.pis_nacional)}</td>
                        <td className="px-2 py-2 text-right">{money(l.cofins_importado + l.cofins_nacional)}</td>
                        <td className="px-2 py-2 text-right">{money(l.ipi)}</td>
                        <td className="px-2 py-2 text-right">{money(l.icms_importado)}</td>
                        <td className="px-2 py-2 text-right">{money(l.icms_nacional)}</td>
                        <td className="px-3 py-2 text-right"><button onClick={() => removeLine(index)} disabled={fichaSaving} className="text-slate-300 hover:text-rose-500" aria-label={`Remover ${l.nome}`}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200 font-mono font-black text-slate-800">
                    <tr>
                      <td className="px-5 py-3 font-sans text-[10px] uppercase tracking-widest text-slate-400" colSpan={3}>Totais ({ficha.ficha.linhas.length} componentes)</td>
                      <td className="px-2 py-3 text-right">{money(t.importado)}</td>
                      <td className="px-2 py-3 text-right">{money(t.nacional)}</td>
                      <td />
                      <td className="px-2 py-3 text-right">{money(t.com_ipi)}</td>
                      <td className="px-2 py-3 text-right">{money(t.pis)}</td>
                      <td className="px-2 py-3 text-right">{money(t.cofins)}</td>
                      <td className="px-2 py-3 text-right">{money(t.ipi)}</td>
                      <td className="px-2 py-3 text-right">{money(t.icms_importado)}</td>
                      <td className="px-2 py-3 text-right">{money(t.icms_nacional)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="p-5 bg-white border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
              {[
                { key: 'LUCRO_REAL', label: 'Custo Lucro Real', value: custos.lucro_real, hint: 'com IPI − PIS − COFINS − IPI − ICMS' },
                { key: 'LUCRO_PRESUMIDO', label: 'Custo Lucro Presumido', value: custos.lucro_presumido, hint: 'com IPI − IPI − ICMS' },
                { key: 'SIMPLES', label: 'Custo Simples Nacional', value: custos.simples, hint: 'com IPI, sem créditos' },
              ].map((c) => (
                <div key={c.key} className={`p-4 rounded-2xl border ${ficha.regime === c.key ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-100'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${ficha.regime === c.key ? 'text-blue-300' : 'text-slate-400'}`}>{c.label}{ficha.regime === c.key ? ' · regime da empresa' : ''}</p>
                  <p className={`text-xl font-mono font-black ${ficha.regime === c.key ? 'text-white' : 'text-slate-700'}`}>{brl(c.value)}</p>
                  <p className={`text-[10px] font-medium ${ficha.regime === c.key ? 'text-slate-300' : 'text-slate-400'}`}>{c.hint}</p>
                </div>
              ))}
            </div>
          </Modal>
        )}
      </>
    </div>
  );
};

export default ProductManager;
