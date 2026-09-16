import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredDoubleStrokeSlotMovement } from '../src/simulation/authored-double-stroke-slots.js';
import { createAuthoredSlottedTraverseMovement } from '../src/simulation/authored-slotted-traverses.js';
import { createAuthoredUniformGrooveCrossheadMovement } from '../src/simulation/authored-uniform-groove-crossheads.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
const bounds = object => new THREE.Box3().setFromObject(object, true);
const ray = new THREE.Raycaster();
function clearsPin(pin, members, radius = pin.geometry.parameters.radiusTop) {
  const center = pin.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < 16; i += 1) {
    ray.set(new THREE.Vector3(center.x + radius * Math.cos(i * Math.PI / 8),
      center.y + radius * Math.sin(i * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
    for (const member of members) assert.equal(ray.intersectObject(member, true).length, 0,
      `${pin.userData.role} clears ${member.userData.role}`);
  }
}

test('348: both finite shoes clear the cross-slot walls and engage the disk depth', () => {
  const { root, update } = createAuthoredDoubleStrokeSlotMovement({ id: 348 });
  const b = root.userData.blocks;
  for (let sample = 0; sample <= 128; sample += 1) {
    update(4 * sample / 128); root.updateMatrixWorld(true);
    const disk = bounds(b.slottedDisk);
    for (const slide of [b.primarySlide, b.secondarySlide]) {
      const box = bounds(slide.block);
      assert.ok(box.min.z > disk.min.z && box.max.z < disk.max.z);
      assert.ok(bounds(b.inputShaft).max.z < box.min.z);
      for (const floor of b.slotFloors) assert.ok(bounds(floor).max.z < box.min.z);
      const { width, height } = slide.block.geometry.parameters;
      for (const x of [-width / 2, 0, width / 2]) for (const y of [-height / 2, 0, height / 2]) {
        const point = new THREE.Vector3(x, y, 0).applyMatrix4(slide.block.matrixWorld);
        ray.set(new THREE.Vector3(point.x, point.y, 10), new THREE.Vector3(0, 0, -1));
        for (const wall of [b.slottedDisk, ...b.slotEdges]) assert.equal(ray.intersectObject(wall, true).length, 0);
      }
      clearsPin(slide.pivotPin, [b.rodBody, b.rodLowerCap]);
    }
    const pin = bounds(b.guideRoller), guides = b.guideRails.map(bounds);
    assert.ok(pin.min.x > guides[0].max.x && pin.max.x < guides[1].min.x);
    assert.ok(pin.min.z <= guides[0].min.z && pin.max.z >= guides[0].max.z);
  }
  disposeObject3D(root);
});

test('350: all three real pins clear the lever and central joint solids over a full traverse', () => {
  const { root, update } = createAuthoredSlottedTraverseMovement({ id: 350 });
  const b = root.userData.blocks;
  const lever = [b.upperSlottedEnd, b.lowerSlottedEnd, b.upperNeck, b.lowerNeck, b.centerBoss];
  for (let sample = 0; sample <= 128; sample += 1) {
    update(4 * sample / 128); root.updateMatrixWorld(true);
    clearsPin(b.fixedPinO, lever);
    clearsPin(b.movingPinD, lever);
    clearsPin(b.centralJointPin, [...lever, b.outputJointBoss, b.jointToRiser]);
    const pin = bounds(b.centralJointPin);
    for (const member of [b.centerBoss, b.outputJointBoss]) {
      const box = bounds(member);
      assert.ok(pin.min.z < box.min.z && pin.max.z > box.max.z);
    }
  }
  disposeObject3D(root);
});

test('350: input shoe and output bar are inside their guides without solid overlap', () => {
  const { root, update } = createAuthoredSlottedTraverseMovement({ id: 350 });
  const b = root.userData.blocks;
  for (let sample = 0; sample <= 64; sample += 1) {
    update(4 * sample / 64); root.updateMatrixWorld(true);
    const shoe = bounds(b.inputShoe), inputRails = b.inputGuideRail.children.map(bounds);
    assert.ok(shoe.min.y > inputRails[0].max.y && shoe.max.y < inputRails[1].min.y);
    assert.ok(shoe.min.z > inputRails[0].min.z && shoe.max.z < inputRails[0].max.z);
    const bar = bounds(b.outputRail);
    for (const guide of b.outputGuideAssemblies) {
      const lips = guide.lips.map(bounds);
      assert.ok(bar.min.y > lips[0].max.y && bar.max.y < lips[1].min.y);
      assert.ok(bar.min.z > lips[0].min.z && bar.max.z < lips[0].max.z);
      assert.ok(bounds(guide.upright).max.z < bar.min.z);
    }
  }
  disposeObject3D(root);
});

test('354: finite wrist clears the actual milled groove including both reversal pockets', () => {
  const { root, update } = createAuthoredUniformGrooveCrossheadMovement({ id: 354 });
  const b = root.userData.blocks;
  assert.ok(b.yokeBody.geometry.userData.plate.polygons.length > 1,
    'the endless through-groove separates its inner island from the outer land');
  const g = root.userData.geometry;
  const times = Array.from({ length: 513 }, (_, sample) => 8 * sample / 512);
  times.push(-g.sourcePoseAngle / g.inputAngularSpeed,
    (Math.PI - g.sourcePoseAngle) / g.inputAngularSpeed);
  for (const time of times) {
    update(time); root.updateMatrixWorld(true);
    clearsPin(b.crankWrist, [b.yokeBody]);
    clearsPin(b.wristCap, b.islandRetainer.children.slice(0, 2));
    assert.ok(bounds(b.islandRetainer.children[2]).min.z > bounds(b.wristCap).max.z);
    const pin = bounds(b.crankWrist), yoke = bounds(b.yokeBody);
    assert.ok(pin.min.z < yoke.min.z && pin.max.z > yoke.max.z);
  }
  disposeObject3D(root);
});

test('354: continuous output stems clear the crank disk and occupy their guide depth', () => {
  const { root, update } = createAuthoredUniformGrooveCrossheadMovement({ id: 354 });
  const b = root.userData.blocks;
  for (let sample = 0; sample <= 64; sample += 1) {
    update(8 * sample / 64); root.updateMatrixWorld(true);
    const yoke = bounds(b.yokeBody);
    for (const stem of [b.lowerStem, b.upperStem]) {
      const solid = bounds(stem);
      assert.ok(solid.min.z < yoke.max.z && solid.max.z > yoke.min.z);
      for (const crank of [b.diskBody, b.inputShaft, b.shaftHub, b.hubFace]) {
        assert.ok(bounds(crank).max.z < solid.min.z);
      }
      const side = stem === b.lowerStem ? -1 : 1;
      for (const cheek of b.guideCheeks.filter(part => part.userData.sideY === side)) {
        const guide = bounds(cheek);
        assert.ok(guide.min.z < solid.min.z && guide.max.z > solid.max.z);
        assert.ok(solid.min.y < guide.min.y && solid.max.y > guide.max.y);
      }
    }
  }
  disposeObject3D(root);
});
