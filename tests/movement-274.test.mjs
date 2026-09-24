import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

test('movement 274 is one parabolic-guide flyball governor, not a Watt linkage', () => {
  const movement = catalog.movements[273];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 274);
  assert.equal(movement.number, '274');
  assert.equal(movement.title, 'Parabolic Roller Flyball Governor');
  assert.equal(movement.category, 'Governors & flywheels');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'fixed-parabolic-guide-roller-flyball-governor-sliding-sleeve',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /fixed parabolic guide arms B/);
  assert.match(mechanism, /anti-friction wheel L/);
  assert.match(mechanism, /constant-length rod F/);
  assert.match(mechanism, /sliding sleeve/);
  assert.equal(transmission.guideProfile,
    'quadratic Bezier parabolic segment');
  assert.match(transmission.constraintLaw, /rollerCenter/);
  assert.match(transmission.constraintLaw, /sleeveY/);
  assert.match(transmission.rollerRollingLaw, /ArcLength/);

  assert.equal(blocks.governorRotor.parent, model.root);
  vectorNear(blocks.governorRotor.userData.axis, Y_AXIS, 0,
    'governor rotor axis');
  assert.equal(blocks.sideAssemblies.length, 2);
  assert.equal(blocks.shoulderCurves.length, 2);
  assert.equal(blocks.sleeveAssembly.parent, blocks.governorRotor);
  for (const shoulder of blocks.shoulderCurves) {
    assert.equal(shoulder.parent, blocks.governorRotor);
  }
  blocks.sideAssemblies.forEach((assembly, sideIndex) => {
    assert.equal(assembly.side.parent, blocks.governorRotor);
    assert.equal(assembly.guide.parent, assembly.side);
    assert.equal(assembly.roller.parent, assembly.side);
    assert.equal(assembly.flyball.parent, assembly.side);
    assert.equal(assembly.connectingRod.parent, assembly.side);
    assert.equal(assembly.carrierLinks.length, 2);
    assert.ok(assembly.carrierLinks.every((link) =>
      link.parent === assembly.side));
    assert.equal(assembly.guide.geometry.type, 'TubeGeometry');
    assert.ok(assembly.guide.userData.curve
      instanceof THREE.QuadraticBezierCurve3);
    assert.equal(assembly.guide.userData.isFixedInGovernorRotor, true);
    near(assembly.side.rotation.y, sideIndex * Math.PI, 0,
      `side ${sideIndex} diametric placement`);
  });

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^stationary-in-rotor-parabolic-guide-arm-B-/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /^moving-anti-friction-roller-L-\d$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /^centrifugal-flyball-carriage-K-\d$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /^constant-length-connecting-rod-F-\d$/.test(role)).length, 2);
  assert.equal(roles.filter((role) =>
    /belt|pulley|gear|ordinary-watt-link/.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 274 records the unavailable source and fits its right-side centers', () => {
  const model = createMovementModel(catalog.movements[273]);
  const {
    geometry,
    sourceAnimation,
    sourcePointToModel,
    sourceReference,
    stateAtPhase,
  } = model.root.userData;
  const plate = sourceReference.plate274;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /animation control unavailable/);
  assert.match(sourceAnimation.reason, /reconstructed independently/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[273].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.rasterAxisX, 272);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterTopGuidePins, {
    left: { x: 180, y: 85 },
    right: { x: 368, y: 84 },
  });
  assert.deepEqual(plate.rasterRollerCenters, {
    left: { x: 236, y: 228 },
    right: { x: 306, y: 229 },
  });
  assert.deepEqual(plate.rasterBallCenters, {
    left: { x: 193, y: 331 },
    right: { x: 354, y: 329 },
  });
  assert.deepEqual(plate.rasterSleevePinCenters, {
    left: { x: 237, y: 430 },
    right: { x: 303, y: 429 },
  });
  assert.match(plate.inferredTopology, /fixed-in-rotor parabolic/);
  assert.match(plate.inferredTopology, /constant-length rods F/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 69,
    edition: 21,
    illustrationPage: 68,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.secondaryScan.figure, 302);
  assert.equal(sourceReference.secondaryScan.publicationYear, 1914);
  assert.match(sourceReference.secondaryScan.description,
    /parabolic or isochronous governor/);

  const source = stateAtPhase(0);
  const expected = {
    ball: sourcePointToModel(plate.rasterBallCenters.right),
    roller: sourcePointToModel(plate.rasterRollerCenters.right),
    sleevePin: sourcePointToModel(plate.rasterSleevePinCenters.right),
    topGuidePin: sourcePointToModel(plate.rasterTopGuidePins.right),
  };
  const actual = {
    ball: source.flyballCenter,
    roller: source.offset.rollerCenter,
    sleevePin: source.lowerRodPin,
    topGuidePin: geometry.guideStart,
  };
  for (const key of Object.keys(expected)) {
    near(
      actual[key].distanceTo(expected[key]) / geometry.sourceScale,
      plate.sourceIdealizationPixelErrors[key],
      2e-14,
      `${key} recorded raster error`,
    );
    assert.ok(plate.sourceIdealizationPixelErrors[key]
      <= plate.measurementUncertaintyPixels,
    `${key} remains inside engraving uncertainty`);
  }
  near(plate.sourceIdealizationPixelErrors.topGuidePin, 0, 0,
    'top guide pin exact source fit');
  assert.ok(plate.sourceIdealizationPixelErrors.ball < 0.7);
  assert.ok(plate.sourceIdealizationPixelErrors.roller < 0.83);
  assert.ok(plate.sourceIdealizationPixelErrors.sleevePin < 1.14);
  disposeModel(model.root);
});

test('movement 274 keeps each roller exactly tangent to one true parabolic guide', () => {
  const model = createMovementModel(catalog.movements[273]);
  const {
    geometry,
    stateAtPhase,
  } = model.root.userData;
  let maximumSurfaceGap = 0;
  let maximumTangencyError = 0;
  let minimumGuideParameter = Infinity;
  let maximumGuideParameter = -Infinity;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = stateAtPhase(FULL_TURN * sample / 8192);
    const parameter = state.guideParameter;
    const oneMinus = 1 - parameter;
    const expectedGuideCenter = geometry.guideStart.clone()
      .multiplyScalar(oneMinus ** 2)
      .addScaledVector(
        geometry.guideControl,
        2 * oneMinus * parameter,
      )
      .addScaledVector(geometry.guideEnd, parameter ** 2);
    vectorNear(state.offset.guideCenter, expectedGuideCenter, 4e-16,
      `quadratic guide point at sample ${sample}`);
    near(state.offset.tangent.length(), 1, 4e-16,
      `unit tangent at sample ${sample}`);
    near(state.offset.inwardNormal.length(), 1, 4e-16,
      `unit normal at sample ${sample}`);
    near(state.offset.tangent.dot(state.offset.inwardNormal), 0, 2e-16,
      `orthogonal frame at sample ${sample}`);
    near(
      state.offset.rollerCenter.distanceTo(state.offset.guideCenter),
      geometry.guideToRollerCenter,
      3e-16,
      `roller-center offset at sample ${sample}`,
    );
    near(
      state.offset.contactPoint.distanceTo(state.offset.guideCenter),
      geometry.guideRadius,
      3e-16,
      `guide contact radius at sample ${sample}`,
    );
    near(
      state.offset.rollerCenter.distanceTo(state.offset.contactPoint),
      geometry.rollerRadius,
      4e-16,
      `roller contact radius at sample ${sample}`,
    );
    maximumSurfaceGap = Math.max(
      maximumSurfaceGap,
      Math.abs(state.rollerSurfaceGap),
    );
    maximumTangencyError = Math.max(
      maximumTangencyError,
      Math.abs(state.contactTangencyError),
    );
    minimumGuideParameter = Math.min(
      minimumGuideParameter,
      parameter,
    );
    maximumGuideParameter = Math.max(
      maximumGuideParameter,
      parameter,
    );
  }
  assert.ok(maximumSurfaceGap < 3e-16);
  assert.ok(maximumTangencyError < 3e-16);
  near(minimumGuideParameter, geometry.minimumGuideParameter, 0,
    'minimum guide parameter');
  near(maximumGuideParameter, geometry.maximumGuideParameter, 0,
    'maximum guide parameter');
  disposeModel(model.root);
});

test('movement 274 raises both flyballs and the sleeve through two rigid rods', () => {
  const model = createMovementModel(catalog.movements[273]);
  const {
    geometry,
    stateAtPhase,
    transmission,
  } = model.root.userData;
  const low = stateAtPhase(0);
  const high = stateAtPhase(Math.PI);
  let previous = low;
  let maximumRodError = 0;

  assert.equal(low.stage,
    'low-speed-balls-down-and-in-sleeve-down-reversal');
  assert.equal(high.stage,
    'high-speed-balls-up-and-out-sleeve-up-reversal');
  near(low.ballRiseFraction, 0, 0, 'low ball-rise fraction');
  near(high.ballRiseFraction, 1, 0, 'high ball-rise fraction');
  assert.ok(high.flyballCenter.x > low.flyballCenter.x + 0.30);
  assert.ok(high.flyballCenter.y > low.flyballCenter.y + 0.88);
  assert.ok(high.sleeveY > low.sleeveY + 0.90);
  assert.ok(high.spindleAngularSpeed > low.spindleAngularSpeed + 0.69);
  near(
    high.spindleAngularSpeed - low.spindleAngularSpeed,
    2 * transmission.spindleAngularSpeedAmplitude,
    3e-16,
    'complete demonstrated spindle-speed range',
  );

  for (let sample = 0; sample <= 8192; sample += 1) {
    const phase = Math.PI * sample / 8192;
    const state = stateAtPhase(phase);
    maximumRodError = Math.max(
      maximumRodError,
      Math.abs(state.connectingRodLengthError),
    );
    near(state.connectingRodLength, geometry.connectingRodLength, 5e-16,
      `rod length at sample ${sample}`);
    near(state.connectingRodVector.length(), geometry.connectingRodLength,
      5e-16, `rod vector length at sample ${sample}`);
    near(state.lowerRodPin.x, geometry.sleevePinRadius, 0,
      `sleeve pin radius at sample ${sample}`);
    // The pass-51 lyre refit swings L about 0.63 outside the sleeve pin.
    assert.ok(state.verticalRodSpan > 2.93,
      `positive rod branch at sample ${sample}`);
    if (sample > 0) {
      assert.ok(state.guideParameter <= previous.guideParameter + 1e-15);
      assert.ok(state.offset.rollerCenter.x
        >= previous.offset.rollerCenter.x - 1e-15);
      assert.ok(state.offset.rollerCenter.y
        >= previous.offset.rollerCenter.y - 1e-15);
      assert.ok(state.flyballCenter.x
        >= previous.flyballCenter.x - 1e-15);
      assert.ok(state.flyballCenter.y
        >= previous.flyballCenter.y - 1e-15);
      assert.ok(state.sleeveY >= previous.sleeveY - 1e-15);
    }
    previous = state;
  }
  assert.ok(maximumRodError < 5e-16);
  disposeModel(model.root);
});

test('movement 274 rollers roll smoothly without slip on their guide paths', () => {
  const model = createMovementModel(catalog.movements[273]);
  const {
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  let maximumNoSlipError = 0;
  let previousAngle = stateAtTime(0).rollerSpinAngle;

  for (let sample = 0; sample <= 4096; sample += 1) {
    const time = timeline.cyclePeriod * sample / 4096;
    const state = stateAtTime(time);
    maximumNoSlipError = Math.max(
      maximumNoSlipError,
      Math.abs(state.noSlipVelocityError),
    );
    near(
      state.rollerSpinAngle,
      -state.rollerCenterArcFromSource / geometry.rollerRadius,
      0,
      `arc-to-spin law at sample ${sample}`,
    );
    if (sample <= 2048) {
      assert.ok(state.rollerSpinAngle >= previousAngle - 1e-14,
        `roller turns forward while climbing at sample ${sample}`);
    } else {
      assert.ok(state.rollerSpinAngle <= previousAngle + 1e-14,
        `roller reverses while descending at sample ${sample}`);
    }
    previousAngle = state.rollerSpinAngle;
  }
  assert.ok(maximumNoSlipError < 2.3e-16);

  const timeStep = 1e-5;
  for (const time of [0.31, 1.07, 1.88, 2.73, 3.66, 4.59, 5.82, 7.31]) {
    const before = stateAtTime(time - timeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + timeStep);
    near(
      (after.rollerSpinAngle - before.rollerSpinAngle) / (2 * timeStep),
      state.rollerSpinAngularSpeed,
      1.4e-10,
      `smooth roller angular speed at time ${time}`,
    );
  }
  near(stateAtTime(0).rollerSpinAngle, 0, 0, 'source roller angle');
  near(stateAtTime(timeline.cyclePeriod).rollerSpinAngle, 0, 0,
    'closed roller angle');
  assert.ok(stateAtTime(timeline.cyclePeriod / 2).rollerSpinAngle > 3.98);
  disposeModel(model.root);
});

test('movement 274 analytic local and orbiting rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[273]);
  const { stateAtTime } = model.root.userData;
  const timeStep = 1e-4;

  for (const time of [0.37, 1.13, 2.29, 3.61, 4.77, 6.43, 7.51]) {
    const before = stateAtTime(time - timeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + timeStep);
    const finiteRollerVelocity = after.offset.rollerCenter.clone()
      .sub(before.offset.rollerCenter)
      .multiplyScalar(1 / (2 * timeStep));
    const finiteRollerAcceleration = after.offset.rollerCenter.clone()
      .addScaledVector(state.offset.rollerCenter, -2)
      .add(before.offset.rollerCenter)
      .multiplyScalar(1 / timeStep ** 2);
    vectorNear(finiteRollerVelocity, state.rollerCenterSpeed, 1e-9,
      `local roller velocity at time ${time}`);
    vectorNear(finiteRollerAcceleration,
      state.rollerCenterAcceleration, 2e-7,
      `local roller acceleration at time ${time}`);
    near(
      (after.sleeveY - before.sleeveY) / (2 * timeStep),
      state.sleeveSpeed,
      5e-10,
      `sleeve speed at time ${time}`,
    );
    near(
      (after.sleeveY - 2 * state.sleeveY + before.sleeveY)
        / timeStep ** 2,
      state.sleeveAcceleration,
      2e-7,
      `sleeve acceleration at time ${time}`,
    );

    for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
      for (const key of ['roller', 'ball', 'lowerRodPin']) {
        const finiteVelocity = after.sides[sideIndex][key].position.clone()
          .sub(before.sides[sideIndex][key].position)
          .multiplyScalar(1 / (2 * timeStep));
        const finiteAcceleration = after.sides[sideIndex][key].position
          .clone()
          .addScaledVector(state.sides[sideIndex][key].position, -2)
          .add(before.sides[sideIndex][key].position)
          .multiplyScalar(1 / timeStep ** 2);
        vectorNear(finiteVelocity,
          state.sides[sideIndex][key].velocity, 4e-8,
          `${key} orbit velocity side ${sideIndex} at ${time}`);
        vectorNear(finiteAcceleration,
          state.sides[sideIndex][key].acceleration, 5e-7,
          `${key} orbit acceleration side ${sideIndex} at ${time}`);
      }
    }
    for (const key of ['roller', 'ball', 'lowerRodPin']) {
      near(state.sides[0][key].position.y,
        state.sides[1][key].position.y, 0,
        `${key} symmetric height at ${time}`);
      near(state.sides[0][key].position.x
        + state.sides[1][key].position.x, 0, 2e-15,
      `${key} diametric x at ${time}`);
      near(state.sides[0][key].position.z
        + state.sides[1][key].position.z, 0, 2e-15,
      `${key} diametric z at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 274 renderer binds the moving carriages, rollers, rods, and sleeve', () => {
  const model = createMovementModel(catalog.movements[273]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const fixedObjects = [
    blocks.base,
    blocks.baseStem,
    blocks.lowerBearing,
    ...blocks.shoulderCurves,
    ...blocks.sideAssemblies.map(({ guide }) => guide),
  ].map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
  }));

  near(animationTiming.authoredCyclePeriod, timeline.cyclePeriod, 0,
    'display timing uses full governor cycle');
  assert.equal(animationTiming.targetCycleDuration, 2);
  assert.equal(blocks.sleeveAssembly.userData.axis.y, 1);
  assert.equal(blocks.sideAssemblies.length, 2);

  for (const time of [0, 0.73, 2.11, 3.98, 5.17, 7.36, 8]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.governorRotor.rotation.y, state.spindleAngle, 0,
      `rendered spindle angle at ${time}`);
    near(blocks.governorRotor.userData.angularSpeed,
      state.spindleAngularSpeed, 0,
      `rendered spindle speed at ${time}`);
    near(blocks.sleeveAssembly.position.y, state.sleeveY, 0,
      `rendered sleeve height at ${time}`);
    blocks.sideAssemblies.forEach((assembly, sideIndex) => {
      vectorNear(
        assembly.roller.position,
        new THREE.Vector3(
          state.offset.rollerCenter.x,
          state.offset.rollerCenter.y,
          0,
        ),
        0,
        `rendered roller ${sideIndex} at ${time}`,
      );
      vectorNear(
        assembly.flyball.position,
        new THREE.Vector3(
          state.flyballCenter.x,
          state.flyballCenter.y,
          0,
        ),
        0,
        `rendered flyball ${sideIndex} at ${time}`,
      );
      near(assembly.roller.userData.rotor.rotation.z,
        state.rollerSpinAngle, 0,
        `rendered roller spin ${sideIndex} at ${time}`);
      near(assembly.connectingRod.userData.angularSpeed,
        state.connectingRodAngularSpeed, 0,
        `rendered rod angle rate ${sideIndex} at ${time}`);
      near(model.root.userData.contacts.rods[sideIndex].length,
        geometry.connectingRodLength, 5e-16,
        `rendered rod length ${sideIndex} at ${time}`);
      near(model.root.userData.contacts
        .parabolicGuides[sideIndex].surfaceGap, 0, 2e-16,
      `rendered guide contact ${sideIndex} at ${time}`);
    });
    for (const fixed of fixedObjects) {
      vectorNear(fixed.object.position, fixed.position, 0,
        `fixed ${fixed.object.userData.role} position at ${time}`);
      near(fixed.object.quaternion.angleTo(fixed.quaternion), 0, 0,
        `fixed ${fixed.object.userData.role} orientation at ${time}`);
    }
  }

  const whiteRoles = [];
  model.root.traverse((object) => {
    if (/white-/.test(object.userData.role ?? '')) {
      whiteRoles.push(object.userData.role);
    }
  });
  // Brown draws no phase indices; pass 51 removed them.
  assert.deepEqual(whiteRoles, []);
  disposeModel(model.root);
});

test('movement 274 closes after two spindle turns and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[273]);
  const {
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const source = stateAtTime(0);
  const closed = stateAtTime(timeline.cyclePeriod);

  near(closed.guideParameter, source.guideParameter, 0,
    'guide parameter closure');
  vectorNear(closed.offset.rollerCenter,
    source.offset.rollerCenter, 0, 'roller center closure');
  vectorNear(closed.flyballCenter,
    source.flyballCenter, 0, 'flyball center closure');
  near(closed.sleeveY, source.sleeveY, 0, 'sleeve closure');
  near(closed.rollerSpinAngle, source.rollerSpinAngle, 0,
    'roller spin closure');
  near(closed.spindleAngle - source.spindleAngle,
    timeline.spindleTurnsPerCycle * FULL_TURN, 2e-15,
    'two complete spindle turns');
  near(closed.spindleAngularSpeed, source.spindleAngularSpeed, 0,
    'spindle speed closure');
  for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    for (const key of ['roller', 'ball', 'lowerRodPin']) {
      vectorNear(closed.sides[sideIndex][key].position,
        source.sides[sideIndex][key].position, 3e-15,
        `${key} side ${sideIndex} world closure`);
    }
  }

  model.update(0);
  const sourceSleeveY = blocks.sleeveAssembly.position.y;
  const sourceRollerPositions = blocks.sideAssemblies.map(
    ({ roller }) => roller.position.clone(),
  );
  model.update(timeline.cyclePeriod);
  near(blocks.sleeveAssembly.position.y, sourceSleeveY, 0,
    'rendered sleeve closure');
  blocks.sideAssemblies.forEach(({ roller }, sideIndex) => {
    vectorNear(roller.position, sourceRollerPositions[sideIndex], 0,
      `rendered roller ${sideIndex} closure`);
  });

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
