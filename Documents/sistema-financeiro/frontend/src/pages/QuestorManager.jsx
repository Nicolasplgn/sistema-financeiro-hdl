import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Share2, FileCode, CheckCircle, Clock, 
  AlertCircle, Download, Database, CloudLightning,
  RefreshCw, ChevronRight, FileText, Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const QuestorManager = ({ apiBase, companyId }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [preview, setPreview] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const fetchHistory = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Usaremos a rota de history já existente para popular a lista
      const res = await axios.get(`${apiBase}/api/entries/history?companyId=${companyId}`);
      setHistory(res.data);
    } catch (error) {
      console.error("Erro ao carregar histórico Questor:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [companyId]);

  const handlePreview = async (entryId) => {
    try {
      const res = await axios.post(`${apiBase}/api/integration/test-questor`, { entryId });
      setPreview(res.data.preview_txt);
      setSelectedEntry(entryId);
    } catch (error) {
      alert("Erro ao gerar preview do layout.");
    }
  };

  const handleSync = () => {
    alert("Integração Questor: Aguardando Endpoints da Contabilidade. O Layout está pronto para envio.");
  };

  if (!companyId) return (
    <div className="h-96 flex flex-col items-center justify-center text-slate-400">
      <Server size={48} className="mb-4 opacity-10 animate-pulse"/>
      <p className="font-black uppercase tracking-widest text-xs">Selecione uma empresa para gerenciar integração</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      
      {/* HEADER PREMIUM */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200 pb-8 gap-6">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] tracking-[0.2em] uppercase mb-2">
            <CloudLightning size={14} /> Bridge Connector
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">
            Questor <span className="text-slate-300 font-light">Integration</span>
          </h1>
          <p className="text-slate-400 font-medium text-sm">Sincronização de lotes contábeis via Layout WebService.</p>
        </div>
        <div className="flex gap-4">
            <div className="bg-amber-50 border border-amber-100 px-6 py-3 rounded-2xl flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Aguardando Endpoints</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LISTA DE LOTES DISPONÍVEIS */}
        <div className="lg:col-span-1 space-y-6">
          <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] ml-2">Lotes Mensais Disponíveis</h3>
          <div className="space-y-3">
            {history.map((item) => (
              <button 
                key={item.id}
                onClick={() => handlePreview(item.id)}
                className={`w-full p-6 rounded-[2rem] border transition-all flex items-center justify-between group
                  ${selectedEntry === item.id ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'}
                `}
              >
                <div className="text-left">
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${selectedEntry === item.id ? 'text-blue-400' : 'text-slate-400'}`}>Competência</p>
                  <p className={`text-xl font-black italic tracking-tighter ${selectedEntry === item.id ? 'text-white' : 'text-slate-900'}`}>{item.period_start.substring(0, 7)}</p>
                </div>
                <ChevronRight className={selectedEntry === item.id ? 'text-white' : 'text-slate-300 group-hover:text-blue-500 transition-colors'} />
              </button>
            ))}
          </div>
        </div>

        {/* PREVIEW E AÇÕES */}
        <div className="lg:col-span-2 space-y-8">
          {preview ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-white/5">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/5 rounded-2xl text-blue-400"><FileCode size={20}/></div>
                    <span className="text-white font-black text-xs uppercase tracking-widest italic">Preview do Layout (TXT)</span>
                  </div>
                  <button onClick={handleSync} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2">
                    <Share2 size={14}/> Sincronizar com Questor
                  </button>
                </div>
                <div className="bg-black/40 rounded-3xl p-6 font-mono text-[11px] text-emerald-400/80 overflow-x-auto border border-white/5 leading-relaxed">
                  <pre>{preview}</pre>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 flex items-center gap-5 shadow-sm">
                   <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><CheckCircle size={24}/></div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layout Validado</p>
                      <p className="text-sm font-bold text-slate-700">Estrutura pronta para importação.</p>
                   </div>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 flex items-center gap-5 shadow-sm">
                   <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl"><Download size={24}/></div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Backup Local</p>
                      <p className="text-sm font-bold text-slate-700 underline cursor-pointer hover:text-blue-600">Baixar arquivo .txt</p>
                   </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-100 rounded-[3rem] h-full flex flex-col items-center justify-center p-20 text-center">
               <div className="p-6 bg-slate-50 rounded-full mb-6">
                  <Database size={48} className="text-slate-200" />
               </div>
               <h3 className="text-xl font-black text-slate-300 uppercase tracking-tighter italic">Nenhum Lote Selecionado</h3>
               <p className="text-slate-400 text-sm max-w-xs mt-2">Selecione uma competência ao lado para visualizar o layout de integração contábil.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestorManager;