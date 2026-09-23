import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const FULL_TURN = Math.PI * 2;
const build = () => createMovementModel(
  catalog.movements.find(({ id }) => id === 71),
);

const cross = (a, b) => a.x * b.y - a.y * b.x;
const tappetClearance = (geometry, driverAngle, stud, length = geometry.tappetLength) => {
  const direction = new THREE.Vector2(Math.cos(driverAngle), Math.sin(driverAngle));
  const projection = THREE.MathUtils.clamp(stud.dot(direction), 0, length);
  return stud.distanceTo(direction.multiplyScalar(projection))
    - geometry.tappetContactOffset;
};
const insideNotch = (angle, extent, start, end) => {
  const offset = (value) => THREE.MathUtils.euclideanModulo(value - start, FULL_TURN);
  const width = offset(end);
  return offset(angle - extent) <= width && offset(angle + extent) <= width;
};
const rimPenetration = (geometry, driverAngle, stud, notches) => {
  const local = stud.clone().rotateAround(new THREE.Vector2(), -driverAngle);
  const distance = local.length();
  if (distance + geometry.studRadius <= geometry.guardInnerRadius + 1e-9) return 0;
  if (distance - geometry.studRadius >= geometry.guardOuterRadius) return 0;
  const angle = Math.atan2(local.y, local.x);
  const extent = Math.asin(geometry.studRadius / distance);
  if (notches.some(([start, end]) => insideNotch(angle, extent, start, end))) return 0;
  return distance + geometry.studRadius - geometry.guardInnerRadius;
};
const sampleCycle = (model, count, visit) => {
  const { geometry, stateAtTime } = model.root.userData;
  const start = (geometry.contactStartDriverAngle - geometry.initialDriverAngle - 0.4)
    / geometry.driverAngularSpeed;
  for (let sample = 0; sample <= count; sample += 1) {
    visit(stateAtTime(start + geometry.driverCyclePeriod * sample / count));
  }
};

test('movement 71 draws B as a notched front plate over C without a frame', () => {
  const model = build();
  const { blocks, geometry } = model.root.userData;
  assert.equal(model.root.userData.mechanism,
    'internal-guard-three-stud-tappet-ten-stud-index');
  assert.equal(blocks.studs.length, 10);
  assert.equal(blocks.guardSegments.length, 2);
  for (const part of [blocks.tappet, blocks.driverBody, ...blocks.guardSegments]) {
    assert.equal(part.parent, blocks.driver.userData.rotor);
  }
  for (const stud of blocks.studs) assert.equal(stud.parent, blocks.driven.userData.rotor);
  let meshes = 0;
  model.root.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    assert.doesNotMatch(object.userData.role ?? '', /frame|post|rail|base|indicator/i);
  });
  assert.equal(meshes, 20);
  assert.equal(blocks.driverIndicator.isMesh, undefined);
  assert.equal(blocks.drivenIndicator.isMesh, undefined);

  model.root.updateMatrixWorld(true);
  const plate = new THREE.Box3().setFromObject(blocks.driverBody);
  const disk = new THREE.Box3().setFromObject(blocks.drivenBody);
  const tappet = new THREE.Box3().setFromObject(blocks.tappet);
  assert.ok(disk.max.z < tappet.min.z, 'the tappet runs in front of C’s disk');
  assert.ok(tappet.max.z <= plate.min.z + 1e-12, 'B’s plate covers the tappet');
  for (const stud of blocks.studs) {
    const bounds = new THREE.Box3().setFromObject(stud);
    assert.ok(bounds.max.z < plate.min.z, 'stud ends clear B’s plate');
    assert.ok(bounds.min.z < tappet.min.z && bounds.max.z > tappet.max.z - 0.05);
  }
  assert.ok(Math.abs(geometry.guardOuterRadius / geometry.centerDistance - 0.861) < 1e-12);
  assert.ok(Math.abs(geometry.drivenRadius / geometry.centerDistance - 0.79) < 1e-12);
  assert.ok(model.cameraDirection.z > Math.abs(model.cameraDirection.x) * 8);

  model.root.userData.setSectionView(true);
  assert.equal(blocks.driverBody.visible, false);
  model.root.userData.setSectionView(false);
  assert.equal(blocks.driverBody.visible, true);
});

test('movement 71 sizes the tappet and rim from the three-stud lock', () => {
  const { geometry } = build().root.userData;
  const { studDistance, restStudAngle, studPitch } = geometry;
  assert.ok(Math.abs(geometry.tappetLength + geometry.tappetContactOffset
    - studDistance(restStudAngle - studPitch)) < 1e-12,
  'the rounded tip releases the struck stud exactly one pitch on');
  assert.ok(Math.abs(geometry.guardInnerRadius - geometry.studRadius
    - studDistance(restStudAngle + studPitch)) < 1e-12);
  assert.ok(geometry.lockPlay > 0.03 && geometry.lockPlay < 0.08);
  assert.ok(studDistance(restStudAngle) + geometry.studRadius < geometry.tappetLength,
    'the struck stud is met by the flank, not the tip');
});

test('movement 71 pushes one stud one pitch per turn with a driving compressive contact', () => {
  const model = build();
  const { geometry } = model.root.userData;
  const notches = [
    [geometry.enteringNotchStart, geometry.enteringNotchEnd],
    [geometry.leavingNotchStart, geometry.leavingNotchEnd],
  ];
  const stages = new Set();
  let minimumOtherClearance = Infinity;
  let maximumPenetration = 0;
  let first = null;
  let last = null;
  sampleCycle(model, 3000, (state) => {
    first ??= state;
    last = state;
    stages.add(state.stage);
    if (state.contact) {
      assert.ok(state.contact.error < 1e-9);
      assert.ok(state.contact.normalVelocityError < 1e-9);
      assert.ok(state.contact.outputTorque < 0, 'the push turns C clockwise');
      assert.ok(state.contact.driverTorque <= 0, 'the stud resists B, so B does the work');
      assert.ok(state.drivenAngularSpeed <= 1e-12);
    } else {
      assert.equal(state.drivenAngularSpeed, 0);
      const [upper] = state.guardStudContacts;
      assert.ok(upper.error < 1e-12, 'the upper lock stud rests on the inner rim');
      const lower = state.planarStud(THREE.MathUtils.euclideanModulo(
        upper.index - 2, geometry.studCount,
      ));
      assert.ok(Math.abs(geometry.guardInnerRadius - lower.length()
        - geometry.studRadius - geometry.lockPlay) < 1e-9);
    }
    for (let index = 0; index < geometry.studCount; index += 1) {
      const stud = state.planarStud(index);
      maximumPenetration = Math.max(maximumPenetration,
        rimPenetration(geometry, state.driverAngle, stud, notches));
      if (index !== state.activeStudIndex) {
        minimumOtherClearance = Math.min(minimumOtherClearance,
          tappetClearance(geometry, state.driverAngle, stud));
      }
    }
  });
  assert.deepEqual([...stages].sort(),
    ['guard-locked', 'tappet-flank-push', 'tappet-tip-push']);
  assert.equal(maximumPenetration, 0, 'studs only cross the rim through notches');
  assert.ok(Math.abs(minimumOtherClearance - geometry.lockPlay) < 1e-6,
    'the tappet passes the lock studs with the lock play as clearance');
  assert.ok(Math.abs(last.driverAngle - first.driverAngle - FULL_TURN) < 1e-9);
  assert.ok(Math.abs(last.drivenAngle - first.drivenAngle + geometry.studPitch) < 1e-9);
});

test('movement 71 checks reject a trailing push, a long tappet and a narrow notch', () => {
  const model = build();
  const { geometry } = model.root.userData;
  const state = model.root.userData.stateAtTime(
    (geometry.contactStartDriverAngle - geometry.initialDriverAngle + 0.2)
      / geometry.driverAngularSpeed,
  );
  assert.equal(state.stage, 'tappet-flank-push');
  const direction = new THREE.Vector2(Math.cos(state.driverAngle), Math.sin(state.driverAngle));
  const normal = new THREE.Vector2(-direction.y, direction.x);
  const trailingPoint = direction.clone().multiplyScalar(0.8)
    .addScaledVector(normal, -geometry.tappetHalfWidth);
  assert.ok(cross(trailingPoint, normal) > 0,
    'a stud behind the trailing face would drive B instead of being driven');

  let longTappetClearance = Infinity;
  let narrowNotchPenetration = 0;
  const narrow = [
    [geometry.enteringNotchStart, geometry.enteringNotchEnd],
    [geometry.leavingNotchStart + 0.03, geometry.leavingNotchEnd - 0.03],
  ];
  sampleCycle(model, 1500, (sample) => {
    for (let index = 0; index < geometry.studCount; index += 1) {
      const stud = sample.planarStud(index);
      if (index !== sample.activeStudIndex) {
        longTappetClearance = Math.min(longTappetClearance, tappetClearance(
          geometry, sample.driverAngle, stud,
          geometry.tappetLength + geometry.lockPlay + 0.02,
        ));
      }
      narrowNotchPenetration = Math.max(narrowNotchPenetration,
        rimPenetration(geometry, sample.driverAngle, stud, narrow));
    }
  });
  assert.ok(longTappetClearance < -0.01);
  assert.ok(narrowNotchPenetration > 0.01);
});
