import axios from 'axios';

const api = axios.create({
  baseURL: `http://${window.location.hostname}:4000`,
});

// Interceptor para injetar o token automaticamente em TODAS as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hdl_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros globais (ex: token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Se der erro de autenticação, limpa tudo e recarrega para ir pro login
      localStorage.clear();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;