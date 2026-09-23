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

function vector2Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function worldXYNear(object, expected, tolerance, message) {
  const actual = worldPosition(object);
  vector2Near(
    new THREE.Vector2(actual.x, actual.y),
    expected,
    tolerance,
    message,
  );
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
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

test('movement 343 is the opposed-radius-rod upright-engine parallel motion', () => {
  const movement = catalog.movements[342];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 343);
  assert.equal(movement.number, '343');
  assert.equal(movement.title, 'Parallel motion for upright engine');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'opposed-equal-radius-rods-vibrating-crosspiece-upright-engine-parallel-motion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /connecting-rod-P-C/);
  assert.match(mechanism, /upper-radius-T-U/);
  assert.match(mechanism, /lower-radius-B-D/);
  assert.match(transmission.exactRigidConstraints, /\|P-C\|=10\.75/);
  assert.match(transmission.exactRigidConstraints, /\|T-U\|=\|B-D\|=6\.194593/);
  assert.match(transmission.canvasDefect, /0\.057643/);
  assert.match(transmission.canvasDefect, /0\.059309/);
  assert.equal(degreesOfFreedom.mechanism, 1);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.inputCrank.parent, model.root);
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.topRadiusRod.parent, model.root);
  assert.equal(blocks.bottomRadiusRod.parent, model.root);
  assert.equal(blocks.crosspiece.parent, model.root);
  assert.equal(blocks.pistonOutput.parent, model.root);
  assert.equal(blocks.flywheel.parent, blocks.inputCrank);
  assert.equal(blocks.crankPinAnchor.parent, blocks.inputCrank);
  assert.equal(blocks.crosspieceAnchors.U.parent, blocks.crosspiece);
  assert.equal(blocks.crosspieceAnchors.C.parent, blocks.crosspiece);
  assert.equal(blocks.crosspieceAnchors.D.parent, blocks.crosspiece);
  assert.equal(blocks.pistonTopAnchor.parent, blocks.pistonOutput);
  assert.equal(blocks.connectingRodStartAnchor.parent, blocks.connectingRod);
  assert.equal(blocks.connectingRodEndAnchor.parent, blocks.connectingRod);
  assert.equal(contacts.crankAtP.members[0], blocks.inputCrank);
  assert.equal(contacts.crankAtP.members[1], blocks.connectingRod);
  assert.equal(contacts.crosspieceAtC.members[0], blocks.connectingRod);
  assert.equal(contacts.crosspieceAtC.members[1], blocks.crosspiece);
  assert.equal(contacts.crosspieceAtC.members[2], blocks.pistonOutput);
  assert.equal(contacts.crosspieceAtU.members[1], blocks.topRadiusRod);
  assert.equal(contacts.crosspieceAtD.members[1], blocks.bottomRadiusRod);
  assert.equal(contacts.upperRadiusPivotT.fixedMember, blocks.fixedFrame);
  assert.equal(contacts.lowerRadiusPivotB.fixedMember, blocks.fixedFrame);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => role ===
    'three-point-five-unit-crank-and-large-upright-engine-flywheel').length, 1);
  assert.equal(roles.filter((role) => role ===
    'ten-point-seven-five-unit-connecting-rod-P-C').length, 1);
  assert.equal(roles.filter((role) => role ===
    'upper-equal-radius-rod-A-from-fixed-T-to-U').length, 1);
  assert.equal(roles.filter((role) => role ===
    'lower-equal-radius-rod-A-from-fixed-B-to-D').length, 1);
  assert.equal(roles.filter((role) => role ===
    'eight-unit-vibrating-crosspiece-U-C-D-on-piston-rod').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 343 preserves the official geometry, phase, timing, and view', () => {
  const model = createMovementModel(catalog.movements[342]);
  const {
    geometry,
    modelPointToOfficialAnimationRaster,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;
  const official = sourceAnimation.officialGeometry;

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialPageAnimatedTabDisabled, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_343.html');
  assert.deepEqual(sourceAnimation.officialFunctionChain, [
    'add_stat',
    'add_rot',
    'add_c_rod',
    'add_c_rod_r',
    'add_rot_to',
    'add_rot_to',
    'add_tx',
    'add_text',
  ]);
  assert.match(sourceAnimation.referenceScope, /both equal A radius rods/);

  assert.deepEqual(official.crankCenter, new THREE.Vector2(0, 0));
  assert.equal(official.crankRadius, 3.5);
  assert.equal(official.crankPhaseOffsetTurns, 0.875);
  assert.equal(official.connectingRodLength, 10.75);
  assert.deepEqual(official.strokeLine, [
    new THREE.Vector2(0, -7.25),
    new THREE.Vector2(0, -14.75),
  ]);
  assert.deepEqual(official.topPivotT,
    new THREE.Vector2(-5.5, -7.060769));
  assert.deepEqual(official.bottomPivotB,
    new THREE.Vector2(5.5, -14.939231));
  assert.deepEqual(official.topReferenceU,
    new THREE.Vector2(0.694593, -7.060769));
  assert.equal(official.radiusRodLength, 6.194593);
  assert.equal(official.crosspieceHalfLength, 4);
  assert.equal(official.crosspieceLength, 8);
  assert.equal(official.pistonRodLength, 16.125);
  assert.equal(official.pistonHeadOffset, -16.625);

  near(geometry.crankRadius, 3.5 * geometry.sourceScale, 0,
    'scaled crank radius');
  near(geometry.connectingRodLength, 10.75 * geometry.sourceScale, 0,
    'scaled connecting rod');
  near(geometry.radiusRodLength, 6.194593 * geometry.sourceScale, 0,
    'scaled radius rod');
  near(geometry.crosspieceLength, 8 * geometry.sourceScale, 0,
    'scaled crosspiece');
  vector2Near(geometry.topPivotT,
    official.topPivotT.clone().multiplyScalar(geometry.sourceScale), 0,
    'scaled upper fixed pivot');
  vector2Near(geometry.bottomPivotB,
    official.bottomPivotB.clone().multiplyScalar(geometry.sourceScale), 0,
    'scaled lower fixed pivot');
  near(geometry.cyclePeriod, 4, 0, 'cycle period');
  near(geometry.inputAngularSpeed, Math.PI / 2, 0,
    'fifteen-rpm input speed');

  assert.equal(sourceReference.brownPlate343.imageWidth, 525);
  assert.equal(sourceReference.brownPlate343.imageHeight, 525);
  assert.match(sourceReference.brownPlate343.inferredTopology,
    /two equal radius rods A/);
  assert.equal(sourceReference.officialAnimationView.viewWidth, 30);
  assert.equal(sourceReference.officialAnimationView.viewHeight, 30);
  assert.deepEqual(sourceReference.officialAnimationView.minimum,
    new THREE.Vector2(-15, -26));
  vector2Near(
    modelPointToOfficialAnimationRaster(
      new THREE.Vector2(-15, -26).multiplyScalar(geometry.sourceScale),
    ),
    new THREE.Vector2(0, 525),
    0,
    'official lower-left raster transform',
  );
  vector2Near(
    modelPointToOfficialAnimationRaster(
      new THREE.Vector2(15, 4).multiplyScalar(geometry.sourceScale),
    ),
    new THREE.Vector2(525, 0),
    0,
    'official upper-right raster transform',
  );
  disposeModel(model.root);
});

test('movement 343 reconstructs and quantifies the official sequential canvas construction', () => {
  const model = createMovementModel(catalog.movements[342]);
  const {
    geometry,
    sourceAnimation,
    sourceStateAtTime,
  } = model.root.userData;
  const scale = geometry.sourceScale;
  let minimumError = Infinity;
  let maximumError = -Infinity;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const time = geometry.cyclePeriod * sample / 8192;
    const state = sourceStateAtTime(time);
    near(state.pointP.distanceTo(geometry.crankCenter),
      geometry.crankRadius, 8e-16, `canvas crank radius ${sample}`);
    near(state.pointP.distanceTo(state.pointC),
      geometry.connectingRodLength, 2e-15,
      `canvas connecting rod ${sample}`);
    near(state.pointC.x, 0, 0, `forced canvas stroke line ${sample}`);
    near(state.pointU.distanceTo(state.pointC),
      geometry.crosspieceHalfLength, 8e-16,
      `canvas upper half-crosspiece ${sample}`);
    near(state.pointD.distanceTo(state.pointC),
      geometry.crosspieceHalfLength, 1.1e-15,
      `canvas lower half-crosspiece ${sample}`);
    vector2Near(
      state.pointU.clone().add(state.pointD).multiplyScalar(0.5),
      state.pointC,
      8e-16,
      `canvas crosspiece midpoint ${sample}`,
    );
    near(state.pointU.distanceTo(geometry.topPivotT),
      geometry.radiusRodLength, 2e-15,
      `canvas upper radius closure ${sample}`);
    near(
      state.pointD.distanceTo(geometry.bottomPivotB)
        - geometry.radiusRodLength,
      state.bottomRadiusLengthError,
      8e-16,
      `canvas lower radius error ${sample}`,
    );
    near(state.drawnBottomEndpoint.distanceTo(geometry.bottomPivotB),
      geometry.radiusRodLength, 8e-16,
      `canvas drawn lower rod length ${sample}`);
    minimumError = Math.min(minimumError, state.bottomRadiusLengthError);
    maximumError = Math.max(maximumError, state.bottomRadiusLengthError);
  }

  near(minimumError / scale, -0.05764332881211181, 2e-8,
    'official lower rod maximum shortening');
  near(maximumError / scale, 0.05930863078875402, 2e-8,
    'official lower rod maximum extension');
  near(
    sourceAnimation.physicalCorrection
      .canvasBottomRadiusMaximumShorteningSource,
    -0.05764332881211181,
    0,
    'published canvas shortening',
  );
  near(
    sourceAnimation.physicalCorrection
      .canvasBottomRadiusMaximumExtensionSource,
    0.05930863078875402,
    0,
    'published canvas extension',
  );
  const upperEnd = sourceStateAtTime(1.5);
  const lowerEnd = sourceStateAtTime(3.5);
  near(upperEnd.pointC.y / scale, -7.25, 2e-15,
    'canvas upper dead center');
  near(lowerEnd.pointC.y / scale, -14.25, 2e-15,
    'canvas lower dead center');
  near((upperEnd.pointC.y - lowerEnd.pointC.y) / scale, 7, 4e-15,
    'canvas forced-line stroke');
  disposeModel(model.root);
});

test('movement 343 simultaneously closes the connecting rod and both equal radius rods', () => {
  const model = createMovementModel(catalog.movements[342]);
  const { geometry, stateAtInputTravel } = model.root.userData;
  let maximumResidual = 0;
  let maximumMidpointError = 0;
  let maximumIterations = 0;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const travel = Math.PI * 2 * sample / 8192;
    const state = stateAtInputTravel(travel);
    const midpoint = state.pointU.clone().add(state.pointD)
      .multiplyScalar(0.5);
    const residuals = [
      Math.abs(state.pointP.distanceTo(geometry.crankCenter)
        - geometry.crankRadius),
      Math.abs(state.pointC.distanceTo(state.pointP)
        - geometry.connectingRodLength),
      Math.abs(state.pointU.distanceTo(state.pointC)
        - geometry.crosspieceHalfLength),
      Math.abs(state.pointD.distanceTo(state.pointC)
        - geometry.crosspieceHalfLength),
      Math.abs(state.pointU.distanceTo(geometry.topPivotT)
        - geometry.radiusRodLength),
      Math.abs(state.pointD.distanceTo(geometry.bottomPivotB)
        - geometry.radiusRodLength),
    ];
    maximumResidual = Math.max(maximumResidual, ...residuals,
      state.maximumLengthResidual);
    maximumMidpointError = Math.max(maximumMidpointError,
      midpoint.distanceTo(state.pointC));
    maximumIterations = Math.max(maximumIterations,
      state.solverIterations);
    assert.ok(Number.isFinite(state.crosspiece.angle));
    assert.ok(Number.isFinite(state.pointCVelocity.x));
    assert.ok(Number.isFinite(state.pointCAcceleration.y));
  }

  assert.ok(maximumResidual <= 7.2e-15,
    `all visible rigid lengths close; worst error ${maximumResidual}`);
  assert.ok(maximumMidpointError <= 4.5e-16,
    `C remains the U-D midpoint; worst error ${maximumMidpointError}`);
  assert.ok(maximumIterations <= 3,
    `simultaneous constraint solve stays well-conditioned; used ${maximumIterations}`);
  near(geometry.maximumLengthResidual, maximumResidual, 2.3e-16,
    'published maximum closure residual');
  assert.equal(geometry.maximumSolverIterations, maximumIterations);
  disposeModel(model.root);
});

test('movement 343 preserves the intended near-straight seven-unit piston locus', () => {
  const model = createMovementModel(catalog.movements[342]);
  const {
    geometry,
    sourceAnimation,
    stateAtInputTravel,
  } = model.root.userData;
  const scale = geometry.sourceScale;
  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumY = Infinity;
  let maximumY = -Infinity;
  let maximumCorrection = 0;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtInputTravel(Math.PI * 2 * sample / 8192);
    minimumX = Math.min(minimumX, state.pointC.x);
    maximumX = Math.max(maximumX, state.pointC.x);
    minimumY = Math.min(minimumY, state.pointC.y);
    maximumY = Math.max(maximumY, state.pointC.y);
    maximumCorrection = Math.max(
      maximumCorrection,
      state.physicalDifferenceFromCanvas.pointC,
      state.physicalDifferenceFromCanvas.pointU,
      state.physicalDifferenceFromCanvas.pointD,
    );
  }

  near(geometry.outputStroke / scale, 6.999976596130328, 2e-12,
    'physical piston stroke');
  near(geometry.maximumLateralDeviation / scale,
    0.03384278574444044, 2e-12,
    'maximum physical lateral deviation');
  near(geometry.minimumPistonX, minimumX, 2e-9,
    'sampled minimum piston x');
  near(geometry.maximumPistonX, maximumX, 2e-9,
    'sampled maximum piston x');
  near(geometry.minimumPistonY, minimumY, 2e-9,
    'sampled minimum piston y');
  near(geometry.maximumPistonY, maximumY, 2e-9,
    'sampled maximum piston y');
  near(maximumCorrection / scale, 0.07168642860145062, 3e-8,
    'maximum physical correction from canvas');
  near(
    sourceAnimation.physicalCorrection.maximumVisiblePointCorrectionSource,
    0.07168642860145062,
    0,
    'published maximum visible correction',
  );
  assert.ok(geometry.maximumLateralDeviation < geometry.outputStroke / 200,
    'parallel motion stays visually near-straight without falsifying Cx=0');
  assert.ok(minimumX < 0 && maximumX > 0,
    'true piston locus passes to both sides of the nominal centerline');
  disposeModel(model.root);
});

test('movement 343 analytic point and rigid-link rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[342]);
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 2e-4;
  const pointNames = ['P', 'C', 'U', 'D'];
  const linkNames = [
    'connectingRod',
    'topRadiusRod',
    'bottomRadiusRod',
    'crosspiece',
  ];

  for (const phase of [0.031, 0.13, 0.267, 0.41, 0.61, 0.83, 0.97]) {
    const time = geometry.cyclePeriod * phase;
    const before = stateAtTime(time - timeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + timeStep);
    for (const name of pointNames) {
      const pointKey = `point${name}`;
      const velocityKey = `point${name}Velocity`;
      const accelerationKey = `point${name}Acceleration`;
      const numericalVelocity = after[pointKey].clone()
        .sub(before[pointKey]).multiplyScalar(1 / (2 * timeStep));
      const numericalAcceleration = after[pointKey].clone()
        .add(before[pointKey])
        .addScaledVector(state[pointKey], -2)
        .multiplyScalar(1 / timeStep ** 2);
      vector2Near(state[velocityKey], numericalVelocity, 7e-8,
        `${name} velocity at phase ${phase}`);
      vector2Near(state[accelerationKey], numericalAcceleration, 2e-7,
        `${name} acceleration at phase ${phase}`);
    }
    for (const name of linkNames) {
      const numericalVelocity = angleDifference(
        after[name].angle,
        before[name].angle,
      ) / (2 * timeStep);
      const numericalAcceleration = (
        angleDifference(after[name].angle, state[name].angle)
          - angleDifference(state[name].angle, before[name].angle)
      ) / timeStep ** 2;
      near(state[name].angularVelocity, numericalVelocity, 7e-8,
        `${name} angular velocity at phase ${phase}`);
      near(state[name].angularAcceleration, numericalAcceleration, 2e-7,
        `${name} angular acceleration at phase ${phase}`);
    }
  }
  disposeModel(model.root);
});

test('movement 343 renderer keeps every visible rod and common pin on the analytic state', () => {
  const model = createMovementModel(catalog.movements[342]);
  const {
    blocks,
    contacts,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const fixedTopPivot = worldPosition(blocks.topPivotBearing.shaft);
  const fixedBottomPivot = worldPosition(blocks.bottomPivotBearing.shaft);

  for (const time of [0, 0.41, 1.08, 1.73, 2.46, 3.19, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(angleDifference(blocks.inputCrank.rotation.z, state.inputAngle),
      0, 0, `rendered crank angle ${time}`);
    near(angleDifference(blocks.connectingRod.rotation.z,
      state.connectingRod.angle), 0, 0,
    `rendered connecting rod angle ${time}`);
    near(angleDifference(blocks.topRadiusRod.rotation.z,
      state.topRadiusRod.angle), 0, 0,
    `rendered upper radius rod angle ${time}`);
    near(angleDifference(blocks.bottomRadiusRod.rotation.z,
      state.bottomRadiusRod.angle), 0, 0,
    `rendered lower radius rod angle ${time}`);
    near(angleDifference(blocks.crosspiece.rotation.z,
      state.crosspiece.angle), 0, 0,
    `rendered crosspiece angle ${time}`);
    near(blocks.pistonOutput.rotation.z, 0, 0,
      `nonrotating piston ${time}`);

    worldXYNear(blocks.crankPinAnchor, state.pointP, 7e-16,
      `crank endpoint P ${time}`);
    worldXYNear(blocks.connectingRodStartAnchor, state.pointP, 7e-16,
      `connecting-rod start P ${time}`);
    worldXYNear(blocks.connectingRodEndAnchor, state.pointC, 1.1e-15,
      `connecting-rod end C ${time}`);
    worldXYNear(blocks.topRadiusRodStartAnchor, geometry.topPivotT, 7e-16,
      `upper radius start T ${time}`);
    worldXYNear(blocks.topRadiusRodEndAnchor, state.pointU, 1.1e-15,
      `upper radius end U ${time}`);
    worldXYNear(blocks.bottomRadiusRodStartAnchor, geometry.bottomPivotB,
      7e-16, `lower radius start B ${time}`);
    worldXYNear(blocks.bottomRadiusRodEndAnchor, state.pointD, 1.1e-15,
      `lower radius end D ${time}`);
    worldXYNear(blocks.crosspieceAnchors.U, state.pointU, 8e-16,
      `crosspiece U ${time}`);
    worldXYNear(blocks.crosspieceAnchors.C, state.pointC, 8e-16,
      `crosspiece C ${time}`);
    worldXYNear(blocks.crosspieceAnchors.D, state.pointD, 8e-16,
      `crosspiece D ${time}`);
    worldXYNear(blocks.pistonTopAnchor, state.pointC, 7e-16,
      `piston top C ${time}`);
    worldXYNear(blocks.jointPins.P, state.pointP, 8e-16,
      `visible pin P ${time}`);
    worldXYNear(blocks.jointPins.C, state.pointC, 8e-16,
      `visible pin C ${time}`);
    worldXYNear(blocks.jointPins.U, state.pointU, 8e-16,
      `visible pin U ${time}`);
    worldXYNear(blocks.jointPins.D, state.pointD, 8e-16,
      `visible pin D ${time}`);
    vector2Near(new THREE.Vector2(
      contacts.crankAtP.point.x,
      contacts.crankAtP.point.y,
    ), state.pointP, 0, `contact P ${time}`);
    vector2Near(new THREE.Vector2(
      contacts.crosspieceAtC.point.x,
      contacts.crosspieceAtC.point.y,
    ), state.pointC, 0, `contact C ${time}`);
    vector2Near(new THREE.Vector2(
      contacts.crosspieceAtU.point.x,
      contacts.crosspieceAtU.point.y,
    ), state.pointU, 0, `contact U ${time}`);
    vector2Near(new THREE.Vector2(
      contacts.crosspieceAtD.point.x,
      contacts.crosspieceAtD.point.y,
    ), state.pointD, 0, `contact D ${time}`);
    vector3Near(worldPosition(blocks.topPivotBearing.shaft),
      fixedTopPivot, 0, `fixed top pivot ${time}`);
    vector3Near(worldPosition(blocks.bottomPivotBearing.shaft),
      fixedBottomPivot, 0, `fixed bottom pivot ${time}`);
  }

  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 35, 'shared bored rods replace separate decorative eye meshes');
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 7.5);
  assert.ok(size.y > 7.4);
  assert.ok(size.z > 1.7,
    'frame, crank, rods, crosspiece, piston, and pins have distinct depth');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 2);
  assert.ok(blocks.jointPins.P.parent === blocks.inputCrank, 'pin P fast in crank');
  assert.ok(blocks.jointPins.C.parent === blocks.pistonOutput, 'pin C fast in piston');
  assert.ok(blocks.jointPins.U.parent === blocks.topRadiusRod, 'pin U fast in upper A');
  assert.ok(blocks.jointPins.D.parent === blocks.bottomRadiusRod, 'pin D fast in lower A');
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.deepEqual(roles.filter((role) => /foundation|piston-rod-guide|cylinder-wall|depth-foot/.test(role)), [],
    'plate draws no base stand, feet, box walls or rod guides');
  const { sourceScale } = model.root.userData.geometry;
  const crop = model.root.userData.cameraFitBounds;
  near(crop.min.x, -15 * sourceScale, 1e-12, 'plate crop left');
  near(crop.max.x, 15 * sourceScale, 1e-12, 'plate crop right');
  near(crop.min.y, -26 * sourceScale, 1e-12, 'plate crop bottom');
  near(crop.max.y, 4 * sourceScale, 1e-12, 'plate crop top');
  const flywheelBox = new THREE.Box3().setFromObject(blocks.flywheel);
  assert.ok(flywheelBox.max.y > crop.max.y && flywheelBox.min.x < crop.min.x,
    'only part of the flywheel is in the plate');
  const coverBox = new THREE.Box3().setFromObject(blocks.cylinderTop);
  assert.ok(crop.containsPoint(new THREE.Vector3(0, coverBox.max.y, 0)));
  assert.ok(new THREE.Box3().setFromObject(blocks.cylinderBody).min.y < crop.min.y,
    'only the cylinder top is in the plate');
  disposeModel(model.root);
});

test('movement 343 closes one exact revolution and leaves movement 507 as the next draft', () => {
  const model = createMovementModel(catalog.movements[342]);
  const {
    blocks,
    canonicalTimes,
    sourceStateAtTime,
    stateAtTime,
  } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  const sourceStart = sourceStateAtTime(0);
  const sourceClosure = sourceStateAtTime(canonicalTimes.cycleClosure);

  near(closure.phase, start.phase, 0, 'phase closure');
  near(closure.unwrappedInputAngle - start.unwrappedInputAngle,
    Math.PI * 2, 1e-15, 'one unwrapped crank revolution');
  near(angleDifference(closure.inputAngle, start.inputAngle), 0, 1e-15,
    'input crank closure');
  near(angleDifference(closure.connectingRod.angle,
    start.connectingRod.angle), 0, 1e-15, 'connecting rod closure');
  near(angleDifference(closure.topRadiusRod.angle,
    start.topRadiusRod.angle), 0, 1e-15, 'upper radius rod closure');
  near(angleDifference(closure.bottomRadiusRod.angle,
    start.bottomRadiusRod.angle), 0, 1e-15,
  'lower radius rod closure');
  near(angleDifference(closure.crosspiece.angle,
    start.crosspiece.angle), 0, 1e-15, 'crosspiece closure');
  for (const name of ['P', 'C', 'U', 'D']) {
    vector2Near(closure[`point${name}`], start[`point${name}`], 1.1e-15,
      `${name} closure`);
    vector2Near(sourceClosure[`point${name}`],
      sourceStart[`point${name}`], 1.1e-15,
      `official canvas ${name} closure`);
  }
  model.update(canonicalTimes.cycleClosure);
  model.root.updateMatrixWorld(true);
  worldXYNear(blocks.pistonTopAnchor, start.pointC, 1.1e-15,
    'rendered piston closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
