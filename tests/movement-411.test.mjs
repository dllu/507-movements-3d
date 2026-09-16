import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'two-wheel-isosceles-survey-carriage-with-world-vertical-pendulum-wheel-geared-ruled-paper-drum-and-contact-pencil';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector2Near(actual, expected, tolerance, message) {
  near(
    new THREE.Vector2(actual.x, actual.y).distanceTo(
      new THREE.Vector2(expected.x, expected.y),
    ),
    0,
    tolerance,
    message,
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

test('movement 411 is a two-wheel isosceles carriage with one pendulum, one ruled-paper drum, one pencil, and one right-angle drive', () => {
  const movement = catalog.movements[410];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 411);
  assert.equal(movement.number, '411');
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /two equal ground wheels/);
  assert.match(data.mechanism, /gravity pendulum/);
  assert.match(data.mechanism, /horizontal ruled-paper drum/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.deepEqual(degreesOfFreedom.inputs,
    ['surface distance traveled by the carriage']);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.carriage.parent, model.root);
  assert.equal(blocks.terrain.parent, model.root);
  assert.equal(blocks.leftWheel.rotor.parent, blocks.carriage);
  assert.equal(blocks.rightWheel.rotor.parent, blocks.carriage);
  assert.equal(blocks.pendulum.parent, blocks.carriage);
  assert.equal(blocks.drumCarrier.parent, blocks.carriage);
  assert.equal(blocks.drumRotor.parent, blocks.drumCarrier);
  assert.equal(blocks.paperDrum.parent, blocks.drumRotor);
  assert.equal(blocks.chartTrace.parent, blocks.drumRotor);
  assert.equal(blocks.chartSectionRings.length, 13);
  assert.equal(blocks.chartGeneratorLines.length, 12);
  assert.equal(blocks.groundDashes.length, 16);
  assert.equal(blocks.leftWheel.spokes.length, 8);
  assert.equal(blocks.rightWheel.spokes.length, 8);
  assert.equal(blocks.chartTrace.geometry.getAttribute('position').count,
    geometry.chartTraceSamples + 2);

  const roles = [];
  const wheelRotors = [];
  const pendulums = [];
  const drums = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.role?.endsWith('survey-wheel')) {
      wheelRotors.push(object);
    }
    if (object.userData.role
      === 'gravity-vertical-pendulum-relative-to-inclining-carriage') {
      pendulums.push(object);
    }
    if (object.userData.role
      === 'wheel-geared-horizontal-axis-chart-drum-rotor') {
      drums.push(object);
    }
    if (object.userData.isBelt) belts.push(object);
  });
  assert.equal(wheelRotors.length, 2);
  assert.equal(pendulums.length, 1);
  assert.equal(drums.length, 1);
  assert.deepEqual(belts, []);
  for (const role of [
    'curved-carriage-frame-governed-by-isosceles-triangle',
    'nonphysical-isosceles-governing-triangle-construction',
    'left-wheel-axis-member-of-one-to-one-right-angle-bevel-stage',
    'horizontal-drum-axis-member-of-one-to-one-right-angle-bevel-stage',
    'cylindrical-sectionally-ruled-recording-paper',
    'pendulum-pencil-maintaining-contact-with-chart-paper',
    'continuous-pencil-trace-progressively-inscribed-on-paper',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 411 records Brown’s plate, written relations, and unavailable-animation boundary', () => {
  const movement = catalog.movements[410];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate411;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_411.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /carriage.*governed by an isosceles triangle having horizontal base/);
  assert.match(movement.description,
    /circumference of each wheel equals the base/);
  assert.match(movement.description, /pendulum.*bisects the base/);
  assert.match(movement.description,
    /drum, rotated by gearing from one of the carriage wheels/);
  assert.match(movement.description, /sectionally ruled paper/);
  assert.match(movement.description,
    /shifted vertically.*scale.*horizontally.*filled paper/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.constructionApexApproximatePixels, [270, 29]);
  assert.deepEqual(plate.leftWheelApproximateBoundsPixels,
    [14, 329, 137, 449]);
  assert.deepEqual(plate.rightWheelApproximateBoundsPixels,
    [389, 330, 505, 449]);
  assert.deepEqual(plate.chartDrumApproximateBoundsPixels,
    [184, 286, 358, 361]);
  assert.deepEqual(plate.pendulumApproximateBoundsPixels,
    [252, 178, 293, 418]);
  assert.equal(evidence.explicitInBrownDescription.length, 10);
  assert.match(evidence.engravingEvidence,
    /two equal spoked wheels.*horizontally oriented ruled-paper drum/);
  assert.match(evidence.reconstructionDisclosure,
    /one-to-one bevel ratio.*independently engineered/);
  disposeModel(model.root);
});

test('movement 411 wheel circumference exactly equals the isosceles base and both sides meet one perpendicular-bisector apex', () => {
  const model = createMovementModel(catalog.movements[410]);
  const { geometry } = model.root.userData;
  const baseVector = geometry.rightWheelCenter.clone()
    .sub(geometry.leftWheelCenter);
  const leftSide = geometry.constructionApex.distanceTo(
    geometry.leftWheelCenter,
  );
  const rightSide = geometry.constructionApex.distanceTo(
    geometry.rightWheelCenter,
  );

  near(baseVector.length(), geometry.triangleBase, 0,
    'wheel-center triangle base');
  near(baseVector.y, 0, 0, 'horizontal source base');
  near(geometry.wheelCircumference,
    2 * Math.PI * geometry.wheelRadius, 0,
  'wheel circumference');
  near(geometry.wheelCircumference, geometry.triangleBase, 0,
    'source-prescribed circumference/base equality');
  near(leftSide, rightSide, 0, 'equal isosceles sides');
  near(geometry.constructionApex.x,
    (geometry.leftWheelCenter.x + geometry.rightWheelCenter.x) / 2,
    0, 'apex on perpendicular bisector');
  near(geometry.pendulumPivot.x, geometry.constructionApex.x, 0,
    'pendulum pivot on same bisector');
  disposeModel(model.root);
});

test('movement 411 enforces no-slip wheels, opposite one-to-one drum drive, and world-vertical pendulum throughout travel', () => {
  const model = createMovementModel(catalog.movements[410]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumNoSlipResidual = 0;
  let maximumWorldPendulumAngle = 0;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 10000);
    maximumNoSlipResidual = Math.max(maximumNoSlipResidual,
      Math.abs(state.noSlipResidual));
    maximumWorldPendulumAngle = Math.max(maximumWorldPendulumAngle,
      Math.abs(state.pendulumWorldAngle));
    near(state.wheelAngle,
      -state.travelDistance / geometry.wheelRadius, 0,
    'wheel no-slip angle');
    near(state.drumAngle,
      -geometry.wheelToDrumRatio * state.wheelAngle, 0,
    'opposite bevel-driven drum angle');
    near(state.drumAngularSpeed,
      -geometry.wheelToDrumRatio * state.wheelAngularSpeed, 0,
    'opposite bevel-driven drum speed');
    near(state.pendulumRelativeAngle,
      -state.groundInclination, 0,
    'gravity angle relative to carriage');
  }
  assert.ok(maximumNoSlipResidual < 4.5e-16);
  assert.equal(maximumWorldPendulumAngle, 0);
  disposeModel(model.root);
});

test('movement 411 pencil and current material trace endpoint remain coincident on the cylindrical chart', () => {
  const model = createMovementModel(catalog.movements[410]);
  const { geometry, stateAtTime, traceMaterialPointAtPhase } =
    model.root.userData;
  let maximumRadialResidual = 0;
  let maximumTraceResidual = 0;

  for (let sample = 0; sample <= 24000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 24000);
    maximumRadialResidual = Math.max(maximumRadialResidual,
      Math.abs(state.pencilContactRadialResidual));
    maximumTraceResidual = Math.max(maximumTraceResidual,
      Math.abs(state.traceContactResidual));
    vectorNear(state.traceMaterialPoint,
      traceMaterialPointAtPhase(state.cyclePhase), 0,
    'chart material trace point');
    near(Math.hypot(
      state.pencilContact.y - geometry.drumCenter.y,
      state.pencilContact.z - geometry.drumCenter.z,
    ), geometry.chartContactRadius, 4e-16,
    'pencil on chart/ink cylinder');
  }
  assert.ok(maximumRadialResidual < 1.2e-16);
  assert.ok(maximumTraceResidual < 8e-16);
  near(geometry.chartContactRadius - geometry.drumRadius, 0.0008, 3e-17,
    'disclosed visible ink offset');
  disposeModel(model.root);
});

test('movement 411 analytic inclination and pencil derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[410]);
  const { stateAtTime } = model.root.userData;
  const velocityEpsilon = 1e-6;
  const accelerationEpsilon = 1e-4;

  for (const time of [0.21, 0.93, 1.74, 2.81, 4.27, 5.32, 6.69, 7.61]) {
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    near(state.groundInclinationSpeed,
      (after.groundInclination - before.groundInclination)
        / (2 * velocityEpsilon),
    2.5e-10, 'inclination speed');
    near(state.groundInclinationAcceleration,
      (afterAcceleration.groundInclinationSpeed
        - beforeAcceleration.groundInclinationSpeed)
        / (2 * accelerationEpsilon),
    2e-9, 'inclination acceleration');
    const finitePencilVelocity = after.pencilLocalPosition.clone()
      .sub(before.pencilLocalPosition)
      .multiplyScalar(1 / (2 * velocityEpsilon));
    const finitePencilAcceleration = afterAcceleration.pencilLocalVelocity
      .clone()
      .sub(beforeAcceleration.pencilLocalVelocity)
      .multiplyScalar(1 / (2 * accelerationEpsilon));
    vectorNear(state.pencilLocalVelocity, finitePencilVelocity, 5e-10,
      'pencil velocity');
    vectorNear(state.pencilLocalAcceleration, finitePencilAcceleration,
      4e-9, 'pencil acceleration');
  }
  disposeModel(model.root);
});

test('movement 411 passes level, uphill, level, downhill, and closes after one base length and one wheel turn', () => {
  const model = createMovementModel(catalog.movements[410]);
  const { geometry, sourcePose, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const uphill = stateAtTime(geometry.cycleDuration / 4);
  const crest = stateAtTime(geometry.cycleDuration / 2);
  const downhill = stateAtTime(3 * geometry.cycleDuration / 4);
  const closure = stateAtTime(geometry.cycleDuration);

  near(start.groundInclination, 0, 0, 'initial level');
  near(uphill.groundInclination,
    geometry.maximumGroundInclination, 0, 'maximum rising tangent');
  near(crest.groundInclination, 0, 3e-17, 'level crest');
  near(downhill.groundInclination,
    -geometry.maximumGroundInclination, 0, 'maximum falling tangent');
  near(closure.groundInclination, start.groundInclination, 0,
    'inclination cycle closure');
  near(geometry.triangleBase / geometry.wheelRadius, FULL_TURN, 0,
    'one wheel revolution per base length');
  near(stateAtTime(geometry.cycleDuration * (1 - 1e-12)).wheelAngle,
    -FULL_TURN * (1 - 1e-12), 9e-16,
  'wheel approaches one full physical turn');
  near(sourcePose.groundInclination, 0, 0, 'source level pose');
  near(sourcePose.pendulumWorldAngle, 0, 0,
    'source vertical pendulum');
  disposeModel(model.root);
});

const FULL_TURN = Math.PI * 2;

test('movement 411 update binds rolling contacts, frame pitch, gravity pendulum, drum, pencil, and trace to one state', () => {
  const model = createMovementModel(catalog.movements[410]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;

  for (const fraction of [0, 0.08, 0.25, 0.47, 0.5, 0.73, 0.91]) {
    const time = geometry.cycleDuration * fraction;
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.carriage.rotation.z, state.groundInclination, 0,
      'rendered carriage pitch');
    near(blocks.terrain.rotation.z, state.groundInclination, 0,
      'rendered tangent pitch');
    near(blocks.leftWheel.rotor.rotation.z, state.wheelAngle, 0,
      'rendered left wheel');
    near(blocks.rightWheel.rotor.rotation.z, state.wheelAngle, 0,
      'rendered right wheel');
    near(blocks.drumRotor.rotation.x, state.drumAngle, 0,
      'rendered chart drum');
    near(blocks.pendulum.rotation.z, state.pendulumRelativeAngle, 0,
      'rendered relative pendulum');

    const pendulumPivotWorld = blocks.pendulum.localToWorld(
      new THREE.Vector3(0, 0, 0),
    );
    const pendulumDownWorld = blocks.pendulum.localToWorld(
      new THREE.Vector3(0, -1, 0),
    ).sub(pendulumPivotWorld).normalize();
    vector2Near(pendulumDownWorld, new THREE.Vector2(0, -1), 3e-16,
      'rendered pendulum remains world vertical');

    const leftWheelContactWorld = blocks.carriage.localToWorld(
      new THREE.Vector3(
        state.leftContactLocal.x,
        state.leftContactLocal.y,
        0,
      ),
    );
    const leftGroundPointWorld = blocks.terrain.localToWorld(
      new THREE.Vector3(
        state.leftContactLocal.x,
        state.leftContactLocal.y,
        0,
      ),
    );
    vectorNear(leftWheelContactWorld, leftGroundPointWorld, 0,
      'left wheel on instantaneous ground tangent');

    const pencilWorld = blocks.pencilTip.getWorldPosition(
      new THREE.Vector3(),
    );
    const traceAttribute = blocks.chartTrace.geometry
      .getAttribute('position');
    const traceEndpointLocal = new THREE.Vector3().fromBufferAttribute(
      traceAttribute,
      data.traceState.endpointIndex,
    );
    const traceEndpointWorld = blocks.chartTrace.localToWorld(
      traceEndpointLocal,
    );
    vectorNear(traceEndpointWorld, pencilWorld, 8e-8,
      'rendered trace endpoint at pencil');
    assert.equal(data.contacts.leftWheelToGround.active, true);
    assert.equal(data.contacts.rightWheelToGround.active, true);
    assert.equal(data.contacts.pendulumPencilToPaper.active, true);
  }
  disposeModel(model.root);
});

test('movement 411 exposes both source-specified drum adjustment directions as locked configuration settings', () => {
  const model = createMovementModel(catalog.movements[410]);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.deepEqual(degreesOfFreedom.configurationCoordinates, [
    'vertical drum shift selecting record scale',
    'horizontal drum shift selecting unused paper',
  ]);
  near(blocks.drumCarrier.position.y,
    geometry.drumVerticalScaleOffset, 0, 'vertical scale setting');
  near(blocks.drumCarrier.position.x,
    geometry.drumAxialPaperOffset, 0, 'horizontal paper setting');
  assert.equal(blocks.verticalDrumGuide.parent, blocks.carriage);
  assert.equal(blocks.verticalAdjustmentKnob.parent, blocks.carriage);
  assert.equal(blocks.axialAdjustmentKnob.parent, blocks.carriage);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier', () => {
  const movement507 = catalog.movements[506];
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});
