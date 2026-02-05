import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

const Login = ({ onLogin, apiBase }) => {
  // Garante que usa a URL correta ou padrão
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
      
      // CORREÇÃO AQUI:
      // O backend retorna: { user: {...}, token: "..." }
      // O App.jsx espera receber exatamente essa estrutura.
      
      if (res.data.user && res.data.token) {
        onLogin(res.data); // Passa o objeto inteiro (user + token)
      } else {
        setError('Erro: Resposta do servidor incompleta.');
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
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden relative">
        
        {/* Efeito de fundo decorativo */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600"></div>

        {/* CABEÇALHO */}
        <div className="bg-white p-8 text-center pt-12 pb-4">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl mx-auto flex items-center justify-center mb-4 shadow-inner text-blue-600 font-black text-3xl">
             V
          </div>
          <h2 className="text-slate-900 font-black text-3xl tracking-tighter mb-1">VECTOR</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em]">Enterprise System</p>
        </div>

        {/* FORMULÁRIO */}
        <div className="p-8 pt-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="bg-rose-50 text-rose-600 text-xs font-bold p-4 rounded-xl border border-rose-100 text-center uppercase tracking-wide animate-pulse">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">E-mail Corporativo</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-700 font-bold"
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Senha de Acesso</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-700 font-bold"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Acessar Painel <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2026 Vector Connect Enterprises</p>
        </div>
      </div>
    </div>
  );
};

export default Login;