import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import NodeModulesPolyfills from '@esbuild-plugins/node-modules-polyfill';
import GlobalsPolyfills from '@esbuild-plugins/node-globals-polyfill';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  root: './src/client',
  server: { host: true },
  build: {
    outDir: '../../build/public',
    emptyOutDir: false,
  },
  clearScreen: false,
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        NodeModulesPolyfills(),
        GlobalsPolyfills({
          process: true,
          buffer: true,
        }),
      ],
      define: {
        global: 'globalThis',
      },
    },
  },
});
