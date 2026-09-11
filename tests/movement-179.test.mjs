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

test('movement 179 performs a source-scaled gab release and exact half-turn loose-eccentric reversal', () => {
  const movement = catalog.movements[178];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    geometry,
    modelPointToSourceRaster,
    sequenceAtCyclePhase,
    sourceRasterPointToModel,
    stateAtCyclePhase,
    stateAtTime,
  } = model.root.userData;
  const {
    baseRail,
    eccentricCenterAnchor,
    eccentricCenterMark,
    eccentricDisk,
    eccentricOuterRim,
    eccentricPhaseIndex,
    eccentricRodBeam,
    forwardStopAnchor,
    gabBridge,
    gabCenterAnchor,
    gabContactMarker,
    gabContactShoes,
    gabJaws,
    gabPin,
    gabPinIndex,
    inputShaft,
    leverBaseHub,
    leverHandle,
    leverHandleAnchor,
    leverJointAnchor,
    leverLinkHub,
    leverPedestal,
    liftingHandle,
    liftingHandleGrip,
    looseEccentric,
    manualLever,
    manualLeverBar,
    reverseStopAnchor,
    reversingLink,
    rodNeck,
    semicircularStop,
    shaftBearing,
    shaftFace,
    shaftLug,
    shaftLugContactAnchor,
    shaftLugIndex,
    shaftRotor,
    spindleLinkAnchor,
    spindleLinkPin,
    spindleStem,
    stopContactMarker,
    stopEndPads,
    strap,
    strapBody,
    strapBolts,
    strapLiner,
    strapLugs,
    stuffingBox,
    stuffingCollars,
    stuffingSleeve,
    valveGuideSupport,
    valvePinAnchor,
    valveSpindle,
  } = blocks;

  assert.equal(movement.id, 179);
  assert.equal(movement.number, '179');
  assert.equal(
    movement.title,
    'Loose-Eccentric Single-Engine Reversing Gear',
  );
  assert.equal(movement.category, 'Steam engines');
  assert.equal(
    movement.description,
    '179. Reversing-gear for a single engine. On raising the eccentric-rod the valve-spindle is released. The engine can then be reversed by working the upright lever, after which the eccentric-rod is let down again. The eccentric in this case is loose upon the shaft and driven by a projection on the shaft acting upon a nearly semi-circular projection on the side of the eccentric, which permits the eccentric to turn half-way round on the shaft on reversing the valves.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_179.html');
  assert.equal(
    movement.archetype,
    'single-engine-liftable-gab-manual-valve-lever-loose-eccentric-half-turn-stop-reversing-gear',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'liftable-gab-manual-valve-spindle-reversal-with-loose-eccentric-and-exact-half-turn-shaft-stop-takeup',
  );
  for (const fn of [
    modelPointToSourceRaster,
    sequenceAtCyclePhase,
    sourceRasterPointToModel,
    stateAtCyclePhase,
    stateAtTime,
  ]) {
    assert.equal(typeof fn, 'function');
  }

  // The shaft, loose eccentric, strap, valve spindle, and hand lever are five
  // independent bodies. The rod is one continuous solid across the small gap
  // used to separate the two explanatory fragments in Brown's engraving.
  for (const object of [
    baseRail,
    eccentricCenterAnchor,
    eccentricCenterMark,
    eccentricDisk,
    eccentricOuterRim,
    eccentricPhaseIndex,
    eccentricRodBeam,
    forwardStopAnchor,
    gabBridge,
    gabCenterAnchor,
    gabContactMarker,
    gabPin,
    gabPinIndex,
    inputShaft,
    leverBaseHub,
    leverHandle,
    leverHandleAnchor,
    leverJointAnchor,
    leverLinkHub,
    leverPedestal,
    liftingHandle,
    liftingHandleGrip,
    looseEccentric,
    manualLever,
    manualLeverBar,
    reverseStopAnchor,
    reversingLink,
    rodNeck,
    semicircularStop,
    shaftBearing,
    shaftFace,
    shaftLug,
    shaftLugContactAnchor,
    shaftLugIndex,
    shaftRotor,
    spindleLinkAnchor,
    spindleLinkPin,
    spindleStem,
    stopContactMarker,
    strap,
    strapBody,
    strapLiner,
    stuffingBox,
    stuffingSleeve,
    valveGuideSupport,
    valvePinAnchor,
    valveSpindle,
  ]) {
    assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  }
  assert.equal(gabJaws.length, 2);
  assert.equal(gabContactShoes.length, 2);
  assert.equal(stopEndPads.length, 2);
  assert.equal(strapBolts.length, 2);
  assert.equal(strapLugs.length, 4);
  assert.equal(stuffingCollars.length, 2);
  assert.equal(looseEccentric.parent, model.root);
  assert.equal(shaftRotor.parent, model.root);
  assert.equal(strap.parent, model.root);
  assert.equal(valveSpindle.parent, model.root);
  assert.equal(manualLever.parent, model.root);
  assert.equal(eccentricDisk.parent, looseEccentric);
  assert.equal(semicircularStop.parent, looseEccentric);
  assert.equal(shaftLug.parent, shaftRotor);
  assert.equal(strapBody.parent, strap);
  assert.equal(eccentricRodBeam.parent, strap);
  assert.equal(gabBridge.parent, strap);
  assert.equal(gabPin.parent, valveSpindle);
  assert.equal(manualLeverBar.parent, manualLever);

  // Source-raster locks preserve the two views, including the omitted segment
  // between x=248 and x=274, in one consistent model coordinate system.
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceScale, 0.022, 0, 'engraving scale');
  assert.deepEqual(
    geometry.sourceRasterShaftCenter.toArray(),
    [446, 289],
  );
  assert.deepEqual(
    geometry.sourceRasterEccentricCenter.toArray(),
    [432, 292],
  );
  assert.deepEqual(geometry.sourceRasterValvePin.toArray(), [180, 289]);
  assert.deepEqual(
    geometry.sourceRasterSpindleLinkPin.toArray(),
    [123, 289],
  );
  assert.deepEqual(
    geometry.sourceRasterLeverBasePivot.toArray(),
    [91, 361],
  );
  assert.deepEqual(
    geometry.sourceRasterLeverJoint.toArray(),
    [81, 309],
  );
  assert.deepEqual(
    geometry.sourceRasterLeverHandle.toArray(),
    [24, 43],
  );
  assert.deepEqual(
    geometry.sourceRasterLeftRodBreak.toArray(),
    [248, 289],
  );
  assert.deepEqual(
    geometry.sourceRasterRightRodBreak.toArray(),
    [274, 289],
  );
  assert.equal(geometry.sourceRasterStrapOuterRadius, 76);
  assert.equal(geometry.sourceRasterEccentricRadius, 62);
  assert.equal(geometry.sourceRasterShaftRadius, 29);
  assert.equal(geometry.sourceRasterStopMeanRadius, 36);
  vector2Near(
    sourceRasterPointToModel(geometry.sourceRasterShaftCenter),
    geometry.shaftCenter,
    0,
    'source shaft center',
  );
  vector2Near(
    sourceRasterPointToModel(geometry.sourceRasterEccentricCenter),
    geometry.sourcePoseEccentricCenter,
    0,
    'source eccentric center',
  );
  vector2Near(
    sourceRasterPointToModel(geometry.sourceRasterValvePin),
    geometry.sourcePoseValvePin,
    0,
    'source gab pin',
  );
  for (const rasterPoint of [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(248, 289),
    new THREE.Vector2(274, 289),
    new THREE.Vector2(446, 289),
    new THREE.Vector2(525, 525),
  ]) {
    vector2Near(
      modelPointToSourceRaster(sourceRasterPointToModel(rasterPoint)),
      rasterPoint,
      3e-14,
      'source/model affine round trip',
    );
  }
  assert.ok(
    sourceRasterPointToModel(geometry.sourceRasterLeftRodBreak).x
      < sourceRasterPointToModel(geometry.sourceRasterRightRodBreak).x,
    'the source gap is joined without reversing either rod fragment',
  );
  near(geometry.sourcePoseLeverJointError, 0, 2e-15,
    'source lever/link joint lock');
  assert.ok(geometry.sourcePoseLeverHandleError < 0.13,
    'engraved hand grip lies on the fitted rigid upright lever');

  // The stop is concentric with the shaft, spans exactly pi, and remains a
  // separate body from both the rotating shaft lug and the free strap.
  near(geometry.permittedRelativeTravel, Math.PI, 0,
    'shaft lost-motion travel');
  near(geometry.halfTurn, Math.PI, 0, 'half-turn constant');
  near(
    geometry.forwardStopLocalAngle - geometry.reverseStopLocalAngle,
    Math.PI,
    0,
    'stop-end angular separation',
  );
  near(semicircularStop.userData.angularSpan, Math.PI, 0,
    'rendered stop sector span');
  assert.ok(geometry.stopInnerRadius > geometry.shaftFaceRadius);
  assert.ok(geometry.stopOuterRadius < geometry.sheaveRadius);
  near(
    geometry.stopOuterRadius - geometry.stopInnerRadius,
    geometry.stopRadialThickness,
    2e-16,
    'stop radial thickness',
  );
  assert.ok(geometry.strapLinerInnerRadius > geometry.sheaveRadius);
  assert.ok(geometry.strapBodyInnerRadius > geometry.strapLinerInnerRadius);
  assert.ok(geometry.strapOuterRadius > geometry.strapBodyInnerRadius);

  const source = canonicalStates.sourceForwardContact;
  const forwardMid = canonicalStates.forwardRunMidpoint;
  const raisedForReverse = canonicalStates.rodRaisedForReverse;
  const reverseTakeUpMid = canonicalStates.reverseLostMotionMidpoint;
  const reverseStop = canonicalStates.reverseStopReached;
  const reverseReengaged = canonicalStates.reverseReengaged;
  const reverseMid = canonicalStates.reverseRunMidpoint;
  const raisedForForward = canonicalStates.rodRaisedForForward;
  const forwardTakeUpMid = canonicalStates.forwardLostMotionMidpoint;
  const forwardStop = canonicalStates.forwardStopReached;

  vector2Near(source.eccentricCenter, geometry.sourcePoseEccentricCenter, 2e-16,
    'source-pose eccentric center');
  vector2Near(source.valvePin, geometry.sourcePoseValvePin, 2e-15,
    'source-pose valve pin');
  vector2Near(source.spindleLinkPoint, geometry.sourcePoseSpindleLinkPin, 2e-15,
    'source-pose spindle link pin');
  near(source.relativeLugAngle, Math.PI / 2, 9e-16,
    'source forward-stop contact');
  assert.equal(source.shaftStopContact, 'forward-stop');
  assert.equal(source.gabEngaged, true);
  near(source.gabPinSeparation, 0, 1e-15, 'source gab capture');
  assert.ok(forwardMid.shaftAngularSpeed > 0);
  near(forwardMid.shaftAngularSpeed, forwardMid.eccentricAngularSpeed, 0,
    'shaft and eccentric co-rotate forward');
  near(forwardMid.relativeLugAngle, Math.PI / 2, 9e-16,
    'forward lug remains on one stop');

  near(raisedForReverse.liftFraction, 1, 0, 'reverse rod fully raised');
  assert.equal(raisedForReverse.gabEngaged, false);
  assert.equal(raisedForReverse.shaftStopContact, 'forward-stop');
  near(reverseTakeUpMid.relativeLugAngle, 0, 9e-16,
    'lug halfway between stops during reverse take-up');
  assert.equal(reverseTakeUpMid.shaftStopContact, 'between-stops');
  near(reverseTakeUpMid.eccentricAngularSpeed, 0, 0,
    'loose eccentric waits during reverse take-up');
  near(reverseTakeUpMid.manualShift, geometry.manualValveStroke, 3e-16,
    'manual lever gives reverse valve stroke');
  near(
    raisedForReverse.shaftAngle - reverseStop.shaftAngle,
    Math.PI,
    9e-16,
    'shaft traverses exactly half a turn in reverse',
  );
  near(
    raisedForReverse.eccentricAngle,
    reverseStop.eccentricAngle,
    0,
    'eccentric is stationary throughout reverse take-up',
  );
  near(reverseStop.relativeLugAngle, -Math.PI / 2, 9e-16,
    'opposite stop reached for reverse drive');
  assert.equal(reverseStop.shaftStopContact, 'reverse-stop');
  assert.equal(reverseReengaged.gabEngaged, true);
  near(reverseReengaged.gabPinSeparation, 0, 1e-15,
    'gab re-engages after reverse contact');
  assert.ok(reverseMid.shaftAngularSpeed < 0);
  near(reverseMid.shaftAngularSpeed, reverseMid.eccentricAngularSpeed, 0,
    'shaft and eccentric co-rotate in reverse');
  near(reverseMid.relativeLugAngle, -Math.PI / 2, 9e-16,
    'reverse lug remains on opposite stop');

  near(raisedForForward.liftFraction, 1, 0, 'forward rod fully raised');
  assert.equal(raisedForForward.gabEngaged, false);
  near(forwardTakeUpMid.relativeLugAngle, 0, 2e-15,
    'lug halfway between stops during forward take-up');
  near(forwardTakeUpMid.eccentricAngularSpeed, 0, 0,
    'loose eccentric waits during forward take-up');
  near(forwardTakeUpMid.manualShift, -geometry.manualValveStroke, 3e-16,
    'manual lever gives forward valve stroke');
  near(
    forwardStop.shaftAngle - raisedForForward.shaftAngle,
    Math.PI,
    9e-16,
    'shaft traverses exactly half a turn forward',
  );
  near(
    raisedForForward.eccentricAngle,
    forwardStop.eccentricAngle,
    0,
    'eccentric is stationary throughout forward take-up',
  );
  near(forwardStop.relativeLugAngle, Math.PI / 2, 9e-16,
    'original stop reached for forward drive');
  assert.equal(forwardStop.shaftStopContact, 'forward-stop');

  const expectedStages = new Set([
    'forward-running-with-gab-engaged',
    'raising-eccentric-rod-to-release-valve-spindle',
    'manual-lever-opens-valve-for-reverse-lost-motion',
    'manual-lever-returns-valve-as-reverse-stop-approaches',
    'lowering-gab-after-reverse-stop-contact',
    'reverse-running-with-gab-engaged',
    'raising-eccentric-rod-to-restore-forward-motion',
    'manual-lever-opens-valve-for-forward-lost-motion',
    'manual-lever-returns-valve-as-forward-stop-approaches',
    'lowering-gab-after-forward-stop-contact',
  ]);
  const encounteredStages = new Set();
  let minimumRelativeAngle = Infinity;
  let maximumRelativeAngle = -Infinity;
  let minimumManualShift = Infinity;
  let maximumManualShift = -Infinity;
  let maximumLift = -Infinity;

  // Exhaust every constraint over 32,768 subdivisions. The shaft lug may
  // either touch one stop or occupy the open half-circle; it can never enter
  // the solid semicircular projection.
  const sampleCount = 32768;
  for (let sample = 0; sample <= sampleCount; sample += 1) {
    const phase = sample / sampleCount;
    const state = stateAtCyclePhase(phase);
    finiteStateNumbers(state);
    encounteredStages.add(state.stage);
    minimumRelativeAngle = Math.min(
      minimumRelativeAngle,
      state.relativeLugAngle,
    );
    maximumRelativeAngle = Math.max(
      maximumRelativeAngle,
      state.relativeLugAngle,
    );
    minimumManualShift = Math.min(minimumManualShift, state.manualShift);
    maximumManualShift = Math.max(maximumManualShift, state.manualShift);
    maximumLift = Math.max(maximumLift, state.liftFraction);

    assert.ok(state.relativeLugAngle >= -Math.PI / 2 - 2e-15);
    assert.ok(state.relativeLugAngle <= Math.PI / 2 + 2e-15);
    near(
      state.forwardStopClearance + state.reverseStopClearance,
      Math.PI,
      0,
      'the open interval between stop ends remains one half-turn',
    );
    near(state.stopPenetrationError, 0, 9e-16,
      'shaft lug never penetrates the solid stop sector');
    near(state.rodLengthError, 0, 2e-15,
      'finite eccentric rod closure');
    near(state.reversingLinkLengthError, 0, 9e-16,
      'finite hand-lever link closure');
    near(state.valveGuideError, 0, 0,
      'valve spindle remains on its horizontal guide');
    if (state.shaftStopContact !== 'between-stops') {
      near(state.activeStopPositionError, 0, 1e-15,
        'shaft lug and selected stop share one contact point');
    } else {
      near(state.eccentricAngularSpeed, 0, 0,
        'loose eccentric remains still between stops');
      near(state.liftFraction, 1, 0,
        'gab remains fully clear during lost motion');
      assert.equal(state.gabEngaged, false);
    }
    if (Math.abs(state.eccentricAngularSpeed) > 1e-12) {
      near(
        state.shaftAngularSpeed,
        state.eccentricAngularSpeed,
        0,
        'contact drives shaft and loose eccentric one-to-one',
      );
      assert.notEqual(state.shaftStopContact, 'between-stops');
    }
    if (state.gabEngaged) {
      near(state.gabPinSeparation, 0, 1.6e-15,
        'lowered gab center matches valve pin');
      near(state.gabCaptureError, 0, 1.6e-15,
        'engaged gab capture error');
      near(state.manualShift, 0, 0,
        'manual valve shift is disabled while the gab is engaged');
    }
    if (Math.abs(state.manualShift) > 1e-12) {
      near(state.liftFraction, 1, 0,
        'manual lever moves only after full gab release');
      assert.equal(state.gabEngaged, false);
      near(state.eccentricAngularSpeed, 0, 0,
        'manual reversal occurs while eccentric is loose and stationary');
    }
  }
  assert.deepEqual(encounteredStages, expectedStages);
  near(minimumRelativeAngle, -Math.PI / 2, 9e-16,
    'reverse stop is reached');
  near(maximumRelativeAngle, Math.PI / 2, 9e-16,
    'forward stop is reached');
  near(minimumManualShift, -geometry.manualValveStroke, 3e-10,
    'full manual forward stroke is reached');
  near(maximumManualShift, geometry.manualValveStroke, 3e-10,
    'full manual reverse stroke is reached');
  near(maximumLift, 1, 0, 'full gab lift is reached');

  // Analytic rates agree with central differences away from the ten smooth
  // event boundaries. This detects hidden positional jumps and rate errors.
  const derivativeStep = 1e-6;
  const derivativeDenominator = 2 * derivativeStep * geometry.cyclePeriod;
  const boundaries = [0, ...Object.values(geometry.sequenceBreaks)];
  for (let sample = 1; sample < 2048; sample += 1) {
    const phase = sample / 2048;
    if (boundaries.some((boundary) => Math.abs(phase - boundary) < 2e-4)) {
      continue;
    }
    const before = stateAtCyclePhase(phase - derivativeStep);
    const state = stateAtCyclePhase(phase);
    const after = stateAtCyclePhase(phase + derivativeStep);
    near(
      (after.shaftAngle - before.shaftAngle) / derivativeDenominator,
      state.shaftAngularSpeed,
      7e-9,
      'shaft angular derivative',
    );
    near(
      (after.eccentricAngle - before.eccentricAngle)
        / derivativeDenominator,
      state.eccentricAngularSpeed,
      7e-9,
      'loose-eccentric angular derivative',
    );
    vector2Near(
      after.eccentricCenter.clone().sub(before.eccentricCenter)
        .divideScalar(derivativeDenominator),
      state.eccentricCenterVelocity,
      8e-9,
      'eccentric-center derivative',
    );
    vector2Near(
      after.valvePin.clone().sub(before.valvePin)
        .divideScalar(derivativeDenominator),
      state.valvePinVelocity,
      8e-9,
      'valve-spindle derivative',
    );
    vector2Near(
      after.gabCenter.clone().sub(before.gabCenter)
        .divideScalar(derivativeDenominator),
      state.gabCenterVelocity,
      2e-8,
      'lifted-gab derivative',
    );
    near(
      (after.leverAngle - before.leverAngle) / derivativeDenominator,
      state.leverAngularSpeed,
      8e-9,
      'upright-lever angular derivative',
    );
  }

  // Position and rate approach the same zero-velocity state from both sides
  // of every event boundary, including the periodic cycle seam.
  const boundaryStep = 1e-8;
  for (const boundary of Object.values(geometry.sequenceBreaks)) {
    if (boundary === 1) continue;
    const before = stateAtCyclePhase(boundary - boundaryStep);
    const after = stateAtCyclePhase(boundary + boundaryStep);
    near(before.shaftAngle, after.shaftAngle, 4e-12,
      'shaft position is continuous at event boundary');
    near(before.eccentricAngle, after.eccentricAngle, 4e-12,
      'eccentric position is continuous at event boundary');
    near(before.rodLift, after.rodLift, 4e-12,
      'gab lift is continuous at event boundary');
    near(before.manualShift, after.manualShift, 4e-12,
      'manual stroke is continuous at event boundary');
    assert.ok(Math.abs(before.shaftAngularSpeed) < 2e-12);
    assert.ok(Math.abs(after.shaftAngularSpeed) < 2e-12);
    assert.ok(Math.abs(before.eccentricAngularSpeed) < 2e-12);
    assert.ok(Math.abs(after.eccentricAngularSpeed) < 2e-12);
    assert.ok(Math.abs(before.rodLiftSpeed) < 2e-12);
    assert.ok(Math.abs(after.rodLiftSpeed) < 2e-12);
  }
  const cycleBefore = stateAtCyclePhase(1 - boundaryStep);
  const cycleAfter = stateAtCyclePhase(boundaryStep);
  near(cycleBefore.shaftAngle, cycleAfter.shaftAngle, 4e-12,
    'shaft closes periodically');
  near(cycleBefore.eccentricAngle, cycleAfter.eccentricAngle, 4e-12,
    'loose eccentric closes periodically');
  vector2Near(cycleBefore.valvePin, cycleAfter.valvePin, 4e-12,
    'valve spindle closes periodically');
  vector2Near(cycleBefore.gabCenter, cycleAfter.gabCenter, 4e-12,
    'gab closes periodically');
  const nextCycle = stateAtTime(geometry.cyclePeriod);
  vector2Near(nextCycle.eccentricCenter, source.eccentricCenter, 0,
    'one full time cycle returns to source eccentric center');
  vector2Near(nextCycle.valvePin, source.valvePin, 0,
    'one full time cycle returns to source valve position');

  // Render transforms and contact records are driven directly from the same
  // solved state, while foundation, guide, and bearing remain fixed.
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const fixedBaseMatrix = baseRail.matrixWorld.clone();
  const fixedGuideMatrix = stuffingBox.matrixWorld.clone();
  const fixedBearingMatrix = shaftBearing.matrixWorld.clone();
  const renderedPhases = [0, 0.09, 0.22, 0.345, 0.465, 0.59, 0.72, 0.845, 0.965];
  for (const phase of renderedPhases) {
    const state = stateAtCyclePhase(phase);
    model.update(phase * geometry.cyclePeriod, 0.016);
    model.root.updateMatrixWorld(true);
    near(shaftRotor.rotation.z, state.shaftAngle, 1e-14,
      'rendered shaft angle');
    near(looseEccentric.rotation.z, state.eccentricAngle, 1e-14,
      'rendered loose-eccentric angle');
    vector2Near(strap.position, state.eccentricCenter, 1e-14,
      'rendered strap bearing center');
    near(strap.rotation.z, state.rodAngle, 1e-14,
      'rendered lifted-rod angle');
    vector2Near(valveSpindle.position, state.valvePin, 1e-14,
      'rendered valve-spindle position');
    near(manualLever.rotation.z, state.leverAngle, 1e-14,
      'rendered hand-lever angle');
    vector2Near(worldPoint(eccentricCenterAnchor), state.eccentricCenter, 1e-14,
      'rendered eccentric center anchor');
    vector2Near(worldPoint(gabCenterAnchor), state.gabCenter, 1e-14,
      'rendered gab center anchor');
    vector2Near(worldPoint(valvePinAnchor), state.valvePin, 1e-14,
      'rendered valve pin anchor');
    vector2Near(worldPoint(spindleLinkAnchor), state.spindleLinkPoint, 1e-14,
      'rendered spindle link anchor');
    vector2Near(worldPoint(leverJointAnchor), state.leverJointPoint, 1e-14,
      'rendered lever joint anchor');
    vector2Near(worldPoint(leverHandleAnchor), state.leverHandlePoint, 1e-14,
      'rendered lever handle anchor');
    vector2Near(worldPoint(shaftLugContactAnchor), state.lugPoint, 1e-14,
      'rendered shaft lug contact anchor');
    vector2Near(worldPoint(forwardStopAnchor), state.forwardStopPoint, 1e-14,
      'rendered forward stop anchor');
    vector2Near(worldPoint(reverseStopAnchor), state.reverseStopPoint, 1e-14,
      'rendered reverse stop anchor');
    assert.equal(stopContactMarker.visible, state.activeStopPoint !== null);
    assert.equal(gabContactMarker.visible, state.gabEngaged);
    assert.ok(baseRail.matrixWorld.equals(fixedBaseMatrix));
    assert.ok(stuffingBox.matrixWorld.equals(fixedGuideMatrix));
    assert.ok(shaftBearing.matrixWorld.equals(fixedBearingMatrix));
    near(
      model.root.userData.contacts.shaftLugAndEccentricStop
        .angularTravelBetweenStops,
      Math.PI,
      0,
      'rendered stop travel',
    );
    near(
      model.root.userData.contacts.shaftLugAndEccentricStop
        .penetrationError,
      0,
      9e-16,
      'rendered shaft-stop non-penetration',
    );
    near(model.root.userData.contacts.eccentricRodGab.captureError,
      0, 1.6e-15, 'rendered gab capture');
    near(model.root.userData.contacts.manualLeverLink.lengthError,
      0, 9e-16, 'rendered hand-link length');
    near(model.root.userData.contacts.valveSpindleGuide.positionError,
      0, 0, 'rendered valve guide closure');
  }

  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 11.4,
    'continuous eccentric rod, spindle, shaft, and foundation span full width');
  assert.ok(size.y > 7.9,
    'source-length upright lever and foundation span full height');
  assert.ok(size.z > 2.54,
    'rear bearing, strap, stop, shaft face, pins, and links occupy real depth');
  assert.ok(bounds.min.z < -1.27);
  assert.ok(bounds.max.z > 1.27);
  near(model.root.userData.cameraDistanceScale, 0.96, 0,
    'source-complete camera scale');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 2);

  // The next sequential mechanism is now independently authored as 180.
  const movement178 = createMovementModel(catalog.movements[177]);
  const movement180 = createMovementModel(catalog.movements[179]);
  const movement181 = createMovementModel(catalog.movements[180]);
  assert.equal(movement178.root.userData.fidelity, 'authored');
  assert.equal(
    movement178.root.userData.mechanism,
    'clockwise-eccentric-circular-groove-variable-radius-slotted-crank-finite-rod-horizontal-shaper-slide',
  );
  assert.equal(catalog.movements[179].fidelity, 'authored');
  assert.equal(movement180.root.userData.fidelity, 'authored');
  assert.equal(
    movement180.root.userData.mechanism,
    'fixed-straight-side-piece-single-screw-pivoted-eccentric-jaw-upward-friction-self-clamping-board',
  );
  assert.notEqual(
    movement180.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.equal(catalog.movements[180].fidelity, 'authored');
  assert.equal(movement181.root.userData.fidelity, 'authored');
  assert.equal(
    movement181.root.userData.mechanism,
    'ascending-piston-tappet-trips-lower-valve-handle-diagonal-catch-releases-upper-backweighted-handle-and-reverses-four-valves',
  );

  disposeModel(movement178.root);
  disposeModel(movement180.root);
  disposeModel(movement181.root);
  disposeModel(model.root);
});
