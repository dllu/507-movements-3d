import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { upperFreeStop } from '../src/simulation/quadrant-catch-finite-parts.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

test('movement 184 shows the 183 gear reflected top to bottom, tappet at the top descending onto the upper handle', () => {
  const movement = catalog.movements[183];
  assert.equal(movement.id, 184);
  const model = createMovementModel(movement), d = model.root.userData;
  const m183 = createMovementModel(catalog.movements[182]).root.userData;
  assert.equal(d.fidelity, 'authored');
  assert.match(d.mechanism, /^top-position-descending/);
  // Plate 184 is plate 183 flipped top to bottom: the same solved pose,
  // presented through one top-to-bottom reflection of the whole gear.
  const reflection = d.blocks.plate184Reflection;
  assert.ok(reflection && reflection.parent === model.root);
  assert.deepEqual(reflection.scale.toArray(), [1, -1, 1]);
  assert.equal(model.root.children.length, 1);
  const s = d.stateAtTime(0), s183 = m183.stateAtTime(0);
  assert.equal(s.phase, s183.phase);
  assert.equal(s.upperAngle, s183.upperAngle);
  assert.equal(s.lowerAngle, s183.lowerAngle);
  // In the reflected view the tappet stands by the upper shaft and moves
  // down (source y grows upward in the flipped view) onto the upper handle.
  const tappetY = (t) => { model.update(t); model.root.updateMatrixWorld(true); return d.blocks.tappet.getWorldPosition(new THREE.Vector3()).y; };
  // The ball-lever shaft (183's lower one) is the upper shaft in this view.
  const ballShaftY = () => d.blocks.lowerShaft.getWorldPosition(new THREE.Vector3()).y;
  const hookShaftY = () => d.blocks.upperShaft.getWorldPosition(new THREE.Vector3()).y;
  const y0 = tappetY(0);
  assert.ok(ballShaftY() > hookShaftY());
  assert.ok(Math.abs(y0 - ballShaftY()) < Math.abs(y0 - hookShaftY()));
  assert.ok(tappetY(0.2) < y0);
  assert.ok(upperFreeStop > 0);
  assert.notEqual(m183.mechanism, d.mechanism);
});
