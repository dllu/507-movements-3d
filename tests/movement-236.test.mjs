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

test('movement 236 is one lever, two alternating pawls, and one fifteen-tooth ratchet', () => {
  const movement = catalog.movements[235];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    sourceAnimation,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 236);
  assert.equal(movement.number, '236');
  assert.equal(movement.title, 'Alternating Two-Pawl Ratchet');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'alternating-two-pawl-nearly-continuous-fifteen-tooth-ratchet',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(transmission.longPawlDrivesFirstHalf, true);
  assert.equal(transmission.shortPawlDrivesSecondHalf, true);
  assert.equal(transmission.wheelDwellsOnlyAtLeverReversals, false);
  // p101: the wheel is a flywheel and never stands.
  assert.equal(transmission.wheelStandsWhileEachPawlSeats, false);
  assert.equal(transmission.standingFractionOfCycle, 0);
  near(transmission.flywheel.minimumSpeedRatio, 0.85, 1e-15, 'coasting loses at most 15% of the speed');
  near(transmission.outputTeethPerLeverCycle, 2, 2e-14,
    'two tooth pitches per lever oscillation');
  assert.equal(blocks.ratchet.parent, model.root);
  assert.equal(blocks.lever.parent, model.root);
  assert.equal(blocks.longPawl.parent, model.root);
  assert.equal(blocks.shortPawl.parent, model.root);
  assert.notEqual(blocks.longPawl, blocks.shortPawl);
  assert.equal(blocks.ratchet.userData.teeth, 15);
  assert.equal(blocks.ratchet.userData.profilePoints.length, 45);
  assert.equal(blocks.leverJoints.length, 3);
  disposeModel(model.root);
});

test('movement 236 preserves the measured engraving layout and solved handoff', () => {
  const model = createMovementModel(catalog.movements[235]);
  const {
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate236;

  assert.deepEqual(plate.rasterWheelCenter.toArray(), [285, 335]);
  assert.deepEqual(plate.rasterFulcrum.toArray(), [326, 140]);
  assert.deepEqual(plate.rasterLongPawlPivot.toArray(), [242, 130]);
  assert.deepEqual(plate.rasterShortPawlPivot.toArray(), [372, 178]);
  assert.deepEqual(plate.rasterHandleEnd.toArray(), [48, 113]);
  assert.deepEqual(plate.rasterLongPawlNose.toArray(), [205, 305]);
  assert.deepEqual(plate.rasterShortPawlNose.toArray(), [260, 243]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.inferredRatchetTeeth, 15);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.match(plate.inferredTopology, /two alternately driving hinged pawls/);
  assert.deepEqual(sourceReference.primaryScan, {
    edition: 21,
    printedPage: 61,
    publicationYear: 1908,
  });

  near(geometry.sourceScale, 0.016, 0, 'engraving scale');
  near(geometry.toothPitch, FULL_TURN / 15, 0, 'fifteen-tooth pitch');
  // Both noses seat fully in the root, touching the face and the back.
  near(geometry.longDriveGeometry.fraction, geometry.seatFraction, 0,
    'long pawl seats in the root');
  near(geometry.shortDriveGeometry.fraction, geometry.seatFraction, 0,
    'short pawl seats in the root');
  assert.ok(geometry.seatFraction > 0.8 && geometry.seatFraction < 0.9);
  assert.ok(Math.abs(geometry.handoffError) < 3e-14);
  near(
    geometry.shortStartAngle - geometry.longEndSeatAngle,
    geometry.handoffTarget,
    3e-14,
    'the two selected roots share one ratchet phase',
  );
  near(THREE.MathUtils.radToDeg(geometry.leverAmplitude), 14.7, 1e-12, 'lever amplitude');
  // p99: b and c share the two teeth of each lever cycle in proportion to
  // their own leverage (b 1.175, c 0.825), so neither idles through spare
  // stroke; each returning pawl still retreats exactly two pitches.
  near(geometry.longDriveTeeth + geometry.shortDriveTeeth, 2, 1e-15, 'two teeth per lever cycle');
  near(geometry.longDriveTeeth, 1.175, 1e-15, 'b drives 1.175 teeth');
  // Brown's drawn pose is the handoff: the lever at the top of its swing.
  assert.equal(geometry.sourceCyclePhase, geometry.flywheelTopCoordinate);
  const source = stateAtCycleCoordinate(geometry.sourceCyclePhase);
  near(THREE.MathUtils.radToDeg(source.leverAngle), 0, 1e-9, 'lever at the engraving angle at the top of its swing');
  let top = -Infinity, bottom = Infinity;
  for (let i = 0; i <= 8192; i += 1) {
    const { leverAngle } = stateAtCycleCoordinate(i / 8192);
    top = Math.max(top, leverAngle); bottom = Math.min(bottom, leverAngle);
  }
  near(top, geometry.leverBias + geometry.leverAmplitude, 1e-7, 'the lever turns at its drawn top');
  near(bottom, geometry.leverBias - geometry.leverAmplitude, 1e-7, 'and at the bottom of its swing');
  vectorNear(source.longAnchor, geometry.sourceLongAnchor, 0.05,
    'engraving long-pawl pivot');
  vectorNear(source.shortAnchor, geometry.sourceShortAnchor, 0.05,
    'engraving short-pawl pivot');
  vectorNear(
    source.longTipCenter,
    new THREE.Vector2(-1.28, 0.48),
    0.33,
    'source nose region with the nose seated in its root',
  );
  disposeModel(model.root);
});

for (const [longPawl, name] of [[true, 'long pawl b'], [false, 'short pawl c']]) {
  test(`movement 236 ${name} drives the flywheel with rigid seated contact on its own half-stroke`, () => {
    const model = createMovementModel(catalog.movements[235]);
    const { geometry, stateAtCycleCoordinate, transmission } = model.root.userData;
    const { events } = transmission.flywheel;
    const [catchAt, separateAt] = longPawl ? [events.bCatch, events.bSeparation] : [events.cCatch, events.cSeparation];
    const [from, to] = longPawl ? [0, geometry.flywheelTopCoordinate] : [geometry.flywheelTopCoordinate, 1];
    const samples = 16_384;
    let previousWheelAngle = -Infinity;
    let driven = 0;
    for (let sample = 0; sample < samples; sample += 1) {
      const coordinate = from + (to - from) * sample / samples;
      const state = stateAtCycleCoordinate(coordinate);
      assert.equal(state.longDriving, longPawl);
      assert.equal(state.activePawl, longPawl ? 'long-b' : 'short-c');
      assert.ok(state.wheelAngle > previousWheelAngle, `the wheel never stands (${coordinate})`);
      previousWheelAngle = state.wheelAngle;
      const driving = coordinate > catchAt + 1e-9 && coordinate < separateAt - 1e-9;
      if (coordinate < catchAt - 1e-9 || coordinate > separateAt + 1e-9) assert.equal(state.engaged, false);
      if (!driving) continue;
      driven += 1;
      assert.equal(state.engaged, true);
      assert.ok(Math.abs(longPawl ? state.longProfileClearance : state.shortProfileClearance) < 3e-12);
      assert.ok(state.activePawlLengthError < 3e-12);
      assert.ok(state.contactCenterError < 4e-12);
      assert.ok(state.activeTipVelocityError < 1e-9);
      assert.ok(state.activeCompressionTorque > 1);
      // While a pawl drives, the wheel's speed is the pawl's.
      near(state.wheelAngularSpeed, state.wheelAngleDerivativePerLeverAngle * state.leverAngularSpeed,
        1e-7, `driven speed at ${coordinate}`);
    }
    // Pass 102: the unloaded lever returns briskly, so c's drive is short;
    // it still takes up at least minimumDriveTeeth of pitch.
    assert.ok(driven / samples > (longPawl ? 0.4 : 0.15), `${name} drives for ${driven / samples} of its half`);
    // Each pawl lets go a twentieth of a pitch short of its end seat and is
    // caught again after the wheel has coasted through the reversal.
    const released = stateAtCycleCoordinate(separateAt);
    near(released.localWheelAngle / geometry.toothPitch,
      longPawl ? geometry.longDriveTeeth - 0.05 : 1.95, 1e-9, 'separation station');
    disposeModel(model.root);
  });
}

test('movement 236 returned pawls ride the teeth, rigid and outside every tooth', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { stateAtCycleCoordinate } = model.root.userData;
  const samples = 32_768;
  let previousLongTip = null;
  let previousShortTip = null;
  let maximumLongStep = 0;
  let maximumShortStep = 0;
  let maximumIdleToeClearance = 0;
  let restingSamples = 0;
  for (let sample = 0; sample <= samples; sample += 1) {
    const coordinate = sample / samples;
    const state = stateAtCycleCoordinate(coordinate);
    assert.ok(state.longProfileClearance > -1e-10);
    assert.ok(state.shortProfileClearance > -1e-10);
    assert.equal(state.returnedPawlLiftedClear, true);
    assert.ok(state.longPawlLengthError < 3e-12);
    assert.ok(state.shortPawlLengthError < 3e-12);
    if (state.returnedPawlResting) restingSamples += 1;
    maximumIdleToeClearance = Math.max(
      maximumIdleToeClearance,
      state.longDriving
        ? state.shortProfileClearance
        : state.longProfileClearance,
    );
    if (previousLongTip) {
      maximumLongStep = Math.max(
        maximumLongStep,
        state.longTipCenter.distanceTo(previousLongTip),
      );
      maximumShortStep = Math.max(
        maximumShortStep,
        state.shortTipCenter.distanceTo(previousShortTip),
      );
    }
    previousLongTip = state.longTipCenter;
    previousShortTip = state.shortTipCenter;
  }
  // Brown draws both pawls lying on the teeth: the idle pawl rests on the
  // wheel (toe or flank) except for brief drops off a tooth corner, and never
  // swings clear of the rim.
  // Drops now take several frames each, so the idle pawl flies more often.
  assert.ok(restingSamples / (samples + 1) > 0.8,
    `idle pawl rests on the teeth ${restingSamples / (samples + 1)}`);
  assert.ok(maximumIdleToeClearance < 0.25,
    `idle toe clearance ${maximumIdleToeClearance}`);
  // The drops are quick but continuous (no teleporting between samples).
  assert.ok(maximumLongStep < 4e-3,
    `long-pawl maximum sample step ${maximumLongStep}`);
  assert.ok(maximumShortStep < 4e-3,
    `short-pawl maximum sample step ${maximumShortStep}`);
  disposeModel(model.root);
});

test('movement 236 flywheel turns continuously: never stands, coasts through each reversal', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { geometry, stateAtCycleCoordinate, transmission } = model.root.userData;
  const samples = 32_768;
  const drivingSpeed = transmission.flywheel.drivingSpeedPitchesPerCycle * geometry.toothPitch * geometry.cyclesPerSecond;
  let slowest = Infinity, fastest = 0, coasting = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const state = stateAtCycleCoordinate((sample + 0.5) / samples);
    assert.equal(state.wheelDwelling, false);
    slowest = Math.min(slowest, state.wheelAngularSpeed);
    fastest = Math.max(fastest, state.wheelAngularSpeed);
    if (!state.engaged) coasting += 1;
  }
  near(fastest, drivingSpeed, 1e-12, 'driving speed');
  assert.ok(slowest >= 0.85 * drivingSpeed - 1e-12, `slowest ${slowest / drivingSpeed} of the driving speed`);
  near(coasting / samples, transmission.flywheel.coastFractionOfCycle, 2e-3, 'coasting fraction');
  // At both lever reversals the lever stops but the wheel runs on.
  for (const coordinate of [0, geometry.flywheelTopCoordinate, 1]) {
    const state = stateAtCycleCoordinate(coordinate);
    assert.ok(Math.abs(state.leverAngularSpeed) < 1e-9, `lever reverses at ${coordinate}`);
    assert.ok(state.wheelAngularSpeed > 0.85 * drivingSpeed, `wheel runs on at ${coordinate}`);
  }
  near(stateAtCycleCoordinate(1).wheelAngle - stateAtCycleCoordinate(0).wheelAngle,
    2 * geometry.toothPitch, 4e-15, 'two pitches per lever cycle');
  disposeModel(model.root);
});

test('movement 236 reported speeds match finite differences for both pawls', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;
  const coordinateStep = 1e-6;
  const secondsPerCoordinate = 1 / geometry.cyclesPerSecond;
  const speedAt = (coordinate, key) => {
    const before = stateAtCycleCoordinate(coordinate - coordinateStep)[key];
    let after = stateAtCycleCoordinate(coordinate + coordinateStep)[key];
    while (after - before > Math.PI) after -= FULL_TURN;
    while (after - before < -Math.PI) after += FULL_TURN;
    return (after - before) / (2 * coordinateStep * secondsPerCoordinate);
  };
  for (const coordinate of [0.07, 0.13, 0.24, 0.37,
    0.63, 0.74, 0.88, 0.93]) {
    const state = stateAtCycleCoordinate(coordinate);
    near(state.leverAngularSpeed, speedAt(coordinate, 'leverAngle'), 2e-7,
      `lever speed at ${coordinate}`);
    near(state.wheelAngularSpeed, speedAt(coordinate, 'wheelAngle'), 2e-7,
      `wheel speed at ${coordinate}`);
    // A returning pawl's speed is the slope of its tracked table.
    near(state.longPawlAngularSpeed,
      speedAt(coordinate, 'longPawlAngle'), state.longDriving && state.engaged ? 2e-7 : 1e-4,
      `long-pawl speed at ${coordinate}`);
    near(state.shortPawlAngularSpeed,
      speedAt(coordinate, 'shortPawlAngle'), state.shortDriving && state.engaged ? 2e-7 : 1e-4,
      `short-pawl speed at ${coordinate}`);
  }
  disposeModel(model.root);
});

test('movement 236 renderer binds both pawls and closes before movement 339', () => {
  const model = createMovementModel(catalog.movements[235]);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;

  for (const time of [0, 1, 2, 3]) {
    model.update(time);
    const state = model.root.userData.kinematics;
    near(blocks.lever.userData.rotor.rotation.z, state.leverAngle, 0,
      `rendered lever at ${time}`);
    near(blocks.ratchet.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered ratchet at ${time}`);
    near(blocks.ratchetShaft.userData.rotor.rotation.z, state.wheelAngle, 0,
      `rendered output shaft at ${time}`);
    vectorNear(
      new THREE.Vector2(blocks.longPawl.position.x, blocks.longPawl.position.y),
      state.longAnchor,
      0,
      `rendered long-pawl anchor at ${time}`,
    );
    vectorNear(
      new THREE.Vector2(
        blocks.shortPawl.position.x,
        blocks.shortPawl.position.y,
      ),
      state.shortAnchor,
      0,
      `rendered short-pawl anchor at ${time}`,
    );
    near(blocks.longPawl.rotation.z, state.longPawlAngle, 0,
      `rendered long pawl at ${time}`);
    near(blocks.shortPawl.rotation.z, state.shortPawlAngle, 0,
      `rendered short pawl at ${time}`);
    vectorNear(
      new THREE.Vector2(
        blocks.activeContactMarker.position.x,
        blocks.activeContactMarker.position.y,
      ),
      state.activeProfilePoint,
      0,
      `rendered active contact at ${time}`,
    );
  }
  assert.equal(animationTiming.authoredCyclePeriod, transmission.cyclePeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  near(stateAtCycleCoordinate(15).wheelAngle - stateAtCycleCoordinate(0).wheelAngle, 2 * FULL_TURN, 2e-14,
    'fifteen lever cycles close two wheel revolutions');
  model.root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  assert.ok(size.x > 5.5);
  assert.ok(size.y > 5.4);
  // Only the wheel, pawls, lever and their plain pins: no studs or flanges
  // reach back behind the mechanism.
  // p101: the lever's back face sits on the pawl eyes, so the stack is
  // about 0.71 deep (was 0.94 with the pawls hung on bare pins behind it).
  assert.ok(size.z > 0.65 && size.z < 0.76);
  const lever = blocks.lever, eyeFront = (pawl, plane) => {
    const box = new THREE.Box3().setFromObject(pawl.children.find((o) => /eye-boss-to-lever/.test(o.userData.role ?? '')) ?? pawl.userData.pivotHub);
    return box.max.z;
  };
  for (const pawl of [blocks.longPawl, blocks.shortPawl]) {
    near(eyeFront(pawl) , lever.position.z - 0.09, 0.003, 'pawl eye meets the lever back face');
  }
  const fixedStuds = [];
  model.root.traverse((object) => { if (/fixed-stud/.test(object.userData.role ?? '')) fixedStuds.push(object); });
  assert.equal(fixedStuds.length, 0);
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  // The dark pivot rings Brown only inks are retired.
  assert.ok(meshCount >= 17);

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model289.root);
});

test('movement 236 pawls b and c are straight bars of one breadth with wedge ends fitted to the valley', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { blocks, geometry } = model.root.userData;
  const valley = THREE.MathUtils.radToDeg(Math.acos(
    geometry.baseFaceOuter.clone().sub(geometry.baseFaceRoot).normalize().dot(
      new THREE.Vector2(
        Math.cos((geometry.toothOuterEndPhase - 1) * geometry.toothPitch) * geometry.ratchetOuterRadius,
        Math.sin((geometry.toothOuterEndPhase - 1) * geometry.toothPitch) * geometry.ratchetOuterRadius,
      ).sub(geometry.baseFaceRoot).normalize(),
    ),
  ));
  for (const pawl of [blocks.longPawl, blocks.shortPawl]) {
    const length = pawl.userData.length;
    const [lower, upper] = geometry.pawlFlankPolylines(length);
    // One straight upper edge from the toe to the eye, centred on the hinge.
    assert.equal(upper.length, 2);
    near(upper[1][1], 0.095, 1e-3, 'bar centred on its hinge pin');
    // The lower edge is the upper edge a breadth below it.
    const direction = Math.atan2(upper[0][1] - upper[1][1], upper[0][0] - upper[1][0]);
    const offset = ([x, y]) => -(x - upper[1][0]) * Math.sin(direction) + (y - upper[1][1]) * Math.cos(direction);
    near(offset(lower[1]), -0.19, 1e-9, 'breadth at the knee');
    near(offset(lower[2]), -0.19, 1e-9, 'breadth at the eye');
    // The wedge's included angle is the valley's less the stroke's turn.
    const wedge = geometry.pawlWedges.find((w) => w.length === length);
    const included = THREE.MathUtils.radToDeg(wedge.lowerDirection - wedge.upperDirection);
    assert.ok(included > 40 && included < valley, `wedge ${included} valley ${valley}`);
  }
  disposeModel(model.root);
});

test('movement 236 lever runs at a natural pace: no flick at the reversals (pass 102)', () => {
  const model = createMovementModel(catalog.movements[235]);
  const { stateAtCycleCoordinate, transmission } = model.root.userData;
  const { flywheel } = transmission;
  const samples = 4096;
  const speeds = [];
  let previous = null;
  let largestStep = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const state = stateAtCycleCoordinate(sample / samples);
    speeds.push(Math.abs(state.leverAngularSpeed));
    if (previous !== null) largestStep = Math.max(largestStep, Math.abs(state.leverAngle - previous));
    previous = state.leverAngle;
  }
  const sorted = [...speeds].sort((a, b) => a - b);
  const ratio = Math.max(...speeds) / sorted[samples >> 1];
  // The plain quintic reversal peaked at 2.94x the median lever speed.
  assert.ok(ratio < 1.75, `peak/median lever speed ${ratio}`);
  assert.ok(largestStep < 0.001, `lever path continuous (${largestStep})`);
  // The fixed shaping coefficients: each reversal turns once, leaves the
  // catching pawl its minimum drive, and no grid neighbour is flatter.
  for (const [fromLong, key] of [[true, 'top'], [false, 'bottom']]) {
    const shape = flywheel.reversalShapes[key];
    const chosen = flywheel.solveReversalShape(fromLong, shape);
    assert.equal(chosen.signChanges, 1);
    assert.ok(flywheel.drivenAfterReversal(fromLong, chosen) >= flywheel.minimumDriveTeeth - 1e-9);
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const neighbour = flywheel.solveReversalShape(fromLong, [shape[0] + da, shape[1] + db]);
      if (!neighbour || neighbour.signChanges !== 1
        || flywheel.drivenAfterReversal(fromLong, neighbour) < flywheel.minimumDriveTeeth) continue;
      assert.ok(neighbour.peakRate >= chosen.peakRate - 0.02, `${key} neighbour ${da},${db} flatter`);
    }
  }
  disposeModel(model.root);
});
