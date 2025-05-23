import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pluginChecker from 'vite-plugin-checker';
import path from 'path';

export default defineConfig({
  root: '.',
  plugins: [react(), pluginChecker({ typescript: true })],
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
