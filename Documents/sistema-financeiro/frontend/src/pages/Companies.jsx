import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, Plus, Edit3, Trash2, Search, CheckCircle, X, Loader } from 'lucide-react';

const Companies = ({ apiBase, onSelectCompany }) => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Estado do Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [searchingCnpj, setSearchingCnpj] = useState(false);
    
    // Estado do Formulário
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        trade_name: '',
        tax_id: '',
        tax_regime: 'SIMPLES'
    });

    // Pega o usuário logado para enviar nos logs
    const user = JSON.parse(localStorage.getItem('hdl_user'));

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${apiBase}/api/companies`);
            setCompanies(res.data);
        } catch (error) {
            console.error("Erro ao buscar empresas:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    const handleCnpjLookup = async () => {
        const cnpj = formData.tax_id.replace(/\D/g, '');
        if (cnpj.length !== 14) return alert("Digite um CNPJ válido (14 números) para buscar.");

        setSearchingCnpj(true);
        try {
            const res = await axios.get(`${apiBase}/api/utils/cnpj/${cnpj}`);
            if (res.data) {
                setFormData(prev => ({
                    ...prev,
                    name: res.data.name,
                    trade_name: res.data.tradeName || res.data.name,
                    tax_regime: res.data.taxRegime || 'SIMPLES'
                }));
            }
        } catch (error) {
            alert("Erro ao buscar CNPJ. Verifique se está correto ou preencha manualmente.");
        } finally {
            setSearchingCnpj(false);
        }
    };

    const handleOpenCreate = () => {
        setFormData({ id: null, name: '', trade_name: '', tax_id: '', tax_regime: 'SIMPLES' });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (company) => {
        setFormData({
            id: company.id,
            name: company.name || '',
            trade_name: company.trade_name || '',
            tax_id: company.tax_id || '',
            tax_regime: company.tax_regime || 'SIMPLES'
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        // Payload com dados do usuário para o log ficar correto
        const payload = {
            ...formData,
            userId: user?.id,
            userName: user?.full_name
        };

        try {
            if (isEditing) {
                await axios.put(`${apiBase}/api/companies/${formData.id}`, payload);
                alert('Empresa atualizada com sucesso!');
            } else {
                await axios.post(`${apiBase}/api/companies`, payload);
                alert('Empresa cadastrada com sucesso!');
            }
            setIsModalOpen(false);
            fetchCompanies();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert('Erro ao salvar empresa.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("ATENÇÃO: Isso apagará TODOS os lançamentos desta empresa. Continuar?")) {
            try {
                await axios.delete(`${apiBase}/api/companies/${id}`);
                fetchCompanies();
            } catch (error) {
                console.error(error);
                alert("Erro ao excluir.");
            }
        }
    };

    const filteredCompanies = companies.filter(c => 
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.trade_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.tax_id || '').includes(searchTerm)
    );

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="text-blue-600" /> Minhas Empresas
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gerencie as empresas do sistema.</p>
                </div>
                <button 
                    onClick={handleOpenCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition hover:-translate-y-1"
                >
                    <Plus size={20} /> Nova Empresa
                </button>
            </div>

            {/* Barra de Pesquisa */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex items-center gap-3">
                <Search className="text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Buscar empresa..." 
                    className="w-full outline-none text-slate-700"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Lista */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCompanies.map(company => (
                    <div key={company.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Building2 size={24} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenEdit(company)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition"><Edit3 size={18} /></button>
                                <button onClick={() => handleDelete(company.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"><Trash2 size={18} /></button>
                            </div>
                        </div>

                        <h3 className="font-bold text-lg text-slate-800 mb-1 truncate">{company.trade_name || company.name}</h3>
                        <p className="text-xs text-slate-500 mb-4 truncate">{company.name}</p>

                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">CNPJ</span>
                                <span className="font-mono font-medium text-slate-700">{company.tax_id || '-'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Regime</span>
                                <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{company.tax_regime}</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => onSelectCompany(company.id)}
                            className="w-full py-3 rounded-xl border border-blue-600 text-blue-600 font-bold hover:bg-blue-600 hover:text-white transition flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={18} /> Acessar Painel
                        </button>
                    </div>
                ))}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{isEditing ? 'Editar Empresa' : 'Nova Empresa'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">CNPJ</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="00.000.000/0000-00"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono"
                                        value={formData.tax_id || ''} 
                                        onChange={e => setFormData({...formData, tax_id: e.target.value})}
                                    />
                                    <button 
                                        type="button"
                                        onClick={handleCnpjLookup}
                                        disabled={searchingCnpj}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl shadow transition disabled:opacity-50"
                                    >
                                        {searchingCnpj ? <Loader className="animate-spin" size={20}/> : <Search size={20}/>}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Razão Social</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                                    value={formData.name || ''} 
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nome Fantasia</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                                    value={formData.trade_name || ''} 
                                    onChange={e => setFormData({...formData, trade_name: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Regime Tributário</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                                    value={formData.tax_regime || 'SIMPLES'}
                                    onChange={e => setFormData({...formData, tax_regime: e.target.value})}
                                >
                                    <option value="SIMPLES">Simples Nacional</option>
                                    <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                                    <option value="LUCRO_REAL">Lucro Real</option>
                                </select>
                            </div>

                            <button 
                                type="submit" 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-blue-500/20 transition"
                            >
                                {isEditing ? 'Salvar Alterações' : 'Cadastrar Empresa'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Companies;