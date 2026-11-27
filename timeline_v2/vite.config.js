import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

process.env.VITE_APP_VERSION = process.env.VITE_APP_VERSION || pkg.version || 'dev';

export default defineConfig({
  plugins: [viteSingleFile()],
  root: './src',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION)
  },
  server: {
    port: 5177,
    open: false,
    strictPort: true
  }
});
