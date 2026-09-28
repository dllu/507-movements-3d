import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { multiArea, pointInMulti } from '../src/simulation/steam-section-kit.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

// Pass 71: Root's square piston engine rebuilt as a working section.
test('424: B and C are the Cartesian components of the wrist and stay clear of their walls', () => {
  const model = createMovementModel(catalog.movements[423]);
  const u = model.root.userData;
  const g = u.geometry;
  try {
    assert.equal(u.archetype, catalog.movements[423].archetype);
    for (let i = 0; i <= 96; i += 1) {
      const s = u.stateAtTime(g.cycleDuration * i / 96);
      assert.ok(Math.abs(Math.hypot(...s.wrist) - g.crankRadius) < 1e-9);
      assert.equal(s.bX, s.wrist[0]);
      assert.equal(s.cY, s.wrist[1]);
      for (const key of ['leftClearance', 'rightClearance', 'aboveClearance', 'belowClearance']) {
        assert.ok(s[key] > 0.25, `${key} ${s[key]}`);
      }
      // no joint dead point: the two moment arms are never both small
      assert.ok(Math.hypot(s.horizontalArm, s.verticalArm) > g.crankRadius - 1e-9);
      // shaft b stays inside C's crank pocket, clear of its land
      const bFromWrist = Math.hypot(...s.wrist);
      assert.ok(bFromWrist + g.shaftRadius + 0.02 < g.pocketRadius + 1e-9);
      assert.ok(g.pocketRadius < g.cHalfHeight - 0.3, 'pocket keeps a sealing land in C');
    }
    // Brown's pose: B to the right, C low
    const s0 = u.stateAtTime(0);
    assert.ok(s0.bX > 2.5 && s0.cY < -2.5);
  } finally { disposeObject3D(model.root); }
});

test('424: each space takes live steam while it grows and exhausts while it shrinks', () => {
  const model = createMovementModel(catalog.movements[423]);
  const u = model.root.userData;
  const g = u.geometry;
  try {
    const dt = 1e-3;
    for (let i = 0; i < 64; i += 1) {
      const t = g.cycleDuration * (i + 0.5) / 64;
      const a = u.stateAtTime(t);
      const b = u.stateAtTime(t + dt);
      const growth = {
        left: b.leftClearance - a.leftClearance,
        right: b.rightClearance - a.rightClearance,
        above: b.aboveClearance - a.aboveClearance,
        below: b.belowClearance - a.belowClearance,
      };
      for (const [name, change] of Object.entries(growth)) {
        if (Math.abs(change) < 1e-4) continue; // near a dead point
        const p = a.pressure[name];
        if (Math.abs(change) > 2e-3) assert.equal(p > 0.5, change > 0, `${name} at ${t}`);
      }
      // Both piston forces push the crank the same (anticlockwise) way.
      const torque = (a.pressure.left - a.pressure.right) * a.horizontalArm
        + (a.pressure.below - a.pressure.above) * a.verticalArm;
      assert.ok(torque > 0, `torque at ${t}`);
    }
    // The steam spaces reach their ports: C's spaces through B's slots.
    model.update(0);
    const steam = u.blocks.steam;
    for (const name of ['left', 'right', 'above', 'below']) {
      const region = steam[name].userData;
      assert.ok(steam[name].visible && region.area > 20, name);
    }
    const port = g.ports.above[0][0];
    const portCentre = [0, (port[0][1] + port[2][1]) / 2];
    const s0 = u.stateAtTime(0);
    const above = u.blocks.steam.above.userData;
    assert.ok(above.area > 0);
    assert.ok(multiArea(g.ports.above) > 5);
    assert.ok(pointInMulti(portCentre, g.ports.above));
    assert.ok(s0.aboveClearance > 1);
  } finally { disposeObject3D(model.root); }
});

test('424: crank b works behind C, with no undrawn support in front', () => {
  const model = createMovementModel(catalog.movements[423]);
  const u = model.root.userData;
  try {
    const roles = [];
    model.root.traverse((object) => object.userData.role && roles.push(object.userData.role));
    assert.ok(!roles.some((role) => /front-arm|standoff|foundation|indicator/.test(role)), roles.join());
    const { crankArm, cBack, cFront } = u.blocks;
    crankArm.geometry.computeBoundingBox();
    cFront.geometry.computeBoundingBox();
    cBack.geometry.computeBoundingBox();
    assert.ok(crankArm.geometry.boundingBox.max.z < cFront.geometry.boundingBox.min.z, 'crank arm lies in the pocket behind C');
    assert.equal(u.hideGround, true);
  } finally { disposeObject3D(model.root); }
});

test('movement 424 piston C is see-through so crank a-b (dotted by Brown) shows behind it (pass 90)', () => {
  const model = createMovementModel(catalog.movements[423]);
  const { cFront, cBack, crankArm } = model.root.userData.blocks;
  for (const mesh of [cFront, cBack]) {
    assert.equal(mesh.userData.seeThrough, true);
    assert.equal([mesh.material].flat()[0].transparent, true);
  }
  assert.notEqual(crankArm.userData.seeThrough, true);
  disposeObject3D(model.root);
});
