import axios from 'axios';

/** Endereço do backend: mesma máquina que serve a tela, porta 4000. */
export const API_BASE = `http://${window.location.hostname}:4000`;

/**
 * Cliente único da API. Coloca o token de login em toda requisição e, se o
 * servidor responder 401 (sessão expirada), avisa o App para voltar ao login.
 */
const http = axios.create({ baseURL: `${API_BASE}/api` });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('hdl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) window.dispatchEvent(new Event('vector:session-expired'));
    return Promise.reject(error);
  },
);

export const errorMessage = (error, fallback = 'Não foi possível concluir a operação.') =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

export default http;
