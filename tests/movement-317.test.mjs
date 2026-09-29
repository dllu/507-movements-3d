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

test('movement 317 is Brown’s complete compound-bar compensation pendulum', () => {
  const movement = catalog.movements[316];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    massModel,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 317);
  assert.equal(movement.number, '317');
  assert.equal(movement.title, 'Compound bar compensation pendulum');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'compound-bimetal-bar-constant-center-of-oscillation-pendulum');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /lower brass layer expands more/);
  assert.match(mechanism, /lifting both W weights/);
  assert.match(mechanism, /I divided by total first moment/);
  assert.match(mechanism, /center of oscillation/);
  assert.equal(transmission.brassLayer, 'lower high-expansion layer');
  assert.equal(transmission.ironOrSteelLayer,
    'upper low-expansion layer');
  assert.equal(transmission.symmetricEndWeights, 2);
  assert.match(transmission.compensationTarget,
    /physical-pendulum effective length/);
  assert.equal(massModel.compoundBar.brassLayerBelowSteel, true);
  assert.equal(massModel.eachEndWeight.count, 2);
  assert.equal(massModel.totalMass,
    massModel.rod.mass + massModel.mainBob.mass
      + 2 * massModel.eachEndWeight.mass);

  // Brown draws the rod running out of the top of the plate: source
  // presentation removes the undrawn suspension frame and pivot hub.
  assert.equal(blocks.fixedFrame.parent, null);
  assert.equal(blocks.movingPivotHub.parent, null);
  assert.equal(blocks.pendulumCarrier.parent, model.root);
  assert.equal(blocks.compoundBar.parent, blocks.pendulumCarrier);
  assert.equal(blocks.mainBob.parent, blocks.pendulumCarrier);
  // White motion indices and the bob hub are not drawn on the plate.
  assert.equal(blocks.mainBobWitness.parent, null);
  assert.equal(blocks.mainBobHub.parent, null);
  assert.equal(blocks.leftEndWeight.witness.parent, null);
  assert.equal(blocks.rightEndWeight.witness.parent, null);
  assert.equal(blocks.rod.parent, blocks.pendulumCarrier);
  assert.equal(blocks.leftEndWeight.group.parent,
    blocks.pendulumCarrier);
  assert.equal(blocks.rightEndWeight.group.parent,
    blocks.pendulumCarrier);
  // p104: each lamina is one bent strip running through both W weights.
  assert.equal(blocks.segmentMeshes.length, 1);
  assert.equal(blocks.steelLamina.parent, blocks.compoundBar);
  // W's passage fits the two-layer bar section (it was 0.31 for 0.21).
  for (const weight of [blocks.leftEndWeight, blocks.rightEndWeight]) {
    const { passage } = weight.block.userData;
    const thickness = model.root.userData.geometry.layerThickness;
    assert.ok(passage.top - passage.bottom - 2 * thickness < 0.06);
    assert.ok(passage.halfDepth - model.root.userData.geometry.layerDepth / 2
      <= 0.005);
    assert.equal(weight.outerStem.parent, null);
  }
  // Rod, C, lower screw and nut all lie on the mechanism plane z = 0.
  for (const part of [blocks.rod, blocks.lowerThread, blocks.lowerAdjuster,
    blocks.mainBob]) {
    assert.equal(part.position.z, 0);
  }
  assert.equal(blocks.brassLamina.parent, blocks.compoundBar);
  assert.equal(blocks.pivotBrackets.length, 2);
  assert.deepEqual(blocks.pendulumCarrier.userData.axis,
    new THREE.Vector3(0, 0, 1));

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'upper-iron-or-steel-layer-of-compound-bar').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'lower-brass-layer-of-compound-bar').length, 1);
  // C is part of the flat rod; no separate clamp block or bar stubs.
  assert.equal(roles.filter((role) =>
    role === 'center-clamp-C-brazed-to-pendulum-rod').length, 0);
  assert.equal(roles.filter((role) =>
    role === 'compound-bar-projecting-end').length, 0);
  assert.equal(roles.filter((role) =>
    role === 'adjustable-compensation-weight-W').length, 2);
  assert.equal(roles.filter((role) =>
    role === 'end-weight-W-set-screw').length, 2);
  assert.equal(roles.filter((role) =>
    role === 'white-end-weight-motion-index').length, 0);
  assert.equal(roles.some((role) => /generic|procedural/.test(role)), false);
  disposeModel(model.root);
});

test('movement 317 records the proportions and cropped suspension on Brown’s plate', () => {
  const movement = catalog.movements[316];
  const model = createMovementModel(movement);
  const {
    geometry,
    sourceAnimation,
    sourcePointToNeutralFront,
    sourceReference,
    stateAtTime,
  } = model.root.userData;
  const plate = sourceReference.brownPlate317;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.referenceScope, /cropped central rod/);
  assert.match(sourceAnimation.referenceScope, /brass downward/);
  assert.match(sourceAnimation.referenceScope, /weights W/);
  assert.match(sourceAnimation.referenceScope, /not dimensioned/);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_317.html');
  assert.equal(sourceReference.officialDescription, movement.description);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 10);
  assert.deepEqual(plate.rasterVisibleRodTop,
    new THREE.Vector2(265, 15));
  assert.deepEqual(plate.rasterBarCenter,
    new THREE.Vector2(265, 200));
  assert.deepEqual(plate.rasterLeftWeightCenter,
    new THREE.Vector2(60, 177));
  assert.deepEqual(plate.rasterRightWeightCenter,
    new THREE.Vector2(464, 177));
  assert.deepEqual(plate.rasterMainBobTopLeft,
    new THREE.Vector2(169, 214));
  assert.deepEqual(plate.rasterMainBobBottomRight,
    new THREE.Vector2(360, 460));
  assert.deepEqual(plate.rasterRodEnd,
    new THREE.Vector2(264, 520));
  assert.match(plate.inferredTopology, /brass-under-steel/);
  assert.match(plate.inferredTopology, /two symmetric adjustable weights/);
  assert.ok(geometry.unshownUpperRodLength > 0,
    'the cropped plate edge is not misidentified as the pivot');

  near((plate.rasterMainBobBottomRight.y
      - plate.rasterMainBobTopLeft.y) * geometry.sourceScale,
    geometry.mainBobHeight, 0, 'source main-bob height');
  near((plate.rasterMainBobBottomRight.x
      - plate.rasterMainBobTopLeft.x) * geometry.sourceScale,
    geometry.mainBobWidth, 0, 'source main-bob width');
  near((plate.rasterRightWeightCenter.x
      - plate.rasterLeftWeightCenter.x) * geometry.sourceScale / 2,
    geometry.barHalfSpan, 0, 'source bar half-span');
  near((plate.rasterBarCenter.y
      - plate.rasterLeftWeightCenter.y) * geometry.sourceScale,
    geometry.referenceBarEndLift, 1e-15, 'source upward end bow');

  const neutral = stateAtTime(0);
  const sourceTolerance = plate.measurementUncertaintyPixels
    * geometry.sourceScale;
  vectorNear(sourcePointToNeutralFront(plate.rasterBarCenter),
    neutral.barCenter.position, sourceTolerance,
  'source center of compound bar');
  vectorNear(sourcePointToNeutralFront(plate.rasterRodEnd),
    neutral.rodEnd.position, sourceTolerance,
  'source visible rod end');
  vectorNear(sourcePointToNeutralFront(plate.rasterLeftWeightCenter),
    neutral.leftWeight.position, sourceTolerance,
  'source left weight');
  vectorNear(sourcePointToNeutralFront(plate.rasterRightWeightCenter),
    neutral.rightWeight.position, sourceTolerance,
  'source right weight');
  const sourceMainBobCenter = sourcePointToNeutralFront(
    plate.rasterMainBobTopLeft.clone()
      .add(plate.rasterMainBobBottomRight).multiplyScalar(0.5),
  );
  vectorNear(sourceMainBobCenter, neutral.mainBobCenter.position,
    sourceTolerance, 'source main-bob center');
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 79,
    edition: 21,
    illustrationPage: 78,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 317 solves constant physical-pendulum effective length over the full thermal range', () => {
  const model = createMovementModel(catalog.movements[316]);
  const {
    geometry,
    massModel,
    massProperties,
    weightStateAtRodExtension,
  } = model.root.userData;
  let previousExtension = -Infinity;
  let previousLift = -Infinity;
  let previousWeightDistance = Infinity;

  for (let sample = 0; sample <= 32768; sample += 1) {
    const coordinate = -1 + 2 * sample / 32768;
    const rodExtension = geometry.maximumRodExtension * coordinate;
    const weight = weightStateAtRodExtension(rodExtension);
    const properties = massProperties(
      rodExtension,
      weight.weightDistance,
    );
    assert.ok(weight.discriminant > 0,
      `long-radius weight root exists at ${sample}`);
    assert.ok(weight.upperRoot > geometry.referenceEffectiveLength / 2,
      `Brown long-radius branch selected at ${sample}`);
    assert.ok(weight.lowerRoot < geometry.referenceEffectiveLength / 2,
      `short-radius mathematical branch rejected at ${sample}`);
    assert.ok(weight.barEndLift > 0,
      `compound bar remains upward-bowed at ${sample}`);
    assert.ok(rodExtension > previousExtension || sample === 0);
    assert.ok(weight.barEndLift > previousLift || sample === 0,
      `bar lift grows monotonically with heat at ${sample}`);
    assert.ok(weight.weightDistance < previousWeightDistance || sample === 0,
      `both W weights rise monotonically with heat at ${sample}`);
    previousExtension = rodExtension;
    previousLift = weight.barEndLift;
    previousWeightDistance = weight.weightDistance;
    near(properties.effectiveLength,
      geometry.referenceEffectiveLength, 4e-15,
    `effective length at ${sample}`);
    near(properties.inertia,
      geometry.referenceEffectiveLength * properties.firstMoment,
      5e-13, `compound-pendulum equation at ${sample}`);
    near(properties.totalMass, massModel.totalMass, 0,
      `constant aggregate mass at ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 317 heating bows brass-under-steel bar C upward and lifts both W weights', () => {
  const model = createMovementModel(catalog.movements[316]);
  const { canonicalTimes, geometry, stateAtTime } = model.root.userData;
  const neutral = stateAtTime(canonicalTimes.neutralHeating);
  const hot = stateAtTime(canonicalTimes.hot);
  const cold = stateAtTime(canonicalTimes.cold);

  assert.equal(neutral.temperatureState, 'neutral');
  assert.equal(hot.temperatureState, 'hot-bar-curved-upward');
  assert.equal(cold.temperatureState, 'cold-bar-relaxed-downward');
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
  assert.ok(hot.massProperties.rodLength
    > neutral.massProperties.rodLength);
  assert.ok(cold.massProperties.rodLength
    < neutral.massProperties.rodLength);
  assert.ok(hot.barCenterDistance > neutral.barCenterDistance,
    'the hot rod carries C downward');
  assert.ok(cold.barCenterDistance < neutral.barCenterDistance,
    'the cold rod carries C upward');
  assert.ok(hot.barEndLift > neutral.barEndLift);
  assert.ok(cold.barEndLift < neutral.barEndLift);
  assert.ok(hot.weightDistance < neutral.weightDistance,
    'differential expansion raises W toward the pivot');
  assert.ok(cold.weightDistance > neutral.weightDistance,
    'cooling lowers W away from the pivot');
  near(hot.leftWeight.position.y, hot.rightWeight.position.y, 0,
    'hot end-weight symmetry');
  near(cold.leftWeight.position.y, cold.rightWeight.position.y, 0,
    'cold end-weight symmetry');
  near(hot.leftWeight.position.x, -hot.rightWeight.position.x, 0,
    'hot bilateral symmetry');
  assert.ok(hot.centerOfMassDistance < neutral.centerOfMassDistance,
    'the aggregate center rises when hot');
  assert.ok(cold.centerOfMassDistance > neutral.centerOfMassDistance,
    'the aggregate center lowers when cold');
  vectorNear(hot.centerOfOscillation.position,
    neutral.centerOfOscillation.position, 4e-16,
  'hot center of oscillation');
  vectorNear(cold.centerOfOscillation.position,
    neutral.centerOfOscillation.position, 8e-16,
  'cold center of oscillation');
  disposeModel(model.root);
});

test('movement 317 swings one rigid compensated assembly and its parabolic bar joins both weights continuously', () => {
  const model = createMovementModel(catalog.movements[316]);
  const { geometry, stateAtTime } = model.root.userData;

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
      state.massProperties.rodLength, 3e-15,
    `rod radius at ${sample}`);
    near(state.mainBobCenter.position.distanceTo(geometry.pivot),
      state.massProperties.mainBobCenterDistance, 3e-15,
    `main-bob radius at ${sample}`);
    near(state.centerOfOscillation.position.distanceTo(geometry.pivot),
      geometry.referenceEffectiveLength, 3e-15,
    `center-of-oscillation radius at ${sample}`);
    vectorNear(state.barPointAtNormalizedX(-1).position,
      state.leftWeight.position, 3e-15,
    `left continuous bar end at ${sample}`);
    vectorNear(state.barPointAtNormalizedX(1).position,
      state.rightWeight.position, 3e-15,
    `right continuous bar end at ${sample}`);
    vectorNear(state.barPointAtNormalizedX(0).position,
      state.barCenter.position, 3e-15,
    `center-fastened bar C at ${sample}`);
    near(state.barPointAtNormalizedX(-0.5).distance,
      state.barPointAtNormalizedX(0.5).distance, 0,
    `symmetric parabola at ${sample}`);
  }

  for (const time of [0.07, 0.64, 1.28, 2.19, 3.73]) {
    const state = stateAtTime(time);
    const closure = stateAtTime(time + geometry.thermalCyclePeriod);
    near(closure.unwrappedThermalAngle - state.unwrappedThermalAngle,
      Math.PI * 2, 3e-15, `one thermal turn at ${time}`);
    near(closure.swingAngle, state.swingAngle, 8e-16,
      `two-swing closure at ${time}`);
    vectorNear(closure.leftWeight.position, state.leftWeight.position,
      2e-14, `left W closure at ${time}`);
    vectorNear(closure.rightWeight.position, state.rightWeight.position,
      2e-14, `right W closure at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 317 analytic thermal, bar, weight, and swing rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[316]);
  const { stateAtTime } = model.root.userData;
  const epsilon = 1e-5;

  for (const time of [0.17, 0.43, 0.91, 1.37, 2.22, 3.51]) {
    const before = stateAtTime(time - epsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + epsilon);
    near((after.weightDistance - before.weightDistance) / (2 * epsilon),
      state.weightDistanceVelocity, 2e-9,
    `weight velocity at ${time}`);
    near((after.weightDistanceVelocity - before.weightDistanceVelocity)
        / (2 * epsilon),
      state.weightDistanceAcceleration, 2e-9,
    `weight acceleration at ${time}`);
    near((after.barEndLift - before.barEndLift) / (2 * epsilon),
      state.barEndLiftVelocity, 2e-9,
    `bar-lift velocity at ${time}`);
    near((after.barEndLiftVelocity - before.barEndLiftVelocity)
        / (2 * epsilon),
      state.barEndLiftAcceleration, 2e-9,
    `bar-lift acceleration at ${time}`);
    near((after.swingAngle - before.swingAngle) / (2 * epsilon),
      state.swingAngularVelocity, 5e-10,
    `swing angular velocity at ${time}`);
    near((after.swingAngularVelocity - before.swingAngularVelocity)
        / (2 * epsilon),
      state.swingAngularAcceleration, 2e-9,
    `swing angular acceleration at ${time}`);
    vectorNear(after.leftWeight.position.clone()
      .sub(before.leftWeight.position).multiplyScalar(1 / (2 * epsilon)),
    state.leftWeight.velocity, 5e-9,
    `left W velocity at ${time}`);
    vectorNear(after.rightWeight.velocity.clone()
      .sub(before.rightWeight.velocity).multiplyScalar(1 / (2 * epsilon)),
    state.rightWeight.acceleration, 6e-9,
    `right W acceleration at ${time}`);
    vectorNear(after.centerOfMass.position.clone()
      .sub(before.centerOfMass.position).multiplyScalar(1 / (2 * epsilon)),
    state.centerOfMass.velocity, 5e-9,
    `aggregate-center velocity at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 317 renderer keeps brass below steel and binds the live bar, weights, and datum', () => {
  const model = createMovementModel(catalog.movements[316]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const barCenterWorld = new THREE.Vector3();
  const bobWorld = new THREE.Vector3();
  const leftWorld = new THREE.Vector3();
  const rightWorld = new THREE.Vector3();

  assert.equal(blocks.compensationDatum.userData.nonPhysicalReference,
    true);
  assert.equal(blocks.centerOfOscillationMarker.userData
    .nonPhysicalReference, true);
  assert.equal(blocks.compensationDatum.castShadow, false);
  // The non-physical datum and marker are not drawn by Brown.
  assert.equal(blocks.compensationDatum.parent, null);
  assert.equal(blocks.centerOfOscillationMarker.parent, null);
  assert.equal(model.root.userData.groundFloorY, -7.55);
  assert.ok(model.root.userData.cameraFitBounds.isBox3);
  assert.ok(model.root.userData.cameraFitBounds.max.x > 5);

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
    // p104: the flat rod + C stretches so C stays on the bar centre.
    near(blocks.rod.scale.y, (expected.barCenterDistance - 0.25)
      / (geometry.referenceBarCenterDistance - 0.25), 0,
    `rendered rod down to C at ${time}`);
    near(blocks.compoundBar.position.y,
      -expected.barCenterDistance, 0,
    `rendered bar-center travel at ${time}`);
    blocks.compoundBar.getWorldPosition(barCenterWorld);
    blocks.mainBob.getWorldPosition(bobWorld);
    blocks.leftEndWeight.group.getWorldPosition(leftWorld);
    blocks.rightEndWeight.group.getWorldPosition(rightWorld);
    vectorNear(barCenterWorld, expected.barCenter.position, 3e-15,
      `rendered bar center at ${time}`);
    vectorNear(bobWorld, expected.mainBobCenter.position, 3e-15,
      `rendered main bob at ${time}`);
    vectorNear(leftWorld, expected.leftWeight.position, 3e-15,
      `rendered left W at ${time}`);
    vectorNear(rightWorld, expected.rightWeight.position, 3e-15,
      `rendered right W at ${time}`);
    near(model.root.userData.compensationState
      .centerOfOscillationError, 0, 4e-15,
    `published compensation at ${time}`);

    // Brass lies below steel all along the bar: sample the laminae's
    // outer faces at the centre and near each W.
    const steel = blocks.steelLamina.geometry.attributes.position;
    const brass = blocks.brassLamina.geometry.attributes.position;
    const across = (attribute, x, pick) => {
      let best = null;
      for (let i = 0; i < attribute.count; i += 1) {
        if (Math.abs(attribute.getX(i) - x) > 0.05) continue;
        const y = attribute.getY(i);
        best = best === null ? y : pick(best, y);
      }
      return best;
    };
    for (const x of [-3.2, 0, 3.2]) {
      const top = across(steel, x, Math.max);
      const bottom = across(brass, x, Math.min);
      const interfaceY = expected.barEndLift * (x / geometry.barHalfSpan) ** 2;
      assert.equal(steel.getX(0) < 0, true);
      near(top - interfaceY, geometry.layerThickness, 8e-3,
        `steel above the interface at ${x}, ${time}`);
      near(interfaceY - bottom, geometry.layerThickness, 8e-3,
        `brass below the interface at ${x}, ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 317 closes its reviewed cycle and leaves movement 339 as the next authored draft', () => {
  const model = createMovementModel(catalog.movements[316]);
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
    'neutral-compound-bar-matches-Brown-plate',
    'warming-elongates-the-steel-pendulum-rod',
    'brass-underlayer-expands-more-and-curves-bar-C-upward',
    'both-W-weights-rise-to-hold-the-effective-length-fixed',
    'cooling-relaxes-the-bar-and-lowers-both-W-weights',
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
