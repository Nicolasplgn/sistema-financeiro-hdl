import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Mail, ArrowRight } from 'lucide-react';

// IMPORTANDO A NOVA LOGO VECTOR
import vectorLogo from '../assets/vector-logo.png'; 

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('http://localhost:4000/api/auth/login', { email, password });
      if (res.data.user) {
        onLogin(res.data.user);
      }
    } catch (err) {
      console.error("Erro Login:", err);
      if (err.response && err.response.status === 401) {
        setError('E-mail ou senha incorretos.');
      } else {
        setError('Erro ao conectar com o servidor.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        
        {/* CABEÇALHO COM A LOGO VECTOR */}
        <div className="bg-white p-8 text-center border-b border-slate-100 flex flex-col items-center pt-10">
          
          <div className="mb-4 hover:scale-105 transition-transform duration-300">
            <img 
              src={vectorLogo} 
              alt="Vector Connect Enterprises" 
              className="h-20 w-auto object-contain" 
            />
          </div>
          
          <h2 className="text-blue-600 font-extrabold text-2xl tracking-tight">VECTOR</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Connect Enterprises</p>
          <p className="text-slate-500 text-sm mt-4">Gestão Financeira Inteligente</p>
        </div>

        {/* FORMULÁRIO */}
        <div className="p-8 pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="bg-rose-50 text-rose-600 text-sm p-3 rounded-lg border border-rose-100 text-center font-bold">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">E-mail</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-700 font-medium"
                  placeholder="usuario@vector.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-700 font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="animate-pulse">Conectando...</span>
              ) : (
                <>
                  Entrar <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400">© 2025 Vector Connect Enterprises</p>
        </div>
      </div>
    </div>
  );
};

export default Login;