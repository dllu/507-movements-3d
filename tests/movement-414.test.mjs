import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: expected ${b}, received ${a}`);

test('414 scroll A is Brown\'s close-wound band: 2 3/8 touching turns, inner end at 9 o\'clock', () => {
  const model = createMovementModel(catalog.movements[413]);
  const g = model.root.userData.geometry;
  near(g.turns, 2.375, 0, 'turns');
  near(g.spiralLeadPerRadian * 2 * Math.PI, g.bandWidth, 1e-12, 'lead per turn equals the band width (turns touch)');
  near(g.innerEndAngle, Math.PI, 0, 'inner end at 9 o\'clock');
  near(((g.outerEndAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 1.75 * Math.PI, 1e-12, 'outer end at half past four');
  // Brown's band is about 25 px of a 132 px outer radius; the face teeth span one band.
  const outer = g.innerEdgeStart + g.bandWidth * (g.turns + 1);
  near(g.bandWidth / outer, 25 / 132, 0.01, 'band width to outer radius');
  assert.ok(g.scrollToothCount > 100 && g.scrollToothCount < 140, `${g.scrollToothCount} face teeth`);
});

test('414 pinion B tapers with its small end toward A\'s centre and its large end outward', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { blocks, geometry: g } = model.root.userData;
  model.update(0);
  model.root.updateMatrixWorld(true);
  const pos = blocks.pinionBody.geometry.attributes.position, v = new THREE.Vector3();
  let upper = 0, lower = 0;
  const center = blocks.slidingPinion.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(blocks.pinionBody.matrixWorld);
    const r = Math.hypot(v.x - center.x, v.z - center.z);
    if (v.y > center.y + g.pinionFaceLength * 0.45) upper = Math.max(upper, r);
    if (v.y < center.y - g.pinionFaceLength * 0.45) lower = Math.max(lower, r);
  }
  assert.ok(center.y < 0, 'B sits below A\'s centre');
  assert.ok(lower > upper * 1.05, `large end outward: ${lower} vs ${upper}`);
});

test('414 rolling constraint, increasing speed inward and decreasing outward, and feather slide', () => {
  const model = createMovementModel(catalog.movements[413]);
  const { stateAtTime, geometry: g } = model.root.userData;
  let prevSpeed = 0;
  for (let i = 1; i < 400; i += 1) {
    const t = g.rampDuration + g.cruiseDuration * i / 400;
    const s = stateAtTime(t);
    near(s.integratedRollingResidual, 0, 1e-9, 'integrated rolling');
    near(s.pitchLineSpeedResidual, 0, 1e-9, 'pitch-line speed');
    assert.ok(s.plateAngularSpeed > prevSpeed, 'forward speed increases as B runs inward');
    prevSpeed = s.plateAngularSpeed;
    near(s.pinionCenterY, -s.contactRadius + g.pinionFaceLength / 2, 1e-12, 'B follows the contact along its shaft');
  }
  let prevMagnitude = Infinity;
  for (let i = 1; i < 400; i += 1) {
    const s = stateAtTime(g.reverseStartTime + g.rampDuration + g.cruiseDuration * i / 400);
    assert.ok(Math.abs(s.plateAngularSpeed) < prevMagnitude, 'reverse speed falls as B runs outward');
    prevMagnitude = Math.abs(s.plateAngularSpeed);
  }
  const a = stateAtTime(0.3), b = stateAtTime(0.3 + g.cycleDuration);
  near(b.plateAngle, a.plateAngle, 1e-12, 'loop closes');
});

test('414 scene has no white indices and plays without reallocating geometry', () => {
  const model = createMovementModel(catalog.movements[413]);
  const roles = [];
  model.root.traverse((o) => o.userData.role && roles.push(o.userData.role));
  assert.ok(!roles.some((r) => /white/.test(r)));
  const before = [];
  model.root.traverse((o) => before.push([o, o.geometry]));
  for (let i = 0; i < 40; i += 1) model.update(i * 0.31);
  const after = [];
  model.root.traverse((o) => after.push([o, o.geometry]));
  assert.deepEqual(after, before);
});
