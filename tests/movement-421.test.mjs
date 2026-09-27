import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredTrunkEngineMovement } from '../src/simulation/authored-trunk-engines.js';
import { solidSurface } from './helpers/solid-surface.mjs';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements.find((m) => m.id === 421);

test('421: the piston is closed under the pitman pin, and the trunk is one casting with it', () => {
  const model = createAuthoredTrunkEngineMovement(movement);
  try {
    const u = model.root.userData;
    const b = u.blocks;
    const g = u.geometry;
    const socket = solidSurface(b.trunkBack.geometry);
    const body = solidSurface(b.piston.geometry);
    const inside = (p) => socket.inside(p) || body.inside(p);
    // straight below the pin, through the back half, is solid metal down to
    // the piston's underside: steam below cannot reach the trunk
    for (const z of [-0.02, -0.2, -0.45]) {
      let solid = 0;
      for (let y = -0.44; y > -0.54; y -= 0.02) if (inside(new THREE.Vector3(0, y, z))) solid += 1;
      assert.ok(solid >= 4, `closed under the pin at z ${z}`);
      if (Math.abs(z) < g.socketRadius - 0.1) assert.ok(!inside(new THREE.Vector3(0, -0.2, z)), 'the pin socket is hollow');
    }
    // the trunk wall and piston body reach the cylinder bore
    assert.ok(inside(new THREE.Vector3(-0.59, 1.0, -0.05)), 'trunk wall');
    assert.ok(inside(new THREE.Vector3(0, 0, -(g.pistonRadius - 0.05))));
    assert.equal(b.piston.parent, b.pistonAndTrunk);
    assert.equal(b.trunkBack.parent, b.pistonAndTrunk);
  } finally { disposeObject3D(model.root); }
});

test('421: high-pressure steam works above on the down-stroke and expansively below on the up-stroke', () => {
  const model = createAuthoredTrunkEngineMovement(movement);
  try {
    const u = model.root.userData;
    const period = u.animationTiming.authoredCyclePeriod;
    for (let i = 0; i <= 64; i += 1) {
      const t = i / 64 * period;
      model.update(t);
      const state = u.stateAtTime(t);
      const steam = u.steamStateAt(state);
      const cosine = Math.abs(Math.cos(state.crankAngle));
      if (cosine > 0.3) {
        if (state.pistonSpeed < 0) {
          assert.equal(steam.upperPressure, 1, 'high-pressure steam above on the down-stroke');
          assert.equal(steam.lowerPressure, 0, 'the space below exhausts');
        } else {
          assert.ok(steam.lowerPressure > 0.5 && steam.lowerPressure < 1, 'steam below works expansively');
          assert.ok(Math.abs(steam.upperPressure - steam.lowerPressure) < 1e-9, 'one body of steam above and below');
        }
      }
      assert.ok(u.blocks.upperSteam.scale.y > 0 && u.blocks.lowerSteam.scale.y > 0);
    }
    assert.ok(u.pressureStaging.highToExpansivePressureRatio > 1.3, 'the trunk takes a large share of the upper area');
    const roles = [];
    model.root.traverse((o) => { if (o.userData.role) roles.push(o.userData.role); });
    for (const banned of [/foundation/, /support/, /white/, /indicator/]) assert.ok(!roles.some((r) => banned.test(r)), String(banned));
  } finally { disposeObject3D(model.root); }
});
