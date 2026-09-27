import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

// Pass 71: rebuilt as a working section.
test('427: the pistons stay radial to the cylinder and pass through their packings in C', () => {
  const model = createMovementModel(catalog.movements[426]);
  const u = model.root.userData;
  const g = u.geometry;
  try {
    assert.equal(u.archetype, catalog.movements[426].archetype);
    // C touches the bore at the top
    assert.ok(Math.abs(g.shaftOffset + g.hubRadius - g.boreRadius) < 0.01);
    let maxPackingAngle = 0;
    for (let i = 0; i <= 128; i += 1) {
      const s = u.stateAtTime(g.cycleDuration * i / 128);
      for (const p of s.pistons) {
        // packing centre on the piston's radial line about O
        const along = Math.hypot(...p.packing);
        assert.ok(Math.abs(p.packing[0] - along * Math.cos(p.angle)) < 1e-9);
        assert.ok(Math.abs(p.packing[1] - along * Math.sin(p.angle)) < 1e-9);
        // the packing stays clear of the wedge on the inner end
        assert.ok(along - g.packingRadius > g.wedgeOuter + 0.2);
        maxPackingAngle = Math.max(maxPackingAngle, Math.abs(Math.atan2(Math.sin(p.packingAngle), Math.cos(p.packingAngle))));
      }
    }
    assert.ok(maxPackingAngle > 0.15 && maxPackingAngle < 0.25, `packings rock ${maxPackingAngle}`);
  } finally { disposeObject3D(model.root); }
});

test('427: steam drives the piston past the inlet, expands between the pistons and is educted', () => {
  const model = createMovementModel(catalog.movements[426]);
  const u = model.root.userData;
  const g = u.geometry;
  const { behind, between, ahead, inlet, eduction } = u.blocks.steam;
  try {
    assert.equal(inlet.userData.pressure, 1);
    assert.equal(eduction.userData.pressure, 0);
    for (let i = 0; i <= 240; i += 1) {
      model.update(g.cycleDuration * i / 240);
      const { lo, hi } = u.steamReport.lastRegions;
      if (lo > g.inletMouth[1] + 0.02) {
        assert.ok(behind.userData.pressure > 0.99, 'behind the working piston is live');
        assert.ok(between.userData.pressure <= 1 && between.userData.pressure >= 0);
      }
      if (hi > g.exhaustMouth[1] + 0.02) assert.ok(between.userData.pressure < 0.01, 'released');
      if (lo < g.inletMouth[0] - 0.01 && hi < g.exhaustMouth[0]) assert.ok(between.userData.pressure > 0.99, 'inlet open to the space between');
      assert.equal(ahead.userData.pressure, 0);
    }
    assert.ok(u.steamReport.cutoffArea > 20);
  } finally { disposeObject3D(model.root); }
});

test('427: no markers, flow arrows or bed slab', () => {
  const model = createMovementModel(catalog.movements[426]);
  try {
    const roles = [];
    model.root.traverse((object) => object.userData.role && roles.push(object.userData.role));
    assert.ok(!roles.some((role) => /marker|arrow|indicator|slab|foundation/.test(role)), roles.join());
  } finally { disposeObject3D(model.root); }
});
