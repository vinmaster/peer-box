import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      'simple-peer': 'simple-peer/simplepeer.min.js',
    },
  },
  plugins: [vue(), nodePolyfills()],
  root: './src/client',
  server: { host: true, port: 3000 },
  build: {
    // outDir: '../../build/public',
    outDir: '../server/public',
    emptyOutDir: false,
  },
  clearScreen: false,
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
