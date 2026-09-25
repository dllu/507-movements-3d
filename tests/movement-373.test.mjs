import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

test('movement 373 is Robert\'s one-drum, two-wheel carriage experiment with one belt and one spiral-spring indicator', () => {
  const movement = catalog.movements[372];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 373);
  assert.equal(movement.number, '373');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.archetype,
    'rolling-carriage-drum-spiral-spring-friction-experiment',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-coaxially-belt-driven/);
  assert.match(data.mechanism, /two-stationary-axle-wagon-wheels/);
  assert.match(data.mechanism, /one-horizontal-tether/);
  assert.match(data.mechanism, /one-spiral-spring-force-indicator/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 2);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /speed/);
  assert.match(degreesOfFreedom.input, /load/);

  for (const component of [
    blocks.base,
    blocks.belt,
    ...blocks.carriageWheels,
    ...blocks.contactMarkers,
    blocks.dialFace,
    blocks.dialRim,
    ...blocks.dialTicks,
    blocks.drivePulley,
    blocks.indicatorPost,
    blocks.indicatorShelf,
    blocks.largeAxle,
    blocks.largeWheel,
    blocks.pointerPin,
    blocks.pointerPivot,
    blocks.spiralSpring,
    ...blocks.supportBeams,
    blocks.testWeight,
    blocks.tether,
    blocks.wagon,
    blocks.weightGuide,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    ...blocks.carriageAxlePins,
    blocks.chassis,
    ...blocks.fixedLoads,
    blocks.wagonBed,
    ...blocks.wagonSides,
  ]) assert.equal(component.parent, blocks.wagon);
  // One continuous flat band (Brown's thin double line), not three pieces.
  assert.equal(blocks.beltBand.parent, blocks.belt);
  assert.equal(blocks.belt.userData.crossSection, 'flat');
  assert.equal(blocks.pointer.parent, blocks.pointerPivot);
  assert.equal(blocks.carriageWheels.length, 2);
  assert.equal(blocks.contactMarkers.length, 2);
  assert.equal(blocks.fixedLoads.length, 4);
  assert.equal(blocks.dialTicks.length, 24);
  assert.equal(blocks.largeWheel.userData.radius,
    geometry.largeWheelRadius);
  for (const wheel of blocks.carriageWheels) {
    assert.equal(wheel.userData.radius, geometry.carriageWheelRadius);
  }

  const belts = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(belts, [blocks.belt]);
  for (const role of [
    'large-driven-test-wheel-supporting-both-carriage-wheels',
    'stationary-axle-carriage-wheel-rolling-without-slip-on-drum',
    'one-source-visible-endless-drive-belt-on-coaxial-pulley',
    'loaded-wagon-held-stationary-above-moving-test-wheel',
    'horizontal-tether-holding-wagon-stationary-and-loading-indicator',
    'visible-spiral-spring-whose-inner-end-turns-with-pointer',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 373 preserves Brown\'s reported experiment, measured engraving topology, unavailable animation, and reconstruction disclosure', () => {
  const movement = catalog.movements[372];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate373;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_373.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Robert’s contrivance/);
  assert.match(movement.description, /does not increase with velocity/);
  assert.match(movement.description, /only with load/);
  assert.match(movement.description, /Loaded wagon/);
  assert.match(movement.description, /spiral spring/);
  assert.match(movement.description, /keep carriage stationary/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingSpringRateFrictionOrLoad,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.empiricalLaw, /contains no velocity term/);
  assert.match(dynamics.treatment, /analytic/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.largeWheelCenter.toArray(), [151, 286]);
  assert.deepEqual(plate.largeWheelTop.toArray(), [151, 160]);
  assert.deepEqual(plate.beltPulleyCenter.toArray(), [159, 289]);
  assert.deepEqual(plate.leftWagonWheelCenter.toArray(), [111, 147]);
  assert.deepEqual(plate.rightWagonWheelCenter.toArray(), [206, 147]);
  assert.deepEqual(plate.dialCenter.toArray(), [360, 148]);
  assert.equal(plate.rightAnchorPostX, 463);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence, /single belt/);
  assert.match(evidence.engravingEvidence, /horizontal wagon tether/);
  assert.match(evidence.reconstructionDisclosure, /engineered/);
  assert.match(evidence.reconstructionDisclosure, /didactic aid/);
  assert.match(evidence.reconstructionDisclosure, /not claimed as source hardware/);
  disposeModel(model.root);
});

test('movement 373 constructs both external wheel contacts exactly while the wagon axles stay fixed and level', () => {
  const model = createMovementModel(catalog.movements[372]);
  const data = model.root.userData;
  const { blocks, contactPoints, geometry } = data;

  near(geometry.wheelRadiusRatio, 5, 0, 'exact radius ratio');
  near(
    geometry.axleCenterDistance,
    geometry.largeWheelRadius + geometry.carriageWheelRadius,
    0,
    'external center distance',
  );
  near(
    geometry.carriageAxleHeight ** 2
      + geometry.carriageHalfSpacing ** 2,
    geometry.axleCenterDistance ** 2,
    5e-16,
    'symmetric axle height construction',
  );
  near(
    geometry.carriageWheelCenters[0].y,
    geometry.carriageWheelCenters[1].y,
    0,
    'level carriage axles',
  );
  near(
    geometry.carriageWheelCenters[0].x
      + geometry.carriageWheelCenters[1].x,
    2 * geometry.largeWheelCenter.x,
    4e-16,
    'symmetric carriage axles',
  );
  for (let index = 0; index < 2; index += 1) {
    const wheelCenter = geometry.carriageWheelCenters[index];
    const normal = geometry.contactNormals[index];
    near(wheelCenter.distanceTo(geometry.largeWheelCenter),
      geometry.axleCenterDistance, 2e-16,
      `contact ${index} center distance`);
    near(normal.length(), 1, 0, `contact ${index} normal unit length`);
    vectorNear(
      contactPoints[index],
      geometry.largeWheelCenter.clone().addScaledVector(
        normal,
        geometry.largeWheelRadius,
      ),
      0,
      `contact ${index} point from drum`,
    );
    vectorNear(
      contactPoints[index],
      wheelCenter.clone().addScaledVector(
        normal,
        -geometry.carriageWheelRadius,
      ),
      2e-16,
      `contact ${index} point from wagon wheel`,
    );
    vectorNear(blocks.carriageWheels[index].position,
      wheelCenter, 0, `rendered wheel ${index} center`);
  }
  assert.equal(blocks.wagon.userData.fixed, true);
  assert.equal(blocks.largeAxle.userData.fixed, true);
  disposeModel(model.root);
});

test('movement 373 gives both carriage wheels the exact negative radius ratio and zero slip, with one tangent belt rigidly driving the coaxial pulley', () => {
  const model = createMovementModel(catalog.movements[372]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, transmission } = data;
  const upperRadius = geometry.upperTangent.clone()
    .sub(geometry.drivePulleyPitchPlaneCenter);
  const lowerRadius = geometry.lowerTangent.clone()
    .sub(geometry.drivePulleyPitchPlaneCenter);
  const upperRun = geometry.upperTangent.clone()
    .sub(geometry.upperFreeEnd).normalize();
  const lowerRun = geometry.lowerFreeEnd.clone()
    .sub(geometry.lowerTangent).normalize();
  const beltDirection3 = new THREE.Vector3(
    geometry.beltDirection.x,
    geometry.beltDirection.y,
    0,
  );

  near(upperRadius.length(), geometry.drivePulleyRadius, 1e-16,
    'upper tangent radius');
  near(lowerRadius.length(), geometry.drivePulleyRadius, 1e-16,
    'lower tangent radius');
  near(upperRadius.dot(upperRun), 0, 2e-16,
    'upper strand tangent');
  near(lowerRadius.dot(lowerRun), 0, 2e-16,
    'lower strand tangent');
  vectorNear(upperRun, beltDirection3, 2e-16,
    'upper run enters pulley along authored belt direction');
  vectorNear(lowerRun, beltDirection3.clone().negate(), 2e-16,
    'lower run leaves pulley in opposite direction');
  near(geometry.beltWrapAngle, Math.PI, 0, 'single half-wrap');
  assert.equal(transmission.drivePulleyRatio, 1);
  assert.equal(transmission.wagonWheelRatio, -5);

  for (let sample = -900; sample <= 1800; sample += 1) {
    const time = geometry.demonstrationPeriod * sample / 900;
    const state = stateAtTime(time);
    near(state.carriageWheelAngularSpeed,
      -geometry.wheelRadiusRatio * state.drumAngularSpeed, 0,
      'wagon-wheel angular speed ratio');
    near(state.drivePulleyAngularSpeed, state.drumAngularSpeed, 0,
      'coaxial pulley speed');
    near(state.drivePulleyAngle, state.drumAngle, 0,
      'coaxial pulley angle');
    near(state.beltLinearSpeed,
      geometry.drivePulleyRadius * state.drumAngularSpeed, 0,
      'one belt pitch speed');
    for (const contact of state.contacts) {
      vectorNear(contact.drumMaterialVelocity,
        contact.carriageMaterialVelocity, 2e-15,
        'equal rolling-contact material velocities');
      near(contact.rollingSlipVelocity.length(), 0, 2e-15,
        'zero rolling slip');
      near(contact.normal.length(), 1, 0, 'unit contact normal');
    }
  }
  // One endless flat band: the framed run round the pulley and its return
  // past the plate's crop round the driving pulley.
  assert.deepEqual(blocks.belt.children.map((part) => part.userData.role),
    ['one-flat-belt-entering-from-left-with-half-wrap', 'endless-belt-return-run-beyond-plate-crop']);
  disposeModel(model.root);
});

test('movement 373 varies speed smoothly and positively without moving the force indication at constant load', () => {
  const model = createMovementModel(catalog.movements[372]);
  const data = model.root.userData;
  const { experiment, geometry, stateAtTime } = data;
  const period = geometry.demonstrationPeriod;
  const minimumSpeed = geometry.meanDrumAngularSpeed
    * (1 - geometry.speedModulationAmplitude);
  const maximumSpeed = geometry.meanDrumAngularSpeed
    * (1 + geometry.speedModulationAmplitude);

  assert.ok(minimumSpeed > 0);
  near(stateAtTime(period / 8).drumAngularSpeed,
    maximumSpeed, 4e-16, 'first speed maximum');
  near(stateAtTime(3 * period / 8).drumAngularSpeed,
    minimumSpeed, 4e-16, 'first speed minimum');
  const step = 1e-5;
  for (let sample = 0; sample <= 400; sample += 1) {
    const time = period * sample / 400;
    const state = stateAtTime(time);
    assert.ok(state.drumAngularSpeed >= minimumSpeed - 1e-15);
    const numericalSpeed = (
      stateAtTime(time + step).drumAngle
      - stateAtTime(time - step).drumAngle
    ) / (2 * step);
    near(numericalSpeed, state.drumAngularSpeed, 2e-9,
      'analytic drum angle derivative');
    const numericalAcceleration = (
      stateAtTime(time + step).drumAngularSpeed
      - stateAtTime(time - step).drumAngularSpeed
    ) / (2 * step);
    near(numericalAcceleration, state.drumAngularAcceleration, 2e-9,
      'analytic drum acceleration');
  }

  const unloadedMean = stateAtTime(0);
  const unloadedFast = stateAtTime(period / 8);
  assert.equal(unloadedMean.loadFraction, unloadedFast.loadFraction);
  assert.notEqual(unloadedMean.drumAngularSpeed,
    unloadedFast.drumAngularSpeed);
  near(unloadedMean.rollingResistanceForce,
    unloadedFast.rollingResistanceForce, 0,
    'unloaded force independent of speed');
  near(unloadedMean.pointerAngle, unloadedFast.pointerAngle, 0,
    'unloaded pointer independent of speed');
  near(experiment.speedIndependenceResidualAt(0, period / 8),
    0, 0, 'published unloaded speed-independence residual');

  const loadedMean = stateAtTime(period / 2);
  const loadedFast = stateAtTime(5 * period / 8);
  assert.equal(loadedMean.loadFraction, loadedFast.loadFraction);
  assert.notEqual(loadedMean.drumAngularSpeed,
    loadedFast.drumAngularSpeed);
  near(loadedMean.pointerAngle, loadedFast.pointerAngle, 0,
    'loaded pointer independent of speed');
  near(experiment.speedIndependenceResidualAt(period / 2,
    5 * period / 8), 0, 0,
  'published loaded speed-independence residual');
  assert.equal(experiment.speedIndependenceResidualAt(0, period / 2),
    null);
  disposeModel(model.root);
});

test('movement 373 force and spiral-spring indication respond exactly to load under the prescribed force, torque, and power calibration', () => {
  const model = createMovementModel(catalog.movements[372]);
  const data = model.root.userData;
  const { experiment, geometry, loadStateAtPhase, stateAtTime } = data;
  const period = geometry.demonstrationPeriod;

  near(loadStateAtPhase(0.29).fraction, 0, 0, 'unloaded plateau');
  near(loadStateAtPhase(0.34).fraction, 0.5, 2e-15,
    'quintic add-load midpoint');
  near(loadStateAtPhase(0.40).fraction, 1, 0, 'loaded plateau');
  near(loadStateAtPhase(0.84).fraction, 0.5, 2e-15,
    'quintic remove-load midpoint');
  near(loadStateAtPhase(0.90).fraction, 0, 0,
    'unloaded closure plateau');
  for (const phase of [0.30, 0.38, 0.80, 0.88]) {
    near(loadStateAtPhase(phase).phaseRate, 0, 0,
      `zero load velocity at phase ${phase}`);
  }

  for (let sample = 0; sample <= 800; sample += 1) {
    const state = stateAtTime(period * sample / 800);
    near(state.totalNormalLoad,
      experiment.baseNormalLoad + state.addedNormalLoad, 0,
      'total normal load');
    near(state.addedNormalLoad,
      experiment.addedNormalLoad * state.loadFraction, 0,
      'applied test load');
    near(state.rollingResistanceForce,
      experiment.rollingResistanceCoefficient * state.totalNormalLoad,
      0, 'load-only rolling resistance');
    near(state.indicatorDeflection,
      state.rollingResistanceForce * experiment.indicatorMomentArm
        / experiment.spiralSpringStiffness,
      0, 'indicator deflection');
    near(state.springTorque,
      experiment.spiralSpringStiffness * state.indicatorDeflection,
      0, 'spring torque');
    near(state.tetherMoment,
      state.rollingResistanceForce * experiment.indicatorMomentArm,
      0, 'tether moment');
    near(state.springTorque, state.tetherMoment, 4e-17,
      'spring and tether moment balance');
    near(state.drumResistanceTorque,
      state.rollingResistanceForce * geometry.largeWheelRadius,
      0, 'drum resistance torque');
    near(state.inputPower,
      state.drumResistanceTorque * Math.abs(state.drumAngularSpeed),
      0, 'instantaneous test power');
    near(state.tetherForce.x, state.rollingResistanceForce, 0,
      'horizontal tether force');
    near(state.tetherForce.y, 0, 0, 'no vertical tether force');
    for (const contact of state.contacts) {
      near(contact.normalForce, state.totalNormalLoad / 2, 0,
        'symmetric normal-force split');
      near(contact.forcePerWheel,
        state.rollingResistanceForce / 2, 0,
        'symmetric resistance-force split');
    }
  }
  const unloaded = stateAtTime(0);
  const loaded = stateAtTime(period / 2);
  assert.ok(loaded.rollingResistanceForce
    > unloaded.rollingResistanceForce);
  assert.ok(loaded.pointerAngle > unloaded.pointerAngle);
  assert.ok(loaded.indicatorDeflection > unloaded.indicatorDeflection);
  assert.ok(loaded.testWeightY < unloaded.testWeightY);
  disposeModel(model.root);
});

test('movement 373 retained spring state keeps its outer anchor fixed, turns its inner end with the pointer, and the renderer binds every moving member', () => {
  const model = createMovementModel(catalog.movements[372]);
  const data = model.root.userData;
  const { blocks, geometry, springPointsAtDeflection, stateAtTime } = data;
  const unloaded = stateAtTime(0);
  const loaded = stateAtTime(geometry.demonstrationPeriod / 2);
  const firstSpring = springPointsAtDeflection(
    unloaded.indicatorDeflection,
  );
  const secondSpring = springPointsAtDeflection(
    loaded.indicatorDeflection,
  );
  const lastIndex = geometry.springSampleCount - 1;

  assert.equal(firstSpring.length, geometry.springSampleCount);
  near(firstSpring[0].distanceTo(geometry.spiralCenter),
    geometry.spiralInnerRadius, 2e-16, 'spiral inner radius');
  near(firstSpring[lastIndex].distanceTo(geometry.spiralCenter),
    geometry.spiralOuterRadius, 2e-16, 'spiral outer radius');
  vectorNear(firstSpring[lastIndex], secondSpring[lastIndex], 0,
    'spiral outer anchor fixed under load');
  assert.ok(firstSpring[0].distanceTo(secondSpring[0]) > 0.02);
  angleNear(
    Math.atan2(
      firstSpring[0].y - geometry.spiralCenter.y,
      firstSpring[0].x - geometry.spiralCenter.x,
    ),
    unloaded.pointerAngle,
    3e-15,
    'spiral inner end follows unloaded pointer',
  );
  angleNear(
    Math.atan2(
      secondSpring[0].y - geometry.spiralCenter.y,
      secondSpring[0].x - geometry.spiralCenter.x,
    ),
    loaded.pointerAngle,
    3e-15,
    'spiral inner end follows loaded pointer',
  );

  const wagonPosition = blocks.wagon.position.clone();
  const beltPosition = blocks.belt.position.clone();
  for (let frame = 0; frame <= 640; frame += 1) {
    const time = geometry.demonstrationPeriod * 2 * frame / 640;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.largeWheel.userData.rotor.rotation.z,
      expected.drumAngle, 0, 'rendered drum angle');
    near(blocks.drivePulley.userData.rotor.rotation.z,
      expected.drivePulleyAngle, 0, 'rendered coaxial pulley angle');
    for (const wheel of blocks.carriageWheels) {
      near(wheel.userData.rotor.rotation.z,
        expected.carriageWheelAngle, 0,
        'rendered wagon-wheel angle');
    }
    // The added load is heaped on the bed in proportion to the load
    // fraction (hidden, seated, when unloaded) instead of hanging above it.
    const heapFraction = expected.loadFraction > 1e-4 ? expected.loadFraction : 1;
    near(blocks.testWeight.position.y,
      data.testLoadHeap.bedTop
        + heapFraction * blocks.testWeight.geometry.parameters.height / 2,
      1e-12, 'rendered heaped test load');
    assert.equal(blocks.testWeight.visible, expected.loadFraction > 1e-4);
    near(blocks.pointerPivot.rotation.z, expected.pointerAngle, 0,
      'rendered indicator angle');
    const positions = blocks.spiralSpring.geometry.attributes.position;
    vectorNear(
      new THREE.Vector3(
        positions.getX(0),
        positions.getY(0),
        positions.getZ(0),
      ),
      expected.springPoints[0],
      2e-7,
      'rendered spiral inner end',
    );
    vectorNear(
      new THREE.Vector3(
        positions.getX(lastIndex),
        positions.getY(lastIndex),
        positions.getZ(lastIndex),
      ),
      expected.springPoints[lastIndex],
      2e-7,
      'rendered spiral outer end',
    );
    vectorNear(blocks.wagon.position, wagonPosition, 0,
      'wagon body remains stationary');
    vectorNear(blocks.belt.position, beltPosition, 0,
      'single belt geometry remains on its fixed path');
    assert.equal(data.rollingContacts.length, 2);
  }
  disposeModel(model.root);
});

test('movement 373 closes two drum turns and ten counter-turns smoothly before movement 507 remains the next authored draft', () => {
  const movement = catalog.movements[372];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.demonstrationPeriod);

  near(closure.drumAngle - start.drumAngle,
    geometry.drumTurnsPerCycle * FULL_TURN, 0,
    'unwrapped two-turn drum travel');
  near(closure.carriageWheelAngle - start.carriageWheelAngle,
    -geometry.drumTurnsPerCycle * geometry.wheelRadiusRatio * FULL_TURN,
    0, 'unwrapped ten-turn wagon-wheel travel');
  angleNear(closure.drumAngle, start.drumAngle, 0,
    'drum index closes');
  angleNear(closure.drivePulleyAngle, start.drivePulleyAngle, 0,
    'coaxial pulley index closes');
  angleNear(closure.carriageWheelAngle,
    start.carriageWheelAngle, 2e-14,
    'wagon-wheel indices close');
  near(closure.drumAngularSpeed, start.drumAngularSpeed, 4e-16,
    'drum speed closes');
  near(closure.drumAngularAcceleration,
    start.drumAngularAcceleration, 0,
    'drum acceleration closes');
  near(closure.loadFraction, start.loadFraction, 0,
    'load closes');
  near(closure.loadFractionRate, start.loadFractionRate, 0,
    'load velocity closes');
  near(closure.pointerAngle, start.pointerAngle, 0,
    'pointer closes');
  near(closure.testWeightY, start.testWeightY, 0,
    'test weight closes');
  assert.equal(timeline.demonstrationPeriod,
    geometry.demonstrationPeriod);
  assert.deepEqual(timeline.phases.unloadedSpeedTrial, [0, 0.30]);
  assert.deepEqual(timeline.phases.loadedSpeedTrial, [0.38, 0.80]);
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
