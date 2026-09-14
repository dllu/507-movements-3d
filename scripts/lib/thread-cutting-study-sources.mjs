import fs from 'node:fs';
export function threadCuttingStudySources(script) {
 return [script,'scripts/lib/thread-cutting-study-sources.mjs','scripts/lib/study-report-io.mjs',
  ...['src/simulation/mujoco-thread-cutting','src/simulation/mujoco'].flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n)),
  'src/simulation/mujoco-screw/thread-geometry.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/coaxial-gear-geometry.js','src/simulation/primitives.js','src/simulation/dispose-model.js',
  'public/engravings/mm_109.png','package-lock.json'];
}
