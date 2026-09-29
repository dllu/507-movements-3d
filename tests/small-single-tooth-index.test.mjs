import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeSmallSingleToothIndex } from '../src/simulation/small-single-tooth-index.js';
import { makeSmallSingleToothMotion } from '../src/simulation/small-single-tooth-index-motion.js';
import profile from '../src/data/small-single-tooth-index-profile.js';
import { makeSmallSingleToothConstraintField } from '../scripts/lib/small-single-tooth-constraint-field.mjs';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

const p = profile.parameters, motion = makeSmallSingleToothMotion();
const atAngle = angle => motion.atTime(angle - p.initialInputPhase);
const dispose = model => model.root.traverse(object => {
  object.geometry?.dispose();
  if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
  else object.material?.dispose();
});

test('069 has thirty asymmetric teeth and one broad projecting driver tooth', () => {
  assert.equal(p.teeth, 30);
  // p101: the thirty teeth are identical rotated copies (ideal flanks).
  const n = profile.output[0].length / 30, c = Math.cos(p.pitch), s = Math.sin(p.pitch);
  for (let i = 0; i < n; i++) {
    const [x, y] = profile.output[0][i], [u, v] = profile.output[0][i + n];
    assert.ok(Math.hypot(x * c - y * s - u, x * s + y * c - v) < 1e-12);
  }
  const radii = profile.output[0].map(q => Math.hypot(...q));
  const tips = radii.filter((r, i) => r > radii[(i + radii.length - 1) % radii.length]
    && r > radii[(i + 1) % radii.length]);
  assert.equal(tips.length, 30);
  const section = radii.slice(0, radii.length / 30);
  const rootFraction = section.indexOf(Math.min(...section)) / section.length;
  assert.ok(rootFraction > .5 && rootFraction < .7);
  const outside = profile.driver[0].map(q => Math.hypot(...q) > p.driverRadius + 1e-5);
  assert.equal(outside.filter((v, i) => v && !outside[(i + outside.length - 1) % outside.length]).length, 1);
});

test('069 uses six solids, two moving families and an axial source view', () => {
  const model = makeSmallSingleToothIndex(), data = model.root.userData;
  assert.equal(Object.keys(data.parts).length, 6);
  assert.deepEqual([...new Set(Object.values(data.families))].sort(), ['input', 'output']);
  assert.equal(data.parts.driverPlate.parent, data.blocks.input);
  assert.equal(data.parts.wheelPlate.parent, data.blocks.output);
  assert.equal(data.hideGround, true);
  assert.deepEqual(model.cameraDirection.toArray(), [0, 0, 10]);
  assert.equal(data.minimumDisplayCycleSeconds, 3);
  assert.ok(new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).z < .6);
  dispose(model);
});

test('069 remains stationary until physical contact starts the index', () => {
  const before = atAngle(p.entryAngle - 1e-5), after = atAngle(p.entryAngle + 1e-5);
  assert.equal(Math.abs(before.outputSpeed), 0); assert.equal(before.outputAngle, p.initialQ);
  assert.ok(after.outputSpeed < -.3 && after.outputSpeed > -.5);
  const field = makeSmallSingleToothConstraintField(profile, p);
  assert.ok(field.atAngle(before.inputAngle)(0) <= 1e-7);
  assert.ok(field.atAngle(after.inputAngle)(0) > 1e-6);
  assert.ok(field.atAngle(after.inputAngle)(after.advance) < 5e-7);
});

test('069 advances exactly two teeth per input turn across positive and negative time', () => {
  for (const time of [-20, -.3, 0, 2.7, 3.2, 3.95, 4.4, 12, 37]) {
    const a = motion.atTime(time), b = motion.atTime(time + p.period);
    assert.ok(Math.abs(b.inputAngle - a.inputAngle - 2 * Math.PI) < 1e-12);
    assert.ok(Math.abs(b.outputAngle - a.outputAngle + 2 * p.pitch) < 1e-11);
  }
  assert.equal(p.cycleClosureError, 0);
  assert.equal(atAngle(p.period - 1e-8).outputAngle, atAngle(p.period + 1e-8).outputAngle);
});

test('069 indexes monotonically at bounded speed and stops at the resolved rim event', () => {
  let previous = motion.atTime(0).outputAngle, peak = 0;
  for (let i = 1; i <= 4000; i++) {
    const state = motion.atTime(2 * p.period * i / 4000);
    assert.ok(state.outputAngle <= previous + 1e-12);
    assert.ok(state.outputSpeed <= 0);
    peak = Math.max(peak, -state.outputSpeed); previous = state.outputAngle;
  }
  assert.ok(peak > .45 && peak < .46);
  // p101: with the ideal flanks B's tooth eases A into the rim seat.
  assert.ok(atAngle(p.exitAngle - .02).outputSpeed < -.1);
  assert.ok(atAngle(p.exitAngle - 1e-5).outputSpeed < 0);
  assert.equal(Math.abs(atAngle(p.exitAngle + 1e-5).outputSpeed), 0);
  assert.equal(atAngle(p.exitAngle + 1e-5).advance, 2 * p.pitch);
  assert.equal(Math.abs(atAngle(5).outputSpeed), 0);
});

test('069 preserves its resisting-load pause and resumes when contact requires movement', () => {
  // p101: the ideal teeth pause at the re-solved knot 3.99706593721.
  const held = atAngle(3.95), before = atAngle(3.9970559372149324), after = atAngle(3.9971659372149324);
  assert.equal(Math.abs(held.outputSpeed), 0); assert.equal(Math.abs(before.outputSpeed), 0);
  assert.equal(held.outputAngle, before.outputAngle);
  assert.ok(after.outputSpeed < -.1);
  const field = makeSmallSingleToothConstraintField(profile, p);
  assert.ok(field.atAngle(before.inputAngle)(held.advance) < 5e-7);
  assert.ok(field.atAngle(after.inputAngle)(held.advance) > 1e-6);
  assert.ok(field.atAngle(after.inputAngle)(after.advance) < 5e-7);
});

test('069 actual plate skins clear at contact transitions and the cycle seam', () => {
  const model = makeSmallSingleToothIndex(), parts = model.root.userData.parts;
  const data = [parts.driverPlate, parts.wheelPlate].map(mesh => ({ mesh,
    solid: solidSurface(mesh.geometry), samples: surfacePoints(mesh.geometry) }));
  for (const angle of [0, p.entryAngle - 1e-5, p.entryAngle + 1e-5, 2.81, 3.1, 3.869,
    3.9970659372149324, p.exitAngle - 1e-5, p.exitAngle, p.exitAngle + 1e-5, p.period]) {
    model.update(angle - p.initialInputPhase); model.root.updateMatrixWorld(true);
    for (const [a, b] of [[data[0], data[1]], [data[1], data[0]]]) {
      const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for (const sample of a.samples) {
        const point = sample.clone().applyMatrix4(matrix);
        assert.ok(!b.solid.inside(point) || b.solid.distance(point) <= 1e-6,
          `${a.mesh.name} penetrates ${b.mesh.name} at input angle ${angle}`);
      }
    }
  }
  dispose(model);
});

test('069 rim locks both output directions after only a small angular clearance', () => {
  assert.ok(p.fullAngularPlay > 0 && p.fullAngularPlay < .00024);
  const field = makeSmallSingleToothConstraintField(profile, p).atAngle(0);
  for (const sign of [-1, 1]) {
    const seat = sign > 0 ? p.positiveSeat : p.negativeSeat;
    assert.ok(field(p.initialQ - seat) < 1e-7);
    assert.ok(field(p.initialQ - seat - sign * .001) > 1e-5);
  }
});
