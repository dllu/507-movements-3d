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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function normalizedAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function rotate(vector, angle) {
  return new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
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

test('movement 240 is one ratchet wheel with three alternative stop forms', () => {
  const movement = catalog.movements[239];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 240);
  assert.equal(movement.number, '240');
  assert.equal(movement.title, 'Three Ratchet-Wheel Stop Varieties');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'three-alternative-hook-straight-gravity-and-spring-ratchet-stops',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.alternativeCount, 3);
  assert.equal(transmission.alternativesSimultaneouslyLoaded, false);
  // The hook and straight stops alternate; stop C stays down throughout.
  assert.equal(transmission.oneStopEngagedAtATime, true);
  assert.equal(transmission.actuationDepictedBySource, false);
  assert.equal(transmission.sourceIsComparisonPlate, true);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.hookGravityStop.parent, model.root);
  assert.equal(blocks.straightGravityStop.parent, model.root);
  assert.equal(blocks.springPawlStop.parent, model.root);
  // The S-lever is part of stop C's flat plate; the old round leaf-spring
  // tube is not drawn.
  assert.equal(blocks.leafSpring.parent, null);
  assert.equal(blocks.springAnchorShaft, blocks.springPawlStopPivot);
  assert.equal(blocks.wheel.userData.teeth, 18);
  assert.equal(blocks.hookGravityStop.userData.role, 'hook-gravity-stop');
  assert.equal(
    blocks.straightGravityStop.userData.role,
    'straight-gravity-stop',
  );
  assert.equal(blocks.springPawlStop.userData.role, 'spring-pawl-stop');
  let alternativeCount = 0;
  model.root.traverse((object) => {
    if (/^(hook-gravity|straight-gravity|spring-pawl)-stop$/.test(
      object.userData.role ?? '',
    )) alternativeCount += 1;
  });
  assert.equal(alternativeCount, 3);
  disposeModel(model.root);
});

test('movement 240 preserves the measured comparison plate and spring joint', () => {
  const model = createMovementModel(catalog.movements[239]);
  const {
    geometry,
    sourceReference,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const plate = sourceReference.plate240;

  // Brown's hub centre; his tips lie about 135 px from it.
  assert.deepEqual(plate.rasterWheelCenter.toArray(), [213, 234]);
  assert.deepEqual(plate.rasterHookPivot.toArray(), [49, 240]);
  assert.deepEqual(plate.rasterHookNose.toArray(), [151, 121]);
  assert.deepEqual(plate.rasterStraightPivot.toArray(), [478, 140]);
  assert.deepEqual(plate.rasterStraightNose.toArray(), [302, 113]);
  // Stop C's own hole (its pivot), its upper right tip and the S-spring's
  // anchor eye, traced from the plate.
  assert.deepEqual(plate.rasterSpringJoint.toArray(), [213.75, 386.25]);
  assert.deepEqual(plate.rasterSpringNose.toArray(), [238.75, 347.5]);
  assert.deepEqual(plate.rasterSpringAnchor.toArray(), [255, 455]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.inferredToothCount, 18);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /three alternative stop-pawl forms/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 61,
    edition: 21,
    illustrationPage: 60,
    publicationYear: 1908,
  });
  assert.deepEqual(sourceReference.corroboratingClassification, {
    edition: 7,
    figure: 1023,
    forms: ['hook stop', 'straight gravity pawl', 'spring pawl'],
    publication: 'Mechanical Movements, Powers, Devices, and Appliances',
    publicationYear: 1901,
  });
  vectorNear(
    geometry.stopDefinitions[0].pivot,
    new THREE.Vector2(-2.296, -0.084),
    2e-15,
    'hook fixed pivot',
  );
  vectorNear(
    geometry.stopDefinitions[1].pivot,
    new THREE.Vector2(3.71, 1.316),
    2e-15,
    'straight fixed pivot',
  );
  vectorNear(
    geometry.stopDefinitions[2].pivot,
    new THREE.Vector2(0.0105, -2.1315),
    2e-15,
    'stop C turns on its own drawn hole',
  );
  vectorNear(
    geometry.springBearingLocal,
    new THREE.Vector2(-0.5775, 0.9625),
    2e-15,
    'carried upper spring joint',
  );
  assert.equal(transmission.direction, 'counterclockwise-free-running-and-clockwise-locked');
  const source = stateAtTime(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.activeAlternative, 'hook-gravity-stop');
  assert.equal(source.activeAlternativeCount, 1);
  assert.equal(source.pawls[0].mode, 'reverse-locked-on-steep-face');
  assert.equal(source.pawls[0].contact.edge.type, 'reverse-lock-face');
  // p93: the straight stop is down on its steep face too, as drawn.
  assert.equal(source.pawls[1].parked, false);
  assert.equal(source.pawls[1].mode, 'reverse-locked-on-steep-face');
  assert.equal(source.pawls[2].parked, false);
  assert.equal(source.pawls[2].engaged, true);
  disposeModel(model.root);
});

test('movement 240 reconstructs eighteen asymmetric three-face ratchet teeth', () => {
  const model = createMovementModel(catalog.movements[239]);
  const { blocks, geometry } = model.root.userData;
  const wheel = blocks.wheel;

  vectorNear(wheel.userData.axis, new THREE.Vector3(0, 0, 1), 0,
    'ratchet-wheel axis');
  assert.equal(wheel.userData.profilePoints.length, 54);
  assert.equal(geometry.localProfilePoints.length, 54);
  assert.equal(geometry.localProfileEdges.length, 54);
  assert.equal(
    geometry.localProfileEdges.filter(({ type }) => type === 'rising-ramp').length,
    18,
  );
  assert.equal(
    geometry.localProfileEdges.filter(({ type }) => type === 'short-tip').length,
    18,
  );
  assert.equal(
    geometry.localProfileEdges.filter(({ type }) => (
      type === 'reverse-lock-face'
    )).length,
    18,
  );
  near(geometry.toothPitch, FULL_TURN / 18, 0, 'eighteen-tooth pitch');
  for (let toothIndex = 0; toothIndex < geometry.toothCount; toothIndex += 1) {
    const root = geometry.localProfilePoints[toothIndex * 3];
    const outerStart = geometry.localProfilePoints[toothIndex * 3 + 1];
    const outerEnd = geometry.localProfilePoints[toothIndex * 3 + 2];
    near(root.length(), geometry.wheelRootRadius, 3e-16,
      `tooth ${toothIndex} root radius`);
    near(outerStart.length(), geometry.wheelOuterRadius, 5e-16,
      `tooth ${toothIndex} outer-start radius`);
    near(outerEnd.length(), geometry.wheelOuterRadius, 5e-16,
      `tooth ${toothIndex} outer-end radius`);
    const expectedRootAngle = geometry.wheelMountPhase
      + toothIndex * geometry.toothPitch;
    near(normalizedAngle(Math.atan2(root.y, root.x) - expectedRootAngle),
      0, 2e-15, `tooth ${toothIndex} root phase`);
    near(
      normalizedAngle(
        Math.atan2(outerStart.y, outerStart.x)
        - expectedRootAngle
        - geometry.toothOuterStartPhase * geometry.toothPitch,
      ),
      0,
      2e-15,
      `tooth ${toothIndex} ramp-tip phase`,
    );
    near(
      normalizedAngle(
        Math.atan2(outerEnd.y, outerEnd.x)
        - expectedRootAngle
        - geometry.toothOuterEndPhase * geometry.toothPitch,
      ),
      0,
      2e-15,
      `tooth ${toothIndex} drive-face phase`,
    );
  }
  disposeModel(model.root);
});

test('movement 240 keeps all three stops riding the teeth in 32,769 states', () => {
  const model = createMovementModel(catalog.movements[239]);
  const {
    pointInsideWheelAtAngle,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const activeCounts = new Map();
  let parkedStates = 0;
  let maximumContactCoincidenceError = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtCycleCoordinate(index / 32768);
    // p93: every stop stays down through every stroke, riding the ramps and
    // dropping into each root; none is parked above the tips.
    for (const pawl of state.pawls) {
      assert.equal(pawl.engaged, true);
      assert.ok(pawl.finiteContact.normalClearance < .06, `${pawl.key} rides the teeth`);
    }
    for (const pawl of state.pawls) {
      for (const value of [
        pawl.angle,
        pawl.angleDelta,
        pawl.angularAcceleration,
        pawl.angularSpeed,
        pawl.nosePoint.x,
        pawl.nosePoint.y,
      ]) assert.ok(Number.isFinite(value));
      if (pawl.contact) {
        maximumContactCoincidenceError = Math.max(
          maximumContactCoincidenceError,
          pawl.nosePoint.distanceTo(pawl.contact.point),
        );
        assert.ok(pawl.contact.normalClearance > .0003 && pawl.contact.normalClearance < .008);
        assert.ok(Number.isFinite(pawl.normalVelocityError));
      } else {
        assert.equal(
          pointInsideWheelAtAngle(pawl.nosePoint, state.wheelAngle),
          false,
        );
      }
    }
    if (state.activeAlternative === null) parkedStates += 1;
    else activeCounts.set(
      state.activeAlternative,
      (activeCounts.get(state.activeAlternative) ?? 0) + 1,
    );
  }
  assert.ok(maximumContactCoincidenceError > .0645 && maximumContactCoincidenceError < .073,
    'the finite nose center is a radius away from its working face');
  // The demonstration labels still cycle through the three forms.
  assert.ok(parkedStates > 11000);
  for (const key of [
    'hook-gravity-stop',
    'straight-gravity-stop',
    'spring-pawl-stop',
  ]) assert.ok((activeCounts.get(key) ?? 0) > 6900);
  disposeModel(model.root);
});

test('movement 240 advances exactly one counterclockwise pitch under each stop', () => {
  const model = createMovementModel(catalog.movements[239]);
  const {
    contactAtWheelAngle,
    geometry,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const { driveStart, driveEnd } = geometry.selectionPhases;

  for (const stop of geometry.stopDefinitions) {
    const variantIndex = stop.index;
    const start = stateAtCycleCoordinate((variantIndex + driveStart) / 3);
    const end = stateAtCycleCoordinate((variantIndex + driveEnd) / 3);
    near(start.wheelAngle, variantIndex * geometry.toothPitch, 2e-15,
      `${stop.key} starts at its indexed gap`);
    near(end.wheelAngle, (variantIndex + 1) * geometry.toothPitch, 2e-15,
      `${stop.key} ends one counterclockwise pitch later`);
    assert.equal(start.pawls[variantIndex].finiteContact.edge.type,
      'reverse-lock-face');
    assert.equal(end.pawls[variantIndex].finiteContact.edge.type,
      'reverse-lock-face');
    const encounteredFaces = new Set();
    let maximumLift = 0;
    let previousWheelAngle = Infinity;
    let previousPawlAngle = null;
    for (let sample = 0; sample <= 4096; sample += 1) {
      const stepPhase = THREE.MathUtils.lerp(
        driveStart,
        driveEnd,
        sample / 4096,
      );
      const state = stateAtCycleCoordinate((variantIndex + stepPhase) / 3);
      const pawl = state.pawls[variantIndex];
      assert.equal(state.activeAlternative, stop.key);
      // The wheel runs about 0.11 pitch past, then slips back so the stop
      // seats in the root.
      assert.ok(state.wheelAngle >= start.wheelAngle - 2e-15);
      assert.ok(state.wheelAngle <= start.wheelAngle
        + 1.12 * geometry.toothPitch);
      assert.ok(pawl.finiteContact.normalClearance > .0003);
      encounteredFaces.add(pawl.finiteContact.edge.type);
      const lift = stop.liftSign * pawl.angleDelta;
      assert.ok(lift >= -2e-12);
      assert.ok(lift <= stop.maximumContactLift + 1e-6);
      maximumLift = Math.max(maximumLift, lift);
      if (previousPawlAngle !== null) {
        assert.ok(Math.abs(pawl.angleDelta - previousPawlAngle) < 0.002);
      }
      previousPawlAngle = pawl.angleDelta;
      previousWheelAngle = state.wheelAngle;
    }
    assert.deepEqual(
      [...encounteredFaces].sort(),
      ['reverse-lock-face', 'rising-ramp', 'short-tip'],
    );
    near(maximumLift, stop.maximumContactLift, 1e-6,
      `${stop.key} reaches its analytic lift`);
    // Reverse locking on the steep face is checked on the finite toes in
    // ratchet-stop-240-working-parts.test.mjs.
  }
  disposeModel(model.root);
});

test('movement 240 reported wheel and pawl derivatives match finite differences', () => {
  const model = createMovementModel(catalog.movements[239]);
  const { geometry, stateAtTime } = model.root.userData;
  const delta = 1e-5;
  for (let variantIndex = 0; variantIndex < 3; variantIndex += 1) {
    for (const stepPhase of [0.34, 0.4, 0.48, 0.58, 0.64]) {
      const cycleCoordinate = (variantIndex + stepPhase) / 3;
      const time = (cycleCoordinate - geometry.initialCycleCoordinate)
        * geometry.cyclePeriod;
      const before = stateAtTime(time - delta);
      const state = stateAtTime(time);
      const after = stateAtTime(time + delta);
      const wheelSpeed = (after.wheelAngle - before.wheelAngle) / (2 * delta);
      const wheelAcceleration = (
        after.wheelAngle - 2 * state.wheelAngle + before.wheelAngle
      ) / delta ** 2;
      near(wheelSpeed, state.wheelAngularSpeed, 2e-8,
        'wheel angular speed finite difference');
      near(wheelAcceleration, state.wheelAngularAcceleration, 2e-4,
        'wheel angular acceleration finite difference');
      const beforePawl = before.pawls[variantIndex];
      const pawl = state.pawls[variantIndex];
      const afterPawl = after.pawls[variantIndex];
      const pawlSpeed = (
        afterPawl.angleDelta - beforePawl.angleDelta
      ) / (2 * delta);
      const pawlAcceleration = (
        afterPawl.angleDelta - 2 * pawl.angleDelta + beforePawl.angleDelta
      ) / delta ** 2;
      near(pawlSpeed, pawl.angularSpeed, 2e-8,
        `${pawl.key} angular speed finite difference`);
      near(pawlAcceleration, pawl.angularAcceleration, 2e-4,
        `${pawl.key} angular acceleration finite difference`);
      assert.ok(Number.isFinite(pawl.normalVelocityError));
    }
  }
  disposeModel(model.root);
});

test('movement 240 renderer binds the selected stop and turns stop C with its S-lever', () => {
  const model = createMovementModel(catalog.movements[239]);
  const {
    blocks,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const stopGroups = [
    blocks.hookGravityStop,
    blocks.straightGravityStop,
    blocks.springPawlStop,
  ];
  const contactMarkers = [
    blocks.hookGravityStopContactMarker,
    blocks.straightGravityStopContactMarker,
    blocks.springPawlStopContactMarker,
  ];
  let minimumBearingY = Infinity;
  let maximumBearingY = -Infinity;
  for (let sample = 0; sample <= 2048; sample += 1) {
    const time = geometry.cyclePeriod * sample / 2048;
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.wheel.userData.rotor.rotation.z, state.wheelAngle, 2e-15,
      'rendered wheel angle');
    near(blocks.wheelShaft.userData.rotor.rotation.z, state.wheelAngle, 2e-15,
      'rendered wheel-shaft angle');
    for (let index = 0; index < 3; index += 1) {
      const pawl = state.pawls[index];
      near(stopGroups[index].rotation.z, pawl.angleDelta, 2e-15,
        `rendered ${pawl.key} angle`);
      assert.equal(contactMarkers[index].visible, false);
      if (pawl.contact) {
        vectorNear(
          new THREE.Vector2(
            contactMarkers[index].position.x,
            contactMarkers[index].position.y,
          ),
          pawl.contact.point,
          1e-15,
          `rendered ${pawl.key} contact`,
        );
      }
    }
    // C and its S-lever are one plate turning about the lever's pivot eye.
    const springPawl = state.pawls[2];
    const expectedBearing = geometry.stopDefinitions[2].pivot.clone().add(
      rotate(geometry.springBearingLocal, springPawl.angleDelta),
    );
    const carried = new THREE.Vector3(geometry.springBearingLocal.x, geometry.springBearingLocal.y, 0)
      .applyMatrix4(new THREE.Matrix4().makeRotationZ(blocks.springPawlStop.rotation.z));
    vectorNear(new THREE.Vector2(carried.x, carried.y).add(geometry.stopDefinitions[2].pivot), expectedBearing, 1e-14,
      'S-lever carried joint');
    minimumBearingY = Math.min(minimumBearingY, expectedBearing.y);
    maximumBearingY = Math.max(maximumBearingY, expectedBearing.y);
    assert.equal(
      Object.values(model.root.userData.contacts)
        .filter((contact) => contact !== null).length,
      state.pawls.filter(pawl => pawl.contact !== null).length,
    );
  }
  assert.ok(maximumBearingY - minimumBearingY > .1 && maximumBearingY - minimumBearingY < .3,
    'C lifts through a small rigid swing of its S-lever');
  assert.equal(blocks.wheelIndicator.userData.role, 'ratchet-wheel-face-index');
  assert.equal(blocks.leafSpring.userData.drawn, false);
  disposeModel(model.root);
});

test('movement 240 closes in six comparison cycles and leaves 269 authored', () => {
  const model = createMovementModel(catalog.movements[239]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const source = stateAtCycleCoordinate(geometry.initialCycleCoordinate);
  for (let cycle = 1; cycle <= 6; cycle += 1) {
    const state = stateAtCycleCoordinate(
      geometry.initialCycleCoordinate + cycle,
    );
    near(
      state.wheelAngle - source.wheelAngle,
      cycle * 3 * geometry.toothPitch,
      2e-14,
      `three indexes in comparison cycle ${cycle}`,
    );
    for (let index = 0; index < 3; index += 1) {
      near(state.pawls[index].angleDelta, source.pawls[index].angleDelta,
        2e-14, `pawl ${index} phase closure in cycle ${cycle}`);
    }
  }
  const closure = stateAtCycleCoordinate(geometry.initialCycleCoordinate + 6);
  near(closure.wheelAngle - source.wheelAngle, FULL_TURN, 3e-14,
    'eighteen demonstrated teeth close one wheel revolution');
  assert.equal(model.root.userData.transmission.wheelRevolutionsPerSixCycles, 1);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});
