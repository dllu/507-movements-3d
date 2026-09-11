import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = process.env.COAXIAL_CANDIDATE
  ? (await import('../artifacts/review/055-candidate-model.mjs')).makeCoaxialCandidate()
  : createMovementModel(catalog.movements[54]);
const b = model.root.userData.blocks;
const pinion = b.pinionB.userData.rotor.children.find(v => v.geometry?.type === 'ExtrudeGeometry');
const gearA = b.gearA.userData.rotor.children.find(v => v.geometry?.type === 'ExtrudeGeometry');
const ringTeeth = b.gearC.userData.rotor.children.filter(v => process.env.COAXIAL_CANDIDATE
  ? v.geometry?.type === 'ExtrudeGeometry' : v.userData.internalGearTooth);
if (!pinion || !gearA || !ringTeeth.length) throw new Error('Missing original gear skins');
const cache = new Map(), surface = mesh => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, { solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) });
  return cache.get(mesh.geometry);
};
const period = 2 * Math.PI / (model.root.userData.geometry.pinionTeeth * model.root.userData.kinematics.pinionAngularSpeed);
const report = { movement: 55, status: process.env.COAXIAL_CANDIDATE ? 'unvalidated-candidate' : 'uncorrected-baseline', method: 'Actual closed tooth skins in both directions through one pinion tooth engagement; ring supports and hubs are checked separately.',
  poses: Number(process.env.PROBE_POSES ?? 129), surfaceChecks: 0, pairs: {} };
for (let i = 0; i < report.poses; i += 1) {
  const time = period * (i + 0.317) / report.poses; model.update(time); model.root.updateMatrixWorld(true);
  for (const [name, targetTeeth] of [['external-A', [gearA]], ['internal-C', ringTeeth]]) {
    const record = report.pairs[name] ??= { checks: 0, inside: 0, maximumDepth: 0, maximumNearestGap: 0, witness: null };
    let nearest = 0.02;
    for (const target of targetTeeth) for (const [from, to] of [[pinion, target], [target, pinion]]) {
      const a = surface(from), other = surface(to), transform = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      if (!a.solid.box.clone().applyMatrix4(transform).expandByScalar(0.02).intersectsBox(other.solid.box)) continue;
      for (const point of a.points) {
        const q = point.clone().applyMatrix4(transform); report.surfaceChecks += 1; record.checks += 1;
        if (!other.solid.inside(q)) { nearest = Math.min(nearest, other.solid.distance(q, nearest)); continue; }
        const depth = other.solid.distance(q); if (depth < 1e-6) continue;
        record.inside += 1;
        if (depth > record.maximumDepth) { record.maximumDepth = depth; record.witness = { time, direction: from === pinion ? 'pinion-to-wheel' : 'wheel-to-pinion', localPoint: point.toArray() }; }
      }
    }
    record.maximumNearestGap = Math.max(record.maximumNearestGap, nearest);
  }
  if (i % 16 === 0) console.log(JSON.stringify({ pose: i, poses: report.poses, checks: report.surfaceChecks,
    inside: Object.fromEntries(Object.entries(report.pairs).map(([name, value]) => [name, value.inside])) }));
}
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/055-tooth-contact-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
