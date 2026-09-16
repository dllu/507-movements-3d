import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
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

test('movement 365 is one vertical rod between two opposed oblique-axis friction rollers', () => {
  const movement = catalog.movements[364];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 365);
  assert.equal(movement.number, '365');
  assert.equal(movement.category, 'Friction drives');
  assert.equal(
    movement.archetype,
    'opposed-equal-and-opposite-skew-roller-helical-rod-feed',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /two-opposed-oblique-axis-friction-rollers/);
  assert.match(data.mechanism, /simultaneous-longitudinal-and-rotary-motion/);
  assert.equal(degreesOfFreedom.actuatedPhysicalRollers, 2);
  assert.equal(degreesOfFreedom.independentSynchronizedDriveCoordinates, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /equal-and-opposite/);
  assert.match(degreesOfFreedom.input, /external synchronizing drive/);
  assert.equal(degreesOfFreedom.dependentCoordinates.length, 2);

  assert.equal(blocks.frame.parent, model.root);
  assert.equal(blocks.frame.userData.fixed, true);
  assert.equal(blocks.rollerAssemblies.length, 2);
  assert.equal(blocks.rollerSpinRotors.length, 2);
  assert.equal(blocks.rollerBodies.length, 2);
  assert.equal(blocks.rollerShafts.length, 2);
  assert.equal(blocks.rollerEndRims.length, 4);
  assert.equal(blocks.rollerFaceIndexes.length, 4);
  assert.equal(blocks.rollerTreadIndexes.length, 2);
  assert.equal(blocks.bearingRings.length, 4);
  assert.equal(blocks.bearingPosts.length, 4);
  assert.equal(blocks.rodGuides.length, 2);
  assert.equal(blocks.rodMarkers.length, geometry.rodMarkerCount);
  assert.equal(blocks.rodSpinRotor.parent, model.root);
  assert.equal(blocks.rodBody.parent, blocks.rodSpinRotor);
  for (const marker of blocks.rodMarkers) {
    assert.equal(marker.parent, blocks.rodSpinRotor);
  }
  blocks.rollerAssemblies.forEach((assembly, index) => {
    assert.equal(assembly.parent, model.root);
    assert.equal(blocks.rollerSpinRotors[index].parent, assembly);
    assert.equal(blocks.rollerBodies[index].parent,
      blocks.rollerSpinRotors[index]);
    assert.equal(blocks.rollerShafts[index].parent,
      blocks.rollerSpinRotors[index]);
  });
  vectorNear(blocks.rollerAssemblies[0].userData.axis,
    geometry.frontAxis, 0, 'front roller axis');
  vectorNear(blocks.rollerAssemblies[1].userData.axis,
    geometry.rearAxis, 0, 'rear roller axis');
  vectorNear(blocks.rodSpinRotor.userData.axis, Y_AXIS, 0, 'rod axis');

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
    'one-of-two-oblique-friction-drive-rollers',
    'shaft-fixed-to-oblique-friction-roller',
    'long-cylindrical-rod-driven-between-two-oblique-rollers',
    'periodic-white-material-marker-showing-rod-feed-and-spin',
    'white-longitudinal-index-showing-oblique-roller-spin-rate',
    'fixed-ring-bearing-on-oblique-roller-axis',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(belts.length, 0);
  assert.equal(toothedObjects.length, 0);
  disposeModel(model.root);
});

test('movement 365 records Brown’s unavailable animation and the measured crossing-roller engraving without claiming missing dimensions', () => {
  const movement = catalog.movements[364];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate365;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_365.html');
  assert.match(movement.description, /Cylindrical rod/);
  assert.match(movement.description, /between two rollers/);
  assert.match(movement.description, /axes.*oblique/);
  assert.match(movement.description, /longitudinal and a rotary motion/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesInputSpeedOrInertia, false);
  assert.match(data.dynamics.contactModel, /ideal positive rolling friction/);
  assert.match(data.dynamics.contactModel, /not specified by Brown/);
  assert.match(data.dynamics.synchronizationDisclosure, /engraving omits/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 10);
  assert.deepEqual(plate.contactRegionCenter.toArray(), [250, 292]);
  assert.deepEqual(plate.rodTopCenter.toArray(), [251, 38]);
  assert.deepEqual(plate.rodBottomCenter.toArray(), [250, 518]);
  assert.equal(plate.rodCenterlineX, 250);
  assert.deepEqual(plate.rearRollerLeftShaftEnd.toArray(), [18, 296]);
  assert.deepEqual(plate.rearRollerRightShaftEnd.toArray(), [496, 302]);
  assert.deepEqual(
    plate.frontRollerLowerLeftShaftEnd.toArray(),
    [84, 411],
  );
  assert.deepEqual(
    plate.frontRollerUpperRightShaftEnd.toArray(),
    [496, 209],
  );
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence, /vertical slender rod/);
  assert.match(evidence.engravingEvidence, /crossing front roller/);
  assert.match(evidence.reconstructionDisclosure, /±15-degree/);
  assert.match(evidence.reconstructionDisclosure, /no dimensions/);
  assert.match(evidence.reconstructionDisclosure, /no.*drive connection/);
  disposeModel(model.root);
});

test('movement 365 roller cylinders are exactly tangent to opposite rod sides and their skew axes have the reconstructed included angle', () => {
  const model = createMovementModel(catalog.movements[364]);
  const { geometry } = model.root.userData;
  const specifications = [
    {
      axis: geometry.frontAxis,
      center: geometry.frontRollerCenter,
      point: geometry.frontContactPoint,
      rodSide: 1,
    },
    {
      axis: geometry.rearAxis,
      center: geometry.rearRollerCenter,
      point: geometry.rearContactPoint,
      rodSide: -1,
    },
  ];

  near(geometry.axisHalfAngle, THREE.MathUtils.degToRad(15), 0,
    'axis half-angle');
  near(geometry.includedAxisAngle, THREE.MathUtils.degToRad(30), 0,
    'included axis angle');
  near(geometry.frontAxis.angleTo(geometry.rearAxis),
    geometry.includedAxisAngle, 3e-16, 'axis-vector angle');
  assert.ok(Math.abs(geometry.frontAxis.dot(geometry.rearAxis)) > 0);
  assert.ok(Math.abs(geometry.frontAxis.dot(geometry.rearAxis)) < 1);
  near(geometry.frontAxis.length(), 1, 0, 'front unit axis');
  near(geometry.rearAxis.length(), 1, 0, 'rear unit axis');

  for (const { axis, center, point, rodSide } of specifications) {
    const rollerRadiusVector = point.clone().sub(center);
    near(rollerRadiusVector.length(), geometry.rollerRadius, 2e-16,
      'roller tangent radius');
    near(axis.dot(rollerRadiusVector), 0, 0,
      'roller axis perpendicular to contact radius');
    near(point.x, geometry.rodAxisX, 0, 'contact x on rod normal');
    near(point.z, geometry.rodAxisZ + rodSide * geometry.rodRadius, 0,
      'contact on rod surface');
    near(center.z - geometry.rodAxisZ,
      rodSide * (geometry.rollerRadius + geometry.rodRadius), 0,
      'roller center tangent offset');
  }
  vectorNear(
    geometry.frontContactPoint.clone().add(geometry.rearContactPoint)
      .multiplyScalar(0.5),
    new THREE.Vector3(geometry.rodAxisX, geometry.contactY,
      geometry.rodAxisZ),
    1e-16,
    'diametrically opposed contact midpoint',
  );
  const axisCross = new THREE.Vector3().crossVectors(
    geometry.frontAxis,
    geometry.rearAxis,
  ).normalize();
  const shortestSkewSeparation = Math.abs(
    geometry.rearRollerCenter.clone()
      .sub(geometry.frontRollerCenter)
      .dot(axisCross),
  );
  near(shortestSkewSeparation, 2 * geometry.centerOffsetZ, 2e-16,
    'nonintersecting skew-axis separation');
  disposeModel(model.root);
});

test('movement 365 resolves both ideal no-slip contacts to one common axial velocity and opposite rod peripheral velocities', () => {
  const model = createMovementModel(catalog.movements[364]);
  const data = model.root.userData;
  const { geometry } = data;
  const contacts = data.contactsAtConfiguredRates();

  for (const contact of [contacts.front, contacts.rear]) {
    near(contact.normalSeparationError, 0, 2e-16,
      'roller contact-radius closure');
    near(contact.axisNormalDot, 0, 0,
      'axis normal orthogonality');
    assert.ok(contact.slipSpeed < 8e-17,
      `slip speed ${contact.slipSpeed}`);
    vectorNear(contact.rollerSurfaceVelocity,
      contact.rodSurfaceVelocity, 8e-17,
      'surface velocity match');
    near(contact.rollerSurfaceVelocity.z, 0, 0,
      'zero normal surface velocity');
    near(contact.rodSurfaceVelocity.y, geometry.rodAxialVelocity, 0,
      'common axial component');
  }
  near(
    contacts.front.rollerSurfaceVelocity.x,
    geometry.rodAngularSpeed * geometry.rodRadius,
    8e-17,
    'front rod peripheral velocity',
  );
  near(
    contacts.rear.rollerSurfaceVelocity.x,
    -geometry.rodAngularSpeed * geometry.rodRadius,
    8e-17,
    'rear rod peripheral velocity',
  );
  near(contacts.front.signedAngularSpeed,
    geometry.inputAngularSpeed, 0, 'front roller speed');
  near(contacts.rear.signedAngularSpeed,
    -geometry.inputAngularSpeed, 0, 'rear roller speed');
  vectorNear(
    contacts.front.rollerAngularVelocity,
    geometry.frontAxis.clone().multiplyScalar(geometry.inputAngularSpeed),
    1e-16,
    'front angular-velocity vector',
  );
  vectorNear(
    contacts.rear.rollerAngularVelocity,
    geometry.rearAxis.clone().multiplyScalar(-geometry.inputAngularSpeed),
    0,
    'rear angular-velocity vector',
  );
  near(
    geometry.rodAxialVelocity,
    geometry.rollerRadius * geometry.inputAngularSpeed
      * Math.cos(geometry.axisHalfAngle),
    1e-16,
    'resolved axial speed',
  );
  near(
    geometry.rodAngularSpeed,
    -geometry.rollerRadius / geometry.rodRadius
      * geometry.inputAngularSpeed * Math.sin(geometry.axisHalfAngle),
    1e-16,
    'resolved rod angular speed',
  );
  assert.match(data.transmission.velocityResolution, /parallel to the rod/);
  assert.match(data.transmission.velocityResolution, /give spin/);
  disposeModel(model.root);
});

test('movement 365 produces exact unbounded screw motion and reverses both output components when the coordinated roller input reverses', () => {
  const model = createMovementModel(catalog.movements[364]);
  const data = model.root.userData;
  const { geometry, stateAtInputAngle, stateAtTime } = data;

  for (const inputAngle of [
    -FULL_TURN * 2.3,
    -Math.PI,
    -0.37,
    0,
    0.52,
    Math.PI,
    FULL_TURN * 2.6,
  ]) {
    const state = stateAtInputAngle(inputAngle);
    near(state.frontRollerAngle, inputAngle, 0,
      'front roller angle');
    near(state.rearRollerAngle, -inputAngle, 0,
      'rear roller angle');
    near(
      state.rodAxialDisplacement,
      geometry.rodAxialAdvancePerInputRadian * inputAngle,
      0,
      'rod axial displacement',
    );
    near(
      state.rodAngle,
      geometry.rodRotationPerInputRadian * inputAngle,
      0,
      'rod rotation',
    );
    if (Math.abs(inputAngle) > 1e-12) {
      near(
        FULL_TURN * state.rodAxialDisplacement / state.rodAngle,
        geometry.screwLead,
        2e-15,
        'constant screw lead',
      );
    }
  }
  const positive = stateAtInputAngle(1.7);
  const negative = stateAtInputAngle(-1.7);
  near(negative.rodAxialDisplacement,
    -positive.rodAxialDisplacement, 0, 'reversed translation');
  near(negative.rodAngle, -positive.rodAngle, 0,
    'reversed rotation');

  const timeStep = 1e-6;
  for (const time of [-8.1, -0.4, 0, 2.7, 11.3]) {
    const before = stateAtTime(time - timeStep);
    const after = stateAtTime(time + timeStep);
    near(
      (after.rodAxialDisplacement - before.rodAxialDisplacement)
        / (2 * timeStep),
      geometry.rodAxialVelocity,
      8e-10,
      'finite-difference axial velocity',
    );
    near(
      (after.rodAngle - before.rodAngle) / (2 * timeStep),
      geometry.rodAngularSpeed,
      8e-10,
      'finite-difference angular velocity',
    );
  }
  const oneTurn = stateAtTime(geometry.inputCyclePeriod);
  near(oneTurn.rodAxialDisplacement,
    geometry.axialAdvancePerRollerTurn, 5e-16,
    'one-turn axial advance');
  near(oneTurn.rodAngle, geometry.rodRotationPerRollerTurn, 5e-16,
    'one-turn rod rotation');
  assert.notEqual(oneTurn.rodAxialDisplacement, 0);
  assert.notEqual(oneTurn.rodAngle, 0);
  assert.match(data.timeline.note, /unbounded screw feed/);
  assert.match(data.timeline.note, /does not reverse or reset/);
  disposeModel(model.root);
});

test('movement 365 marker window carries exact material translation and rotation with disclosed marker fading at window edges', () => {
  const model = createMovementModel(catalog.movements[364]);
  const data = model.root.userData;
  const { geometry, markerMaterialCoordinates, stateAtInputAngle } = data;

  assert.equal(markerMaterialCoordinates.length, geometry.rodMarkerCount);
  near(
    geometry.upperMarkerWrapY - geometry.lowerMarkerWrapY,
    geometry.markerWindowLength,
    0,
    'marker window length',
  );
  for (let markerIndex = 0; markerIndex < geometry.rodMarkerCount;
    markerIndex += 1) {
    near(
      markerMaterialCoordinates[markerIndex],
      geometry.lowerMarkerWrapY
        + (markerIndex + 0.5) * geometry.rodMarkerPitch,
      3e-16,
      `marker ${markerIndex} base pitch`,
    );
  }

  for (let sample = -1200; sample <= 2400; sample += 1) {
    const inputAngle = sample * 0.013;
    const state = stateAtInputAngle(inputAngle);
    for (const marker of state.markerStates) {
      near(
        marker.unboundedY,
        marker.baseCoordinate + state.rodAxialDisplacement,
        0,
        'unbounded marker material coordinate',
      );
      assert.ok(marker.wrappedY >= geometry.lowerMarkerWrapY);
      assert.ok(marker.wrappedY < geometry.upperMarkerWrapY);
      near(
        marker.wrappedY,
        geometry.lowerMarkerWrapY + positiveModulo(
          marker.unboundedY - geometry.lowerMarkerWrapY,
          geometry.markerWindowLength,
        ),
        0,
        'wrapped marker coordinate',
      );
      near(marker.worldAngle,
        state.rodAngle + marker.baseAngle, 0,
        'marker shares rod rotation');
    }
  }
  assert.match(data.visualizationDisclosure.eulerianRodWindow,
    /exact unbounded axial displacement/);
  assert.match(data.visualizationDisclosure.markerWrap,
    /fade at the viewing-window edges/);
  assert.match(data.visualizationDisclosure.reason,
    /leave any finite camera view/);
  disposeModel(model.root);
});

test('movement 365 renderer keeps both contacts slip-free and all visible spin/feed indices continuous over 1,200 frames', () => {
  const model = createMovementModel(catalog.movements[364]);
  const data = model.root.userData;
  const { animationTiming, blocks, geometry } = data;
  const previousMarkerY = Array(geometry.rodMarkerCount).fill(null);
  const markerWraps = Array(geometry.rodMarkerCount).fill(0);
  let largestUnboundedMarkerStep = 0;
  let previousUnboundedMarkerY = null;

  assert.equal(animationTiming.authoredCyclePeriod,
    geometry.inputCyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = geometry.inputCyclePeriod * 2 * frame / 1200;
    model.update(time);
    const state = data.currentState;
    near(blocks.rollerSpinRotors[0].rotation.y,
      state.frontRollerAngle, 0, 'rendered front roller angle');
    near(blocks.rollerSpinRotors[1].rotation.y,
      state.rearRollerAngle, 0, 'rendered rear roller angle');
    near(blocks.rodSpinRotor.rotation.y, state.rodAngle, 0,
      'rendered rod angle');
    assert.ok(data.contacts.maximumSlipSpeed < 8e-17);
    assert.ok(data.contacts.frontRollerToRod.slipSpeed < 8e-17);
    assert.ok(data.contacts.rearRollerToRod.slipSpeed < 8e-17);
    for (let index = 0; index < geometry.rodMarkerCount; index += 1) {
      const markerState = state.markerStates[index];
      near(blocks.rodMarkers[index].position.y,
        markerState.wrappedY, 0, `rendered marker ${index} y`);
      if (previousMarkerY[index] !== null
        && markerState.wrappedY < previousMarkerY[index]) {
        markerWraps[index] += 1;
        assert.ok(previousMarkerY[index]
          > geometry.upperMarkerWrapY - 0.03);
        assert.ok(markerState.wrappedY
          < geometry.lowerMarkerWrapY + 0.03);
      }
      previousMarkerY[index] = markerState.wrappedY;
    }
    if (previousUnboundedMarkerY !== null) {
      largestUnboundedMarkerStep = Math.max(
        largestUnboundedMarkerStep,
        Math.abs(
          state.markerStates[0].unboundedY - previousUnboundedMarkerY,
        ),
      );
    }
    previousUnboundedMarkerY = state.markerStates[0].unboundedY;
    if (frame % 100 === 0) {
      model.root.updateMatrixWorld(true);
      model.root.traverse((object) => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      });
    }
  }
  assert.ok(largestUnboundedMarkerStep < 0.01);
  assert.ok(markerWraps.some((count) => count > 0));

  const start = data.stateAtTime(0);
  const closure = data.stateAtTime(geometry.inputCyclePeriod);
  near(closure.frontRollerAngle - start.frontRollerAngle,
    FULL_TURN, 0, 'front roller full turn');
  near(closure.rearRollerAngle - start.rearRollerAngle,
    -FULL_TURN, 0, 'rear roller full turn');
  near(closure.rodAxialDisplacement - start.rodAxialDisplacement,
    geometry.axialAdvancePerRollerTurn, 5e-16,
    'unbounded feed across display period');
  near(closure.rodAngle - start.rodAngle,
    geometry.rodRotationPerRollerTurn, 5e-16,
    'rod rotation across display period');
  disposeModel(model.root);
});

test('movement 365 is the reviewed frontier and movement 507 remains authored', () => {
  const movement365 = catalog.movements[364];
  const movement507 = catalog.movements[506];
  const model365 = createMovementModel(movement365);
  const model507 = createMovementModel(movement507);

  assert.equal(movement365.id, 365);
  assert.equal(movement365.fidelity, 'authored');
  assert.equal(model365.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model365.root);
  disposeModel(model507.root);
});
