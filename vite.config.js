import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets plus hash routing make the dist directory portable to any
  // static host path without server rewrite rules.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
  },
});
