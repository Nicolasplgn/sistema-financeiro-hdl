import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldAlert, Users, Search, UserPlus, LogIn, Trash2, 
  Activity, Database, LayoutDashboard, Lock, Edit3, X, Save, Infinity
} from 'lucide-react';

const AdminPanel = ({ apiBase, onImpersonate }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Forms
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'ADMIN', max_companies: 1 });
  const [editUser, setEditUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/admin/users`);
      setUsers(res.data);
    } catch (error) { console.error("Erro ao buscar usuários", error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${BASE_URL}/api/admin/users`, newUser);
      setIsCreateModalOpen(false);
      setNewUser({ full_name: '', email: '', password: '', role: 'ADMIN', max_companies: 1 });
      fetchUsers();
      alert('Cliente criado com sucesso!');
    } catch (error) { alert('Erro ao criar usuário.'); }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
        await axios.put(`${BASE_URL}/api/admin/users/${editUser.id}`, {
            role: editUser.role,
            max_companies: editUser.max_companies,
            password: editUser.password 
        });
        setIsEditModalOpen(false);
        fetchUsers();
        alert('Dados atualizados!');
    } catch (error) { alert('Erro ao atualizar.'); }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('ATENÇÃO: Excluir um usuário removerá acesso às empresas dele. Continuar?')) return;
    try { await axios.delete(`${BASE_URL}/api/admin/users/${id}`); fetchUsers(); } 
    catch (error) { alert('Erro ao excluir.'); }
  };

  const handleImpersonate = async (user) => {
    if (!confirm(`Deseja entrar no sistema como "${user.full_name}"?`)) return;
    try {
        const res = await axios.post(`${BASE_URL}/api/admin/impersonate`, { targetUserId: user.id });
        if (res.data.user) onImpersonate(res.data.user, res.data.token);
    } catch (error) { alert('Erro ao acessar conta.'); }
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-10 max-w-7xl mx-auto animate-in fade-in duration-700 pb-32">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <ShieldAlert className="text-rose-600" size={40}/> Vector Control Center
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2 ml-1">Gestão de Licenças e Clientes</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Users size={20}/></div>
              <div><p className="text-[10px] font-black uppercase text-slate-400">Total Clientes</p><p className="text-xl font-black text-slate-800">{users.length}</p></div>
           </div>
           <button onClick={() => setIsCreateModalOpen(true)} className="bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 transition hover:-translate-y-1">
             <UserPlus size={18}/> Novo Cliente
           </button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-200 mb-8 flex items-center gap-4 focus-within:ring-4 focus-within:ring-slate-100 transition-all">
         <Search className="text-slate-400 ml-2" size={24}/>
         <input type="text" placeholder="Buscar cliente por nome ou e-mail..." className="w-full h-full outline-none text-lg font-medium text-slate-700 placeholder-slate-300" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-black uppercase text-slate-400 tracking-widest">
                <tr><th className="p-6">Cliente / Usuário</th><th className="p-6">Plano / Role</th><th className="p-6 text-center">Uso de Licenças</th><th className="p-6">Data Cadastro</th><th className="p-6 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="p-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${u.role === 'SUPER_ADMIN' ? 'bg-rose-500 shadow-rose-200' : 'bg-blue-600 shadow-blue-200'} shadow-lg`}>{u.full_name.charAt(0)}</div>
                                <div><p className="font-bold text-slate-800">{u.full_name}</p><p className="text-xs text-slate-400">{u.email}</p></div>
                            </div>
                        </td>
                        <td className="p-6"><span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${u.role === 'SUPER_ADMIN' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                        <td className="p-6 text-center">
                            {u.role === 'SUPER_ADMIN' ? (
                                <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest">
                                    <Infinity size={18}/> Ilimitado
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className={`font-mono font-bold ${u.companies_used >= u.max_companies ? 'text-rose-600' : 'text-emerald-600'}`}>{u.companies_used}</span>
                                        <span className="text-slate-300">/</span>
                                        <span className="font-mono font-bold text-slate-900">{u.max_companies}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden max-w-[100px] mx-auto">
                                        <div className={`h-full ${u.companies_used >= u.max_companies ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{width: `${Math.min((u.companies_used/u.max_companies)*100, 100)}%`}}></div>
                                    </div>
                                </>
                            )}
                        </td>
                        <td className="p-6 text-xs font-medium text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="p-6 text-right">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => { setEditUser(u); setIsEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 transition bg-slate-50 rounded-lg hover:bg-blue-50" title="Editar Licenças"><Edit3 size={16}/></button>
                                {u.role !== 'SUPER_ADMIN' && (
                                    <button onClick={() => handleImpersonate(u)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition hover:-translate-y-1"><LogIn size={14}/> Entrar</button>
                                )}
                                <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-300 hover:text-rose-500 transition rounded-lg hover:bg-rose-50"><Trash2 size={18}/></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* MODAL CRIAR */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative">
                <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                <h3 className="text-2xl font-black text-slate-900 mb-6">Novo Cliente</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome Completo</label><input required className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})}/></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail de Acesso</label><input required type="email" className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}/></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha Provisória</label><input required type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}/></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perfil</label>
                            <select className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                <option value="ADMIN">Cliente</option>
                                <option value="SUPER_ADMIN">Admin Vector</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Licenças (Unidades)</label>
                            <input type="number" min="1" disabled={newUser.role === 'SUPER_ADMIN'} className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none disabled:opacity-50" value={newUser.role === 'SUPER_ADMIN' ? 9999 : newUser.max_companies} onChange={e => setNewUser({...newUser, max_companies: e.target.value})}/>
                        </div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl mt-4 hover:bg-black transition shadow-lg uppercase text-xs tracking-widest">Cadastrar Usuário</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL EDITAR (Onde você libera ou tira licenças) */}
      {isEditModalOpen && editUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative">
                <button onClick={() => setIsEditModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                <div className="mb-6 text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-2xl uppercase shadow-lg">
                        {editUser.full_name.charAt(0)}
                    </div>
                    <h3 className="text-xl font-black text-slate-900">{editUser.full_name}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{editUser.role}</p>
                </div>
                
                <form onSubmit={handleUpdateUser} className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 text-center">Limite de Licenças (Unidades)</label>
                        <div className="flex items-center justify-center gap-4">
                            <button type="button" onClick={() => setEditUser({...editUser, max_companies: Math.max(1, parseInt(editUser.max_companies) - 1)})} className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 flex items-center justify-center font-black text-xl transition">-</button>
                            <input 
                                type="number" 
                                min="1" 
                                className="w-24 h-16 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-3xl text-slate-900 outline-none text-center focus:border-blue-500 transition" 
                                value={editUser.max_companies} 
                                onChange={e => setEditUser({...editUser, max_companies: e.target.value})}
                            />
                            <button type="button" onClick={() => setEditUser({...editUser, max_companies: parseInt(editUser.max_companies) + 1})} className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600 flex items-center justify-center font-black text-xl transition">+</button>
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Alterar Senha (Opcional)</label>
                        <input type="text" placeholder="Nova senha..." className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition" onChange={e => setEditUser({...editUser, password: e.target.value})}/>
                    </div>

                    <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-xl uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                        <Save size={16}/> Salvar Alterações
                    </button>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;