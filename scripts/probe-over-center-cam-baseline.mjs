import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[63]);
if (model.root.userData.mechanism !== 'worm-wheel-half-cut-hollow-shaft-over-center-jump-cam') {
  throw new Error('This diagnostic requires the archived original 064 model.');
}
const { blocks: b, geometry: p } = model.root.userData;
const find = (group, predicate) => {
  let result;
  group.traverse(mesh => { if (mesh.isMesh && predicate(mesh)) result = mesh; });
  if (!result) throw new Error('Missing baseline mesh');
  return result;
};
const cam = find(b.cam, mesh => mesh.userData.overCenterCamBody);
const roller = find(b.roller, mesh => mesh.userData.role === 'open-pulley-rim');
const wheel = find(b.wheel, mesh => mesh.geometry.type === 'ExtrudeGeometry');
const worm = find(b.worm, mesh => mesh.userData.screwThread);
const solidShaft = find(b.wheelShaft, () => true);
const follower = find(b.follower, mesh => mesh.userData.followerLever);
const followerShaft = find(b.followerPivotShaft, () => true);
const pairs = [
  ['cam/roller-rim', cam, roller, state => true],
  ['shaft-pin/half-cut-collar', b.shaftPin, b.cam.userData.halfCutCollar, state => state.pinEngaged],
  ['cam/solid-shaft', cam, solidShaft, () => false],
  ['sleeve/worm-wheel', b.cam.userData.hollowSleeve, wheel, () => false],
  ['worm-thread/wheel', worm, wheel, () => true],
  ['follower/fixed-pivot', follower, followerShaft, () => false],
];
const cache = new Map();
const surface = mesh => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, {
    solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry), tree: triangleTree(mesh.geometry),
  });
  return cache.get(mesh.geometry);
};
const penetration = (a, c) => {
  const from = surface(a), to = surface(c), transform = c.matrixWorld.clone().invert().multiply(a.matrixWorld);
  const result = { checks: 0, inside: 0, maximumDepth: 0 };
  if (c.geometry.type === 'TubeGeometry') return { ...result, skipped: 'Open tube is not a valid containment target; its actual triangle distance is still checked.' };
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
const phases = [...new Set([...Array.from({ length: 97 }, (_, i) => (i + 0.317) / 97),
  0, 0.001, 0.03, 0.06, 0.2, 0.49, 0.5, 0.75, 0.96])].sort((a, c) => a - c);
const rows = [];
for (const phase of phases) {
  const time = ((1 + phase) * p.fullTurn - p.initialCycleAngle) / p.wheelAngularSpeed;
  model.update(time); model.root.updateMatrixWorld(true);
  const state = model.root.userData.kinematics;
  for (const [name, a, c, expected] of pairs) {
    const transform = c.matrixWorld.clone().invert().multiply(a.matrixWorld);
    const exact = meshPairDistance(surface(a).tree, surface(c).tree, transform, 3);
    rows.push({ name, phase, time, stage: state.stage, claimedContact: expected(state),
      claimedFollowerContactError: state.followerContactError,
      distance: exact.distance, witness: exact.witness, forward: penetration(a, c), reverse: penetration(c, a) });
  }
}
const summary = pairs.map(([name]) => {
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
const report = { movement: 64, status: 'uncorrected-baseline', poses: phases.length,
  method: 'Actual Float32 triangle distances and containment at 106 phases across one worm-wheel turn, including snap and catch boundaries. Six selected pairs; the worm check covers its open helical tube as a source only, and the roller check covers its closed rim. Open tubes are excluded as containment targets. This is not an all-hardware or closed-solid certification. Claimed contact flags and radial follower errors do not enter the distance calculation. A zero process exit means the diagnostic completed, not that the model passed.',
  summary, rows };
await writeFile('artifacts/review/064-contact-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ poses: report.poses, summary }, null, 2));
