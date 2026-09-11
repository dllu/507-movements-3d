import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[59]), { blocks: b, geometry: p } = model.root.userData;
const pulleys = [];
for (const [name, group] of [['large-driver', b.largeDriver], ['small-driver', b.smallDriver]]) {
  let index = 0;
  group.traverse(mesh => { if (mesh.userData.role === 'stepped-pulley-tread') pulleys.push({ mesh, name: `${name}-${index++}` }); });
}
b.lowerPulleys.forEach((group, i) => group.traverse(mesh => {
  if (['ExtrudeGeometry', 'TorusGeometry'].includes(mesh.geometry?.type)) pulleys.push({ mesh, name: `lower-${i}-${mesh.geometry.type}-${pulleys.length}` });
}));
const cache = new Map(), surface = mesh => {
  if (cache.get(mesh.geometry)?.version !== mesh.geometry.attributes.position.version) cache.set(mesh.geometry,
    { version: mesh.geometry.attributes.position.version, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) });
  return cache.get(mesh.geometry);
};
const records = new Map();
const check = (name, from, to, time) => {
  const a = surface(from), target = surface(to), transform = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
  const row = records.get(name) ?? { name, checks: 0, inside: 0, maximumDepth: 0, boxSeparatedPoses: 0 }; records.set(name, row);
  if (!a.solid.box.clone().applyMatrix4(transform).intersectsBox(target.solid.box)) { row.boxSeparatedPoses += 1; return; }
  for (const point of a.points) {
    const q = point.clone().applyMatrix4(transform); row.checks += 1;
    if (!target.solid.inside(q)) continue;
    const depth = target.solid.distance(q); if (depth < 1e-6) continue;
    row.inside += 1;
    if (depth > row.maximumDepth) { row.maximumDepth = depth; row.witness = { time, localPoint: point.toArray() }; }
  }
};
const poses = 97;
for (let i = 0; i < poses; i += 1) {
  const time = p.cycleDuration * i / (poses - 1); model.update(time); model.root.updateMatrixWorld(true);
  for (const [name, band] of [['left-band', b.leftBelt], ['right-band', b.rightBelt]]) {
    for (const pulley of pulleys) check(`${name}-to-${pulley.name}`, band.userData.mesh, pulley.mesh, time);
  }
}
const pairs = [...records.values()], report = { movement: 60, status: 'uncorrected-baseline',
  method: 'Scoped one-direction test of both actual round-band skins against all driver treads and lower pulley bodies/rims over 97 full demonstration poses. Position-version changes refresh deformed belt surfaces. Decorative markers, shafts and supports are outside this defect baseline.',
  poses, pairs, checks: pairs.reduce((sum, row) => sum + row.checks, 0), inside: pairs.reduce((sum, row) => sum + row.inside, 0) };
await writeFile('artifacts/review/060-hardware-baseline.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('artifacts/review/060-baseline-parameters.json', JSON.stringify({ geometry: p, timing: model.root.userData.animationTiming,
  camera: model.cameraDirection.toArray(), belts: [b.leftBelt, b.rightBelt].map(band => ({ crossSection: band.userData.crossSection, thickness: band.userData.thickness, width: band.userData.width })) }, null, 2) + '\n');
console.log(JSON.stringify({ poses, checks: report.checks, inside: report.inside, issues: pairs.filter(row => row.inside) }, null, 2));
