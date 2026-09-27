import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const ARCHETYPE = 'paired-eye-lever-boat-detachers-with-hinged-load-tongues';
const movement = catalog.movements[491];
const model = createMovementModel(movement);
const { blocks: b, geometry: g, stateAtTime } = model.root.userData;
const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
const rotate2 = (v, a) => new THREE.Vector2(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a));

test('movement 492 is the one detaching hook Brown draws: standard, tongue, lever, tackle hook and ropes', () => {
  assert.equal(movement.id, 492);
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  for (const part of [b.standard, b.tongue, b.lever, b.tackle, b.releaseRope]) assert.equal(part.parent, model.root);
  for (const part of [b.standardBar, b.collar, b.shank, b.thread, b.tongueHingePin, b.leverFulcrumPin]) assert.equal(part.parent, b.standard);
  assert.equal(b.leverEye.parent, b.lever);
  assert.equal(b.tongueBar.parent, b.tongue);
  assert.equal(b.hookBar.parent, b.hookFrame);
  assert.equal(b.block.parent, b.blockFrame);
  assert.equal(b.blockFrame.parent, b.tackle);
  assert.equal(b.strop.parent, b.blockFrame);
  assert.equal(b.strop.geometry.type, 'LaidRopeGeometry');
  const roles = [];
  model.root.traverse(o => roles.push(o.userData.role ?? ''));
  assert.equal(roles.filter(r => /deck|rail|crossbar|hand|white|index/.test(r)).length, 0, 'nothing Brown does not draw');
  assert.match(movement.description, /tongue hinged to its upper end enters an eye in the level.*fulcrum at the middle of the standard/s);
});

test('movement 492 keeps Brown\'s pin, eye, rope-eye and hook positions', () => {
  const plate = model.root.userData.sourceReference.brownPlate492;
  const scene = ([x, y]) => new THREE.Vector2((x - plate.leverFulcrumPixels[0]) / plate.pixelsPerUnit,
    (plate.leverFulcrumPixels[1] - y) / plate.pixelsPerUnit);
  near(g.hingeCenter.y, scene(plate.tongueHingePixels).y, 1e-12, 'hinge height');
  near(g.eyeCenterRest.distanceTo(scene(plate.leverEyePixels)), 0, 1e-12, 'lever eye');
  near(g.ropeEyeRest.distanceTo(scene(plate.lowerRopeEyePixels)), 0, 1e-12, 'rope eye');
  near(g.hookThroatX, scene([plate.hookThroatXPixels, 0]).x, 1e-12, 'hook throat');
});

test('movement 492 eye slides straight off the tongue end without bearing on it', () => {
  // The tongue end lies along the chord of the eye's travel, so the eye's
  // upper wall only moves away from the tongue while the eye slides off.
  const upward = new THREE.Vector2(-g.tongueEndDirection.y, g.tongueEndDirection.x);
  if (upward.y < 0) upward.negate();
  const axisPoint = g.eyeCenterRest.clone().addScaledVector(upward, g.eyeInnerHalfWidth - g.tongueRadius - g.restGap);
  for (let i = 0; i <= 200; i++) {
    const angle = g.leverReleaseAngle * i / 200;
    const eye = rotate2(g.eyeCenterRest, angle);
    const offset = eye.clone().sub(axisPoint);
    const across = offset.dot(upward);
    // Upper wall stays above the tongue, lower wall below it.
    assert.ok(across + g.eyeInnerHalfWidth - g.tongueRadius >= g.restGap - 1e-12, `upper wall ${i}`);
    assert.ok(g.eyeInnerHalfWidth - g.tongueRadius - across > 0, `lower wall ${i}`);
  }
  const released = rotate2(g.eyeCenterRest, g.leverReleaseAngle).sub(axisPoint).dot(g.tongueEndDirection);
  assert.ok(released - g.eyeHalfLength > g.tongueTipBeyondEye + g.tongueRadius, 'eye fully clear of the tongue end');
  // The locked load on the upper wall is radial to the lever: no opening moment.
  const radial = g.eyeCenterRest.clone().normalize();
  assert.ok(Math.abs(radial.dot(upward)) > 0.95);
});

test('movement 492 releases in Brown\'s order: eye off, tongue out of the hook, hook away', () => {
  let leverDone = false, tongueStarted = false, exited = false;
  for (let i = 0; i <= 1000; i++) {
    const s = stateAtTime(g.cycleDuration * i / 1000);
    if (s.phase < 0.6) {
      if (s.tongueProgress > 0) { tongueStarted = true; assert.ok(s.leverProgress > 1 - 1e-9, `tongue waits for the eye ${i}`); }
      if (s.leverProgress > 1 - 1e-9) leverDone = true;
      if (!s.engaged) exited = true;
    }
    assert.ok(s.hookLift >= -1e-9, `hook never drops below its locked seat ${i}`);
    if (s.tongueProgress === 0) near(s.hookLift, 0, 1e-12, `hook seated while tongue locked ${i}`);
  }
  assert.ok(leverDone && tongueStarted && exited);
  assert.ok(g.tongueExitAngle < -Math.PI / 3 && g.tongueExitAngle > -Math.PI * 0.75, 'tongue swings up out of the hook');
});

test('movement 492 renders the solved poses, keeps the rope on its eye and closes its loop', () => {
  for (const time of [0, 1.7, 2.9, 3.6, 4.4, 5.3, 6.6, 7.9, 9.4, 10]) {
    const s = stateAtTime(time);
    model.update(time); model.root.updateMatrixWorld(true);
    near(b.lever.rotation.z, s.leverAngle, 0, `lever ${time}`);
    near(b.tongue.rotation.z, s.tongueAngle, 0, `tongue ${time}`);
    near(b.tackle.position.y, s.throatHeight, 0, `hook ${time}`);
    const eye = new THREE.Vector3(s.ropeEyeCenter.x, s.ropeEyeCenter.y, g.mechanismZ);
    near(b.releaseRope.position.distanceTo(eye), 0.2, 1e-9, `rope seized at the eye rim ${time}`);
  }
  const a = stateAtTime(0), z = stateAtTime(g.cycleDuration);
  for (const key of ['leverAngle', 'tongueAngle', 'throatHeight']) near(a[key], z[key], 1e-12, `${key} loop`);
  let maxStep = 0, previous = stateAtTime(0);
  for (let i = 1; i <= 4000; i++) {
    const s = stateAtTime(g.cycleDuration * i / 4000);
    maxStep = Math.max(maxStep, Math.abs(s.throatHeight - previous.throatHeight), Math.abs(s.tongueAngle - previous.tongueAngle));
    previous = s;
  }
  assert.ok(maxStep < 0.01, `smooth motion ${maxStep}`);
});

test('movement 492 block is stropped: the strop lies in its score, bears on the hook eye and is seized above it', async () => {
  const { solidSurface } = await import('./helpers/solid-surface.mjs');
  const curve = b.strop.geometry.parameters.path, radius = b.strop.geometry.parameters.radius;
  const shell = solidSurface(b.block.geometry), toShell = new THREE.Matrix4().copy(b.block.matrix).invert();
  const eye = b.hookEye.geometry.parameters, eyeCenter = b.hookEye.position;
  let shellGap = Infinity, eyeGap = Infinity, onShell = 0;
  for (let i = 0; i < 4000; i++) {
    const p = curve.getPointAt(i / 4000);
    const d = shell.signedDistance(p.clone().applyMatrix4(toShell)) - radius;
    shellGap = Math.min(shellGap, d);
    if (d < 0.01) onShell++;
    // The eye is a torus in the block frame's xy plane.
    const q = p.clone().sub(eyeCenter), ring = Math.hypot(q.x, q.y) - eye.radius;
    eyeGap = Math.min(eyeGap, Math.hypot(ring, q.z) - eye.tube - radius);
  }
  console.log('492 strop', { shellGap, eyeGap, onShell });
  assert.ok(shellGap > -0.004, `strop into the shell ${shellGap}`);
  assert.ok(onShell > 2000, 'the strop runs round the shell in its score');
  assert.ok(Math.abs(eyeGap) < 0.004, `bight bears on the hook eye ${eyeGap}`);
  // The seizing binds both legs.
  const seizingY = b.seizing.position.y, legs = [];
  for (let i = 0; i < 4000; i++) { const p = curve.getPointAt(i / 4000); if (Math.abs(p.y - seizingY) < 0.005) legs.push(p); }
  assert.ok(legs.length >= 2 && legs.every(p => Math.abs(p.x) < 1e-6 && Math.abs(Math.abs(p.z) - radius) < 0.01), 'legs side by side in the seizing');
});
