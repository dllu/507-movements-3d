import { readFile, writeFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[72]);
const { blocks: b, geometry: p, stateAtTime } = model.root.userData;
const closed = ['ratchetBody', 'catchPad', 'stopPad', 'driverBody'];
const data = Object.fromEntries(closed.map(name => [name, { mesh: b[name],
  solid: solidSurface(b[name].geometry), points: surfacePoints(b[name].geometry), tree: triangleTree(b[name].geometry) }]));
const springMeshes = { catchSpring: b.catchSpring.userData.mesh, strongSpring: b.strongSpring.userData.mesh };
const pairs = closed.flatMap((a, i) => closed.slice(i + 1).map(b => ({ a, b, bothDirections: true })));
for (const [a, targets] of [['catchSpring', ['ratchetBody', 'stopPad', 'driverBody']],
  ['strongSpring', ['ratchetBody', 'catchPad', 'driverBody']]]) {
  for (const b of targets) pairs.push({ a, b, bothDirections: false });
}
for (const pair of pairs) Object.assign(pair, { checks: 0, inside: 0, maximumDepth: 0 });
const phaseTime = phase => (phase - p.initialCyclePhase) * p.driverCyclePeriod;
const times = Array.from({ length: 97 }, (_, i) => phaseTime((i + .319) / 97));
for (let i = 0; i <= 64; i++) times.push(phaseTime(p.pressStartPhase + (p.releaseEndPhase - p.pressStartPhase) * i / 64));
for (const phase of [p.pressStartPhase, p.indexStartPhase, p.indexEndPhase, p.releaseEndPhase])
  for (const delta of [-1e-5, 0, 1e-5]) times.push(phaseTime(phase) + delta);
const springDistances = [], pressDirections = [], catchForces = [], stageChanges = [];
for (const [index, time] of times.entries()) {
  model.update(time); model.root.updateMatrixWorld(true);
  const state = model.root.userData.kinematics ?? stateAtTime(time);
  for (const [name, mesh] of Object.entries(springMeshes)) data[name] = { mesh, points: surfacePoints(mesh.geometry) };
  for (const pair of pairs) {
    const directions = [[data[pair.a], data[pair.b], pair.a]];
    if (pair.bothDirections) directions.push([data[pair.b], data[pair.a], pair.b]);
    for (const [from, to, source] of directions) {
      const matrix = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
      for (const sample of from.points) {
        pair.checks++;
        const point = sample.clone().applyMatrix4(matrix);
        if (!to.solid.inside(point)) continue;
        const depth = to.solid.distance(point); if (depth <= 1e-6) continue;
        pair.inside++; pair.maximumDepth = Math.max(pair.maximumDepth, depth);
        pair.firstWitness ??= { time, phase: state.cyclePhase, stage: state.stage, source, point: point.toArray(), depth };
      }
    }
  }
  if (state.indexing) {
    const first = state.springCrossing.firstPoint, second = state.springCrossing.secondPoint;
    const normalOnCatch = first.clone().sub(second).normalize();
    const inward = new Vector3(-first.x, -first.y, 0).normalize();
    const rotatingVelocity = new Vector3(-first.y, first.x, 0).multiplyScalar(state.driverActualAngularSpeed);
    pressDirections.push({ time, phase: state.cyclePhase, declaredCenterDistance: state.springCrossing.distance,
      actualCenterDistance: first.distanceTo(second), normalOnCatch: normalOnCatch.toArray(),
      inwardComponent: normalOnCatch.dot(inward), motorWorkPerUnitReaction: normalOnCatch.dot(rotatingVelocity),
      catchDeflection: state.catchSpringDeflection });
    const point = state.catchRatchetPoint, normal = state.catchContactNormal;
    const outputMoment = -(point.x * normal.y - point.y * normal.x);
    catchForces.push({ time, phase: state.cyclePhase, outputMoment, powerPerUnitReaction: outputMoment * state.drivenAngularSpeed });
  }
  if (index >= times.length - 12 || index % 16 === 0) {
    const a = data.catchSpring, other = data.strongSpring;
    const distance = meshPairDistance(triangleTree(a.mesh.geometry), triangleTree(other.mesh.geometry),
      other.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld), .2);
    springDistances.push({ time, phase: state.cyclePhase, stage: state.stage,
      claimedPressEngaged: state.strongSpringPressEngaged, claimedClearance: state.springPressClearance,
      ...distance, censoredAtMaximum: distance.witness === null });
  }
}
for (const phase of [p.pressStartPhase, p.indexStartPhase, p.indexEndPhase, p.releaseEndPhase]) {
  const epsilon = 1e-7, before = stateAtTime(phaseTime(phase) - epsilon), after = stateAtTime(phaseTime(phase) + epsilon);
  stageChanges.push({ phase, epsilon, driverAngleDifference: after.driverAngle - before.driverAngle,
    drivenAngleDifference: after.drivenAngle - before.drivenAngle,
    stopCenterDifference: after.stopContact.center.distanceTo(before.stopContact.center),
    catchCenterDifference: after.catchCenter.distanceTo(before.catchCenter) });
}
const report = {
  movement: 73, status: 'baseline-diagnosis', productionChanged: false, poses: times.length, pairs,
  checks: pairs.reduce((sum, pair) => sum + pair.checks, 0), inside: pairs.reduce((sum, pair) => sum + pair.inside, 0),
  geometry: p, timing: model.root.userData.animationTiming, springDistances, pressDirections, catchForces, stageChanges,
  method: 'Actual Float32 vertices, edge midpoints and face centers. All six closed working-solid pairs are checked in both directions. Each changing spring surface is sampled against the ratchet, opposite pad and driver. The tube springs have open ends, so they are not used as inside/outside targets. Selected exact triangle-pair distances check the spring skins. Penetration tolerance is 1e-6. Remaining support hardware and elastic equilibrium are not certified.',
  forceQualification: 'At the declared spring crossing, the normal of ideal circular tubes is their centerline separation. Its inward component tests whether frictionless spring C can supply the prescribed in-plane deflection of B. This is a diagnostic of the current planar model, not a proof against every possible frictional or spatial spring implementation.',
};
await writeFile('artifacts/review/073-working-surface-baseline.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ poses: report.poses, pairs: pairs.length, checks: report.checks, inside: report.inside,
  failures: pairs.filter(pair => pair.inside), pressCases: pressDirections.length,
  maximumInwardPressComponent: Math.max(...pressDirections.map(row => Math.abs(row.inwardComponent))),
  springDistances: springDistances.length, stageChanges });
