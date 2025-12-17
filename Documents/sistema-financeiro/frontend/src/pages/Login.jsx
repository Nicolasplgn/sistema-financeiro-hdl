import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Mail, LogIn, AlertCircle, CheckCircle } from 'lucide-react';

const Login = ({ onLogin, apiBase }) => {
  // Configura a URL base. Se não vier via props, tenta descobrir o IP automaticamente
  const BASE_URL = apiBase || `http://${window.location.hostname}:4000`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // CORREÇÃO: A rota correta no backend agora é /api/auth/login
      console.log(`Tentando login em: ${BASE_URL}/api/auth/login`);
      
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email,
        password
      });

      // Se chegou aqui, deu sucesso (status 200)
      setSuccess(true);
      
      // Pequeno delay visual para mostrar sucesso antes de redirecionar
      setTimeout(() => {
        onLogin(response.data.user);
      }, 800);

    } catch (err) {
      console.error("Erro Login:", err);
      
      // Tratamento de erros
      if (err.response) {
        // Erro retornado pelo backend (ex: 401 Credenciais inválidas)
        setError(err.response.data.message || 'Erro ao realizar login.');
      } else if (err.request) {
        // Erro de conexão (backend desligado ou IP errado)
        setError('Erro de conexão com o servidor. Verifique se o backend está rodando.');
      } else {
        setError('Erro desconhecido ao tentar logar.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="bg-blue-600 p-8 text-center">
  <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-sm mb-4">
    <Lock className="text-white" size={32} />
  </div>
  <h1 className="text-2xl font-bold text-white tracking-wide">Start's Control</h1>
  <p className="text-blue-100 text-sm mt-1">Enterprises System</p>
</div>

        {/* Formulário */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Mensagem de Erro */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3">
                <AlertCircle className="text-red-500 mt-0.5" size={18} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Mensagem de Sucesso */}
            {success && (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-md flex items-center gap-3 animate-fade-in">
                <CheckCircle className="text-emerald-500" size={18} />
                <p className="text-sm text-emerald-700 font-bold">Login realizado! Entrando...</p>
              </div>
            )}

            {/* Input Email */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-700"
                  placeholder="admin@hdl.com"
                />
              </div>
            </div>

            {/* Input Senha */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Botão Login */}
            <button 
              type="submit" 
              disabled={loading || success}
              className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                ${loading || success ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30'}
              `}
            >
              {loading ? (
                <span className="animate-pulse">Autenticando...</span>
              ) : success ? (
                <span>Sucesso!</span>
              ) : (
                <>
                  <LogIn size={20} /> Entrar no Sistema
                </>
              )}
            </button>
          </form>

          {/* Rodapé */}
          <div className="mt-8 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} SCE - Start's Control Enterprises.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;