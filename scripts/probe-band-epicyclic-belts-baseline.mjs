import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[56]), b = model.root.userData.blocks;
model.update(0); model.root.updateMatrixWorld(true);
const targets = [{ name: 'ring-drum', mesh: b.ringDrum }, { name: 'sun-drum', mesh: b.sunDrum }];
b.driver.userData.rotor.traverse(mesh => { if (mesh.geometry) targets.push({ name: `driver-${targets.length}-${mesh.geometry.type}`, mesh }); });
const records = [];
for (const [name, belt] of [['open', b.outerBelt], ['crossed', b.innerBelt]]) {
  const mesh = belt.userData.mesh, points = surfacePoints(mesh.geometry);
  for (const target of targets) {
    const solid = solidSurface(target.mesh.geometry), transform = target.mesh.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
    const record = { belt: name, target: target.name, checks: 0, inside: 0, maximumDepth: 0 };
    for (const point of points) {
      const q = point.clone().applyMatrix4(transform); record.checks += 1;
      if (!solid.inside(q)) continue;
      const depth = solid.distance(q); if (depth <= 1e-6) continue;
      record.inside += 1; record.maximumDepth = Math.max(record.maximumDepth, depth); record.firstWitness ??= { point: q.toArray(), depth };
    }
    records.push(record);
  }
}
await writeFile('artifacts/review/057-belt-contact-baseline.json', JSON.stringify({ movement: 57, time: 0,
  method: 'Actual belt vertices, face centroids and edge midpoints inside the driver and driven pulley solids. One-direction initial-pose baseline.', pairs: records }, null, 2) + '\n');
console.log(JSON.stringify(records.filter(v => v.inside), null, 2));
