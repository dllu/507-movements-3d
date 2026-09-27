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
  'horizontal-overshot-water-wheel-with-falling-tangential-jet-driving-scoops-on-vertical-shaft';
const FULL_TURN = Math.PI * 2;

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
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

test('movement 433 is a horizontal sixteen-board runner rigidly fixed to a vertical shaft beneath an elevated flume', () => {
  const movement = catalog.movements[432];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 433);
  assert.equal(movement.number, '433');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /elevated flume sends a falling jet.*scoop-like radial blades/);
  assert.match(data.mechanism, /runs with the floats at impact, slanting inward/);
  assert.match(data.mechanism, /clockwise \(negative-about-y\) torque about the vertical shaft/);
  assert.match(data.mechanism, /rotate as one body about the vertical axis/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.jetFlowIndependent, false);
  assert.equal(degreesOfFreedom.shaftAndRunnerIndependent, false);
  assert.equal(geometry.bladeCount, 16);
  assert.equal(blocks.bladeGroups.length, 16);
  for (const blade of blocks.bladeGroups) assert.equal(blade.parent, blocks.rotor);
  for (const rotating of [blocks.hub, blocks.hubRing, blocks.shaft,
    blocks.rotationMarker]) assert.equal(rotating.parent, blocks.rotor);
  for (const fixed of [blocks.flume, blocks.flumeWater, blocks.jet,
    blocks.contactMarker, blocks.lowerBearing, blocks.upperBearing,
    blocks.overheadBeam, blocks.bearingCone, blocks.splashBasin,
    blocks.foundation]) assert.equal(fixed.parent, model.root);
  assert.ok(geometry.flumeUpstreamPoint.y > geometry.nozzlePoint.y);
  assert.ok(geometry.nozzlePoint.y > geometry.impactPoint.y);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(roles.filter((role) =>
    /^horizontal-overshot-scoop-blade-\d+-of-sixteen$/.test(role)).length,
  16);
  for (const role of [
    'horizontal-runner-turning-with-vertical-output-shaft',
    'rotating-vertical-output-shaft',
    'fixed-overhead-vertical-shaft-bearing',
    'inclined-fixed-headrace-flume-above-horizontal-wheel',
    'falling-tangential-jet-striking-horizontal-scoop-wheel',
    'fixed-shallow-basin-receiving-horizontal-wheel-discharge',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 433 records the sparse static source honestly and discloses uncertain count and direction', () => {
  const movement = catalog.movements[432];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate433;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_433.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(movement.description, '433. Horizontal overshot water-wheel.');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and three-word caption.*no Canvas construction/);
  assert.equal(dynamics.fluidPressureViscosityTurbulenceSplashLeakageBladeImpactBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled,
    false);
  assert.match(dynamics.jetMomentumDiagnostic,
    /horizontal component follows the floats’ motion at impact with an inward slant.*y-axis moment is negative/);
  assert.match(dynamics.smoothBladeHandoff,
    /two neighboring scoop indices.*complementary quintic weights/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.shaftAtRunnerApproximatePixels, [256, 370]);
  assert.deepEqual(plate.upperBearingApproximatePixels, [256, 82]);
  assert.deepEqual(plate.nozzleOutletApproximatePixels, [384, 244]);
  assert.deepEqual(plate.approximateImpactPixels, [305, 350]);
  assert.equal(plate.approximateBladeCount, 16);
  assert.deepEqual(evidence.explicitInBrownDescription,
    ['the mechanism is a horizontal overshot water-wheel']);
  assert.match(evidence.engravingEvidence,
    /horizontal radial scoop runner.*vertical shaft.*elevated oblique flume/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions, exact scoop count.*direction arrow.*independently engineered/);
  disposeModel(model.root);
});

test('movement 433 source pose spaces all scoop blades uniformly in one horizontal plane', () => {
  const model = createMovementModel(catalog.movements[432]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.wheelAngle, 0, 0, 'source runner angle');
  assert.equal(sourcePose.blades.length, geometry.bladeCount);
  vectorNear(sourcePose.impactPoint, geometry.impactPoint, 0,
    'source jet impact');
  vectorNear(sourcePose.nozzlePoint, geometry.nozzlePoint, 0,
    'source nozzle');
  for (let index = 0; index < geometry.bladeCount; index += 1) {
    const blade = source.blades[index];
    const next = source.blades[(index + 1) % geometry.bladeCount];
    near(blade.center.y, 0, 0, `blade ${index + 1} horizontal plane`);
    near(blade.center.length(), geometry.bladeCenterRadius, 4.5e-16,
      `blade ${index + 1} center radius`);
    near(THREE.MathUtils.euclideanModulo(
      next.worldAngle - blade.worldAngle,
      FULL_TURN,
    ), geometry.bladePitch, 1.8e-15, `blade ${index + 1} pitch`);
    vectorNear(sourcePose.blades[index].center, blade.center, 0,
      `source blade ${index + 1}`);
  }
  disposeModel(model.root);
});

test('movement 433 every scoop and the vertical shaft rotate as one rigid horizontal runner', () => {
  const model = createMovementModel(catalog.movements[432]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const inputAngle = FULL_TURN * sample / 10000;
    const state = stateAtInputAngle(inputAngle);
    // Pass 70: the runner turns clockwise seen from above (negative about y),
    // so the struck water is carried round the right and front, as drawn.
    sameAngle(state.wheelAngle, -inputAngle, 5e-15,
      'negative y-axis runner coordinate');
    assert.ok(state.wheelAngularSpeed < 0);
    for (const blade of state.blades) {
      sameAngle(blade.worldAngle,
        blade.localAngle + state.wheelAngle, 5e-15,
        'rigid scoop attachment');
      near(blade.center.length(), geometry.bladeCenterRadius, 4.5e-16,
        'scoop center remains radial');
      near(blade.center.y, 0, 0, 'scoop remains horizontal');
    }
  }
  disposeModel(model.root);
});

test('movement 433 falling jet runs with the floats, slants inward and drives the runner clockwise', () => {
  const model = createMovementModel(catalog.movements[432]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);
  const radial = new THREE.Vector3(
    Math.cos(geometry.impactAngle),
    0,
    -Math.sin(geometry.impactAngle),
  );
  // Direction of float motion at the strike: the runner turns clockwise.
  const motion = new THREE.Vector3(
    Math.sin(geometry.impactAngle),
    0,
    Math.cos(geometry.impactAngle),
  );
  const horizontalForce = source.jetForce.clone();
  horizontalForce.y = 0;
  const slant = Math.hypot(1, 0.7);

  near(source.jetDirection.length(), 1, 2.3e-16, 'unit jet direction');
  assert.ok(source.jetDirection.y < 0, 'jet falls downward');
  near(horizontalForce.clone().normalize().dot(motion), 1 / slant, 1e-12,
    'horizontal jet component runs with the floats');
  near(horizontalForce.clone().normalize().dot(radial), -0.7 / slant, 1e-12,
    'and slants inward toward the shaft');
  near(source.tangentialJetForceNormalized,
    source.jetForce.dot(motion), 1e-12, 'tangential force projection');
  const reconstructedTorque = new THREE.Vector3()
    .crossVectors(source.impactPoint, source.jetForce).y;
  near(source.impulseTorqueNormalized, reconstructedTorque, 0,
    'exact y-axis jet moment');
  assert.ok(source.impulseTorqueNormalized < -18.9, 'clockwise drive');
  assert.ok(source.impulseTorqueNormalized * source.wheelAngularSpeed > 0, 'torque drives the runner its way');
  for (const angle of [-8, -1, 0, 0.7, 2.8, 9]) {
    near(stateAtInputAngle(angle).impulseTorqueNormalized,
      source.impulseTorqueNormalized, 0,
      'fixed jet torque does not jump between scoops');
  }
  disposeModel(model.root);
});

test('movement 433 jet engagement transfers smoothly between neighboring scoops and always sums to one', () => {
  const model = createMovementModel(catalog.movements[432]);
  const { geometry, jetSharesAtWheelAngle } = model.root.userData;
  let previous = jetSharesAtWheelAngle(0).shares;
  let maximumShareStep = 0;

  for (let sample = 0; sample <= 100000; sample += 1) {
    const angle = FULL_TURN * sample / 100000;
    const sharing = jetSharesAtWheelAngle(angle);
    near(sharing.shares.reduce((sum, share) => sum + share, 0),
      1, 0, 'partition of unity');
    assert.ok(sharing.shares.every((share) => share >= 0 && share <= 1));
    assert.ok(sharing.shares.filter((share) => share > 1e-15).length <= 2);
    if (sample > 0) {
      for (let index = 0; index < geometry.bladeCount; index += 1) {
        maximumShareStep = Math.max(
          maximumShareStep,
          Math.abs(sharing.shares[index] - previous[index]),
        );
      }
    }
    previous = sharing.shares;
  }
  // Scales with blade count (16 blades share each turn).
  assert.ok(maximumShareStep < 3.1e-4);
  const source = jetSharesAtWheelAngle(0).shares;
  const closure = jetSharesAtWheelAngle(FULL_TURN).shares;
  source.forEach((share, index) => near(closure[index], share, 1e-30,
    `blade ${index + 1} engagement cycle closure`)); // denormal residue at 16 blades
  disposeModel(model.root);
});

test('movement 433 analytic rim and scoop motion matches finite differences in the horizontal plane', () => {
  const model = createMovementModel(catalog.movements[432]);
  const { stateAtInputAngle } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.17, 0.54, 0.93, 1.38, 1.84, 2.31,
    2.79, 3.27, 3.74, 4.22, 4.69, 5.16, 5.63, 6.09]) {
    const state = stateAtInputAngle(angle);
    const timeStep = angleStep / state.inputSpeed;
    const before = stateAtInputAngle(angle - angleStep);
    const after = stateAtInputAngle(angle + angleStep);
    const numericalRimVelocity = after.rimReferencePoint.clone()
      .sub(before.rimReferencePoint).multiplyScalar(1 / (2 * timeStep));
    const numericalRimAcceleration = after.rimReferenceVelocity.clone()
      .sub(before.rimReferenceVelocity)
      .multiplyScalar(1 / (2 * timeStep));
    vectorNear(numericalRimVelocity, state.rimReferenceVelocity, 5e-10,
      `rim velocity at ${angle}`);
    vectorNear(numericalRimAcceleration,
      state.rimReferenceAcceleration, 7e-10,
      `rim acceleration at ${angle}`);
    for (const index of [0, 4, 8]) {
      const numericalBladeVelocity = after.blades[index].center.clone()
        .sub(before.blades[index].center)
        .multiplyScalar(1 / (2 * timeStep));
      const numericalBladeAcceleration =
        after.blades[index].centerVelocity.clone()
          .sub(before.blades[index].centerVelocity)
          .multiplyScalar(1 / (2 * timeStep));
      vectorNear(numericalBladeVelocity,
        state.blades[index].centerVelocity, 4e-10,
        `scoop ${index + 1} velocity at ${angle}`);
      vectorNear(numericalBladeAcceleration,
        state.blades[index].centerAcceleration, 7e-10,
        `scoop ${index + 1} acceleration at ${angle}`);
    }
  }
  disposeModel(model.root);
});

test('movement 433 update rotates only the runner while jet, flume, bearings, and basin remain fixed', () => {
  const model = createMovementModel(catalog.movements[432]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedBlocks = [blocks.flume, blocks.flumeWater, blocks.jet,
    blocks.contactMarker, blocks.lowerBearing, blocks.upperBearing,
    blocks.overheadBeam, blocks.bearingCone, blocks.splashBasin,
    blocks.foundation];
  const fixedTransforms = fixedBlocks.map((block) => ({
    position: block.position.clone(),
    quaternion: block.quaternion.clone(),
  }));

  for (const time of [0, 0.23, 0.61, 1.04, 1.49, 1.97, 2.44,
    2.91, 3.39, 3.86, 4.34, 4.82, 5.21]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.rotor.rotation.y, state.wheelAngle, 1.2e-16,
      'horizontal runner update');
    fixedBlocks.forEach((block, index) => {
      vectorNear(block.position, fixedTransforms[index].position, 0,
        'fixed apparatus position');
      near(block.quaternion.angleTo(fixedTransforms[index].quaternion),
        0, 5e-8, 'fixed apparatus orientation');
    });
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  vectorNear(closure.rimReferencePoint, source.rimReferencePoint, 0,
    'runner cycle closure');
  near(closure.impulseTorqueNormalized,
    source.impulseTorqueNormalized, 0, 'jet torque cycle closure');
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 5.4);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 433 horizontal-wheel geometry', () => {
  const movement433 = catalog.movements[432];
  const movement507 = catalog.movements[506];
  const model433 = createMovementModel(movement433);
  const model507 = createMovementModel(movement507);

  assert.equal(movement433.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model433.root);
  disposeModel(model507.root);
});
