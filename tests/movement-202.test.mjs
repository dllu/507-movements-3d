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

function radialDistanceToLine(point, center, axis) {
  const offset = point.clone().sub(center);
  return offset.addScaledVector(axis, -offset.dot(axis)).length();
}

test('movement 202 is Brown\'s single-start hourglass worm enveloping a sixty-tooth wheel', () => {
  const movement = catalog.movements[201];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnchors,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 202);
  assert.equal(movement.number, '202');
  assert.equal(movement.title, 'Globoidal Worm and Wheel');
  assert.equal(movement.category, 'Worm gearing');
  assert.equal(
    movement.description,
    '202. Worm or endless screw and worm-wheel. Modification of 31, used when steadiness or great power is required.',
  );
  assert.equal(
    movement.archetype,
    'single-start-globoidal-worm-multi-contact-enveloping-wheel',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'single-start-hourglass-Hindley-worm-envelops-sixty-tooth-wheel-at-eleven-or-twelve-simultaneous-contacts',
  );
  assert.equal(
    model.root.userData.variant,
    'concave-pitch-meridian-generated-from-wheel-circle-for-steady-high-power-line-contact',
  );

  assert.equal(blocks.worm.parent, model.root);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.wormShaft.parent, model.root);
  assert.equal(blocks.wheelShaft.parent, model.root);
  assert.equal(blocks.wormBody.parent, blocks.worm.userData.rotor);
  assert.equal(blocks.wormThread.parent, blocks.worm.userData.rotor);
  assert.equal(blocks.wormRotationIndex.parent, blocks.worm.userData.rotor);
  assert.equal(blocks.contactMarkers.length, 13);
  assert.equal(blocks.wormBearings.length, 2);
  assert.equal(blocks.wormBearingSupports.length, 2);
  assert.equal(blocks.worm.userData.globoidal, true);
  assert.equal(blocks.worm.userData.starts, 1);
  assert.equal(blocks.wormBody.userData.hourglassProfile, true);
  assert.equal(blocks.wormThread.userData.continuousSingleStart, true);
  assert.equal(blocks.wheel.userData.envelopedByHourglassWorm, true);
  assert.equal(blocks.wheel.userData.teeth, 60);
  assert.equal(blocks.wormShaft.userData.keyedToWorm, true);
  assert.equal(blocks.wheelShaft.userData.keyedToWheel, true);
  assert.equal(transmission.minimumSimultaneousContacts, 11);
  assert.equal(transmission.maximumSimultaneousContacts, 12);
  assert.equal(transmission.slidingContact, true);

  let continuousThreadCount = 0;
  let cylindricalScrewCount = 0;
  let beltCount = 0;
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (role === 'one-continuous-globoidal-helical-thread') {
      continuousThreadCount += 1;
    }
    if (role === 'cylindrical-worm') cylindricalScrewCount += 1;
    if (/belt/i.test(role)) beltCount += 1;
  });
  assert.equal(continuousThreadCount, 1);
  assert.equal(cylindricalScrewCount, 0);
  assert.equal(beltCount, 0);

  assert.deepEqual(sourceRaster.imageSize.toArray(), [525, 525]);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.equal(sourceRaster.correctedReferenceMovement, 31);
  assert.equal(sourceRaster.detectedUpperHalfToothCount, 30);
  assert.deepEqual(sourceAnchors.wheelCenter.toArray(), [268, 202]);
  assert.deepEqual(sourceAnchors.wormAxis.left.toArray(), [57, 410]);
  assert.deepEqual(sourceAnchors.wormAxis.right.toArray(), [477, 410]);

  const movement31 = createMovementModel(catalog.movements[30]);
  assert.equal(movement31.root.userData.mechanism, 'single-start-worm-and-wheel');
  assert.equal(movement31.root.userData.blocks.worm.userData.globoidal, undefined);
  assert.ok(
    model.root.userData.geometry.wormTurns
      > 2 * movement31.root.userData.geometry.wormTurns,
  );
  assert.notEqual(
    model.root.userData.mechanism,
    movement31.root.userData.mechanism,
  );
  disposeModel(movement31.root);
  disposeModel(model.root);
});

test('movement 202 uses the wheel-circle envelope for every body section and thread sample', () => {
  const model = createMovementModel(catalog.movements[201]);
  const { blocks, geometry, sourceRaster, transmission } = model.root.userData;

  assert.equal(geometry.wheelTeeth, 60);
  assert.equal(geometry.wormStarts, 1);
  vector3Near(geometry.wormAxis, X_AXIS, 1e-15, 'worm axis');
  vector3Near(geometry.wheelAxis, Z_AXIS, 1e-15, 'wheel axis');
  near(geometry.wormAxis.dot(geometry.wheelAxis), 0, 1e-15, 'perpendicular axes');
  near(
    geometry.wheelCenter.y - geometry.wormCenter.y,
    geometry.shaftCenterDistance,
    1e-15,
    'skew-shaft center distance',
  );
  near(
    geometry.shaftCenterDistance,
    geometry.wheelPitchRadius + geometry.throatPitchRadius,
    1e-15,
    'throat pitch tangency',
  );
  near(
    geometry.wormHalfLength,
    geometry.wheelPitchRadius * Math.sin(geometry.envelopmentHalfAngle),
    1e-15,
    'worm half length follows wrapped wheel arc',
  );
  near(
    geometry.wormTurns,
    geometry.wheelTeeth * geometry.envelopmentHalfAngle / Math.PI,
    1e-15,
    'thread turn count follows wheel tooth pitch over full envelope',
  );
  near(
    geometry.wheelCircularPitch,
    FULL_TURN * geometry.wheelPitchRadius / geometry.wheelTeeth,
    1e-15,
    'wheel circular pitch',
  );
  near(
    transmission.nominalRatio,
    geometry.wormStarts / geometry.wheelTeeth,
    1e-15,
    'single-start reduction ratio',
  );
  near(
    geometry.envelopmentHalfAngle,
    sourceRaster.envelopmentHalfAngle,
    0.004,
    'modeled wrap angle follows source proportions',
  );
  near(
    geometry.wormHalfLength / geometry.wheelPitchRadius,
    sourceRaster.wormHalfLength / sourceRaster.wheelPitchRadius,
    0.004,
    'modeled worm-width to wheel-radius proportion',
  );

  const axialSamples = 2048;
  let previousRadius = Infinity;
  for (let index = 0; index <= axialSamples; index += 1) {
    const axial = index / axialSamples * geometry.wormHalfLength;
    const expected = geometry.shaftCenterDistance - Math.sqrt(
      geometry.wheelPitchRadius ** 2 - axial ** 2,
    );
    const radius = geometry.pitchRadiusAtAxial(axial);
    near(radius, expected, 1e-15, 'wheel-circle pitch envelope');
    near(
      geometry.betaAtAxial(axial),
      Math.asin(axial / geometry.wheelPitchRadius),
      1e-15,
      'axial inverse maps to wheel angle',
    );
    assert.ok(radius >= previousRadius - 1e-15 || index === 0);
    previousRadius = radius;
  }
  near(
    geometry.pitchRadiusAtAxial(0),
    geometry.throatPitchRadius,
    1e-15,
    'minimum pitch radius is at throat',
  );
  assert.ok(
    geometry.pitchRadiusAtAxial(geometry.wormHalfLength)
      > geometry.throatPitchRadius * 1.9,
  );

  const points = blocks.worm.userData.threadPoints;
  const parameterMinimum = -geometry.wheelTeeth * geometry.envelopmentHalfAngle;
  const parameterMaximum = -parameterMinimum;
  assert.ok(points.length > 800);
  points.forEach((point, index) => {
    const parameter = THREE.MathUtils.lerp(
      parameterMinimum,
      parameterMaximum,
      index / (points.length - 1),
    );
    const beta = geometry.wormHandedness * parameter / geometry.wheelTeeth;
    near(
      point.z,
      geometry.axialAtBeta(beta),
      2e-15,
      `thread axial coordinate ${index}`,
    );
    near(
      Math.hypot(point.x, point.y),
      geometry.pitchRadiusAtBeta(beta),
      2e-15,
      `thread pitch radius ${index}`,
    );
    vector3Near(
      point,
      model.root.userData.threadPointAt(parameter),
      2e-15,
      `analytic thread point ${index}`,
    );
  });
  disposeModel(model.root);
});

test('movement 202 maintains 11–12 simultaneous phase-locked contacts through 32,769 worm poses', () => {
  const model = createMovementModel(catalog.movements[201]);
  const { geometry, stateAtWormAngle, transmission } = model.root.userData;
  const sourceState = stateAtWormAngle(geometry.wormPhase);
  let minimumContactCount = Infinity;
  let maximumContactCount = -Infinity;
  let minimumSlidingSpeed = Infinity;
  let maximumContactArcSpan = -Infinity;
  const sampleCount = 32768;

  for (let index = 0; index <= sampleCount; index += 1) {
    const wormAngle = geometry.wormPhase + index / sampleCount * FULL_TURN;
    const state = stateAtWormAngle(wormAngle, transmission.wormAngularSpeed);
    if (index % 2048 === 0) finiteStateNumbers(state);
    near(
      state.gearRatio,
      geometry.wormHandedness * geometry.wormStarts / geometry.wheelTeeth,
      1e-15,
      'constant 60:1 ratio',
    );
    near(state.meshPhaseInvariant, 0, 8e-15, 'single-start mesh phase');
    assert.ok(state.simultaneousContactCount === 11
      || state.simultaneousContactCount === 12);
    assert.equal(state.contacts.length, state.simultaneousContactCount);
    assert.ok(state.primaryContact != null);
    assert.ok(Math.abs(state.primaryContact.beta) <= geometry.wheelToothPitch / 2);

    state.contacts.forEach((contact, contactIndex) => {
      near(contact.threadPointError, 0, 6e-15, 'thread center reaches wheel pitch circle');
      near(contact.threadTopPhaseError, 0, 5e-14, 'thread ridge is in central section');
      near(contact.wheelGapPhaseError, 0, 8e-15, 'wheel presents a gap to each ridge');
      near(contact.wormAdvanceNoSlipError, 0, 1e-15, 'thread phase advance matches wheel');
      near(
        contact.point.distanceTo(geometry.wheelCenter),
        geometry.wheelPitchRadius,
        2e-15,
        'contact lies on wheel pitch circle',
      );
      near(
        radialDistanceToLine(
          contact.point,
          geometry.wormCenter,
          geometry.wormAxis,
        ),
        contact.pitchRadius,
        2e-15,
        'contact lies on globoidal worm pitch surface',
      );
      near(
        contact.point.x - geometry.wormCenter.x,
        contact.axial,
        2e-15,
        'contact axial station',
      );
      near(
        contact.wormMaterialVelocity.dot(contact.wheelSurfaceVelocity),
        0,
        2e-15,
        'worm sliding and wheel pitch motion are orthogonal in central section',
      );
      assert.ok(contact.relativeSlidingSpeed > 0.68);
      assert.ok(Math.abs(contact.beta) <= geometry.envelopmentHalfAngle + 1e-14);
      if (contactIndex > 0) {
        const previous = state.contacts[contactIndex - 1];
        assert.equal(contact.turnIndex, previous.turnIndex + 1);
        assert.equal(contact.gapIndex, previous.gapIndex + 1);
        near(
          contact.beta - previous.beta,
          geometry.wheelToothPitch,
          2e-15,
          'adjacent worm turns engage adjacent wheel gaps',
        );
      }
      minimumSlidingSpeed = Math.min(
        minimumSlidingSpeed,
        contact.relativeSlidingSpeed,
      );
    });
    minimumContactCount = Math.min(
      minimumContactCount,
      state.simultaneousContactCount,
    );
    maximumContactCount = Math.max(
      maximumContactCount,
      state.simultaneousContactCount,
    );
    maximumContactArcSpan = Math.max(maximumContactArcSpan, state.contactArcSpan);
  }

  assert.equal(minimumContactCount, transmission.minimumSimultaneousContacts);
  assert.equal(maximumContactCount, transmission.maximumSimultaneousContacts);
  assert.ok(minimumSlidingSpeed > 0.68);
  assert.ok(maximumContactArcSpan > 2.4);

  const afterOneTurn = stateAtWormAngle(geometry.wormPhase + FULL_TURN);
  near(
    afterOneTurn.wheelAngle - sourceState.wheelAngle,
    geometry.wheelToothPitch,
    3e-16,
    'one worm revolution advances one wheel tooth',
  );
  near(afterOneTurn.outputTeethAdvanced, 1, 2e-16, 'one output tooth advanced');
  assert.equal(
    afterOneTurn.simultaneousContactCount,
    sourceState.simultaneousContactCount,
  );
  afterOneTurn.contacts.forEach((contact, index) => {
    vector3Near(
      contact.point,
      sourceState.contacts[index].point,
      3e-15,
      `contact set closes after one input turn ${index}`,
    );
  });
  disposeModel(model.root);
});

test('movement 202 analytic wheel and contact velocities match finite differences while preserving real sliding', () => {
  const model = createMovementModel(catalog.movements[201]);
  const { geometry, stateAtWormAngle, transmission } = model.root.userData;
  const angularSpeed = transmission.wormAngularSpeed;
  const timeStep = 1e-6;

  for (let index = 0; index <= 256; index += 1) {
    const angle = index / 256 * FULL_TURN;
    const state = stateAtWormAngle(angle, angularSpeed);
    const previous = stateAtWormAngle(
      angle - angularSpeed * timeStep,
      angularSpeed,
    );
    const next = stateAtWormAngle(
      angle + angularSpeed * timeStep,
      angularSpeed,
    );
    const derivative = (key) => (next[key] - previous[key]) / (2 * timeStep);
    near(
      derivative('wheelAngle'),
      state.wheelAngularSpeed,
      2e-10,
      'wheel angular speed derivative',
    );
    near(
      state.wormArcAdvanceSpeed,
      state.wheelPitchLineSpeed,
      1e-15,
      'thread advance equals wheel pitch-line speed',
    );

    const previousContact = previous.contacts.find(({ turnIndex }) => turnIndex === 0);
    const contact = state.contacts.find(({ turnIndex }) => turnIndex === 0);
    const nextContact = next.contacts.find(({ turnIndex }) => turnIndex === 0);
    assert.ok(previousContact && contact && nextContact);
    near(
      (nextContact.beta - previousContact.beta) / (2 * timeStep),
      contact.betaAngularSpeed,
      2e-10,
      'contact arc angular speed derivative',
    );
    const pointVelocity = nextContact.point.clone()
      .sub(previousContact.point)
      .multiplyScalar(1 / (2 * timeStep));
    vector3Near(
      pointVelocity,
      contact.wheelSurfaceVelocity,
      3e-10,
      'contact path velocity derivative',
    );
    assert.ok(contact.wormMaterialVelocity.length() > 0.68);
    assert.ok(contact.relativeSlidingSpeed > contact.wormMaterialVelocity.length());
    near(
      contact.relativeSlidingVelocity.length(),
      Math.hypot(
        contact.wormMaterialVelocity.length(),
        contact.wheelSurfaceVelocity.length(),
      ),
      2e-15,
      'orthogonal material sliding components',
    );
    near(
      contact.point.y - geometry.wormCenter.y,
      contact.pitchRadius,
      2e-15,
      'active ridge remains at top meridian',
    );
  }
  disposeModel(model.root);
});

test('movement 202 runtime transforms expose the hourglass envelope as the queue advances through 204', () => {
  const model = createMovementModel(catalog.movements[201]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const physicalBounds = new THREE.Box3();

  for (const time of [
    ...Object.values(canonicalTimes),
    transmission.inputCyclePeriod * 0.37,
    transmission.inputCyclePeriod * 1.73,
  ]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(
      blocks.worm.userData.rotor.rotation.z,
      state.wormAngle,
      1e-15,
      'runtime worm angle',
    );
    near(
      blocks.wormShaft.userData.rotor.rotation.z,
      state.wormAngle,
      1e-15,
      'runtime worm shaft angle',
    );
    near(
      blocks.wheel.userData.rotor.rotation.z,
      state.wheelAngle,
      1e-15,
      'runtime wheel angle',
    );
    near(
      blocks.wheelShaft.userData.rotor.rotation.z,
      state.wheelAngle,
      1e-15,
      'runtime wheel shaft angle',
    );
    assert.equal(
      blocks.contactMarkers.filter(({ visible }) => visible).length,
      state.simultaneousContactCount,
    );
    blocks.contactMarkers.forEach((marker, index) => {
      if (index < state.contacts.length) {
        vector3Near(
          marker.position,
          state.contacts[index].point,
          1e-15,
          `runtime simultaneous contact marker ${index}`,
        );
      } else {
        assert.equal(marker.visible, false);
      }
    });
    assert.equal(
      model.root.userData.globoidalContacts,
      model.root.userData.kinematics.contacts,
    );
    model.root.userData.globoidalContacts.forEach((contact, index) => {
      vector3Near(
        contact.point,
        state.contacts[index].point,
        2e-15,
        `stored runtime contact ${index}`,
      );
    });
    for (const object of [
      blocks.worm,
      blocks.wheel,
      blocks.wormShaft,
      blocks.wheelShaft,
      blocks.baseRail,
      blocks.rearPost,
      blocks.wheelBearingBridge,
      ...blocks.wormBearings,
      ...blocks.wormBearingSupports,
    ]) physicalBounds.expandByObject(object);
  }

  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.7);
  assert.ok(size.y > 5.1);
  assert.ok(size.z > 1.5);
  assert.ok(physicalBounds.min.y < -2.7);
  assert.ok(physicalBounds.max.y > 2.8);
  vector3Near(blocks.worm.position, geometry.wormCenter, 1e-15, 'worm center');
  vector3Near(blocks.wheel.position, geometry.wheelCenter, 1e-15, 'wheel center');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const nextMovement = catalog.movements[202];
  const nextModel = createMovementModel(nextMovement);
  const movement204 = catalog.movements[203];
  const model204 = createMovementModel(movement204);
  const movement205 = catalog.movements[204];
  const model205 = createMovementModel(movement205);
  assert.equal(nextMovement.id, 203);
  assert.equal(nextMovement.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.equal(movement204.id, 204);
  assert.equal(movement204.fidelity, 'authored');
  assert.equal(model204.root.userData.fidelity, 'authored');
  assert.equal(movement205.id, 205);
  assert.equal(movement205.fidelity, 'authored');
  assert.equal(model205.root.userData.fidelity, 'authored');
  disposeModel(model205.root);
  disposeModel(model204.root);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});
