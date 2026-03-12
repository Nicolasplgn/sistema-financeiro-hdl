import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, FileSpreadsheet, FileText, UploadCloud,
    Loader2, CheckCircle2, AlertCircle, Calendar,
    ChevronRight, Info, Plus, ListPlus, Trash2
} from 'lucide-react';
import axios from 'axios';

const ImportModal = ({ isOpen, onClose, companyId, apiBase, onSuccess }) => {
    const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;

    // ── Estados Principais ──────────────────────────────────────────────────
    const [format, setFormat] = useState(null); // 'excel' | 'csv'
    
    // Estado para DRE (Excel = 1 arquivo)
    const[excelFile, setExcelFile] = useState(null);
    const excelInputRef = useRef(null);

    // Estado para Balancetes (CSV = Múltiplos arquivos com Mês manual)
    const[csvBatch, setCsvBatch] = useState([{ id: Date.now(), period: '', file: null }]);

    // Status do Modal
    const [status, setStatus] = useState('idle'); // idle | uploading | success | error
    const [message, setMessage] = useState('');
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [importedLogs, setImportedLogs] = useState([]); 

    // ── Helpers ─────────────────────────────────────────────────────────────
    const resetState = () => {
        setFormat(null);
        setExcelFile(null);
        setCsvBatch([{ id: Date.now(), period: '', file: null }]);
        setStatus('idle');
        setMessage('');
        setUploadProgress({ current: 0, total: 0 });
        setImportedLogs([]); 
        if (excelInputRef.current) excelInputRef.current.value = null;
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ── Gerenciamento do Lote de CSVs ────────────────────────────────────────
    const updateBatchItem = (id, field, value) => {
        setCsvBatch(prev => prev.map(item => item.id === id ? { ...item,[field]: value } : item));
    };

    const removeBatchItem = (id) => {
        setCsvBatch(prev => prev.filter(item => item.id !== id));
    };

    const addBatchItem = () => {
        let nextPeriod = '';
        const lastItem = csvBatch[csvBatch.length - 1];
        
        // Auto-incrementa o mês se o último estiver preenchido para facilitar
        if (lastItem && lastItem.period) {
            const [y, m] = lastItem.period.split('-').map(Number);
            let nextM = m + 1;
            let nextY = y;
            if (nextM > 12) { nextM = 1; nextY++; }
            nextPeriod = `${nextY}-${String(nextM).padStart(2, '0')}`;
        }
        
        setCsvBatch(prev =>[...prev, { id: Date.now(), period: nextPeriod, file: null }]);
    };

    // ── Upload Excel (1 Arquivo) ────────────────────────────────────────────
    const handleUploadExcel = async () => {
        if (!excelFile) return;
        setStatus('uploading');
        
        const fd = new FormData();
        fd.append('file', excelFile);
        fd.append('companyId', companyId);
        
        try {
            const res = await axios.post(`${BASE_URL}/api/import/dre`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStatus('success');
            setMessage(res.data.message || 'DRE Anual importada com sucesso!');
            onSuccess && onSuccess({ format: 'excel' });
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.error || 'Erro ao importar planilha. Verifique o modelo.');
        }
    };

    // ── Upload Balancetes CSV (Lote Sequencial) ─────────────────────────────
    const handleUploadBatchCSV = async () => {
        // Validação: todos devem ter mês e arquivo
        const invalid = csvBatch.find(i => !i.period || !i.file);
        if (invalid) {
            alert("Preencha a competência e selecione o arquivo para TODOS os itens da lista.");
            return;
        }

        setStatus('uploading');
        setUploadProgress({ current: 0, total: csvBatch.length });

        let successCount = 0;
        let errorCount = 0;
        let lastSuccessSummary = null;

        // Envia um a um para não sobrecarregar a API
        for (let i = 0; i < csvBatch.length; i++) {
            const item = csvBatch[i];
            setUploadProgress({ current: i + 1, total: csvBatch.length });

            const fd = new FormData();
            fd.append('file', item.file);
            fd.append('companyId', companyId);
            fd.append('period', item.period); // Envia o mês manual que o usuário escolheu

            try {
                const res = await axios.post(`${BASE_URL}/api/import/balancete`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                successCount++;
                lastSuccessSummary = res.data.summary;
                setImportedLogs(prev =>[...prev, { period: item.period, result: res.data.summary.resultado }]);
            } catch (err) {
                errorCount++;
                console.error(`Erro no arquivo do mês ${item.period}:`, err);
            }
        }

        setStatus('success');
        
        if (csvBatch.length === 1 && errorCount === 0) {
            setMessage(`Balancete importado com sucesso!`);
        } else {
            setMessage(`Lote concluído: ${successCount} meses importados.`);
            if (errorCount > 0) setMessage(prev => prev + ` (${errorCount} falhas).`);
        }

        onSuccess && onSuccess({ format: 'csv', batch: true });
    };

    // ── Renderização ─────────────────────────────────────────────────────────
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

                            {/* ── TELA DE SUCESSO ── */}
                            {status === 'success' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                    <div className={`flex items-start gap-4 p-5 rounded-2xl border ${message.includes('falhas') ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <CheckCircle2 className={`${message.includes('falhas') ? 'text-amber-500' : 'text-emerald-500'} mt-0.5 shrink-0`} size={22} />
                                        <div>
                                            <p className={`text-sm font-bold leading-relaxed ${message.includes('falhas') ? 'text-amber-700' : 'text-emerald-700'}`}>{message}</p>
                                        </div>
                                    </div>

                                    {/* Resumo se tiver logs */}
                                    {importedLogs.length > 0 && (
                                        <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-5 pt-4 pb-2">Meses Processados ({importedLogs.length})</p>
                                            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                                {importedLogs.map((log, i) => (
                                                    <div key={i} className="flex justify-between items-center px-5 py-3 bg-white">
                                                        <span className="text-xs font-bold text-slate-600">{log.period}</span>
                                                        <span className={`text-xs font-mono font-black ${log.result >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {formatBRL(log.result)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                                        <button onClick={handleClose} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95">
                                            Concluir e Fechar
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ── TELA DE ERRO ── */}
                            {status === 'error' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <div className="flex items-start gap-4 bg-rose-50 border border-rose-100 p-5 rounded-2xl">
                                        <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={22} />
                                        <p className="text-sm font-bold text-rose-700 leading-relaxed">{message}</p>
                                    </div>
                                    <button onClick={() => { setStatus('idle'); setMessage(''); }} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-rose-700">Tentar Novamente</button>
                                </motion.div>
                            )}

                            {/* ── SELEÇÃO DE FORMATO ── */}
                            {status === 'idle' && !format && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-500 font-medium">Escolha o formato do arquivo que deseja importar:</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => setFormat('excel')} className="group p-6 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-100 hover:border-emerald-300 rounded-2xl text-left transition-all hover:shadow-md active:scale-95 flex flex-col justify-between h-full">
                                            <div>
                                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform"><FileSpreadsheet size={28} /></div>
                                                <p className="font-black text-slate-800 text-sm uppercase tracking-tight">Excel DRE</p>
                                                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Planilha anual com 12 meses nas colunas (.xlsx)</p>
                                            </div>
                                        </button>

                                        <button onClick={() => setFormat('csv')} className="group p-6 bg-slate-50 hover:bg-blue-50 border-2 border-slate-100 hover:border-blue-300 rounded-2xl text-left transition-all hover:shadow-md active:scale-95 flex flex-col justify-between h-full">
                                            <div>
                                                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform"><ListPlus size={28} /></div>
                                                <p className="font-black text-slate-800 text-sm uppercase tracking-tight">Balancetes CSV</p>
                                                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Importe em lote informando o mês de cada arquivo (.csv)</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── UPLOAD EXCEL (1 ARQUIVO) ── */}
                            {status === 'idle' && format === 'excel' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                        <FileSpreadsheet className="text-emerald-600 shrink-0" size={20} />
                                        <div><p className="text-xs font-black text-emerald-800 uppercase tracking-wide">Planilha Excel DRE</p><p className="text-[11px] text-emerald-600 font-medium">Suporta apenas 1 arquivo por vez (.xlsx)</p></div>
                                    </div>
                                    
                                    <div>
                                        <input type="file" ref={excelInputRef} accept=".xlsx,.xls,.csv" onChange={e => setExcelFile(e.target.files[0])} className="hidden" />
                                        <button type="button" onClick={() => excelInputRef.current?.click()} className={`w-full border-2 border-dashed ${excelFile ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 hover:bg-emerald-50 border-emerald-200'} rounded-2xl p-8 text-center transition-all group`}>
                                            {excelFile ? (
                                                <div className="space-y-2">
                                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm"><FileText size={24} /></div>
                                                    <p className="font-black text-sm text-emerald-700 uppercase tracking-tight truncate max-w-[250px] mx-auto">{excelFile.name}</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <UploadCloud className="text-emerald-400 mx-auto group-hover:scale-110 transition-transform" size={36} />
                                                    <div>
                                                        <p className="font-black text-slate-600 text-sm uppercase tracking-tight">Clique para selecionar a DRE</p>
                                                        <p className="text-[11px] text-slate-400 font-medium mt-1">XLSX, XLS ou CSV</p>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => { setFormat(null); setExcelFile(null); }} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest rounded-2xl transition-all">Voltar</button>
                                        <button onClick={handleUploadExcel} disabled={!excelFile} className="flex-[1.5] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">Importar DRE</button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ── UPLOAD BALANCETES (LOTE / VÁRIOS) ── */}
                            {status === 'idle' && format === 'csv' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                                        <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <p className="text-[11px] font-black text-blue-800 uppercase tracking-widest mb-1">Upload de Balancetes em Lote</p>
                                            <p className="text-[11px] text-blue-700 leading-relaxed font-medium">Adicione as competências (meses) e anexe o arquivo CSV correspondente a cada uma. Enviaremos todos de uma vez.</p>
                                        </div>
                                    </div>

                                    {/* LISTA DINÂMICA DE ARQUIVOS */}
                                    <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-2 custom-scrollbar pb-2">
                                        <AnimatePresence>
                                            {csvBatch.map((item, index) => (
                                                <motion.div key={item.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 relative">
                                                    
                                                    {/* Botão Remover (se tiver mais de 1 linha) */}
                                                    {csvBatch.length > 1 && (
                                                        <button onClick={() => removeBatchItem(item.id)} className="absolute -top-2 -right-2 bg-rose-100 text-rose-600 rounded-full p-1 hover:bg-rose-500 hover:text-white transition-colors shadow-sm z-10">
                                                            <X size={12} />
                                                        </button>
                                                    )}

                                                    {/* Mês */}
                                                    <div className="w-full sm:w-1/3">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Competência</label>
                                                        <input 
                                                            type="month" 
                                                            value={item.period} 
                                                            onChange={e => updateBatchItem(item.id, 'period', e.target.value)}
                                                            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-3 font-bold text-slate-700 outline-none transition-all cursor-pointer text-xs"
                                                        />
                                                    </div>

                                                    {/* Arquivo */}
                                                    <div className="w-full sm:w-2/3">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Arquivo .CSV</label>
                                                        <div className="relative">
                                                            <input 
                                                                type="file" 
                                                                accept=".csv,.txt"
                                                                onChange={e => {
                                                                    if(e.target.files[0]) updateBatchItem(item.id, 'file', e.target.files[0]);
                                                                }}
                                                                className="hidden"
                                                                id={`file-${item.id}`}
                                                            />
                                                            <label 
                                                                htmlFor={`file-${item.id}`}
                                                                className={`w-full flex items-center justify-between border border-dashed rounded-xl p-3 cursor-pointer transition-all ${item.file ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 hover:bg-slate-50 hover:border-blue-300 text-slate-500'}`}
                                                            >
                                                                <span className="text-xs font-bold truncate pr-4">
                                                                    {item.file ? item.file.name : 'Selecionar arquivo...'}
                                                                </span>
                                                                {item.file ? <CheckCircle2 size={16} className="text-blue-500 shrink-0"/> : <UploadCloud size={16} className="shrink-0"/>}
                                                            </label>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                        
                                        <button 
                                            onClick={addBatchItem}
                                            className="w-full py-4 mt-2 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus size={16} /> Adicionar Mês
                                        </button>
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                                        <button onClick={() => { setFormat(null); setCsvBatch([{ id: Date.now(), period: '', file: null }]); }} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest rounded-2xl transition-all">Voltar</button>
                                        <button onClick={handleUploadBatchCSV} disabled={csvBatch.some(i => !i.period || !i.file)} className="flex-[1.5] py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                            <UploadCloud size={16}/> Importar Lote Completo
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ── LOADER DE PROCESSAMENTO ── */}
                            {status === 'uploading' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 flex flex-col items-center gap-5">
                                    <div className="relative">
                                        <div className="w-20 h-20 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center font-black text-blue-600 text-sm">
                                            {uploadProgress.total > 1 ? `${uploadProgress.current}/${uploadProgress.total}` : <Loader2 size={20} className="animate-spin text-blue-400"/>}
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-black text-slate-700 text-sm uppercase tracking-widest italic">Lendo Arquivos e Consolidando...</p>
                                        <p className="text-[11px] text-slate-400 font-medium mt-1">Isso pode levar alguns segundos. Não feche a janela.</p>
                                    </div>
                                    
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

export default ImportModal;