import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[62]);
if (model.root.userData.mechanism !== 'three-pin-spring-drop-ten-point-star-counter') {
  throw new Error('This baseline probe requires the archived original 063 model.');
}
const { blocks: b, geometry: p } = model.root.userData;
const tagged = (group, tag) => {
  let result;
  group.traverse(mesh => { if (mesh.isMesh && mesh.userData[tag]) result = mesh; });
  if (!result) throw new Error(`Missing physical mesh ${tag}`);
  return result;
};
const drop = tagged(b.drop, 'springDropBody');
const pawl = tagged(b.pawl, 'pawlBody');
const star = tagged(b.star, 'starWheelBody');
const striker = b.drop.userData.strikerStud;
const pivotStud = b.drop.userData.pawlPivotStud;
const pivotShaft = b.dropPivotShaft.userData.rotor.children.find(mesh => mesh.isMesh);
const pins = b.driver.userData.pins;
const cache = new Map();
const surface = mesh => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, {
    solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry), tree: triangleTree(mesh.geometry),
  });
  return cache.get(mesh.geometry);
};
const penetration = (a, c) => {
  const from = surface(a), to = surface(c);
  const transform = c.matrixWorld.clone().invert().multiply(a.matrixWorld);
  const result = { checks: 0, inside: 0, maximumDepth: 0 };
  if (!from.solid.box.clone().applyMatrix4(transform).intersectsBox(to.solid.box)) return result;
  for (const localPoint of from.points) {
    const point = localPoint.clone().applyMatrix4(transform);
    result.checks += 1;
    if (!to.solid.inside(point)) continue;
    const depth = to.solid.distance(point);
    if (depth < 1e-6) continue;
    result.inside += 1;
    if (depth > result.maximumDepth) {
      result.maximumDepth = depth;
      result.witness = { fromLocal: localPoint.toArray(), toLocal: point.toArray() };
    }
  }
  return result;
};
const rows = [], stageSamples = [0.14, 0.43, 0.63, 0.71, 0.78, 0.91];
const phases = [...new Set([...Array.from({ length: 97 }, (_, i) => (i + 0.317) / 97), ...stageSamples])].sort((a, c) => a - c);
let maximumPinCenterError = 0;
for (let event = 0; event < 3; event += 1) for (const phase of phases) {
  const time = (event + phase) * p.eventPeriod;
  model.update(time); model.root.updateMatrixWorld(true);
  const state = model.root.userData.kinematics, pin = pins[state.activePinIndex];
  maximumPinCenterError = Math.max(maximumPinCenterError,
    pin.getWorldPosition(new THREE.Vector3()).distanceTo(state.activePinCenterPosition));
  const pairs = [
    ['active-pin/drop', pin, drop, state.pinContactsDrop],
    ['active-pin/pawl', pin, pawl, state.pinContactsPawl],
    ['striker/pawl', striker, pawl, state.stage === 'power-snap'],
    ['pawl/star', pawl, star, state.pawlInStarGap],
    ['drop/pawl', drop, pawl, null],
    ['fixed-pivot/drop', pivotShaft, drop, null],
    ['pawl-pivot/pawl', pivotStud, pawl, null],
  ];
  for (const [name, a, c, claimedContact] of pairs) {
    const transform = c.matrixWorld.clone().invert().multiply(a.matrixWorld);
    const exact = meshPairDistance(surface(a).tree, surface(c).tree, transform, 3);
    rows.push({ name, event, phase, time, stage: state.stage, claimedContact,
      distance: exact.distance, witness: exact.witness,
      forward: penetration(a, c), reverse: penetration(c, a) });
  }
}
const summary = [...new Set(rows.map(row => row.name))].map(name => {
  const selected = rows.filter(row => row.name === name), claimed = selected.filter(row => row.claimedContact);
  return { name, poses: selected.length, claimedContactPoses: claimed.length,
    minimumGap: Math.min(...selected.map(row => row.distance)), maximumGap: Math.max(...selected.map(row => row.distance)),
    claimedMinimumGap: claimed.length ? Math.min(...claimed.map(row => row.distance)) : null,
    claimedMaximumGap: claimed.length ? Math.max(...claimed.map(row => row.distance)) : null,
    intersectingPoses: selected.filter(row => row.distance < 1e-9).length,
    checks: selected.reduce((sum, row) => sum + row.forward.checks + row.reverse.checks, 0),
    inside: selected.reduce((sum, row) => sum + row.forward.inside + row.reverse.inside, 0),
    maximumDepth: Math.max(...selected.flatMap(row => [row.forward.maximumDepth, row.reverse.maximumDepth])),
  };
});
const report = { movement: 63, status: 'uncorrected-baseline',
  method: 'Actual Float32 triangle distances, including segment/face crossings, and bidirectional surface containment. Seven selected working and pivot pairs at 103 phases in each of three consecutive pin events. Stage contact flags only label expectations; they do not enter any distance calculation. The active pin is checked against its actual world center. This is a scoped defect probe, not a complete all-hardware audit. A null witness at the maximum search distance of 3 is a lower bound.',
  poses: phases.length * 3, maximumPinCenterError, summary, rows };
await writeFile('artifacts/review/063-contact-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ poses: report.poses, maximumPinCenterError, summary }, null, 2));
