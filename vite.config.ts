import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pluginChecker from 'vite-plugin-checker';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), pluginChecker({ typescript: true }), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },

  // test: {
  //   globals: true,
  //   environment: 'jsdom',
  //   root: 'client/src/tests',
  // },
});
