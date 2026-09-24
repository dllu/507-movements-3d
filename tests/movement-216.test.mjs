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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function signedAngleDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

function expectedPinionAngle(inputAngle) {
  const completedTurns = Math.floor(inputAngle / FULL_TURN);
  const phase = THREE.MathUtils.euclideanModulo(inputAngle, FULL_TURN);
  const phaseOutput = phase <= Math.PI
    ? -phase
    : -Math.PI + 3 * (phase - Math.PI);
  return completedTurns * FULL_TURN + phaseOutput;
}

test('movement 216 is one rigid mutilated compound member driving one complete pinion', () => {
  const movement = catalog.movements[215];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 216);
  assert.equal(movement.number, '216');
  assert.equal(
    movement.title,
    'Alternating External–Internal Mutilated Gear Reverser',
  );
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'coaxial-mutilated-external-internal-gears-alternating-one-pinion',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /external-sector.*internal-ring/);
  assert.equal(sourceAnimation.sourceUrl, movement.sourceUrl);
  assert.equal(sourceAnimation.durationSeconds, 8);

  assert.equal(geometry.pinionTeeth, 16);
  assert.equal(geometry.centralEquivalentTeeth, 16);
  assert.equal(geometry.ringEquivalentTeeth, 48);
  assert.equal(blocks.pinionTeeth.length, 16);
  assert.equal(blocks.centralTeeth.length, 8);
  assert.equal(blocks.centralTeeth.filter(
    ({ userData }) => !userData.transition,
  ).length, 6);
  assert.equal(blocks.ringTeeth.length, 22);
  assert.equal(blocks.ringTeeth.filter(
    ({ userData }) => !userData.transition,
  ).length, 20);
  assert.equal(blocks.centralTeeth.filter(
    ({ userData }) => userData.transition,
  ).length, 2);
  assert.equal(blocks.ringTeeth.filter(
    ({ userData }) => userData.transition,
  ).length, 2);

  const compoundRotor = blocks.compound.userData.rotor;
  assert.equal(blocks.carrierBody.parent, compoundRotor);
  assert.equal(blocks.centralBody.parent, compoundRotor);
  assert.equal(blocks.ringBody.parent, compoundRotor);
  blocks.centralTeeth.forEach((tooth) => {
    assert.equal(tooth.parent, compoundRotor);
  });
  blocks.ringTeeth.forEach((tooth) => {
    assert.equal(tooth.parent, compoundRotor);
  });
  assert.notEqual(blocks.pinion.userData.rotor, compoundRotor);
  blocks.pinionTeeth.forEach((tooth) => {
    assert.equal(tooth.parent, blocks.pinion.userData.rotor);
  });
  assert.equal(blocks.carrierBody.userData.rearCarrier, true);
  assert.equal(blocks.centralBody.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.ringBody.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.carrierBody.geometry.parameters.shapes.holes.length, 1);

  near(geometry.centerDistance, 2, 0, 'shaft center distance');
  near(
    geometry.centralPitchRadius + geometry.pinionPitchRadius,
    geometry.centerDistance,
    0,
    'external pitch circles are tangent',
  );
  near(
    geometry.ringPitchRadius - geometry.pinionPitchRadius,
    geometry.centerDistance,
    0,
    'internal pitch circles are tangent',
  );
  assert.equal(transmission.externalRatio, -1);
  assert.equal(transmission.internalRatio, 3);
  assert.equal(transmission.quickToSlowSpeedMagnitudeRatio, 3);
  assert.equal(transmission.netOutputTurnsPerInputTurn, 1);

  let beltLikeObjects = 0;
  model.root.traverse((object) => {
    const role = String(object.userData.role ?? '');
    if (object.userData.belt || /belt|pulley/i.test(role)) beltLikeObjects += 1;
  });
  assert.equal(beltLikeObjects, 0);
  disposeModel(model.root);
});

test('movement 216 preserves the source radii, sector spans, transition teeth, and key poses', () => {
  const model = createMovementModel(catalog.movements[215]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    modelPointToSourceAnimation,
    sourceAnimation,
    sourceAnimationPointToModel,
    sourceAnimationPointToRaster,
    sourceRaster,
  } = model.root.userData;

  near(geometry.pinionPitchRadius, 1, 0, 'pinion pitch radius');
  near(geometry.centralPitchRadius, 1, 0, 'external-sector pitch radius');
  near(geometry.ringPitchRadius, 3, 0, 'internal-ring pitch radius');
  near(geometry.pinionRootRadius, 0.828125, 0, 'pinion root radius');
  near(geometry.pinionOuterRadius, 1.1125, 0, 'pinion outer radius');
  near(geometry.ringRootRadius, 3.1375, 0, 'ring root radius');
  near(geometry.ringTipRadius, 2.859375, 0, 'ring tooth-tip radius');
  near(geometry.ringOuterRadius, 3.4, 0, 'ring outside radius');
  near(geometry.shaftBoreRadius, 0.3, 0, 'source bore radius');
  near(geometry.sourceHubReferenceRadius, 0.4, 0,
    'source hub reference radius');

  near(
    geometry.centralToothSpecs[0].centerAngle,
    THREE.MathUtils.degToRad(-101.25),
    1e-15,
    'first external transition center',
  );
  near(
    geometry.centralToothSpecs.at(-1).centerAngle,
    THREE.MathUtils.degToRad(-258.75),
    1e-15,
    'last external transition center',
  );
  near(
    geometry.ringToothSpecs[0].centerAngle,
    THREE.MathUtils.degToRad(78.75),
    1e-15,
    'first internal transition center',
  );
  near(
    geometry.ringToothSpecs.at(-1).centerAngle,
    THREE.MathUtils.degToRad(-78.75),
    1e-15,
    'last internal transition center',
  );

  const expectedCentralEntry = [
    [5.83108, 0.828125],
    [5.83108, 0.894712],
    [-5.489355, 0.963494],
    [-5.83108, 0.939693],
    [-5.83108, 0.828125],
  ];
  const expectedRingEntry = [
    [2.70197, 3.1375],
    [1.878461, 3.03707],
    [-1.439939, 2.973216],
    [-1.930156, 3.044792],
    [-2.701976, 3.1375],
  ];
  expectedCentralEntry.forEach(([degrees, radius], index) => {
    const [actualOffset, actualRadius] =
      geometry.centralEntryTransitionLevels[index];
    near(actualOffset, THREE.MathUtils.degToRad(degrees), 1e-15,
      `external transition offset ${index}`);
    near(actualRadius, radius, 1e-15,
      `external transition radius ${index}`);
  });
  expectedRingEntry.forEach(([degrees, radius], index) => {
    const [actualOffset, actualRadius] =
      geometry.ringEntryTransitionLevels[index];
    near(actualOffset, THREE.MathUtils.degToRad(degrees), 1e-15,
      `internal transition offset ${index}`);
    near(actualRadius, radius, 1e-15,
      `internal transition radius ${index}`);
  });
  assert.equal(geometry.centralToothProfiles[0].length, 5);
  assert.equal(geometry.centralToothProfiles.at(-1).length, 5);
  assert.equal(geometry.ringToothProfiles[0].length, 5);
  assert.equal(geometry.ringToothProfiles.at(-1).length, 5);
  expectedCentralEntry.forEach(([degrees, radius], index) => {
    const point = geometry.centralToothProfiles[0][index];
    near(point.length(), radius, 2e-7,
      `built external transition radius ${index}`);
    near(
      signedAngleDifference(
        Math.atan2(point.y, point.x),
        geometry.centralToothSpecs[0].centerAngle,
      ),
      THREE.MathUtils.degToRad(degrees),
      2e-15,
      `built external transition offset ${index}`,
    );
  });

  assert.deepEqual(
    sourceAnimation.keyframes.map(({ cpos, pinionDirection }) => (
      [cpos, pinionDirection]
    )),
    [
      [0, 'right'],
      [0.5, 'left'],
      [2 / 3, 'right'],
      [5 / 6, 'left'],
      [1, 'right'],
    ],
  );
  const expectedAngles = [
    [0, 0],
    [Math.PI, -Math.PI],
    [4 * Math.PI / 3, 0],
    [5 * Math.PI / 3, Math.PI],
    [FULL_TURN, FULL_TURN],
  ];
  sourceAnimation.keyframes.forEach((keyframe, index) => {
    near(keyframe.inputAngle, expectedAngles[index][0], 2e-15,
      `source input keyframe ${index}`);
    near(keyframe.pinionAngle, expectedAngles[index][1], 4e-15,
      `source pinion keyframe ${index}`);
  });
  assert.deepEqual(sourceAnimation.externalMeshCycleInterval, [0, 0.5]);
  assert.deepEqual(sourceAnimation.internalMeshCycleInterval, [0.5, 1]);
  assert.equal(sourceAnimation.modelCyclePositionsPerMechanicalCycle, 2);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);

  vector2Near(sourceRaster.fittedCompoundCenter, new THREE.Vector2(262.5, 262.5),
    1e-12, 'source compound center in raster');
  vector2Near(sourceRaster.fittedPinionCenter, new THREE.Vector2(262.5, 402.5),
    1e-12, 'source pinion center in raster');
  near(sourceRaster.fittedOuterRadius, 238, 1e-12,
    'source outside radius in raster');
  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  const sourcePoint = new THREE.Vector2(-1.2, 2.3);
  const modelPoint = sourceAnimationPointToModel(sourcePoint, 0.27);
  vector2Near(modelPointToSourceAnimation(modelPoint), sourcePoint, 0,
    'source/model point transform round-trip');
  vector2Near(
    sourceAnimationPointToRaster(geometry.pinionCenter),
    sourceRaster.fittedPinionCenter,
    0,
    'pinion source/raster transform',
  );

  // Display time starts at the plate's pose, a quarter input turn after the
  // site animation's hand-off pose.
  near(sourceAnimation.displayStartInputAngle, Math.PI / 2, 0,
    'plate pose input angle');
  near(sourceAnimation.displayTimeOffset, 2, 0, 'plate pose time offset');
  near(canonicalTimes.sourcePose, 0, 0, 'plate pose time');
  near(canonicalTimes.midSlowForward, 0, 0, 'slow-stroke midpoint time');
  near(canonicalTimes.externalToInternalHandoff, 2, 0,
    'reversal handoff time');
  near(canonicalTimes.cycleClosure, 8, 0, 'cycle closure time');
  near(canonicalTimes.animationHandoffPose, 6, 0,
    'site animation hand-off time');
  near(canonicalStates.midSlowForward.pinionAngle, -Math.PI / 2, 1e-15,
    'slow-stroke midpoint pinion pose');
  near(canonicalStates.externalToInternalHandoff.pinionAngle, -Math.PI, 1e-15,
    'reversal pose');
  near(canonicalStates.cycleClosure.pinionAngle, FULL_TURN - Math.PI / 2,
    1e-15, 'closure returns to the plate pose one output turn later');
  near(canonicalStates.animationHandoffPose.pinionAngle, FULL_TURN, 1e-15,
    'animation hand-off pose');
  disposeModel(model.root);
});

test('movement 216 obeys the slow external and three-times-fast internal laws over 32,769 states', () => {
  const model = createMovementModel(catalog.movements[215]);
  const {
    pinionAngleAtInputAngle,
    stateAtInputAngle,
    transmission,
  } = model.root.userData;
  const stateCount = 32769;
  const firstInputAngle = -2 * FULL_TURN;
  const inputSpan = 4 * FULL_TURN;
  let externalStateCount = 0;
  let internalStateCount = 0;

  for (let index = 0; index < stateCount; index += 1) {
    const inputAngle = firstInputAngle
      + inputSpan * index / (stateCount - 1);
    const state = stateAtInputAngle(inputAngle);
    const expectedOutput = expectedPinionAngle(inputAngle);
    near(state.pinionAngle, expectedOutput, 3e-14,
      `pinion law at state ${index}`);
    near(pinionAngleAtInputAngle(inputAngle), expectedOutput, 3e-14,
      `direct pinion law at state ${index}`);
    near(state.externalMesh.pitchTangencyError, 0, 0,
      `external pitch tangency at state ${index}`);
    near(state.internalMesh.pitchTangencyError, 0, 0,
      `internal pitch tangency at state ${index}`);
    assert.ok(Number.isFinite(state.radialEnvelopeMargins
      .centralTeethToPinionOuter));
    assert.ok(Number.isFinite(state.radialEnvelopeMargins
      .ringTeethToPinionOuter));

    if (!state.atCycleHandoff && !state.atMeshHandoff) {
      if (state.phase < Math.PI) {
        externalStateCount += 1;
        assert.equal(state.stage, 'slow-forward-external-sector-mesh');
        assert.equal(state.externalMesh.active, true);
        assert.equal(state.internalMesh.active, false);
        assert.equal(state.instantaneousRatio, -1);
        assert.ok(state.pinionAngularSpeed < 0);
        near(state.externalMesh.velocityError, 0, 2e-15,
          `external pitch speed at state ${index}`);
        near(state.externalMesh.halfPitchPhaseError, 0, 8e-14,
          `external tooth phase at state ${index}`);
      } else {
        internalStateCount += 1;
        assert.equal(state.stage, 'quick-reverse-internal-ring-mesh');
        assert.equal(state.externalMesh.active, false);
        assert.equal(state.internalMesh.active, true);
        assert.equal(state.instantaneousRatio, 3);
        assert.ok(state.pinionAngularSpeed > 0);
        near(state.internalMesh.velocityError, 0, 2e-15,
          `internal pitch speed at state ${index}`);
        near(state.internalMesh.halfPitchPhaseError, 0, 8e-14,
          `internal tooth phase at state ${index}`);
      }
    } else {
      assert.equal(state.externalMesh.active, true);
      assert.equal(state.internalMesh.active, true);
      assert.equal(
        state.velocityDiscontinuity.intentionalIdealGearHandoff,
        true,
      );
      near(state.externalMesh.halfPitchPhaseError, 0, 8e-14,
        `handoff external tooth phase at state ${index}`);
      near(state.internalMesh.halfPitchPhaseError, 0, 8e-14,
        `handoff internal tooth phase at state ${index}`);
    }
  }
  assert.ok(externalStateCount > 16000);
  assert.ok(internalStateCount > 16000);

  const epsilon = 1e-8;
  near(
    pinionAngleAtInputAngle(Math.PI - epsilon),
    -Math.PI + epsilon,
    2e-15,
    'left limit at the reversal',
  );
  near(
    pinionAngleAtInputAngle(Math.PI + epsilon),
    -Math.PI + 3 * epsilon,
    4e-15,
    'right limit at the reversal',
  );
  near(
    pinionAngleAtInputAngle(FULL_TURN - epsilon),
    FULL_TURN - 3 * epsilon,
    4e-15,
    'left limit at cycle closure',
  );
  near(
    pinionAngleAtInputAngle(FULL_TURN + epsilon),
    FULL_TURN - epsilon,
    4e-15,
    'right limit at cycle closure',
  );
  for (const probe of [-5.4, -0.7, 0.2, 2.8, 5.9, 9.1]) {
    near(
      pinionAngleAtInputAngle(probe + FULL_TURN)
        - pinionAngleAtInputAngle(probe),
      FULL_TURN,
      4e-15,
      `one net output turn per input turn at ${probe}`,
    );
  }
  assert.equal(transmission.externalRatio, -1);
  assert.equal(transmission.internalRatio, 3);
  near(
    Math.abs(transmission.internalRatio / transmission.externalRatio),
    3,
    0,
    'quick/slow speed ratio',
  );
  disposeModel(model.root);
});

test('movement 216 transition teeth remain collision-free and the rear carrier clears the working plane', () => {
  const model = createMovementModel(catalog.movements[215]);
  const {
    blocks,
    geometry,
    radialEnvelopeMarginsAtInputAngle,
    solidInterferenceAtInputAngle,
  } = model.root.userData;
  const stateCount = 16385;
  for (let index = 0; index < stateCount; index += 1) {
    const inputAngle = FULL_TURN * index / (stateCount - 1);
    const interference = solidInterferenceAtInputAngle(inputAngle);
    assert.equal(
      interference.hasSolidInterference,
      false,
      `no tooth polygons intersect at state ${index}`,
    );
    assert.deepEqual(interference.centralPairs, []);
    assert.deepEqual(interference.ringPairs, []);
  }

  const radialMargins = radialEnvelopeMarginsAtInputAngle(0.37);
  near(radialMargins.centralRootToPinionOuter, 0.059375, 2e-16,
    'inactive central root clears pinion outer radius');
  near(radialMargins.ringRootToPinionOuter, 0.025, 3e-16,
    'inactive ring root clears pinion outer radius');

  model.root.updateMatrixWorld(true);
  const carrierBounds = new THREE.Box3().setFromObject(blocks.carrierBody);
  const centralBounds = new THREE.Box3().setFromObject(blocks.centralBody);
  const ringBounds = new THREE.Box3().setFromObject(blocks.ringBody);
  const pinionBounds = new THREE.Box3().setFromObject(blocks.pinionBody);
  near(
    centralBounds.min.z - carrierBounds.max.z,
    geometry.carrierAxialGap,
    1e-8,
    'rear carrier clears central working plane',
  );
  near(
    ringBounds.min.z - carrierBounds.max.z,
    geometry.carrierAxialGap,
    1e-8,
    'rear carrier clears ring working plane',
  );
  near(centralBounds.min.z, pinionBounds.min.z, 0,
    'external sector and pinion share a working plane');
  near(centralBounds.max.z, pinionBounds.max.z, 0,
    'external sector and pinion share a front face');
  near(ringBounds.min.z, pinionBounds.min.z, 0,
    'internal sector and pinion share a working plane');
  assert.ok(geometry.carrierAxialGap > 0.06);

  const sweptBounds = new THREE.Box3();
  for (const time of Object.values(model.root.userData.canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    sweptBounds.union(new THREE.Box3().setFromObject(model.root));
  }
  const sweptSize = sweptBounds.getSize(new THREE.Vector3());
  assert.ok(sweptSize.x > 9);
  assert.ok(sweptSize.y > 9);
  assert.ok(sweptSize.z > 1.7, 'the carrier uses depth without the undrawn frame');
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  // 30 teeth, 16 pinion teeth and the bodies, hubs and shafts remain once
  // the undrawn frame, rate indices and contact markers are presented away.
  assert.ok(meshCount >= 55, 'the undrawn frame is presented away');
  const removedRoles = model.root.userData.sourcePresentation.removedRoles;
  for (const role of [
    'compound-input-angular-rate-index',
    'pinion-variable-rate-index',
    'slow-forward-external-mesh-contact',
    'quick-reverse-internal-mesh-contact',
  ]) assert.ok(removedRoles.includes(role), role);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  disposeModel(model.root);
});

test('movement 216 runtime exposes both handoffs and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[215]);
  const {
    blocks,
    canonicalTimes,
    geometry,
  } = model.root.userData;

  // One cycle earlier than the closure, i.e. the site animation's pose.
  model.update(canonicalTimes.animationHandoffPose - 8);
  near(blocks.compound.userData.rotor.rotation.z, 0, 0,
    'rendered animation hand-off compound angle');
  near(blocks.pinion.userData.rotor.rotation.z, 0, 0,
    'rendered animation hand-off pinion angle');
  assert.equal(blocks.externalContactMarker.visible, true);
  assert.equal(blocks.internalContactMarker.visible, true);
  assert.ok(model.root.userData.contacts.externalMesh);
  assert.ok(model.root.userData.contacts.internalMesh);

  near(canonicalTimes.sourcePose, canonicalTimes.midSlowForward, 0,
    'plate pose is the slow-stroke midpoint');
  model.update(canonicalTimes.sourcePose);
  near(blocks.compound.userData.rotor.rotation.z, Math.PI / 2, 1e-15,
    'rendered slow-stroke compound angle');
  near(blocks.pinion.userData.rotor.rotation.z, -Math.PI / 2, 1e-15,
    'rendered slow-stroke pinion angle');
  assert.equal(blocks.externalContactMarker.visible, true);
  assert.equal(blocks.internalContactMarker.visible, false);
  near(blocks.pinion.userData.angularSpeed,
    -model.root.userData.transmission.inputAngularSpeed, 0,
    'rendered slow pinion speed');

  model.update(canonicalTimes.externalToInternalHandoff);
  assert.equal(blocks.externalContactMarker.visible, true);
  assert.equal(blocks.internalContactMarker.visible, true);
  assert.equal(
    model.root.userData.contacts.reversalHandoff
      .intentionalIdealGearHandoff,
    true,
  );
  model.update(4);
  near(blocks.compound.userData.rotor.rotation.z, 3 * Math.PI / 2, 2e-15,
    'rendered quick-stroke compound angle');
  near(blocks.pinion.userData.rotor.rotation.z, Math.PI / 2, 4e-15,
    'rendered quick-stroke pinion angle');
  assert.equal(blocks.externalContactMarker.visible, false);
  assert.equal(blocks.internalContactMarker.visible, true);
  near(blocks.pinion.userData.angularSpeed,
    3 * model.root.userData.transmission.inputAngularSpeed, 0,
    'rendered quick pinion speed');

  model.update(canonicalTimes.animationHandoffPose);
  near(blocks.compound.userData.rotor.rotation.z, FULL_TURN, 2e-15,
    'rendered compound closure');
  near(blocks.pinion.userData.rotor.rotation.z, FULL_TURN, 2e-15,
    'rendered pinion closure');
  assert.equal(blocks.externalContactMarker.visible, true);
  assert.equal(blocks.internalContactMarker.visible, true);
  const externalMarkerWorld = new THREE.Vector3();
  const internalMarkerWorld = new THREE.Vector3();
  blocks.externalContactMarker.getWorldPosition(externalMarkerWorld);
  blocks.internalContactMarker.getWorldPosition(internalMarkerWorld);
  vector2Near(
    new THREE.Vector2(externalMarkerWorld.x, externalMarkerWorld.y),
    geometry.externalContactPoint,
    0,
    'external marker stays on the upper pitch point',
  );
  vector2Near(
    new THREE.Vector2(internalMarkerWorld.x, internalMarkerWorld.y),
    geometry.internalContactPoint,
    0,
    'internal marker stays on the lower pitch point',
  );

  const movement215 = createMovementModel(catalog.movements[214]);
  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[214].id, 215);
  assert.equal(catalog.movements[214].fidelity, 'authored');
  assert.equal(movement215.root.userData.fidelity, 'authored');
  assert.equal(catalog.movements[215].id, 216);
  assert.equal(catalog.movements[215].fidelity, 'authored');
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement215.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement507.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement215.root);
  disposeModel(movement507.root);
  disposeModel(model.root);
});
