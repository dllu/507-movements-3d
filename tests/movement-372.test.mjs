import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

test('movement 372 is White\'s four-miter differential with one loose input, one keyed output, two hoop-carried intermediates, and one measuring band', () => {
  const movement = catalog.movements[371];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 372);
  assert.equal(movement.number, '372');
  assert.equal(movement.category, 'Bevel gearing');
  assert.equal(
    movement.archetype,
    'four-miter-bevel-hoop-reaction-dynamometer',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-loose-input/);
  assert.match(data.mechanism, /one-keyed-output/);
  assert.match(data.mechanism, /two-opposed-hoop-carried/);
  assert.match(data.mechanism, /weighted-peripheral-band/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /right loose bevel gear/);
  assert.match(degreesOfFreedom.note, /static torque balance/);

  for (const component of [
    blocks.outputShaftRotor,
    blocks.inputGear,
    blocks.outputGear,
    blocks.inputSleeveRotor,
    blocks.hoopCarrier,
    blocks.stretcher,
    blocks.stretcherBall,
    ...blocks.supportPosts,
    ...blocks.shaftBearings,
    ...blocks.contactMarkers,
  ]) assert.equal(component.parent, model.root);
  // Brown draws neither the weighing band and weights, a base, nor the
  // white indices; the source presentation detaches them.
  for (const undrawn of [
    blocks.measuringBand,
    blocks.bandAttachment,
    blocks.suspensionRod,
    blocks.scalePan,
    blocks.base,
    ...blocks.scaleWeights,
    blocks.hoopIndex,
    blocks.outputShaftIndex,
    blocks.inputSleeveIndex,
  ]) assert.equal(undrawn.parent, null);
  for (const component of [
    blocks.hoop,
    blocks.carrierBoss,
    blocks.topPlanetGear,
    blocks.bottomPlanetGear,
    ...blocks.carrierArms,
    ...blocks.carrierCrossArms,
    ...blocks.planetAxles,
  ]) assert.equal(component.parent, blocks.hoopCarrier);
  assert.equal(blocks.outputShaft.parent, blocks.outputShaftRotor);
  assert.equal(blocks.inputSleeve.parent, blocks.inputSleeveRotor);
  assert.equal(blocks.contactMarkers.length, 4);
  assert.equal(blocks.scaleWeights.length, 2);

  const gears = [
    blocks.inputGear,
    blocks.outputGear,
    blocks.topPlanetGear,
    blocks.bottomPlanetGear,
  ];
  assert.deepEqual(
    gears.map((gear) => gear.userData.teeth),
    Array(4).fill(geometry.gearTeeth),
  );
  vectorNear(blocks.inputGear.userData.axis, X_AXIS, 0,
    'right input axis');
  vectorNear(blocks.outputGear.userData.axis, X_AXIS.clone().negate(), 0,
    'left output outward axis');
  vectorNear(blocks.topPlanetGear.userData.axis, Y_AXIS, 0,
    'upper intermediate axis');
  vectorNear(blocks.bottomPlanetGear.userData.axis,
    Y_AXIS.clone().negate(), 0, 'lower intermediate axis');

  const roles = [];
  const belts = [];
  const measuringBands = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) belts.push(object);
    if (object.userData.isMeasuringBand) measuringBands.push(object);
  });
  for (const role of [
    'right-loose-input-miter-gear-free-on-horizontal-shaft',
    'left-miter-gear-fast-keyed-to-horizontal-output-shaft',
    'upper-balanced-intermediate-miter-gear-carried-by-hoop',
    'lower-balanced-intermediate-miter-gear-carried-by-hoop',
    'hoop-shaped-frame-free-to-revolve-on-middle-of-horizontal-shaft',
    'fixed-turned-stretcher-between-the-standards',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(belts.length, 0);
  assert.deepEqual(measuringBands, []);
  assert.equal(blocks.measuringBand.userData.isMeasuringBand, true);
  disposeModel(model.root);
});

test('movement 372 records Brown\'s complete operating description, measured plate, unavailable animation, and White primary design', () => {
  const movement = catalog.movements[371];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate372;
  const evidence = sourceReference.constructionEvidence;
  const white = sourceReference.jamesWhitePrimaryDesign;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_372.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /White’s dynamometer/);
  assert.match(movement.description, /two horizontal bevel-gears/);
  assert.match(movement.description, /hoop-snaped frame/);
  assert.match(movement.description, /one fast and the other loose/);
  assert.match(movement.description, /hoop to be held stationary/);
  assert.match(movement.description, /band attached to its periphery/);
  assert.match(movement.description, /weight required to keep it still/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    data.dynamics.sourceSpecifiesDimensionsTimingToothCountFrictionOrLoad,
    false,
  );
  assert.equal(data.dynamics.idealizations.length, 5);
  assert.match(data.dynamics.treatment, /differential topology/);
  assert.match(data.dynamics.treatment, /torque balances/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.shaftCenter.toArray(), [270, 194]);
  assert.deepEqual(plate.hoopTop.toArray(), [270, 48]);
  assert.deepEqual(plate.hoopBottom.toArray(), [270, 343]);
  assert.deepEqual(plate.hoopLeft.toArray(), [141, 194]);
  assert.deepEqual(plate.hoopRight.toArray(), [401, 194]);
  assert.deepEqual(plate.leftShaftBearing.toArray(), [122, 194]);
  assert.deepEqual(plate.rightShaftBearing.toArray(), [419, 194]);
  assert.deepEqual(plate.bandIndicatorCenter.toArray(), [267, 423]);
  assert.equal(evidence.explicitInBrownDescription.length, 7);
  assert.match(evidence.engravingEvidence, /two end standards/);
  assert.match(evidence.engravingEvidence, /symmetric pair/);
  assert.match(evidence.reconstructionDisclosure, /eighteen-tooth/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);

  assert.equal(white.book, 'A New Century of Inventions');
  assert.equal(white.publicationYear, 1822);
  assert.equal(white.plateAndFigures, 'Plate 3, figures 3 and 4');
  assert.match(white.sourceUrl, /^https:\/\/www\.gutenberg\.org\//);
  assert.match(white.transmissionEvidence, /two balanced intermediate wheels/);
  assert.match(white.transmissionEvidence, /scale basin/);
  disposeModel(model.root);
});

test('movement 372 all four equal miter gears are true complementary pitch cones sharing one apex and one module', () => {
  const model = createMovementModel(catalog.movements[371]);
  const data = model.root.userData;
  const { blocks, contactPoints, geometry } = data;
  const gears = [
    blocks.inputGear,
    blocks.outputGear,
    blocks.topPlanetGear,
    blocks.bottomPlanetGear,
  ];

  near(geometry.pitchConeAngle, Math.PI / 4, 0,
    'equal miter half-angle');
  near(2 * geometry.pitchConeAngle, Math.PI / 2, 0,
    'complementary intersecting axes');
  near(
    2 * geometry.outerPitchRadius / geometry.gearTeeth,
    geometry.module,
    0,
    'common module',
  );
  near(Math.PI * geometry.module, geometry.circularPitch, 0,
    'common circular pitch');
  for (const gear of gears) {
    vectorNear(gear.position, geometry.commonApex, 0,
      'gear root lies at common apex');
    near(gear.userData.pitchConeAngle, geometry.pitchConeAngle, 0,
      'gear pitch-cone angle');
    near(gear.userData.outerDistance, geometry.outerConeDistance, 0,
      'gear outer cone distance');
    near(gear.userData.outerPitchRadius,
      geometry.outerPitchRadius, 0, 'gear outer pitch radius');
    assert.equal(gear.userData.toothMeshes.length, geometry.gearTeeth);
  }
  near(blocks.inputGear.userData.axis.dot(
    blocks.topPlanetGear.userData.axis), 0, 0,
  'input and top axes perpendicular');
  near(blocks.outputGear.userData.axis.dot(
    blocks.bottomPlanetGear.userData.axis), 0, 0,
  'output and bottom axes perpendicular');
  near(blocks.inputGear.userData.axis.dot(
    blocks.outputGear.userData.axis), -1, 0,
  'side gear outward axes oppose');
  near(blocks.topPlanetGear.userData.axis.dot(
    blocks.bottomPlanetGear.userData.axis), -1, 0,
  'intermediate outward axes oppose');

  for (const [name, point] of Object.entries(contactPoints)) {
    assert.equal(point.z, 0, `${name} lies in source section plane`);
    near(Math.abs(point.x), geometry.outerConeDistance, 0,
      `${name} side-gear axial distance`);
    near(Math.abs(point.y), geometry.outerConeDistance, 0,
      `${name} planet axial distance`);
    near(point.length(), Math.SQRT2 * geometry.outerConeDistance,
      3e-16, `${name} common pitch generator distance`);
  }
  disposeModel(model.root);
});

test('movement 372 held-hoop operation counter-rotates the keyed shaft exactly and has zero slip at all four miter contacts', () => {
  const model = createMovementModel(catalog.movements[371]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const contactNames = [
    'inputToBottomPlanet',
    'inputToTopPlanet',
    'outputToBottomPlanet',
    'outputToTopPlanet',
  ];

  assert.equal(transmission.heldOutputRatio, -1);
  for (let sample = -1200; sample <= 2400; sample += 1) {
    const time = geometry.inputPeriod * sample / 1200;
    const state = stateAtTime(time);
    const travel = geometry.inputAngularSpeed * time;
    near(state.inputAngle, geometry.inputStartAngle + travel, 0,
      'uniform loose-gear angle');
    near(state.outputLocalAngle,
      geometry.outputStartLocalAngle + travel, 0,
      'opposed-axis output local angle');
    near(state.outputShaftAngle, -travel, 0,
      'keyed shaft physical counter-rotation');
    near(state.topPlanetLocalAngle,
      geometry.planetStartLocalAngle - travel, 0,
      'top intermediate spin');
    near(state.bottomPlanetLocalAngle,
      geometry.planetStartLocalAngle - travel, 0,
      'bottom intermediate spin');
    near(state.hoopAngle, 0, 0, 'held hoop angle');
    near(state.hoopAngularSpeed, 0, 0, 'held hoop speed');
    near(state.outputAngularSpeed, -geometry.inputAngularSpeed, 0,
      'equal opposite side speed');
    near(state.planetRelativeAngularSpeed,
      -geometry.inputAngularSpeed, 0,
      'equal intermediate relative speed');
    near(state.differentialResidual, 0, 0,
      'equal differential equation');
    vectorNear(state.inputAngularVelocity,
      X_AXIS.clone().multiplyScalar(geometry.inputAngularSpeed), 0,
      'input global angular velocity');
    vectorNear(state.outputAngularVelocity,
      X_AXIS.clone().multiplyScalar(-geometry.inputAngularSpeed), 0,
      'output global angular velocity');
    vectorNear(state.topPlanetAngularVelocity,
      Y_AXIS.clone().multiplyScalar(-geometry.inputAngularSpeed), 0,
      'top intermediate global angular velocity');
    vectorNear(state.bottomPlanetAngularVelocity,
      Y_AXIS.clone().multiplyScalar(geometry.inputAngularSpeed), 0,
      'bottom intermediate global angular velocity');
    for (const name of contactNames) {
      const contact = state.contacts[name];
      vectorNear(contact.point, data.contactPoints[name], 0,
        `${name} point`);
      vectorNear(contact.firstVelocity, contact.secondVelocity, 0,
        `${name} equal pitch velocities`);
      near(contact.pitchVelocityError, 0, 0,
        `${name} zero slip`);
    }
    near(state.maximumPitchVelocityError, 0, 0,
      'maximum four-contact slip');
  }
  disposeModel(model.root);
});

test('movement 372 weighted tangent band balances twice the transmitted torque and preserves lossless input-output power', () => {
  const model = createMovementModel(catalog.movements[371]);
  const data = model.root.userData;
  const { blocks, geometry, measurement, stateAtTime } = data;

  near(measurement.hoopGearReactionTorque,
    2 * measurement.transmittedTorque, 0,
    'equal differential doubles carrier reaction torque');
  near(measurement.indicatedWeightForce * geometry.bandLeverArm,
    measurement.hoopGearReactionTorque, 0,
    'weight moment balances hoop reaction');
  near(measurement.indicatedMass * measurement.gravity,
    measurement.indicatedWeightForce, 1e-16,
    'indicated mass supplies weight force');
  near(measurement.inputPower,
    measurement.transmittedTorque * geometry.inputAngularSpeed, 0,
    'input power torque-times-speed');
  near(measurement.losslessPowerResidual, 0, 0,
    'lossless power balance');
  near(measurement.balanceResidualTorque, 0, 0,
    'static torque residual');
  vectorNear(geometry.bandAttachmentPoint,
    new THREE.Vector3(0, 0, geometry.hoopOuterRadius), 0,
    'known hoop attachment radius');
  near(geometry.bandAttachmentPoint.length(),
    geometry.bandLeverArm, 0, 'band lever arm');

  const state = stateAtTime(1.37);
  near(state.bandForce.length(), measurement.indicatedWeightForce, 0,
    'band force equals hanging weight');
  near(state.bandForce.dot(geometry.bandAttachmentPoint), 0, 0,
    'band is tangent at attachment');
  near(Math.abs(state.indicatedBandTorque.x),
    measurement.hoopGearReactionTorque, 2e-16,
    'band torque magnitude');
  near(state.indicatedBandTorque.y, 0, 0, 'band torque has no Y part');
  near(state.indicatedBandTorque.z, 0, 0, 'band torque has no Z part');
  near(state.balanceResidualTorque, 0, 0,
    'runtime torque residual');
  near(state.inputPower, measurement.inputPower, 0,
    'runtime input power');
  near(state.outputPower, measurement.inputPower, 0,
    'runtime delivered output power');
  near(
    blocks.scaleWeights.reduce(
      (sum, weight) => sum + weight.userData.force,
      0,
    ),
    measurement.indicatedWeightForce,
    0,
    'visible weights sum to indicated force',
  );
  assert.equal(measurement.scalePanTared, true);
  disposeModel(model.root);
});

test('movement 372 general differential law reproduces both Brown operating cases', () => {
  const model = createMovementModel(catalog.movements[371]);
  const data = model.root.userData;
  const {
    differentialRates,
    geometry,
    operatingCase,
    transmission,
  } = data;

  for (let inputIndex = -12; inputIndex <= 12; inputIndex += 1) {
    for (let outputIndex = -12; outputIndex <= 12; outputIndex += 1) {
      const inputSpeed = inputIndex * 0.17;
      const outputSpeed = outputIndex * 0.13;
      const rates = differentialRates(inputSpeed, outputSpeed);
      near(rates.carrierAngularSpeed,
        (inputSpeed + outputSpeed) / 2, 0,
        'carrier is side-speed average');
      near(rates.planetRelativeAngularSpeed,
        -(inputSpeed - outputSpeed) / 2, 0,
        'planet is negative half-difference');
      near(rates.inputGearLocalAngularSpeed, inputSpeed, 0,
        'right outward-axis local speed');
      near(rates.outputGearLocalAngularSpeed, -outputSpeed, 0,
        'left outward-axis local speed');
      near(rates.differentialResidual, 0, 5e-16,
        'general differential residual');
    }
  }

  const held = transmission.heldMeasurementRates;
  near(held.carrierAngularSpeed, 0, 0, 'held carrier');
  near(held.outputSignedAngularSpeed,
    -geometry.inputAngularSpeed, 0, 'held output counter-rotates');
  near(held.planetRelativeAngularSpeed,
    -geometry.inputAngularSpeed, 0, 'held planet spin');
  const free = transmission.freeHoopWithOutputHeldRates;
  near(free.outputSignedAngularSpeed, 0, 0,
    'free-case output held');
  near(free.carrierAngularSpeed,
    geometry.inputAngularSpeed / 2, 0,
    'released hoop follows input at half speed');
  near(free.planetRelativeAngularSpeed,
    -geometry.inputAngularSpeed / 2, 0,
    'released-case planet relative spin');
  assert.match(operatingCase.rendered, /hoop held stationary/);
  assert.match(operatingCase.sourceAlternative, /half input speed/);
  assert.match(transmission.differentialEquation,
    /omega_input_about_X.*omega_output_about_X/);
  assert.match(transmission.torqueLaw, /twice/);
  disposeModel(model.root);
});

test('movement 372 renderer keeps the hoop and weights still while binding all four exact gear angles over repeated cycles', () => {
  const model = createMovementModel(catalog.movements[371]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const fixedBandPosition = blocks.measuringBand.position.clone();
  const fixedPanPosition = blocks.scalePan.position.clone();

  for (let frame = 0; frame <= 1600; frame += 1) {
    const time = geometry.inputPeriod * 4 * frame / 1600;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.inputGear.userData.rotor.rotation.z,
      expected.inputAngle, 0, 'rendered loose input angle');
    near(blocks.outputGear.userData.rotor.rotation.z,
      expected.outputLocalAngle, 0, 'rendered keyed gear local angle');
    near(blocks.outputShaftRotor.rotation.x,
      expected.outputShaftAngle, 0, 'rendered output shaft angle');
    near(blocks.inputSleeveRotor.rotation.x,
      expected.inputAngle, 0, 'rendered loose sleeve angle');
    near(blocks.topPlanetGear.userData.rotor.rotation.z,
      expected.topPlanetLocalAngle, 0, 'rendered top planet angle');
    near(blocks.bottomPlanetGear.userData.rotor.rotation.z,
      expected.bottomPlanetLocalAngle, 0, 'rendered bottom planet angle');
    near(blocks.hoopCarrier.rotation.x, 0, 0,
      'rendered hoop remains restrained');
    vectorNear(blocks.measuringBand.position, fixedBandPosition, 0,
      'measuring band remains static');
    vectorNear(blocks.scalePan.position, fixedPanPosition, 0,
      'scale pan remains static');
    near(data.currentState.maximumPitchVelocityError, 0, 0,
      'published state remains slip-free');
    assert.equal(Object.keys(data.pitchContacts).length, 4);
  }
  disposeModel(model.root);
});

test('movement 372 closes every gear index after one input revolution and leaves movement 507 as the next draft', () => {
  const movement = catalog.movements[371];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.inputPeriod);

  angleNear(closure.inputAngle, start.inputAngle, 0,
    'input gear closes');
  angleNear(closure.outputLocalAngle, start.outputLocalAngle, 0,
    'output gear closes');
  angleNear(closure.outputShaftAngle, start.outputShaftAngle, 0,
    'output shaft closes');
  angleNear(closure.topPlanetLocalAngle, start.topPlanetLocalAngle, 0,
    'top intermediate closes');
  angleNear(closure.bottomPlanetLocalAngle,
    start.bottomPlanetLocalAngle, 0, 'bottom intermediate closes');
  near(closure.inputAngle - start.inputAngle, FULL_TURN, 0,
    'unwrapped input turn');
  near(closure.outputShaftAngle - start.outputShaftAngle,
    -FULL_TURN, 0, 'unwrapped output counter-turn');
  assert.equal(data.timeline.demonstrationPeriod, geometry.inputPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.inputPeriod);
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
