import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Isso libera o acesso via IP de rede (ex: 10.50.5.103)
    port: 3000, // Força a porta 3000 (já que seu log mostrava essa porta)
    strictPort: true,
    watch: {
      usePolling: true, // Ajuda em alguns ambientes Windows/Docker
    },
    hmr: {
      // Garante que o Hot Module Replacement funcione via IP
      clientPort: 3000 
    }
  }
});