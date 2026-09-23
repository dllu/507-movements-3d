import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeMovementModel } from '../src/simulation/dispose-model.js';

const movements = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url))).movements;
const LANE = [326, 327, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 344, 345];
const bounds = (object) => new THREE.Box3().setFromObject(object, true);
const period = (model) => model.root.userData.animationTiming?.authoredCyclePeriod ?? 4;

test('engines 326-345: plate-front camera and no undrawn index, explanatory or transparent parts', () => {
  for (const id of LANE) {
    const model = createMovementModel(movements[id - 1]);
    try {
      const d = model.cameraDirection;
      assert.ok(d.z > 20 * Math.abs(d.x) && d.z > 20 * Math.abs(d.y), `${id} views the plate face-on`);
      assert.ok(d.x > 0 && d.y > 0, `${id} keeps a slight three-quarter lift`);
      model.root.traverse((object) => {
        if (!object.isMesh) return;
        assert.doesNotMatch(object.userData.role ?? '', /index|explanatory|transparent/i,
          `${id}: ${object.userData.role} is not drawn by Brown`);
      });
    } finally { disposeMovementModel(model); }
  }
});

test('327: flywheel runs behind the crossbeam and columns for the whole revolution', () => {
  const model = createMovementModel(movements[326]);
  try {
    const b = model.root.userData.blocks;
    const fixed = [b.topBeam, ...b.topBeamBands, b.leftGuideBarA, b.rightGuideBarA];
    const rotating = [b.flywheelRim, ...b.flywheelSpokes];
    for (let i = 0; i <= 32; i += 1) {
      model.update(period(model) * i / 32); model.root.updateMatrixWorld(true);
      for (const part of rotating) for (const frame of fixed) {
        assert.ok(bounds(part).max.z < bounds(frame).min.z, `${part.userData.role} clears ${frame.userData.role}`);
      }
    }
    // Negative control: at the former flywheel plane the rim overlaps the columns.
    b.flywheel.position.z += 0.10; model.root.updateMatrixWorld(true);
    assert.ok(fixed.some((frame) => bounds(b.flywheelRim).intersectsBox(bounds(frame))),
      'the clearance check detects a rim moved into the frame plane');
  } finally { disposeMovementModel(model); }
});

for (const id of [344, 345]) test(`${id}: crank pin stays coaxial in the rod eye and clear of its bore`, () => {
  const model = createMovementModel(movements[id - 1]);
  try {
    const b = model.root.userData.blocks;
    const pinRadius = b.crankPin.geometry.parameters.radiusTop;
    const ray = new THREE.Raycaster();
    const hitsEye = (center) => {
      for (let n = 0; n < 24; n += 1) {
        ray.set(new THREE.Vector3(center.x + pinRadius * Math.cos(n * Math.PI / 12),
          center.y + pinRadius * Math.sin(n * Math.PI / 12), 10), new THREE.Vector3(0, 0, -1));
        if (ray.intersectObject(b.pistonCrankEye, false).length) return true;
      }
      return false;
    };
    for (let i = 0; i <= 32; i += 1) {
      model.update(period(model) * i / 32); model.root.updateMatrixWorld(true);
      const pin = b.crankPin.getWorldPosition(new THREE.Vector3());
      const eye = b.pistonCrankEye.getWorldPosition(new THREE.Vector3());
      assert.ok(Math.hypot(pin.x - eye.x, pin.y - eye.y) < 1e-12, 'pin and eye share axis P');
      const pinBox = bounds(b.crankPin), eyeBox = bounds(b.pistonCrankEye);
      assert.ok(pinBox.min.z <= eyeBox.min.z && pinBox.max.z >= eyeBox.max.z, 'pin spans the eye');
      assert.equal(hitsEye(pin), false, 'pin passes through a real bore');
      // Negative control: the same pin offset by 0.02 would cut the eye.
      assert.equal(hitsEye(pin.clone().add(new THREE.Vector3(0.02, 0, 0))), true);
    }
  } finally { disposeMovementModel(model); }
});
