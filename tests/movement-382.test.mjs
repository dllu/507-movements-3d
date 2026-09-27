import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function angleNear(actual, expected, tolerance, message) {
  const error = THREE.MathUtils.euclideanModulo(
    actual - expected + Math.PI,
    FULL_TURN,
  ) - Math.PI;
  near(error, 0, tolerance, message);
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function quaternionNear(actual, expected, tolerance, message) {
  near(1 - Math.abs(actual.dot(expected)), 0, tolerance, message);
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 382 is one socketed elevating/yawing stem carrying one independently tilting framed mirror with two set-screw locks', () => {
  const movement = catalog.movements[381];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, locking } = data;

  assert.equal(movement.id, 382);
  assert.equal(movement.number, '382');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(
    movement.archetype,
    'socket-stem-yaw-elevation-hinged-tilt-stand',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-stem-slides-and-yaws/);
  assert.match(data.mechanism, /one-pillar-socket/);
  assert.match(data.mechanism, /one-horizontal-inclination-hinge/);
  assert.match(data.mechanism, /second-set-screw/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 3);
  assert.equal(degreesOfFreedom.lockedDegreesOfFreedom, 0);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(degreesOfFreedom.inputs.length, 3);
  assert.match(degreesOfFreedom.inputs[0], /translation/);
  assert.match(degreesOfFreedom.inputs[1], /yaw/);
  assert.match(degreesOfFreedom.inputs[2], /inclination/);
  assert.equal(locking.releasedForDemonstration, true);
  assert.equal(locking.tightenedSystemDegreesOfFreedom, 0);

  for (const component of [
    blocks.base,
    blocks.socketSetScrew,
    blocks.stem,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    ...blocks.baseTiers,
    blocks.pillar,
    blocks.socketBoreWitness,
  ]) assert.equal(component.parent, blocks.base);
  for (const component of [
    blocks.socketScrewCore,
    blocks.socketScrewKnob,
  ]) assert.equal(component.parent, blocks.socketSetScrew);
  for (const component of [
    blocks.hingeYoke,
    blocks.stemCore,
  ]) assert.equal(component.parent, blocks.stem);
  // Brown draws no white indices.
  assert.equal(blocks.stemHeightIndex.parent, null);
  assert.equal(blocks.mirrorNormalIndex.parent, null);
  for (const component of [
    ...blocks.hingeOuterBarrels,
    blocks.hingeSetScrew,
    blocks.mirrorTiltPivot,
  ]) assert.equal(component.parent, blocks.hingeYoke);
  assert.equal(blocks.centerHingeBarrel.parent, blocks.mirrorTiltPivot);
  assert.equal(blocks.mirrorAssembly.parent, blocks.mirrorTiltPivot);
  for (const component of [
    ...blocks.mirrorFrameBars,
    blocks.mirrorGlass,
  ]) assert.equal(component.parent, blocks.mirrorAssembly);
  assert.equal(blocks.baseTiers.length, 3);
  assert.equal(blocks.hingeOuterBarrels.length, 2);
  assert.equal(blocks.mirrorFrameBars.length, 1, 'one broad rounded frame');
  assert.equal(blocks.base.userData.fixed, true);
  assert.equal(blocks.socketSetScrew.userData.fixed, true);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-stepped-pedestal-and-socket-pillar',
    'sliding-and-yawing-inner-stem-released-by-socket-set-screw',
    'source-side-set-screw-locking-stem-height-and-yaw',
    'horizontal-hinge-pivot-varying-mirror-inclination',
    'source-hinge-set-screw-locking-mirror-inclination',
    'tilting-rectangular-framed-mirror-or-camera-platform',
    'glass-or-camera-mounting-plane',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 382 preserves every adjustment, both locks, camera-stand use, measured plate, and unavailable animation', () => {
  const movement = catalog.movements[381];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate382;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_382.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /raised or lowered/);
  assert.match(movement.description, /turned to the right or left/);
  assert.match(movement.description, /varied in its inclination/);
  assert.match(movement.description, /stem is fitted into a socket/);
  assert.match(movement.description, /secured by a set screw/);
  assert.match(movement.description, /set screw is applied to the hinge/);
  assert.match(movement.description, /photographic camera-stands/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingRangesOrScrewPitch,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /elevation, yaw, inclination/);
  assert.match(dynamics.treatment, /three rigid transforms/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.baseLeft.toArray(), [144, 497]);
  assert.deepEqual(plate.baseRight.toArray(), [373, 498]);
  assert.deepEqual(plate.hingeCenter.toArray(), [260, 178]);
  assert.deepEqual(plate.hingeSetScrewEnd.toArray(), [220, 179]);
  assert.deepEqual(plate.socketSetScrewEnd.toArray(), [323, 315]);
  assert.deepEqual(plate.mirrorFrameTop.toArray(), [286, 16]);
  assert.deepEqual(plate.mirrorFrameBottom.toArray(), [236, 317]);
  assert.deepEqual(plate.mirrorFrameLeft.toArray(), [132, 111]);
  assert.deepEqual(plate.mirrorFrameRight.toArray(), [406, 257]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence, /side socket screw/);
  assert.match(evidence.engravingEvidence, /horizontal hinge barrel/);
  assert.match(evidence.reconstructionDisclosure, /32-degree yaw/);
  assert.match(evidence.reconstructionDisclosure, /22-degree tilt/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 382 stem remains coaxial with positive socket clearance and insertion throughout height and yaw adjustment', () => {
  const model = createMovementModel(catalog.movements[381]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const socketLength = geometry.socketTopY - geometry.socketBottomY;

  assert.ok(geometry.socketRadialClearance > 0);
  near(geometry.socketBoreRadius - geometry.stemRadius,
    geometry.socketRadialClearance, 2e-17,
    'radial socket clearance');
  assert.match(transmission.socketConstraint, /exactly on the socket Y axis/);
  for (let sample = -1200; sample <= 2400; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod
      * sample / 1200);
    near(state.stemBottomY,
      state.stemExtension + geometry.stemBottomLocalY, 0,
      'stem lower end follows elevation');
    near(state.stemInsertionLength,
      geometry.socketTopY - state.stemBottomY, 0,
      'socket insertion length');
    assert.ok(state.stemBottomY > geometry.socketBottomY,
      'stem lower end remains inside socket bottom');
    assert.ok(state.stemBottomY < geometry.socketTopY,
      'stem lower end remains below socket mouth');
    assert.ok(state.stemInsertionLength > 0);
    assert.ok(state.stemInsertionLength < socketLength);
    near(state.hingeCenter.x, 0, 0, 'stem axis x');
    near(state.hingeCenter.z, 0, 0, 'stem axis z');
  }
  disposeModel(model.root);
});

test('movement 382 mirror world transform is exact elevation, yaw, hinge offset, and local tilt composition', () => {
  const model = createMovementModel(catalog.movements[381]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;

  assert.match(transmission.mirrorTransformLaw, /stem vertical translation/);
  assert.match(transmission.mirrorTransformLaw, /stem yaw/);
  assert.match(transmission.mirrorTransformLaw, /local hinge tilt/);
  assert.match(transmission.hingeAxisLaw, /yaws rigidly with the stem/);
  for (let sample = -1000; sample <= 2000; sample += 1) {
    const state = stateAtTime(geometry.demonstrationPeriod
      * sample / 1000);
    const expectedYaw = new THREE.Quaternion().setFromAxisAngle(
      Y_AXIS,
      state.yawAngle,
    );
    const expectedTilt = new THREE.Quaternion().setFromAxisAngle(
      X_AXIS,
      state.tiltAngle,
    );
    const expectedQuaternion = expectedYaw.clone().multiply(
      expectedTilt,
    );
    quaternionNear(state.mirrorQuaternion,
      expectedQuaternion, 5e-16,
      'composed mirror orientation');
    vectorNear(state.mirrorNormal,
      Z_AXIS.clone().applyQuaternion(expectedQuaternion), 0,
      'mirror normal');
    vectorNear(state.hingeAxis,
      X_AXIS.clone().applyQuaternion(expectedYaw), 0,
      'moving horizontal hinge axis');
    vectorNear(state.mirrorCenter,
      geometry.mirrorCenterLocal.clone()
        .applyQuaternion(expectedQuaternion)
        .add(state.hingeCenter),
      0, 'composed mirror center');
    near(state.mirrorNormal.length(), 1, 4e-16,
      'unit mirror normal');
    near(state.hingeAxis.length(), 1, 4e-16,
      'unit hinge axis');
    near(state.mirrorNormal.dot(state.hingeAxis), 0, 4e-16,
      'mirror normal remains perpendicular to hinge');
  }
  disposeModel(model.root);
});

test('movement 382 three smooth adjustment schedules are derivative-consistent and span both directions', () => {
  const model = createMovementModel(catalog.movements[381]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const step = 1e-6;
  let minimumExtension = Infinity;
  let maximumExtension = -Infinity;
  let minimumYaw = Infinity;
  let maximumYaw = -Infinity;
  let minimumTilt = Infinity;
  let maximumTilt = -Infinity;

  for (let sample = 0; sample <= 1440; sample += 1) {
    const time = geometry.demonstrationPeriod * sample / 1440;
    const state = stateAtTime(time);
    minimumExtension = Math.min(minimumExtension, state.stemExtension);
    maximumExtension = Math.max(maximumExtension, state.stemExtension);
    minimumYaw = Math.min(minimumYaw, state.yawAngle);
    maximumYaw = Math.max(maximumYaw, state.yawAngle);
    minimumTilt = Math.min(minimumTilt, state.tiltAngle);
    maximumTilt = Math.max(maximumTilt, state.tiltAngle);
    if (sample % 3 !== 0) continue;
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    near((after.stemExtension - before.stemExtension) / (2 * step),
      state.stemVerticalSpeed, 5e-10,
      'height derivative');
    near((after.yawAngle - before.yawAngle) / (2 * step),
      state.yawAngularSpeed, 6e-10,
      'yaw derivative');
    near((after.tiltAngle - before.tiltAngle) / (2 * step),
      state.tiltAngularSpeed, 7e-10,
      'tilt derivative');
  }
  near(minimumExtension,
    geometry.stemExtensionMean - geometry.stemExtensionAmplitude,
    2e-16, 'minimum elevation');
  near(maximumExtension,
    geometry.stemExtensionMean + geometry.stemExtensionAmplitude,
    2e-16, 'maximum elevation');
  near(minimumYaw, -geometry.yawAmplitude, 2e-16,
    'left yaw limit');
  near(maximumYaw, geometry.yawAmplitude, 2e-16,
    'right yaw limit');
  near(minimumTilt, -geometry.tiltAmplitude, 2e-16,
    'negative tilt limit');
  near(maximumTilt, geometry.tiltAmplitude, 2e-16,
    'positive tilt limit');
  disposeModel(model.root);
});

test('movement 382 lock metadata assigns two socket freedoms to one screw and one hinge freedom to the other', () => {
  const model = createMovementModel(catalog.movements[381]);
  const data = model.root.userData;
  const { blocks, locking } = data;

  assert.deepEqual(
    blocks.socketSetScrew.userData.lockedDegreesOfFreedom,
    ['stem vertical translation', 'stem yaw rotation'],
  );
  assert.deepEqual(
    blocks.hingeSetScrew.userData.lockedDegreesOfFreedom,
    ['mirror inclination about horizontal hinge'],
  );
  assert.match(locking.socketSetScrew, /both axial translation and yaw/);
  assert.match(locking.hingeSetScrew, /one inclination degree of freedom/);
  assert.equal(
    blocks.socketSetScrew.userData.lockedDegreesOfFreedom.length
      + blocks.hingeSetScrew.userData.lockedDegreesOfFreedom.length,
    3,
  );
  disposeModel(model.root);
});

test('movement 382 renderer binds stem elevation, yaw, and mirror tilt while both set-screw assemblies remain on their proper fixed halves', () => {
  const model = createMovementModel(catalog.movements[381]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const basePosition = blocks.base.position.clone();
  const socketScrewPosition = blocks.socketSetScrew.position.clone();
  const hingeScrewLocalPosition = blocks.hingeSetScrew.position.clone();

  for (let frame = 0; frame <= 720; frame += 1) {
    const time = geometry.demonstrationPeriod * 2 * frame / 720;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.stem.position.y, expected.stemExtension, 0,
      'rendered stem height');
    near(blocks.stem.rotation.y, expected.yawAngle, 0,
      'rendered stem yaw');
    near(blocks.mirrorTiltPivot.rotation.x, expected.tiltAngle, 0,
      'rendered mirror tilt');
    blocks.mirrorAssembly.updateMatrixWorld(true);
    vectorNear(blocks.mirrorAssembly.getWorldPosition(new THREE.Vector3()),
      expected.mirrorCenter, 8e-16,
      'rendered mirror center');
    quaternionNear(
      blocks.mirrorAssembly.getWorldQuaternion(new THREE.Quaternion()),
      expected.mirrorQuaternion,
      5e-16,
      'rendered mirror orientation',
    );
    vectorNear(blocks.base.position, basePosition, 0,
      'pedestal remains fixed');
    vectorNear(blocks.socketSetScrew.position,
      socketScrewPosition, 0,
      'socket screw remains fixed to pillar');
    vectorNear(blocks.hingeSetScrew.position,
      hingeScrewLocalPosition, 0,
      'hinge screw remains fixed to stem-side yoke');
    for (const residual of Object.values(data.constraintResiduals)) {
      near(residual, 0, 2e-16, 'renderer constraint residual');
    }
  }
  disposeModel(model.root);
});

test('movement 382 closes one elevation/yaw cycle and two tilt cycles before movement 507 remains the next authored draft', () => {
  const movement = catalog.movements[381];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.adjustmentPhase - start.adjustmentPhase, FULL_TURN, 0,
    'one unwrapped elevation/yaw cycle');
  near(closure.tiltPhase - start.tiltPhase,
    geometry.tiltFrequencyRatio * FULL_TURN, 0,
    'two unwrapped tilt cycles');
  angleNear(closure.yawAngle, start.yawAngle, 0,
    'yaw pose closes');
  angleNear(closure.tiltAngle, start.tiltAngle, 0,
    'tilt pose closes');
  near(closure.stemExtension, start.stemExtension, 1e-16,
    'elevation closes');
  vectorNear(closure.mirrorCenter, start.mirrorCenter, 6e-16,
    'mirror center closes');
  quaternionNear(closure.mirrorQuaternion,
    start.mirrorQuaternion, 4e-16,
    'mirror orientation closes');
  assert.equal(timeline.demonstrationPeriod,
    geometry.demonstrationPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.demonstrationPeriod);
  assert.equal(data.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.ok(Number.isFinite(data.groundFloorY));

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});

test('movement 382 set screw enters the tapped pillar neck and the mirror back is symmetric and moulded', () => {
  const model = createMovementModel(catalog.movements[381]);
  const { blocks } = model.root.userData;
  model.root.updateMatrixWorld(true);
  // The screw's axis is the neck hole's axis, and the neck is a straight
  // bored band between the vase and the bead collar.
  const hole = blocks.pillar.geometry.userData;
  const screwAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(blocks.socketSetScrew.quaternion);
  assert.ok(Math.abs(Math.atan2(screwAxis.x, screwAxis.z) - hole.holeTheta) < 1e-9, 'screw on the hole axis');
  assert.ok(Math.abs(blocks.socketSetScrew.position.y - hole.holeY) < 1e-12, 'screw at the hole height');
  const threadOuter = 0.079;
  assert.ok(hole.holeRadius > threadOuter && hole.holeRadius - threadOuter < 0.01, 'tapped hole fits the thread');
  assert.equal(blocks.socketBoss, undefined, 'no undrawn boss');
  // One turned pillar: the bore runs through, the neck is straight round
  // the hole, and the hole has a wall.
  const position = blocks.pillar.geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i));
    assert.ok(r > hole.boreRadius - 1e-5, 'bore stays open');
    if (Math.abs(position.getY(i) - hole.holeY) < 0.09) assert.ok(r < hole.outer + 1e-5, 'straight neck round the hole');
  }
  // Rays along the screw axis (and just inside the hole's edge) pass
  // through the neck wall and first meet the far side of the bore.
  const pillarWorld = blocks.pillar.matrixWorld;
  for (const [du, dv] of [[0, 0], [0.07, 0], [-0.07, 0], [0, 0.07], [0, -0.07]]) {
    const side = new THREE.Vector3(Math.cos(hole.holeTheta), 0, -Math.sin(hole.holeTheta));
    const start = new THREE.Vector3(Math.sin(hole.holeTheta), 0, Math.cos(hole.holeTheta)).multiplyScalar(0.6)
      .addScaledVector(side, du).setY(hole.holeY + dv).applyMatrix4(pillarWorld);
    const toward = new THREE.Vector3(-Math.sin(hole.holeTheta), 0, -Math.cos(hole.holeTheta)).transformDirection(pillarWorld);
    const hit = new THREE.Raycaster(start, toward).intersectObject(blocks.pillar, false)[0];
    assert.ok(hit && hit.distance > 0.6 + Math.sqrt(hole.boreRadius ** 2 - du ** 2) - 1e-3, `ray through the hole (${du}, ${dv}): ${hit?.distance}`);
  }
  // The mirror back's two recessed panels mirror each other about x = 0.
  const [left, right] = blocks.mirrorBackLand.userData.panels.map((panel) => panel[0][0]);
  assert.equal(left.length, right.length);
  for (const [x, y] of right) assert.ok(left.some(([u, v]) => Math.abs(u + x) < 1e-9 && Math.abs(v - y) < 1e-9));
  // The frame is one smooth moulded solid with a raised bead on its back.
  const frame = blocks.mirrorFrameBars[0];
  frame.geometry.computeBoundingBox();
  assert.ok(frame.geometry.boundingBox.max.z > 0.13, 'moulded bead stands proud of the back board');
  assert.ok(Math.abs(frame.geometry.boundingBox.max.x + frame.geometry.boundingBox.min.x) < 1e-6);
  disposeModel(model.root);
});
