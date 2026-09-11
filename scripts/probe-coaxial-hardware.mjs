import { writeFile } from 'node:fs/promises';
import { makeCoaxialCandidate } from '../artifacts/review/055-candidate-model.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const model = makeCoaxialCandidate(), { parts, geometry: p } = model.root.userData;
const bodies = [['gearAMesh', 'outputShaft'], ['pinionMesh', 'pinionShaft'], ['ringMesh', 'backplate', 'sleeve']];
const data = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, { mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) }]));
const pairs = [];
for (let i = 0; i < bodies.length; i += 1) for (let j = i + 1; j < bodies.length; j += 1) for (const a of bodies[i]) for (const b of bodies[j]) {
  if ((a === 'gearAMesh' && b === 'pinionMesh') || (a === 'pinionMesh' && b === 'ringMesh')) continue;
  pairs.push({ a, b, checks: 0, boxSeparatedPoses: 0, inside: 0, maximumDepth: 0 });
}
const count = Number(process.env.PROBE_POSES ?? 97), period = 2 * Math.PI / (p.inputSpeed * p.pinionTeeth / p.gearCTeeth);
for (let i = 0; i < count; i += 1) {
  model.update(period * (i + 0.413) / count); model.root.updateMatrixWorld(true);
  for (const record of pairs) {
    const first = data[record.a], second = data[record.b];
    const transform = second.mesh.matrixWorld.clone().invert().multiply(first.mesh.matrixWorld);
    if (!first.solid.box.clone().applyMatrix4(transform).intersectsBox(second.solid.box)) { record.boxSeparatedPoses += 1; continue; }
    for (const [a, b] of [[first, second], [second, first]]) {
      const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const point of a.points) {
        const q = point.clone().applyMatrix4(matrix); record.checks += 1;
        if (!b.solid.inside(q)) continue;
        const depth = b.solid.distance(q); if (depth < 1e-6) continue;
        record.inside += 1; record.maximumDepth = Math.max(record.maximumDepth, depth);
      }
    }
  }
  if (i % 24 === 0) console.log(JSON.stringify({ pose: i, checks: pairs.reduce((sum, p) => sum + p.checks, 0), inside: pairs.reduce((sum, p) => sum + p.inside, 0) }));
}
const report = { method: 'Actual closed skins in both directions for every independently moving hardware pair; tooth engagements checked separately. Disjoint transformed AABBs certify separated poses.',
  poses: count, period, pairs, checks: pairs.reduce((sum, p) => sum + p.checks, 0), inside: pairs.reduce((sum, p) => sum + p.inside, 0) };
await writeFile('artifacts/review/055-candidate-hardware.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report)); if (report.inside) process.exitCode = 1;
