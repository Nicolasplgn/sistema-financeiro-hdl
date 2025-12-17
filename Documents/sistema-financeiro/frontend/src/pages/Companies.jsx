import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Building2, Plus, Search, Trash2, Edit, Save, X 
} from 'lucide-react';

const Companies = ({ apiBase, onSelectCompany }) => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', trade_name: '', tax_id: '', tax_regime: 'SIMPLES'
  });

  // Fetch Companies
  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiBase}/api/companies`);
      setCompanies(response.data);
    } catch (error) {
      console.error("Erro ao buscar empresas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [apiBase]);

  // Handlers
  const handleOpenModal = (company = null) => {
    if (company) {
      setEditingId(company.id);
      setFormData({
        name: company.name,
        trade_name: company.trade_name,
        tax_id: company.tax_id,
        tax_regime: company.tax_regime
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', trade_name: '', tax_id: '', tax_regime: 'SIMPLES' });
    }
    setIsModalOpen(true);
  };

  // --- BUSCA DE CNPJ INTELIGENTE (CORRIGIDA) ---
  const handleSearchCNPJ = async () => {
    // 1. Remove tudo que não for número (pontos, traços, barras, espaços)
    const cleanCNPJ = formData.tax_id.replace(/\D/g, '');

    // 2. Validação simples
    if (cleanCNPJ.length !== 14) {
        return alert("Por favor, insira um CNPJ válido com 14 dígitos.");
    }

    try {
      // 3. Envia o CNPJ limpo para a API
      const res = await axios.get(`${apiBase}/api/utils/cnpj/${cleanCNPJ}`);
      
      setFormData({
        ...formData,
        tax_id: cleanCNPJ, // Atualiza o campo com o número limpo (opcional)
        name: res.data.name,
        trade_name: res.data.tradeName,
        tax_regime: res.data.taxRegime
      });
    } catch (error) {
      alert("Erro ao buscar CNPJ. Verifique se o número está correto ou preencha manualmente.");
      console.error(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Garante que salve apenas números no banco também
      const payload = { ...formData, tax_id: formData.tax_id.replace(/\D/g, '') };

      if (editingId) {
        await axios.put(`${apiBase}/api/companies/${editingId}`, payload);
      } else {
        await axios.post(`${apiBase}/api/companies`, payload);
      }
      setIsModalOpen(false);
      fetchCompanies();
    } catch (error) {
      alert("Erro ao salvar empresa");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir esta empresa?")) return;
    try {
      await axios.delete(`${apiBase}/api/companies/${id}`);
      fetchCompanies();
    } catch (error) {
      alert("Erro ao excluir");
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.tax_id.includes(searchTerm)
  );

  const getRegimeBadge = (regime) => {
    const safeRegime = regime || 'SIMPLES';
    const label = safeRegime.replace('_', ' ');
    
    let color = 'bg-gray-100 text-gray-600';
    if (safeRegime === 'SIMPLES') color = 'bg-blue-100 text-blue-700';
    if (safeRegime === 'LUCRO_PRESUMIDO') color = 'bg-purple-100 text-purple-700';
    if (safeRegime === 'LUCRO_REAL') color = 'bg-orange-100 text-orange-700';

    return <span className={`px-2 py-1 rounded-md text-xs font-bold ${color}`}>{label}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="text-blue-600" /> Minhas Empresas
          </h1>
          <p className="text-gray-500 text-sm">Gerencie os CNPJs do sistema.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition shadow-sm"
        >
          <Plus size={18} /> Nova Empresa
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex items-center gap-3">
        <Search className="text-gray-400" />
        <input 
          type="text" 
          placeholder="Buscar por Razão Social ou CNPJ..." 
          className="flex-1 outline-none text-gray-700"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid de Empresas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p className="text-gray-500 col-span-3 text-center">Carregando...</p> : 
         filteredCompanies.map(company => (
          <div key={company.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition group relative">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Building2 size={24} />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                 <button onClick={() => handleOpenModal(company)} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"><Edit size={16}/></button>
                 <button onClick={() => handleDelete(company.id)} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"><Trash2 size={16}/></button>
              </div>
            </div>
            
            <h3 className="font-bold text-gray-800 text-lg truncate" title={company.name}>{company.trade_name || company.name}</h3>
            <p className="text-xs text-gray-400 mb-3">{company.name}</p>
            
            <div className="flex items-center justify-between mt-4">
               <span className="text-sm font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">{company.tax_id}</span>
               {getRegimeBadge(company.tax_regime)}
            </div>

            <button 
                onClick={() => onSelectCompany && onSelectCompany(company.id)}
                className="w-full mt-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
                Selecionar
            </button>
          </div>
        ))}
      </div>

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="font-bold text-lg text-gray-800">{editingId ? 'Editar Empresa' : 'Nova Empresa'}</h2>
                    <button type="button" onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-red-500"/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNPJ</label>
                            <input 
                                value={formData.tax_id} 
                                onChange={(e) => setFormData({...formData, tax_id: e.target.value})} 
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Pode colar com ponto e barra..."
                            />
                        </div>
                        <button type="button" onClick={handleSearchCNPJ} className="mt-6 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"><Search size={18}/></button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Razão Social</label>
                        <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Fantasia</label>
                        <input value={formData.trade_name} onChange={(e) => setFormData({...formData, trade_name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Regime Tributário</label>
                        <select value={formData.tax_regime} onChange={(e) => setFormData({...formData, tax_regime: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="SIMPLES">Simples Nacional</option>
                            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                            <option value="LUCRO_REAL">Lucro Real</option>
                        </select>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition flex items-center gap-2">
                        <Save size={18}/> Salvar
                    </button>
                </div>
            </form>
        </div>
      )}
    </div>
  );
};

export default Companies;