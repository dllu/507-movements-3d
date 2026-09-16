import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredOrthogonalRollerIndexerMovement } from '../src/simulation/authored-orthogonal-roller-indexers.js';
import { surfacePoints, solidSurface } from './helpers/solid-surface.mjs';

const model = createAuthoredOrthogonalRollerIndexerMovement({ id: 364 });
const data = model.root.userData;
const blocks = data.blocks;

test('364 finite grooved wheel clears its rollers without losing nearby working faces', () => {
  const field = solidSurface(blocks.outputWheel.geometry);
  const points = blocks.rollerBodies.map(mesh => surfacePoints(mesh.geometry));
  let minimum = Infinity;
  let maximumWorkingGap = -Infinity;
  // Include the old penetrating witness and the smallest-clearance pose from
  // an independent 257-pose shifted-phase sweep, plus both dwell boundaries.
  const times = [...Array.from({length: 65}, (_, i) => i / 64),
    .296875, .23582421875, .36 - 1e-6, .36 + 1e-6, .64 - 1e-6, .64 + 1e-6];
  for (const time of times) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = data.stateAtTime(time);
    let activeGap = Infinity;
    for (let k = 0; k < blocks.rollerBodies.length; k++) {
      const transform = blocks.outputWheel.matrixWorld.clone().invert()
        .multiply(blocks.rollerBodies[k].matrixWorld);
      for (const point of points[k]) {
        const sample = point.clone().applyMatrix4(transform);
        if (field.box.distanceToPoint(sample) > 0.04) continue;
        const gap = field.signedDistance(sample);
        minimum = Math.min(minimum, gap);
        if (k === state.activeRollerIndex) activeGap = Math.min(activeGap, gap);
      }
    }
    if (state.engaged) maximumWorkingGap = Math.max(maximumWorkingGap, activeGap);
  }
  assert.ok(minimum > 0, `finite mesh clearance ${minimum}`);
  assert.ok(maximumWorkingGap < 0.0022, `working wall proximity ${maximumWorkingGap}`);
  assert.equal(blocks.outputWheel.geometry.userData.clearance, 0.002);
  assert.match(data.reconstructionNote, /clear.*sampled surface checks/);
  console.log({id: 364, minimumRollerToWheelGap: minimum, maximumWorkingGap});
});

test('364 actual wheel surfaces remain outside conservative finite roller cylinders', () => {
  const points = surfacePoints(blocks.outputWheel.geometry);
  const sample = new THREE.Vector3();
  let minimum = Infinity, queries = 0;
  for (let i = 0; i <= 64; i++) {
    model.update((i + .273) / 64);
    model.root.updateMatrixWorld(true);
    for (const roller of blocks.rollerBodies) {
      const transform = roller.matrixWorld.clone().invert().multiply(blocks.outputWheel.matrixWorld);
      const bounds = new THREE.Box3(new THREE.Vector3(-.126, -.176, -.126),
        new THREE.Vector3(.126, .176, .126)).applyMatrix4(
        blocks.outputWheel.matrixWorld.clone().invert().multiply(roller.matrixWorld));
      for (const point of points) {
        if (!bounds.containsPoint(point)) continue;
        sample.copy(point).applyMatrix4(transform);
        // A full ideal cylinder contains the faceted, bored rendered roller.
        // Clearance outside it is a conservative reverse-direction check.
        const radial = Math.hypot(sample.x, sample.z) - .125;
        const axial = Math.abs(sample.y) - .175;
        const gap = Math.hypot(Math.max(radial, 0), Math.max(axial, 0))
          + Math.min(Math.max(radial, axial), 0);
        minimum = Math.min(minimum, gap);
        queries++;
      }
    }
  }
  assert.ok(queries > 100000);
  assert.ok(minimum > 0, `wheel / conservative roller clearance ${minimum}`);
  console.log({id: 364, minimumWheelToRollerGap: minimum, queries});
});

test('364 preserves bored finite rollers, running shafts and allocation-stable readable playback', () => {
  const first = blocks.rollerBodies[0];
  const stud = blocks.radialStuds[0];
  const field = solidSurface(first.geometry);
  model.update(0);
  model.root.updateMatrixWorld(true);
  const transform = first.matrixWorld.clone().invert().multiply(stud.matrixWorld);
  let gap = Infinity;
  for (const point of surfacePoints(stud.geometry)) {
    const sample = point.clone().applyMatrix4(transform);
    if (field.box.distanceToPoint(sample) < 0.01) gap = Math.min(gap, field.signedDistance(sample));
  }
  assert.ok(gap > 0, `stud / roller bore ${gap}`);
  assert.equal(blocks.outputWheel.geometry.userData.boreRadius, 0.108);
  const before = [];
  model.root.traverse(object => before.push([object, object.geometry]));
  for (let i = 0; i < 32; i++) { data.stateAtTime(i * 0.17); model.update(i * 0.17); }
  const after = [];
  model.root.traverse(object => after.push([object, object.geometry]));
  assert.deepEqual(after, before);
  assert.equal(data.minimumDisplayCycleSeconds, 8);
  assert.equal(data.hideGround, true);
  model.root.traverse(object => {
    for (const material of [].concat(object.material ?? [])) assert.equal(material.fog, false);
  });
});
