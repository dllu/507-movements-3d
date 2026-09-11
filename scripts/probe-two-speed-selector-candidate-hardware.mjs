import { writeFile } from 'node:fs/promises';
import { makeTwoSpeedSelectorCandidate } from '../artifacts/review/059-candidate-model.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const model = makeTwoSpeedSelectorCandidate(), { parts, geometry: p } = model.root.userData;
const bodies = [['driverDrum', 'driverShaft'], ['loosePulley'],
  ...[0, 1].map(i => [`inputShaft${i}`, `inputPulley${i}`, `inputGear${i}`]),
  ['outputShaft', 'outputGear0', 'outputGear1'], ['belt']];
const data = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, { mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) }]));
const pairs = [];
for (let i = 0; i < bodies.length; i += 1) for (let j = i + 1; j < bodies.length; j += 1) for (const a of bodies[i]) for (const b of bodies[j]) {
  if (/^inputGear/.test(a) && b === a.replace('input', 'output')) continue;
  pairs.push({ a, b, checks: 0, boxSeparatedPoses: 0, inside: 0, maximumDepth: 0 });
}
const count = Number(process.env.PROBE_POSES ?? 97), period = p.cycleDuration;
for (let i = 0; i < count; i += 1) {
  model.update(period * i / (count - 1)); model.root.updateMatrixWorld(true);
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
        record.inside += 1; record.firstWitness ??= { time: period * i / (count - 1), source: a.mesh.name, target: b.mesh.name, point: q.toArray(), depth }; record.maximumDepth = Math.max(record.maximumDepth, depth);
      }
    }
  }
  if (i % 24 === 0) console.log(JSON.stringify({ pose: i, checks: pairs.reduce((sum, p) => sum + p.checks, 0), inside: pairs.reduce((sum, p) => sum + p.inside, 0) }));
}
const report = { method: 'Actual closed skins in both directions for every independently moving hardware pair; tooth engagements checked separately. Disjoint transformed AABBs certify separated poses.',
  poses: count, period, pairs, checks: pairs.reduce((sum, p) => sum + p.checks, 0), inside: pairs.reduce((sum, p) => sum + p.inside, 0) };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/059-candidate-hardware.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ poses: count, pairs: pairs.length, checks: report.checks, inside: report.inside, issues: pairs.filter(v => v.inside) })); if (report.inside) process.exitCode = 1;
