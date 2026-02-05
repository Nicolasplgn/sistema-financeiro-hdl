import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, Plus, Edit3, Trash2, Search, CheckCircle, X, Loader, Layers } from 'lucide-react';

const Companies = ({ apiBase, onSelectCompany }) => {
    const [companies, setCompanies] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isCompModalOpen, setIsCompModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [searchingCnpj, setSearchingCnpj] = useState(false);
    
    const [formData, setFormData] = useState({ id: null, name: '', trade_name: '', tax_id: '', tax_regime: 'SIMPLES', group_id: '' });
    const [groupForm, setGroupForm] = useState({ name: '', description: '' });

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [resComp, resGroups] = await Promise.all([
                axios.get(`${apiBase}/api/companies`),
                axios.get(`${apiBase}/api/groups`)
            ]);
            setCompanies(resComp.data);
            setGroups(resGroups.data);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, [apiBase]);

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

    const handleSaveCompany = async (e) => {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('hdl_user'));
        try {
            const payload = { ...formData, group_id: formData.group_id || null, userId: user?.id, userName: user?.full_name };
            if (formData.id) await axios.put(`${apiBase}/api/companies/${formData.id}`, payload);
            else await axios.post(`${apiBase}/api/companies`, payload);
            setIsCompModalOpen(false); fetchAll();
        } catch (error) { alert('Erro ao salvar empresa'); }
    };

    const handleSaveGroup = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${apiBase}/api/groups`, groupForm);
            setIsGroupModalOpen(false); setGroupForm({ name: '', description: '' }); fetchAll();
        } catch (error) { alert('Erro ao salvar grupo'); }
    };

    // --- CORREÇÃO AQUI: PASSANDO USUÁRIO NA EXCLUSÃO ---
    const handleDeleteCompany = async (companyId) => {
        if (!confirm('Excluir empresa? Todos os dados financeiros vinculados serão apagados.')) return;
        
        const user = JSON.parse(localStorage.getItem('hdl_user'));
        try {
            await axios.delete(`${apiBase}/api/companies/${companyId}`, {
                params: {
                    userId: user?.id,
                    userName: user?.full_name
                }
            });
            fetchAll();
        } catch (error) {
            alert('Erro ao excluir empresa.');
            console.error(error);
        }
    };

    return (
        <div className="p-10 max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-200 pb-8">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic flex items-center gap-3"><Building2 className="text-blue-600" size={32}/> Unidades & Grupos</h1>
                    <p className="text-slate-400 font-medium mt-1">Gerencie a estrutura organizacional da sua holding.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setIsGroupModalOpen(true)} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-slate-50 shadow-sm transition-all"><Layers size={18}/> Novo Grupo</button>
                    <button onClick={() => { setFormData({ id: null, name: '', trade_name: '', tax_id: '', tax_regime: 'SIMPLES', group_id: '' }); setIsCompModalOpen(true); }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-blue-500/20 hover:-translate-y-1 transition-all"><Plus size={18}/> Nova Unidade</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-1 space-y-6">
                    <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest ml-2">Grupos Corporativos</h3>
                    <div className="space-y-4">
                        {groups.map(g => (
                            <div key={g.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                                <div>
                                    <p className="text-lg font-black text-slate-800 tracking-tighter italic">{g.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{companies.filter(c => c.group_id === g.id).length} Unidades vinculadas</p>
                                </div>
                                <button onClick={async () => { if(confirm('Excluir grupo? As empresas cadastradas nele ficarão sem grupo.')) { await axios.delete(`${apiBase}/api/groups/${g.id}`); fetchAll(); } }} className="text-slate-300 hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-rose-50"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        {groups.length === 0 && <p className="text-slate-300 font-black text-[10px] uppercase text-center py-10 border-2 border-dashed border-slate-100 rounded-[2rem]">Nenhum grupo criado</p>}
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"><Search className="text-slate-400"/><input type="text" placeholder="Buscar unidade por nome, CNPJ ou grupo..." className="w-full bg-transparent outline-none font-medium text-slate-700" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {companies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.group_name?.toLowerCase().includes(searchTerm.toLowerCase())).map(company => (
                            <div key={company.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group duration-500">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-4 bg-slate-900 text-white rounded-2xl transform group-hover:rotate-6 transition-transform duration-500 shadow-lg"><Building2 size={24}/></div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setFormData(company); setIsCompModalOpen(true); }} className="p-2 text-slate-300 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg"><Edit3 size={18}/></button>
                                        
                                        {/* AQUI ESTÁ A CHAMADA CORRIGIDA */}
                                        <button onClick={() => handleDeleteCompany(company.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors hover:bg-rose-50 rounded-lg"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tighter italic mb-1">{company.trade_name || company.name}</h3>
                                <div className="flex items-center gap-2 mb-6">
                                    <Layers size={12} className="text-blue-500"/>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{company.group_name || 'Individual (Sem Grupo)'}</p>
                                </div>
                                <div className="space-y-3 border-t border-slate-50 pt-4 mb-6">
                                    <div className="flex justify-between text-[11px] font-bold uppercase"><span className="text-slate-400 tracking-widest">Documento</span><span className="text-slate-700 font-mono bg-slate-50 px-2 py-0.5 rounded-md">{company.tax_id}</span></div>
                                    <div className="flex justify-between text-[11px] font-bold uppercase"><span className="text-slate-400 tracking-widest">Regime Fiscal</span><span className="text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md">{company.tax_regime}</span></div>
                                </div>
                                <button onClick={() => onSelectCompany(company.id, company.name)} className="w-full py-4 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 group-hover:shadow-lg"><CheckCircle size={16} className="opacity-50"/> Acessar Painel</button>
                            </div>
                        ))}
                        {companies.length === 0 && <div className="col-span-2 text-center py-20 text-slate-300 font-black uppercase tracking-widest italic">Nenhuma empresa cadastrada</div>}
                    </div>
                </div>
            </div>

            {isCompModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <form onSubmit={handleSaveCompany} className="bg-white w-full max-w-lg rounded-[3rem] p-10 space-y-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-2xl font-black text-slate-900 italic tracking-tighter">Configurar Unidade</h3><button type="button" onClick={() => setIsCompModalOpen(false)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"><X/></button></div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">CNPJ Oficial</label>
                                <div className="flex gap-2">
                                    <input type="text" required value={formData.tax_id} onChange={e => setFormData({...formData, tax_id: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono font-bold text-slate-700 transition-all"/>
                                    <button type="button" onClick={handleCnpjLookup} disabled={searchingCnpj} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow transition disabled:opacity-50">
                                        {searchingCnpj ? <Loader className="animate-spin" size={20}/> : <Search size={20}/>}
                                    </button>
                                </div>
                            </div>
                            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Razão Social</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 transition-all"/></div>
                            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Nome Fantasia (BI)</label><input type="text" value={formData.trade_name} onChange={e => setFormData({...formData, trade_name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 transition-all"/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Regime Tributário</label><select value={formData.tax_regime} onChange={e => setFormData({...formData, tax_regime: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none font-bold text-slate-700 cursor-pointer"><option value="SIMPLES">SIMPLES NACIONAL</option><option value="LUCRO_PRESUMIDO">LUCRO PRESUMIDO</option><option value="LUCRO_REAL">LUCRO REAL</option></select></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Grupo Associado</label><select value={formData.group_id} onChange={e => setFormData({...formData, group_id: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none font-bold text-slate-700 cursor-pointer"><option value="">NENHUM (INDIVIDUAL)</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                            </div>
                        </div>
                        <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-500/20 mt-4 transition-all hover:bg-blue-700 hover:shadow-2xl active:scale-95">Salvar Dados da Unidade</button>
                    </form>
                </div>
            )}

            {isGroupModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <form onSubmit={handleSaveGroup} className="bg-white w-full max-w-md rounded-[3rem] p-10 space-y-6 shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-2xl font-black text-slate-900 italic tracking-tighter">Novo Grupo Corporativo</h3><button type="button" onClick={() => setIsGroupModalOpen(false)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"><X/></button></div>
                        <div className="space-y-4">
                            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Nome da Holding / Grupo</label><input type="text" required value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700 transition-all" placeholder="Ex: Grupo XP Soluções"/></div>
                            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Descrição Estratégica</label><textarea value={groupForm.description} onChange={e => setGroupForm({...groupForm, description: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none h-24 resize-none font-medium text-slate-700 transition-all" placeholder="Notas sobre o grupo..."/></div>
                        </div>
                        <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-xl mt-4 hover:bg-black transition-all active:scale-95">Criar Grupo Consolidado</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Companies;