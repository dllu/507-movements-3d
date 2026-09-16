import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredOffsetCrankSlotMovement } from '../src/simulation/authored-offset-crank-slots.js';
import { createAuthoredCrankMovement } from '../src/simulation/authored-cranks.js';
import { disposeMovementModel as disposeModel } from '../src/simulation/dispose-model.js';

const makeModel = (id) => id === 220
  ? createAuthoredOffsetCrankSlotMovement({ id })
  : createAuthoredCrankMovement({ id });

test('220 wrist roller clears the output hub and lies in the open slot at closest approach', () => {
  const model = makeModel(220);
  const { blocks, geometry, transmission } = model.root.userData;
  model.update((2 * Math.PI - geometry.sourceInputAngle) / transmission.inputAngularSpeed);
  model.root.updateMatrixWorld(true);
  const roller = blocks.slotFollowerRoller.getWorldPosition(new THREE.Vector3());
  const hub = blocks.outputHub.getWorldPosition(new THREE.Vector3());
  const radialDistance = Math.hypot(roller.x - hub.x, roller.y - hub.y);
  const materialGap = radialDistance - blocks.outputHub.geometry.parameters.radiusTop
    - blocks.slotFollowerRoller.geometry.parameters.radiusTop;
  assert.ok(materialGap > 0.07, `roller/hub material gap ${materialGap}`);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(roller.x, roller.y, 3), new THREE.Vector3(0, 0, -1),
  );
  assert.equal(ray.intersectObject(blocks.outputSlottedArm, false).length, 0);
  disposeModel(model);
});

test('230 shafts stop before either rod plane, including both dead-center poses', () => {
  const model = makeModel(230);
  const { blocks, geometry } = model.root.userData;
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    model.update((angle - geometry.sourcePoseAngle) / geometry.inputAngularSpeed);
    model.root.updateMatrixWorld(true);
    const front = new THREE.Box3().setFromObject(blocks.frontRod, true);
    const rear = new THREE.Box3().setFromObject(blocks.rearRod, true);
    for (const assembly of blocks.shafts) {
      const shaft = new THREE.Box3().setFromObject(assembly.userData.parts.shaft, true);
      assert.ok(front.min.z - shaft.max.z > 0.14, 'front rod clears shaft end');
      assert.ok(shaft.min.z - rear.max.z > 0.13, 'rear rod clears shaft end');
    }
  }
  disposeModel(model);
});

for (const id of [220, 230]) {
  test(`${id} full-turn visible geometry stays inside its framing bounds without fog or ground`, () => {
    const model = makeModel(id);
    const { cameraFitBounds, geometry, transmission } = model.root.userData;
    const period = id === 220 ? transmission.inputCyclePeriod : geometry.cyclePeriod;
    assert.equal(model.root.userData.hideGround, true);
    model.root.traverse((object) => {
      for (const material of [object.material].flat().filter(Boolean)) assert.equal(material.fog, false);
    });
    for (let sample = 0; sample <= 64; sample += 1) {
      model.update(period * sample / 64);
      model.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model.root, true);
      assert.ok(cameraFitBounds.containsBox(bounds), `framing misses geometry at sample ${sample}`);
    }
    disposeModel(model);
  });
}
