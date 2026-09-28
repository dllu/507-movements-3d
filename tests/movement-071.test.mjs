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
// Signed distance from a point to a polygon ring (negative inside).
const ringDistance = (ring, point) => {
  let distance = Infinity;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length > 0 ? THREE.MathUtils.clamp(((point.x - ax) * dx + (point.y - ay) * dy) / length, 0, 1) : 0;
    distance = Math.min(distance, Math.hypot(point.x - ax - t * dx, point.y - ay - t * dy));
    if ((ay > point.y) !== (by > point.y) && point.x < ax + dx * (point.y - ay) / dy) inside = !inside;
  }
  return inside ? -distance : distance;
};
// How far a stud circle reaches into B's actual rim pieces.
const rimPenetration = (geometry, driverAngle, stud, regions = geometry.guardRimRegions) => {
  const local = stud.clone().rotateAround(new THREE.Vector2(), -driverAngle);
  let penetration = 0;
  for (const region of regions) {
    penetration = Math.max(penetration, geometry.studRadius - ringDistance(region[0], local));
  }
  return penetration;
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
  const stages = new Set();
  let minimumOtherClearance = Infinity;
  let maximumPenetration = 0;
  let first = null;
  let last = null;
  let mouthSamples = 0;
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
      // While a slit mouth passes the upper lock stud, the lower one still
      // bears on rim material, so C is never free beyond the lock play.
      const onRim = (index) => {
        const bearing = state.planarStud(index).clone()
          .rotateAround(new THREE.Vector2(), -state.driverAngle);
        bearing.setLength(geometry.guardInnerRadius + 0.004);
        return geometry.guardRimRegions.some((region) => ringDistance(region[0], bearing) < 0);
      };
      const lowerIndex = THREE.MathUtils.euclideanModulo(upper.index - 2, geometry.studCount);
      assert.ok(onRim(upper.index) || onRim(lowerIndex), 'a lock stud bears on rim material');
      if (!onRim(upper.index)) mouthSamples += 1;
      const lower = state.planarStud(THREE.MathUtils.euclideanModulo(
        upper.index - 2, geometry.studCount,
      ));
      assert.ok(Math.abs(geometry.guardInnerRadius - lower.length()
        - geometry.studRadius - geometry.lockPlay) < 1e-9);
    }
    for (let index = 0; index < geometry.studCount; index += 1) {
      const stud = state.planarStud(index);
      maximumPenetration = Math.max(maximumPenetration,
        rimPenetration(geometry, state.driverAngle, stud));
      if (index !== state.activeStudIndex) {
        minimumOtherClearance = Math.min(minimumOtherClearance,
          tappetClearance(geometry, state.driverAngle, stud));
      }
    }
  });
  assert.deepEqual([...stages].sort(),
    ['guard-locked', 'tappet-flank-push', 'tappet-tip-push']);
  assert.ok(mouthSamples < 200, `upper lock stud over a slit mouth in ${mouthSamples} of 3001 samples`);
  assert.ok(maximumPenetration < 1e-9, `studs only cross the rim through the slit channels: ${maximumPenetration}`);
  assert.ok(Math.abs(minimumOtherClearance - geometry.lockPlay) < 1e-6,
    'the tappet passes the lock studs with the lock play as clearance');
  assert.ok(Math.abs(last.driverAngle - first.driverAngle - FULL_TURN) < 1e-9);
  assert.ok(Math.abs(last.drivenAngle - first.drivenAngle + geometry.studPitch) < 1e-9);
});

test('movement 71 checks reject a trailing push, a long tappet and an uncut rim', () => {
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
  let uncutPenetration = 0;
  // Control: a rim without the slits (the full annulus between the guard
  // radii) is struck by the crossing studs.
  const uncutRimPenetration = (driverAngle, stud) => {
    const distance = stud.length();
    return Math.max(0, Math.min(
      distance + geometry.studRadius - geometry.guardInnerRadius,
      geometry.guardOuterRadius - distance + geometry.studRadius,
    ));
  };
  sampleCycle(model, 1500, (sample) => {
    for (let index = 0; index < geometry.studCount; index += 1) {
      const stud = sample.planarStud(index);
      if (index !== sample.activeStudIndex) {
        longTappetClearance = Math.min(longTappetClearance, tappetClearance(
          geometry, sample.driverAngle, stud,
          geometry.tappetLength + geometry.lockPlay + 0.02,
        ));
      }
      uncutPenetration = Math.max(uncutPenetration,
        uncutRimPenetration(sample.driverAngle, stud));
    }
  });
  assert.ok(longTappetClearance < -0.01);
  assert.ok(uncutPenetration > 0.01);
});

test('movement 71 cuts plain slits that leave no knife-edge rim tips', () => {
  const { geometry } = build().root.userData;
  // Every radial line through the rim meets either no material, the full
  // rim, or a piece at least nearly minimumRimTip thick.
  let thinnest = Infinity;
  for (let sample = 0; sample < 7200; sample += 1) {
    const angle = FULL_TURN * (sample + 0.37) / 7200;
    const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const crossings = [];
    for (const region of geometry.guardRimRegions) {
      const ring = region[0];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const a = new THREE.Vector2(...ring[j]);
        const b = new THREE.Vector2(...ring[i]);
        const edge = b.clone().sub(a);
        const denominator = cross(direction, edge);
        if (Math.abs(denominator) < 1e-14) continue;
        const t = cross(a, edge) / denominator;
        const u = cross(a, direction) / denominator;
        if (t > 0 && u >= 0 && u < 1) crossings.push(t);
      }
    }
    crossings.sort((a, b) => a - b);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      thinnest = Math.min(thinnest, crossings[index + 1] - crossings[index]);
    }
  }
  assert.ok(thinnest > geometry.minimumRimTip * 0.9, `thinnest rim piece ${thinnest}`);
  assert.equal(geometry.guardRimRegions.length, 2);
  for (const region of geometry.guardRimRegions) assert.equal(region.length, 1);
});
