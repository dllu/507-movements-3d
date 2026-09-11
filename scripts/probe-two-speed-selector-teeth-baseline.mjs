import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[58]), { blocks: b, geometry: p } = model.root.userData;
const toothSkin = gear => { let result; gear.traverse(v => { if (v.geometry?.type === 'ExtrudeGeometry') result = v; }); if (!result) throw new Error('Missing original tooth skin'); return result; };
const pairs = b.gearPairs.map(pair => [toothSkin(pair.inputGear), toothSkin(pair.outputGear)]);
const data = pairs.map(pair => pair.map(mesh => ({ mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) })));
const count = Number(process.env.PROBE_POSES ?? 129), records = [];
for (const [index, pair] of data.entries()) {
  const record = { index, inputTeeth: p.inputTeeth[index], outputTeeth: p.outputTeeth[index], poses: count, checks: 0, inside: 0, maximumDepth: 0 };
  for (let i = 0; i < count; i += 1) {
    // During the first driven dwell, choose times covering one output-tooth
    // advance of this pair. The other input members turn through back-drive.
    const progress = p.outputTeeth[0] / (p.inputTeeth[0] * p.outputTeeth[index]) * (i + 0.317) / count;
    let lo = 0, hi = 1;
    for (let j = 0; j < 50; j += 1) { const u = (lo + hi) / 2; if (u * u * (3 - 2 * u) < progress) lo = u; else hi = u; }
    const time = p.stageDuration + p.dwellDuration * (lo + hi) / 2;
    model.update(time); model.root.updateMatrixWorld(true);
    for (const [a, target] of [[pair[0], pair[1]], [pair[1], pair[0]]]) {
      const transform = target.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const point of a.points) {
        const q = point.clone().applyMatrix4(transform); record.checks += 1;
        if (!target.solid.inside(q)) continue;
        const depth = target.solid.distance(q); if (depth < 1e-6) continue;
        record.inside += 1;
        if (depth > record.maximumDepth) { record.maximumDepth = depth; record.witness = { time, direction: a === pair[0] ? 'input-to-output' : 'output-to-input', localPoint: point.toArray() }; }
      }
    }
  }
  records.push(record); console.log(JSON.stringify(record));
}
const report = { movement: 59, status: 'uncorrected-baseline', method: 'Actual closed rendered tooth skins in both directions; 129 phases per pair spanning one relative tooth engagement. Hubs, nested shafts and belts are separate checks.', pairs: records,
  checks: records.reduce((sum, v) => sum + v.checks, 0), inside: records.reduce((sum, v) => sum + v.inside, 0) };
await writeFile('artifacts/review/059-tooth-contact-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checks: report.checks, inside: report.inside }));
