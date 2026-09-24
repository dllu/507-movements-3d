import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

test('movement 364 has eight radial friction rollers driving eight oblique rim grooves on a perpendicular shaft', () => {
  const movement = catalog.movements[363];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, curves, degreesOfFreedom } = data;

  assert.equal(movement.id, 364);
  assert.equal(movement.number, '364');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.archetype,
    'perpendicular-axis-eight-roller-oblique-groove-intermittent-indexer',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /eight-radial-friction-rollers/);
  assert.match(data.mechanism, /perpendicular-vertical-axis-wheel/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /continuous rotation/);
  assert.match(degreesOfFreedom.note, /only one roller/);
  assert.match(degreesOfFreedom.note, /dwells/);

  assert.ok(blocks.frame.parent === null, 'source presentation removes the undrawn stand');
  assert.ok(blocks.driverRotor.parent === model.root, 'blocks.driverRotor parent');
  assert.ok(blocks.outputRotor.parent === model.root, 'blocks.outputRotor parent');
  assert.equal(blocks.frame.userData.fixed, true);
  vectorNear(blocks.driverRotor.userData.axis, Z_AXIS, 0,
    'driver axis');
  vectorNear(blocks.outputRotor.userData.axis, Y_AXIS, 0,
    'output axis');
  near(
    Math.abs(blocks.driverRotor.userData.axis.dot(
      blocks.outputRotor.userData.axis,
    )),
    0,
    0,
    'right-angle shaft axes',
  );

  for (const component of [
    blocks.driverDisk,
    blocks.driverHub,
    blocks.driverShaft,
    ...blocks.driverRims,
    ...blocks.rollerMounts,
  ]) assert.ok(component.parent === blocks.driverRotor, `${component.userData.role} parent`);
  for (const component of [
    blocks.outputWheel,
    blocks.outputHub,
    blocks.outputShaft,
    ...blocks.outputEndRims,
    ...blocks.grooveFlanks,
    ...blocks.grooveEntries,
  ]) assert.ok(component.parent === blocks.outputRotor, `${component.userData.role} parent`);
  // Brown draws no white indices or groove marker; the source presentation
  // detaches them.
  for (const component of [blocks.driverIndex, blocks.outputIndex,
    blocks.indexedGrooveMarker, ...blocks.rollerSpinIndexes]) {
    assert.ok(component.parent === null, `${component.userData.role} removed`);
  }
  assert.equal(blocks.rollerMounts.length, 8);
  assert.equal(blocks.radialStuds.length, 8);
  assert.equal(blocks.rollerBodies.length, 8);
  assert.equal(blocks.rollerSpinRotors.length, 8);
  assert.equal(blocks.rollerSpinIndexes.length, 8);
  assert.equal(blocks.grooveFlanks.length, 0);
  assert.equal(blocks.outputWheel.geometry.userData.grooveCount, 8);
  assert.equal(blocks.grooveEntries.length, 0);
  assert.equal(curves.grooveCenterCurves.length, 8);

  const roles = [];
  const belts = [];
  const toothedObjects = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) belts.push(object);
    if (Number.isInteger(object.userData.teeth)) toothedObjects.push(object);
  });
  for (const role of [
    'small-left-hand-continuous-driver-wheel',
    'radial-stud-on-small-driver-wheel',
    'friction-roller-on-one-of-eight-radial-driver-studs',
    'large-horizontal-output-wheel-with-cylindrical-working-face',
    'vertical-output-shaft-fixed-to-intermittent-large-wheel',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.some((role) => role.startsWith('white-')),
    'Brown draws no white indices');
  assert.equal(belts.length, 0);
  assert.equal(toothedObjects.length, 0);
  disposeModel(model.root);
});

test('movement 364 records the unavailable animation, Brown caption, and measured engraving evidence without inventing source timing', () => {
  const movement = catalog.movements[363];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate364;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_364.html');
  assert.match(movement.description, /Intermittent rotary motion/);
  assert.match(movement.description, /axis at right angles/);
  assert.match(movement.description, /friction rollers/);
  assert.match(movement.description, /radial studs/);
  assert.match(movement.description, /oblique grooves or projections/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesInputSpeedOrInertia, false);
  assert.equal(data.dynamics.exactHistoricalGrooveProfileSpecified, false);
  assert.match(data.dynamics.frictionAssumption, /positive friction/);
  assert.match(data.dynamics.frictionAssumption, /absent from Brown/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.driverCenter.toArray(), [111, 259]);
  assert.equal(plate.driverBodyRadiusPixels, 74);
  assert.equal(plate.driverRollerCenters.length, 8);
  assert.deepEqual(plate.driverRollerCenters[0].toArray(), [111, 145]);
  assert.deepEqual(plate.driverRollerCenters[2].toArray(), [190, 259]);
  assert.deepEqual(plate.driverRollerCenters[4].toArray(), [111, 365]);
  assert.equal(plate.outputAxisX, 348);
  assert.equal(plate.outputRimLeftX, 197);
  assert.equal(plate.outputRimRightX, 514);
  assert.equal(plate.outputBandTopY, 216);
  assert.equal(plate.outputBandBottomY, 304);
  assert.equal(plate.visibleNearSideGrooveBranches, 4);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /eight equally spaced/);
  assert.match(evidence.engravingEvidence, /four oblique branches/);
  assert.match(evidence.reconstructionDisclosure, /eight matching output grooves/);
  assert.match(evidence.reconstructionDisclosure, /quintic/);
  assert.match(evidence.reconstructionDisclosure, /neither a section nor an exact groove equation/);
  disposeModel(model.root);
});

test('movement 364 admits exactly one roller contact during every index and an actual dwell between contacts', () => {
  const model = createMovementModel(catalog.movements[363]);
  const data = model.root.userData;
  const { geometry, stateAtDriverAngle, timeline } = data;
  const stateAtEventPhase = (eventIndex, phase) => stateAtDriverAngle(
    (eventIndex + phase) * geometry.rollerPitch,
  );

  near(geometry.contactStartPhase, 0.14, 2e-16,
    'contact start phase');
  near(geometry.contactEndPhase, 0.86, 2e-16,
    'contact end phase');
  near(geometry.contactFraction, 0.72, 3e-16,
    'contact fraction');
  near(
    timeline.contactDurationPerEvent + timeline.dwellDurationPerEvent,
    geometry.inputCyclePeriod / geometry.rollerCount,
    2e-16,
    'one event period',
  );
  assert.equal(timeline.eventsPerInputTurn, 8);

  for (let eventIndex = -8; eventIndex <= 16; eventIndex += 1) {
    const before = stateAtEventPhase(eventIndex, 0.04);
    const entry = stateAtEventPhase(
      eventIndex,
      geometry.contactStartPhase,
    );
    const middle = stateAtEventPhase(eventIndex, 0.5);
    const exit = stateAtEventPhase(
      eventIndex,
      geometry.contactEndPhase,
    );
    const after = stateAtEventPhase(eventIndex, 0.96);
    assert.equal(before.contactCount, 0);
    assert.equal(before.engaged, false);
    assert.match(before.stage, /dwell-before/);
    assert.equal(after.contactCount, 0);
    assert.equal(after.engaged, false);
    assert.match(after.stage, /dwell-after/);
    for (const state of [entry, middle, exit]) {
      assert.equal(state.contactCount, 1);
      assert.equal(state.engaged, true);
      assert.equal(
        state.activeRollerIndex,
        positiveModulo(eventIndex, 8),
      );
      assert.equal(
        state.activeGrooveIndex,
        positiveModulo(eventIndex, 8),
      );
      assert.equal(state.rollerContactWithinBody, true);
    }
  }

  let contactSamples = 0;
  let dwellSamples = 0;
  const contactedRollers = new Set();
  for (let sample = 0; sample < 16000; sample += 1) {
    const state = stateAtDriverAngle(
      geometry.sourceDriverAngle
        + FULL_TURN * 2 * sample / 16000,
    );
    assert.ok(state.contactCount === 0 || state.contactCount === 1);
    if (state.engaged) {
      contactSamples += 1;
      contactedRollers.add(state.activeRollerIndex);
    } else {
      dwellSamples += 1;
      assert.equal(state.activeRollerIndex, null);
      assert.equal(state.activeGrooveIndex, null);
      assert.equal(state.contactPoint, null);
      assert.equal(state.grooveWorldPoint, null);
    }
  }
  assert.ok(contactSamples > 0);
  assert.ok(dwellSamples > 0);
  assert.deepEqual([...contactedRollers].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  disposeModel(model.root);
});

test('movement 364 advances one eighth-turn per roller with exact constant-angle dwells and smooth index boundaries', () => {
  const model = createMovementModel(catalog.movements[363]);
  const data = model.root.userData;
  const { geometry, indexProfile, stateAtDriverAngle } = data;
  const stateAtEventPhase = (eventIndex, phase) => stateAtDriverAngle(
    (eventIndex + phase) * geometry.rollerPitch,
  );

  for (const [progress, displacement, velocity, acceleration] of [
    [0, 0, 0, 0],
    [0.25, 0.103515625, 1.0546875, 5.625],
    [0.5, 0.5, 1.875, 0],
    [0.75, 0.896484375, 1.0546875, -5.625],
    [1, 1, 0, 0],
  ]) {
    near(indexProfile.displacement(progress), displacement, 2e-15,
      `profile displacement at ${progress}`);
    near(indexProfile.velocity(progress), velocity, 2e-15,
      `profile velocity at ${progress}`);
    near(indexProfile.acceleration(progress), acceleration, 2e-14,
      `profile acceleration at ${progress}`);
  }

  for (let eventIndex = -4; eventIndex <= 12; eventIndex += 1) {
    const earlyDwell = stateAtEventPhase(eventIndex, 0.03);
    const lateDwell = stateAtEventPhase(eventIndex, 0.11);
    const entry = stateAtEventPhase(
      eventIndex,
      geometry.contactStartPhase,
    );
    const middle = stateAtEventPhase(eventIndex, 0.5);
    const exit = stateAtEventPhase(
      eventIndex,
      geometry.contactEndPhase,
    );
    const after = stateAtEventPhase(eventIndex, 0.98);
    near(earlyDwell.outputStepCoordinate, eventIndex, 2e-15,
      'early dwell step');
    near(lateDwell.outputAngle, earlyDwell.outputAngle, 0,
      'constant pre-contact dwell angle');
    near(entry.outputStepCoordinate, eventIndex, 2e-15,
      'entry step');
    near(middle.outputStepCoordinate, eventIndex + 0.5, 8e-15,
      'half index');
    near(exit.outputStepCoordinate, eventIndex + 1, 2e-15,
      'exit step');
    near(after.outputStepCoordinate, eventIndex + 1, 2e-15,
      'post-contact dwell step');
    near(after.outputAngle - earlyDwell.outputAngle,
      -geometry.outputPitch, 3e-15, 'one opposite-sense index');
    near(earlyDwell.outputAngularSpeed, 0, 0, 'dwell speed');
    near(entry.outputAngularSpeed, 0, 2e-14, 'entry speed');
    assert.ok(middle.outputAngularSpeed < 0);
    near(exit.outputAngularSpeed, 0, 2e-14, 'exit speed');
    near(entry.outputAngularAcceleration, 0, 2e-12,
      'entry acceleration');
    near(exit.outputAngularAcceleration, 0, 2e-12,
      'exit acceleration');
  }

  const start = stateAtDriverAngle(0);
  const closure = stateAtDriverAngle(FULL_TURN);
  near(closure.outputAngle - start.outputAngle, -FULL_TURN, 2e-15,
    'one output turn per input turn');
  assert.match(data.transmission.averageRatio, /one opposite-sense output revolution/);
  assert.match(data.transmission.dwellLaw, /exactly constant/);
  disposeModel(model.root);
});

test('movement 364 active roller axis and matching groove centerline meet exactly on the output rim', () => {
  const model = createMovementModel(catalog.movements[363]);
  const data = model.root.userData;
  const { geometry, grooveLocalPoint, stateAtDriverAngle } = data;
  const parameters = [0, 0.08, 0.21, 0.5, 0.77, 0.93, 1];

  for (let eventIndex = -8; eventIndex <= 15; eventIndex += 1) {
    for (const parameter of parameters) {
      const rollerAngle = Math.atan(
        (2 * parameter - 1) * Math.tan(geometry.contactHalfAngle),
      );
      const eventPhase = 0.5 + rollerAngle / geometry.rollerPitch;
      const state = stateAtDriverAngle(
        (eventIndex + eventPhase) * geometry.rollerPitch,
      );
      assert.equal(state.engaged, true);
      near(state.grooveParameter, parameter, 8e-15,
        'recovered groove parameter');
      assert.ok(state.contactError < 4e-15,
        `contact error ${state.contactError}`);
      vectorNear(state.contactPoint, state.grooveWorldPoint, 4e-15,
        'roller/groove coincidence');
      near(state.contactPoint.x, -geometry.outputRadius, 2e-15,
        'left output-rim tangent x');
      near(state.contactPoint.z, 0, 2e-15,
        'fixed contact meridian z');
      near(
        state.contactPoint.y,
        geometry.outputCenter.y
          + geometry.driverToOutputTangent * Math.tan(rollerAngle),
        3e-15,
        'contact height',
      );
      const axisResidual = state.contactPoint.clone()
        .sub(geometry.driverCenter)
        .cross(state.rollerAxisDirection)
        .length();
      near(axisResidual, 0, 2e-15, 'point on radial roller axis');
      assert.equal(state.rollerContactWithinBody, true);

      const grooveIndex = positiveModulo(eventIndex, geometry.grooveCount);
      const reconstructed = grooveLocalPoint(grooveIndex, parameter)
        .applyAxisAngle(Y_AXIS, state.outputAngle)
        .add(geometry.outputCenter);
      vectorNear(reconstructed, state.contactPoint, 4e-15,
        'independently transformed groove point');
    }
  }
  disposeModel(model.root);
});

test('movement 364 analytic output rates match finite differences and remain continuous at every dwell boundary', () => {
  const model = createMovementModel(catalog.movements[363]);
  const data = model.root.userData;
  const { geometry, stateAtDriverAngle } = data;
  const firstStep = 1e-6;
  const secondStep = 2e-4;

  for (const parameter of [0.12, 0.28, 0.5, 0.72, 0.88]) {
    const rollerAngle = Math.atan(
      (2 * parameter - 1) * Math.tan(geometry.contactHalfAngle),
    );
    const driverAngle = (3.5 + rollerAngle / geometry.rollerPitch)
      * geometry.rollerPitch;
    const state = stateAtDriverAngle(driverAngle);
    const before = stateAtDriverAngle(driverAngle - firstStep);
    const after = stateAtDriverAngle(driverAngle + firstStep);
    const numericalFirst = (after.outputAngle - before.outputAngle)
      / (2 * firstStep);
    near(numericalFirst, state.outputRatePerDriverRadian, 2e-9,
      `first derivative at groove parameter ${parameter}`);
    const secondBefore = stateAtDriverAngle(driverAngle - secondStep);
    const secondAfter = stateAtDriverAngle(driverAngle + secondStep);
    const numericalSecond = (
      secondAfter.outputAngle - 2 * state.outputAngle
        + secondBefore.outputAngle
    ) / (secondStep * secondStep);
    near(numericalSecond, state.outputSecondRatePerDriverRadian, 2e-5,
      `second derivative at groove parameter ${parameter}`);
    near(
      state.outputAngularSpeed,
      state.outputRatePerDriverRadian * geometry.inputAngularSpeed,
      2e-15,
      'time-scaled angular speed',
    );
    near(
      state.outputAngularAcceleration,
      state.outputSecondRatePerDriverRadian
        * geometry.inputAngularSpeed ** 2,
      2e-14,
      'time-scaled angular acceleration',
    );
  }

  for (let eventIndex = -3; eventIndex <= 10; eventIndex += 1) {
    for (const phase of [
      geometry.contactStartPhase,
      geometry.contactEndPhase,
      1,
    ]) {
      const boundary = (eventIndex + phase) * geometry.rollerPitch;
      const epsilon = 1e-7;
      const before = stateAtDriverAngle(boundary - epsilon);
      const at = stateAtDriverAngle(boundary);
      const after = stateAtDriverAngle(boundary + epsilon);
      assert.ok(Math.abs(after.outputAngle - before.outputAngle) < 2e-12);
      assert.ok(Math.abs(at.outputAngularSpeed) < 3e-13);
      assert.ok(Math.abs(before.outputAngularSpeed) < 2e-8);
      assert.ok(Math.abs(after.outputAngularSpeed) < 2e-8);
    }
  }
  disposeModel(model.root);
});

test('movement 364 groove curves implement the certified profile and each free roller rolls one groove length per input turn', () => {
  const model = createMovementModel(catalog.movements[363]);
  const data = model.root.userData;
  const {
    curves,
    geometry,
    grooveArcLengthAt,
    grooveLocalPoint,
    stateAtDriverAngle,
    stateAtTime,
  } = data;

  assert.ok(geometry.grooveArcLength > 2 * geometry.outputWorkingHalfHeight);
  assert.ok(
    geometry.grooveArcLength
      < 2 * geometry.outputWorkingHalfHeight
        + geometry.outputRadius * geometry.outputPitch,
  );
  near(grooveArcLengthAt(0), 0, 0, 'zero partial groove length');
  near(grooveArcLengthAt(1), geometry.grooveArcLength, 0,
    'full groove length');

  for (let grooveIndex = 0; grooveIndex < geometry.grooveCount;
    grooveIndex += 1) {
    for (const parameter of [0, 0.1, 0.33, 0.5, 0.79, 1]) {
      const fromCurve = curves.grooveCenterCurves[grooveIndex]
        .getPoint(parameter);
      const fromHelper = grooveLocalPoint(grooveIndex, parameter);
      vectorNear(fromCurve, fromHelper, 0,
        'curve/helper agreement');
      near(Math.hypot(fromCurve.x, fromCurve.z), geometry.outputRadius,
        5e-16, 'groove stays on cylindrical rim');
      near(
        fromCurve.y,
        -geometry.outputWorkingHalfHeight
          + 2 * geometry.outputWorkingHalfHeight * parameter,
        3e-16,
        'groove working height',
      );
    }
  }

  const startAngle = geometry.contactStartPhase * geometry.rollerPitch;
  const endAngle = geometry.contactEndPhase * geometry.rollerPitch;
  const start = stateAtDriverAngle(startAngle);
  const end = stateAtDriverAngle(endAngle);
  near(
    end.rollerSpinAngles[0] - start.rollerSpinAngles[0],
    -geometry.grooveArcLength / geometry.rollerRadius,
    2e-15,
    'active roller rolling travel',
  );
  for (let index = 1; index < geometry.rollerCount; index += 1) {
    near(end.rollerSpinAngles[index], start.rollerSpinAngles[index], 0,
      `inactive roller ${index} held`);
  }

  const cycleStart = stateAtTime(0);
  const cycleEnd = stateAtTime(geometry.inputCyclePeriod);
  for (let index = 0; index < geometry.rollerCount; index += 1) {
    near(
      cycleEnd.rollerSpinAngles[index]
        - cycleStart.rollerSpinAngles[index],
      -geometry.grooveArcLength / geometry.rollerRadius,
      4e-14,
      `roller ${index} rolls once per input turn`,
    );
  }
  assert.match(data.dynamics.rollerBearingSpinModel, /groove-centerline arclength/);
  assert.match(data.dynamics.rollerBearingSpinModel, /held/);
  disposeModel(model.root);
});

test('movement 364 renderer preserves contact, perpendicular axes, intermittent motion, and continuous closure over 1,200 frames', () => {
  const model = createMovementModel(catalog.movements[363]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  const contactedRollers = new Set();
  let contactFrames = 0;
  let dwellFrames = 0;
  let largestOutputStep = 0;
  let previousOutputAngle = null;

  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = geometry.inputCyclePeriod * 2 * frame / 1200;
    model.update(time);
    const state = data.currentState;
    near(blocks.driverRotor.rotation.z, state.driverAngle, 0,
      'rendered driver angle');
    near(blocks.outputRotor.rotation.y, state.outputAngle, 0,
      'rendered output angle');
    for (let index = 0; index < geometry.rollerCount; index += 1) {
      near(
        blocks.rollerSpinRotors[index].rotation.y,
        state.rollerSpinAngles[index],
        0,
        `rendered roller ${index} spin`,
      );
    }
    near(data.contacts.perpendicularShafts.axisDot, 0, 0,
      'rendered right-angle axes');
    if (state.engaged) {
      contactFrames += 1;
      contactedRollers.add(state.activeRollerIndex);
      assert.equal(data.contacts.rollerToObliqueGroove.contactCount, 1);
      assert.ok(data.contacts.rollerToObliqueGroove.contactError < 5e-15);
      assert.equal(
        data.contacts.rollerToObliqueGroove.rollerContactWithinBody,
        true,
      );
    } else {
      dwellFrames += 1;
      assert.equal(data.contacts.rollerToObliqueGroove.contactCount, 0);
    }
    if (previousOutputAngle !== null) {
      largestOutputStep = Math.max(
        largestOutputStep,
        Math.abs(state.outputAngle - previousOutputAngle),
      );
    }
    previousOutputAngle = state.outputAngle;
    if (frame % 100 === 0) {
      model.root.updateMatrixWorld(true);
      model.root.traverse((object) => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      });
    }
  }
  assert.ok(contactFrames > 0);
  assert.ok(dwellFrames > 0);
  assert.ok(largestOutputStep < 0.028);
  assert.deepEqual([...contactedRollers].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);

  const start = data.stateAtTime(0);
  const closure = data.stateAtTime(geometry.inputCyclePeriod);
  near(closure.driverAngle - start.driverAngle, FULL_TURN, 2e-15,
    'driver closure');
  near(closure.outputAngle - start.outputAngle, -FULL_TURN, 2e-15,
    'output closure');
  near(closure.eventPhase, start.eventPhase, 2e-15,
    'event phase closure');
  assert.equal(closure.activeRollerIndex, start.activeRollerIndex);
  assert.equal(closure.activeGrooveIndex, start.activeGrooveIndex);
  disposeModel(model.root);
});

test('movement 364 is the reviewed frontier and movement 507 remains authored', () => {
  const movement364 = catalog.movements[363];
  const movement507 = catalog.movements[506];
  const model364 = createMovementModel(movement364);
  const model507 = createMovementModel(movement507);

  assert.equal(movement364.id, 364);
  assert.equal(movement364.fidelity, 'authored');
  assert.equal(model364.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model364.root);
  disposeModel(model507.root);
});
