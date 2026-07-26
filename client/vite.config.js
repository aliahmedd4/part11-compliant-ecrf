import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api and the API routes to the Express backend on 4000,
// so the client and API share an origin during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/subjects': 'http://localhost:4000',
      '/forms': 'http://localhost:4000',
      '/queries': 'http://localhost:4000',
      '/export': 'http://localhost:4000',
      '/admin': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
