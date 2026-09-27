import assert from 'node:assert/strict';
import test from 'node:test';
import {grooveDrumGeometry as g, grooveHeight, grooveDrumState} from '../src/simulation/reversing-groove-drum.js';

test('opposite-pitch halves close and keep the input on the groove centerline', () => {
  let previous = Infinity;
  for (let i = 0; i <= 1024; i++) {
    const state = grooveDrumState(g.period * i / 1024);
    assert.ok(Math.abs(state.rodY - grooveHeight(state.localAngle)) < 1e-12);
    assert.ok(state.drumAngle <= previous);
    previous = state.drumAngle;
  }
  assert.equal(grooveDrumState(g.period).drumAngle, -2 * Math.PI);
  assert.equal(grooveDrumState(0).rodY, grooveDrumState(g.period).rodY);
});

test('finite spherical stud fits the channel walls and runs snug above the floor', () => {
  // Every sphere point (radial u, axial v, tangential z) lies at polar angle
  // atan2(|z|, c + u) from the stud axis; over that angle the planar groove's
  // height changes by at most amplitude per radian. Sample the whole sphere.
  const c = g.studCenterRadius, R = g.studRadius;
  let maximum = 0;
  for (let i = 0; i <= 400; i++) {
    const theta = Math.PI * i / 400;
    for (let j = 0; j <= 200; j++) {
      const phi = 2 * Math.PI * j / 200;
      const u = R * Math.cos(theta), v = R * Math.sin(theta) * Math.cos(phi), z = R * Math.sin(theta) * Math.sin(phi);
      maximum = Math.max(maximum, Math.abs(v) + g.amplitude * Math.atan2(Math.abs(z), c + u));
    }
  }
  assert.ok(maximum < g.slotHalfHeight - .01);
  // The tip clears the groove floor by a small running clearance, not a gap.
  const floorClearance = c - R - g.floorRadius;
  assert.ok(floorClearance > .003 && floorClearance < .01, `floor clearance ${floorClearance}`);
});

test('harmonic input and output position remain continuous across reversals', () => {
  for (const t of [0, g.period / 2, g.period]) {
    const before = grooveDrumState(t - 1e-6), after = grooveDrumState(t + 1e-6);
    assert.ok(Math.abs(before.rodY - after.rodY) < 1e-9);
    // The drum keeps turning uniformly through both dead centres.
    const expected = 2 * Math.PI * 2e-6 / g.period;
    assert.ok(Math.abs(before.drumAngle - after.drumAngle - expected) < 1e-9);
  }
});
