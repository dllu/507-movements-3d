import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { createWoolComberTransmission } from '../src/simulation/authored-wool-comber.js';

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

function directionFromRaster(point, center) {
  return new THREE.Vector2(
    point.x - center.x,
    center.y - point.y,
  ).normalize();
}

test('movement 218 is the independently authored output plate of 217', () => {
  const movement = catalog.movements[217];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    geometry,
    presentation,
    sharedMechanismKey,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 218);
  assert.equal(movement.number, '218');
  assert.equal(
    movement.title,
    'Hinged-Catch Notch-Wheel Wool-Comber Roller Motion',
  );
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'rocking-lever-hinged-catch-nine-notch-wool-comber-roller-output',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sharedMechanismKey, 'brown-217-218-wool-comber-roller');
  assert.deepEqual(presentation, {
    companionDriverVisible: false,
    focus: 'plate-218-output-rocker-catch-and-notch-wheel',
    plate: 218,
  });
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.sourceUrl, movement.sourceUrl);

  assert.equal(geometry.outputPlateFocus, true);
  assert.equal(blocks.camRotor.visible, false);
  assert.equal(blocks.lowerBearing.visible, false);
  assert.equal(blocks.upperBearing.visible, false);
  assert.equal(blocks.framePost.visible, false);
  assert.equal(blocks.frameTop.visible, false);
  assert.equal(blocks.frameBase.visible, false);
  assert.equal(blocks.outputRotor.visible, true);
  assert.equal(blocks.rocker.visible, true);
  assert.equal(blocks.catchLink.visible, true);
  assert.equal(blocks.notchWheel.parent, blocks.outputRotor);
  assert.equal(blocks.outputHubRing.parent, blocks.outputRotor);
  assert.equal(blocks.rockerBody.parent, blocks.rocker);
  assert.equal(blocks.followerRoller.parent, blocks.rocker);
  assert.equal(blocks.followerSourceRing.parent, blocks.rocker);
  assert.equal(blocks.catchPivotRing.parent, blocks.rocker);
  assert.equal(blocks.catchBar.parent, blocks.catchLink);
  assert.equal(blocks.catchHookTongue.parent, blocks.catchLink);
  assert.equal(blocks.catchHook.parent, blocks.catchLink);
  assert.equal(blocks.tripRoller.parent, blocks.catchLink);
  // Plate 218 draws the lever and catch G as flat bars: an S lever bored at
  // H and a broad arched catch ending in a notch lug.
  assert.equal(blocks.rockerBody.geometry.type, 'ExtrudeGeometry');
  assert.equal(blocks.rockerBody.geometry.parameters.shapes.holes.length, 2);
  assert.equal(blocks.catchBar.geometry.type, 'ExtrudeGeometry');
  assert.equal(blocks.catchBar.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.outputHubRing.visible, false);
  assert.equal(blocks.wheelIndex.visible, false);
  assert.equal(blocks.catchIndex.visible, false);
  assert.equal(blocks.followerContactMarker.visible, false);
  assert.equal(geometry.notchCount, 8);
  assert.equal(
    blocks.notchWheel.geometry.parameters.shapes.holes.length,
    1,
  );
  assert.ok(model.root.userData.cameraFitBounds?.isBox3);

  const visibleRoles = [];
  model.root.traverseVisible((object) => {
    if (object.userData.role) visibleRoles.push(object.userData.role);
  });
  assert.ok(visibleRoles.includes('F-solid-eight-notch-wheel'));
  assert.ok(visibleRoles.includes('curved-rocker-link-A-to-G'));
  assert.ok(visibleRoles.includes('G-catch-trip-boss-struck-at-e'));
  // G's lug is the flat end of the catch bar; the wire tongue is hidden.
  assert.equal(visibleRoles.includes('G-visible-hook-tongue'), false);
  assert.equal(visibleRoles.some((role) => /heart-cam-land/.test(role)), false);
  assert.equal(visibleRoles.some((role) => /belt/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 218 reproduces the A-H-G source proportions and curved catch order', () => {
  const model = createMovementModel(catalog.movements[217]);
  const {
    canonicalTimes,
    geometry,
    sourceReference,
  } = model.root.userData;
  const plate = sourceReference.plate218;

  assert.equal(
    sourceReference.companionPlateUrl,
    'https://507movements.com/mm_217.html',
  );
  assert.deepEqual(plate.rasterOutputCenterH.toArray(), [264, 264]);
  assert.deepEqual(plate.rasterFollowerA.toArray(), [241, 492]);
  assert.deepEqual(plate.rasterCatchPivot.toArray(), [350, 63]);
  assert.deepEqual(plate.rasterCatchTripBoss.toArray(), [267, 50]);
  assert.deepEqual(plate.rasterHookContact.toArray(), [160, 105]);
  assert.equal(plate.rasterWheelOuterRadius, 185);
  assert.equal(plate.schematicVisibleNotchCount, 8);
  assert.match(model.root.userData.notchCountRationale, /schematically/);

  model.update(canonicalTimes.sourcePoseD);
  const state = model.root.userData.kinematics;
  const center = plate.rasterOutputCenterH;
  const followerFromH = state.followerWorld.clone().sub(geometry.outputCenter);
  const pivotFromH = state.catchPivotWorld.clone().sub(geometry.outputCenter);
  const bossFromH = state.catchTripBossWorld.clone().sub(
    geometry.outputCenter,
  );
  const hookFromH = state.catchHookWorld.clone().sub(geometry.outputCenter);

  assert.ok(followerFromH.clone().normalize().angleTo(
    directionFromRaster(plate.rasterFollowerA, center),
  ) < 0.11);
  assert.ok(pivotFromH.clone().normalize().angleTo(
    directionFromRaster(plate.rasterCatchPivot, center),
  ) < 0.004);
  assert.ok(bossFromH.clone().normalize().angleTo(
    directionFromRaster(plate.rasterCatchTripBoss, center),
  ) < 0.015);
  assert.ok(hookFromH.clone().normalize().angleTo(
    directionFromRaster(plate.rasterHookContact, center),
  ) < 0.04);

  const sourceFollowerRadius = plate.rasterFollowerA.distanceTo(center);
  const sourcePivotRadius = plate.rasterCatchPivot.distanceTo(center);
  const sourceBossRadius = plate.rasterCatchTripBoss.distanceTo(center);
  near(
    geometry.followerArmRadius / geometry.notchWheelOuterRadius,
    sourceFollowerRadius / plate.rasterWheelOuterRadius,
    0.025,
    'A-to-H radius ratio',
  );
  near(
    geometry.catchPivotRadius / geometry.notchWheelOuterRadius,
    sourcePivotRadius / plate.rasterWheelOuterRadius,
    0.025,
    'G-hinge-to-H radius ratio',
  );
  near(
    geometry.catchTripBossRadiusFromOutput
      / geometry.notchWheelOuterRadius,
    sourceBossRadius / plate.rasterWheelOuterRadius,
    0.02,
    'G-boss-to-H radius ratio',
  );
  assert.ok(pivotFromH.x > 0 && pivotFromH.y > 0);
  assert.ok(Math.abs(bossFromH.x) < 2e-15 && bossFromH.y > 0);
  assert.ok(hookFromH.x < 0 && hookFromH.y > 0);
  assert.ok(followerFromH.y < 0);
  disposeModel(model.root);
});

test('movement 218 turns 3/8 back, 3/4 forward, then dwells, meeting 217 at D', () => {
  // Plate 217 presents the heart cam alone; the shared transmission is
  // built in its orientation to compare the law.
  const camPlate = createWoolComberTransmission(217);
  const outputPlate = createMovementModel(catalog.movements[217]);
  const state217 = camPlate.root.userData.stateAtInputTravel;
  const state218 = outputPlate.root.userData.stateAtInputTravel;
  const {
    backwardEndPhase,
    forwardEndPhase,
    inputTravelAngularSpeed,
    netOutputAdvance,
  } = outputPlate.root.userData.motion;

  assert.equal(
    camPlate.root.userData.sharedMechanismKey,
    outputPlate.root.userData.sharedMechanismKey,
  );
  // Brown's eight notches: the caption's 1:2 back/forward ratio with a net
  // 3/8 advance, three notch pitches.
  near(netOutputAdvance, 3 * FULL_TURN / 8, 0, 'net output advance');
  near(netOutputAdvance / outputPlate.root.userData.geometry.notchPitchAngle, 3, 1e-15,
    'one cycle advances exactly three of eight notches');
  const atC = state218(0);
  const atD = state218(backwardEndPhase * FULL_TURN);
  const atE = state218(forwardEndPhase * FULL_TURN);
  const inDwell = state218(0.78 * FULL_TURN);
  const nextC = state218(FULL_TURN);
  near(atC.outputAngle, 0, 0, 'C output');
  near(atD.outputAngle, -3 * FULL_TURN / 8, 5e-16, 'D output');
  near(atE.outputAngle, 3 * FULL_TURN / 8, 5e-16, 'e output');
  near(inDwell.outputAngle, 3 * FULL_TURN / 8, 5e-16, 'dwell output');
  near(nextC.outputAngle, 3 * FULL_TURN / 8, 5e-16, 'next C output');
  // At D (the plate-218 pose) the rocker, catch and hook stand exactly where
  // the caption-law 217 transmission puts them.
  const d217 = state217(backwardEndPhase * FULL_TURN);
  for (const key of ['followerWorld', 'catchPivotWorld', 'catchTripBossWorld', 'catchHookWorld']) {
    assert.ok(d217[key].distanceTo(atD[key]) < 1e-12, `${key} at D`);
  }
  near(inDwell.outputAngularSpeed, 0, 0, 'dwell speed');
  near(inDwell.outputAngularAcceleration, 0, 0, 'dwell acceleration');

  let maximumNotchError = 0;
  let maximumGrooveError = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const inputTravel = index / 32768 * FULL_TURN;
    const right = state218(inputTravel);
    maximumGrooveError = Math.max(
      maximumGrooveError,
      right.grooveConstraintError,
      Math.abs(right.grooveNormalVelocityError),
    );
    if (right.catchEngaged) {
      maximumNotchError = Math.max(
        maximumNotchError,
        Math.abs(right.nearestNotchAngularDifference),
      );
      near(right.outputAngularSpeed, right.rockerAngularSpeed, 0,
        `engaged speed ${index}`);
    } else {
      near(right.outputAngularSpeed, 0, 0, `dwell speed ${index}`);
    }
  }
  assert.ok(maximumNotchError < 3e-15);
  assert.ok(maximumGrooveError < 6e-15);

  const finiteDifferenceStep = 1e-5;
  for (const phase of [0.04, 0.23, 0.44, 0.62, 0.83, 0.97]) {
    const inputTravel = phase * FULL_TURN;
    const state = state218(inputTravel);
    const previous = state218(
      inputTravel - inputTravelAngularSpeed * finiteDifferenceStep,
    );
    const next = state218(
      inputTravel + inputTravelAngularSpeed * finiteDifferenceStep,
    );
    near(
      (next.outputAngle - previous.outputAngle)
        / (2 * finiteDifferenceStep),
      state.outputAngularSpeed,
      3e-8,
      `output analytic speed at ${phase}`,
    );
    near(
      (next.catchAngle - previous.catchAngle)
        / (2 * finiteDifferenceStep),
      state.catchAngularSpeed,
      4e-8,
      `catch analytic speed at ${phase}`,
    );
  }
  disposeModel(camPlate.root);
  disposeModel(outputPlate.root);
});

test('movement 218 catch, hook, wheel, and visible axial layers stay disjoint', () => {
  const model = createMovementModel(catalog.movements[217]);
  const {
    geometry,
    motion,
  } = model.root.userData;
  const stateAtInputTravel = model.root.userData.stateAtInputTravel;
  const atE = stateAtInputTravel(motion.forwardEndPhase * FULL_TURN);

  near(atE.tripClearance, 0, 3e-15, 'G boss meets rear projection at e');
  assert.equal(atE.tripContact, true);
  vector2Near(
    atE.catchTripBossWorld,
    atE.tripLugWorld.clone().addScaledVector(
      atE.catchTripBossWorld.clone().sub(atE.tripLugWorld).normalize(),
      geometry.tripContactDistance,
    ),
    3e-15,
    'trip tangency',
  );

  let minimumCatchClearance = Infinity;
  let minimumPlainRimClearance = Infinity;
  let minimumTripClearance = Infinity;
  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtInputTravel(index / 32768 * FULL_TURN);
    minimumCatchClearance = Math.min(
      minimumCatchClearance,
      state.catchSolidClearance,
    );
    minimumTripClearance = Math.min(
      minimumTripClearance,
      state.tripClearance,
    );
    if (!state.hookWithinNotchOpening) {
      minimumPlainRimClearance = Math.min(
        minimumPlainRimClearance,
        state.catchSolidClearance,
      );
    }
  }
  assert.ok(minimumCatchClearance > geometry.notchReliefClearance - 0.00011);
  // The hook sits just inside F's rim in Brown's shallow notch, so it passes
  // the notch corner closer than the former deep slot (0.021 vs 0.028).
  assert.ok(minimumPlainRimClearance > 0.02);
  assert.ok(minimumTripClearance > -1e-12);

  const clearances = model.root.userData.solidClearanceAtInputTravel(
    0.78 * FULL_TURN,
  );
  assert.ok(clearances.rockerToWheelAxialClearance > 0.029);
  near(
    clearances.followerToEachGrooveWallClearance,
    geometry.grooveHalfWidth - geometry.followerRollerRadius,
    0,
    'hidden companion follower remains captured',
  );
  const wheelMinimumZ = geometry.wheelCenterZ - geometry.wheelDepth / 2;
  const wheelMaximumZ = geometry.wheelCenterZ + geometry.wheelDepth / 2;
  const hookMinimumZ = geometry.catchHookCenterZ
    - geometry.catchHookLength / 2;
  const hookMaximumZ = geometry.catchHookCenterZ
    + geometry.catchHookLength / 2;
  assert.ok(hookMinimumZ < wheelMaximumZ);
  assert.ok(hookMaximumZ > wheelMinimumZ);
  assert.ok(0.51 - 0.12 > wheelMaximumZ);
  const fitSize = model.root.userData.cameraFitBounds.getSize(
    new THREE.Vector3(),
  );
  assert.deepEqual(fitSize.toArray(), [4.7, 4.8, 1.42]);
  disposeModel(model.root);
});

test('movement 218 runtime exposes release and dwell while 262 stays authored', () => {
  const model = createMovementModel(catalog.movements[217]);
  const {
    blocks,
    canonicalTimes,
    geometry,
  } = model.root.userData;

  model.update(canonicalTimes.sourcePoseD);
  const sourceState = model.root.userData.kinematics;
  near(blocks.rocker.rotation.z, sourceState.rockerAngle, 0,
    'rendered rocker angle');
  near(blocks.outputRotor.rotation.z, sourceState.outputAngle, 0,
    'rendered F angle');
  near(blocks.catchLink.rotation.z, sourceState.catchAngle, 0,
    'rendered G angle');
  vector2Near(
    new THREE.Vector2(blocks.catchLink.position.x, blocks.catchLink.position.y),
    sourceState.catchPivotWorld,
    0,
    'rendered G hinge',
  );
  assert.equal(blocks.camRotor.visible, false);
  assert.equal(blocks.followerSourceRing.visible, true);
  // Brown draws no contact markers; the contact itself is still reported.
  assert.equal(blocks.catchContactMarker.visible, false);
  assert.equal(blocks.tripContactMarker.visible, false);
  assert.ok(model.root.userData.contacts.catchToNotch);

  model.update(canonicalTimes.eCatchRelease);
  assert.ok(model.root.userData.contacts.tripAtE);
  assert.equal(blocks.tripContactMarker.visible, false);
  model.update(canonicalTimes.midDwellReturn);
  assert.equal(blocks.catchContactMarker.visible, false);
  assert.equal(model.root.userData.contacts.catchToNotch, null);
  near(blocks.outputRotor.userData.angularSpeed, 0, 0,
    'F is visibly stopped during e-to-C return');
  assert.ok(model.root.userData.kinematics.catchSolidClearance > 0.16);
  model.update(canonicalTimes.nextCReengagement);
  assert.equal(blocks.catchContactMarker.visible, false);
  assert.ok(model.root.userData.contacts.catchToNotch);
  assert.deepEqual(model.cameraDirection.toArray(), [0, 0, 15]);
  assert.equal(geometry.outputPlateFocus, true);

  const movement217 = createMovementModel(catalog.movements[216]);
  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[216].fidelity, 'authored');
  assert.equal(movement217.root.userData.fidelity, 'authored');
  assert.equal(catalog.movements[217].fidelity, 'authored');
  assert.equal(catalog.movements[218].id, 219);
  assert.equal(catalog.movements[218].fidelity, 'authored');
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  const transmission217 = createWoolComberTransmission(217);
  assert.equal(
    transmission217.root.userData.sharedMechanismKey,
    model.root.userData.sharedMechanismKey,
  );
  disposeModel(transmission217.root);
  assert.notEqual(
    movement217.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement507.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement217.root);
  disposeModel(movement507.root);
  disposeModel(model.root);
});
