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

test('finite spherical stud fits conservatively through the entire channel', () => {
  // A sphere is inside its radius-sized cube. Bound both its axial offset
  // and the Lipschitz variation of channel height over its angular extent.
  const angularExtent = Math.asin(g.studRadius / g.studCenterRadius);
  const maximumAxialExtent = g.studRadius + 2 * g.amplitude / Math.PI * angularExtent;
  // The tighter spherical bound samples meridians, independent of mesh facets.
  let maximum = 0;
  for (let i = 0; i <= 10000; i++) {
    const z = g.studRadius * (2 * i / 10000 - 1);
    const axial = Math.sqrt(Math.max(0, g.studRadius ** 2 - z ** 2));
    const angle = Math.atan2(Math.abs(z), g.studCenterRadius - g.studRadius);
    maximum = Math.max(maximum, axial + 2 * g.amplitude / Math.PI * angle);
  }
  assert.ok(maximum < g.slotHalfHeight - .01);
  assert.ok(maximum <= maximumAxialExtent);
  assert.ok(g.studCenterRadius - g.studRadius > g.floorRadius + .01);
});

test('harmonic input and output position remain continuous across reversals', () => {
  for (const t of [0, g.period / 2, g.period]) {
    const before = grooveDrumState(t - 1e-6), after = grooveDrumState(t + 1e-6);
    assert.ok(Math.abs(before.rodY - after.rodY) < 1e-9);
    assert.ok(Math.abs(before.drumAngle - after.drumAngle) < 1e-9);
  }
});
