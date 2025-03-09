import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import pkg from './package.json';

// Update manifest version from package.json
manifest.version = pkg.version;

export default defineConfig({
  plugins: [
    crx({ manifest }),
    viteCommonjs(),
  ],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html'
      },
      output: {
        format: 'es'
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [
        /node_modules/,
      ]
    },
    sourcemap: true,
    minify: false
  },
  resolve: {
    alias: {
      '/node_modules': resolve(__dirname, 'node_modules'),
      stream: 'stream-browserify',
      querystring: 'querystring-es3',
      url: 'url/',
      buffer: 'buffer/',
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis'
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  }
});
