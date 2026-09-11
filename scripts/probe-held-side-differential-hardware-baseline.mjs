import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints, surfaceTriangles } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[60]), { blocks: b, geometry: p } = model.root.userData;
const pulleys = [];
b.driver.traverse(mesh => { if (mesh.userData.role === 'stepped-pulley-tread') pulleys.push({ mesh, name: `driver-${pulleys.length}` }); });
[b.neutralPulley, b.directPulley, b.doublePulley].forEach((group, i) => group.traverse(mesh => {
  if (['ExtrudeGeometry', 'TorusGeometry'].includes(mesh.geometry?.type)) pulleys.push({ mesh, name: `lower-${i}-${mesh.geometry.type}-${pulleys.length}` });
}));
let zeroAreaFacesExcluded = 0;
const cache = new Map(), surface = mesh => {
  if (cache.get(mesh.geometry)?.version !== mesh.geometry.attributes.position.version) {
    const faces = surfaceTriangles(mesh.geometry), usable = faces.filter(face => face.getArea() > 1e-20);
    zeroAreaFacesExcluded += faces.length - usable.length;
    const geometry = usable.length === faces.length ? mesh.geometry
      : new THREE.BufferGeometry().setFromPoints(usable.flatMap(({ a, b, c }) => [a, b, c]));
    cache.set(mesh.geometry, { version: mesh.geometry.attributes.position.version,
      solid: solidSurface(geometry), points: surfacePoints(geometry) });
  }
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
const shaft = b.outputShaft.userData.rotor.children.find(mesh => mesh.isMesh);
const axle = b.planetAxle.userData.rotor.children.find(mesh => mesh.isMesh);
const arm = b.carrierArm.children.find(mesh => mesh.geometry?.type === 'BoxGeometry');
const independent = [['carrier-sleeve-to-output-gear-body', b.carrierSleeve, b.outputSideGear.userData.body],
  ['carrier-sleeve-to-output-gear-hub', b.carrierSleeve, b.outputSideGear.userData.hub],
  ['output-shaft-to-brake-drum', shaft, b.brakeDrum],
  ['brake-drum-to-output-shaft', b.brakeDrum, shaft],
  ['carrier-arm-to-output-shaft', arm, shaft],
  ['output-shaft-to-carrier-arm', shaft, arm],
  ['planet-axle-to-output-shaft', axle, shaft], ['output-shaft-to-planet-axle', shaft, axle]];
const poses = 97;
for (let i = 0; i < poses; i += 1) {
  const time = p.cycleDuration * i / (poses - 1); model.update(time); model.root.updateMatrixWorld(true);
  for (const pulley of pulleys) check(`band-to-${pulley.name}`, b.belt.userData.mesh, pulley.mesh, time);
  for (const [name, from, to] of independent) check(name, from, to, time);
}
const pairs = [...records.values()], report = { movement: 61, status: 'uncorrected-baseline',
  method: 'Scoped actual round-band skin against all upper treads/lower pulley bodies and rims over 97 full demonstration poses; selected independent shaft/sleeve/arm/drum pairs also sampled. Dynamic position-version changes refresh cached surfaces. Zero-area collapsed faces are excluded. This does not cover all hardware or marker solids.',
  poses, zeroAreaFacesExcluded, pairs, checks: pairs.reduce((sum, row) => sum + row.checks, 0), inside: pairs.reduce((sum, row) => sum + row.inside, 0) };
await writeFile('artifacts/review/061-hardware-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ poses, checks: report.checks, inside: report.inside, issues: pairs.filter(row => row.inside) }, null, 2));
