import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, Search, Trash2, Phone, Mail, Building, User, Save, X } from 'lucide-react';

const Partners = ({ apiBase, selectedCompanyId }) => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', tax_id: '', type: 'CLIENT', phone: '', email: '' });
  const [searchingCnpj, setSearchingCnpj] = useState(false); // Estado visual de carregamento da busca

  const fetchPartners = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/partners/${selectedCompanyId}`);
      setPartners(res.data);
    } catch (error) { console.error("Erro ao buscar parceiros", error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchPartners(); }, [selectedCompanyId, apiBase]);

  // --- NOVA FUNÇÃO DE BUSCA DE CNPJ ---
  const handleSearchCNPJ = async () => {
    // 1. Limpa o texto (deixa só números)
    const cleanDoc = formData.tax_id.replace(/\D/g, '');

    // 2. Valida se é CNPJ
    if (cleanDoc.length !== 14) {
        if (cleanDoc.length === 11) return alert("Busca automática disponível apenas para CNPJ. CPFs devem ser preenchidos manualmente.");
        return alert("Digite um CNPJ válido com 14 dígitos.");
    }

    setSearchingCnpj(true);
    try {
      const res = await axios.get(`${apiBase}/api/utils/cnpj/${cleanDoc}`);
      
      // 3. Preenche os dados
      setFormData(prev => ({
        ...prev,
        tax_id: cleanDoc, // Atualiza com o limpo
        name: res.data.name, // Razão Social
        // Opcional: Se quiser salvar o Nome Fantasia em algum lugar, pode concatenar ou usar outro campo
        // email: res.data.email || prev.email // Algumas APIs retornam email, se quiser usar
      }));
    } catch (error) {
      alert("Não foi possível encontrar os dados deste CNPJ. Preencha manualmente.");
    } finally {
      setSearchingCnpj(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Salva limpando o documento
      const payload = { ...formData, tax_id: formData.tax_id.replace(/\D/g, ''), company_id: selectedCompanyId };
      await axios.post(`${apiBase}/api/partners`, payload);
      setIsModalOpen(false);
      setFormData({ name: '', tax_id: '', type: 'CLIENT', phone: '', email: '' });
      fetchPartners();
    } catch (error) { alert('Erro ao salvar parceiro'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir parceiro?')) return;
    try {
      await axios.delete(`${apiBase}/api/partners/${id}`);
      fetchPartners();
    } catch (error) { alert("Erro ao excluir"); }
  };

  const filtered = partners.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!selectedCompanyId) return <div className="h-96 flex flex-col items-center justify-center text-slate-400"><Users size={48} className="mb-4 opacity-20"/><p>Selecione uma empresa para gerenciar parceiros.</p></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" /> Parceiros de Negócio
          </h1>
          <p className="text-gray-500 text-sm">Gerencie clientes e fornecedores</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition shadow-sm">
          <Plus size={18} /> Novo Parceiro
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex items-center gap-3">
        <Search className="text-gray-400" />
        <input 
          type="text" 
          placeholder="Buscar por nome..." 
          className="flex-1 outline-none text-gray-700"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p className="text-gray-500">Carregando...</p> : filtered.map(p => (
          <div key={p.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition group relative">
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${p.type === 'CLIENT' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                {p.type === 'CLIENT' ? <User size={20} /> : <Building size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 truncate max-w-[180px]" title={p.name}>{p.name}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">{p.type === 'CLIENT' ? 'Cliente' : 'Fornecedor'}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-500">
              {p.tax_id && <p className="flex items-center gap-2"><span>🆔</span> {p.tax_id}</p>}
              {p.email && <p className="flex items-center gap-2 truncate" title={p.email}><Mail size={14}/> {p.email}</p>}
              {p.phone && <p className="flex items-center gap-2"><Phone size={14}/> {p.phone}</p>}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-lg font-bold text-gray-800">Novo Parceiro</h2>
                <button type="button" onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-red-500"/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Parceiro</label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    <button type="button" onClick={() => setFormData({...formData, type: 'CLIENT'})} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition ${formData.type === 'CLIENT' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Cliente</button>
                    <button type="button" onClick={() => setFormData({...formData, type: 'SUPPLIER'})} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition ${formData.type === 'SUPPLIER' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>Fornecedor</button>
                </div>
              </div>
              
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF ou CNPJ</label>
                 <div className="flex gap-2">
                    <input 
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={formData.tax_id} 
                        onChange={e => setFormData({...formData, tax_id: e.target.value})} 
                        placeholder="Digite apenas números..."
                    />
                    <button 
                        type="button" 
                        onClick={handleSearchCNPJ}
                        disabled={searchingCnpj}
                        className="px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        title="Buscar dados do CNPJ na Receita"
                    >
                        {searchingCnpj ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> : <Search size={18}/>}
                    </button>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-1">* A busca automática funciona apenas para CNPJ.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo / Razão Social</label>
                <input required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                  <input className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                  <input className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2"><Save size={18}/> Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Partners;