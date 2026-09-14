import fs from 'node:fs';
export function micrometerStudySources(script) {
 return [script,'scripts/lib/micrometer-study-sources.mjs','scripts/lib/study-report-io.mjs',
  ...['src/simulation/mujoco-micrometer','src/simulation/mujoco'].flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n)),
  'src/simulation/mujoco-screw/thread-geometry.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/primitives.js','src/simulation/dispose-model.js','public/engravings/mm_111.png','package-lock.json'];
}
