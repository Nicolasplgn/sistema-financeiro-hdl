import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Edit, Trash2, Building2, Save, X } from 'lucide-react';

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', tradeName: '', taxId: '' });

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const handleOpenModal = (company = null) => {
    if (company) {
      setEditingId(company.id);
      setFormData({ name: company.name, tradeName: company.tradeName || '', taxId: company.taxId || '' });
    } else {
      setEditingId(null);
      setFormData({ name: '', tradeName: '', taxId: '' });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Excluir empresa "${name}" e todos os seus dados?`)) {
      try { await api.delete(`/companies/${id}`); fetchCompanies(); } catch (error) { alert('Erro ao excluir.'); }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/companies/${editingId}`, formData);
      else await api.post('/companies', formData);
      setIsModalOpen(false); fetchCompanies();
    } catch (error) { alert('Erro ao salvar.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Gerenciar Empresas</h1>
        <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={20} /> Nova Empresa</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nome</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">CNPJ</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{c.name}</td>
                <td className="px-6 py-4 text-slate-600 font-mono text-sm">{c.taxId || '-'}</td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button onClick={() => handleOpenModal(c)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={18} /></button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="text-red-400 hover:bg-red-50 p-2 rounded"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 flex justify-between items-center border-b">
              <h3 className="font-bold text-lg flex items-center gap-2"><Building2 size={20}/> {editingId ? 'Editar' : 'Nova'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2 rounded" placeholder="Razão Social" />
              <input value={formData.tradeName} onChange={e => setFormData({...formData, tradeName: e.target.value})} className="w-full border p-2 rounded" placeholder="Nome Fantasia" />
              <input value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value})} className="w-full border p-2 rounded" placeholder="CNPJ" />
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"><Save size={18} /> Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;