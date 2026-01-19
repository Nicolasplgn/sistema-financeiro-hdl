// ARQUIVO: src/components/ui/ConfirmationModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

export const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText = "Confirmar", 
  cancelText = "Cancelar",
  variant = "info" // 'info' (azul) ou 'danger' (vermelho)
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          
          {/* Backdrop (Fundo Escuro) */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* O Card do Modal */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-white/20"
          >
            <div className="p-8 text-center">
              {/* Ícone Animado */}
              <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center shadow-lg ${variant === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-600'}`}>
                {variant === 'danger' ? <AlertTriangle size={40} /> : <CheckCircle2 size={40} />}
              </div>

              {/* Textos */}
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight italic">
                {title}
              </h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">
                {description}
              </p>

              {/* Botões */}
              <div className="flex gap-3">
                <button 
                  onClick={onClose}
                  className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest rounded-2xl transition-all"
                >
                  {cancelText}
                </button>
                <button 
                  onClick={() => { onConfirm(); onClose(); }}
                  className={`flex-1 py-4 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:-translate-y-1 transition-all ${
                    variant === 'danger' 
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' 
                      : 'bg-slate-900 hover:bg-black shadow-slate-200'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};