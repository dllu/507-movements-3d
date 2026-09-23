import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GRAHAM_303_ANCHOR } from '../src/simulation/baked/graham-303-anchor.js';
import { createMovementModel } from '../src/simulation/registry.js';
import { densePoints } from './helpers/dense-points.mjs';
import { solidSurface } from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const create = () => createMovementModel(catalog.movements[302]);

function closedMeshes(group) {
  const meshes = [];
  group.traverse((object) => {
    if (!object.isMesh || object.geometry.type === 'TubeGeometry') return;
    for (let node = object; node; node = node.parent) if (!node.visible) return;
    meshes.push({ mesh: object, points: densePoints(object.geometry, 0.03), field: solidSurface(object.geometry) });
  });
  return meshes;
}
function deepest(source, target) {
  const relative = target.mesh.matrixWorld.clone().invert().multiply(source.mesh.matrixWorld), q = new THREE.Vector3();
  let depth = 0;
  for (const p of source.points) {
    q.copy(p).applyMatrix4(relative);
    if (target.field.box.containsPoint(q) && target.field.inside(q)) depth = Math.max(depth, target.field.distance(q));
  }
  return depth;
}

test('303 baked anchor matches the production escapement geometry', () => {
  const g = create().root.userData.geometry;
  for (const [key, value] of Object.entries(GRAHAM_303_ANCHOR.geometryFingerprint)) {
    if (key === 'anchorPivot') assert.deepEqual(value, [g.anchorPivot.x, g.anchorPivot.y]);
    else assert.equal(value, g[key], `${key}: regenerate with scripts/generate-graham-303-anchor.mjs`);
  }
});

test('303 wheel, anchor/pendulum and fixed frame are clear through the cycle', () => {
  const model = create(), b = model.root.userData.blocks;
  const groups = [closedMeshes(b.wheelRotor), closedMeshes(b.anchor), closedMeshes(b.fixedFrame)];
  let worst = { depth: 0 };
  for (let i = 0; i <= 96; i += 1) {
    const time = 4 * i / 96;
    model.update(time); model.root.updateMatrixWorld(true);
    for (let x = 0; x < 3; x += 1) for (let y = x + 1; y < 3; y += 1) for (const a of groups[x]) for (const c of groups[y]) {
      const depth = Math.max(deepest(a, c), deepest(c, a));
      if (depth > worst.depth) worst = { depth, time, pair: `${a.mesh.userData.role} x ${c.mesh.userData.role}` };
    }
  }
  assert.equal(worst.depth, 0, `${worst.pair} penetrates ${worst.depth} at ${worst.time}`);
});

test('303 active tooth tip stays just outside its lock or impulse face', () => {
  const model = create(), d = model.root.userData, b = d.blocks;
  const fields = b.anchorArms.map((arm) => solidSurface(arm.geometry));
  const gaps = { lock: [Infinity, 0], impulse: [Infinity, 0] };
  const tipIn = (state, extraAngle = 0) => {
    const index = state.activeSide > 0 ? 0 : 1;
    b.anchor.rotation.z = state.anchorAngle + extraAngle; b.anchor.updateMatrixWorld(true);
    const p = new THREE.Vector3(state.activeToothPoint.x, state.activeToothPoint.y, 0.1)
      .applyMatrix4(b.anchorArms[index].matrixWorld.clone().invert());
    return { inside: fields[index].inside(p), distance: fields[index].distance(p) };
  };
  for (let i = 0; i <= 2000; i += 1) {
    const time = 4 * i / 2000, state = d.stateAtTime(time);
    model.update(time); model.root.updateMatrixWorld(true);
    if (!state.contactActive) continue;
    const { inside, distance } = tipIn(state);
    assert.equal(inside, false, `tip inside face at ${time}`);
    const range = gaps[state.lockActive ? 'lock' : 'impulse'];
    range[0] = Math.min(range[0], distance); range[1] = Math.max(range[1], distance);
  }
  for (const [mode, [min, max]] of Object.entries(gaps)) {
    assert.ok(min > 0.005 && max < 0.035, `${mode} working gap ${min}..${max}`);
  }
  // Negative control: the concentric dead faces ignore anchor rotation, but
  // advancing a locked wheel two degrees clockwise must drive its tip into the
  // face, so the measured gap is working proximity rather than a loose cut.
  for (const key of ['leftMaximumLock', 'rightMaximumLock']) {
    const lock = d.stateAtTime(d.canonicalTimes[key]);
    model.update(d.canonicalTimes[key]); model.root.updateMatrixWorld(true);
    const advanced = { ...lock, activeToothPoint: lock.activeToothPoint.clone()
      .rotateAround(new THREE.Vector2(), d.geometry.direction * THREE.MathUtils.degToRad(2)) };
    assert.equal(tipIn(lock).inside, false);
    assert.equal(tipIn(advanced).inside, true, `${key}: advanced tip enters the lock face`);
  }
});
