import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';
import { PL, PU, planes } from '../src/simulation/quadrant-catch-finite-parts.js';

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
  assert.equal(s.upperAngle, 0);
  assert.equal(s.upperLatchedByLowerQuadrant, true);
  assert.deepEqual([...PU], [275, 128]);
  assert.deepEqual([...PL], [283, 353]);
  const roles = [];
  model.root.traverse((o) => { if (o.isMesh) roles.push(o.userData.role); });
  // Brown draws no markers, weights, studs, lips, bosses or supports.
  assert.ok(!roles.some((r) => /marker|index|gravity-weight|stud|lip|catchBoss|boss|fixed-back-bar|guide|cylinder/i.test(r)), roles.join());
  assert.ok(roles.includes('upper-back-weight-rod'));
});

test('183: each part lies in the plane Brown\'s hidden lines give it', () => {
  const model = createMovementModel(catalog.movements[182]), b = model.root.userData.blocks;
  const z = (mesh) => { mesh.geometry.computeBoundingBox(); return [mesh.geometry.boundingBox.min.z, mesh.geometry.boundingBox.max.z]; };
  const near = (a, e) => Math.abs(a[0] - e[0]) < 1e-6 && Math.abs(a[1] - e[1]) < 1e-6;
  // The upper C-arm is dashed behind the lower quadrant; the upper weight arm
  // is dashed behind the wing; the lower weight arm behind the piston rod.
  assert.ok(near(z(b.upperArm), planes.A));
  assert.ok(near(z(b.upperWing), planes.F));
  assert.ok(near(z(b.lowerQuadrant), planes.F));
  assert.ok(near(z(b.lowerLever), planes.H));
  assert.ok(near(z(b.upperWeightArm), planes.B));
  assert.ok(near(z(b.lowerWeightArm), planes.W));
  assert.ok(planes.W[1] < planes.R[0] && planes.R[1] < planes.B[0] && planes.B[1] < planes.A[0]);
  // The weight rods hang behind their arms, not in the arms' planes.
  assert.ok(z(b.upperWeightRod)[1] < z(b.upperWeightArm)[0]);
  assert.ok(z(b.lowerWeightRod)[1] < z(b.lowerWeightArm)[0]);
  // Brown dashes working parts behind both quadrants: those are see-through.
  assert.ok(b.lowerQuadrant.userData.seeThrough && b.upperWing.userData.seeThrough);
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
      const rod = new THREE.Box3().setFromObject(d.blocks.pistonRod);
      assert.ok(rod.min.y < fit.min.y && rod.max.y > fit.max.y, `${index + 1} piston rod ends inside the view at ${i}`);
    }
  }
});
