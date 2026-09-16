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

function moduloAngle(value) {
  return THREE.MathUtils.euclideanModulo(value, FULL_TURN);
}

test('movement 205 is two coaxial cams driving two alternating eleven-tooth axial rows', () => {
  const movement = catalog.movements[204];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnchors,
    sourceAnimation,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 205);
  assert.equal(movement.number, '205');
  assert.equal(
    movement.title,
    'Two-Cam Involute Pinion and Alternating Double-Row Wheel',
  );
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(
    movement.description,
    '205. Represents a wheel driven by a pinion of two teeth. The pinion consists in reality of two cams, which gear with two distinct series of teeth on opposite sides of the wheel, the teeth of one series alternating in position with those of the other.',
  );
  assert.equal(
    movement.archetype,
    'split-two-cam-two-plane-involute-pinion-alternating-double-row-wheel',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'two-axially-separated-single-lobe-involute-cams-mesh-with-eleven-teeth-per-alternating-wheel-face',
  );
  assert.equal(
    model.root.userData.variant,
    'twenty-degree-two-to-twenty-two-equivalent-involute-train-with-minus-one-eleventh-output',
  );

  assert.equal(blocks.driver.parent, model.root);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.inputShaft.parent, model.root);
  assert.equal(blocks.outputShaft.parent, model.root);
  assert.equal(blocks.camMeshes.length, 2);
  assert.equal(blocks.camHubs.length, 2);
  assert.equal(blocks.camTipIndexes.length, 2);
  assert.equal(blocks.wheelRows.length, 2);
  assert.equal(blocks.contactMarkers.length, 4);
  assert.equal(blocks.baseRails.length, 4);
  assert.equal(blocks.rearUprights.length, 2);
  assert.equal(blocks.bearingBridges.length, 2);
  assert.equal(blocks.bearingRings.length, 2);
  assert.equal(blocks.inputShaft.userData.keyedToBothCams, true);
  assert.equal(blocks.outputShaft.userData.keyedToWheel, true);

  blocks.camMeshes.forEach((cam, index) => {
    assert.equal(cam.parent, blocks.driver.userData.rotor);
    assert.equal(cam.userData.camIndex, index);
    assert.equal(cam.userData.exactInvoluteFlanks, true);
    assert.equal(cam.userData.axialPlane, cam.position.z);
    assert.equal(blocks.camHubs[index].parent, blocks.driver.userData.rotor);
    assert.equal(blocks.camTipIndexes[index].parent, blocks.driver.userData.rotor);
  });
  blocks.wheelRows.forEach((row, rowIndex) => {
    assert.equal(row.parent, blocks.wheel.userData.rotor);
    assert.equal(row.userData.rowIndex, rowIndex);
    assert.equal(row.userData.teeth.length, 11);
    row.userData.teeth.forEach((tooth, toothIndex) => {
      assert.equal(tooth.parent, row);
      assert.equal(tooth.userData.rowIndex, rowIndex);
      assert.equal(tooth.userData.toothIndex, toothIndex);
      assert.equal(tooth.userData.exactInvoluteFlanks, true);
    });
  });
  assert.equal(blocks.wheelBody.parent, blocks.wheel.userData.rotor);
  assert.equal(blocks.wheelHub.parent, blocks.wheel.userData.rotor);
  assert.equal(blocks.wheelRotationIndex.parent, blocks.wheel.userData.rotor);
  blocks.wheelFaceRims.forEach((rim) => {
    assert.equal(rim.parent, blocks.wheel.userData.rotor);
  });

  assert.equal(transmission.nominalPinionTeeth, 2);
  assert.equal(transmission.combinedWheelTeeth, 22);
  assert.equal(transmission.teethPerRow, 11);
  assert.equal(transmission.axialCamCount, 2);
  assert.equal(transmission.axialToothRowCount, 2);
  assert.equal(transmission.continuousConjugateContact, true);
  assert.equal(transmission.constantSourceAnimatedRatio, true);
  assert.equal(transmission.minimumSimultaneousContactCount, 2);
  assert.equal(transmission.maximumSimultaneousContactCount, 3);
  near(transmission.angularRatio, -1 / 11, 0, 'two-to-twenty-two ratio');
  near(
    transmission.outputAngularSpeed,
    transmission.inputAngularSpeed * transmission.angularRatio,
    0,
    'output angular speed',
  );

  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.combinedWheelPositionCount, 22);
  assert.equal(sourceAnimation.teethPerAxialRow, 11);
  assert.equal(sourceAnimation.twoCamPhaseOffset, Math.PI);
  assert.equal(sourceAnimation.outputTurnsPerCycle, -1 / 11);
  assert.equal(sourceAnimation.continuousOutput, true);
  assert.deepEqual(sourceRaster.imageSize.toArray(), [525, 525]);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.deepEqual(sourceAnchors.wheelCenter.toArray(), [262, 204]);
  assert.deepEqual(sourceAnchors.driverCenter.toArray(), [262, 425]);
  near(sourceRaster.centerDistancePixels, 221, 0, 'source center distance');

  const roleCounts = {
    beltsOrPulleys: 0,
    cams: 0,
    contactMarkers: 0,
    frontTeeth: 0,
    rearTeeth: 0,
    wheelRows: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/belt|pulley|guide pulley|rack|ratchet|worm/i.test(role)) {
      roleCounts.beltsOrPulleys += 1;
    }
    if (/single-lobe-involute-cam-for/.test(role)) roleCounts.cams += 1;
    if (role === 'instantaneous-involute-cam-to-wheel-contact') {
      roleCounts.contactMarkers += 1;
    }
    if (role === 'one-tooth-in-front-alternating-series') {
      roleCounts.frontTeeth += 1;
    }
    if (role === 'one-tooth-in-rear-alternating-series') {
      roleCounts.rearTeeth += 1;
    }
    if (/row-of-eleven-involute-teeth/.test(role)) roleCounts.wheelRows += 1;
  });
  assert.deepEqual(roleCounts, {
    beltsOrPulleys: 0,
    cams: 2,
    contactMarkers: 4,
    frontTeeth: 11,
    rearTeeth: 11,
    wheelRows: 2,
  });
  disposeModel(model.root);
});

test('movement 205 builds exact twenty-degree involutes and half-pitch alternating tooth rows', () => {
  const model = createMovementModel(catalog.movements[204]);
  const { blocks, geometry } = model.root.userData;
  const {
    camInitialPhases,
    camLeftFlank,
    camRightFlank,
    centerDistance,
    combinedAngularPitch,
    driverCenter,
    flankSampleCount,
    involuteAngle,
    involuteAtPitch,
    module,
    nominalPinionTeeth,
    pinionBaseHalfToothAngle,
    pinionBaseRadius,
    pinionLobeRootRadius,
    pinionLobeTipRadius,
    pinionPitchRadius,
    pinionRootInvoluteParameter,
    pinionTipInvoluteParameter,
    pressureAngle,
    rowAngularPitch,
    rowAxialPositions,
    rowInitialPhases,
    rowPhaseOffset,
    teethPerRow,
    wheelBaseHalfToothAngle,
    wheelBaseRadius,
    wheelCenter,
    wheelHalfToothAngleAtParameter,
    wheelOuterRadius,
    wheelPitchRadius,
    wheelRadiusAtInvoluteParameter,
    wheelRootRadius,
    wheelTipHalfToothAngle,
    wheelTipInvoluteParameter,
    wheelToothLowerFlank,
    wheelToothUpperFlank,
  } = geometry;

  near(module, 0.3, 0, 'module');
  assert.equal(nominalPinionTeeth, 2);
  assert.equal(teethPerRow, 11);
  near(pressureAngle, THREE.MathUtils.degToRad(20), 0, 'pressure angle');
  near(pinionPitchRadius, module * nominalPinionTeeth / 2, 0, 'pinion pitch radius');
  near(wheelPitchRadius, module * 22 / 2, 0, 'wheel pitch radius');
  near(centerDistance, pinionPitchRadius + wheelPitchRadius, 0, 'center distance');
  near(driverCenter.distanceTo(wheelCenter), centerDistance, 5e-16, 'placed center distance');
  near(pinionBaseRadius, pinionPitchRadius * Math.cos(pressureAngle), 0, 'pinion base radius');
  near(wheelBaseRadius, wheelPitchRadius * Math.cos(pressureAngle), 0, 'wheel base radius');
  near(
    FULL_TURN * pinionBaseRadius / nominalPinionTeeth,
    FULL_TURN * wheelBaseRadius / 22,
    5e-16,
    'equal base pitch',
  );
  near(involuteAtPitch, Math.tan(pressureAngle) - pressureAngle, 0, 'pitch involute');
  near(
    pinionBaseHalfToothAngle,
    Math.PI / 4 + involuteAtPitch,
    0,
    'pinion base half-tooth angle',
  );
  near(
    wheelBaseHalfToothAngle,
    Math.PI / 44 + involuteAtPitch,
    0,
    'wheel base half-tooth angle',
  );
  assert.equal(pinionRootInvoluteParameter, 0);
  near(pinionLobeRootRadius, pinionBaseRadius, 0, 'cam starts on base circle');
  near(
    involuteAngle(pinionTipInvoluteParameter),
    pinionBaseHalfToothAngle + Math.PI / 2,
    5e-16,
    'cam tip terminates on its symmetry axis',
  );
  near(
    pinionLobeTipRadius,
    pinionBaseRadius * Math.hypot(1, pinionTipInvoluteParameter),
    0,
    'cam tip radius',
  );

  assert.equal(camRightFlank.length, flankSampleCount + 1);
  assert.equal(camLeftFlank.length, flankSampleCount + 1);
  camRightFlank.forEach((rightPoint, index) => {
    const parameter = THREE.MathUtils.lerp(
      pinionRootInvoluteParameter,
      pinionTipInvoluteParameter,
      index / flankSampleCount,
    );
    const radius = pinionBaseRadius * Math.hypot(1, parameter);
    const angle = involuteAngle(parameter) - pinionBaseHalfToothAngle;
    const expectedRight = new THREE.Vector2(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
    );
    vector2Near(rightPoint, expectedRight, 2e-16, `right cam flank ${index}`);
    vector2Near(
      camLeftFlank[index],
      new THREE.Vector2(-rightPoint.x, rightPoint.y),
      0,
      `mirrored left cam flank ${index}`,
    );
  });
  near(camRightFlank.at(-1).x, 0, 4e-16, 'right flank reaches cam tip');
  near(camRightFlank.at(-1).y, pinionLobeTipRadius, 4e-16, 'right cam tip radius');
  near(camLeftFlank.at(-1).x, 0, 4e-16, 'left flank reaches cam tip');

  near(wheelRootRadius, module * 10, 0, 'wheel root radius');
  near(wheelTipInvoluteParameter, 0.4, 0, 'wheel tip involute parameter');
  near(
    wheelOuterRadius,
    wheelBaseRadius * Math.hypot(1, wheelTipInvoluteParameter),
    0,
    'wheel outer radius',
  );
  near(
    wheelTipHalfToothAngle,
    wheelBaseHalfToothAngle - involuteAngle(wheelTipInvoluteParameter),
    0,
    'wheel tip half-tooth angle',
  );
  assert.equal(wheelToothLowerFlank.length, flankSampleCount + 1);
  assert.equal(wheelToothUpperFlank.length, flankSampleCount + 1);
  wheelToothLowerFlank.forEach((lowerPoint, index) => {
    const parameter = wheelTipInvoluteParameter * index / flankSampleCount;
    const radius = wheelRadiusAtInvoluteParameter(parameter);
    const halfAngle = wheelHalfToothAngleAtParameter(parameter);
    vector2Near(
      lowerPoint,
      new THREE.Vector2(radius * Math.cos(-halfAngle), radius * Math.sin(-halfAngle)),
      2e-16,
      `wheel lower flank ${index}`,
    );
    vector2Near(
      wheelToothUpperFlank[index],
      new THREE.Vector2(lowerPoint.x, -lowerPoint.y),
      2e-16,
      `wheel upper flank ${index}`,
    );
  });

  assert.deepEqual(camInitialPhases, [0, Math.PI]);
  near(camInitialPhases[1] - camInitialPhases[0], Math.PI, 0, 'opposed cams');
  near(rowAxialPositions[0], -rowAxialPositions[1], 0, 'opposed axial planes');
  assert.ok(rowAxialPositions[0] < 0 && rowAxialPositions[1] > 0);
  near(rowAngularPitch, FULL_TURN / 11, 0, 'eleven-tooth row pitch');
  near(combinedAngularPitch, FULL_TURN / 22, 0, 'combined tooth pitch');
  near(rowPhaseOffset, combinedAngularPitch, 0, 'half-row-pitch phase offset');
  near(rowInitialPhases[0] - rowInitialPhases[1], rowPhaseOffset, 1e-16, 'row phase displacement');

  const combinedCenters = blocks.wheelRows.flatMap((row, rowIndex) => {
    near(row.position.z, rowAxialPositions[rowIndex], 0, `row ${rowIndex} axial position`);
    return row.userData.teeth.map((tooth, toothIndex) => {
      const expected = rowInitialPhases[rowIndex] + toothIndex * rowAngularPitch;
      near(tooth.rotation.z, expected, 0, `row ${rowIndex} tooth ${toothIndex} rotation`);
      near(tooth.userData.centerAngle, expected, 0, `row ${rowIndex} tooth ${toothIndex} center`);
      return moduloAngle(expected);
    });
  }).sort((left, right) => left - right);
  assert.equal(combinedCenters.length, 22);
  combinedCenters.forEach((angle, index) => {
    const next = index === combinedCenters.length - 1
      ? combinedCenters[0] + FULL_TURN
      : combinedCenters[index + 1];
    near(next - angle, combinedAngularPitch, 2e-15, `combined pitch gap ${index}`);
  });
  disposeModel(model.root);
});

test('movement 205 maintains continuous exact conjugate contact through 32,769 states over a full train closure', () => {
  const model = createMovementModel(catalog.movements[204]);
  const {
    contactCandidateAtDriverAngle,
    geometry,
    stateAtDriverAngle,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  const maxima = {
    baseRoll: 0,
    line: 0,
    normalVelocity: 0,
    profile: 0,
    toothCenter: 0,
    wheelParameter: 0,
  };
  const contactCountHistogram = new Map();
  const seenCamIndices = new Set();
  const seenFlanks = new Set();
  const seenTeethByRow = [new Set(), new Set()];
  let accumulatedContactCount = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const driverAngle = FULL_TURN * 11 * index / sampleCount;
    const driverAngularVelocity = transmission.inputAngularSpeed * (
      0.15 + 0.85 * Math.cos(driverAngle * 0.137)
    );
    const state = stateAtDriverAngle(driverAngle, driverAngularVelocity);
    if (index % 2048 === 0) finiteStateNumbers(state, `state[${index}]`);
    near(state.outputAngle, driverAngle * transmission.angularRatio, 0, `output angle ${index}`);
    near(
      state.outputAngularSpeed,
      driverAngularVelocity * transmission.angularRatio,
      0,
      `output speed ${index}`,
    );
    assert.ok(state.contactCount >= 2 && state.contactCount <= 3);
    assert.equal(state.contacts.length, state.contactCount);
    assert.equal(state.candidates.length, 4);
    assert.equal(new Set(state.candidates.map(({ key }) => key)).size, 4);
    near(state.pitchLineSpeedError, 0, 2e-16, `pitch speed ${index}`);
    accumulatedContactCount += state.contactCount;
    contactCountHistogram.set(
      state.contactCount,
      (contactCountHistogram.get(state.contactCount) ?? 0) + 1,
    );

    for (const contact of state.contacts) {
      seenCamIndices.add(contact.camIndex);
      seenFlanks.add(contact.flank);
      seenTeethByRow[contact.rowIndex].add(contact.toothIndex);
      assert.equal(contact.rowIndex, contact.camIndex);
      assert.equal(contact.axialPlane, geometry.rowAxialPositions[contact.camIndex]);
      near(contact.point.z, contact.axialPlane, 0, `contact plane ${index}`);
      assert.ok(contact.parameter >= -1e-15);
      assert.ok(contact.parameter <= geometry.pinionTipInvoluteParameter + 1e-15);
      assert.ok(contact.wheelInvoluteParameter >= -1e-15);
      assert.ok(contact.wheelInvoluteParameter <= geometry.wheelTipInvoluteParameter + 1e-15);
      assert.ok(Number.isInteger(contact.toothIndex));
      assert.ok(contact.toothIndex >= 0 && contact.toothIndex < 11);
      vector3Near(contact.point, contact.wheelProfilePoint, 5e-15, `coincident profiles ${index}`);
      maxima.profile = Math.max(maxima.profile, contact.profileCoincidenceError);
      maxima.line = Math.max(maxima.line, contact.lineOfActionResidual);
      maxima.normalVelocity = Math.max(maxima.normalVelocity, contact.normalVelocityError);
      maxima.baseRoll = Math.max(maxima.baseRoll, contact.baseRollError);
      maxima.toothCenter = Math.max(maxima.toothCenter, contact.toothCenterPhaseError);
      maxima.wheelParameter = Math.max(
        maxima.wheelParameter,
        Math.abs(
          contact.wheelInvoluteParameter
            - contact.expectedWheelInvoluteParameter,
        ),
      );
      near(
        contact.relativeSurfaceVelocity.dot(contact.lineOfActionDirection),
        0,
        2.2e-15,
        `zero relative normal velocity ${index}`,
      );
      near(
        contact.slidingSpeed,
        contact.relativeSurfaceVelocity.length(),
        0,
        `tangential sliding magnitude ${index}`,
      );
      const independentlyEvaluated = contactCandidateAtDriverAngle(
        driverAngle,
        contact.camIndex,
        contact.flank,
        driverAngularVelocity,
      );
      assert.equal(independentlyEvaluated.active, true);
      assert.equal(independentlyEvaluated.key, contact.key);
      vector3Near(
        independentlyEvaluated.point,
        contact.point,
        0,
        `independent contact ${index}`,
      );
    }
  }

  assert.deepEqual([...contactCountHistogram.keys()].sort(), [2, 3]);
  assert.deepEqual([...seenCamIndices].sort(), [0, 1]);
  assert.deepEqual([...seenFlanks].sort(), ['left', 'right']);
  assert.deepEqual([...seenTeethByRow[0]].sort((a, b) => a - b), Array.from({ length: 11 }, (_, i) => i));
  assert.deepEqual([...seenTeethByRow[1]].sort((a, b) => a - b), Array.from({ length: 11 }, (_, i) => i));
  near(
    accumulatedContactCount / (sampleCount + 1),
    transmission.meanSimultaneousContactCount,
    8e-5,
    'mean simultaneous contact count',
  );
  assert.ok(maxima.profile <= 4.2e-15, `maximum profile error ${maxima.profile}`);
  assert.ok(maxima.line <= 1.8e-15, `maximum line error ${maxima.line}`);
  assert.ok(maxima.normalVelocity <= 2.2e-15, `maximum normal velocity ${maxima.normalVelocity}`);
  assert.ok(maxima.baseRoll <= 3.2e-14, `maximum base-roll error ${maxima.baseRoll}`);
  assert.ok(maxima.toothCenter <= 1.4e-15, `maximum tooth-center error ${maxima.toothCenter}`);
  assert.ok(maxima.wheelParameter <= 1.5e-14, `maximum wheel parameter error ${maxima.wheelParameter}`);
  disposeModel(model.root);
});

test('movement 205 has impact-free handoffs, the exact minus-one-eleventh rate, and eleven-turn closure', () => {
  const model = createMovementModel(catalog.movements[204]);
  const {
    blocks,
    canonicalTimes,
    contactCandidateAtDriverAngle,
    geometry,
    stateAtDriverAngle,
    stateAtTime,
    transmission,
  } = model.root.userData;

  const canonicalContacts = [
    [0, ['cam-0-left', 'cam-0-right']],
    [Math.PI / 2, ['cam-0-right', 'cam-1-left']],
    [Math.PI, ['cam-1-left', 'cam-1-right']],
    [Math.PI * 3 / 2, ['cam-0-left', 'cam-1-right']],
    [FULL_TURN, ['cam-0-left', 'cam-0-right']],
  ];
  for (const [driverAngle, expectedKeys] of canonicalContacts) {
    const state = stateAtDriverAngle(driverAngle);
    assert.deepEqual(state.contacts.map(({ key }) => key).sort(), expectedKeys);
  }

  const epsilon = 1e-9;
  for (let camIndex = 0; camIndex < 2; camIndex += 1) {
    const camPhase = geometry.camInitialPhases[camIndex];
    for (const flank of ['right', 'left']) {
      const entryAngle = flank === 'right'
        ? geometry.contactPhaseConstant - camPhase
          - geometry.pinionTipInvoluteParameter
        : -geometry.contactPhaseConstant - camPhase;
      const exitAngle = flank === 'right'
        ? geometry.contactPhaseConstant - camPhase
        : geometry.pinionTipInvoluteParameter
          - geometry.contactPhaseConstant - camPhase;
      const outsideBefore = contactCandidateAtDriverAngle(
        entryAngle - epsilon,
        camIndex,
        flank,
      );
      const atEntry = contactCandidateAtDriverAngle(entryAngle, camIndex, flank);
      const insideAfter = contactCandidateAtDriverAngle(
        entryAngle + epsilon,
        camIndex,
        flank,
      );
      const insideBeforeExit = contactCandidateAtDriverAngle(
        exitAngle - epsilon,
        camIndex,
        flank,
      );
      const atExit = contactCandidateAtDriverAngle(exitAngle, camIndex, flank);
      const outsideAfter = contactCandidateAtDriverAngle(
        exitAngle + epsilon,
        camIndex,
        flank,
      );
      assert.equal(outsideBefore.active, false, `${camIndex} ${flank} outside before entry`);
      assert.equal(atEntry.active, true, `${camIndex} ${flank} entry included`);
      assert.equal(insideAfter.active, true, `${camIndex} ${flank} inside after entry`);
      assert.equal(insideBeforeExit.active, true, `${camIndex} ${flank} inside before exit`);
      assert.equal(atExit.active, true, `${camIndex} ${flank} exit included`);
      assert.equal(outsideAfter.active, false, `${camIndex} ${flank} outside after exit`);
      near(atEntry.normalVelocityError, 0, 6e-16, `${camIndex} ${flank} entry normal velocity`);
      near(atExit.normalVelocityError, 0, 6e-16, `${camIndex} ${flank} exit normal velocity`);
      assert.ok(atEntry.profileCoincidenceError <= 9e-16);
      assert.ok(atExit.profileCoincidenceError <= 9e-16);
    }
  }

  const timeStep = 1e-5;
  for (const phase of [0.03, 0.19, 0.41, 0.68, 0.93]) {
    const time = phase * transmission.inputCyclePeriod;
    const previous = stateAtTime(time - timeStep);
    const current = stateAtTime(time);
    const next = stateAtTime(time + timeStep);
    near(current.driverAngle, phase * FULL_TURN, 2e-15, `driver phase ${phase}`);
    near(
      (next.driverAngle - previous.driverAngle) / (2 * timeStep),
      transmission.inputAngularSpeed,
      5e-11,
      `driver derivative ${phase}`,
    );
    near(
      (next.outputAngle - previous.outputAngle) / (2 * timeStep),
      transmission.outputAngularSpeed,
      5e-11,
      `output derivative ${phase}`,
    );
  }

  const stopped = stateAtDriverAngle(1.73, 0);
  assert.equal(stopped.driverAngularSpeed, 0);
  assert.equal(stopped.outputAngularSpeed, -0);
  stopped.contacts.forEach((contact) => {
    assert.equal(contact.slidingSpeed, 0);
    assert.equal(contact.normalVelocityError, 0);
  });
  near(
    stateAtDriverAngle(FULL_TURN).outputAngle,
    -geometry.rowAngularPitch,
    0,
    'one input turn advances one tooth in either eleven-tooth row',
  );
  near(
    stateAtDriverAngle(FULL_TURN * 11).outputAngle,
    -FULL_TURN,
    1e-15,
    'eleven input turns close the wheel',
  );
  near(
    canonicalTimes.elevenInputTurns,
    transmission.inputCyclePeriod * 11,
    0,
    'full-train closure time',
  );

  const worldPositionAt = (object, time) => {
    model.update(time);
    model.root.updateMatrixWorld(true);
    return object.getWorldPosition(new THREE.Vector3());
  };
  const camIndex = blocks.camTipIndexes[0];
  const camSource = worldPositionAt(camIndex, canonicalTimes.sourcePose);
  const camQuarter = worldPositionAt(camIndex, canonicalTimes.quarterInputTurn);
  const camClosure = worldPositionAt(camIndex, canonicalTimes.oneInputTurn);
  assert.ok(camSource.distanceTo(camQuarter) > 1.4, 'painted cam tip makes input spin visible');
  vector3Near(camClosure, camSource, 2e-15, 'cam index closes after one input turn');

  const wheelIndex = blocks.wheelRotationIndex;
  const wheelSource = worldPositionAt(wheelIndex, canonicalTimes.sourcePose);
  const wheelOneInputTurn = worldPositionAt(wheelIndex, canonicalTimes.oneInputTurn);
  const wheelClosure = worldPositionAt(wheelIndex, canonicalTimes.elevenInputTurns);
  assert.ok(wheelSource.distanceTo(wheelOneInputTurn) > 0.6, 'painted wheel index exposes slow output');
  vector3Near(wheelClosure, wheelSource, 3e-15, 'wheel index closes after eleven input turns');
  disposeModel(model.root);
});

test('movement 205 runtime binds every marker and rotor to exact state while movement 206 is independently authored', () => {
  const model = createMovementModel(catalog.movements[204]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const markerByKey = new Map(blocks.contactMarkers.map((marker) => [
    marker.userData.contactKey,
    marker,
  ]));

  for (const time of [
    ...Object.values(canonicalTimes),
    transmission.inputCyclePeriod * 0.083,
    transmission.inputCyclePeriod * 0.337,
    transmission.inputCyclePeriod * 0.614,
    transmission.inputCyclePeriod * 1.783,
  ]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.driver.userData.rotor.rotation.z, state.driverAngle, 1e-15, 'runtime cam angle');
    near(blocks.inputShaft.userData.rotor.rotation.z, state.driverAngle, 1e-15, 'runtime input-shaft angle');
    near(blocks.wheel.userData.rotor.rotation.z, state.outputAngle, 1e-15, 'runtime wheel angle');
    near(blocks.outputShaft.userData.rotor.rotation.z, state.outputAngle, 1e-15, 'runtime output-shaft angle');
    assert.equal(blocks.driver.userData.angularSpeed, state.driverAngularSpeed);
    assert.equal(blocks.inputShaft.userData.angularSpeed, state.driverAngularSpeed);
    assert.equal(blocks.wheel.userData.angularSpeed, state.outputAngularSpeed);
    assert.equal(blocks.outputShaft.userData.angularSpeed, state.outputAngularSpeed);
    assert.equal(model.root.userData.contacts.length, state.contactCount);
    assert.equal(blocks.contactMarkers.filter(({ visible }) => visible).length, state.contactCount);
    state.candidates.forEach((candidate) => {
      const marker = markerByKey.get(candidate.key);
      assert.ok(marker);
      assert.equal(marker.visible, candidate.active);
      if (candidate.active) {
        vector3Near(marker.position, candidate.point, 1e-15, `runtime marker ${candidate.key}`);
      }
    });
  }

  near(
    Math.atan2(blocks.wheelRotationIndex.position.y, blocks.wheelRotationIndex.position.x),
    geometry.wheelIndexInitialAngle,
    1e-15,
    'wheel index center is radial',
  );
  near(
    blocks.wheelRotationIndex.rotation.z,
    geometry.wheelIndexInitialAngle,
    0,
    'wheel index bar is radial',
  );
  model.update(canonicalTimes.sourcePose);
  model.root.updateMatrixWorld(true);
  const physicalBounds = new THREE.Box3().setFromObject(model.root);
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 8.2 && size.x < 8.3);
  assert.ok(size.y > 8.3 && size.y < 8.5);
  assert.ok(size.z > 2.2 && size.z < 2.4);
  assert.ok(physicalBounds.min.x < -4.1);
  assert.ok(physicalBounds.max.x > 4.1);
  assert.ok(physicalBounds.min.y < -3.7);
  assert.ok(physicalBounds.max.y > 4.5);
  let visibleMeshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh && object.visible) visibleMeshCount += 1;
  });
  assert.ok(visibleMeshCount >= 45);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y < 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 2);

  const nextMovement = catalog.movements[205];
  const nextModel = createMovementModel(nextMovement);
  assert.equal(nextMovement.id, 206);
  assert.equal(nextMovement.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(nextModel.root.userData.mechanism, model.root.userData.mechanism);
  const followingMovement = catalog.movements[206];
  const followingModel = createMovementModel(followingMovement);
  assert.equal(followingMovement.id, 207);
  assert.equal(followingMovement.fidelity, 'authored');
  assert.equal(followingModel.root.userData.fidelity, 'authored');
  assert.notEqual(followingModel.root.userData.archetype, model.root.userData.archetype);
  const pendingMovement = catalog.movements[207];
  const pendingModel = createMovementModel(pendingMovement);
  assert.equal(pendingMovement.id, 208);
  assert.equal(pendingMovement.fidelity, 'authored');
  assert.equal(pendingModel.root.userData.fidelity, 'authored');
  assert.notEqual(pendingModel.root.userData.archetype,
    model.root.userData.archetype);
  const queuedMovement = catalog.movements[208];
  const queuedModel = createMovementModel(queuedMovement);
  assert.equal(queuedMovement.id, 209);
  assert.equal(queuedMovement.fidelity, 'authored');
  assert.equal(queuedModel.root.userData.fidelity, 'authored');
  const nextQueuedMovement = catalog.movements[209];
  const nextQueuedModel = createMovementModel(nextQueuedMovement);
  assert.equal(nextQueuedMovement.id, 210);
  assert.equal(nextQueuedMovement.fidelity, 'authored');
  assert.equal(nextQueuedModel.root.userData.fidelity, 'authored');
  const finalQueuedMovement = catalog.movements[210];
  const finalQueuedModel = createMovementModel(finalQueuedMovement);
  assert.equal(finalQueuedMovement.id, 211);
  assert.equal(finalQueuedMovement.fidelity, 'authored');
  assert.equal(finalQueuedModel.root.userData.fidelity, 'authored');
  const reviewedMovement = catalog.movements[211];
  const reviewedModel = createMovementModel(reviewedMovement);
  assert.equal(reviewedMovement.id, 212);
  assert.equal(reviewedMovement.fidelity, 'authored');
  assert.equal(reviewedModel.root.userData.fidelity, 'authored');
  const finalReviewedMovement = catalog.movements[215];
  const finalReviewedModel = createMovementModel(finalReviewedMovement);
  assert.equal(finalReviewedMovement.id, 216);
  assert.equal(finalReviewedMovement.fidelity, 'authored');
  assert.equal(finalReviewedModel.root.userData.fidelity, 'authored');
  const unreviewedMovement = catalog.movements[506];
  const unreviewedModel = createMovementModel(unreviewedMovement);
  assert.equal(unreviewedMovement.id, 507);
  assert.equal(unreviewedMovement.fidelity, 'authored');
  assert.equal(unreviewedModel.root.userData.fidelity, 'authored');
  disposeModel(unreviewedModel.root);
  disposeModel(finalReviewedModel.root);
  disposeModel(reviewedModel.root);
  disposeModel(finalQueuedModel.root);
  disposeModel(nextQueuedModel.root);
  disposeModel(queuedModel.root);
  disposeModel(pendingModel.root);
  disposeModel(followingModel.root);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});
