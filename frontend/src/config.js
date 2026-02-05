// src/config.js

// 1. Pega o "hostname" da URL atual do navegador.
// Se você acessar por "localhost", ele pega "localhost".
// Se acessar por "192.168.0.106", ele pega "192.168.0.106".
const hostname = window.location.hostname;

// 2. Define a porta do Backend (Geralmente 4000)
const BACKEND_PORT = 4000;

// 3. Monta a URL automaticamente
// Resultado: "http://192.168.0.106:4000" (ou qualquer que seja o IP)
export const API_BASE_URL = `http://${hostname}:${BACKEND_PORT}`;

console.log('🔗 API conectada em:', API_BASE_URL);