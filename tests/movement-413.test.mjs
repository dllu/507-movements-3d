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
const ARCHETYPE =
  'nut-compressed-v-edged-rubber-friction-wheel-in-rigid-v-groove-with-adjustable-traction';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
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

test('movement 413 is one nut-compressed V-edged rubber wheel between two metal plates engaging one rigid V groove', () => {
  const movement = catalog.movements[412];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 413);
  assert.equal(movement.number, '413');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /Upper wheel A is one V-edged rubber disk/);
  assert.match(data.mechanism, /threaded nut B advances only the left plate/);
  assert.match(data.mechanism, /exact ratio of the two selected effective pitch radii/);
  assert.equal(degreesOfFreedom.independentSetupCoordinates, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedomWhenTightened, 1);
  assert.equal(degreesOfFreedom.simultaneouslyActiveCoordinates, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.upperRotor.parent, model.root);
  assert.equal(blocks.lowerRotor.parent, model.root);
  assert.equal(blocks.rubberRotor.parent, blocks.upperRotor);
  assert.equal(blocks.leftClampPlate.parent, blocks.upperRotor);
  assert.equal(blocks.rightClampPlate.parent, blocks.upperRotor);
  assert.equal(blocks.adjustmentNut.parent, blocks.upperRotor);
  assert.equal(blocks.leftRubberHalf.parent, blocks.rubberRotor);
  assert.equal(blocks.rightRubberHalf.parent, blocks.rubberRotor);
  assert.equal(blocks.lowerLeftHalf.parent, blocks.lowerRotor);
  assert.equal(blocks.lowerRightHalf.parent, blocks.lowerRotor);
  assert.equal(blocks.contactIndicators.length, 2);
  assert.equal(blocks.nutHandleEnds.length, 2);

  const roles = [];
  const belts = [];
  const gears = [];
  const rubberDisks = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) gears.push(object);
    if (object.userData.role === 'incompressible-v-edged-rubber-disk-A') {
      rubberDisks.push(object);
    }
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  assert.equal(rubberDisks.length, 1);
  for (const role of [
    'upper-adjustable-wheel-and-shaft-A-driver',
    'incompressible-v-edged-rubber-disk-A',
    'nut-driven-left-metal-clamping-plate',
    'fixed-shoulder-right-metal-clamping-plate',
    'threaded-nut-B-advancing-left-clamp-plate',
    'upper-shaft-exposed-adjustment-thread',
    'lower-rigid-v-grooved-friction-wheel-driven-output',
    'left-rigid-v-groove-flank',
    'right-rigid-v-groove-flank',
    'white-upper-rubber-wheel-rotation-index',
    'white-lower-driven-wheel-rotation-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 413 records Brown’s sectional plate, explicit relation to 45, and unavailable-animation boundary', () => {
  const movement = catalog.movements[412];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate413;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_413.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /J\. W\. Howlett’s patent/);
  assert.match(movement.description, /improvement on that shown in 45/);
  assert.match(movement.description, /upper wheel, A, shown in section/);
  assert.match(movement.description, /rubber disk with V-edge/);
  assert.match(movement.description, /clamped between two metal plates/);
  assert.match(movement.description, /screwing up the nut, B/);
  assert.match(movement.description, /expand radially/);
  assert.match(movement.description, /greater tractive power/);
  assert.equal(sourceReference.relatedMovement.id, 45);
  assert.match(sourceReference.relatedMovement.relation,
    /explicitly calls 413 an improvement/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks its Animated control unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.inertiaLoadsComplianceSlipAndWearModeled, false);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.upperRubberWheelApproximateBoundsPixels,
    [199, 75, 304, 270]);
  assert.deepEqual(plate.nutBApproximateBoundsPixels,
    [112, 135, 235, 222]);
  assert.deepEqual(plate.lowerGroovedWheelApproximateBoundsPixels,
    [128, 198, 407, 495]);
  assert.equal(evidence.explicitInBrownDescription.length, 9);
  assert.match(evidence.engravingEvidence,
    /two parallel horizontal shafts.*nut B.*mating V groove/);
  assert.match(evidence.reconstructionDisclosure,
    /Constant rubber-volume scaling/);
  assert.match(evidence.reconstructionDisclosure,
    /does not claim quantitative rubber stress or torque capacity/);
  disposeModel(model.root);
});

test('movement 413 loose upper V profile and lower groove are complementary at every sampled axial station', () => {
  const model = createMovementModel(catalog.movements[412]);
  const { geometry } = model.root.userData;

  near(geometry.upperCenter.distanceTo(geometry.lowerCenter),
    geometry.centerDistance, 0, 'parallel shaft center distance');
  near(geometry.looseRubberCoreRadius + geometry.lowerGrooveLipRadius,
    geometry.centerDistance, 0, 'V shoulder closure');
  near(geometry.looseRubberTipRadius + geometry.lowerGrooveRootRadius,
    geometry.centerDistance, 0, 'V apex closure');
  near(geometry.upperPitchRadius + geometry.lowerPitchRadius,
    geometry.centerDistance, 0, 'effective pitch closure');
  near(geometry.upperPitchRadius, 0.8, 0, 'selected upper pitch radius');
  near(geometry.lowerPitchRadius, 1.2, 3e-16,
    'selected lower pitch radius');
  assert.equal(geometry.contactSamples.length, 8);
  assert.equal(geometry.pitchContacts.length, 2);
  for (const sample of geometry.contactSamples) {
    const upperAxisPoint = new THREE.Vector3(
      sample.axialPosition,
      geometry.upperCenter.y,
      geometry.upperCenter.z,
    );
    const lowerAxisPoint = new THREE.Vector3(
      sample.axialPosition,
      geometry.lowerCenter.y,
      geometry.lowerCenter.z,
    );
    near(sample.upperRadius + sample.lowerRadius,
      geometry.centerDistance, 3e-16, 'sample profile closure');
    near(sample.point.distanceTo(upperAxisPoint),
      sample.upperRadius, 2e-16, 'sample on upper V flank');
    near(sample.point.distanceTo(lowerAxisPoint),
      sample.lowerRadius, 3e-16, 'sample on lower V flank');
  }
  assert.deepEqual(
    geometry.pitchContacts.map(({ axialPosition }) => axialPosition),
    [-geometry.looseRubberWidth / 4, geometry.looseRubberWidth / 4],
  );
  geometry.pitchContacts.forEach((contact) => {
    near(contact.point.y, geometry.contactY, 0,
      'symmetric pitch contact height');
  });
  disposeModel(model.root);
});

test('movement 413 nut travel compresses the rubber axially and expands it radially at constant modeled volume', () => {
  const model = createMovementModel(catalog.movements[412]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumVolumeResidual = 0;
  let maximumThreadResidual = 0;
  let previousWidth = Infinity;
  let previousTipRadius = -Infinity;

  for (let sample = 0; sample <= 20000; sample += 1) {
    const state = stateAtTime(2 * sample / 20000);
    maximumVolumeResidual = Math.max(maximumVolumeResidual,
      Math.abs(state.rubberVolumeResidual));
    maximumThreadResidual = Math.max(maximumThreadResidual,
      Math.abs(state.threadAdvanceResidual));
    assert.ok(state.rubberWidth <= previousWidth + 2e-15,
      'tightening never increases axial width');
    assert.ok(state.freeRubberTipRadius >= previousTipRadius - 2e-15,
      'tightening never decreases free radius');
    previousWidth = state.rubberWidth;
    previousTipRadius = state.freeRubberTipRadius;
    near(
      geometry.rightPlateX - 0.07
        - (state.leftPlateX + 0.07),
      state.rubberWidth,
      2e-16,
      'inner clamp face separation',
    );
    near(state.rubberCenterX,
      (state.leftPlateX + 0.07 + geometry.rightPlateX - 0.07) / 2,
      0, 'rubber follows asymmetric clamp-gap midpoint');
  }
  assert.ok(maximumVolumeResidual < 2.3e-16);
  assert.ok(maximumThreadResidual < 7e-17);
  const loose = stateAtTime(0);
  const tight = stateAtTime(2);
  near(loose.rubberWidth, geometry.looseRubberWidth, 0,
    'loose rubber width');
  near(tight.rubberWidth, geometry.tightRubberWidth, 0,
    'tight rubber width');
  assert.ok(tight.freeRubberTipRadius > loose.freeRubberTipRadius);
  assert.ok(tight.freeRubberCoreRadius > loose.freeRubberCoreRadius);
  near(tight.nutX - loose.nutX, geometry.nutAdvance, 0,
    'nut axial advance');
  near((tight.nutRelativeAngle - loose.nutRelativeAngle) / FULL_TURN,
    geometry.adjustmentNutTurns, 0, 'nut adjustment turns');
  disposeModel(model.root);
});

test('movement 413 adjustment and rotation are interlocked and only the fully tightened wheel transmits', () => {
  const model = createMovementModel(catalog.movements[412]);
  const { geometry, stateAtTime } = model.root.userData;
  const stages = new Set();

  for (let sample = -18000; sample <= 36000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 18000);
    stages.add(state.stage);
    assert.ok(state.activeCoordinates <= 1,
      'nut adjustment and wheel rotation never occur together');
    if (Math.abs(state.compressionRate) > 1e-12) {
      assert.equal(state.upperAngularSpeed, 0);
      near(state.lowerAngularSpeed, 0, 0, 'stationary lower wheel');
    }
    if (Math.abs(state.upperAngularSpeed) > 1e-12) {
      assert.equal(state.compression, 1);
      assert.ok(state.tractionCapacityProxy > 0);
      assert.equal(state.stage, 'tightened-no-slip-friction-drive');
    }
  }
  assert.deepEqual(stages, new Set([
    'stationary-nut-tightening-and-radial-expansion',
    'tightened-no-slip-friction-drive',
    'stationary-nut-loosening-and-radial-contraction',
  ]));
  assert.equal(stateAtTime(0).tractionCapacityProxy, 0);
  assert.ok(stateAtTime(2).tractionCapacityProxy > 0.6);
  disposeModel(model.root);
});

test('movement 413 tightened drive uses the exact opposed effective-radius ratio and rolls without slip at both pitch contacts', () => {
  const model = createMovementModel(catalog.movements[412]);
  const { geometry, stateAtTime, transmission } = model.root.userData;
  let maximumRollingResidual = 0;
  let movingSamples = 0;

  near(transmission.outputToInputSpeedRatio, -2 / 3, 0,
    'selected output/input ratio');
  for (let sample = 0; sample < 30000; sample += 1) {
    const state = stateAtTime(2 + 5 * sample / 30000);
    assert.equal(state.stage, 'tightened-no-slip-friction-drive');
    near(state.lowerAngularSpeed,
      -state.upperAngularSpeed * geometry.upperPitchRadius
        / geometry.lowerPitchRadius,
      1e-15,
      'effective-radius speed relation',
    );
    state.pitchContactStates.forEach((contact) => {
      maximumRollingResidual = Math.max(maximumRollingResidual,
        Math.abs(contact.rollingResidual));
    });
    if (Math.abs(state.upperAngularSpeed) > 1e-10) {
      movingSamples += 1;
      assert.ok(state.upperAngularSpeed > 0);
      assert.ok(state.lowerAngularSpeed < 0);
    }
  }
  assert.ok(movingSamples > 29900);
  assert.ok(maximumRollingResidual < 1.8e-15);
  const start = stateAtTime(2);
  const finish = stateAtTime(7);
  near(finish.upperAngle - start.upperAngle,
    geometry.upperInputTurns * FULL_TURN, 0,
    'three upper input turns');
  near(finish.lowerAngle - start.lowerAngle,
    geometry.lowerOutputTurns * FULL_TURN, 0,
    'two opposed lower output turns');
  disposeModel(model.root);
});

test('movement 413 V flanks retain balanced local sliding about the two no-slip mid-flank pitch contacts', () => {
  const model = createMovementModel(catalog.movements[412]);
  const { geometry, stateAtTime } = model.root.userData;
  let positiveSamples = 0;
  let negativeSamples = 0;

  for (const time of [2.7, 3.9, 4.5, 5.8, 6.4]) {
    const state = stateAtTime(time);
    const signedSum = state.sampleStates.reduce(
      (sum, sample) => sum + sample.signedSlidingSpeed,
      0,
    );
    near(signedSum, 0, 8e-15,
      `balanced V-flank sliding at ${time}`);
    state.sampleStates.forEach((sample) => {
      const expected = state.upperAngularSpeed
        * (sample.upperRadius
          - geometry.upperPitchRadius / geometry.lowerPitchRadius
            * sample.lowerRadius);
      near(sample.signedSlidingSpeed, expected, 2e-15,
        `local flank sliding at x=${sample.axialPosition}`);
      if (sample.signedSlidingSpeed > 1e-12) positiveSamples += 1;
      if (sample.signedSlidingSpeed < -1e-12) negativeSamples += 1;
    });
  }
  assert.ok(positiveSamples > 0);
  assert.equal(positiveSamples, negativeSamples);
  disposeModel(model.root);
});

test('movement 413 modeled tractive-capacity proxy increases monotonically with radial interference', () => {
  const model = createMovementModel(catalog.movements[412]);
  const { dynamics, geometry, stateAtTime } = model.root.userData;
  let previousInterference = -Infinity;
  let previousCapacity = -Infinity;

  for (let sample = 0; sample <= 10000; sample += 1) {
    const state = stateAtTime(2 * sample / 10000);
    assert.ok(state.pitchInterference >= previousInterference - 2e-15);
    assert.ok(state.tractionCapacityProxy >= previousCapacity - 2e-14);
    near(state.normalLoadProxy,
      geometry.radialStiffnessProxy * state.pitchInterference,
      0, 'linear radial-load proxy');
    near(state.tractionCapacityProxy,
      dynamics.frictionCoefficientProxy * state.normalLoadProxy,
      0, 'traction-capacity proxy');
    previousInterference = state.pitchInterference;
    previousCapacity = state.tractionCapacityProxy;
  }
  disposeModel(model.root);
});

test('movement 413 analytic adjustment and wheel derivatives match finite differences away from stage boundaries', () => {
  const model = createMovementModel(catalog.movements[412]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  for (const time of [0.41, 0.93, 1.61, 2.55, 3.84, 5.16, 6.43, 7.38, 8.24]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const numericalUpperSpeed = (after.upperAngle - before.upperAngle)
      / (2 * step);
    const numericalLowerSpeed = (after.lowerAngle - before.lowerAngle)
      / (2 * step);
    const numericalCompressionRate = (after.compression - before.compression)
      / (2 * step);
    const numericalUpperAcceleration = (
      after.upperAngularSpeed - before.upperAngularSpeed
    ) / (2 * step);
    const numericalLowerAcceleration = (
      after.lowerAngularSpeed - before.lowerAngularSpeed
    ) / (2 * step);
    const numericalCompressionAcceleration = (
      after.compressionRate - before.compressionRate
    ) / (2 * step);
    near(numericalUpperSpeed, state.upperAngularSpeed, 2e-8,
      `upper speed at ${time}`);
    near(numericalLowerSpeed, state.lowerAngularSpeed, 1.5e-8,
      `lower speed at ${time}`);
    near(numericalCompressionRate, state.compressionRate, 4e-10,
      `compression rate at ${time}`);
    near(numericalUpperAcceleration, state.upperAngularAcceleration, 4e-8,
      `upper acceleration at ${time}`);
    near(numericalLowerAcceleration, state.lowerAngularAcceleration, 3e-8,
      `lower acceleration at ${time}`);
    near(numericalCompressionAcceleration, state.compressionAcceleration,
      1e-9, `compression acceleration at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 413 update binds both rotors, rubber deformation, moving plate, and threaded nut to one analytic state', () => {
  const model = createMovementModel(catalog.movements[412]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.8, 1.7, 2, 3.4, 4.5, 6.6, 7.5, 8.5]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.upperRotor.rotation.x, state.upperAngle, 0,
      'upper rotor update');
    near(blocks.lowerRotor.rotation.x, state.lowerAngle, 0,
      'lower rotor update');
    near(blocks.rubberRotor.position.x, state.rubberCenterX, 0,
      'rubber axial midpoint update');
    near(blocks.rubberRotor.scale.x, state.rubberAxialScale, 0,
      'rubber axial scale update');
    near(blocks.rubberRotor.scale.y, state.rubberRadialScale, 0,
      'rubber y radial scale update');
    near(blocks.rubberRotor.scale.z, state.rubberRadialScale, 0,
      'rubber z radial scale update');
    near(blocks.leftClampPlate.position.x, state.leftPlateX, 0,
      'moving plate update');
    near(blocks.adjustmentNut.position.x, state.nutX, 0,
      'nut advance update');
    near(blocks.adjustmentNut.rotation.x, state.nutRelativeAngle, 0,
      'nut relative turn update');
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  sameAngle(closure.upperAngle, source.upperAngle, 0,
    'upper cycle closure');
  sameAngle(closure.lowerAngle, source.lowerAngle, 0,
    'lower cycle closure');
  sameAngle(closure.nutRelativeAngle, source.nutRelativeAngle, 0,
    'nut cycle closure');
  assert.equal(closure.compression, source.compression);
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 413 friction gearing', () => {
  const movement413 = catalog.movements[412];
  const movement507 = catalog.movements[506];
  const model413 = createMovementModel(movement413);
  const model507 = createMovementModel(movement507);

  assert.equal(movement413.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype,
    model413.root.userData.archetype);
  assert.notEqual(model507.root.userData.mechanism,
    model413.root.userData.mechanism);
  disposeModel(model413.root);
  disposeModel(model507.root);
});
