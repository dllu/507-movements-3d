import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[74]), { blocks: b, geometry: p } = model.root.userData;
model.root.updateMatrixWorld(true);
const groups = {}, excludedZeroArea = [];
for (const name of ['ratchetBody', 'pawlCatch', 'pawlNose', 'barBody', 'barHub', 'rodJointPin', 'rodPinSlot', 'rod', 'rodGuides', 'ratchetShaft']) {
  groups[name] = [];
  for (const object of Array.isArray(b[name]) ? b[name] : [b[name]]) object.traverse(mesh => {
    if (!mesh.geometry) return;
    const scale = mesh.getWorldScale(new THREE.Vector3()), geometry = mesh.geometry.clone().scale(...scale.toArray());
    const positions = geometry.attributes.position, index = geometry.index, indices = [];
    let removed = 0;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
      const [a, c, d] = ids.map(j => new THREE.Vector3().fromBufferAttribute(positions, j));
      if (c.sub(a).cross(d.sub(a)).lengthSq() <= 1e-22) removed++;
      else indices.push(...ids);
    }
    geometry.setIndex(indices);
    const label = name + ':' + groups[name].length;
    excludedZeroArea.push({ label, removed });
    groups[name].push({ mesh, label, scale, solid: solidSurface(geometry), points: surfacePoints(geometry) });
  });
}
const pairs = [
  ['ratchetBody', 'pawlCatch'], ['ratchetBody', 'pawlNose'], ['ratchetBody', 'barBody'],
  ['ratchetBody', 'rodJointPin'], ['ratchetBody', 'rod'], ['ratchetBody', 'ratchetShaft'],
  ['barBody', 'rodJointPin'], ['rodPinSlot', 'rodJointPin'], ['barBody', 'ratchetShaft'],
  ['barHub', 'ratchetShaft'], ['rod', 'rodGuides'],
].map(([a, c]) => ({ a, b: c, sameRigidFamily: a === 'ratchetBody' && c === 'ratchetShaft',
  checks: 0, inside: 0, maximumDepth: 0 }));
const phases = [...Array.from({ length: 97 }, (_, i) => (i + .217) / 97), 0, .25, .5, .75, 1];
const forces = [], jointReadings = [];
for (const phase of phases) {
  const time = (phase - p.initialCyclePhase) / p.cyclesPerSecond;
  model.update(time); model.root.updateMatrixWorld(true);
  const state = model.root.userData.kinematics;
  for (const parts of Object.values(groups)) for (const part of parts) {
    const scale = part.mesh.getWorldScale(new THREE.Vector3());
    if (scale.distanceTo(part.scale) > 1e-10) throw new Error('Unexpected changing scale');
    part.matrix = part.mesh.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(1 / scale.x, 1 / scale.y, 1 / scale.z));
  }
  for (const pair of pairs) for (const first of groups[pair.a]) for (const second of groups[pair.b]) {
    for (const [a, c] of [[first, second], [second, first]]) {
      const matrix = c.matrix.clone().invert().multiply(a.matrix);
      if (!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(c.solid.box)) continue;
      for (const sample of a.points) {
        pair.checks++;
        const point = sample.clone().applyMatrix4(matrix);
        if (!c.solid.inside(point)) continue;
        const depth = c.solid.distance(point);
        if (!Number.isFinite(depth)) throw new Error('Nonfinite boundary distance');
        if (depth <= 1e-6) continue;
        pair.inside++;
        if (depth > pair.maximumDepth) {
          pair.maximumDepth = depth;
          pair.witness = { phase, from: a.label, to: c.label, point: point.toArray(), depth };
        }
      }
    }
  }
  if (state.indexing) {
    const r = state.catchContactPoint, n = state.contactNormal;
    const moment = -r.x * n.y + r.y * n.x;
    forces.push({ phase, wheelMomentPerReaction: moment, clockwisePowerPerReaction: moment * state.drivenAngularSpeed });
  }
  jointReadings.push({ phase, position: state.rodJoint.toArray(), slotRadius: state.slotRadius,
    claimedCenterlineError: state.rodSlotConstraintError, returnToothGap: state.catchProfileClearance });
}
const report = { movement: 75, status: 'baseline-diagnosis', productionChanged: false,
  poses: phases.length, pairs, checks: pairs.reduce((s, r) => s + r.checks, 0), inside: pairs.reduce((s, r) => s + r.inside, 0),
  independentChecks: pairs.filter(r => !r.sameRigidFamily).reduce((s, r) => s + r.checks, 0),
  independentInside: pairs.filter(r => !r.sameRigidFamily).reduce((s, r) => s + r.inside, 0),
  forces, jointReadings, excludedZeroArea, parameters: p,
  qualification: 'Float32 vertices, edge midpoints and triangle centers on the selected working solids, finite pins, bar, axle and rod guides. Mesh scale is baked into query geometry so penetration depths are in world units. Only zero-area triangles are omitted. Eleven selected pairs are checked in both directions across a complete cycle. Counts diagnose the baseline; the counterweight arm, full support frame and dynamic equilibrium are not certified. Source fidelity and the missing separate holding pawl are independent findings.' };
await writeFile('artifacts/review/075-working-surface-baseline.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log({ poses: phases.length, checks: report.checks, inside: report.inside,
  failures: pairs.filter(r => r.inside), forcePoses: forces.length,
  minimumDrivingPower: Math.min(...forces.map(r => r.clockwisePowerPerReaction)) });
