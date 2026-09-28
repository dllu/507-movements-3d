import { assertReadableTiming } from './helpers/display-timing.mjs';
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

test('movement 244 is a balanced Prony-brake absorption dynamometer', () => {
  const movement = catalog.movements[243];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 244);
  assert.equal(movement.number, '244');
  assert.equal(movement.title, 'Prony-Brake Dynamometer');
  assert.equal(movement.category, 'Brakes & dynamometers');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'balanced-prony-brake-dynamometer-with-weighted-torque-arm',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'a-smooth-rotating-drum-slides-inside-a-stationary-clamped-shoe-and-strap-whose-friction-moment-is-balanced-by-scale-weights-on-arm-D',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.brakeType, 'prony-brake-absorption-dynamometer');
  assert.equal(transmission.brakeAssemblyRotatesWithDrum, false);
  assert.equal(transmission.frictionInterface, 'continuous-sliding-contact');
  assert.equal(transmission.scaleWeightBalancesFrictionMoment, true);
  assert.equal(blocks.drum.userData.role, 'smooth-shaft-mounted-brake-drum-A');
  assert.equal(
    blocks.brakeAssembly.userData.role,
    'stationary-clamped-brake-and-balanced-torque-arm-D',
  );
  assert.equal(blocks.lever.userData.role, 'horizontal-dynamometer-torque-arm-D');
  assert.equal(blocks.scalePan.userData.role, 'hanging-scale-pan-B');
  disposeModel(model.root);
});

test('movement 244 preserves the measured unavailable source plate', () => {
  const movement = catalog.movements[243];
  const model = createMovementModel(movement);
  const { geometry, sourceReference, stateAtTime } = model.root.userData;
  const plate = sourceReference.plate244;

  assert.equal(sourceReference.officialDescription, movement.description);
  assert.deepEqual(plate.rasterDrumCenter.toArray(), [94, 286]);
  assert.equal(plate.rasterDrumRadius, 42);
  assert.deepEqual(plate.rasterLeverLeft.toArray(), [17, 236]);
  assert.deepEqual(plate.rasterLeverRight.toArray(), [462, 236]);
  assert.deepEqual(plate.rasterLeftClampScrew.toArray(), [43, 219]);
  assert.deepEqual(plate.rasterRightClampScrew.toArray(), [139, 219]);
  assert.deepEqual(plate.rasterSuspension.toArray(), [434, 253]);
  assert.deepEqual(plate.rasterUpperStop.toArray(), [355, 205]);
  assert.deepEqual(plate.rasterLowerStop.toArray(), [355, 270]);
  assert.deepEqual(plate.rasterScalePanCenter.toArray(), [414, 459]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /one smooth rotating drum A/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 63,
    edition: 21,
    illustrationPage: 62,
    publicationYear: 1908,
  });
  vectorNear(geometry.drumCenter, new THREE.Vector3(0, 0, 0), 0,
    'source-mapped drum center');
  near(geometry.leverLeftX, -0.924, 2e-16, 'source-mapped lever left end');
  near(geometry.leverRightX, 4.416, 2e-16, 'source-mapped lever right end');
  vectorNear(
    geometry.suspensionPoint,
    new THREE.Vector3(4.08, 0.6, 0.3),
    5e-16,
    'source-mapped scale suspension point',
  );
  const source = stateAtTime(0);
  assert.equal(source.sourcePose, true);
  assert.equal(source.stage, 'steady-balanced-prony-brake-power-measurement');
  near(source.drumAngle, 0, 0, 'source drum angle');
  near(source.leverAngle, 0, 0, 'source lever angle');
  disposeModel(model.root);
});

test('movement 244 brake covers the drum with one upper shoe and one articulated lower band', () => {
  const model = createMovementModel(catalog.movements[243]);
  const { blocks, geometry, transmission } = model.root.userData;

  near(geometry.upperShoeWrapAngle, 2 * Math.PI / 3, 5e-16,
    'upper wooden shoe wrap');
  near(geometry.lowerBandWrapAngle, 4 * Math.PI / 3, 1e-15,
    'lower articulated band wrap');
  near(
    geometry.upperShoeWrapAngle + geometry.lowerBandWrapAngle,
    FULL_TURN,
    9e-16,
    'complete friction circumference',
  );
  near(blocks.upperShoe.userData.innerRadius, geometry.drumRadius, 0,
    'upper shoe bears on drum');
  near(blocks.lowerBandBacking.userData.innerRadius, geometry.drumRadius, 0,
    'lower backing bears on drum');
  assert.equal(blocks.lowerStraps.length, 7);
  assert.equal(blocks.strapPins.length, 8);
  assert.equal(blocks.clampScrews.length, 2);
  assert.equal(blocks.shoeHangers.length, 2);
  assert.equal(transmission.lowerArticulatedStrapCount, 7);
  assert.equal(transmission.clampAdjustmentScrewCount, 2);
  assert.equal(transmission.stopCount, 2);
  assert.deepEqual(
    blocks.lowerStraps.map((strap) => strap.userData.strapIndex),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(
    blocks.strapPins.map((pin) => pin.userData.strapBoundaryIndex),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  blocks.clampScrews.forEach(({ nut, screw }, index) => {
    assert.equal(nut.userData.clampIndex, index);
    assert.equal(screw.userData.clampIndex, index);
    assert.equal(screw.userData.role, 'brake-pressure-adjusting-screw');
    assert.equal(nut.userData.role, 'brake-pressure-adjusting-nut');
  });
  disposeModel(model.root);
});

test('movement 244 clamp friction and hanging weights have exactly balanced moments', () => {
  const model = createMovementModel(catalog.movements[243]);
  const { blocks, geometry, measurement, stateAtTime } = model.root.userData;
  const clampMoment = measurement.frictionCoefficient
    * measurement.clampNormalForce * geometry.drumRadius;
  const weightMoment = measurement.weightForce * measurement.leverArm;

  near(clampMoment, measurement.frictionTorque, 5e-16,
    'clamp friction moment');
  near(weightMoment, measurement.frictionTorque, 3e-16,
    'scale weight moment');
  near(clampMoment, weightMoment, 3e-16, 'balanced moments');
  near(
    blocks.scaleWeights.reduce((sum, weight) => (
      sum + weight.userData.forceFraction
    ), 0),
    1,
    0,
    'calibrated weight fractions',
  );
  near(
    blocks.scaleWeights.reduce((sum, weight) => sum + weight.userData.force, 0),
    measurement.weightForce,
    0,
    'calibrated weight force',
  );
  const state = stateAtTime(37.25);
  near(state.balanceResidualTorque, 0, 0, 'steady-state residual torque');
  near(state.brakeAssemblyAngularSpeed, 0, 0,
    'balanced brake angular speed');
  assert.equal(measurement.scalePanTared, true);
  assert.match(measurement.driveAssumption, /external motive power/);
  disposeModel(model.root);
});

test('movement 244 reports shaft power by both Prony-brake identities', () => {
  const model = createMovementModel(catalog.movements[243]);
  const { geometry, measurement, stateAtTime } = model.root.userData;
  const angularSpeed = FULL_TURN / geometry.cyclePeriod;
  const torquePower = measurement.frictionTorque * angularSpeed;
  const suspensionVelocity = measurement.leverArm * angularSpeed;
  const weightPower = measurement.weightForce * suspensionVelocity;

  near(measurement.shaftRpm, 15, 3e-15, 'shaft revolutions per minute');
  near(measurement.suspensionTangentialSpeed, suspensionVelocity, 0,
    'equivalent suspension-point velocity');
  near(measurement.measuredPower, torquePower, 5e-16,
    'torque times angular velocity');
  near(measurement.measuredPower, weightPower, 5e-16,
    'weight times equivalent suspension velocity');
  assert.match(measurement.powerIdentity, /friction torque times shaft/);
  for (let sample = 0; sample <= 4096; sample += 1) {
    const time = geometry.cyclePeriod * 10 * sample / 4096;
    const state = stateAtTime(time);
    near(state.frictionPower, measurement.measuredPower, 5e-16,
      `constant measured power at sample ${sample}`);
    near(state.frictionWork, measurement.frictionTorque * state.drumAngle, 0,
      `absorbed work at sample ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 244 stops bound a small interval around the horizontal measuring pose', () => {
  const model = createMovementModel(catalog.movements[243]);
  const {
    blocks,
    geometry,
    stateAtTime,
    stopClearancesAtAngle,
  } = model.root.userData;

  assert.ok(geometry.lowerLeverAngleLimit < 0);
  assert.ok(geometry.upperLeverAngleLimit > 0);
  assert.ok(THREE.MathUtils.radToDeg(geometry.lowerLeverAngleLimit) > -5);
  assert.ok(THREE.MathUtils.radToDeg(geometry.upperLeverAngleLimit) < 5);
  near(
    stopClearancesAtAngle(geometry.lowerLeverAngleLimit).lower,
    0,
    6e-17,
    'lower stop contact at lower limit',
  );
  near(
    stopClearancesAtAngle(geometry.upperLeverAngleLimit).upper,
    0,
    6e-17,
    'upper stop contact at upper limit',
  );
  const horizontal = stopClearancesAtAngle(0);
  assert.ok(horizontal.lower > 0);
  assert.ok(horizontal.upper > 0);
  const state = stateAtTime(0);
  near(state.leverAngle, 0, 0, 'horizontal measuring pose');
  assert.equal(blocks.lowerStop.userData.fixed, true);
  assert.equal(blocks.upperStop.userData.fixed, true);
  assert.equal(blocks.lowerStop.userData.role, 'lower-horizontal-position-stop-C');
  assert.equal(
    blocks.upperStop.userData.role,
    'upper-horizontal-position-stop-C-prime',
  );
  disposeModel(model.root);
});

test('movement 244 renderer spins only the drum while friction contacts slide', () => {
  const model = createMovementModel(catalog.movements[243]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedObjects = [
    blocks.brakeAssembly,
    blocks.hangerEye,
    blocks.scalePan,
    ...blocks.scaleWeights,
    blocks.lowerStop,
    blocks.upperStop,
  ];
  const initialPositions = fixedObjects.map((object) => object.position.clone());
  const initialQuaternions = fixedObjects.map((object) => object.quaternion.clone());

  vectorNear(blocks.drum.userData.axis, Z_AXIS, 0, 'drum shaft axis');
  near(blocks.upperShoe.userData.innerRadius, geometry.drumRadius, 0,
    'upper sliding radial interface');
  near(blocks.lowerBandBacking.userData.innerRadius, geometry.drumRadius, 0,
    'lower sliding radial interface');
  assert.ok(geometry.drumDepth / 2 > -geometry.brakeDepth / 2);
  assert.ok(geometry.brakeDepth / 2 > -geometry.drumDepth / 2);

  for (let sample = 0; sample <= 2048; sample += 1) {
    const time = geometry.cyclePeriod * 10 * sample / 2048;
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.drum.userData.rotor.rotation.z, state.drumAngle, 3e-15,
      `rendered drum angle at sample ${sample}`);
    near(blocks.drumShaft.userData.rotor.rotation.z, state.drumAngle, 3e-15,
      `rendered shaft angle at sample ${sample}`);
    near(blocks.brakeAssembly.rotation.z, 0, 0,
      `stationary brake assembly at sample ${sample}`);
    fixedObjects.forEach((object, index) => {
      vectorNear(object.position, initialPositions[index], 0,
        `fixed object ${index} position at sample ${sample}`);
      near(object.quaternion.angleTo(initialQuaternions[index]), 0, 0,
        `fixed object ${index} orientation at sample ${sample}`);
    });
    const contacts = model.root.userData.contacts;
    for (const contact of [
      contacts.upperShoeToDrum,
      contacts.articulatedBandToDrum,
    ]) {
      assert.equal(contact.active, true);
      assert.equal(contact.sliding, true);
      near(
        contact.relativeSurfaceSpeed,
        geometry.drumRadius * state.drumAngularSpeed,
        0,
        `sliding surface speed at sample ${sample}`,
      );
    }
    near(
      contacts.upperShoeToDrum.normalForce
        + contacts.articulatedBandToDrum.normalForce,
      geometry.clampNormalForce,
      9e-16,
      `resolved clamp force at sample ${sample}`,
    );
    assert.equal(contacts.lowerStopToLever.active, false);
    assert.equal(contacts.upperStopToLever.active, false);
  }
  disposeModel(model.root);
});

test('movement 244 closes after one drum turn and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[243]);
  const { animationTiming, blocks, geometry, stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const end = stateAtTime(geometry.cyclePeriod);

  near(end.drumAngle - start.drumAngle, FULL_TURN, 0,
    'one drum revolution per authored cycle');
  near(end.drumTurns - start.drumTurns, 1, 0,
    'one drum turn per authored cycle');
  near(end.frictionWork, measurementFor(model).frictionTorque * FULL_TURN,
    9e-16, 'work absorbed per revolution');
  model.update(geometry.cyclePeriod);
  near(blocks.drum.userData.rotor.rotation.z, FULL_TURN, 0,
    'rendered one-turn closure');
  near(animationTiming.authoredCyclePeriod, 4, 0,
    'authored cycle duration');
  near(animationTiming.targetCycleDuration, 2, 0,
    'display cycle duration');
  assertReadableTiming(animationTiming);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});

function measurementFor(model) {
  return model.root.userData.measurement;
}

test('p92: the scale-ring hook pin stands centred in a round lug end, not on a square box end', () => {
  const model = createMovementModel(catalog.movements[243]);
  const byRole = (role) => {
    let found = null;
    model.root.traverse((object) => { if (object.userData.role === role) found = object; });
    assert.ok(found, role);
    return found;
  };
  const pin = byRole('scale-ring-hook-pin');
  const lug = byRole('scale-ring-hook-lug-under-beam');
  assert.equal(lug.geometry.type, 'ExtrudeGeometry', 'lug is one flat extrusion');
  const pinRadius = pin.geometry.parameters.radiusTop;
  const lugCentre = lug.position.clone();
  near(lugCentre.x, pin.position.x, 1e-9, 'lug end centred on the pin in x');
  near(lugCentre.y, pin.position.y, 1e-9, 'lug end centred on the pin in y');
  const position = lug.geometry.attributes.position;
  let below = 0;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    if (y < -1e-6) {
      below += 1;
      near(Math.hypot(x, y), 0.05, 1e-3, 'lug outline below the pin lies on its end arc');
    }
    assert.ok(Math.hypot(x, y) >= 0.05 - 1e-3 || y > 0, 'no outline point closer than the arc');
  }
  assert.ok(below > 20, 'lug has a round end below the pin');
  assert.ok(0.05 >= 1.6 * pinRadius, 'end arc radius at least 1.6 pin radii');
  disposeModel(model.root);
});

test('p93: lever D rests on the wooden block, centred on the pulley, with the pan hung under its ring', () => {
  const model = createMovementModel(catalog.movements[243]);
  try {
    model.update(0);
    model.root.updateMatrixWorld(true);
    const box = (role) => {
      const result = new THREE.Box3();
      model.root.traverse((object) => {
        if (!object.isMesh || !object.visible) return;
        let owner = object;
        while (owner && !owner.userData.role) owner = owner.parent;
        if (owner?.userData.role === role) result.union(new THREE.Box3().setFromObject(object));
      });
      assert.ok(!result.isEmpty(), role);
      return result;
    };
    const lever = box('horizontal-dynamometer-torque-arm-D');
    const block = box('upper-wooden-brake-block-under-lever-D');
    const drum = box('smooth-turned-friction-pulley-A');
    const ring = box('scale-B-suspension-eye');
    const pan = box('hanging-scale-pan-B');
    near((lever.min.z + lever.max.z) / 2, (drum.min.z + drum.max.z) / 2, 1e-6, 'lever centred on the pulley plane');
    near(block.max.y, lever.min.y, 1e-6, 'block top meets the lever underside');
    assert.ok(block.min.z < lever.min.z && block.max.z > lever.max.z, 'lever lies over the block, not in front of it');
    near((pan.min.z + pan.max.z) / 2, (ring.min.z + ring.max.z) / 2, 1e-6, 'pan centred under its ring');
    let forks = 0;
    model.root.traverse((object) => { if (/^strap-end-bolt-fork-/.test(object.userData.role ?? '')) forks += 1; });
    assert.equal(forks, 6, 'two forked bolt ends, each two cheeks and a bridge');
  } finally {
    disposeModel(model.root);
  }
});

test('p96: movement 244 strap hinge pins sit centred in the links and end in short heads; the pan carries three different weights', () => {
  const model = createMovementModel(catalog.movements[243]);
  const { strapPins, lowerStraps, scaleWeights } = model.root.userData.blocks;
  const radii = [];
  for (const strap of lowerStraps) {
    const p = strap.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 1) radii.push(Math.hypot(p.getX(i), p.getY(i)));
  }
  const inner = Math.min(...radii), outer = Math.max(...radii);
  model.root.updateMatrixWorld(true);
  const strapBox = new THREE.Box3();
  for (const strap of lowerStraps) strapBox.union(new THREE.Box3().setFromObject(strap));
  strapPins.forEach((pin, index) => {
    const r = Math.hypot(pin.position.x, pin.position.y);
    near(r, (inner + outer) / 2, 1e-9, `pin ${index} centred in the band`);
    const mesh = pin.userData.rotor?.children[0] ?? pin.children[0];
    const length = mesh.geometry.parameters.height;
    if (index > 0 && index < strapPins.length - 1) {
      assert.ok(length < strapBox.max.z - strapBox.min.z + 0.02, `inner pin ${index} trimmed to the strap`);
    }
  });
  const roles = scaleWeights.map((w) => w.userData.role).sort();
  assert.deepEqual(roles, ['calibrated-scale-weight', 'calibrated-scale-weight-bell', 'calibrated-scale-weight-block']);
  disposeModel(model.root);
});
