import { writeFile } from 'node:fs/promises';
import { makeSpringJumpCam } from '../src/simulation/spring-jump-cam.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const model = makeSpringJumpCam(), { parts, families, geometry: p } = model.root.userData;
const bodies = Object.values(Object.keys(parts).reduce((groups, name) => { (groups[families[name]] ??= []).push(name); return groups; }, {}));
const data = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, { mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) }]));
const pairs = [];
for (let i = 0; i < bodies.length; i += 1) for (let j = i + 1; j < bodies.length; j += 1) for (const a of bodies[i]) for (const b of bodies[j]) {
  // The dense generated worm pair has a separate engagement sweep.
  if ([a, b].includes('wormWheel') && [a, b].includes('wormThread')) continue;
  pairs.push({ a, b, checks: 0, boxSeparatedPoses: 0, inside: 0, maximumDepth: 0 });
}
const count = Number(process.env.PROBE_POSES ?? 97), times = Array.from({ length: count }, (_, i) => p.cycleDuration * i / (count - 1));
times.push(p.releaseTime, p.releaseTime + 0.1, p.releaseTime + 0.2, p.releaseTime + 0.4, p.catchTime - 1e-5, p.catchTime, p.catchTime + 1e-5);
for (const [index, time] of times.entries()) {
  model.update(time); model.root.updateMatrixWorld(true);
  data.leafSpring = { mesh: parts.leafSpring, solid: solidSurface(parts.leafSpring.geometry), points: surfacePoints(parts.leafSpring.geometry) };
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
        record.inside += 1; record.firstWitness ??= { time, source: a.mesh.name, target: b.mesh.name, point: q.toArray(), depth };
        record.maximumDepth = Math.max(record.maximumDepth, depth);
      }
    }
  }
  if (index % 12 === 0) console.log(JSON.stringify({ pose: index, time, checks: pairs.reduce((sum, p) => sum + p.checks, 0), inside: pairs.reduce((sum, p) => sum + p.inside, 0) }));
}
const report = { movement: 64, status: 'unintegrated-candidate',
  method: 'Actual skins in both directions for independent moving families. The deforming leaf surface and samples are rebuilt at every pose. Dense worm-thread/wheel engagement is excluded for a separate sweep. Other worm, wheel, shaft, cam, follower, roller, fixed hardware and spring pairs are included. Exact triangle distances and solid topology require separate checks.',
  poses: times.length, times, pairs, checks: pairs.reduce((sum, p) => sum + p.checks, 0), inside: pairs.reduce((sum, p) => sum + p.inside, 0) };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/064-candidate-hardware.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ poses: times.length, pairs: pairs.length, checks: report.checks, inside: report.inside, issues: pairs.filter(v => v.inside) }));
if (report.inside) process.exitCode = 1;
