import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

process.env.VITE_APP_VERSION = process.env.VITE_APP_VERSION || pkg.version || 'dev';

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [viteSingleFile()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION)
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5174,
    cors: true
  }
});
