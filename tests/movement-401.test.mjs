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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 401 is one Brownell faceplate, tangent slide, volute spring, pitman, and treadle', () => {
  const movement = catalog.movements[400];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 401);
  assert.equal(movement.number, '401');
  assert.equal(movement.category, 'Cranks & reciprocation');
  assert.equal(movement.archetype,
    'brownell-faceplate-tangent-slide-wrist-and-volute-spring-carrying-treadle-crank-past-dead-center');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-rotating-faceplate/);
  assert.match(data.mechanism, /tangent-slide-A/);
  assert.match(data.mechanism, /volute-spring-B/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.faceplate.parent, model.root);
  assert.equal(blocks.treadle.parent, model.root);
  assert.equal(blocks.pitman.parent, model.root);
  assert.equal(blocks.tangentSlide.parent, blocks.faceplate);
  assert.equal(blocks.voluteSpring.parent, blocks.faceplate);
  assert.equal(blocks.guidePins.length, 2);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'single-rotating-flywheel-faceplate-carrying-tangent-slide',
    'rigid-slide-A-with-two-parallel-traverse-guide-slots',
    'crank-wrist-pin-fixed-on-tangent-slide',
    'volute-spring-B-anchored-to-faceplate-and-returning-tangent-slide',
    'rigid-pitman-from-treadle-to-sliding-wrist',
    'single-pivot-foot-treadle-applying-pressure-through-pitman',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(
    roles.filter((role) => /^faceplate-fixed-guide-pin-/.test(role)).length,
    2,
  );
  assert.match(data.constraints.wheel, /no belt, gear, or second wheel drive/);
  disposeModel(model.root);
});

test('movement 401 documents Brown’s plate and text without inventing a patent number or source animation', () => {
  const movement = catalog.movements[400];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate401;
  const evidence = sourceReference.constructionEvidence;
  const history = sourceReference.historicalCorroboration;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_401.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /slotted slide, A/);
  assert.match(movement.description, /spring, B/);
  assert.match(movement.description, /passed the center/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.faceplateCenterApproximatePixels, [252, 183]);
  assert.deepEqual(plate.wristApproximatePixels, [251, 119]);
  assert.deepEqual(plate.treadlePivotApproximatePixels, [327, 461]);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.engravingEvidence, /tangential two-slot carriage A/);
  assert.match(evidence.reconstructionDisclosure, /independently synthesized/);
  assert.match(history.citation, /Hiscox/);
  assert.match(history.operationalEvidence, /tangent slide/);
  assert.match(history.operationalEvidence, /volute spring/);
  assert.match(history.operationalEvidence, /traverse slots/);
  assert.equal(Object.hasOwn(sourceReference, 'patent'), false);
  assert.doesNotMatch(JSON.stringify(sourceReference), /\bUS\d+A\b/);
  disposeModel(model.root);
});

test('movement 401 makes one constant-speed faceplate turn and closes every dependent coordinate each cycle', () => {
  const model = createMovementModel(catalog.movements[400]);
  const { stateAtTime, timeline } = model.root.userData;
  const expectedSpeed = FULL_TURN / timeline.cycleDuration;

  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 12000);
    near(state.faceplateAngularSpeed, expectedSpeed, 0,
      'constant faceplate speed');
    near(state.faceplateAngle, FULL_TURN * state.cycleCoordinate, 0,
      'unwrapped faceplate angle');
  }
  for (const phase of [-2.31, -0.18, 0, 0.43, 0.91, 2.72]) {
    const start = stateAtTime(timeline.cycleDuration * phase);
    const end = stateAtTime(timeline.cycleDuration * (phase + 1));
    near(end.faceplateAngle - start.faceplateAngle, FULL_TURN, 8e-15,
      'one faceplate revolution');
    near(end.slideAdvance, start.slideAdvance, 3e-15,
      'slide cycle closure');
    near(end.wristWorld.distanceTo(start.wristWorld), 0, 6e-15,
      'wrist cycle closure');
    near(end.rearJointWorld.distanceTo(start.rearJointWorld), 0, 8e-15,
      'treadle joint cycle closure');
    near(end.footTipWorld.distanceTo(start.footTipWorld), 0, 8e-15,
      'foot pad cycle closure');
  }
  disposeModel(model.root);
});

test('movement 401 keeps both fixed guide pins inside the two parallel slots while A translates only tangentially', () => {
  const model = createMovementModel(catalog.movements[400]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  let maximumAdvance = -Infinity;
  let minimumAdvance = Infinity;

  for (let sample = 0; sample <= 40000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 40000);
    maximumAdvance = Math.max(maximumAdvance, state.slideAdvance);
    minimumAdvance = Math.min(minimumAdvance, state.slideAdvance);
    near(state.wristFaceLocal.x, -state.slideAdvance, 0,
      'wrist follows tangent slide x');
    near(state.wristFaceLocal.y, geometry.crankRadius, 0,
      'slide has no radial freedom');
    assert.equal(state.guidePinPositionsInSlide.length, 2);
    for (let index = 0; index < 2; index += 1) {
      const slotCenter = index === 0
        ? -geometry.slotCenterX
        : geometry.slotCenterX;
      const pin = state.guidePinPositionsInSlide[index];
      near(pin.y, 0, 0, 'guide pin remains on slot centerline');
      near(pin.x - slotCenter, state.slideAdvance, 2e-16,
        'faceplate pin displacement within moving slot');
      assert.ok(Math.abs(pin.x - slotCenter)
        <= geometry.slotHalfStraight + 2e-16);
    }
  }
  near(minimumAdvance, 0, 3e-16, 'rear slide stop');
  near(maximumAdvance, geometry.slideTravel, 3e-16,
    'forward slide stop');
  assert.ok(geometry.slideTravel < geometry.slotHalfStraight);
  disposeModel(model.root);
});

test('movement 401 solves the rigid pitman and treadle by exact circle closure', () => {
  const model = createMovementModel(catalog.movements[400]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  let maximumPitmanResidual = 0;
  let maximumTreadleResidual = 0;

  for (let sample = -30000; sample <= 60000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 30000);
    maximumPitmanResidual = Math.max(
      maximumPitmanResidual,
      Math.abs(state.pitmanLengthResidual),
    );
    maximumTreadleResidual = Math.max(
      maximumTreadleResidual,
      Math.abs(state.treadleRadiusResidual),
    );
    near(state.wristWorld.distanceTo(state.rearJointWorld),
      geometry.pitmanLength, 2e-15, 'constant pitman length');
    near(state.rearJointWorld.distanceTo(geometry.treadlePivot),
      geometry.treadleRearArm, 8e-16, 'constant treadle rear arm');
  }
  assert.ok(maximumPitmanResidual < 1.8e-15,
    `pitman residual ${maximumPitmanResidual}`);
  assert.ok(maximumTreadleResidual < 7e-16,
    `treadle residual ${maximumTreadleResidual}`);
  disposeModel(model.root);
});

test('movement 401 advances before center, dwells through the crossing, and lets spring B return afterward', () => {
  const model = createMovementModel(catalog.movements[400]);
  const data = model.root.userData;
  const { geometry, motion, stateAtTime, timeline } = data;
  const at = (phase) => stateAtTime(timeline.cycleDuration * phase);

  assert.equal(at(0.40).slideLaw.stage, 'slide-held-against-stop');
  assert.equal(at(0.89).slideLaw.stage,
    'treadle-pressure-advancing-tangent-slide');
  assert.equal(at(0.98).slideLaw.stage,
    'wrist-carried-past-upper-dead-center');
  assert.equal(at(0.03).slideLaw.stage,
    'wrist-carried-past-upper-dead-center');
  assert.equal(at(0.10).slideLaw.stage, 'volute-spring-return-to-stop');
  assert.equal(at(0.30).slideLaw.stage, 'slide-held-against-stop');
  assert.match(motion.sequence, /treadle pressure advances A/);
  assert.match(motion.sequence, /wrist crosses upper center/);
  assert.match(motion.sequence, /spring B returns A/);

  near(at(0).slideAdvance, geometry.slideTravel, 0,
    'source pose slide advance');
  near(at(0.96).wristWorld.x, geometry.wheelCenter.x, 5e-16,
    'wrist x at upper-center crossing');
  assert.ok(at(0.96).wristWorld.y > geometry.wheelCenter.y);
  for (const phase of [0.82, 0.96, 0.04, 0.16]) {
    near(at(phase).slideVelocity, 0, 3e-14,
      'zero-speed event handoff');
  }
  assert.ok(at(0.94).slideAdvance < at(0.96).slideAdvance);
  assert.equal(at(0.98).slideAdvance, geometry.slideTravel);
  assert.equal(at(0.03).slideAdvance, geometry.slideTravel);
  assert.ok(at(0.06).slideAdvance < geometry.slideTravel);
  assert.ok(at(0.14).slideAdvance > 0);
  near(at(0.17).slideAdvance, 0, 1e-15, 'spring-returned stop');
  disposeModel(model.root);
});

test('movement 401 sliding wrist never reverses around the faceplate and clears the conventional dead center', () => {
  const model = createMovementModel(catalog.movements[400]);
  const data = model.root.userData;
  const { deadCenterDemonstration, stateAtTime, timeline } = data;
  let minimumAngularSpeed = Infinity;
  let previousAngle = -Infinity;

  for (let sample = 0; sample <= 60000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 60000);
    minimumAngularSpeed = Math.min(
      minimumAngularSpeed,
      state.wristAngularSpeed,
    );
    assert.ok(state.wristUnwrappedAngle >= previousAngle - 1e-14);
    previousAngle = state.wristUnwrappedAngle;
  }
  assert.ok(minimumAngularSpeed > 0.389,
    `minimum wrist angular speed ${minimumAngularSpeed}`);
  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleDuration);
  near(end.wristUnwrappedAngle - start.wristUnwrappedAngle,
    FULL_TURN, 1e-15, 'one forward wrist orbit');
  assert.ok(Math.abs(deadCenterDemonstration.actualSourceMomentArm)
    > 5 * Math.abs(
      deadCenterDemonstration.conventionalDeadCenterMomentArm,
    ));
  // The lead is a fixed fraction of the (plate-proportioned) wrist radius.
  assert.ok(Math.abs(deadCenterDemonstration.actualSourceMomentArm)
    > 0.25 * data.geometry.crankRadius);
  disposeModel(model.root);
});

test('movement 401 renders spring B as a closed flat strip and binds every animated body to the solved state', () => {
  const model = createMovementModel(catalog.movements[400]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;
  const springGeometry = blocks.voluteSpring.geometry;
  const index = springGeometry.index;
  const positions = springGeometry.getAttribute('position');
  const normals = springGeometry.getAttribute('normal');

  // Pass 90: a strip with thickness (four walls and two end caps), not a
  // zero-thickness decal; every triangle faces along its stored normal.
  const sampleCount = blocks.voluteSpring.userData.sampleCount;
  assert.equal(index.count / 3, 4 * 2 * (sampleCount - 1) + 4);
  assert.equal(blocks.voluteSpring.userData.noRotationIndicator, true);
  const zs = Array.from({ length: positions.count }, (_, i) => positions.getZ(i));
  near(Math.max(...zs) - Math.min(...zs), 0.05, 1e-6, 'strip thickness');
  const p = [0, 1, 2].map(() => new THREE.Vector3());
  const n = new THREE.Vector3();
  for (let offset = 0; offset < index.count; offset += 3) {
    for (let k = 0; k < 3; k += 1) p[k].fromBufferAttribute(positions, index.getX(offset + k));
    const face = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    if (face.length() < 1e-12) continue;
    n.fromBufferAttribute(normals, index.getX(offset));
    assert.ok(face.dot(n) > 0, `triangle ${offset / 3} faces its normal`);
  }

  for (const phase of [0, 0.12, 0.40, 0.86, 0.92, 0.98, 1]) {
    const time = timeline.cycleDuration * phase;
    const expected = stateAtTime(time);
    model.update(time, 0);
    near(blocks.faceplate.rotation.z, expected.faceplateAngle, 0,
      'rendered faceplate angle');
    near(blocks.tangentSlide.position.x, -expected.slideAdvance, 0,
      'rendered tangent slide');
    near(blocks.treadle.rotation.z, expected.treadleAngle, 0,
      'rendered treadle angle');
    near(blocks.pitman.position.x, expected.rearJointWorld.x, 0,
      'rendered pitman x');
    near(blocks.pitman.position.y, expected.rearJointWorld.y, 0,
      'rendered pitman y');
    near(blocks.pitman.rotation.z, expected.pitmanAngle, 0,
      'rendered pitman angle');
    near(blocks.voluteSpring.userData.springState.attachment.x,
      -expected.slideAdvance, 0, 'spring attachment follows slide');
    near(blocks.voluteSpring.userData.springState.attachment.y,
      geometry.crankRadius - geometry.slideHalfHeight + 0.015, 0,
      'spring attachment follows slide lower edge');
    assert.equal(data.contacts.guidePinsInTraverseSlots.length, 2);
    assert.equal(data.contacts.slideToSpring.returning,
      expected.springReturnActive);
    near(data.contacts.pitmanToTreadle.residual,
      expected.pitmanLengthResidual, 0, 'reported pitman closure');
  }
  disposeModel(model.root);
});

test('movement 507 remains the next authored review frontier', () => {
  const movement401 = catalog.movements[400];
  const movement507 = catalog.movements[506];
  const model401 = createMovementModel(movement401);
  const model507 = createMovementModel(movement507);

  assert.equal(movement401.id, 401);
  assert.equal(movement401.fidelity, 'authored');
  assert.equal(model401.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype,
    model401.root.userData.archetype);
  disposeModel(model401.root);
  disposeModel(model507.root);
});
