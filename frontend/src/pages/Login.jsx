import React, { useState } from 'react';
import { ArrowRight, Calculator, FileText, LayoutDashboard } from 'lucide-react';
import http from '../services/http';
import { Alert, Button, Field, Input } from '../components/ui';

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
      const res = await http.post('/auth/login', { email, password });
      if (res.data.user && res.data.token) onLogin(res.data);
      else setError('O servidor respondeu sem os dados de acesso.');
    } catch (err) {
      setError(err.response?.status === 401 ? 'E-mail ou senha incorretos.' : 'Não foi possível falar com o servidor. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-ink">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand text-white font-bold flex items-center justify-center">V</div>
          <div>
            <p className="font-semibold text-white">Vector Connect</p>
            <p className="text-xs text-sidebar-ink-2">Gestão financeira</p>
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-3xl font-semibold text-white leading-tight">Lançamentos, resultado e formação de preço no mesmo lugar.</h1>
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3"><LayoutDashboard size={18} className="text-brand shrink-0 mt-0.5" /> Acompanhe faturamento, saídas e lucro de cada empresa ou do grupo.</li>
            <li className="flex gap-3"><FileText size={18} className="text-brand shrink-0 mt-0.5" /> DRE mês a mês, gerada a partir dos lançamentos ou dos balancetes.</li>
            <li className="flex gap-3"><Calculator size={18} className="text-brand shrink-0 mt-0.5" /> Planilha de preços com as mesmas abas do Excel: custos, rateio, fichas, markup e tributos.</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-ink-2">© {new Date().getFullYear()} Vector Connect Enterprises</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <div className="lg:hidden w-10 h-10 rounded-lg bg-brand text-white font-bold flex items-center justify-center mb-6">V</div>
            <h2 className="text-2xl font-semibold text-ink">Entrar</h2>
            <p className="text-sm text-ink-2 mt-1">Use o e-mail e a senha cadastrados para você.</p>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="E-mail">
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" required autoFocus />
          </Field>
          <Field label="Senha">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            Entrar <ArrowRight size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
