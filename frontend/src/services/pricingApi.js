import axios from 'axios';

/**
 * Cliente das rotas de precificação. Todo cálculo (ficha técnica, rateio,
 * markup, tributos, folha) é feito no backend, com as fórmulas das planilhas;
 * as telas só enviam os dados digitados e exibem o resultado.
 */
export const createPricingApi = (apiBase) => {
  const client = axios.create({ baseURL: `${apiBase || `http://${window.location.hostname}:4000`}/api` });
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('hdl_token') || localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return client;
};

export const errorMessage = (error, fallback = 'Não foi possível concluir a operação.') =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;
