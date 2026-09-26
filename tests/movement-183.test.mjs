import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';
import { PL, PU, studs } from '../src/simulation/quadrant-catch-finite-parts.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

test('movement 183 opens on the ascending stroke in the plate pose', () => {
  const movement = catalog.movements[182];
  assert.equal(movement.id, 183);
  const model = createMovementModel(movement), d = model.root.userData;
  assert.equal(d.fidelity, 'authored');
  assert.match(d.mechanism, /^ascending-piston-tappet/);
  const s = d.stateAtTime(0);
  // Plate 183: hatched tappet top at y 330, below the lower handle, moving up.
  assert.ok(Math.abs(s.tappetTop - 330) < 0.1);
  assert.ok(d.stateAtTime(0.2).tappetTop < s.tappetTop);
  assert.equal(s.lowerAngle, 0);
  assert.ok(s.upperAngle >= 0 && s.upperAngle < 1, `upper ${s.upperAngle}`);
  assert.equal(s.upperLatchedByLowerQuadrant, true);
  // Plate-measured pivots and the hidden upper stud behind the lower quadrant.
  assert.deepEqual([...PU], [275, 128]);
  assert.deepEqual([...PL], [283, 353]);
  assert.deepEqual([...studs.upper], [238, 265]);
  // Brown draws no markers and no weights: the back-weight rods run straight
  // out of the view. The reconstructed back bar, rod guide and cylinder are
  // not presented (p60 support policy).
  const roles = [];
  model.root.traverse((o) => { if (o.isMesh) roles.push(o.userData.role); });
  assert.ok(!roles.some((r) => /marker|index|gravity-weight/.test(r)), roles.join());
  assert.ok(!roles.some((r) => /fixed-back-bar|fixed-piston-rod-guide|fixed-steam-cylinder|fixed-handle-shaft-boss/.test(r)), roles.join());
  assert.ok(!roles.some((r) => /-back-weight$/.test(r)), 'no undrawn weights');
  assert.ok(roles.includes('upper-back-weight-rod'));
});

test('movements 183 and 184 back-weight rods run out of the view and end below it in every pose', async () => {
  const THREE = await import('three');
  for (const index of [182, 183]) {
    const model = createMovementModel(catalog.movements[index]), d = model.root.userData;
    const fit = d.cameraFitBounds, period = d.geometry.cyclePeriod;
    for (let i = 0; i <= 48; i += 1) {
      model.update(period * i / 48);
      model.root.updateMatrixWorld(true);
      for (const rod of [d.blocks.upperWeightRod, d.blocks.lowerWeightRod]) {
        const box = new THREE.Box3().setFromObject(rod);
        assert.ok(box.min.y < fit.min.y - 0.2, `${index + 1} ${rod.userData.role} ends inside the view at ${i}`);
      }
    }
  }
});
