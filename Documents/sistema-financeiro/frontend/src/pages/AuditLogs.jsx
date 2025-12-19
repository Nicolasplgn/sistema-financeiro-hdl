import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  ShieldAlert, Clock, User, RefreshCw, Search, Database, 
  Calendar, ChevronUp, ChevronDown, Filter, MinusCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AuditLogs = ({ apiBase }) => {
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      // Só envia as datas se estiverem preenchidas
      if (dateRange.start && dateRange.end) {
        params.startDate = dateRange.start;
        params.endDate = dateRange.end;
      }
      const res = await axios.get(`${BASE_URL}/api/audit-logs`, { params });
      setLogs(res.data);
      setIsExpanded(true);
    } catch (error) { 
      console.error("Erro logs", error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchLogs(); 
  }, [BASE_URL]);

  // Agrupa os logs por data para melhor visualização
  const groupedLogs = useMemo(() => {
    const filtered = logs.filter(log => 
      (log.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const groups = {};
    filtered.forEach(log => {
      // Cria a chave de data (DD/MM/AAAA)
      const dateKey = new Date(log.timestamp).toLocaleDateString('pt-BR');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return groups;
  }, [logs, searchTerm]);

  // Define cores baseadas no tipo de ação
  const getActionStyle = (action) => {
    const act = action?.toUpperCase() || '';
    if (act.includes('DELETE')) return 'bg-red-100 text-red-700 border-red-200';
    if (act.includes('UPDATE') || act.includes('EDIT')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (act.includes('INSERT') || act.includes('CREATE')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (act.includes('LOGIN')) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in pb-20">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ShieldAlert className="text-purple-600" /> Logs de Segurança
            </h1>
            <p className="text-gray-500 text-sm mt-1">Monitore todas as ações realizadas no sistema.</p>
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-purple-600 bg-slate-50 hover:bg-purple-50 px-4 py-2 rounded-lg transition">
            {isExpanded ? <><MinusCircle size={16}/> Minimizar Lista</> : <><ChevronDown size={16}/> Expandir Lista</>}
          </button>
        </div>
        
        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex-1 w-full relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Buscar Texto</label>
                <Search className="absolute left-3 top-8 text-gray-400" size={16} />
                <input type="text" placeholder="Usuário, ação ou detalhe..." className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
            <div className="w-full md:w-auto">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">De</label>
                <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-500"/>
            </div>
            <div className="w-full md:w-auto">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Até</label>
                <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-500"/>
            </div>
            <button onClick={fetchLogs} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shadow-md shadow-purple-200 font-medium text-sm h-[38px]">
                {loading ? <RefreshCw size={16} className="animate-spin"/> : <Filter size={16}/>} Filtrar
            </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6">
            {Object.keys(groupedLogs).length === 0 ? (
                <div className="text-center p-12 bg-white rounded-2xl border border-slate-100 text-slate-400">
                    Nenhum registro encontrado para este período.
                </div>
            ) : (
                Object.keys(groupedLogs).map((dateKey) => (
                    <div key={dateKey} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400"/>
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{dateKey}</span>
                            <span className="text-[10px] bg-gray-200 text-gray-500 px-2 rounded-full">{groupedLogs[dateKey].length} ações</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {groupedLogs[dateKey].map((log) => (
                                <div key={log.id} className="p-4 hover:bg-purple-50/20 transition flex flex-col md:flex-row items-start md:items-center gap-4">
                                    <div className="flex items-center gap-4 min-w-[200px]">
                                        <span className="font-mono text-xs text-gray-400 flex items-center gap-1">
                                            <Clock size={12}/> {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <div className="flex items-center gap-2 font-medium text-gray-700 text-sm">
                                            <div className="p-1 bg-gray-100 rounded-full"><User size={12} className="text-gray-500"/></div>
                                            {log.user_name || 'Sistema'}
                                        </div>
                                    </div>
                                    <div className="min-w-[140px]">
                                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wide ${getActionStyle(log.action)}`}>
                                            {log.action}
                                        </span>
                                    </div>
                                    <div className="flex-1 flex items-start gap-2 text-sm text-gray-600">
                                        <Database size={14} className="mt-0.5 text-gray-300 shrink-0"/>
                                        <span className="break-all">{log.details}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {!isExpanded && (
          <div onClick={() => setIsExpanded(true)} className="p-4 bg-white border border-slate-200 border-dashed rounded-xl text-center text-slate-400 text-sm cursor-pointer hover:bg-slate-50 transition">
              A lista está minimizada. Clique para expandir.
          </div>
      )}
    </div>
  );
};

export default AuditLogs;