// src/components/ImportModal.jsx
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, FileSpreadsheet, FileText, UploadCloud,
    Loader2, CheckCircle2, AlertCircle, Calendar,
    ChevronRight, Info, ListPlus, Files
} from 'lucide-react';
import axios from 'axios';

const ImportModal = ({ isOpen, onClose, companyId, apiBase, onSuccess }) => {
    const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;

    // ── Estados ──────────────────────────────────────────────────────────────
    const[format, setFormat]         = useState(null);   // 'excel' | 'csv'
    const[period, setPeriod]         = useState('');     // YYYY-MM (Usado apenas se for 1 arquivo)
    
    // Agora usamos um ARRAY de arquivos para suportar upload em lote
    const [files, setFiles]           = useState([]);     
    
    const [status, setStatus]         = useState('idle'); // idle | uploading | success | error
    const [message, setMessage]       = useState('');
    const [summary, setSummary]       = useState(null);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 }); // Progresso do lote
    
    const [importedLogs, setImportedLogs] = useState([]); 
    
    const fileInputRef = useRef(null);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const resetState = () => {
        setFormat(null);
        setPeriod('');
        setFiles([]);
        setStatus('idle');
        setMessage('');
        setSummary(null);
        setUploadProgress({ current: 0, total: 0 });
        setImportedLogs([]); 
        if (fileInputRef.current) fileInputRef.current.value = null;
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(Array.from(e.target.files));
        }
    };

    const formatBRL = (v) =>
        Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ── Upload Excel (Planilha Anual - Mantém 1 arquivo) ──────────────────────
    const handleUploadExcel = async () => {
        if (files.length === 0) return;
        setStatus('uploading');
        const fd = new FormData();
        fd.append('file', files[0]); // Excel sempre pega o primeiro
        fd.append('companyId', companyId);
        try {
            const res = await axios.post(`${BASE_URL}/api/import/dre`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStatus('success');
            setMessage(res.data.message || 'Importação do ano concluída!');
            onSuccess && onSuccess({ format: 'excel' });
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.error || 'Erro ao importar planilha. Verifique o modelo.');
        }
    };

    // ── Upload CSV Balancete (LOTE / VÁRIOS ARQUIVOS) ─────────────────────────
    const handleUploadCSV = async () => {
        if (files.length === 0) return;
        setStatus('uploading');
        setUploadProgress({ current: 0, total: files.length });

        let successCount = 0;
        let errorCount = 0;
        let lastSummary = null;

        // Loop para enviar um arquivo por vez
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadProgress({ current: i + 1, total: files.length });

            const fd = new FormData();
            fd.append('file', file);
            fd.append('companyId', companyId);
            
            // Só envia o período forçado se for a importação de um único arquivo
            if (files.length === 1 && period) {
                fd.append('period', period);
            }

            try {
                const res = await axios.post(`${BASE_URL}/api/import/balancete`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                successCount++;
                lastSummary = res.data.summary;
                const importedPeriod = res.data.period;
                
                setImportedLogs(prev =>[...prev, { period: importedPeriod, result: res.data.summary.resultado }]);
            } catch (err) {
                errorCount++;
                console.error(`Erro ao importar ${file.name}:`, err);
            }
        }

        setStatus('success');
        
        if (files.length === 1 && errorCount === 0) {
            setMessage(`Balancete importado com sucesso!`);
            setSummary(lastSummary); // Mostra o card de resumo
        } else {
            setMessage(`Lote concluído: ${successCount} meses importados com sucesso.`);
            if (errorCount > 0) setMessage(prev => prev + ` (${errorCount} falhas. Verifique as datas nos arquivos).`);
            setSummary(null); // Oculta o resumo unitário no upload em lote
        }

        // Atualiza a tela de fundo
        onSuccess && onSuccess({ format: 'csv', batch: files.length > 1 });
    };

    // ── Renderização ──────────────────────────────────────────────────────────
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-10 pt-10 pb-6 border-b border-slate-50 shrink-0">
                            <div>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                                    <UploadCloud size={12} /> Importação de Dados
                                </p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic">Importar para o BI</h3>
                            </div>
                            <button onClick={handleClose} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={20} /></button>
                        </div>

                        <div className="px-10 py-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">

                            {/* ── STEP 1: Status (sucesso ou erro) ── */}
                            {status === 'success' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                    <div className={`flex items-start gap-4 p-5 rounded-2xl border ${message.includes('falhas') ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <CheckCircle2 className={`${message.includes('falhas') ? 'text-amber-500' : 'text-emerald-500'} mt-0.5 shrink-0`} size={22} />
                                        <div>
                                            <p className={`text-sm font-bold leading-relaxed ${message.includes('falhas') ? 'text-amber-700' : 'text-emerald-700'}`}>{message}</p>
                                            {format === 'csv' && importedLogs.length > 0 && (
                                                <p className="text-xs text-emerald-600 mt-1 font-medium">Meses processados nesta sessão: <span className="font-black">{importedLogs.length}</span></p>
                                            )}
                                        </div>
                                    </div>

                                    {summary && files.length === 1 && (
                                        <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-5 pt-4 pb-2">Resumo do Lançamento</p>
                                            <div className="grid grid-cols-2 gap-px bg-slate-200">
                                                {[
                                                    { label: 'Receitas', value: summary.totalReceitas, color: 'text-emerald-600' },
                                                    { label: 'Impostos', value: summary.totalImpostos, color: 'text-amber-600' },
                                                    { label: 'Despesas', value: summary.totalDespesas, color: 'text-rose-600' },
                                                    { label: 'Resultado', value: summary.resultado, color: summary.resultado >= 0 ? 'text-emerald-700' : 'text-rose-700' },
                                                ].map(({ label, value, color }) => (
                                                    <div key={label} className="bg-white px-5 py-4">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                                                        <p className={`text-base font-black font-mono ${color}`}>{formatBRL(value)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                                        <button onClick={handleClose} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${format === 'csv' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-black'}`}>
                                            {format === 'csv' ? 'Concluir' : 'Fechar'}
                                        </button>
                                        
                                        {format === 'csv' && (
                                            <button onClick={() => { setStatus('idle'); setFiles([]); }} className="flex-[1.5] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                                <ListPlus size={16} /> Importar Mais
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {status === 'error' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <div className="flex items-start gap-4 bg-rose-50 border border-rose-100 p-5 rounded-2xl">
                                        <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={22} />
                                        <p className="text-sm font-bold text-rose-700 leading-relaxed">{message}</p>
                                    </div>
                                    <button onClick={() => { setStatus('idle'); setMessage(''); setFiles([]); }} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-rose-700">Tentar Novamente</button>
                                </motion.div>
                            )}

                            {/* ── STEP 2: Seleção de formato ── */}
                            {status === 'idle' && !format && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500 font-medium">Escolha o formato do arquivo que deseja importar:</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => setFormat('excel')} className="group p-6 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-100 hover:border-emerald-300 rounded-2xl text-left transition-all hover:shadow-md active:scale-95">
                                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform"><FileSpreadsheet size={28} /></div>
                                            <p className="font-black text-slate-800 text-sm uppercase tracking-tight">Excel DRE</p>
                                            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Planilha anual com 12 meses nas colunas (.xlsx)</p>
                                        </button>

                                        <button onClick={() => setFormat('csv')} className="group p-6 bg-slate-50 hover:bg-blue-50 border-2 border-slate-100 hover:border-blue-300 rounded-2xl text-left transition-all hover:shadow-md active:scale-95">
                                            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform"><Files size={28} /></div>
                                            <p className="font-black text-slate-800 text-sm uppercase tracking-tight">Balancetes CSV</p>
                                            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Importe um ou vários meses de uma vez (.csv)</p>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 3a: Upload Excel ── */}
                            {status === 'idle' && format === 'excel' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                        <FileSpreadsheet className="text-emerald-600 shrink-0" size={20} />
                                        <div><p className="text-xs font-black text-emerald-800 uppercase tracking-wide">Planilha Excel DRE</p><p className="text-[11px] text-emerald-600 font-medium">Suporta apenas 1 arquivo por vez (.xlsx)</p></div>
                                    </div>
                                    <FileDropZone accept=".xlsx,.xls,.csv" files={files} onChange={handleFileChange} fileInputRef={fileInputRef} color="emerald" multiple={false} />
                                    <div className="flex gap-3">
                                        <button onClick={() => { setFormat(null); setFiles([]); }} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest rounded-2xl transition-all">Voltar</button>
                                        <button onClick={handleUploadExcel} disabled={files.length === 0} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">Importar DRE</button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ── STEP 3b: Upload Balancete CSV (Em Lote) ── */}
                            {status === 'idle' && format === 'csv' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                                        <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <p className="text-[11px] font-black text-blue-800 uppercase tracking-widest mb-1">Importação em Lote</p>
                                            <p className="text-[11px] text-blue-700 leading-relaxed font-medium">Você pode selecionar <strong>vários arquivos CSV</strong> de uma só vez. O sistema processará todos automaticamente baseando-se na data contida no rodapé de cada arquivo.</p>
                                        </div>
                                    </div>

                                    <FileDropZone accept=".csv,.txt" files={files} onChange={handleFileChange} fileInputRef={fileInputRef} color="blue" multiple={true} />

                                    {/* Mostrar Campo de Data apenas se selecionar 1 arquivo */}
                                    {files.length <= 1 && (
                                        <div className="animate-in fade-in">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Calendar size={12} /> Forçar Competência (Opcional)</label>
                                            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-2xl p-4 font-bold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-blue-500/10 cursor-pointer" />
                                            <p className="text-[9px] text-slate-400 mt-1 font-bold">Se deixado em branco, leremos a data do rodapé do arquivo.</p>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button onClick={() => { setFormat(null); setFiles([]); setPeriod(''); }} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest rounded-2xl transition-all">Voltar</button>
                                        <button onClick={handleUploadCSV} disabled={files.length === 0} className="flex-[1.5] py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                                            Importar {files.length > 1 ? `${files.length} Meses` : 'Balancete'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ── Loader com Progresso ── */}
                            {status === 'uploading' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 flex flex-col items-center gap-5">
                                    <div className="relative">
                                        <div className="w-20 h-20 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center font-black text-blue-600 text-sm">
                                            {uploadProgress.total > 1 ? `${uploadProgress.current}/${uploadProgress.total}` : <UploadCloud size={20}/>}
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-black text-slate-700 text-sm uppercase tracking-widest italic">Processando Banco de Dados...</p>
                                        <p className="text-[11px] text-slate-400 font-medium mt-1">Por favor, não feche esta janela.</p>
                                    </div>
                                    
                                    {/* Barra de Progresso visual */}
                                    {uploadProgress.total > 1 && (
                                        <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                                            <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}></div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// ── Sub-componente: área de drop de arquivo adaptada para array ────────────────
const FileDropZone = ({ accept, files, onChange, fileInputRef, color = 'blue', multiple = false }) => {
    const colors = {
        blue:    { border: 'border-blue-200',    bg: 'bg-blue-50',    text: 'text-blue-600',    icon: 'text-blue-400'    },
        emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-400' },
    };
    const c = colors[color] || colors.blue;

    return (
        <div>
            <input type="file" multiple={multiple} ref={fileInputRef} accept={accept} onChange={onChange} className="hidden" />
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed ${c.border} ${files.length > 0 ? c.bg : 'bg-slate-50 hover:' + c.bg} rounded-2xl p-8 text-center transition-all group focus:outline-none focus:ring-4 focus:ring-blue-500/20`}
            >
                {files.length === 1 ? (
                    <div className="space-y-2">
                        <div className={`w-12 h-12 ${c.bg} ${c.text} rounded-2xl flex items-center justify-center mx-auto shadow-sm`}><FileText size={24} /></div>
                        <p className={`font-black text-sm ${c.text} uppercase tracking-tight truncate max-w-[250px] mx-auto`}>{files[0].name}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{(files[0].size / 1024).toFixed(1)} KB — clique para trocar</p>
                    </div>
                ) : files.length > 1 ? (
                    <div className="space-y-3">
                        <div className={`w-14 h-14 ${c.bg} ${c.text} rounded-2xl flex items-center justify-center mx-auto shadow-sm relative`}>
                            <Files size={28} />
                            <span className="absolute -top-2 -right-2 bg-slate-900 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">{files.length}</span>
                        </div>
                        <div>
                            <p className={`font-black text-sm ${c.text} uppercase tracking-tight`}>{files.length} Arquivos Selecionados</p>
                            <p className="text-[11px] text-slate-400 font-medium">Prontos para importação em lote.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <UploadCloud className={`${c.icon} mx-auto group-hover:scale-110 transition-transform`} size={36} />
                        <div>
                            <p className="font-black text-slate-600 text-sm uppercase tracking-tight">Clique para selecionar {multiple ? 'arquivos' : 'um arquivo'}</p>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">{accept.replace(/\./g, '').toUpperCase().replace(',', ' ou ')}</p>
                        </div>
                    </div>
                )}
            </button>
        </div>
    );
};

export default ImportModal;