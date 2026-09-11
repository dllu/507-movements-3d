import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[58]), { blocks: b, geometry: p } = model.root.userData;
const gearTargets = [], pulleyTargets = [];
b.inputMembers.forEach((member, i) => member.userData.gear.traverse(mesh => {
  if (['ExtrudeGeometry', 'CylinderGeometry'].includes(mesh.geometry?.type)) gearTargets.push({ mesh, member: i, name: `input-${i}-${mesh.geometry.type}` });
}));
b.driver.traverse(mesh => { if (mesh.userData.role === 'stepped-pulley-tread') pulleyTargets.push({ mesh, name: `driver-tread-${pulleyTargets.length}` }); });
b.lowerPulleys.forEach((pulley, i) => pulley.traverse(mesh => {
  if (['ExtrudeGeometry', 'TorusGeometry'].includes(mesh.geometry?.type)) pulleyTargets.push({ mesh, name: `lower-${i}-${mesh.geometry.type}-${pulleyTargets.length}` });
}));
const cache = new Map(), surface = mesh => {
  if (cache.get(mesh.geometry)?.version !== mesh.geometry.attributes.position.version) cache.set(mesh.geometry,
    { version: mesh.geometry.attributes.position.version, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) });
  return cache.get(mesh.geometry);
};
const records = new Map();
const check = (name, from, to, time) => {
  const a = surface(from), target = surface(to), transform = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
  const record = records.get(name) ?? { name, checks: 0, inside: 0, maximumDepth: 0 }; records.set(name, record);
  if (!a.solid.box.clone().applyMatrix4(transform).intersectsBox(target.solid.box)) return;
  for (const point of a.points) {
    const q = point.clone().applyMatrix4(transform); record.checks += 1;
    if (!target.solid.inside(q)) continue;
    const depth = target.solid.distance(q); if (depth < 1e-6) continue;
    record.inside += 1;
    if (depth > record.maximumDepth) { record.maximumDepth = depth; record.witness = { time, localPoint: point.toArray() }; }
  }
};
model.update(0); model.root.updateMatrixWorld(true);
b.inputMembers.forEach((member, i) => {
  let index = 0;
  member.userData.shaft.traverse(mesh => {
    if (!mesh.geometry) return;
    for (const target of gearTargets) if (i !== target.member) check(`shaft-${i}-part-${index}-to-${target.name}`, mesh, target.mesh, 0);
    index += 1;
  });
});
const poses = Number(process.env.PROBE_POSES ?? 97);
for (let i = 0; i < poses; i += 1) {
  const time = p.cycleDuration * i / (poses - 1); model.update(time); model.root.updateMatrixWorld(true);
  for (const target of pulleyTargets) check(`band-to-${target.name}`, b.belt.userData.mesh, target.mesh, time);
}
const pairs = [...records.values()], report = { movement: 59, status: 'uncorrected-baseline',
  method: 'Scoped one-direction initial nested-shaft-to-other-gear-solid check, plus rendered round-band skins against every driver tread and lower pulley body/rim through 97 full selector-cycle poses. This is a defect baseline, not a complete hardware audit.',
  beltPoses: poses, pairs, checks: pairs.reduce((s, v) => s + v.checks, 0), inside: pairs.reduce((s, v) => s + v.inside, 0) };
await writeFile('artifacts/review/059-hardware-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checks: report.checks, inside: report.inside, issues: pairs.filter(v => v.inside) }, null, 2));
