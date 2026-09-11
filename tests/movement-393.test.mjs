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
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 393 is one concentric upright shaft, one bent carrier, one ball joint, one eccentric cup, and stationary spherical work', () => {
  const movement = catalog.movements[392];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 393);
  assert.equal(movement.number, '393');
  assert.equal(movement.category, 'Universal joints');
  assert.equal(
    movement.archetype,
    'eccentric-ball-and-socket-spherical-lens-polishing-cup-orbit-with-passive-zero-twist-spin',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-upright-shaft-concentric/);
  assert.match(data.mechanism, /one-bent-carrier-and-eccentric-ball-joint/);
  assert.match(data.mechanism, /one-conformal-polishing-cup/);
  assert.match(data.mechanism, /revolves-about-the-common-axis/);
  assert.match(data.mechanism, /passively-spins-about-its-own-radial-axis/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /upright concentric shaft/);
  assert.match(degreesOfFreedom.note, /not a second motor input/);

  for (const component of [
    blocks.frame,
    blocks.lens,
    blocks.shaftRotor,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    blocks.ball,
    blocks.bentArmLower,
    blocks.bentArmUpper,
    blocks.shaft,
    blocks.shaftIndex,
    blocks.tiltFrame,
  ]) assert.equal(component.parent, blocks.shaftRotor);
  assert.equal(blocks.cupRotor.parent, blocks.tiltFrame);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'stationary-spherical-lens-concentric-with-upright-shaft',
    'fixed-convex-spherical-work-surface',
    'rotating-upright-shaft-concentric-with-lens-and-work-body',
    'ball-fast-with-bent-carrier-piece',
    'ball-and-socket-axis-kept-radial-to-spherical-work',
    'freely-spinning-eccentric-polishing-cup-on-ball-and-socket',
    'inner-polishing-material-facing-stationary-lens',
    'white-material-index-exposing-cup-spin-about-own-axis',
    'white-fixed-index-on-stationary-lens',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 393 preserves Brown topology and explicitly discloses unavailable animation and unspecified spin ratio', () => {
  const movement = catalog.movements[392];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate393;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_393.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /polishing lenses/);
  assert.match(movement.description, /ball-and-socket joint/);
  assert.match(movement.description, /rotating upright shaft set concentric/);
  assert.match(movement.description, /cup is set eccentric/);
  assert.match(movement.description, /independent rotary motion about its axis/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 11);
  assert.deepEqual(plate.topHandwheelCenterPixels, [260, 35]);
  assert.deepEqual(plate.shaftLowerPivotPixels, [260, 139]);
  assert.deepEqual(plate.ballJointPixels, [233, 222]);
  assert.equal(plate.lensAxisPixelsX, 260);
  assert.equal(plate.cupApproximateMouthRadiusPixels, 79);
  assert.equal(plate.tableSurfacePixelsY, 344);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence, /offset bent carrier/);
  assert.match(evidence.reconstructionDisclosure, /No official animation or spin ratio/);
  assert.match(evidence.reconstructionDisclosure, /zero-twist idealization/);
  disposeModel(model.root);
});

test('movement 393 ball follows one exact latitude and its cup axis remains radial to the lens center', () => {
  const model = createMovementModel(catalog.movements[392]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.axisLaw, /B=O\+R_cup\*n/);
  assert.match(transmission.orbitLaw, /sin\(beta\)/);

  for (let sample = -10000; sample <= 20000; sample += 1) {
    const state = stateAtTime(
      timeline.carrierOrbitDuration * sample / 10000,
    );
    near(state.cupAxis.length(), 1, 3e-16, 'unit cup axis');
    const radial = state.ballCenter.clone().sub(geometry.lensCenter);
    near(radial.length(), geometry.cupOuterRadius, 5e-16,
      'constant ball radius');
    vectorNear(
      radial.normalize(),
      state.cupAxis,
      4e-16,
      'cup axis radial closure',
    );
    near(
      Math.hypot(radial.x, radial.z),
      Math.sin(geometry.eccentricTilt),
      5e-16,
      'normalized latitude radius',
    );
    near(state.ballCenter.y, geometry.ballJointHeight, 5e-16,
      'constant ball latitude height');
  }
  disposeModel(model.root);
});

test('movement 393 passive cup spin exactly cancels angular twist about the instantaneous surface normal', () => {
  const model = createMovementModel(catalog.movements[392]);
  const data = model.root.userData;
  const { constraintResiduals, geometry, motion, stateAtTime, timeline,
    transmission } = data;

  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 0, name);
  }
  assert.match(motion.cupSpinLaw, /-cos\(beta\)/);
  assert.match(transmission.passiveSpinLaw, /psiDot=-Omega\*cos/);
  near(
    motion.cupRelativeSpinRate / motion.shaftAngularSpeed,
    -Math.cos(geometry.eccentricTilt),
    0,
    'passive spin ratio',
  );
  for (let sample = -12000; sample <= 24000; sample += 1) {
    const state = stateAtTime(
      timeline.carrierOrbitDuration * sample / 12000,
    );
    near(state.cupRelativeSpin,
      -Math.cos(geometry.eccentricTilt) * state.carrierAngle,
      0,
      'dependent relative cup angle');
    near(state.surfaceNormalSpinRate, 0, 5e-16,
      'zero-twist angular-velocity residual');
    near(
      state.totalCupAngularVelocity.dot(state.cupAxis),
      0,
      5e-16,
      'total angular velocity has no normal component',
    );
  }
  disposeModel(model.root);
});

test('movement 393 cup material does not repeat the same lens path after one carrier orbit', () => {
  const model = createMovementModel(catalog.movements[392]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.surfaceCoverage, /after each carrier orbit/);

  const offset = 0.137 * timeline.carrierOrbitDuration;
  const first = stateAtTime(offset);
  const next = stateAtTime(offset + timeline.carrierOrbitDuration);
  vectorNear(next.ballCenter, first.ballCenter, 8e-16,
    'ball orbit closes after one shaft turn');
  vectorNear(next.cupAxis, first.cupAxis, 5e-16,
    'cup axis orbit closes after one shaft turn');
  near(
    next.cupRelativeSpin - first.cupRelativeSpin,
    -FULL_TURN * Math.cos(geometry.eccentricTilt),
    2e-15,
    'independent material spin per orbit',
  );
  assert.ok(next.materialIndexWorld.distanceTo(first.materialIndexWorld) > 0.12,
    'cup material index reaches a different surface point next orbit');
  near(
    first.materialIndexWorld.distanceTo(geometry.lensCenter),
    geometry.cupOuterRadius,
    7e-16,
    'first material index remains on cup sphere',
  );
  near(
    next.materialIndexWorld.distanceTo(geometry.lensCenter),
    geometry.cupOuterRadius,
    7e-16,
    'next material index remains on cup sphere',
  );
  disposeModel(model.root);
});

test('movement 393 cup shell and polishing layer remain concentric with the stationary spherical work', () => {
  const model = createMovementModel(catalog.movements[392]);
  const data = model.root.userData;
  const { blocks, constraints, geometry, stateAtTime, timeline } = data;
  assert.match(constraints.sphericalConformity, /same point/);
  assert.ok(geometry.maximumSurfaceColatitude < Math.PI / 2);
  near(geometry.polishingRadius - geometry.lensRadius,
    geometry.renderContactGap, 1e-16, 'render-only contact separation');

  for (let sample = 0; sample < 720; sample += 1) {
    const time = timeline.carrierOrbitDuration * sample / 720;
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    const outerCenter = blocks.cupRotor.userData.outerShell
      .getWorldPosition(new THREE.Vector3());
    const polishingCenter = blocks.cupRotor.userData.polishingLayer
      .getWorldPosition(new THREE.Vector3());
    vectorNear(outerCenter, geometry.lensCenter, 5e-16,
      'outer cup cap shares lens center');
    vectorNear(polishingCenter, geometry.lensCenter, 5e-16,
      'polishing cap shares lens center');
    vectorNear(state.polishingSurfaceCenter, geometry.lensCenter, 0,
      'analytic polishing center closure');
  }
  disposeModel(model.root);
});

test('movement 393 update binds carrier orbit and passive axial cup spin to the same analytic state', () => {
  const model = createMovementModel(catalog.movements[392]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;

  for (const orbit of [-1.17, 0, 0.21, 0.50, 0.83, 2.14]) {
    const time = timeline.carrierOrbitDuration * orbit;
    const expected = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.shaftRotor.rotation.y, expected.carrierAngle, 0,
      'carrier angle update');
    near(blocks.cupRotor.rotation.y, expected.cupRelativeSpin, 0,
      'passive cup spin update');
    vectorNear(
      blocks.ball.getWorldPosition(new THREE.Vector3()),
      expected.ballCenter,
      4e-16,
      'ball-joint visual orbit',
    );
    vectorNear(
      blocks.cupRotor.userData.materialIndex.getWorldPosition(
        new THREE.Vector3(),
      ),
      expected.materialIndexWorld,
      5e-16,
      'cup material-index visual update',
    );
    near(data.contacts.ballAndSocket.ballCenterError,
      0, 4e-16, 'updated ball-joint closure');
    near(data.contacts.polishingCupToSphericalLens.idealNormalGap,
      0, 0, 'ideal spherical contact');
    near(data.contacts.polishingCupToSphericalLens
      .rotationMinimizingResidual, 0, 2e-16,
    'updated zero-twist closure');
  }
  disposeModel(model.root);
});

test('movement 393 stationary lens indexes never inherit either shaft or cup rotation', () => {
  const model = createMovementModel(catalog.movements[392]);
  const data = model.root.userData;
  const indexes = data.blocks.lens.userData.fixedSurfaceIndexes;
  const initial = indexes.map((marker) => marker.position.clone());
  for (const orbit of [0.13, 0.47, 0.91, 1.33]) {
    model.update(data.timeline.carrierOrbitDuration * orbit);
    indexes.forEach((marker, index) => {
      vectorNear(marker.position, initial[index], 0,
        'stationary work-surface index');
      assert.equal(marker.parent, data.blocks.lens);
    });
  }
  disposeModel(model.root);
});

test('movement 393 factory is isolated before movement 507', () => {
  const model393 = createMovementModel(catalog.movements[392]);
  const model507 = createMovementModel(catalog.movements[506]);
  assert.equal(model393.root.userData.fidelity, 'authored');
  assert.equal(
    model393.root.userData.archetype,
    'eccentric-ball-and-socket-spherical-lens-polishing-cup-orbit-with-passive-zero-twist-spin',
  );
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model393.root);
  disposeModel(model507.root);
});
