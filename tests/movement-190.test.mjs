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
  const actual2 = new THREE.Vector2(actual.x, actual.y);
  const expected2 = new THREE.Vector2(expected.x, expected.y);
  assert.ok(
    actual2.distanceTo(expected2) <= tolerance,
    `${message}: expected ${expected2.toArray()}, received ${actual2.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function worldPoint(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function finiteStateNumbers(value, path = 'state') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} is finite`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value.isVector2 || value.isVector3) {
    value.toArray().forEach((coordinate, index) => {
      assert.ok(Number.isFinite(coordinate), `${path}[${index}] is finite`);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    finiteStateNumbers(child, `${path}.${key}`);
  }
}

test('movement 190 matches Brown\'s fixed nut, vertical screw, pivoted holder, and workpiece topology', () => {
  const movement = catalog.movements[189];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    closureLawAtCycleTime,
    geometry,
    holderBearingAtAngle,
    modelPointToSourceRaster,
    sourcePointToModel,
    stateAtClosure,
    stateAtCycleTime,
    stateAtTime,
  } = model.root.userData;
  const {
    bench,
    externalThread,
    fixedFrame,
    fulcrumPin,
    handleArm,
    handleGrip,
    handleTipAnchor,
    holder,
    holderCheeks,
    holderPivotAnchor,
    internalThread,
    nutAxisAnchor,
    nutBody,
    screw,
    screwRotor,
    shoe,
    shoePin,
    shoePinAnchor,
    shoePlate,
    thrustCollar,
    thrustContactAnchor,
    workContactAnchor,
    workpiece,
  } = blocks;

  assert.equal(movement.id, 190);
  assert.equal(movement.number, '190');
  assert.equal(movement.title, 'Screw-Thrust Lever Clamp');
  assert.equal(movement.category, 'Screws & threads');
  assert.equal(
    movement.description,
    '190. A screw-clamp. On turning the handle the screw thrusts upward against the holder, which, operating as a lever, holds down the piece of wood or other material placed under it on the other side of its fulcrum.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_190.html');
  assert.equal(
    movement.archetype,
    'vertical-screw-thrust-pivoted-holder-lever-workpiece-clamp',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'vertical-right-hand-screw-in-fixed-nut-thrusts-short-arm-of-fixed-fulcrum-holder-so-long-arm-shoe-clamps-workpiece',
  );
  for (const fn of [
    closureLawAtCycleTime,
    holderBearingAtAngle,
    modelPointToSourceRaster,
    sourcePointToModel,
    stateAtClosure,
    stateAtCycleTime,
    stateAtTime,
  ]) assert.equal(typeof fn, 'function');

  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceScale, 0.017, 1e-15, 'source scale');
  vector2Near(
    geometry.sourceHolderPivot,
    new THREE.Vector2(276, 299),
    1e-15,
    'source holder fulcrum',
  );
  vector2Near(
    geometry.sourceShoePin,
    new THREE.Vector2(159, 298),
    1e-15,
    'source pressure-shoe pin',
  );
  vector2Near(
    geometry.sourceShoeContact,
    new THREE.Vector2(159, 333),
    1e-15,
    'source work contact',
  );
  vector2Near(
    geometry.sourceScrewAxis,
    new THREE.Vector2(372, 326),
    1e-15,
    'source screw axis',
  );
  vector2Near(
    geometry.sourceNutCenter,
    new THREE.Vector2(372, 358),
    1e-15,
    'source fixed nut center',
  );
  vector2Near(
    geometry.sourceHandleTip,
    new THREE.Vector2(460, 254),
    1e-15,
    'source handle tip',
  );
  assert.equal(geometry.sourceHolderOutline.length, 32);
  assert.equal(geometry.sourceShoeOutline.length, 10);
  assert.equal(geometry.sourceFrameOutline.length, 13);
  for (const sourcePoint of [
    geometry.sourceHolderPivot,
    geometry.sourceShoePin,
    geometry.sourceShoeContact,
    geometry.sourceScrewAxis,
    geometry.sourceNutCenter,
    geometry.sourceHandleCenter,
    geometry.sourceHandleTip,
    ...geometry.sourceHolderOutline,
    ...geometry.sourceShoeOutline,
    ...geometry.sourceFrameOutline,
  ]) {
    vector2Near(
      modelPointToSourceRaster(sourcePointToModel(sourcePoint)),
      sourcePoint,
      2e-12,
      `source round trip ${sourcePoint.toArray()}`,
    );
  }

  assert.ok(bench.isMesh);
  assert.ok(fixedFrame.isMesh);
  assert.ok(holder.isGroup);
  assert.equal(holderCheeks.length, 2);
  assert.ok(holderCheeks.every((cheek) => cheek.isMesh));
  assert.ok(shoe.isGroup);
  assert.ok(shoePlate.isMesh);
  assert.ok(screw.isGroup);
  assert.ok(screwRotor.isGroup);
  assert.ok(nutBody.isMesh);
  assert.ok(externalThread.isMesh);
  assert.ok(internalThread.isMesh);
  assert.ok(thrustCollar.isMesh);
  assert.ok(handleArm.isMesh);
  assert.ok(handleGrip.isMesh);
  assert.ok(workpiece.isMesh);
  assert.ok(fulcrumPin.isMesh);
  assert.ok(shoePin.isMesh);
  assert.equal(holderCheeks[0].parent, holder);
  assert.equal(holderCheeks[1].parent, holder);
  assert.equal(shoePin.parent, holder);
  assert.equal(shoePinAnchor.parent, holder);
  assert.equal(workContactAnchor.parent, shoe);
  assert.equal(screwRotor.parent, screw);
  assert.equal(handleTipAnchor.parent, screwRotor);
  assert.equal(bench.userData.fixed, true);
  assert.equal(fixedFrame.userData.fixed, true);
  assert.equal(nutBody.userData.fixed, true);
  assert.equal(workpiece.userData.fixed, true);
  assert.equal(externalThread.userData.screwThread, true);
  assert.equal(externalThread.userData.handedness, 'right');
  assert.equal(internalThread.userData.screwThread, true);
  vector3Near(
    screw.userData.axis,
    new THREE.Vector3(0, 1, 0),
    1e-15,
    'vertical screw axis',
  );
  vector3Near(
    holder.userData.axis,
    new THREE.Vector3(0, 0, 1),
    1e-15,
    'holder fulcrum axis',
  );

  const screwThreads = [];
  const forbiddenRoles = [];
  model.root.traverse((object) => {
    if (object.userData.screwThread) screwThreads.push(object);
    const role = String(object.userData.role ?? '');
    if (/belt|pulley|gear|cam|spring|ratchet|pawl|latch/i.test(role)) {
      forbiddenRoles.push(role);
    }
  });
  assert.deepEqual(screwThreads, [internalThread, externalThread]);
  assert.deepEqual(forbiddenRoles, []);

  near(geometry.openHolderAngle, -0.04, 1e-15, 'open holder angle');
  near(geometry.clampedHolderAngle, 0, 1e-15, 'source holder angle');
  assert.ok(geometry.screwAxialTravel > 0.0708);
  assert.ok(geometry.screwAxialTravel < 0.0709);
  // A part turn: the plate-height handle must not swing over the crest.
  assert.ok(geometry.screwTighteningTurns < -0.416);
  assert.ok(geometry.screwTighteningTurns > -0.417);
  near(geometry.threadLead, geometry.threadPitch, 1e-15,
    'single-start lead equals pitch');
  near(
    geometry.threadLeadPerRadian * FULL_TURN,
    geometry.threadPitch,
    1e-15,
    'lead per turn',
  );
  near(
    geometry.clampedLeverForceRatio,
    geometry.clampedScrewArm / geometry.clampedWorkArm,
    1e-15,
    'lever force ratio',
  );
  assert.ok(geometry.idealClampForcePerHandleForce > 45);

  const sourceState = stateAtClosure({ closure: 1 });
  const openState = stateAtClosure({ closure: 0 });
  finiteStateNumbers(sourceState);
  finiteStateNumbers(openState);
  near(sourceState.holderAngle, 0, 1e-15, 'source holder angle');
  near(sourceState.screwAngle, 0, 1e-12, 'source handle azimuth');
  near(sourceState.shoeContactGap, 0, 1e-15, 'source shoe contact');
  assert.equal(sourceState.clamped, true);
  assert.equal(openState.clamped, false);
  assert.ok(openState.shoeContactGap > 0.0795);
  assert.ok(openState.shoeContactGap < 0.0796);
  vector2Near(
    sourceState.shoePinPoint,
    sourcePointToModel(geometry.sourceShoePin),
    2e-15,
    'source shoe pin pose',
  );
  vector2Near(
    sourceState.shoeContactPoint,
    sourcePointToModel(geometry.sourceShoeContact),
    2e-15,
    'source pressure contact pose',
  );
  near(
    sourceState.holderBearingPoint.x,
    sourcePointToModel(geometry.sourceScrewAxis).x + geometry.collarContactOffsetX,
    2e-15,
    'finite collar-rim thrust point x',
  );
  near(
    sourceState.holderBearingPoint.y,
    sourcePointToModel(geometry.sourceScrewAxis).y,
    2e-15,
    'source thrust point y',
  );
  near(
    holderBearingAtAngle(0).worldPoint.y,
    sourceState.holderBearingPoint.y,
    1e-15,
    'holder face analytic source point',
  );

  model.update(0);
  model.root.updateMatrixWorld(true);
  vector3Near(
    worldPoint(holderPivotAnchor),
    new THREE.Vector3(geometry.holderPivot.x, geometry.holderPivot.y, 0),
    1e-15,
    'rendered fixed fulcrum',
  );
  vector3Near(worldPoint(shoePinAnchor), sourceState.shoePinPoint, 3e-15,
    'rendered source shoe pin');
  vector3Near(worldPoint(workContactAnchor), sourceState.shoeContactPoint, 3e-15,
    'rendered source shoe contact');
  vector3Near(worldPoint(thrustContactAnchor), sourceState.holderBearingPoint, 3e-15,
    'rendered source thrust contact');
  vector3Near(
    worldPoint(nutAxisAnchor),
    new THREE.Vector3(geometry.screwAxisX, geometry.nutCenterY, 0),
    1e-15,
    'fixed nut axis',
  );
  vector3Near(
    worldPoint(handleTipAnchor),
    new THREE.Vector3(
      sourcePointToModel(geometry.sourceHandleTip).x,
      sourcePointToModel(geometry.sourceHandleTip).y,
      0,
    ),
    5e-15,
    'source handle tip pose',
  );
  assert.deepEqual(Object.keys(canonicalTimes), [
    'sourceClamped',
    'midRelease',
    'fullyOpen',
    'midTighten',
    'reclamped',
  ]);
  assert.equal(canonicalStates.sourceClamped.clamped, true);
  assert.equal(canonicalStates.fullyOpen.clamped, false);
  assert.equal(canonicalStates.reclamped.clamped, true);
  disposeModel(model.root);
});

test('movement 190 preserves thread lead, fixed-axis thrust contact, lever ratio, and unilateral work clearance exhaustively', () => {
  const model = createMovementModel(catalog.movements[189]);
  const { geometry, stateAtClosure } = model.root.userData;
  const sampleCount = 32768;
  let previousDisplacement = -Infinity;
  let previousGap = Infinity;
  let previousScrewAngle = Infinity;
  let minimumGap = Infinity;
  let maximumGap = -Infinity;
  let maximumThreadError = 0;
  let maximumLeadError = 0;
  let maximumScrewAxisError = 0;
  let maximumPinRadiusError = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const closure = index / sampleCount;
    const closureVelocity = Math.sin(closure * FULL_TURN) * 0.73;
    const closureAcceleration = Math.cos(closure * FULL_TURN) * 0.41;
    const state = stateAtClosure({
      closure,
      closureAcceleration,
      closureVelocity,
    });
    finiteStateNumbers(state, `state[${index}]`);
    near(state.closure, closure, 1e-15, `closure ${index}`);
    assert.ok(state.holderAngle >= geometry.openHolderAngle - 1e-15);
    assert.ok(state.holderAngle <= geometry.clampedHolderAngle + 1e-15);
    assert.ok(state.screwAxialDisplacement >= -1e-14);
    assert.ok(
      state.screwAxialDisplacement <= geometry.screwAxialTravel + 1e-14,
    );
    assert.ok(state.shoeContactGap >= -2e-15);
    assert.equal(state.workpieceContactCompression, 0);
    assert.equal(state.pressureShoeAngle, 0);
    assert.ok(state.leverForceRatio > 0.88);
    assert.ok(state.leverForceRatio < 0.95);
    assert.ok(state.clampForcePerHandleForce > 48);
    assert.ok(state.clampForcePerHandleForce < 53);
    near(
      state.screwAngle,
      (geometry.screwAxialTravel - state.screwAxialDisplacement)
        / geometry.threadLeadPerRadian,
      2e-13,
      `screw angle from lead ${index}`,
    );
    near(
      state.screwAngularVelocity,
      -state.screwAxialVelocity / geometry.threadLeadPerRadian,
      2e-13,
      `screw angular speed from lead ${index}`,
    );
    near(
      state.screwAngularAcceleration,
      -state.screwAxialAcceleration / geometry.threadLeadPerRadian,
      5e-12,
      `screw angular acceleration from lead ${index}`,
    );
    near(
      state.bearingVelocityY,
      state.screwAxialVelocity,
      1e-15,
      `bearing speed closure ${index}`,
    );
    near(
      state.bearingAccelerationY,
      state.screwAxialAcceleration,
      1e-15,
      `bearing acceleration closure ${index}`,
    );
    near(
      state.holderBearingPoint.x,
      geometry.thrustContactX,
      3e-15,
      `finite collar-rim contact closure ${index}`,
    );
    near(
      state.holderBearingPoint.y,
      state.thrustCollarTopY,
      3e-15,
      `collar-holder contact closure ${index}`,
    );
    near(
      state.bearingLocalPoint.y,
      geometry.holderBearingFaceLocalY,
      1e-15,
      `bearing remains on straight holder face ${index}`,
    );
    assert.ok(state.bearingLocalPoint.x > 1.76);
    assert.ok(state.bearingLocalPoint.x < 1.85);
    assert.equal(state.clamped, index === sampleCount);
    assert.ok(state.screwAxialDisplacement >= previousDisplacement - 1e-14);
    assert.ok(state.shoeContactGap <= previousGap + 1e-14);
    assert.ok(state.screwAngle <= previousScrewAngle + 1e-13);
    previousDisplacement = state.screwAxialDisplacement;
    previousGap = state.shoeContactGap;
    previousScrewAngle = state.screwAngle;
    minimumGap = Math.min(minimumGap, state.shoeContactGap);
    maximumGap = Math.max(maximumGap, state.shoeContactGap);
    maximumThreadError = Math.max(
      maximumThreadError,
      Math.abs(state.threadPhaseError),
    );
    maximumLeadError = Math.max(
      maximumLeadError,
      Math.abs(state.idealThreadAdvanceError),
    );
    maximumScrewAxisError = Math.max(
      maximumScrewAxisError,
      Math.abs(state.screwAxisError),
    );
    maximumPinRadiusError = Math.max(
      maximumPinRadiusError,
      Math.abs(state.shoePinRadiusError),
    );
  }

  near(minimumGap, 0, 2e-15, 'minimum work clearance');
  assert.ok(maximumGap > 0.0795);
  assert.ok(maximumGap < 0.0796);
  assert.ok(maximumThreadError < 4e-14);
  assert.ok(maximumLeadError < 5e-16);
  assert.ok(maximumScrewAxisError < 4e-16);
  assert.ok(maximumPinRadiusError < 5e-16);

  const open = stateAtClosure({ closure: 0 });
  const clamped = stateAtClosure({ closure: 1 });
  near(open.screwAxialDisplacement, 0, 1e-15, 'open screw datum');
  near(
    clamped.screwAxialDisplacement,
    geometry.screwAxialTravel,
    2e-15,
    'full screw advance',
  );
  near(
    open.screwRevolutionsFromSource,
    -geometry.screwTighteningTurns,
    2e-14,
    'open handle turns relative to source pose',
  );
  near(clamped.screwRevolutionsFromSource, 0, 2e-14,
    'source handle azimuth after tightening');
  near(
    clamped.leverForceRatio,
    geometry.clampedLeverForceRatio,
    1e-15,
    'source lever ratio',
  );
  near(
    clamped.clampForcePerHandleForce,
    geometry.idealClampForcePerHandleForce,
    1e-14,
    'ideal combined screw-and-lever force ratio',
  );
  disposeModel(model.root);
});

test('movement 190 loosens, dwells open, tightens, and returns across C2 event boundaries', () => {
  const model = createMovementModel(catalog.movements[189]);
  const {
    closureLawAtCycleTime,
    geometry,
    stateAtCycleTime,
    stateAtTime,
  } = model.root.userData;
  const { cyclePeriod, sequenceBreaks } = geometry;
  const expectedStages = new Set([
    'screw-thrusting-holder-shoe-against-workpiece',
    'handle-reversing-screw-and-opening-holder',
    'screw-retracted-pressure-shoe-clear-of-workpiece',
    'handle-turning-screw-up-under-holder-short-arm',
  ]);
  const seenStages = new Set();
  let maximumAngularSpeed = 0;
  let maximumAxialSpeed = 0;
  const sampleCount = 32768;

  for (let index = 0; index <= sampleCount; index += 1) {
    const cycleTime = cyclePeriod * index / sampleCount;
    const law = closureLawAtCycleTime(cycleTime);
    const state = stateAtCycleTime(cycleTime);
    finiteStateNumbers(law, `law[${index}]`);
    finiteStateNumbers(state, `state[${index}]`);
    near(state.closure, law.closure, 1e-15, `cycle closure ${index}`);
    near(
      state.closureVelocity,
      law.closureVelocity,
      1e-15,
      `cycle closure velocity ${index}`,
    );
    near(
      state.closureAcceleration,
      law.closureAcceleration,
      1e-15,
      `cycle closure acceleration ${index}`,
    );
    assert.ok(state.closure >= -1e-15 && state.closure <= 1 + 1e-15);
    assert.ok(state.shoeContactGap >= -3e-15);
    assert.ok(Math.abs(state.threadPhaseError) < 4e-14);
    assert.ok(Math.abs(state.bearingContactGap) < 4e-16);
    assert.ok(expectedStages.has(state.stage));
    seenStages.add(state.stage);
    if (state.stage === 'handle-reversing-screw-and-opening-holder') {
      assert.ok(state.closureVelocity <= 1e-15);
      assert.ok(state.screwAxialVelocity <= 1e-15);
      assert.ok(state.screwAngularVelocity >= -1e-14);
    }
    if (state.stage === 'handle-turning-screw-up-under-holder-short-arm') {
      assert.ok(state.closureVelocity >= -1e-15);
      assert.ok(state.screwAxialVelocity >= -1e-15);
      assert.ok(state.screwAngularVelocity <= 1e-14);
    }
    maximumAngularSpeed = Math.max(
      maximumAngularSpeed,
      Math.abs(state.screwAngularVelocity),
    );
    maximumAxialSpeed = Math.max(
      maximumAxialSpeed,
      Math.abs(state.screwAxialVelocity),
    );
  }
  assert.deepEqual(seenStages, expectedStages);
  assert.ok(maximumAngularSpeed > 1.06);
  assert.ok(maximumAxialSpeed > 0.0286);

  const boundaryExpectations = [
    [0, 1],
    [sequenceBreaks.clampedHoldEnd, 1],
    [sequenceBreaks.releaseEnd, 0],
    [sequenceBreaks.openHoldEnd, 0],
    [sequenceBreaks.tightenEnd, 1],
    [cyclePeriod, 1],
  ];
  for (const [time, expectedClosure] of boundaryExpectations) {
    const state = stateAtCycleTime(time);
    near(state.closure, expectedClosure, 2e-15, `boundary closure ${time}`);
    near(state.closureVelocity, 0, 2e-14, `boundary velocity ${time}`);
    near(
      state.closureAcceleration,
      0,
      3e-13,
      `boundary acceleration ${time}`,
    );
    near(
      state.screwAxialVelocity,
      0,
      2e-14,
      `boundary axial speed ${time}`,
    );
    near(
      state.screwAngularVelocity,
      0,
      8e-13,
      `boundary angular speed ${time}`,
    );
  }

  const initial = stateAtTime(0);
  const oneCycle = stateAtTime(cyclePeriod);
  const fiveCycles = stateAtTime(cyclePeriod * 5);
  near(oneCycle.holderAngle, initial.holderAngle, 1e-15,
    'one-cycle holder closure');
  near(oneCycle.screwAngle, initial.screwAngle, 2e-14,
    'one-cycle handle closure');
  near(oneCycle.shoeContactGap, initial.shoeContactGap, 1e-15,
    'one-cycle work contact');
  assert.equal(oneCycle.completedCycles, 1);
  assert.equal(oneCycle.cycleTime, 0);
  assert.equal(fiveCycles.completedCycles, 5);
  assert.equal(fiveCycles.cycleTime, 0);
  assert.equal(stateAtTime(cyclePeriod * 2.35).completedCycles, 2);
  assert.equal(stateAtTime(-5).cycleTime, 0);
  disposeModel(model.root);
});

test('movement 190 rendered transforms preserve both pin joints, the screw axis, handle radius, and separated 3D layers', () => {
  const model = createMovementModel(catalog.movements[189]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtCycleTime,
  } = model.root.userData;
  const {
    externalThread,
    fixedFrame,
    fulcrumPin,
    handleIndex,
    handleTipAnchor,
    holder,
    holderCheeks,
    holderIndex,
    holderPivotAnchor,
    internalThread,
    nutAxisAnchor,
    nutBody,
    screw,
    screwRotor,
    shoe,
    shoeContactIndex,
    shoePinAnchor,
    threadContactMarker,
    thrustContactAnchor,
    thrustContactMarker,
    workContactAnchor,
    workContactMarker,
  } = blocks;
  const sampleCount = 512;
  for (let index = 0; index <= sampleCount; index += 1) {
    const cycleTime = geometry.cyclePeriod * index / sampleCount;
    const state = stateAtCycleTime(cycleTime);
    model.update(cycleTime);
    model.root.updateMatrixWorld(true);
    near(holder.rotation.z, state.holderAngle, 2e-15,
      `rendered holder angle ${index}`);
    near(shoe.rotation.z, 0, 1e-15, `rendered shoe angle ${index}`);
    vector3Near(shoe.position, state.shoePinPoint, 3e-15,
      `rendered shoe translation ${index}`);
    near(screw.position.x, geometry.screwAxisX, 1e-15,
      `rendered screw axis ${index}`);
    near(screw.position.y, state.screwOriginY, 2e-15,
      `rendered screw translation ${index}`);
    near(screw.position.z, 0, 1e-15, `rendered screw depth ${index}`);
    near(screwRotor.rotation.y, state.screwAngle, 2e-14,
      `rendered screw rotation ${index}`);
    vector3Near(
      worldPoint(holderPivotAnchor),
      new THREE.Vector3(geometry.holderPivot.x, geometry.holderPivot.y, 0),
      2e-15,
      `fixed holder pivot ${index}`,
    );
    vector3Near(worldPoint(shoePinAnchor), state.shoePinPoint, 4e-15,
      `rendered holder-shoe pin closure ${index}`);
    vector3Near(worldPoint(workContactAnchor), state.shoeContactPoint, 4e-15,
      `rendered shoe contact ${index}`);
    vector3Near(worldPoint(thrustContactAnchor), state.holderBearingPoint, 4e-15,
      `rendered screw thrust contact ${index}`);
    const expectedHandleTip = new THREE.Vector3(
      geometry.screwAxisX + geometry.handleRadius * Math.cos(state.screwAngle),
      state.screwOriginY + geometry.handleLocalY,
      -geometry.handleRadius * Math.sin(state.screwAngle),
    );
    vector3Near(worldPoint(handleTipAnchor), expectedHandleTip, 8e-15,
      `rendered handle radius and azimuth ${index}`);
    near(
      Math.hypot(
        worldPoint(handleTipAnchor).x - geometry.screwAxisX,
        worldPoint(handleTipAnchor).z,
      ),
      geometry.handleRadius,
      5e-15,
      `rigid handle radius ${index}`,
    );
    vector3Near(
      worldPoint(nutAxisAnchor),
      new THREE.Vector3(geometry.screwAxisX, geometry.nutCenterY, 0),
      1e-15,
      `fixed nut axis ${index}`,
    );
    near(worldPoint(workContactMarker).x, state.shoeContactPoint.x, 3e-15,
      `visible work marker x ${index}`);
    near(worldPoint(workContactMarker).y, state.shoeContactPoint.y, 3e-15,
      `visible work marker y ${index}`);
    near(worldPoint(thrustContactMarker).x, state.holderBearingPoint.x, 3e-15,
      `visible thrust marker x ${index}`);
    near(worldPoint(thrustContactMarker).y, state.holderBearingPoint.y, 3e-15,
      `visible thrust marker y ${index}`);
  }

  model.update(canonicalTimes.fullyOpen);
  model.root.updateMatrixWorld(true);
  assert.ok(holderCheeks[0].position.z < fixedFrame.position.z);
  assert.ok(fixedFrame.position.z < holderCheeks[1].position.z);
  assert.ok(holderCheeks[0].position.z < shoe.position.z);
  assert.ok(shoe.position.z < holderCheeks[1].position.z);
  assert.equal(nutBody.position.z, 0);
  assert.equal(screw.position.z, 0);
  assert.equal(externalThread.parent, screwRotor);
  assert.equal(internalThread.parent, model.root);
  assert.equal(blocks.frameOutline, undefined, 'no decorative ink frame outline');
  // Brown draws no index marks: source presentation detaches them.
  for (const unshown of [holderIndex, handleIndex, shoeContactIndex,
    threadContactMarker, workContactMarker, thrustContactMarker]) {
    assert.equal(unshown.parent, null);
  }
  assert.equal(fulcrumPin.userData.fixed, true);
  assert.equal(nutBody.userData.fixed, true);
  // The screw core ends just inside the handle hub, below its top face.
  {
    const hubTop = blocks.handleHub.position.y
      + blocks.handleHub.geometry.parameters.height / 2;
    const coreTop = blocks.screwCore.position.y
      + blocks.screwCore.geometry.parameters.height / 2;
    assert.ok(coreTop < hubTop - 0.005 && coreTop > hubTop - 0.02);
  }
  // Flat side elevation, as the plate.
  assert.ok(Math.abs(model.cameraDirection.x) < 1e-12);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.y * 50);
  disposeModel(model.root);
});

test('movement 190 occupies a real 3D envelope and remains distinct as the review queue advances through 192', () => {
  const model = createMovementModel(catalog.movements[189]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.bench,
      blocks.fixedFrame,
      blocks.handleArm,
      blocks.handleGrip,
      blocks.holder,
      blocks.nutBody,
      blocks.screw,
      blocks.shoe,
      blocks.workpiece,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 7.75);
  assert.ok(size.y > 3.35);
  assert.ok(size.z > 1.75);
  assert.ok(physicalBounds.min.z < -0.89);
  // With 0.42 tightening turns the canonical handle azimuths lie near the
  // elevation plane, so the front of the bench plank bounds +z.
  assert.ok(physicalBounds.max.z > 0.73);
  let meshCount = 0;
  let threadCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
    if (object.userData.screwThread) threadCount += 1;
  });
  // Eight undrawn white indices and contact markers are presented away,
  // and the four decorative ink outlines are gone.
  assert.ok(meshCount >= 17);
  assert.equal(threadCount, 2);

  const movement189 = createMovementModel(catalog.movements[188]);
  const movement191 = createMovementModel(catalog.movements[190]);
  const movement192 = createMovementModel(catalog.movements[191]);
  assert.equal(movement189.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement191.root.userData.fidelity, 'authored');
  assert.equal(movement192.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement189.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement191.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement192.root.userData.mechanism,
    movement191.root.userData.mechanism,
  );
  assert.notEqual(
    movement189.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement191.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement192.root.userData.archetype,
    movement191.root.userData.archetype,
  );
  disposeModel(movement189.root);
  disposeModel(movement191.root);
  disposeModel(movement192.root);
  disposeModel(model.root);
});
