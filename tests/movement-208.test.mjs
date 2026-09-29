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
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
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

function radialDistanceToAxis(point, origin, axis) {
  const offset = point.clone().sub(origin);
  return offset.addScaledVector(axis, -offset.dot(axis)).length();
}

test('movement 208 is one sliding sixteen-slot pinion selecting exactly one of three pin circles', () => {
  const movement = catalog.movements[207];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnimation,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 208);
  assert.equal(movement.number, '208');
  assert.equal(
    movement.title,
    'Three-Ratio Pin-Wheel and Sliding Slotted Pinion',
  );
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(
    movement.description,
    '208. A pin-wheel and slotted pinion, by which three changes of speed can be obtained. There are three circles of pins of equal distance on the face of the pin-wheel, and by shifting the slotted pinion along its shaft, to bring it in contact with one or the other of the circles of pins, a continuous rotary motion of the wheel is made to produce three changes of speed of the pinion, or vice versa.',
  );
  assert.equal(
    movement.archetype,
    'three-ring-eleven-sixteen-twenty-one-pin-wheel-sliding-sixteen-slot-pinion',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'one-sixteen-slot-pinion-slides-along-its-own-shaft-to-mesh-one-of-three-concentric-pin-circles',
  );
  assert.equal(
    model.root.userData.variant,
    'manual-three-speed-face-pin-drive-with-stopped-indexed-single-ring-selection',
  );

  assert.equal(blocks.pinWheel.parent, model.root);
  assert.equal(blocks.slottedPinion.parent, model.root);
  assert.equal(blocks.outputShaft.parent, model.root);
  assert.equal(blocks.inputShaft.parent, model.root);
  assert.equal(blocks.selectorCollar.parent, model.root);
  assert.equal(blocks.pinRings.length, 3);
  assert.deepEqual(
    blocks.pinRings.map((ring) => ring.userData.pinCount),
    [11, 16, 21],
  );
  assert.deepEqual(
    blocks.pinRings.map((ring) => ring.userData.pins.length),
    [11, 16, 21],
  );
  assert.equal(blocks.pinionTeeth.length, 16);
  assert.equal(blocks.slotFloors.length, 16);
  assert.equal(blocks.slotAnchors.length, 16);
  assert.equal(blocks.slottedPinion.userData.slotCount, 16);
  assert.equal(blocks.slottedPinion.userData.keyedToSlidingShaft, true);
  assert.equal(blocks.outputShaft.userData.longitudinalKeyedSlide, true);
  assert.deepEqual(transmission.ringPinCounts, [11, 16, 21]);
  assert.equal(transmission.pinionSlotCount, 16);
  assert.deepEqual(transmission.ratios, [-11 / 16, -1, -21 / 16]);
  assert.deepEqual(transmission.closureInputTurns, [16, 1, 16]);
  assert.equal(transmission.direction, 'opposite');

  const counts = {
    forbidden: 0,
    pinCircleGroups: 0,
    pins: 0,
    radialSlots: 0,
    selectors: 0,
    slottedPinions: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/belt|pulley|chain|sprocket|worm|rack|pawl|ratchet/i.test(role)) {
      counts.forbidden += 1;
    }
    if (/pin-circle$/.test(role)) counts.pinCircleGroups += 1;
    if (object.userData.pinWheelPin) counts.pins += 1;
    if (object.userData.radialSlotFloor) counts.radialSlots += 1;
    if (role === 'axially-translating-pinion-selector-collar') {
      counts.selectors += 1;
    }
    if (role === 'single-axially-sliding-sixteen-slot-pinion') {
      counts.slottedPinions += 1;
    }
  });
  assert.deepEqual(counts, {
    forbidden: 0,
    pinCircleGroups: 3,
    pins: 48,
    radialSlots: 16,
    selectors: 1,
    slottedPinions: 1,
  });
  assert.equal(sourceAnimation.available, false);
  assert.match(sourceAnimation.reason, /unavailable/i);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.deepEqual(sourceRaster.inferredRingPinCounts, [11, 16, 21]);
  assert.equal(sourceRaster.inferredPinionSlotCount, 16);
  assert.equal(sourceRaster.sourcePoseSelectedRingIndex, 2);
  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  disposeModel(model.root);
});

test('movement 208 reproduces the source count fit and perpendicular face-pin geometry', () => {
  const model = createMovementModel(catalog.movements[207]);
  const {
    blocks,
    geometry,
    modelPointToSourceRaster,
    sourceAnchors,
    sourcePointToModel,
    transmission,
  } = model.root.userData;

  vector3Near(blocks.pinWheel.userData.axis, Z_AXIS, 1e-15,
    'pin-wheel axis normal to its face');
  vector3Near(blocks.inputShaft.userData.axis, Z_AXIS, 1e-15,
    'input shaft follows the pin-wheel axis');
  vector3Near(blocks.slottedPinion.userData.axis, X_AXIS, 1e-15,
    'slotted pinion runs along the horizontal selector shaft');
  vector3Near(blocks.outputShaft.userData.axis, X_AXIS, 1e-15,
    'output shaft is the pinion slide axis');
  near(
    Math.abs(blocks.pinWheel.userData.axis.dot(
      blocks.slottedPinion.userData.axis,
    )),
    0,
    1e-15,
    'source shafts are perpendicular',
  );

  assert.deepEqual(geometry.ringPitchRadii, [11 / 16, 1, 21 / 16]);
  assert.deepEqual(geometry.ringSelectorXs, [-11 / 16, -1, -21 / 16]);
  transmission.ringPinCounts.forEach((pinCount, ringIndex) => {
    near(
      FULL_TURN * geometry.ringPitchRadii[ringIndex] / pinCount,
      geometry.circularPitch,
      2e-16,
      `ring ${ringIndex} circular pitch`,
    );
    near(
      blocks.pinRings[ringIndex].userData.pitchRadius,
      geometry.ringPitchRadii[ringIndex],
      0,
      `ring ${ringIndex} rendered pitch radius`,
    );
    assert.equal(
      blocks.pinRings[ringIndex].parent,
      blocks.pinWheel.userData.rotor,
    );
  });
  near(
    FULL_TURN * geometry.pinionPitchRadius / transmission.pinionSlotCount,
    geometry.circularPitch,
    0,
    'pinion slot pitch equals all three pin pitches',
  );
  near(
    geometry.pinionCenterZ - geometry.pinContactZ,
    geometry.pinionPitchRadius,
    1e-15,
    'pinion pitch radius reaches the face-pin contact height',
  );
  assert.ok(geometry.pinStartZ < geometry.pinContactZ);
  assert.ok(geometry.pinContactZ < geometry.pinEndZ);
  assert.ok(geometry.pinionRootRadius < geometry.pinionPitchRadius);
  assert.ok(geometry.pinionPitchRadius < geometry.pinionOuterRadius);
  assert.ok(geometry.slotWidth > 2 * geometry.pinRadius);
  assert.ok(geometry.neutralAxialGap > 0);
  assert.ok(
    2 * geometry.engagementCaptureHalfWidth < geometry.ringSpacing,
    'adjacent axial engagement envelopes cannot overlap',
  );

  vector2Near(sourceAnchors.wheelCenter,
    new THREE.Vector2(269.58, 277.05), 0, 'source wheel centre');
  vector2Near(sourceAnchors.pinionCenter,
    new THREE.Vector2(128.7, 279.5), 0, 'source pinion centre');
  assert.deepEqual(
    sourceAnchors.ringFits.map(({ pinCount }) => pinCount),
    [11, 16, 21],
  );
  const sourceCircularPitches = sourceAnchors.ringFits.map(
    ({ pinCount, pitchRadius }) => FULL_TURN * pitchRadius / pinCount,
  );
  assert.ok(
    Math.max(...sourceCircularPitches) - Math.min(...sourceCircularPitches)
      < 1.4,
    'all three engraved rings resolve to one circular pitch',
  );
  sourceAnchors.ringFits.forEach(({ pinCount, phaseDegrees }) => {
    const pitchDegrees = 360 / pinCount;
    const nearestLeftPin = phaseDegrees
      + Math.round((180 - phaseDegrees) / pitchDegrees) * pitchDegrees;
    near(nearestLeftPin, 180, 2.1,
      `${pinCount}-pin ring has a source pin at the selector tangent`);
  });
  assert.ok(
    sourceAnchors.modeledOuterSelectorCenter.distanceTo(
      sourceAnchors.pinionCenter,
    ) < 3,
    'modeled outer selection overlays Brown’s source pinion pose',
  );
  sourceAnchors.ringFits.forEach(({ pitchRadius }, ringIndex) => {
    const modeledRadiusInPixels = geometry.ringPitchRadii[ringIndex]
      / model.root.userData.sourceRaster.scale;
    near(modeledRadiusInPixels, pitchRadius, 4.6,
      `ring ${ringIndex} source-scaled pitch radius`);
  });
  const arbitrarySourcePoint = new THREE.Vector2(330.2, 211.4);
  vector2Near(
    modelPointToSourceRaster(sourcePointToModel(arbitrarySourcePoint)),
    arbitrarySourcePoint,
    3e-14,
    'source transform round trip',
  );
  disposeModel(model.root);
});

test('movement 208 preserves every selected pin-slot phase and all three exact speed ratios', () => {
  const model = createMovementModel(catalog.movements[207]);
  const {
    geometry,
    selectedStateAtWheelTravel,
    transmission,
  } = model.root.userData;
  const samplesPerRing = 10923;

  transmission.ringPinCounts.forEach((pinCount, ringIndex) => {
    const ratio = -pinCount / transmission.pinionSlotCount;
    const closureTurns = transmission.closureInputTurns[ringIndex];
    const start = selectedStateAtWheelTravel(0, ringIndex, 1.37);
    const closed = selectedStateAtWheelTravel(
      closureTurns * FULL_TURN,
      ringIndex,
      1.37,
    );
    near(closed.wheelAngle - start.wheelAngle,
      closureTurns * FULL_TURN, 0, `ring ${ringIndex} input closure travel`);
    near(closed.pinionAngle - start.pinionAngle,
      ratio * closureTurns * FULL_TURN, 0,
      `ring ${ringIndex} output closure travel`);
    const outputClosureTurns = ratio * closureTurns;
    assert.equal(Number.isInteger(outputClosureTurns), true);
    near(
      (closed.pinionAngle - start.pinionAngle) / FULL_TURN,
      outputClosureTurns,
      3e-15,
      `ring ${ringIndex} integer output closure turns`,
    );

    for (let index = 0; index < samplesPerRing; index += 1) {
      const progress = index / (samplesPerRing - 1);
      const wheelTravel = progress * closureTurns * FULL_TURN;
      const wheelAngularSpeed = 0.37 + 1.8 * ((index * 37) % 101) / 100;
      const state = selectedStateAtWheelTravel(
        wheelTravel,
        ringIndex,
        wheelAngularSpeed,
      );
      const { mesh } = state;
      near(state.selectedRatio, ratio, 0, 'selected count ratio');
      near(state.pinionAngularSpeed,
        ratio * state.wheelAngularSpeed, 0, 'opposite output rate');
      assert.deepEqual(state.torqueTransmittingRingIndices, [ringIndex]);
      assert.deepEqual(mesh.potentialEngagementIndices, [ringIndex]);
      assert.equal(mesh.pinCount, pinCount);
      assert.equal(mesh.ringIndex, ringIndex);
      assert.ok(mesh.activePinIndex >= 0 && mesh.activePinIndex < pinCount);
      assert.ok(
        mesh.activeSlotIndex >= 0
          && mesh.activeSlotIndex < transmission.pinionSlotCount,
      );
      near(mesh.meshPhaseModuloError, 0, 4e-14,
        'pin-count/slot-count phase invariant');
      near(mesh.slotPhaseError, 0, 4e-14,
        'active pin and radial slot hand off together');
      near(mesh.transverseCenterlineError, 0, 4e-14,
        'pin axis intersects the active radial slot centreline');
      near(mesh.pitchLineVelocityError, 0, 2e-15,
        'nominal pitch velocities match');
      near(mesh.ratioError, 0, 2e-15, 'exact angular-speed ratio');
      assert.equal(mesh.slotWithinBounds, true);
      assert.ok(mesh.slotRadialCoordinate >= geometry.pinionRootRadius);
      assert.ok(mesh.slotRadialCoordinate <= geometry.pinionOuterRadius);
      assert.ok(
        Math.abs(mesh.pinionAxialOffset) <= mesh.pinionFaceHalfWidth,
        'active moving pin remains within the narrow pinion face',
      );
      assert.ok(mesh.slotCenterlinePoint.z >= geometry.pinStartZ);
      assert.ok(mesh.slotCenterlinePoint.z <= geometry.pinEndZ);
      vector3Near(mesh.wheelPitchVelocity, mesh.pinionPitchVelocity, 2e-15,
        'opposed shafts share pitch-line velocity');
      finiteStateNumbers(state);
    }
  });
  assert.throws(
    () => selectedStateAtWheelTravel(0, -1),
    /ringIndex must be 0, 1, or 2/,
  );
  assert.throws(
    () => selectedStateAtWheelTravel(0, 3),
    /ringIndex must be 0, 1, or 2/,
  );
  disposeModel(model.root);
});

test('movement 208 stops before each C2 axial shift and never engages two rings at once', () => {
  const model = createMovementModel(catalog.movements[207]);
  const {
    canonicalStates,
    canonicalTimes,
    geometry,
    selector,
    stateAtTime,
    transmission,
  } = model.root.userData;

  assert.deepEqual(selector.selectionSequence, [2, 1, 0, 1]);
  assert.deepEqual(
    [
      canonicalStates.outerRingRunning.engagedRingIndex,
      canonicalStates.middleRingRunning.engagedRingIndex,
      canonicalStates.innerRingRunning.engagedRingIndex,
      canonicalStates.returningMiddleRingRunning.engagedRingIndex,
    ],
    [2, 1, 0, 1],
  );
  for (const name of [
    'outerToMiddleNeutral',
    'middleToInnerNeutral',
    'innerToMiddleNeutral',
    'middleToOuterNeutral',
  ]) {
    const state = canonicalStates[name];
    assert.equal(state.isShifting, true);
    assert.equal(state.engagedRingIndex, null);
    assert.equal(state.selectedRatio, null);
    assert.deepEqual(state.torqueTransmittingRingIndices, []);
    assert.deepEqual(state.potentialEngagementIndices, []);
    near(state.wheelAngularSpeed, 0, 0, `${name} stopped input`);
    near(state.pinionAngularSpeed, 0, 0, `${name} stopped output`);
    near(state.wheelAngularAcceleration, 0, 0,
      `${name} zero input acceleration`);
    near(state.pinionAngularAcceleration, 0, 0,
      `${name} zero output acceleration`);
  }

  const denseSamples = 32769;
  for (let index = 0; index < denseSamples; index += 1) {
    const time = selector.cycleDuration * index / (denseSamples - 1);
    const state = stateAtTime(time);
    assert.ok(state.simultaneousPotentialEngagementCount <= 1);
    assert.ok(state.torqueTransmittingRingIndices.length <= 1);
    if (state.isShifting) {
      assert.equal(state.engagedRingIndex, null);
      assert.deepEqual(state.torqueTransmittingRingIndices, []);
      near(state.wheelAngularSpeed, 0, 0, 'shift input remains stopped');
      near(state.pinionAngularSpeed, 0, 0, 'shift output remains stopped');
    } else {
      assert.deepEqual(
        state.torqueTransmittingRingIndices,
        [state.engagedRingIndex],
      );
      assert.equal(state.mesh.ringIndex, state.engagedRingIndex);
      near(
        state.pinionAngularSpeed,
        transmission.ratios[state.engagedRingIndex]
          * state.wheelAngularSpeed,
        2e-15,
        'dwell rate follows selected radius ratio',
      );
      near(state.mesh.pitchLineVelocityError, 0, 2e-15,
        'dense dwell pitch velocity');
      near(state.mesh.meshPhaseModuloError, 0, 8e-14,
        'dense dwell phase closure');
    }
    finiteStateNumbers(state);
  }

  const transitionBoundaries = [];
  for (let stageIndex = 0; stageIndex < 4; stageIndex += 1) {
    transitionBoundaries.push(
      stageIndex * selector.stageDuration + selector.dwellDuration,
      (stageIndex + 1) * selector.stageDuration,
    );
  }
  const epsilon = 1e-7;
  transitionBoundaries.forEach((boundary) => {
    const atBoundary = stateAtTime(boundary);
    const before = stateAtTime(boundary - epsilon);
    const after = stateAtTime(boundary + epsilon);
    near(atBoundary.wheelAngularSpeed, 0, 1e-14,
      `zero wheel speed at ${boundary}`);
    near(atBoundary.pinionAngularSpeed, 0, 1e-14,
      `zero pinion speed at ${boundary}`);
    near(atBoundary.wheelAngularAcceleration, 0, 1e-14,
      `zero wheel acceleration at ${boundary}`);
    near(atBoundary.pinionAngularAcceleration, 0, 1e-14,
      `zero pinion acceleration at ${boundary}`);
    near(atBoundary.selectorVelocity, 0, 1e-14,
      `zero selector speed at ${boundary}`);
    near(atBoundary.selectorAcceleration, 0, 1e-14,
      `zero selector acceleration at ${boundary}`);
    near(before.wheelAngle, after.wheelAngle, 2e-12,
      `continuous wheel angle at ${boundary}`);
    near(before.pinionAngle, after.pinionAngle, 3e-12,
      `continuous pinion angle at ${boundary}`);
    near(before.selectorX, after.selectorX, 2e-12,
      `continuous selector position at ${boundary}`);
    assert.ok(Math.abs(before.wheelAngularSpeed) < 2e-11);
    assert.ok(Math.abs(after.wheelAngularSpeed) < 2e-11);
    assert.ok(Math.abs(before.selectorVelocity) < 2e-11);
    assert.ok(Math.abs(after.selectorVelocity) < 2e-11);
    assert.ok(Math.abs(before.wheelAngularAcceleration) < 2e-4);
    assert.ok(Math.abs(after.wheelAngularAcceleration) < 2e-4);
    assert.ok(Math.abs(before.selectorAcceleration) < 2e-4);
    assert.ok(Math.abs(after.selectorAcceleration) < 2e-4);
  });

  const start = stateAtTime(0);
  const closed = stateAtTime(selector.cycleDuration);
  near(closed.wheelAngle - start.wheelAngle,
    4 * FULL_TURN, 0, 'four input turns close selector cycle');
  near(closed.pinionAngle - start.pinionAngle,
    -4 * FULL_TURN, 0, 'four output turns close selector cycle');
  near(closed.selectorX, start.selectorX, 0,
    'selector returns to source outer ring');
  assert.equal(closed.engagedRingIndex, 2);
  assert.ok(geometry.neutralAxialGap > 0);
  assert.equal(canonicalTimes.cycleClosure, selector.cycleDuration);
  disposeModel(model.root);
});

test('movement 208 renders rigid indices while 209–213 are distinct and authored', () => {
  const movement = catalog.movements[207];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const selectedTimes = [
    canonicalTimes.sourceOuterRing,
    canonicalTimes.outerRingRunning,
    canonicalTimes.middleRingRunning,
    canonicalTimes.innerRingRunning,
    canonicalTimes.returningMiddleRingRunning,
  ];

  selectedTimes.forEach((time) => {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.pinWheel.userData.rotor.rotation.z,
      state.wheelAngle, 0, 'rendered pin-wheel angle');
    near(blocks.inputShaft.userData.rotor.rotation.z,
      state.wheelAngle, 0, 'rendered input-shaft angle');
    near(blocks.slottedPinion.userData.rotor.rotation.z,
      state.pinionAngle, 0, 'rendered slotted-pinion angle');
    near(blocks.outputShaft.userData.rotor.rotation.z,
      state.pinionAngle, 0, 'rendered output-shaft angle');
    near(blocks.slottedPinion.position.x,
      state.selectorX, 0, 'rendered axial pinion selection');
    near(blocks.selectorCollar.position.x,
      state.selectorX, 0, 'rendered selector collar follows pinion');
    assert.equal(blocks.contactMarker.visible, false, 'Brown draws no contact marker; it stays bound but hidden');
    near(blocks.contactMarker.position.x,
      state.selectorX, 0, 'rendered contact marker follows selection');

    const activePin = blocks.pinRings[state.engagedRingIndex]
      .userData.pins[state.mesh.activePinIndex];
    vector3Near(
      activePin.getWorldPosition(new THREE.Vector3()),
      state.mesh.activePinCenter,
      4e-15,
      'active rendered pin follows one rigid wheel transform',
    );
    const activeSlotAnchor = blocks.slotAnchors[state.mesh.activeSlotIndex];
    const expectedSlotPitchPoint = new THREE.Vector3(
      state.selectorX,
      Math.sin(state.mesh.activeSlotAngle) * geometry.pinionPitchRadius,
      geometry.pinionCenterZ
        - Math.cos(state.mesh.activeSlotAngle) * geometry.pinionPitchRadius,
    );
    vector3Near(
      activeSlotAnchor.getWorldPosition(new THREE.Vector3()),
      expectedSlotPitchPoint,
      6e-15,
      'active rendered slot anchor follows the pinion rotor',
    );
    near(
      radialDistanceToAxis(
        blocks.pinionIndex.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(state.selectorX, 0, geometry.pinionCenterZ),
        X_AXIS,
      ),
      geometry.pinionPitchRadius * 0.58,
      2e-15,
      'white pinion index makes output spin rate visible',
    );
  });

  model.update(canonicalTimes.outerToMiddleNeutral);
  assert.equal(blocks.contactMarker.visible, false);
  const neutral = stateAtTime(canonicalTimes.outerToMiddleNeutral);
  near(blocks.slottedPinion.position.x,
    neutral.selectorX, 0, 'rendered neutral slide position');
  near(blocks.selectorCollar.position.x,
    neutral.selectorX, 0, 'rendered neutral collar position');

  model.update(canonicalTimes.sourceOuterRing);
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4.4, 'long keyed shaft and selector occupy real x depth');
  assert.ok(size.y > 3.4, 'pin wheel and frame occupy real height');
  assert.ok(size.z > 2.4, 'perpendicular shafts occupy real z depth');

  const movement207 = createMovementModel(catalog.movements[206]);
  const movement209 = createMovementModel(catalog.movements[208]);
  assert.notEqual(
    movement207.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement209.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.equal(catalog.movements[208].id, 209);
  assert.equal(catalog.movements[208].fidelity, 'authored');
  assert.equal(movement209.root.userData.fidelity, 'authored');
  const movement210 = createMovementModel(catalog.movements[209]);
  const movement211 = createMovementModel(catalog.movements[210]);
  const movement212 = createMovementModel(catalog.movements[211]);
  const movement213 = createMovementModel(catalog.movements[212]);
  assert.equal(catalog.movements[209].id, 210);
  assert.equal(catalog.movements[209].fidelity, 'authored');
  assert.equal(movement210.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement210.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.equal(catalog.movements[210].id, 211);
  assert.equal(catalog.movements[210].fidelity, 'authored');
  assert.equal(movement211.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement211.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.equal(catalog.movements[211].id, 212);
  assert.equal(catalog.movements[211].fidelity, 'authored');
  assert.equal(movement212.root.userData.fidelity, 'authored');
  assert.notEqual(movement212.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[212].id, 213);
  assert.equal(catalog.movements[212].fidelity, 'authored');
  assert.equal(movement213.root.userData.fidelity, 'authored');
  disposeModel(movement207.root);
  disposeModel(movement209.root);
  disposeModel(movement210.root);
  disposeModel(movement211.root);
  disposeModel(movement212.root);
  disposeModel(movement213.root);
  disposeModel(model.root);
});

test('movement 208 pinion is a wide slotted strip that clears the inner neighbouring ring', () => {
  const model = createMovementModel(catalog.movements[207]);
  const { blocks, stateAtTime } = model.root.userData;
  const ringRadii = blocks.pinRings.map((ring) => ring.userData.pitchRadius);
  for (const time of [0, 5, 10, 15]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(blocks.pinionWeb);
    // Brown's strip is about 0.34 wide; the pinion is now 0.26 (was 0.11).
    assert.ok(box.max.x - box.min.x > 0.25);
    // The widened face points toward the wheel centre and stops short of the
    // next inner pin ring's pins at every selector position.
    const selectorX = stateAtTime(time).selectorX;
    const inner = ringRadii.filter((radius) => radius < -selectorX - 1e-9);
    if (inner.length) assert.ok(-box.max.x > Math.max(...inner) + 0.082 + 0.02);
  }
  disposeModel(model.root);
});

test('movement 208 slot outline is free of swept-cutter zigzags', async () => {
  const { staircaseInOutlines } = await import('../scripts/screen-faceting.mjs');
  const outline = (await import('../src/simulation/generated-pin-slot-208.js')).default;
  const result = staircaseInOutlines([outline]);
  // What remains is one eased junction per tooth, where two pin rings'
  // sweeps meet (r 0.905); the swept-cutter cusps (80 before) are gone.
  assert.ok(result.zigzags <= 16, `zigzags ${result.zigzags}`);
  assert.ok(result.longestRun < 6);
});

test('movement 208 p101: the slotted pinion has clean, regular round-top leaves', async () => {
  const outline = (await import('../src/simulation/generated-pin-slot-208.js')).default;
  const radii = outline.map(([x, y]) => Math.hypot(x, y));
  near(Math.min(...radii), 0.84, 1e-6, 'root circle');
  near(Math.max(...radii), 1.03, 2e-4, 'tip circle');
  // Sixteen identical leaves: the outline repeats exactly under a 1/16 turn.
  const period = outline.length / 16;
  assert.equal(period, Math.round(period));
  const turn = 2 * Math.PI / 16;
  for (let i = 0; i < period; i += 7) {
    const [x, y] = outline[i], [u, v] = outline[i + period];
    near(u, x * Math.cos(turn) - y * Math.sin(turn), 2e-7, 'leaf repeat x');
    near(v, x * Math.sin(turn) + y * Math.cos(turn), 2e-7, 'leaf repeat y');
  }
  // Each leaf is symmetric about its centreline (pi/16 off each slot centre).
  const mirrored = outline.map(([x, y]) => {
    const a = 2 * (Math.PI / 16) - Math.atan2(y, x), r = Math.hypot(x, y);
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  const distance = (p) => Math.min(...outline.map(([x, y]) => Math.hypot(x - p[0], y - p[1])));
  for (let i = 0; i < period; i += 11) assert.ok(distance(mirrored[i]) < 0.004, `leaf symmetric at ${i}`);
});

test('p101: 208 axial pins are tagged noShadow so the render policy keeps them from hatching the face', () => {
  const model = createMovementModel(catalog.movements[207]);
  let pins = 0;
  model.root.traverse((o) => {
    if (!o.isMesh || !/axial-drive-pin/.test(o.userData.role ?? '')) return;
    pins += 1;
    assert.equal(o.userData.noShadow, true);
    assert.equal(o.castShadow, false);
    assert.equal(o.receiveShadow, true);
  });
  assert.ok(pins > 30);
});
