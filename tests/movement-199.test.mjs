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

test('movement 199 is Brown\'s four-pin lantern pinion, opposed racks, two entry teeth, and four fixed guides', () => {
  const movement = catalog.movements[198];
  const model = createMovementModel(movement);
  const {
    blocks,
    geometry,
    sourceAnchors,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 199);
  assert.equal(movement.number, '199');
  assert.equal(movement.title, 'Partial Lantern-Pinion Mangle Rack');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(
    movement.description,
    '199. Another form of mangle-rack. The lantern-pinion revolves continuously in one direction, and gives reciprocating motion to the square frame, which is guided by rollers or grooves. The pinion has only teeth in less than half of its circumference, so that while it engages one side of the rack, the toothless half is directed against the other. The large tooth at the commencement of each rack is made to insure the teeth of the pinion being properly in gear.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'partial-lantern-pinion-opposed-racks-roller-guided-reciprocating-frame',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'four-pin-partial-lantern-pinion-alternately-drives-five-pitch-opposed-racks-one-revolution-per-cycle',
  );
  assert.equal(
    model.root.userData.variant,
    'oversized-entry-teeth-exclusive-upper-lower-mesh-with-four-fixed-guide-rollers',
  );

  assert.equal(blocks.rackFrame.parent, model.root);
  assert.equal(blocks.rackFrameBody.parent, blocks.rackFrame);
  assert.equal(blocks.lanternPinion.parent, model.root);
  assert.equal(blocks.pinionShaft.parent, model.root);
  assert.equal(blocks.pinionBearing.parent, model.root);
  assert.equal(blocks.topRackTeeth.length, 5);
  assert.equal(blocks.bottomRackTeeth.length, 5);
  assert.equal(blocks.lanternPins.length, 4);
  assert.equal(blocks.pinionSideRings.length, 2);
  assert.equal(blocks.lanternHubs.length, 2);
  assert.equal(blocks.lanternSpokes.length, 4);
  assert.equal(blocks.guideRollers.length, 4);
  assert.equal(blocks.guideRollerShafts.length, 4);
  assert.equal(blocks.guideTracks.length, 2);
  assert.equal(blocks.lanternPinion.userData.installedPinCount, 4);
  assert.equal(blocks.lanternPinion.userData.virtualToothCount, 10);
  assert.equal(blocks.pinionShaft.userData.fixedCenter, true);
  assert.equal(blocks.topRackTeeth[0].userData.kind, 'entry');
  assert.equal(blocks.bottomRackTeeth[0].userData.kind, 'entry');
  blocks.topRackTeeth.slice(1).forEach((tooth) => {
    assert.equal(tooth.userData.kind, 'ordinary');
  });
  blocks.bottomRackTeeth.slice(1).forEach((tooth) => {
    assert.equal(tooth.userData.kind, 'ordinary');
  });
  blocks.guideRollers.forEach((roller) => {
    assert.equal(roller.parent, model.root);
    assert.equal(roller.userData.fixedCenter, true);
  });

  let installedPinCount = 0;
  let oversizedEntryToothCount = 0;
  let liftingRodCount = 0;
  let beltCount = 0;
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (role === 'installed-driving-pin-of-partial-lantern-pinion') {
      installedPinCount += 1;
    }
    if (/oversized-entry-tooth/.test(role)) oversizedEntryToothCount += 1;
    if (/rack-lifting-rod/.test(role)) liftingRodCount += 1;
    if (/belt/.test(role)) beltCount += 1;
  });
  assert.equal(installedPinCount, 4);
  assert.equal(oversizedEntryToothCount, 2);
  assert.equal(liftingRodCount, 0);
  assert.equal(beltCount, 0);

  assert.deepEqual(sourceAnimation.boundingBox, [-25, -25, 50, 50]);
  vector2Near(
    sourceAnimation.normalizedSourcePoseTranslation,
    new THREE.Vector2(-15.707963, 0),
    1e-15,
    'official source-pose translation',
  );
  assert.deepEqual(sourceAnchors.pinionCenter.toArray(), [0, 0]);
  assert.deepEqual(
    sourceAnchors.guideRollerCenters.map((center) => center.toArray()),
    [[-6, 11.2], [6, 11.2], [-6, -11.2], [6, -11.2]],
  );
  sourceAnchors.modeledSourceFrameEndCenters.forEach((center, index) => {
    vector2Near(
      center,
      sourceAnchors.sourceFrameEndCenters[index],
      3e-7,
      `source-fitted frame end center ${index}`,
    );
  });
  near(
    sourceAnimation.scale,
    geometry.officialScale,
    1e-15,
    'source animation scale',
  );
  disposeModel(model.root);
});

test('movement 199 preserves the official ten-position pitch, four installed pins, five-pitch stroke, and asymmetric entry teeth', () => {
  const model = createMovementModel(catalog.movements[198]);
  const { geometry, transmission } = model.root.userData;

  near(
    geometry.officialScale,
    geometry.circularPitch / Math.PI,
    1e-15,
    'official rack pitch scale',
  );
  near(
    geometry.pinionPitchRadius,
    geometry.virtualPinionToothCount * geometry.circularPitch / FULL_TURN,
    1e-15,
    'virtual ten-position pinion pitch radius',
  );
  near(
    geometry.frameStroke,
    5 * geometry.circularPitch,
    1e-15,
    'frame stroke is five rack pitches',
  );
  near(
    geometry.frameRight - geometry.frameLeft,
    40 * geometry.officialScale,
    1e-15,
    'official forty-unit frame length',
  );
  near(
    geometry.guideRollerY - geometry.guideRollerRadius,
    geometry.frameOuterHalfHeight,
    2e-16,
    'upper guide roller is tangent to the frame',
  );
  near(
    geometry.innerRackRadius - geometry.pinionBodyRadius,
    0.2 * geometry.officialScale,
    2e-16,
    'lantern side ring clears the capsule opening',
  );
  assert.equal(geometry.virtualPinionToothCount, 10);
  assert.equal(geometry.installedLanternPinCount, 4);
  near(
    geometry.occupiedPinCenterArc,
    108 * Math.PI / 180,
    2e-7,
    'four pin centers span 108 degrees',
  );
  near(
    geometry.occupiedPinPitchArc,
    144 * Math.PI / 180,
    2e-15,
    'installed pins occupy four of ten pitches',
  );
  near(
    geometry.toothlessPinPitchArc,
    216 * Math.PI / 180,
    2e-15,
    'six toothless pitches remain opposite the installed sector',
  );
  assert.ok(geometry.occupiedPinPitchArc < Math.PI);
  assert.ok(geometry.toothlessPinPitchArc > Math.PI);
  assert.deepEqual(
    geometry.installedPinAngles.map((angle) => Math.round(
      angle * 180 / Math.PI,
    )),
    [126, 162, 198, 234],
  );
  geometry.sourceLanternPinCenters.forEach((center, index) => {
    near(
      center.length() * geometry.officialScale,
      index < 2
        ? 4.794330760011662 * geometry.officialScale
        : 4.794330372840507 * geometry.officialScale,
      2e-15,
      `official lantern pin orbit ${index}`,
    );
  });

  assert.equal(geometry.topRackProfilesInMotionOrder.length, 5);
  assert.equal(geometry.bottomRackProfilesInMotionOrder.length, 5);
  near(
    Math.min(...geometry.topRackProfilesInMotionOrder[0].map(
      (point) => point.y,
    )),
    3 * geometry.officialScale,
    1e-15,
    'upper entry tooth reaches the three-unit root',
  );
  near(
    Math.max(...geometry.bottomRackProfilesInMotionOrder[0].map(
      (point) => point.y,
    )),
    -3 * geometry.officialScale,
    1e-15,
    'lower entry tooth reaches the three-unit root',
  );
  for (const side of ['upper', 'lower']) {
    const pitchCenters = geometry.rackToothProgressCenters[side]
      .map((center) => center / geometry.circularPitch);
    assert.ok(pitchCenters[0] > 0.38 && pitchCenters[0] < 0.39);
    pitchCenters.slice(1).forEach((center, index) => {
      near(center, index + 1.5, 1.2e-6, `${side} ordinary tooth ${index}`);
    });
  }
  assert.equal(transmission.installedPinFraction, 0.4);
  assert.equal(transmission.rackPitchPassesPerHalfCycle, 5);
  assert.equal(transmission.pinionRevolutionsPerFrameCycle, -1);
  assert.equal(transmission.frameReversalsPerCycle, 2);
  disposeModel(model.root);
});

// Original-source pitch construction only: these nominal contacts do not
// establish finite positive-force transmission. See the working-parts tests.
test('movement 199 retains the source nominal rack selection and pitch law through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[198]);
  const {
    canonicalStates,
    geometry,
    stateAtInputTravel,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  let frameMinimum = Infinity;
  let frameMaximum = -Infinity;
  let maximumRackProgress = 0;
  let minimumInactiveClearance = Infinity;
  let previousDirection = 0;
  let reversalCount = 0;
  let upperStateCount = 0;
  let lowerStateCount = 0;
  const pathSegments = new Set();

  for (let index = 0; index <= sampleCount; index += 1) {
    const inputTravel = FULL_TURN * index / sampleCount;
    const state = stateAtInputTravel(inputTravel);
    finiteStateNumbers(state, `state ${index}`);
    pathSegments.add(state.pathSegment);
    near(
      state.pinionAngle,
      -inputTravel,
      2e-15,
      `uniform clockwise pinion angle ${index}`,
    );
    near(
      state.pinionAngularSpeed,
      transmission.pinionAngularSpeed,
      1e-15,
      `uniform pinion speed ${index}`,
    );
    vector2Near(
      state.pinionCenter,
      new THREE.Vector2(),
      1e-15,
      `fixed pinion center ${index}`,
    );
    near(state.frameTranslation.y, 0, 1e-15, `horizontal frame ${index}`);
    assert.equal(state.engagedRackCount, 1);
    assert.notEqual(state.activeRackSide, state.inactiveRackSide);
    assert.equal(state.activeRackSide, state.upperRackActive ? 'upper' : 'lower');
    assert.equal(state.inactiveRackSide, state.upperRackActive ? 'lower' : 'upper');
    assert.equal(state.toothlessHalfFacesInactiveRack, true);
    assert.ok(state.pinSectorAlignment >= -2e-12);
    assert.ok(
      state.minimumInactiveRackClearance
        > geometry.officialScale * 0.015,
      `inactive rack remains clear at ${index}`,
    );
    assert.ok(
      state.nearestActiveToothSurfaceSeparation
        < geometry.officialScale * 0.054,
      `installed sector remains at the active rack at ${index}`,
    );
    assert.ok(state.contactRadiusError < 2e-15);
    assert.ok(state.rollingVelocityError < 2e-15);
    assert.ok(state.meshPhaseError < 2e-14);
    vector2Near(
      state.pinionContactVelocity,
      state.rackContactVelocity,
      2e-15,
      `pitch-line rolling velocity ${index}`,
    );
    near(
      Math.abs(state.contactPoint.y),
      geometry.pinionPitchRadius,
      1e-15,
      `contact pitch radius ${index}`,
    );
    assert.equal(
      Math.sign(state.contactPoint.y),
      state.activeRackSide === 'upper' ? 1 : -1,
    );
    assert.ok(state.activeRackPitchProgress >= 0);
    assert.ok(state.activeRackPitchProgress < 5 + 1e-12);
    assert.ok(state.activeRackToothIndex >= 0);
    assert.ok(state.activeRackToothIndex < 5);
    state.lanternPinCenters.forEach((center, pinIndex) => {
      near(
        center.length(),
        geometry.sourceLanternPinCenters[pinIndex].length()
          * geometry.officialScale,
        3e-15,
        `lantern pin orbit ${index}:${pinIndex}`,
      );
    });

    frameMinimum = Math.min(frameMinimum, state.frameTranslation.x);
    frameMaximum = Math.max(frameMaximum, state.frameTranslation.x);
    maximumRackProgress = Math.max(
      maximumRackProgress,
      state.activeRackPitchProgress,
    );
    minimumInactiveClearance = Math.min(
      minimumInactiveClearance,
      state.minimumInactiveRackClearance,
    );
    if (state.upperRackActive) upperStateCount += 1;
    else lowerStateCount += 1;
    if (previousDirection !== 0 && state.frameDirection !== previousDirection) {
      reversalCount += 1;
    }
    previousDirection = state.frameDirection;
  }

  assert.deepEqual(pathSegments, new Set([
    'left-entry-tooth-handoff',
    'upper-rack-rightward-run',
    'right-entry-tooth-handoff',
    'lower-rack-leftward-run',
  ]));
  assert.equal(reversalCount, 2);
  assert.ok(Math.abs(upperStateCount - lowerStateCount) <= 1);
  near(frameMinimum, -geometry.frameStroke, 2e-15, 'left frame extreme');
  near(frameMaximum, 0, 2e-15, 'right frame extreme');
  assert.ok(maximumRackProgress > 4.999);
  assert.ok(minimumInactiveClearance > geometry.officialScale * 0.015);

  const start = stateAtInputTravel(0);
  const closure = stateAtInputTravel(FULL_TURN);
  vector2Near(
    closure.frameTranslation,
    start.frameTranslation,
    2e-15,
    'frame closes after one pinion turn',
  );
  near(
    closure.pinionAngle - start.pinionAngle,
    -FULL_TURN,
    2e-15,
    'pinion advances one clockwise revolution',
  );
  closure.guideRollerAngles.forEach((angle, index) => {
    near(angle, start.guideRollerAngles[index], 2e-15, `guide ${index} closes`);
  });
  assert.equal(canonicalStates.sourcePose.activeRackSide, 'upper');
  assert.equal(canonicalStates.sourcePose.isHandoff, true);
  assert.equal(canonicalStates.rightFrameReversal.activeRackSide, 'lower');
  assert.equal(canonicalStates.rightFrameReversal.isHandoff, true);
  assert.equal(canonicalStates.upperRackMidpoint.activeRackPitchProgress, 2.5);
  assert.equal(canonicalStates.lowerRackMidpoint.activeRackPitchProgress, 2.5);

  const epsilon = 1e-9;
  for (const handoff of [0, Math.PI]) {
    const before = stateAtInputTravel(handoff - epsilon);
    const after = stateAtInputTravel(handoff + epsilon);
    assert.ok(
      before.frameTranslation.distanceTo(after.frameTranslation)
        < geometry.pinionPitchRadius * epsilon * 2.1,
      `frame position is continuous at handoff ${handoff}`,
    );
    near(
      before.frameVelocity.x,
      -after.frameVelocity.x,
      2e-15,
      `frame velocity reverses at handoff ${handoff}`,
    );
    assert.notEqual(before.activeRackSide, after.activeRackSide);
    assert.equal(before.engagedRackCount, 1);
    assert.equal(after.engagedRackCount, 1);
    assert.ok(before.minimumInactiveRackClearance > 0);
    assert.ok(after.minimumInactiveRackClearance > 0);
  }
  disposeModel(model.root);
});

test('movement 199 rendered transforms keep the pinion fixed, four lantern pins phased, and guide rollers synchronized', () => {
  const model = createMovementModel(catalog.movements[198]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    geometry,
  } = model.root.userData;

  for (const [name, time] of Object.entries(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = canonicalStates[name];
    vector3Near(
      blocks.rackFrame.position,
      new THREE.Vector3(state.frameTranslation.x, 0, 0),
      2e-15,
      `${name} rendered frame translation`,
    );
    near(
      blocks.lanternPinion.userData.rotor.rotation.z,
      state.pinionAngle,
      2e-15,
      `${name} rendered lantern-pinion angle`,
    );
    near(
      blocks.pinionShaft.userData.rotor.rotation.z,
      state.pinionAngle,
      2e-15,
      `${name} rendered shaft angle`,
    );
    near(blocks.lanternPinion.position.x, 0, 1e-15, `${name} pinion x`);
    near(blocks.lanternPinion.position.y, 0, 1e-15, `${name} pinion y`);
    near(blocks.pinionShaft.position.x, 0, 1e-15, `${name} shaft x`);
    near(blocks.pinionShaft.position.y, 0, 1e-15, `${name} shaft y`);
    blocks.lanternPins.forEach((pin, index) => {
      const renderedCenter = pin.getWorldPosition(new THREE.Vector3());
      vector2Near(
        renderedCenter,
        state.lanternPinCenters[index],
        3e-15,
        `${name} rendered lantern pin ${index}`,
      );
    });
    const renderedContact = blocks.contactMarker.getWorldPosition(
      new THREE.Vector3(),
    );
    vector2Near(
      renderedContact,
      state.contactPoint,
      2e-15,
      `${name} rendered active contact`,
    );

    blocks.guideRollers.forEach((roller, index) => {
      near(
        roller.userData.rotor.rotation.z,
        state.guideRollerAngles[index],
        2e-15,
        `${name} rendered guide angle ${index}`,
      );
      near(
        roller.userData.angularSpeed,
        state.guideRollerAngularSpeeds[index],
        2e-15,
        `${name} guide angular speed ${index}`,
      );
      near(
        roller.position.x,
        roller.userData.horizontalSign * geometry.guideRollerX,
        1e-15,
        `${name} fixed guide x ${index}`,
      );
      near(
        roller.position.y,
        roller.userData.verticalSign * geometry.guideRollerY,
        1e-15,
        `${name} fixed guide y ${index}`,
      );
    });
    const { fixedGuideRollers, partialLanternPinionRackMesh } =
      model.root.userData.contacts;
    fixedGuideRollers.topSurfaceSpeeds.forEach((speed, index) => {
      near(speed, state.frameVelocity.x, 2e-15, `${name} top guide ${index}`);
    });
    fixedGuideRollers.bottomSurfaceSpeeds.forEach((speed, index) => {
      near(speed, state.frameVelocity.x, 2e-15, `${name} bottom guide ${index}`);
    });
    assert.equal(partialLanternPinionRackMesh.engagedRackCount, 1);
    assert.equal(
      partialLanternPinionRackMesh.activeRackSide,
      state.activeRackSide,
    );
    assert.equal(
      partialLanternPinionRackMesh.inactiveRackSide,
      state.inactiveRackSide,
    );
    assert.ok(partialLanternPinionRackMesh.minimumInactiveRackClearance > 0);
    assert.equal(
      partialLanternPinionRackMesh.toothlessHalfFacesInactiveRack,
      true,
    );
  }

  const frameBodyBounds = new THREE.Box3().setFromObject(blocks.rackFrameBody);
  const rackToothBounds = new THREE.Box3();
  [...blocks.topRackTeeth, ...blocks.bottomRackTeeth].forEach((tooth) => {
    rackToothBounds.expandByObject(tooth);
  });
  // Pass 96: the teeth are merged into the frame's one extrusion.
  assert.ok(Math.abs(rackToothBounds.max.z - frameBodyBounds.max.z) < 1e-6);
  assert.ok(rackToothBounds.min.y > frameBodyBounds.min.y);
  assert.ok(rackToothBounds.max.y < frameBodyBounds.max.y);
  disposeModel(model.root);
});

test('movement 199 fills a real 3D envelope as the reviewed queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[198]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.rackFrame,
      blocks.lanternPinion,
      blocks.pinionShaft,
      blocks.pinionBearing,
      ...blocks.guideRollers,
      ...blocks.guideRollerShafts,
      blocks.contactMarker,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 8.5);
  assert.ok(size.y > 4.2, 'the physical frame fills the vertical envelope without oversized pulley index blocks');
  assert.ok(size.z > 1.5);
  assert.ok(physicalBounds.min.z < -0.79);
  assert.ok(physicalBounds.max.z > 0.71);
  let visibleMeshCount = 0;
  let installedPinCount = 0;
  let fixedGuideRollerCount = 0;
  let oversizedEntryToothCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh && object.visible) visibleMeshCount += 1;
    if (object.userData.role
      === 'installed-driving-pin-of-partial-lantern-pinion') {
      installedPinCount += 1;
    }
    if (/fixed-guide-roller-for-reciprocating-frame/.test(
      object.userData.role ?? '',
    )) fixedGuideRollerCount += 1;
    if (/oversized-entry-tooth/.test(object.userData.role ?? '')) {
      oversizedEntryToothCount += 1;
    }
  });
  // The rollers are plain discs and the white indices are hidden, as drawn.
  // The ten tooth witnesses are hidden inside the merged rack extrusion.
  assert.ok(visibleMeshCount >= 29);
  assert.equal(installedPinCount, 4);
  assert.equal(fixedGuideRollerCount, 4);
  assert.equal(oversizedEntryToothCount, 2);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 2);
  assert.ok(blocks.lanternPinion.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.ok(blocks.pinionShaft.userData.axis.distanceTo(Z_AXIS) < 1e-14);
  assert.equal(blocks.sweptEnvelope.visible, false);

  const movement198 = createMovementModel(catalog.movements[197]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement198.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement198.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement200.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement198.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement200.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement198.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});
