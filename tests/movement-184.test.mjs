import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';
import { upperFreeStop } from '../src/simulation/quadrant-catch-finite-parts.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

test('movement 184 opens at the top of the stroke with the lower handle latched raised', () => {
  const movement = catalog.movements[183];
  assert.equal(movement.id, 184);
  const model = createMovementModel(movement), d = model.root.userData;
  assert.equal(d.fidelity, 'authored');
  assert.match(d.mechanism, /^top-position-descending/);
  const s = d.stateAtTime(0);
  assert.ok(Math.abs(s.phase - 0.5) < 1e-9);
  assert.equal(s.upperAngle, upperFreeStop);
  assert.ok(s.lowerAngle > 52);
  assert.equal(s.lowerLatchedByUpperQuadrant, true);
  // It then descends and trips the upper handle.
  assert.ok(d.stateAtTime(3).tappetTop > s.tappetTop);
  assert.ok(d.stateAtTime(4).upperAngle < upperFreeStop);
  const other = createMovementModel(catalog.movements[182]).root.userData;
  assert.notEqual(other.mechanism, d.mechanism);
});
