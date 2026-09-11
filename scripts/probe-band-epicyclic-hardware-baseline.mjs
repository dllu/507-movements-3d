import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[56]), b = model.root.userData.blocks;
const meshes = root => { const values = []; root.traverse(v => { if (v.geometry) values.push(v); }); return values; };
const pairs = meshes(b.sun).map((mesh, i) => ({ a: b.carrierSleeve, b: mesh, name: `carrier-sleeve/sun-${i}-${mesh.geometry.type}` }));
for (const [i, spoke] of b.ringSupportSpokes.entries()) for (const [name, root] of [['planet-shaft', b.planetShaft], ['carrier-arm', b.carrierArm]]) {
  for (const [j, mesh] of meshes(root).entries()) pairs.push({ a: spoke, b: mesh, name: `ring-spoke-${i}/${name}-${j}` });
}
const records = pairs.map(pair => ({ ...pair, solid: solidSurface(pair.b.geometry), points: surfacePoints(pair.a.geometry), checks: 0, inside: 0, maximumDepth: 0 }));
const state = model.root.userData.kinematics, period = 2 * Math.PI / Math.abs(state.ringAngularSpeed - state.carrierAngularSpeed);
for (let i = 0; i < 97; i += 1) {
  const time = period * i / 96; model.update(time); model.root.updateMatrixWorld(true);
  for (const p of records) {
    const matrix = p.b.matrixWorld.clone().invert().multiply(p.a.matrixWorld);
    for (const v of p.points) {
      const q = v.clone().applyMatrix4(matrix); p.checks += 1;
      if (!p.solid.inside(q)) continue;
      const depth = p.solid.distance(q); if (depth <= 1e-6) continue;
      p.inside += 1; p.maximumDepth = Math.max(p.maximumDepth, depth); p.firstWitness ??= { time, point: q.toArray(), depth };
    }
  }
}
const report = { movement: 57, poses: 97, period,
  method: 'Actual source surfaces into target closed skins in one direction; scoped baseline, not a complete hardware audit.',
  pairs: records.map(({ name, checks, inside, maximumDepth, firstWitness }) => ({ name, checks, inside, maximumDepth, firstWitness })) };
await writeFile('artifacts/review/057-hardware-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.pairs.filter(v => v.inside), null, 2));
