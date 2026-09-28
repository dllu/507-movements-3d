import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'persian-irrigation-wheel-with-six-curved-stream-driven-floats-hollow-shaft-and-pin-tipped-suspended-buckets';
const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
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

test('movement 441 has six rigid curved floats, one hollow shaft, and six separately suspended buckets', () => {
  const movement = catalog.movements[440];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 441);
  assert.equal(movement.number, '441');
  assert.equal(movement.category, 'Water wheels & turbines');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism,
    /One rigid six-float wheel turns counterclockwise about a fixed hollow shaft/);
  assert.match(data.mechanism,
    /bucket hangs from every float tip on a free pivot/);
  assert.match(data.mechanism,
    /lug meets one fixed pin, the bucket tilts and empties/);
  assert.equal(geometry.floatCount, 6);
  assert.equal(blocks.arms.length, 6);
  assert.equal(blocks.buckets.length, 6);
  assert.equal(blocks.bucketWaters.length, 6);
  assert.equal(blocks.floatWaters.length, 6);
  assert.equal(blocks.channelMarkers.length, 6);
  assert.equal(blocks.tripLugs.length, 6);
  assert.equal(blocks.bucketSpills.length, 6);
  assert.equal(blocks.wheel.parent, model.root);
  assert.equal(blocks.hollowShaft.parent, blocks.wheel);
  blocks.arms.forEach((arm, index) => {
    assert.equal(arm.parent, blocks.wheel);
    assert.equal(blocks.buckets[index].parent, arm);
    assert.equal(blocks.floatWaters[index].parent, arm);
    // Source presentation removes the white channel tracer markers Brown does not draw.
    assert.equal(blocks.channelMarkers[index].parent, null);
    assert.equal(blocks.bucketWaters[index].parent, blocks.buckets[index]);
    assert.equal(blocks.tripLugs[index].parent, blocks.buckets[index]);
  });
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.bucketSuspensionPivotsPassive, true);
  assert.equal(degreesOfFreedom.curvedFloatsIndependent, false);
  assert.equal(degreesOfFreedom.hollowShaftIndependent, false);
  assert.equal(degreesOfFreedom.bucketFillAndTipIndependent, false);

  const belts = [];
  const ropes = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isRope) ropes.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(ropes, []);
  assert.equal(roles.filter((role) =>
    /^curved-stream-driven-float-blade-/.test(role)).length, 6);
  assert.equal(roles.filter((role) =>
    /^gravity-suspended-pin-tipped-bucket-/.test(role)).length, 6);
  assert.ok(roles.includes(
    'rotating-hollow-shaft-receiving-float-lifted-water'));
  // Pass 90: the caption's stationary pin tips each bucket, so it is shown
  // (with its minimal arm and post) rather than removed from the scene.
  assert.equal(blocks.stationaryTripPin.userData.role,
    'stationary-tipping-pin-at-high-station');
  assert.ok(roles.includes('stationary-tipping-pin-at-high-station'));
  assert.equal(blocks.stationaryTripPin.parent, model.root);
  // Each bucket hangs by one bail; no hanger bars or lug braces remain.
  assert.equal(roles.filter((role) => /^bucket-bail-hung-on-float-tip-pin-/.test(role)).length, 6);
  assert.equal(roles.some((role) => /^bucket-hanger-/.test(role)), false);
  disposeModel(model.root);
});

test('movement 441 source evidence and independently engineered details are clearly separated', () => {
  const movement = catalog.movements[440];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate441;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_441.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Persian wheel.*irrigation/);
  assert.match(movement.description, /hollow shaft and curved floats/);
  assert.match(movement.description,
    /extremities of which are suspended buckets or tubs/);
  assert.match(movement.description,
    /partly immersed in a stream acting on the convex surface/);
  assert.match(movement.description,
    /stationary pin.*tilting it/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /static engraving and caption.*Animated control is unavailable/);
  assert.equal(dynamics.bucketSwingImpactPinContactFluidCaptureLeakageSloshFloatHydrodynamicsBearingFrictionAndRotationalInertiaModeled,
    false);
  assert.match(dynamics.bucketTiming,
    /gravity-upright by exact counter-rotation.*pin-tipped/);
  assert.match(dynamics.floatWaterTransport,
    /water band and a quintic material tracer.*hollow shaft/);
  assert.match(dynamics.streamDrive,
    /rightward stream force.*positive counterclockwise torque sign/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateHollowShaftCenterPixels, [253, 210]);
  assert.deepEqual(plate.approximateTopBucketPivotPixels, [228, 32]);
  assert.deepEqual(plate.approximateBottomBucketPivotPixels, [260, 398]);
  assert.equal(plate.approximateWheelOuterRadiusPixels, 185);
  assert.equal(plate.approximateStreamSurfaceYPixels, 362);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /six spiral-curved floats.*six small freely hung buckets.*counterclockwise direction arrow/);
  assert.match(evidence.reconstructionDisclosure,
    /no dimensions, float section, shaft bore, bucket capacity.*independently engineered/);
  disposeModel(model.root);
});

test('movement 441 source pose matches six equally spaced outer pivots including top and bottom buckets', () => {
  const model = createMovementModel(catalog.movements[440]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(source.wheelAngle, geometry.sourceWheelAngle, 0,
    'source wheel rotation');
  near(sourcePose.wheelAngle, source.wheelAngle, 0,
    'recorded source wheel rotation');
  assert.equal(sourcePose.bucketPivotPositions.length, 6);
  assert.equal(sourcePose.bucketFills.length, 6);
  for (let index = 0; index < geometry.floatCount; index += 1) {
    const expectedAngle = geometry.sourceWheelAngle
      + index * FULL_TURN / geometry.floatCount;
    const expected = new THREE.Vector3(
      geometry.wheelCenter.x
        + geometry.bucketPivotRadius * Math.cos(expectedAngle),
      geometry.wheelCenter.y
        + geometry.bucketPivotRadius * Math.sin(expectedAngle),
      geometry.bucketPlaneZ,
    );
    vectorNear(source.bucketStates[index].pivotPosition, expected, 2e-15,
      `source bucket pivot ${index}`);
    vectorNear(sourcePose.bucketPivotPositions[index], expected, 2e-15,
      `recorded source bucket pivot ${index}`);
  }
  near(source.bucketStates[0].worldAngle, Math.PI / 2, 0,
    'top source bucket');
  sameAngle(source.bucketStates[3].worldAngle, 3 * Math.PI / 2,
    1e-15, 'bottom source bucket');
  sameAngle(source.bucketStates[5].worldAngle, Math.PI / 6,
    2e-15, 'upper-right source bucket');
  disposeModel(model.root);
});

test('movement 441 rightward bottom stream force drives the partly immersed wheel counterclockwise', () => {
  const model = createMovementModel(catalog.movements[440]);
  const { geometry, stateAtInputAngle } = model.root.userData;

  near(geometry.streamDriveTorque,
    geometry.floatOuterRadius * geometry.representativeStreamForce,
    0, 'bottom-force torque magnitude');
  assert.ok(geometry.streamDriveTorque > 0,
    'rightward force at negative y radius has positive torque');
  for (const phase of [0, 0.07, 0.18, 0.31, 0.50, 0.77, 0.99]) {
    const state = stateAtInputAngle(FULL_TURN * phase);
    assert.ok(state.wheelAngularSpeed > 0,
      `counterclockwise speed at ${phase}`);
    assert.ok(state.streamDriveTorque > 0,
      `counterclockwise torque at ${phase}`);
    assert.ok(state.streamVelocityAtBottomDotWheelTangent > 0,
      `stream agrees with bottom tread direction at ${phase}`);
    assert.ok(state.immersedFloatCount >= 1);
    assert.ok(state.immersedFloatCount < geometry.floatCount);
  }
  const first = stateAtInputAngle(0);
  const later = stateAtInputAngle(0.25);
  assert.ok(later.wheelAngle > first.wheelAngle);
  disposeModel(model.root);
});

test('movement 441 bucket cycle fills under water, carries upward, and pin-tips once at high level', () => {
  const model = createMovementModel(catalog.movements[440]);
  const { bucketStateAtWorldAngle, geometry } = model.root.userData;
  const degrees = (value) => THREE.MathUtils.degToRad(value);

  const pickupStart = bucketStateAtWorldAngle(degrees(220));
  const pickupMiddle = bucketStateAtWorldAngle(degrees(255));
  const pickupEnd = bucketStateAtWorldAngle(degrees(290));
  const rising = bucketStateAtWorldAngle(degrees(350));
  const dumpStart = bucketStateAtWorldAngle(degrees(40));
  const dumpPeak = bucketStateAtWorldAngle(geometry.dumpPeakAngle);
  const dumpEnd = bucketStateAtWorldAngle(geometry.dumpEndAngle);
  const descendingEmpty = bucketStateAtWorldAngle(degrees(150));

  near(pickupStart.bucketFill, 0, 0, 'empty entering stream');
  near(pickupMiddle.bucketFill, 0.5, 2e-15,
    'half full through pickup arc');
  near(pickupEnd.bucketFill, 1, 2e-15, 'full leaving stream');
  near(rising.bucketFill, 1, 0, 'full on rising side');
  near(dumpStart.bucketFill, 1, 2e-15, 'full at trip-pin entry');
  near(dumpStart.bucketTipAngle, 0, 2e-14, 'upright at pin entry');
  assert.ok(dumpPeak.bucketFill>0 && dumpPeak.bucketFill<1, 'partly emptied at peak tip');
  near(dumpPeak.bucketTipAngle, geometry.maximumBucketTip, 2e-14,
    'maximum pin-induced tilt');
  assert.ok(dumpPeak.dischargeFlow>.9, 'strong high-level discharge');
  near(dumpEnd.bucketFill, 0, 2e-15, 'empty leaving trip pin');
  assert.ok(dumpEnd.bucketTipAngle>0, 'empty bucket is still returning');
  near(bucketStateAtWorldAngle(geometry.trip.end).bucketTipAngle,0,1e-14,'continuous return finishes upright');
  near(descendingEmpty.bucketFill, 0, 0,
    'empty on descending return');
  disposeModel(model.root);
});

test('movement 441 every untripped bucket remains gravity-upright while its pivot follows the wheel circle', () => {
  const model = createMovementModel(catalog.movements[440]);
  const { blocks, geometry, stateAtInputAngle, update } = model.root.userData;

  for (const phase of [0, 0.037, 0.11, 0.23, 0.41, 0.58, 0.76, 0.93]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtInputAngle(FULL_TURN * phase);
    update(time);
    model.root.updateMatrixWorld(true);
    for (let index = 0; index < geometry.floatCount; index += 1) {
      const bucketState = state.bucketStates[index];
      const radialDistance = Math.hypot(
        bucketState.pivotPosition.x - geometry.wheelCenter.x,
        bucketState.pivotPosition.y - geometry.wheelCenter.y,
      );
      near(radialDistance, geometry.bucketPivotRadius, 2e-15,
        `bucket ${index} circular pivot at ${phase}`);
      sameAngle(
        state.wheelAngle
          + bucketState.armAngle
          + bucketState.bucketLocalAngle,
        bucketState.bucketTipAngle,
        3e-15,
        `bucket ${index} counter-rotation at ${phase}`,
      );
      const actualWorldRotation = new THREE.Quaternion();
      blocks.buckets[index].getWorldQuaternion(actualWorldRotation);
      const expectedWorldRotation = new THREE.Quaternion()
        .setFromAxisAngle(Z_AXIS, bucketState.bucketTipAngle);
      near(actualWorldRotation.angleTo(expectedWorldRotation), 0, 5e-8,
        `bucket ${index} world angle at ${phase}`);
    }
  }
  disposeModel(model.root);
});

test('movement 441 finite fixed pin contacts each bucket shoe at the same reconstructed station', () => {
  const model=createMovementModel(catalog.movements[440]);
  const {geometry:g,stateAtInputAngle,update,blocks:b}=model.root.userData;
  for(let index=0;index<g.floatCount;index++){
    const input=THREE.MathUtils.euclideanModulo(g.dumpPeakAngle-g.sourceWheelAngle-index*FULL_TURN/g.floatCount,FULL_TURN);
    const state=stateAtInputAngle(input).bucketStates[index];
    near(state.bucketTipAngle,g.maximumBucketTip,1e-12,'peak geometric tip');
    update(input/g.inputAngularSpeed);model.root.updateMatrixWorld(true);
    const q=b.buckets[index].worldToLocal(g.tripPinPosition.clone());
    const y=THREE.MathUtils.clamp(q.y,g.trip.shoeBottom,g.trip.shoeTop);
    near(Math.hypot(q.x-g.trip.shoeX,q.y-y),g.trip.shoeRadius+g.trip.pinRadius,1e-12,'finite contact separation');
    assert.equal(b.bucketSpills[index].visible,true);
  }
  disposeModel(model.root);
});

test('movement 441 curved-float water tracer moves smoothly from outer tip to hollow shaft', () => {
  const model = createMovementModel(catalog.movements[440]);
  const { bucketStateAtWorldAngle, geometry } = model.root.userData;
  const travelToAngle = (travel) => geometry.pickupStartAngle
    + FULL_TURN * travel;
  const transportMiddle = (
    geometry.pickupEndTravel + geometry.dumpEndTravel
  ) / 2;
  const atOuter = bucketStateAtWorldAngle(geometry.pickupEndAngle);
  const atMiddle = bucketStateAtWorldAngle(
    travelToAngle(transportMiddle),
  );
  const atInner = bucketStateAtWorldAngle(geometry.dumpEndAngle);

  near(atOuter.channelMarkerParameter, 1, 2e-15,
    'water marker begins at outer float tip');
  near(atMiddle.channelMarkerParameter, 0.5, 3e-15,
    'water marker reaches curved-channel midpoint');
  near(atInner.channelMarkerParameter, 0, 0,
    'water marker reaches hollow-shaft end');
  assert.ok(atOuter.channelMarkerVisible);
  assert.ok(atMiddle.channelMarkerVisible);
  assert.equal(atInner.channelMarkerVisible, false);

  const step = 1e-6;
  for (const boundary of [geometry.pickupEndTravel,
    geometry.dumpEndTravel]) {
    const center = bucketStateAtWorldAngle(travelToAngle(boundary))
      .channelMarkerParameter;
    const before = bucketStateAtWorldAngle(
      travelToAngle(boundary - step),
    ).channelMarkerParameter;
    const after = bucketStateAtWorldAngle(
      travelToAngle(boundary + step),
    ).channelMarkerParameter;
    near((after - before) / (2 * step), 0, 2e-6,
      `zero tracer speed at travel boundary ${boundary}`);
    near((after - 2 * center + before) / step ** 2, 0, 2e-3,
      `zero tracer acceleration at travel boundary ${boundary}`);
  }
  disposeModel(model.root);
});

test('movement 441 update keeps bucket water level, binds all rotating parts, and closes exactly', () => {
  const model = createMovementModel(catalog.movements[440]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.streamBed, blocks.streamWater,
    blocks.stationaryTripPin, blocks.tripPinBracket, blocks.tripPinPost,
    blocks.deliveryTrough, ...blocks.bearingRings, ...blocks.supports];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());
  const identity = new THREE.Quaternion();

  for (const phase of [0, 0.083333333333, 0.21, 0.39,
    0.57, 0.74, 0.91]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    sameAngle(blocks.wheel.rotation.z, state.wheelAngle, 2e-15,
      `wheel update at ${phase}`);
    model.root.updateMatrixWorld(true);
    for (let index = 0; index < geometry.floatCount; index += 1) {
      const bucketState = state.bucketStates[index];
      sameAngle(blocks.buckets[index].rotation.z,
        bucketState.bucketLocalAngle, 2e-15,
        `bucket local angle ${index} at ${phase}`);
      // Pass 69: the shown water is the load clipped at the tipped bucket's
      // lowest rim point, so it can be less than (never more than) the load.
      if (blocks.bucketWaters[index].visible) assert.ok(bucketState.bucketFill > 0.01);
      if (Math.abs(bucketState.bucketTipAngle) < 1e-9) assert.equal(blocks.bucketWaters[index].visible,
        bucketState.bucketFill > 0.01);
      assert.equal(blocks.floatWaters[index].visible,
        bucketState.floatWaterFill > 0.015);
      assert.equal(blocks.channelMarkers[index].visible,
        bucketState.channelMarkerVisible);
      if (blocks.bucketWaters[index].visible) {
        const worldRotation = new THREE.Quaternion();
        blocks.bucketWaters[index].getWorldQuaternion(worldRotation);
        near(worldRotation.angleTo(identity), 0, 3e-8,
          `bucket ${index} horizontal water surface at ${phase}`);
      }
    }
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.wheelAngle, source.wheelAngle, 0,
    'wheel cycle closure');
  closure.bucketStates.forEach((bucketState, index) => {
    near(bucketState.bucketFill,
      source.bucketStates[index].bucketFill, 0,
      `bucket ${index} fill cycle closure`);
    near(bucketState.bucketTipAngle,
      source.bucketStates[index].bucketTipAngle, 0,
      `bucket ${index} tip cycle closure`);
  });
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, 12);
  assert.ok(model.root.userData.animationTiming.displayCycleDuration >= 12);
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 441 Persian wheel', () => {
  const movement441 = catalog.movements[440];
  const movement507 = catalog.movements[506];
  const model441 = createMovementModel(movement441);
  const model507 = createMovementModel(movement507);

  assert.equal(movement441.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model441.root);
  disposeModel(model507.root);
});

test('movement 441 (pass 92): the tipping pin stands centred in a round eye at the arm end', () => {
  const model = createMovementModel(catalog.movements[440]);
  const { blocks } = model.root.userData;
  const pin = blocks.stationaryTripPin, arm = blocks.tripPinBracket;
  const r = pin.geometry.parameters.radiusTop;
  const position = arm.geometry.attributes.position;
  const v = new THREE.Vector3();
  let nearest = Infinity;
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).applyMatrix4(arm.matrix);
    nearest = Math.min(nearest, Math.hypot(v.x - pin.position.x, v.y - pin.position.y));
  }
  assert.ok(nearest >= 1.5 * r, `arm outline ${nearest} from the pin axis`);
  disposeModel(model.root);
});

test('movement 441 (pass 92): each bucket pin stands centred in a round rim boss', () => {
  const model = createMovementModel(catalog.movements[440]);
  model.root.updateMatrixWorld(true);
  const byRole = new Map();
  model.root.traverse((object) => { if (object.userData.role) byRole.set(object.userData.role, object); });
  const rim = byRole.get('light-outer-rim-through-bucket-pivots');
  for (let index = 1; index <= 6; index += 1) {
    const pin = byRole.get(`finite-bucket-suspension-pin-${index}`);
    const boss = byRole.get(`rim-boss-round-bucket-suspension-pin-${index}`);
    const link = byRole.get(`float-tip-bucket-pivot-link-${index}`);
    assert.ok(pin && boss && link, `station ${index} parts exist`);
    assert.equal(boss.parent, rim.parent, 'the boss is part of the rim body');
    const r = pin.geometry.parameters.radiusTop;
    const p = pin.getWorldPosition(new THREE.Vector3());
    const b = boss.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(p.x - b.x, p.y - b.y) < 1e-9, `boss ${index} concentric with its pin`);
    assert.ok(boss.geometry.parameters.radiusTop >= 1.5 * r, `boss ${index} radius`);
    // The boss stands proud of the rim (0.05) and link (0.09) faces.
    assert.ok(boss.geometry.parameters.height / 2 > 0.09 + 0.005, `boss ${index} depth`);
    // The link's square end is buried in the boss and stops short of the pin.
    const radial = link.localToWorld(new THREE.Vector3(link.geometry.parameters.width / 2, 0, 0)).sub(link.getWorldPosition(new THREE.Vector3()));
    const endCenter = link.getWorldPosition(new THREE.Vector3()).add(radial);
    assert.ok(Math.hypot(endCenter.x - p.x, endCenter.y - p.y) > r, `link ${index} stops short of the pin`);
    const half = link.geometry.parameters.height / 2;
    assert.ok(Math.hypot(Math.hypot(endCenter.x - p.x, endCenter.y - p.y), half) < boss.geometry.parameters.radiusTop,
      `link ${index} end corners lie inside the boss`);
  }
  disposeModel(model.root);
});
