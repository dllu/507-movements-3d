import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {rigidFamilyInertia} from '../src/simulation/mujoco/mass.js';
import {makeMujocoSpringSector} from '../src/simulation/mujoco-spring-sector/visual.js';
import {nativePlateContours, signedArea} from '../scripts/lib/weighted-clutch-native-contours.mjs';
import {makeSpringSectorFastContact} from '../scripts/lib/spring-sector-fast-contact.mjs';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';

const mujoco = await loadMujoco();

test('native solid mass preserves the full tensor under translation and rotation', () => {
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4));
  box.position.set(5, -7, 11); box.rotation.set(.3, -.7, 1.1); box.updateMatrix();
  try {
    const actual = rigidFamilyInertia({box}, {box: 'rigid'}, 'rigid');
    assert.ok(Math.abs(actual.volume - 24) < 1e-10);
    actual.centroid.forEach((v, i) => assert.ok(Math.abs(v - box.position.toArray()[i]) < 1e-10));
    const rotation = new THREE.Matrix3().setFromMatrix4(box.matrix);
    const expected = rotation.clone().multiply(new THREE.Matrix3().set(50, 0, 0, 0, 40, 0, 0, 0, 26))
      .multiply(rotation.clone().transpose()).elements;
    actual.inertia.forEach((v, i) => assert.ok(Math.abs(v - expected[[0, 4, 8, 1, 2, 5][i]]) < 1e-9));
    assert.throws(() => rigidFamilyInertia({box}, {box: 'rigid'}, 'missing'), RangeError);
  } finally { box.geometry.dispose(); box.material.dispose(); }
});

test('083 drives only the input slider; filled collision holes cannot reach the crown', t => {
  const v = makeMujocoSpringSector(mujoco), u = v.root.userData;
  try {
    const {model, data, description} = v.physics;
    assert.equal(model.nq, 6); assert.equal(model.nu, 1);
    assert.equal(model.actuator_trnid[0], v.physics.id('mjOBJ_JOINT', 'slider'));
    assert.ok(Math.max(...Array.from(data.qvel, Math.abs)) < 1e-7, 'initial spring settling must finish');
    let minimum = Infinity;
    for (const name of ['front', 'rear']) {
      assert.ok(description.collision[name].maximumBoundaryError < 1e-10);
      const rings = nativePlateContours(u.parts[name + 'Sector'].geometry)
        .sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
      assert.equal(rings.length, 3);
      // Y is affine on each polygon edge. Check every vertex at both angle
      // limits and its interior sinusoid minimum, using the lowest guide stop.
      for (const ring of rings.slice(1)) for (const [x, y] of ring) {
        const stationary = Math.atan2(-x, -(y - .06));
        for (const angle of [-.235, .235, stationary]) if (Math.abs(angle) <= .235)
          minimum = Math.min(minimum, x * Math.sin(angle) + (y - .06) * Math.cos(angle));
      }
    }
    const clearance = minimum - u.geometry.wheelTop - u.geometry.toothHeight;
    t.diagnostic('Filled opening clearance above crown: ' + clearance);
    assert.ok(clearance > .19);
    assert.ok(u.geometry.wheelPitchRadius - u.geometry.depth / 2 > .12,
      'sectors must remain outside the filled wheel shaft bore');
    v.update(.71); const state = Array.from(data.qpos);
    v.update(.71); assert.deepEqual(Array.from(data.qpos), state);
    v.reset(); for (let i = 1; i <= 71; i++) v.update(i / 100);
    assert.deepEqual(Array.from(data.qpos), state, 'display frame partition must not change the trajectory');
  } finally { v.dispose(); }
});

test('083 native contacts, ordinary pins and camera bounds hold over fifteen live cycles', t => {
  const v = makeMujocoSpringSector(mujoco), u = v.root.userData;
  const {data, model, joints} = v.physics, contact = makeSpringSectorFastContact(v);
  const initial = Array.from(data.qpos), pitch = 2 * Math.PI / u.geometry.wheelTeeth, scale = u.source.scale;
  let nativeGap = 0, engineGap = 0, bodyGap = Infinity, pinError = 0, maxStep = 0, high = initial[joints.wheel.q], retreat = 0;
  let previous = initial, poses = 0;
  const counts = [{engaged: 0, free: 0}, {engaged: 0, free: 0}], point = new THREE.Vector3();
  try {
    for (let step = 1; step <= Math.round(60 / v.physics.timestep); step++) {
      v.physics.step(); const q = Array.from(data.qpos);
      assert.ok(q.every(Number.isFinite) && Array.from(data.qvel).every(Number.isFinite));
      assert.ok(Math.abs(q[joints.shaft.q]) < .235);
      for (const name of ['front', 'rear']) assert.ok(q[joints[name].q] >= -.06 && q[joints[name].q] <= .18);
      maxStep = Math.max(maxStep, ...q.map((value, i) => Math.abs(value - previous[i]))); previous = q;
      high = Math.max(high, q[joints.wheel.q]); retreat = Math.max(retreat, high - q[joints.wheel.q]);
      if (step % Math.round(.1 / v.physics.timestep)) continue;
      const state = v.sync(); poses++;
      for (const [side, name] of ['front', 'rear'].entries()) {
        const seat = contact.seat(state.shaftAngle, state.wheelAngle, side), gap = state.lifts[side] - seat.lift;
        nativeGap = Math.min(nativeGap, gap);
        bodyGap = Math.min(bodyGap, seat.bodyPlaneGap + gap * Math.cos(state.shaftAngle));
        counts[side][gap < .001 ? 'engaged' : 'free']++;
      }
      const contacts = data.contact;
      for (let i = 0; i < contacts.size(); i++) { const c = contacts.get(i); engineGap = Math.min(engineGap, c.dist); c.delete(); }
      contacts.delete();
      const rodEnd = new THREE.Vector3(...u.linkage.end.map((x, i) => x - u.linkage.pin[i]), u.geometry.wheelPitchRadius + .1)
        .applyMatrix4(u.blocks.rod.matrixWorld);
      const sliderPin = new THREE.Vector3(0, 0, u.geometry.wheelPitchRadius + .1).applyMatrix4(u.blocks.slider.matrixWorld);
      pinError = Math.max(pinError, rodEnd.distanceTo(sliderPin));
      for (const mesh of Object.values(u.parts)) {
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          assert.ok(u.cameraFitBounds.containsPoint(point), mesh.name + ' leaves camera bounds');
        }
      }
    }
    const advance = (data.qpos[joints.wheel.q] - initial[joints.wheel.q]) / pitch;
    const report = {poses, seconds: data.time, advanceTeeth: advance, retreatTeeth: retreat / pitch,
      nativeGapPixels: nativeGap * scale, engineGapPixels: engineGap * scale, bodyGap, pinErrorPixels: pinError * scale, maxStep, counts};
    t.diagnostic(JSON.stringify(report));
    assert.ok(advance > 110 && advance < 125);
    assert.ok(retreat / pitch < .04); assert.ok(nativeGap * scale > -.3); assert.ok(engineGap * scale > -.2);
    assert.ok(bodyGap > .02); assert.ok(pinError * scale < .05); assert.ok(maxStep < .002);
    for (const count of counts) { assert.ok(count.engaged > 100); assert.ok(count.free > 100); }
    v.reset(); assert.deepEqual(Array.from(data.qpos), initial);
  } finally { v.dispose(); }
});

test('083 visible hardware remains closed and clear at both reversals and both driving strokes', t => {
  const v = makeMujocoSpringSector(mujoco);
  try {
    let checks = 0, softContacts = 0;
    for (const time of [0, 1, 2, 3, 4]) {
      v.update(time); const audit = auditClutchSourceSolids(v); checks += audit.checks;
      assert.equal(audit.topology.length, 84); assert.deepEqual(audit.topologyIssues, []);
      for (const issue of audit.issues) {
        assert.ok(([issue.from, issue.to].some(name => /^(front|rear)Sector$/.test(name))) &&
          ([issue.from, issue.to].some(name => /^wheelTooth\d+$/.test(name))), JSON.stringify(issue));
        assert.ok(issue.gap * v.root.userData.source.scale > -.2, JSON.stringify(issue)); softContacts++;
      }
    }
    t.diagnostic(JSON.stringify({checks, softContacts}));
  } finally { v.dispose(); }
});
