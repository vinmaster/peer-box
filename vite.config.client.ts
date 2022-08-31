import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

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
});
