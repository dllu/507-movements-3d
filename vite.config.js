import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

// The site routes by clean paths (plate/3, movement/046, about, search). A
// static host has no rewrite rules, so the build writes a copy of index.html
// at every route; index.html derives its <base> from its own path, keeping
// assets relative and the dist directory portable to any host subdirectory.
function staticRoutePages() {
  let outDir = 'dist';
  return {
    name: 'static-route-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      // Route copies write their asset tags from the inline <base> script, so
      // the browser's preload scanner does not fetch ./assets relative to the
      // route directory before the base applies.
      const assetTags = /\s*<(?:script type="module"[^>]*><\/script>|link rel="(?:modulepreload|stylesheet)"[^>]*>)/g;
      const index = readFileSync(join(outDir, 'index.html'), 'utf8');
      const tags = (index.match(assetTags) ?? []).map((tag) => tag.trim()).join('');
      const html = index.replace(assetTags, '')
        .replace(/(document\.write\('<base href="' \+ href \+ '">'\);)/, `$1\n        document.write(${JSON.stringify(tags).replace(/</g, '\\u003c')});`);
      if (!tags || html === index.replace(assetTags, '')) throw new Error('static-route-pages: could not relocate asset tags');
      const catalog = JSON.parse(readFileSync('src/data/movements.json', 'utf8'));
      const layout = JSON.parse(readFileSync('src/data/book-layout.json', 'utf8'));
      const routes = [
        'about',
        'search',
        ...layout.pages.map((_, index) => `plate/${index + 1}`),
        ...catalog.movements.map((movement) => `movement/${movement.number}`),
      ];
      for (const route of routes) {
        mkdirSync(join(outDir, route), { recursive: true });
        writeFileSync(join(outDir, route, 'index.html'), html);
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [staticRoutePages()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {input: {main: 'index.html', mujoco082: 'mujoco-082.html'}},
  },
});
