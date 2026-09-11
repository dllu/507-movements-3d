import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

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

test('movement 316 is the complete glass-jar mercurial compensation pendulum', () => {
  const movement = catalog.movements[315];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    massModel,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 316);
  assert.equal(movement.number, '316');
  assert.equal(movement.title, 'Mercurial compensation pendulum');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'mercurial-compensation-pendulum-constant-center-of-oscillation');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /glass-jar mercury bob moves downward/);
  assert.match(mechanism, /constant mercury mass expands upward/);
  assert.match(mechanism, /I divided by total first moment/);
  assert.match(mechanism, /center of oscillation/);
  assert.equal(transmission.mercuryMassConstant, true);
  assert.equal(transmission.glassJarThermalTravelPerRodExtension, 1);
  assert.match(transmission.compensationTarget,
    /physical-pendulum effective length/);
  assert.equal(massModel.mercury.constantMass, true);
  assert.equal(massModel.totalMass,
    massModel.rod.mass + massModel.glassJar.mass
      + massModel.mercury.mass);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.pendulumCarrier.parent, model.root);
  assert.equal(blocks.jarAssembly.parent, blocks.pendulumCarrier);
  assert.equal(blocks.rod.parent, blocks.pendulumCarrier);
  assert.equal(blocks.threadHelix.parent, blocks.pendulumCarrier);
  assert.equal(blocks.glassJar.parent, blocks.jarAssembly);
  assert.equal(blocks.mercuryColumn.parent, blocks.jarAssembly);
  assert.equal(blocks.mercurySurface.parent, blocks.jarAssembly);
  assert.equal(blocks.adjusterHandle.parent, blocks.jarAssembly);
  assert.equal(blocks.shoulderHangers.length, 2);
  assert.equal(blocks.sideClamps.length, 2);
  assert.equal(blocks.clampPins.length, 2);
  assert.deepEqual(blocks.pendulumCarrier.userData.axis,
    new THREE.Vector3(0, 0, 1));

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'thermally-expanding-steel-pendulum-rod').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'transparent-glass-mercury-jar').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'constant-mass-expanding-mercury-column').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'curved-glass-jar-shoulder-hanger').length, 2);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 316 records every functional element and proportion on Brown’s plate', () => {
  const movement = catalog.movements[315];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToNeutralFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate316;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /threaded central rod/);
  assert.match(sourceAnimation.referenceScope, /two-sided jar hanger/);
  assert.match(sourceAnimation.referenceScope, /mercury level/);
  assert.match(sourceAnimation.referenceScope, /not dimensioned/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_316.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 10);
  assert.deepEqual(plate.rasterSuspension, new THREE.Vector2(265, 11));
  assert.deepEqual(plate.rasterAdjusterCenter,
    new THREE.Vector2(266, 82));
  assert.deepEqual(plate.rasterJarTop, new THREE.Vector2(264, 121));
  assert.deepEqual(plate.rasterJarBottom, new THREE.Vector2(264, 496));
  assert.deepEqual(plate.rasterJarLeft, new THREE.Vector2(177, 310));
  assert.deepEqual(plate.rasterJarRight,
    new THREE.Vector2(350, 310));
  assert.deepEqual(plate.rasterMercuryTop,
    new THREE.Vector2(264, 230));
  assert.deepEqual(plate.rasterMercuryBottom,
    new THREE.Vector2(264, 480));
  assert.deepEqual(plate.rasterRodEnd, new THREE.Vector2(265, 444));
  assert.deepEqual(plate.rasterLeftClamp,
    new THREE.Vector2(178, 169));
  assert.deepEqual(plate.rasterRightClamp,
    new THREE.Vector2(350, 169));
  assert.match(plate.inferredTopology, /one suspended steel rod/);
  assert.match(plate.inferredTopology, /one constant mercury charge/);

  near((plate.rasterJarBottom.y - plate.rasterJarTop.y)
    * geometry.sourceScale, geometry.jarLength, 0,
  'source jar length');
  near((plate.rasterJarRight.x - plate.rasterJarLeft.x)
      * geometry.sourceScale / 2,
    geometry.jarOuterRadius, 0, 'source jar radius');
  near((plate.rasterRodEnd.y - plate.rasterSuspension.y)
      * geometry.sourceScale,
    geometry.referenceRodLength, 0, 'source rod length');
  near((plate.rasterMercuryBottom.y - plate.rasterMercuryTop.y)
      * geometry.sourceScale,
    geometry.referenceFillHeight, 0, 'source fill height');

  const sourceTolerance = plate.measurementUncertaintyPixels
    * geometry.sourceScale;
  const neutral = stateAtTime(0);
  vectorNear(sourcePointToNeutralFront(plate.rasterRodEnd),
    neutral.rodEnd.position, sourceTolerance,
  'source rod end');
  vectorNear(sourcePointToNeutralFront(plate.rasterMercuryTop),
    neutral.mercuryTop.position, sourceTolerance,
  'source mercury level');
  const sourceJarCenter = sourcePointToNeutralFront(
    plate.rasterJarTop.clone().add(plate.rasterJarBottom)
      .multiplyScalar(0.5),
  );
  vectorNear(sourceJarCenter, neutral.glassJarCenter.position,
    sourceTolerance, 'source jar center');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 316 solves an exactly constant center of oscillation over every temperature', () => {
  const model = createMovementModel(catalog.movements[315]);
  const {
    geometry,
    massModel,
    massProperties,
    stateAtTime,
  } = model.root.userData;
  let previousExtension = -Infinity;
  let previousFill = -Infinity;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const coordinate = -1 + 2 * sample / 32768;
    const rodExtension = geometry.maximumRodExtension * coordinate;
    const fill = model.root.userData.fillStateAtRodExtension(rodExtension);
    const properties = massProperties(rodExtension, fill.fillHeight);
    assert.ok(fill.discriminant > 0,
      `physical fill root exists at ${sample}`);
    assert.ok(fill.fillHeight > 0 && fill.fillHeight < geometry.jarLength,
      `mercury stays in jar at ${sample}`);
    assert.ok(fill.upperRoot > geometry.jarLength,
      `nonphysical upper root is rejected at ${sample}`);
    assert.ok(rodExtension > previousExtension || sample === 0);
    assert.ok(fill.fillHeight > previousFill || sample === 0,
      `mercury level grows monotonically at ${sample}`);
    previousExtension = rodExtension;
    previousFill = fill.fillHeight;
    near(properties.effectiveLength,
      geometry.referenceEffectiveLength, 6e-15,
    `effective length at ${sample}`);
    near(properties.inertia,
      geometry.referenceEffectiveLength * properties.firstMoment,
      4e-13, `physical-pendulum equation at ${sample}`);
    near(properties.totalMass, massModel.totalMass, 0,
      `constant aggregate mass at ${sample}`);
  }

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtTime(
      geometry.thermalCyclePeriod * sample / 8192,
    );
    near(state.centerOfOscillationDistance,
      geometry.referenceEffectiveLength, 6e-15,
    `time-domain effective length at ${sample}`);
    near(state.centerOfOscillationError, 0, 6e-15,
      `time-domain compensation error at ${sample}`);
    near(state.mercuryDensityRatio * state.mercuryVolumeRatio,
      1, 5e-16, `constant mercury mass proxy at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 316 hot and cold states move the jar and mercury in compensating directions', () => {
  const model = createMovementModel(catalog.movements[315]);
  const {
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const neutral = stateAtTime(canonicalTimes.neutralHeating);
  const hot = stateAtTime(canonicalTimes.hot);
  const cold = stateAtTime(canonicalTimes.cold);

  assert.equal(neutral.temperatureState, 'neutral');
  assert.equal(hot.temperatureState, 'warming-expanded');
  assert.equal(cold.temperatureState, 'cooling-contracted');
  near(hot.temperature,
    geometry.nominalTemperature + geometry.temperatureAmplitude, 0,
  'hot temperature');
  near(cold.temperature,
    geometry.nominalTemperature - geometry.temperatureAmplitude, 0,
  'cold temperature');
  near(hot.rodExtension, geometry.maximumRodExtension, 0,
    'hot rod extension');
  near(cold.rodExtension, -geometry.maximumRodExtension, 0,
    'cold rod contraction');
  assert.ok(hot.massProperties.rodLength > neutral.massProperties.rodLength);
  assert.ok(cold.massProperties.rodLength < neutral.massProperties.rodLength);
  assert.ok(hot.massProperties.jarCenterDistance
    > neutral.massProperties.jarCenterDistance);
  assert.ok(cold.massProperties.jarCenterDistance
    < neutral.massProperties.jarCenterDistance);
  assert.ok(hot.fillHeight > neutral.fillHeight);
  assert.ok(cold.fillHeight < neutral.fillHeight);
  assert.ok(hot.mercuryTopDistance < neutral.mercuryTopDistance,
    'hot mercury surface rises toward the pivot despite the descending jar');
  assert.ok(cold.mercuryTopDistance > neutral.mercuryTopDistance,
    'cold mercury surface lowers away from the pivot');
  assert.ok(hot.massProperties.mercuryCenterDistance
    < neutral.massProperties.mercuryCenterDistance);
  assert.ok(cold.massProperties.mercuryCenterDistance
    > neutral.massProperties.mercuryCenterDistance);
  assert.ok(hot.centerOfMassDistance < neutral.centerOfMassDistance);
  assert.ok(cold.centerOfMassDistance > neutral.centerOfMassDistance);

  near(hot.swingAngle, 0, 4e-17, 'hot comparison is vertical');
  near(cold.swingAngle, 0, 1e-16, 'cold comparison is vertical');
  assert.ok(hot.glassJarCenter.position.y
    < neutral.glassJarCenter.position.y);
  assert.ok(cold.glassJarCenter.position.y
    > neutral.glassJarCenter.position.y);
  vectorNear(hot.centerOfOscillation.position,
    neutral.centerOfOscillation.position, 4e-16,
  'hot center of oscillation');
  vectorNear(cold.centerOfOscillation.position,
    neutral.centerOfOscillation.position, 8e-16,
  'cold center of oscillation');
  disposeModel(model.root);
});

test('movement 316 swings the entire compensated assembly rigidly about one fixed pivot', () => {
  const model = createMovementModel(catalog.movements[315]);
  const {
    geometry,
    stateAtTime,
  } = model.root.userData;

  near(stateAtTime(0.5).swingAngle, geometry.swingAmplitude, 0,
    'first right extreme');
  near(stateAtTime(1.5).swingAngle, -geometry.swingAmplitude, 0,
    'first left extreme');
  near(stateAtTime(2.5).swingAngle, geometry.swingAmplitude, 0,
    'second right extreme');
  near(stateAtTime(3.5).swingAngle, -geometry.swingAmplitude, 0,
    'second left extreme');

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(
      geometry.thermalCyclePeriod * sample / 16384,
    );
    near(state.rodEnd.position.distanceTo(geometry.pivot),
      state.massProperties.rodLength, 2e-15,
    `rod-end radius at ${sample}`);
    near(state.glassJarCenter.position.distanceTo(geometry.pivot),
      state.massProperties.jarCenterDistance, 2e-15,
    `jar-center radius at ${sample}`);
    near(state.mercuryCenter.position.distanceTo(geometry.pivot),
      state.massProperties.mercuryCenterDistance, 2e-15,
    `mercury-center radius at ${sample}`);
    near(state.centerOfOscillation.position.distanceTo(geometry.pivot),
      geometry.referenceEffectiveLength, 2e-15,
    `center-of-oscillation radius at ${sample}`);
    near(state.rodEnd.position.z, 0, 0,
      `planar rod at ${sample}`);
    near(state.mercuryCenter.position.z, 0, 0,
      `planar mercury at ${sample}`);
  }

  for (const time of [0.07, 0.64, 1.28, 2.19, 3.73]) {
    const state = stateAtTime(time);
    const closure = stateAtTime(time + geometry.thermalCyclePeriod);
    near(closure.unwrappedThermalAngle - state.unwrappedThermalAngle,
      Math.PI * 2, 3e-15, `one thermal turn at ${time}`);
    near(closure.swingAngle, state.swingAngle, 8e-16,
      `two-swing closure at ${time}`);
    vectorNear(closure.rodEnd.position, state.rodEnd.position,
      8e-15, `rod closure at ${time}`);
    vectorNear(closure.mercuryTop.position, state.mercuryTop.position,
      8e-15, `fluid closure at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 316 analytic thermal and pendulum rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[315]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 1e-5;

  for (const time of [0.17, 0.43, 0.91, 1.37, 2.22, 3.51]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.fillHeight - before.fillHeight) / (2 * epsilon),
      state.fillHeightVelocity, 7e-10,
    `fill velocity at ${time}`);
    near((after.fillHeightVelocity - before.fillHeightVelocity)
        / (2 * epsilon),
      state.fillHeightAcceleration, 1.1e-9,
    `fill acceleration at ${time}`);
    near((after.swingAngle - before.swingAngle) / (2 * epsilon),
      state.swingAngularVelocity, 5e-10,
    `swing angular velocity at ${time}`);
    near((after.swingAngularVelocity - before.swingAngularVelocity)
        / (2 * epsilon),
      state.swingAngularAcceleration, 2e-9,
    `swing angular acceleration at ${time}`);
    vectorNear(after.mercuryCenter.position.clone()
      .sub(before.mercuryCenter.position)
      .multiplyScalar(1 / (2 * epsilon)),
    state.mercuryCenter.velocity, 1.1e-9,
    `mercury center velocity at ${time}`);
    vectorNear(after.mercuryCenter.velocity.clone()
      .sub(before.mercuryCenter.velocity)
      .multiplyScalar(1 / (2 * epsilon)),
    state.mercuryCenter.acceleration, 4e-9,
    `mercury center acceleration at ${time}`);
    vectorNear(after.rodEnd.position.clone().sub(before.rodEnd.position)
      .multiplyScalar(1 / (2 * epsilon)),
    state.rodEnd.velocity, 1.5e-9,
    `rod-end velocity at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 316 renderer exposes the moving level and fixed effective-length datum', () => {
  const model = createMovementModel(catalog.movements[315]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const jarWorld = new THREE.Vector3();
  const mercuryWorld = new THREE.Vector3();
  const surfaceWorld = new THREE.Vector3();
  const datumWorld = new THREE.Vector3();

  assert.equal(blocks.glassJar.material.transparent, true);
  assert.ok(blocks.glassJar.material.opacity < 0.5);
  assert.equal(blocks.compensationDatumRing.userData.nonPhysicalReference,
    true);
  assert.equal(blocks.centerOfOscillationMarker.userData
    .nonPhysicalReference, true);
  assert.equal(blocks.compensationDatumRing.castShadow, false);
  assert.equal(model.root.userData.groundFloorY, -5.30);
  assert.ok(model.root.userData.cameraFitBounds.isBox3);
  assert.ok(model.root.userData.cameraFitBounds.max.x > 4);

  for (const time of [
    canonicalTimes.neutralHeating,
    canonicalTimes.hot,
    canonicalTimes.neutralCooling,
    canonicalTimes.cold,
    canonicalTimes.cycleClosure,
    0.43,
    2.71,
  ]) {
    const expected = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.pendulumCarrier.rotation.z, expected.swingAngle, 0,
      `rendered swing at ${time}`);
    near(blocks.rod.scale.y, expected.massProperties.rodLength, 0,
      `rendered rod length at ${time}`);
    near(blocks.jarAssembly.position.y,
      -expected.massProperties.jarCenterDistance, 0,
    `rendered jar travel at ${time}`);
    near(blocks.mercuryColumn.scale.y, expected.fillHeight, 0,
      `rendered mercury height at ${time}`);
    blocks.glassJar.getWorldPosition(jarWorld);
    blocks.mercuryColumn.getWorldPosition(mercuryWorld);
    blocks.mercurySurface.getWorldPosition(surfaceWorld);
    blocks.centerOfOscillationMarker.getWorldPosition(datumWorld);
    vectorNear(jarWorld, expected.glassJarCenter.position, 2e-15,
      `rendered jar center at ${time}`);
    vectorNear(mercuryWorld, expected.mercuryCenter.position, 2e-15,
      `rendered mercury center at ${time}`);
    vectorNear(surfaceWorld, expected.mercuryTop.position, 2e-15,
      `rendered mercury top at ${time}`);
    vectorNear(datumWorld, expected.centerOfOscillation.position, 2e-15,
      `rendered effective-length datum at ${time}`);
    near(model.root.userData.compensationState
      .centerOfOscillationError, 0, 3e-15,
    `published compensation at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 316 closes its four-second demonstration and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[315]);
  const {
    animationTiming,
    geometry,
    timeline,
  } = model.root.userData;

  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.equal(timeline.demonstrationPeriod,
    geometry.thermalCyclePeriod);
  assert.deepEqual(timeline.schedule, [
    'neutral-rod-and-reference-mercury-level',
    'warming-elongates-rod-and-lowers-glass-jar',
    'mercury-expansion-raises-fluid-level-and-aggregate-center',
    'center-of-oscillation-remains-at-fixed-effective-length',
    'cooling-contracts-rod-and-lowers-mercury-relative-to-jar',
    'pendulum-completes-two-visible-swings-per-thermal-cycle',
  ]);

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
