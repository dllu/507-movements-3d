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
const ARCHETYPE =
  'selectable-direct-or-fixed-carrier-three-planet-capstan-with-opposed-three-to-one-annulus-output';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
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

test('movement 412 is one capstan with a sun, three equal idlers, internal annulus, direct clutch, and carrier brake', () => {
  const movement = catalog.movements[411];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 412);
  assert.equal(movement.number, '412');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /drumhead is rigid with the central spindle/);
  assert.match(data.mechanism, /[Tt]hree equal fifteen-tooth idlers/);
  assert.match(data.mechanism, /one-third its speed/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.simultaneouslyActiveCoordinates, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.spindleRotor.parent, model.root);
  assert.equal(blocks.barrelRotor.parent, model.root);
  assert.equal(blocks.carrierRotor.parent, model.root);
  assert.equal(blocks.sunGear.parent, blocks.spindleRotor);
  assert.equal(blocks.annulusGear.parent, blocks.barrelRotor);
  assert.equal(blocks.directClutch.parent, blocks.spindleRotor);
  assert.equal(blocks.carrierBrake.parent, blocks.fixedFrame);
  assert.equal(blocks.planets.length, 3);
  assert.equal(blocks.carrierArms.length, 3);
  assert.equal(blocks.carrierLugs.length, 2);
  assert.equal(blocks.carrierBrakePins.length, 2);
  assert.equal(blocks.directClutchDogs.length, 6);
  assert.equal(blocks.barrelCrownDogs.length, 6);
  assert.equal(blocks.barrelWhelps.length, 8);
  blocks.planets.forEach((planet) => {
    assert.equal(planet.parent, blocks.carrierRotor);
  });

  const roles = [];
  const belts = [];
  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) gears.push(object);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(
    gears.map(({ userData }) => userData.teeth).sort((a, b) => a - b),
    [15, 15, 15, 15, 45],
  );
  for (const role of [
    'input-drumhead-rigidly-fixed-on-spindle',
    'central-spindle-rigidly-fixed-to-drumhead',
    'fifteen-tooth-central-sun-on-spindle',
    'forty-five-tooth-internal-annulus-rigid-with-barrel',
    'axially-sliding-dog-clutch-locking-drumhead-to-barrel',
    'two-pin-base-brake-fixing-planet-carrier-for-triple-purchase',
    'white-drumhead-input-rotation-index',
    'white-barrel-whelp-output-rotation-index-ball',
    'white-planet-carrier-rotation-index',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 412 records Brown’s plate, stated operating modes, and unavailable-animation boundary', () => {
  const movement = catalog.movements[411];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate412;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_412.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /base of capstan/);
  assert.match(movement.description, /simple or compound machine/);
  assert.match(movement.description, /single or triple purchase/);
  assert.match(movement.description,
    /drumhead and barrel rotate independently/);
  assert.match(movement.description, /former, being fixed on spindle/);
  assert.match(movement.description, /when locked to barrel turns it also/);
  assert.match(movement.description,
    /when unlocked, wheel-work acts/);
  assert.match(movement.description,
    /opposite directions, with velocities as three to one/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks its Animated control unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.idealCompoundMechanicalAdvantage, 3);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.sunApproximateCenterPixels, [258, 259]);
  assert.deepEqual(plate.planetApproximateCentersPixels, [
    [164, 205],
    [355, 205],
    [258, 356],
  ]);
  assert.deepEqual(plate.annulusApproximateBoundsPixels,
    [70, 73, 454, 464]);
  assert.equal(evidence.explicitInBrownDescription.length, 9);
  assert.match(evidence.engravingEvidence,
    /central external gear.*three equal.*idlers.*internal-tooth annulus/);
  assert.match(evidence.reconstructionDisclosure,
    /Representative 15\/15\/45 tooth counts/);
  assert.match(evidence.reconstructionDisclosure,
    /independently engineered physically compatible interpretation/);
  assert.equal(data.displayTreatment.skinOpacity, 0.14);
  assert.equal(data.displayTreatment.mechanicalGeometryOmitted, true);
  disposeModel(model.root);
});

test('movement 412 pitch geometry closes both sun-planet and planet-annulus meshes with an exact three-to-one annulus ratio', () => {
  const model = createMovementModel(catalog.movements[411]);
  const { blocks, geometry, transmission } = model.root.userData;

  near(geometry.sunPitchRadius,
    geometry.sunTeeth * geometry.module / 2, 0, 'sun pitch radius');
  near(geometry.planetPitchRadius,
    geometry.planetTeeth * geometry.module / 2, 0,
    'planet pitch radius');
  near(geometry.annulusPitchRadius,
    geometry.annulusTeeth * geometry.module / 2, 0,
    'annulus pitch radius');
  near(geometry.planetCenterRadius,
    geometry.sunPitchRadius + geometry.planetPitchRadius, 0,
    'external mesh center distance');
  near(geometry.internalCenterRadius,
    geometry.annulusPitchRadius - geometry.planetPitchRadius, 0,
    'internal mesh center distance');
  near(geometry.planetCenterRadius,
    geometry.internalCenterRadius, 5e-16,
    'common planet center circle');
  assert.equal(geometry.sunTeeth, geometry.planetTeeth);
  assert.equal(geometry.annulusTeeth, 3 * geometry.sunTeeth);
  assert.equal(transmission.annulusToSunToothRatio, 3);
  near(blocks.annulusGear.userData.toothIndexOffset,
    Math.PI / geometry.annulusTeeth, 0,
    'half-pitch internal tooth phase');
  assert.equal(blocks.annulusGear.userData.toothProfile,
    'true-involute-internal');
  assert.equal(blocks.sunGear.userData.toothProfile, 'true-involute');
  blocks.planets.forEach((planet, index) => {
    assert.equal(planet.userData.toothProfile, 'true-involute');
    near(Math.hypot(planet.position.x, planet.position.z),
      geometry.planetCenterRadius, 3e-16,
      `planet ${index + 1} center radius`);
    sameAngle(
      Math.atan2(planet.position.z, planet.position.x),
      geometry.planetAngles[index],
      3e-16,
      `planet ${index + 1} carrier angle`,
    );
  });
  for (let index = 0; index < geometry.planetAngles.length; index += 1) {
    const next = geometry.planetAngles[(index + 1) % 3]
      + (index === 2 ? FULL_TURN : 0);
    near(next - geometry.planetAngles[index], FULL_TURN / 3, 5e-16,
      `planet ${index + 1} equal spacing`);
  }
  disposeModel(model.root);
});

test('movement 412 locked single purchase turns drumhead, spindle, barrel, annulus, carrier, and planets together one-to-one', () => {
  const model = createMovementModel(catalog.movements[411]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumAngleResidual = 0;
  let maximumSpeedResidual = 0;

  for (let sample = 0; sample < 20000; sample += 1) {
    const time = 3 * sample / 20000;
    const state = stateAtTime(time);
    assert.equal(state.stage, 'locked-single-purchase-direct-drive');
    assert.equal(state.directClutchEngagement, 1);
    assert.equal(state.carrierBrakeEngagement, 0);
    maximumAngleResidual = Math.max(maximumAngleResidual,
      Math.abs(state.sunAngle - state.annulusAngle),
      Math.abs(state.sunAngle - state.carrierAngle),
      Math.abs(state.sunAngle - state.planetAngle));
    maximumSpeedResidual = Math.max(maximumSpeedResidual,
      Math.abs(state.sunAngularSpeed - state.annulusAngularSpeed),
      Math.abs(state.sunAngularSpeed - state.carrierAngularSpeed),
      Math.abs(state.sunAngularSpeed - state.planetAngularSpeed));
  }
  assert.equal(maximumAngleResidual, 0);
  assert.equal(maximumSpeedResidual, 0);
  const start = stateAtTime(0);
  const finish = stateAtTime(3);
  near(finish.sunAngle - start.sunAngle,
    geometry.directInputTurns * FULL_TURN, 0,
    'one direct input revolution');
  near(finish.annulusAngle - start.annulusAngle,
    geometry.directInputTurns * FULL_TURN, 0,
    'one direct barrel revolution');
  disposeModel(model.root);
});

test('movement 412 unlocked triple purchase fixes the carrier and drives the barrel oppositely at exactly one-third drumhead speed', () => {
  const model = createMovementModel(catalog.movements[411]);
  const { geometry, stateAtTime } = model.root.userData;
  let movingSamples = 0;
  let maximumRatioResidual = 0;

  for (let sample = 0; sample < 30000; sample += 1) {
    const time = 5 + 5 * sample / 30000;
    const state = stateAtTime(time);
    assert.equal(state.stage,
      'unlocked-triple-purchase-compound-drive');
    assert.equal(state.directClutchEngagement, 0);
    assert.equal(state.carrierBrakeEngagement, 1);
    assert.equal(state.carrierAngularSpeed, 0);
    if (Math.abs(state.sunAngularSpeed) <= 1e-10) continue;
    movingSamples += 1;
    assert.ok(state.sunAngularSpeed > 0);
    assert.ok(state.annulusAngularSpeed < 0);
    assert.ok(state.planetAngularSpeed < 0);
    maximumRatioResidual = Math.max(maximumRatioResidual,
      Math.abs(state.annulusAngularSpeed
        + state.sunAngularSpeed / 3));
    near(state.compoundVelocityRatio, -3, 9e-16,
      'signed drumhead/barrel speed ratio');
  }
  assert.ok(movingSamples > 29900);
  assert.ok(maximumRatioResidual < 9e-16);
  const start = stateAtTime(5);
  const finish = stateAtTime(10);
  near(finish.sunAngle - start.sunAngle,
    geometry.compoundInputTurns * FULL_TURN, 0,
    'three compound input revolutions');
  near(finish.annulusAngle - start.annulusAngle,
    geometry.compoundOutputTurns * FULL_TURN, 0,
    'one opposed compound output revolution');
  near(finish.carrierAngle - start.carrierAngle, 0, 0,
    'base-fixed carrier');
  near(finish.planetAngle - start.planetAngle,
    -geometry.compoundInputTurns * FULL_TURN, 0,
    'equal planet opposed revolutions');
  disposeModel(model.root);
});

test('movement 412 satisfies both epicyclic mesh equations throughout both modes and every stationary selector shift', () => {
  const model = createMovementModel(catalog.movements[411]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumWillisAngleResidual = 0;
  let maximumWillisSpeedResidual = 0;
  let maximumExternalResidual = 0;
  let maximumInternalResidual = 0;
  const stages = new Set();

  for (let sample = -24000; sample <= 48000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 24000);
    stages.add(state.stage);
    maximumWillisAngleResidual = Math.max(maximumWillisAngleResidual,
      Math.abs(state.willisAngleResidual));
    maximumWillisSpeedResidual = Math.max(maximumWillisSpeedResidual,
      Math.abs(state.willisSpeedResidual));
    maximumExternalResidual = Math.max(maximumExternalResidual,
      Math.abs(state.externalMeshAngleResidual));
    maximumInternalResidual = Math.max(maximumInternalResidual,
      Math.abs(state.internalMeshAngleResidual));
    assert.ok(state.activeDriveCoordinates <= 1,
      'only drive, clutch, or brake may move at one time');
    assert.equal(
      state.directClutchEngagement * state.carrierBrakeEngagement,
      0,
      'direct clutch and carrier brake interlock',
    );
    if (state.directClutchEngagement > 0) {
      near(state.directClutchAngularAlignmentResidual, 0, 9e-16,
        'dog clutch only moves or runs while angularly aligned');
    }
    if (state.carrierBrakeEngagement > 0) {
      sameAngle(state.carrierAngle, 0, 3e-15,
        'carrier brake pin-hole alignment');
    }
    if (Math.abs(state.directClutchEngagementSpeed) > 1e-12
      || Math.abs(state.carrierBrakeEngagementSpeed) > 1e-12) {
      assert.equal(state.sunAngularSpeed, 0);
      assert.equal(state.annulusAngularSpeed, 0);
      assert.equal(state.carrierAngularSpeed, 0);
      assert.equal(state.planetAngularSpeed, 0);
    }
  }
  assert.deepEqual(stages, new Set([
    'locked-single-purchase-direct-drive',
    'stationary-direct-clutch-release',
    'stationary-carrier-brake-engagement',
    'unlocked-triple-purchase-compound-drive',
    'stationary-carrier-brake-release',
    'stationary-direct-clutch-engagement',
  ]));
  assert.ok(maximumWillisAngleResidual < 1.2e-13);
  assert.ok(maximumWillisSpeedResidual < 4e-14);
  assert.ok(maximumExternalResidual < 5e-14);
  assert.ok(maximumInternalResidual < 1.2e-13);
  disposeModel(model.root);
});

test('movement 412 analytic gear speeds and accelerations match finite differences away from stage boundaries', () => {
  const model = createMovementModel(catalog.movements[411]);
  const { stateAtTime } = model.root.userData;
  const step = 1e-5;
  for (const time of [0.61, 1.37, 2.26, 5.62, 6.84, 8.31, 9.44]) {
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    for (const [angleKey, speedKey, accelerationKey] of [
      ['sunAngle', 'sunAngularSpeed', 'sunAngularAcceleration'],
      ['annulusAngle', 'annulusAngularSpeed',
        'annulusAngularAcceleration'],
      ['carrierAngle', 'carrierAngularSpeed',
        'carrierAngularAcceleration'],
      ['planetAngle', 'planetAngularSpeed',
        'planetAngularAcceleration'],
    ]) {
      const numericalSpeed = (after[angleKey] - before[angleKey])
        / (2 * step);
      const numericalAcceleration = (after[speedKey] - before[speedKey])
        / (2 * step);
      near(numericalSpeed, state[speedKey], 1.5e-8,
        `${speedKey} finite difference at ${time}`);
      near(numericalAcceleration, state[accelerationKey], 4e-8,
        `${accelerationKey} finite difference at ${time}`);
    }
  }
  disposeModel(model.root);
});

test('movement 412 update binds every rotor, planet spin, clutch slide, brake pin, and selector lever to the analytic state', () => {
  const model = createMovementModel(catalog.movements[411]);
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 1.4, 3.55, 4.45, 5, 7.3, 9.8, 10.55, 11.55]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.spindleRotor.rotation.y, state.sunAngle, 0,
      'spindle rotor update');
    near(blocks.barrelRotor.rotation.y, state.annulusAngle, 0,
      'barrel rotor update');
    near(blocks.carrierRotor.rotation.y, state.carrierAngle, 0,
      'carrier rotor update');
    blocks.planets.forEach((planet) => {
      near(planet.userData.rotor.rotation.z, state.planetRelativeAngle, 0,
        'planet relative spin update');
    });
    near(blocks.directClutch.position.y, state.directClutchY, 0,
      'direct clutch axial update');
    blocks.carrierBrakePins.forEach(({ pin, whiteBand }) => {
      near(pin.position.y, state.carrierBrakeY, 0,
        'carrier brake pin update');
      near(whiteBand.position.y, state.carrierBrakeY + 0.18, 0,
        'carrier brake white band update');
    });
    near(blocks.selector.rotation.z,
      THREE.MathUtils.lerp(-0.48, 0.48, state.selectorPosition), 0,
      'coordinated selector lever update');
  }
  const closure = stateAtTime(geometry.cycleDuration);
  const source = stateAtTime(0);
  sameAngle(closure.sunAngle, source.sunAngle, 0,
    'sun cycle closure');
  sameAngle(closure.annulusAngle, source.annulusAngle, 0,
    'annulus cycle closure');
  sameAngle(closure.carrierAngle, source.carrierAngle, 0,
    'carrier cycle closure');
  sameAngle(closure.planetAngle, source.planetAngle, 0,
    'planet cycle closure');
  assert.equal(closure.directClutchEngagement,
    source.directClutchEngagement);
  assert.equal(closure.carrierBrakeEngagement,
    source.carrierBrakeEngagement);
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.cycleDuration);
  assert.equal(model.root.userData.animationTiming.targetCycleDuration, 2);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 412 wheel-work', () => {
  const movement412 = catalog.movements[411];
  const movement507 = catalog.movements[506];
  const model412 = createMovementModel(movement412);
  const model507 = createMovementModel(movement507);

  assert.equal(movement412.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype,
    model412.root.userData.archetype);
  assert.notEqual(model507.root.userData.mechanism,
    model412.root.userData.mechanism);
  disposeModel(model412.root);
  disposeModel(model507.root);
});

import {solidSurface as rimSolid, surfacePoints as pawlPoints} from './helpers/solid-surface.mjs';
function pawlRimGap(model) {
  const b = model.root.userData.blocks, rim = b.notchedRim, surface = rimSolid(rim.geometry);
  model.root.updateMatrixWorld(true);
  let minimum = Infinity;
  for (const group of b.lockingPawls) {
    const mesh = group.children[0], transform = rim.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
    for (const point of pawlPoints(mesh.geometry)) {
      const p = point.clone().applyMatrix4(transform);
      if (surface.box.distanceToPoint(p) > 0.05) continue;
      minimum = Math.min(minimum, surface.signedDistance(p, 0.05));
    }
  }
  return minimum;
}

test('movement 412 rim has six notches and two separately pivoted pawls that lock it both ways', () => {
  const model = createMovementModel(catalog.movements[411]);
  const { blocks, geometry, stateAtTime, timeline } = model.root.userData;
  assert.equal(geometry.lockingPawls.notches.length, 6);
  assert.equal(blocks.notchedRim.parent, blocks.barrelRotor);
  assert.equal(blocks.lockingPawls.length, 2);
  for (const pawl of blocks.lockingPawls) assert.equal(pawl.parent, blocks.spindleRotor);
  // Engaged, each nose sits in its notch with running clearance only.
  model.update(0);
  const seated = pawlRimGap(model);
  assert.ok(seated >= -1e-6 && seated < 0.012, `seated clearance ${seated}`);
  const noseDepth = geometry.lockingPawls.rimOuter - geometry.lockingPawls.notchDepth;
  assert.ok(noseDepth < geometry.lockingPawls.rimOuter - 0.09 && noseDepth > geometry.lockingPawls.rimInner);
  // The opposed steep faces lock the barrel to the drumhead in both senses.
  const barrel = blocks.barrelRotor.rotation.y;
  for (const turn of [0.02, -0.02]) {
    blocks.barrelRotor.rotation.y = barrel + turn;
    assert.ok(pawlRimGap(model) < -0.01, `rim turned ${turn} must meet a nose`);
  }
  // Every sampled pose over the demonstration is clear; lifted pawls ride on
  // the rim's outer face (running clearance only, never hovering) while the
  // wheel-work turns the barrel against the drumhead.
  for (let i = 0; i <= 96; i += 1) {
    const time = timeline.cycleDuration * i / 96;
    model.update(time);
    const state = stateAtTime(time);
    assert.ok(pawlRimGap(model) >= -1e-6, `pawl into rim at ${time}`);
    if (state.stage === 'unlocked-triple-purchase-compound-drive') {
      assert.equal(state.pawlLift, geometry.lockingPawls.liftAngle);
      const liftedGap = pawlRimGap(model);
      // 0.006 on the plain rim; slightly more while the nose bridges a notch.
      assert.ok(liftedGap >= -1e-6 && liftedGap < 0.015, `lifted pawl riding clearance ${liftedGap} at ${time}`);
    }
    if (Math.abs(state.sunAngle - state.annulusAngle) % (2 * Math.PI) > 1e-9
      && Math.abs(Math.abs(state.sunAngle - state.annulusAngle) % (2 * Math.PI) - 2 * Math.PI) > 1e-9) {
      assert.equal(state.pawlsLocked, false, 'the pawls never hold while drumhead and barrel differ');
    }
  }
});
