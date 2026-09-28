import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

// Pass 71: the eccentric rotary engine rebuilt as a working section.
test('425: C touches the bore on one line and D rides on C inside its guide', () => {
  const model = createMovementModel(catalog.movements[424]);
  const u = model.root.userData;
  const g = u.geometry;
  try {
    assert.equal(u.archetype, catalog.movements[424].archetype);
    for (let i = 0; i <= 128; i += 1) {
      const s = u.stateAtTime(g.cycleDuration * i / 128);
      const c = s.pistonCenter;
      assert.ok(Math.abs(Math.hypot(...c) - g.eccentricity) < 1e-9);
      // contact line: C's far point meets the bore
      assert.ok(Math.abs(Math.hypot(...c) + g.pistonRadius - g.boreRadius) < 0.01);
      // D's round nose touches C
      assert.ok(Math.abs(Math.hypot(c[0], s.noseCenterY - c[1]) - g.pistonRadius - g.abutmentHalfWidth) < 1e-9);
      // D stays in its guide
      assert.ok(s.abutmentTop < g.slotTop - 0.2 && s.abutmentTop - g.abutmentLength > 3);
    }
    // Brown's pose: contact line at the bottom
    assert.ok(Math.abs(u.stateAtTime(0).contactAngle - Math.PI) < 1e-9);
  } finally { disposeObject3D(model.root); }
});

test('425: the space behind the contact line takes steam from the right neck and is released to the left', () => {
  const model = createMovementModel(catalog.movements[424]);
  const u = model.root.userData;
  const g = u.geometry;
  const { live, swept, inlet, eduction } = u.blocks.steam;
  try {
    assert.equal(inlet.userData.pressure, 1);
    assert.equal(eduction.userData.pressure, 0);
    let previous = null;
    for (let i = 0; i <= 256; i += 1) {
      const s = model.update(g.cycleDuration * i / 256);
      const deg = s.contactAngle * 180 / Math.PI;
      if (deg > 35 && deg < 325) {
        assert.ok(live.userData.pressure > 0.99, `live at ${deg}`);
        assert.ok(live.userData.area > 0.4, `live space at ${deg}`);
        if (previous && previous.deg < deg) assert.ok(live.userData.area >= previous.area - 1e-6, 'live space grows');
      }
      if (deg > 345 || deg < 15) assert.ok(live.userData.pressure < 0.01, `released at ${deg}`);
      assert.equal(swept.userData.pressure, 0);
      previous = { deg, area: live.userData.area };
    }
    // seam: the live space released at the top is the swept space after it
    model.update(g.cycleDuration * 0.4999);
    const before = live.userData.area;
    model.update(g.cycleDuration * 0.5001);
    assert.ok(Math.abs(swept.userData.area - before) < 0.05);
  } finally { disposeObject3D(model.root); }
});

test('425: no markers, flow spheres or foundation', () => {
  const model = createMovementModel(catalog.movements[424]);
  try {
    const roles = [];
    model.root.traverse((object) => object.userData.role && roles.push(object.userData.role));
    assert.ok(!roles.some((role) => /marker|indicator|foundation|flow/.test(role)), roles.join());
    assert.equal(model.root.userData.hideGround, true);
  } finally { disposeObject3D(model.root); }
});

test('movement 425 steam keeps its own per-frame normals after the load-time normal pass (p93)', async () => {
  const { creaseNormalsIn } = await import('../src/simulation/crease-normals.js');
  const model = createMovementModel(catalog.movements[424]);
  creaseNormalsIn(model.root);
  model.update(4 * 0.33);
  for (const mesh of Object.values(model.root.userData.blocks.steam)) {
    const { position, normal } = mesh.geometry.attributes;
    for (let i = 0; i < mesh.geometry.drawRange.count; i += 3) {
      const flat = Math.abs(position.getZ(i) - position.getZ(i + 1)) < 1e-6
        && Math.abs(position.getZ(i) - position.getZ(i + 2)) < 1e-6;
      if (flat) for (let k = 0; k < 3; k += 1) assert.ok(Math.abs(normal.getZ(i + k)) > 0.999, 'flat caps shade flat');
    }
  }
  disposeObject3D(model.root);
});

test('425 neck steam stops below the open mouths (p96)', async () => {
  const THREE = await import('three');
  const model = createMovementModel(catalog.movements[424]);
  for (const t of [0, 0.3, 0.7]) {
    model.update(t * 4);
    model.root.updateMatrixWorld(true);
    const { steam, casing } = model.root.userData.blocks;
    const mouth = 10.4 * model.root.scale.y;
    for (const neck of [steam.inlet, steam.eduction]) {
      if (!neck.visible || !neck.geometry.attributes.position?.count) continue;
      const top = new THREE.Box3().setFromObject(neck).max.y;
      assert.ok(top < mouth - 0.7 * model.root.scale.y, `${neck.userData.role} ${top} below ${mouth}`);
    }
    assert.ok(casing);
  }
  disposeObject3D(model.root);
});
