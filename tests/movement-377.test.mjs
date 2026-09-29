import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

function angleNear(actual, expected, tolerance, message) {
  const error = THREE.MathUtils.euclideanModulo(
    actual - expected + Math.PI,
    FULL_TURN,
  ) - Math.PI;
  near(error, 0, tolerance, message);
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
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 377 is one broad external treadmill with fourteen rigid steps, one output axle, and one world-stationary person', () => {
  const movement = catalog.movements[376];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 377);
  assert.equal(movement.number, '377');
  assert.equal(movement.category, 'Rotary machines');
  assert.equal(
    movement.archetype,
    'external-person-treadmill-peripheral-step-weight-drive',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-person-steps-up/);
  assert.match(data.mechanism, /one-broad-horizontal-axis-treadmill/);
  assert.match(data.mechanism, /fourteen-cross-width-peripheral-boards/);
  assert.match(data.mechanism, /one-rigid-rotor/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /person stepping upward/);
  assert.match(degreesOfFreedom.note, /one rigid rotor/);

  for (const component of [blocks.fixedFrame, blocks.person]) {
    assert.equal(component.parent, model.root);
  }
  for (const component of [
    blocks.axle,
    ...blocks.endRings,
    ...blocks.endSpokes,
    ...blocks.outerLugs,
    ...blocks.treadBoards,
    blocks.endGear,
  ]) assert.equal(component.parent, blocks.wheelRotor);
  // Brown draws no foundation slab, rail posts or white index.
  for (const component of [
    blocks.base,
    ...blocks.railPosts,
    blocks.wheelIndex,
  ]) assert.equal(component.parent, null);
  assert.equal(blocks.pedestalPlank.parent, blocks.fixedFrame);
  for (const component of [
    ...blocks.arms,
    blocks.cap,
    blocks.head,
    ...blocks.legRoots,
    blocks.torso,
  ]) assert.equal(component.parent, blocks.person);
  assert.equal(blocks.wheelRotor.parent, model.root);
  assert.equal(blocks.treadBoards.length, 14);
  assert.equal(blocks.outerLugs.length, 28);
  assert.equal(blocks.endRings.length, 2);
  assert.equal(blocks.endSpokes.length, 8);
  assert.equal(blocks.legRoots.length, 2);
  assert.equal(blocks.kneePivots.length, 2);
  assert.equal(blocks.person.userData.fixedInWorld, true);
  assert.equal(blocks.fixedFrame.userData.fixed, true);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'broad-horizontal-axis-treadmill-drum-and-output-shaft',
    'cross-width-peripheral-step-board-rigid-with-treadmill',
    'world-stationary-person-stepping-up-descending-peripheral-boards',
    'coaxial-output-shaft-rigid-with-treadmill-drum',
    'fixed-hand-rail-above-person-station',
    'source-visible-fixed-diagonal-side-frame',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 377 preserves Brown\'s tread-board, weight-drive, penal-labor, grinding, and irrigation evidence without inventing a source animation', () => {
  const movement = catalog.movements[376];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate377;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_377.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /tread-mill employed in jails/);
  assert.match(movement.description, /grinding grain/);
  assert.match(movement.description, /weight of persons/);
  assert.match(movement.description, /tread-boards on periphery/);
  assert.match(movement.description, /raising water for irrigation/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(
    dynamics.sourceSpecifiesDimensionsTimingTreadCountPersonMassOrLoad,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);
  assert.match(dynamics.treatment, /gravity torque/);
  assert.match(dynamics.treatment, /analytic/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.endWheelCenter.toArray(), [168, 278]);
  assert.deepEqual(plate.endWheelLeft.toArray(), [45, 279]);
  assert.deepEqual(plate.endWheelTop.toArray(), [169, 146]);
  assert.deepEqual(plate.personHeadCenter.toArray(), [461, 89]);
  assert.deepEqual(plate.personTorsoCenter.toArray(), [431, 215]);
  assert.deepEqual(plate.diagonalFrameTop.toArray(), [230, 38]);
  assert.deepEqual(plate.diagonalFrameBottom.toArray(), [416, 500]);
  assert.equal(plate.treadFieldRight, 519);
  assert.equal(plate.handRailY, 106);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.engravingEvidence, /broad field/);
  assert.match(evidence.engravingEvidence, /standing externally/);
  assert.match(evidence.reconstructionDisclosure, /fourteen tread boards/);
  assert.match(evidence.reconstructionDisclosure, /balance and muscle\/contact forces remain unqualified/);
  disposeModel(model.root);
});

test('movement 377 all fourteen cross-width boards are equally spaced rigid members with exact circular positions and velocities', () => {
  const model = createMovementModel(catalog.movements[376]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;

  assert.equal(geometry.treadCount, 14);
  near(geometry.treadPitch, FULL_TURN / geometry.treadCount, 0,
    'equal tread pitch');
  assert.deepEqual(blocks.treadBoards.map((board) => board.userData.index),
    Array.from({ length: geometry.treadCount }, (_, index) => index));
  for (const board of blocks.treadBoards) {
    near(board.geometry.parameters.depth,
      geometry.drumWidth * 0.95, 0,
      `board ${board.userData.index} spans the drum width`);
  }
  for (let sample = -720; sample <= 1440; sample += 1) {
    const state = stateAtTime(geometry.wheelPeriod * sample / 720);
    assert.equal(state.treads.length, geometry.treadCount);
    for (let index = 0; index < geometry.treadCount; index += 1) {
      const tread = state.treads[index];
      near(tread.angle,
        state.wheelAngle + index * geometry.treadPitch,
        0, `tread ${index} unwrapped angle`);
      near(tread.localCenter.length(), geometry.treadRadius, 3e-16,
        `tread ${index} center radius`);
      vectorNear(tread.center, geometry.wheelCenter.clone().add(
        new THREE.Vector3(
          Math.cos(tread.angle) * geometry.treadRadius,
          Math.sin(tread.angle) * geometry.treadRadius,
          0,
        ),
      ), 0, `tread ${index} exact circular position`);
      vectorNear(tread.velocity,
        new THREE.Vector3().crossVectors(
          Z_AXIS.clone().multiplyScalar(state.wheelAngularSpeed),
          tread.localCenter,
        ), 0, `tread ${index} rigid-wheel velocity`);
      const next = state.treads[(index + 1) % geometry.treadCount];
      const separation = THREE.MathUtils.euclideanModulo(
        next.angle - tread.angle,
        FULL_TURN,
      );
      near(separation, geometry.treadPitch, 4e-15,
        `tread ${index} equal angular spacing`);
    }
  }
  disposeModel(model.root);
});

test('movement 377 has clockwise descending motion at the external right-hand station and exact mean no-drift climbing', () => {
  const model = createMovementModel(catalog.movements[376]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const expectedStation = geometry.wheelCenter.clone().add(
    new THREE.Vector3(
      Math.cos(geometry.personStationAngle) * geometry.treadRadius,
      Math.sin(geometry.personStationAngle) * geometry.treadRadius,
      0,
    ),
  );

  vectorNear(geometry.personStationPoint, expectedStation, 0,
    'person station on peripheral tread circle');
  assert.ok(geometry.personStationPoint.x > geometry.wheelCenter.x,
    'person station is right of the axle');
  assert.ok(geometry.personStationPoint.y > geometry.wheelCenter.y,
    'person station is slightly above the axle');
  assert.match(transmission.meanNoDriftLaw, /equal and opposite/);
  for (let sample = -900; sample <= 1800; sample += 1) {
    const state = stateAtTime(geometry.wheelPeriod * sample / 900);
    assert.ok(state.wheelAngularSpeed < 0, 'wheel turns clockwise');
    assert.ok(state.surfaceVelocityAtPerson.y < 0,
      'right-side tread velocity has a downward component');
    near(state.surfaceVelocityAtPerson.length(),
      geometry.treadRadius * Math.abs(state.wheelAngularSpeed),
      5e-16, 'peripheral tread speed');
    near(state.relativeClimbVelocity.length(),
      transmission.personRelativeClimbSpeed, 5e-16,
      'person climb speed relative to wheel');
    vectorNear(state.relativeClimbVelocity,
      state.surfaceVelocityAtPerson.clone().negate(), 0,
      'relative climb opposes moving tread');
    near(state.netPersonWorldVelocity.length(), 0, 0,
      'mean person world position has zero drift');
  }
  disposeModel(model.root);
});

test('movement 377 right-of-axis person weight gives clockwise torque and positive steady output power', () => {
  const model = createMovementModel(catalog.movements[376]);
  const data = model.root.userData;
  const { geometry, stateAtTime, transmission } = data;
  const state = stateAtTime(1.23);
  const lever = state.personCenterOfMass.clone()
    .sub(geometry.wheelCenter);
  const crossProduct = lever.clone().cross(state.personWeight);

  vectorNear(state.personCenterOfMass,
    geometry.personCenterOfMass, 0,
    'fixed person center of mass');
  assert.ok(lever.x > 0);
  assert.ok(state.personWeight.y < 0);
  near(state.personWeightTorque, crossProduct.z, 0,
    'weight moment cross product');
  assert.ok(state.personWeightTorque < 0,
    'right-side weight drives clockwise rotation');
  assert.ok(state.wheelAngularSpeed < 0);
  near(state.outputPower,
    state.personWeightTorque * state.wheelAngularSpeed,
    0, 'steady torque-times-speed output power');
  assert.ok(state.outputPower > 0);
  near(transmission.outputTorque, state.personWeightTorque, 0,
    'published output torque');
  near(transmission.outputPower, state.outputPower, 0,
    'published output power');
  model.update(1.23, 0.016);
  near(data.weightDrive.torque, state.personWeightTorque, 0,
    'renderer publishes weight torque');
  near(data.weightDrive.outputPower, state.outputPower, 0,
    'renderer publishes output power');
  disposeModel(model.root);
});

test('movement 377 two-leg gait is smooth, alternating, derivative-consistent, and closes seven cycles per wheel turn', () => {
  const model = createMovementModel(catalog.movements[376]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  const step = 1e-6;

  assert.equal(geometry.gaitCyclesPerWheelTurn, 7);
  assert.deepEqual(geometry.legPhaseOffsets, [0, Math.PI]);
  for (let sample = 0; sample <= 320; sample += 1) {
    const time = geometry.wheelPeriod * sample / 320 + 0.002;
    const state = stateAtTime(time);
    const before = stateAtTime(time - step);
    const after = stateAtTime(time + step);
    assert.equal(state.legStates.length, 2);
    for (let index = 0; index < 2; index += 1) {
      const leg = state.legStates[index];
      const numericalUpperRate = (
        after.legStates[index].upperAngle
          - before.legStates[index].upperAngle
      ) / (2 * step);
      const numericalLowerRate = (
        after.legStates[index].lowerAngle
          - before.legStates[index].lowerAngle
      ) / (2 * step);
      // Relative tolerance: near the straight knee the central difference
      // of a fast joint carries O(step^2) error of a few 1e-8 rad/s.
      near(numericalUpperRate, leg.upperAngularSpeed,
        1e-7 * Math.max(1, Math.abs(leg.upperAngularSpeed)),
        `leg ${index} upper analytic derivative`);
      near(numericalLowerRate, leg.lowerAngularSpeed,
        1e-7 * Math.max(1, Math.abs(leg.lowerAngularSpeed)),
        `leg ${index} lower analytic derivative`);
    }
    const halfCycleLater = stateAtTime(time + geometry.wheelPeriod / 14).legStates[0];
    near(state.legStates[1].upperAngle, halfCycleLater.upperAngle,
      1e-13, 'upper legs alternate by half a gait cycle');
    near(state.legStates[1].lowerAngle, halfCycleLater.lowerAngle,
      1e-13, 'lower legs alternate by half a gait cycle');
  }
  disposeModel(model.root);
});

test('movement 377 renderer binds its wheel, cross-width boards, and leg joints while person and safety frame stay fixed', () => {
  const model = createMovementModel(catalog.movements[376]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const personPosition = blocks.person.position.clone();
  const handRailPosition = blocks.handRail.position.clone();
  const diagonalPosition = blocks.diagonalGuard.position.clone();

  for (let frame = 0; frame <= 720; frame += 1) {
    const time = geometry.wheelPeriod * 2 * frame / 720;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.wheelRotor.rotation.z, expected.wheelAngle, 0,
      'rendered wheel angle');
    for (let index = 0; index < 2; index += 1) {
      near(blocks.legRoots[index].rotation.z,
        expected.legStates[index].upperAngle, 0,
        `rendered upper leg ${index}`);
      near(blocks.kneePivots[index].rotation.z,
        expected.legStates[index].lowerAngle, 0,
        `rendered lower leg ${index}`);
    }
    vectorNear(blocks.person.position, personPosition, 0,
      'person torso group remains fixed in world');
    vectorNear(blocks.handRail.position, handRailPosition, 0,
      'hand rail remains fixed');
    vectorNear(blocks.diagonalGuard.position, diagonalPosition, 0,
      'diagonal frame remains fixed');
    blocks.wheelRotor.updateMatrixWorld(true);
    for (let index = 0; index < geometry.treadCount; index += 1) {
      const renderedCenter = blocks.treadBoards[index]
        .getWorldPosition(new THREE.Vector3());
      vectorNear(renderedCenter, expected.treads[index].center,
        4e-15, `rendered tread ${index} center`);
    }
  }
  disposeModel(model.root);
});

test('movement 377 closes one clockwise wheel turn and seven gait cycles before movement 507 remains the next authored draft', () => {
  const movement = catalog.movements[376];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.wheelPeriod);

  near(closure.wheelAngle - start.wheelAngle, -FULL_TURN, 0,
    'one unwrapped clockwise wheel turn');
  near(closure.gaitPhase - start.gaitPhase,
    geometry.gaitCyclesPerWheelTurn * FULL_TURN, 0,
    'seven unwrapped gait cycles');
  angleNear(closure.wheelAngle, start.wheelAngle, 0,
    'wheel index closes');
  for (let index = 0; index < 2; index += 1) {
    angleNear(closure.legStates[index].upperAngle,
      start.legStates[index].upperAngle, 1e-13,
      `upper leg ${index} closes`);
    angleNear(closure.legStates[index].lowerAngle,
      start.legStates[index].lowerAngle, 1e-13,
      `lower leg ${index} closes`);
  }
  for (let index = 0; index < geometry.treadCount; index += 1) {
    vectorNear(closure.treads[index].center,
      start.treads[index].center, 4e-15,
      `tread ${index} closes`);
  }
  assert.equal(timeline.demonstrationPeriod, geometry.wheelPeriod);
  assert.equal(data.animationTiming.authoredCyclePeriod,
    geometry.wheelPeriod);
  assert.ok(data.animationTiming.displayCycleDuration >= 12);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.ok(Number.isFinite(data.groundFloorY));

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});

// Pass 90: the diagonal plank lies in the plane of the wheel's face, in front
// of the spur wheel and its standard; the rail the man holds runs along the
// drum's axis through the plank's hole; the man is centred across the drum.
test('movement 377 plank lies in the wheel-face plane, the rail passes through its hole, and the man is centred on the drum', () => {
  const model = createMovementModel(catalog.movements[376]);
  const { blocks, geometry } = model.root.userData;
  const plank = blocks.diagonalGuard;
  const plane = plank.userData.plane;
  plank.geometry.computeBoundingBox();
  const box = plank.geometry.boundingBox;
  near(box.min.z, plane.z - plane.thickness / 2, 1e-6, 'plank back face is one z plane');
  near(box.max.z, plane.z + plane.thickness / 2, 1e-6, 'plank front face is one z plane');
  assert.ok(box.max.y - box.min.y > 4, 'plank runs from above the rail to the ground');
  near(plane.leanFromUpright, THREE.MathUtils.degToRad(36), 1e-12, 'plank lean');
  // The plank stands in front of the end gear, bearing and standard.
  blocks.endGear.geometry.computeBoundingBox();
  // Pass 101: just in front of the bearing (0.16 half-length) and standard.
  assert.ok(box.min.z > blocks.endGear.geometry.boundingBox.max.z + 0.3);
  assert.ok(box.min.z > blocks.bearing.position.z + 0.16 + 0.02);
  assert.ok(box.min.z < blocks.bearing.position.z + 0.16 + 0.1, 'plank close in front of the standard');
  // The rail is a rod along z through the hole and 0.03 proud of the plank.
  blocks.handRail.geometry.computeBoundingBox();
  const rail = blocks.handRail.geometry.boundingBox;
  const railCenter = rail.getCenter(new THREE.Vector3());
  near(railCenter.x, plane.holeCenter.x, 1e-6, 'rail axis x at the hole');
  near(railCenter.y, plane.holeCenter.y, 1e-6, 'rail axis y at the hole');
  near(rail.max.z, box.max.z + 0.03, 1e-6, 'rail end stands proud of the plank');
  // Pass 101: the rail is trimmed to 0.3 past the far hand, inside the drum's width.
  assert.ok(rail.min.z > -geometry.drumWidth / 2, 'rail ends within the drum width');
  assert.equal(blocks.railPosts.length, 0, 'the plank alone carries the rail');
  const position = plank.geometry.attributes.position;
  let holeRadius = Infinity;
  for (let index = 0; index < position.count; index += 1) {
    holeRadius = Math.min(holeRadius, Math.hypot(
      position.getX(index) - plane.holeCenter.x,
      position.getY(index) - plane.holeCenter.y,
    ));
  }
  near(holeRadius, 0.055, 1e-6, 'the rod fills the plank hole');
  near(plane.top.distanceTo(plane.holeCenter), 0.6, 1e-6, 'hole 0.6 below the plank top');
  // The man is centred across the drum's width, both hands on the rail.
  near(geometry.personCenterOfMass.z, 0, 0, 'man centred across the drum');
  assert.equal(blocks.arms.length, 2);
  const hands = blocks.arms.map((arm) => {
    model.root.updateMatrixWorld(true);
    const fist = arm.children.find((child) => child.userData.role === 'person-hand-gripping-rail' && child.visible);
    return fist.getWorldPosition(new THREE.Vector3());
  });
  near(hands[0].z + hands[1].z, 0, 1e-6, 'hands symmetric about the drum centre');
  for (const hand of hands) {
    near(Math.hypot(hand.x - railCenter.x, hand.y - railCenter.y), 0, 1e-6, 'fist closed round the rail axis');
  }
  disposeModel(model.root);
});

// Pass 101 (user review): an upright climb, not a seated one. The torso is
// upright (no lean), the planted thighs average under 50 degrees from
// vertical, the hips stand over the stance foot as it leaves the board with
// the knee nearly straight, the soles stay on near-level treads, and both
// hands hold the rail in front at shoulder height.
test('movement 377 man climbs upright with his hips over the leaving foot and holds the rail at shoulder height', () => {
  const model = createMovementModel(catalog.movements[376]);
  const data = model.root.userData;
  const gait = data.geometry.gaitGeometry;
  let planted = 0, thigh = 0, tilt = 0, liftOver = 0, liftKnee = 0;
  for (let i = 0; i <= 4000; i += 1) {
    for (const leg of data.stateAtTime(4 * i / 4000).legStates) {
      if (!leg.planted) continue;
      planted += 1;
      thigh += Math.abs(leg.upperAngle);
      const sole = THREE.MathUtils.euclideanModulo(leg.soleAngle + Math.PI, FULL_TURN) - Math.PI;
      tilt = Math.max(tilt, Math.abs(sole));
      if (leg.progress > gait.stanceFraction - 0.01) {
        liftOver = Math.max(liftOver, Math.abs(leg.ankleX - gait.hipX));
        liftKnee = Math.max(liftKnee, leg.lowerAngle);
      }
    }
  }
  assert.ok(thigh / planted < THREE.MathUtils.degToRad(50), `mean planted thigh ${THREE.MathUtils.radToDeg(thigh / planted)}`);
  assert.ok(liftOver < 0.06, `hips over the leaving foot (${liftOver})`);
  assert.ok(liftKnee < THREE.MathUtils.degToRad(27), `knee nearly straight at lift-off (${THREE.MathUtils.radToDeg(liftKnee)})`);
  assert.ok(tilt < THREE.MathUtils.degToRad(14), `treads near level under the sole (${THREE.MathUtils.radToDeg(tilt)})`);
  model.root.updateMatrixWorld(true);
  for (const arm of data.blocks.arms) {
    const shoulder = arm.geometry.userData.reposed.shoulder;
    const hand = arm.userData.hand;
    assert.ok(Math.abs(hand.y - shoulder.y) < 0.05, 'hands at shoulder height');
    assert.ok(hand.x < shoulder.x - 0.3, 'hands in front of the chest');
    const elbow = arm.geometry.userData.reposed.elbow;
    assert.ok(elbow.y < shoulder.y && elbow.y < hand.y, 'elbows down');
  }
  disposeModel(model.root);
});
