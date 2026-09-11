import { writeFile } from 'node:fs/promises';
import { makeBandEpicyclicGearCandidate } from '../artifacts/review/057-candidate-gears.mjs';
import { gearBoundary, boundaryIndex, planarPairDistance } from './lib/coaxial-planar-distance.mjs';
const model = makeBandEpicyclicGearCandidate(), { parts, geometry: p } = model.root.userData;
const points = gearBoundary(parts.planet), targets = Object.fromEntries(['sun', 'ring'].map(name => [name, boundaryIndex(gearBoundary(parts[name]))]));
const report = { configuration: p, poses: [] }, count = Number(process.env.PROBE_POSES ?? 257);
for (let i = 0; i < count; i += 1) {
  const time = p.relativeToothPeriod * (i + 0.317) / count; model.update(time); model.root.updateMatrixWorld(true);
  for (const name of ['sun', 'ring']) {
    const transform = parts[name].matrixWorld.clone().invert().multiply(parts.planet.matrixWorld);
    const result = planarPairDistance(points, targets[name], transform, 0.02);
    report.poses.push({ time, target: name, ...result });
  }
}
report.summary = Object.fromEntries(['sun', 'ring'].map(name => {
  const rows = report.poses.filter(v => v.target === name);
  return [name, { poses: rows.length, minimumGap: Math.min(...rows.map(v => v.distance)), maximumGap: Math.max(...rows.map(v => v.distance)),
    intersections: rows.reduce((sum, v) => sum + v.intersections, 0) }];
}));
await writeFile('artifacts/review/057-candidate-gear-contact.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ geometry: p, summary: report.summary }, null, 2));
