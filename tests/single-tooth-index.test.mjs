import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeSingleToothIndex } from '../src/simulation/single-tooth-index.js';
import { makeSingleToothIndexMotion } from '../src/simulation/single-tooth-index-motion.js';
import profile from '../src/data/single-tooth-index-profile.js';
import { makeSingleToothConstraintField } from '../scripts/lib/single-tooth-constraint-field.mjs';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

const p = profile.parameters;
const dispose = model => model.root.traverse(object => {
  object.geometry?.dispose();
  if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
  else object.material?.dispose();
});

test('068 has one shaped tooth and ten short rounded notches', () => {
  assert.equal(p.notches, 10);
  // p101: tooth A is symmetric about its centre line, with a round tip.
  assert.equal(p.idealTooth, true); assert.ok(p.tipRadius >= 0.06 && p.tipRadius <= 0.08);
  const c = Math.cos(-p.toothAngle), s = Math.sin(-p.toothAngle), local = profile.driver[0].map(([x, y]) => [x * c - y * s, x * s + y * c]);
  const near = local.filter(([x, y]) => Math.hypot(x, y) > 1.15 && Math.abs(Math.atan2(y, x)) < 0.35);
  let asymmetry = 0;
  const segment = ([x, y], [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - ax - t * dx, y - ay - t * dy); };
  for (const [x, y] of near) asymmetry = Math.max(asymmetry, Math.min(...local.map((a, i) => segment([x, -y], a, local[(i + 1) % local.length]))));
  assert.ok(asymmetry < 2e-3, `tooth and notches mirror about A's centre line (${asymmetry})`);
  assert.equal(p.pitch, Math.PI / 5);
  let projectingRuns = 0, previous = false;
  for (const point of profile.driver[0]) {
    const outside = Math.hypot(...point) > p.driverRadius + 1e-5;
    if (outside && !previous) projectingRuns++;
    previous = outside;
  }
  assert.equal(projectingRuns, 1);
  for (let i = 0; i < p.notches; i++) {
    const angle = Math.PI + i * p.pitch, radius = p.slotCenter - p.slotRadius;
    const x = radius * Math.cos(angle), y = radius * Math.sin(angle);
    assert.ok(Math.min(...profile.output[0].map(q => Math.hypot(q[0] - x, q[1] - y))) < 1e-6);
  }
});

test('068 uses six physical solids and an axial source view', () => {
  const model = makeSingleToothIndex(), data = model.root.userData;
  assert.equal(Object.keys(data.parts).length, 6);
  assert.deepEqual([...new Set(Object.values(data.families))].sort(), ['input', 'output']);
  assert.equal(data.parts.driverPlate.parent, data.blocks.input);
  assert.equal(data.parts.notchedPlate.parent, data.blocks.output);
  assert.equal(data.hideGround, true);
  assert.deepEqual(model.cameraDirection.toArray(), [0, 0, 10]);
  assert.equal(data.minimumDisplayCycleSeconds, 4);
  assert.ok(new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).z < 0.6);
  dispose(model);
});

test('068 starts at contact instead of interpolating into the preceding dwell', () => {
  const motion = makeSingleToothIndexMotion(), epsilon = 1e-5;
  const before = motion.atTime(p.entryTime - epsilon), after = motion.atTime(p.entryTime + epsilon);
  assert.equal(before.outputSpeed, 0);
  assert.equal(before.outputAngle, p.initialQ);
  // p101: the ideal round-tipped tooth meets the slot flank at 1.49x.
  assert.ok(after.outputSpeed > 1.4 && after.outputSpeed < 1.6);
  const field = makeSingleToothConstraintField(profile);
  assert.ok(field.atAngle(before.inputAngle)(before.outputAngle) <= 1e-7);
  assert.ok(field.atAngle(after.inputAngle)(before.outputAngle) > 1e-6);
  assert.ok(field.atAngle(after.inputAngle)(after.outputAngle) < 5e-7);
});

test('068 advances one notch per input turn with bounded seam error', () => {
  const motion = makeSingleToothIndexMotion();
  for (const time of [-20, -0.3, 0, 0.5241, 0.9, 1.2, 3, 12, 37]) {
    const a = motion.atTime(time), b = motion.atTime(time + p.period);
    assert.ok(Math.abs(b.inputAngle - a.inputAngle + 2 * Math.PI) < 1e-12);
    assert.ok(Math.abs(b.outputAngle - a.outputAngle - p.pitch) < 1e-11);
  }
  const seam = p.sourceAngle + Math.PI, epsilon = 1e-8;
  const jump = motion.atTime(seam + epsilon).outputAngle - motion.atTime(seam - epsilon).outputAngle;
  assert.ok(jump >= 0 && jump < 3e-7);
});

test('068 progresses monotonically at a bounded speed and returns to dwell', () => {
  const motion = makeSingleToothIndexMotion();
  let previous = motion.atTime(0).outputAngle, peak = 0;
  for (let i = 1; i <= 3000; i++) {
    const state = motion.atTime(2 * p.period * i / 3000);
    assert.ok(state.outputAngle >= previous - 1e-12);
    assert.ok(state.outputSpeed >= 0);
    peak = Math.max(peak, state.outputSpeed); previous = state.outputAngle;
  }
  assert.ok(peak > 1.9 && peak < 2.0);
  assert.equal(motion.atTime(2).outputSpeed, 0);
});

test('068 working plate skins clear at entry, contact changes and the cycle seam', () => {
  const model = makeSingleToothIndex(), parts = model.root.userData.parts;
  const data = [parts.driverPlate, parts.notchedPlate].map(mesh => ({ mesh,
    solid: solidSurface(mesh.geometry), samples: surfacePoints(mesh.geometry) }));
  for (const time of [0, p.entryTime - 1e-5, p.entryTime + 1e-5, 0.5347889326282175,
    p.sourceAngle - 0.2325, p.sourceAngle + 0.213, 1.0593474075834948, p.sourceAngle + Math.PI]) {
    model.update(time); model.root.updateMatrixWorld(true);
    for (const [a, b] of [[data[0], data[1]], [data[1], data[0]]]) {
      const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const q of a.samples) {
        const point = q.clone().applyMatrix4(matrix);
        assert.ok(!b.solid.inside(point) || b.solid.distance(point) <= 1e-6,
          `${a.mesh.name} penetrates ${b.mesh.name} at ${time}`);
      }
    }
  }
  dispose(model);
});

test('068 circular locks admit only a small angular clearance', () => {
  const lower = Math.acos((p.centerDistance ** 2 + p.outputRadius ** 2
    - (p.driverRadius + p.clearance) ** 2) / (2 * p.centerDistance * p.outputRadius));
  const upper = Math.acos((p.centerDistance ** 2 + p.outputRadius ** 2
    - p.driverRadius ** 2) / (2 * p.centerDistance * p.outputRadius));
  assert.ok(Math.abs(p.lockSeat - (lower - upper)) < 1e-12);
  assert.ok(2 * p.lockSeat < 0.00054);
  const field = makeSingleToothConstraintField(profile).atAngle(0.9);
  for (const sign of [-1, 1]) {
    const seated = -p.halfPitch + sign * p.lockSeat;
    assert.ok(field(seated) < 1e-7);
    assert.ok(field(seated + sign * 0.001) > 1e-5);
  }
});
