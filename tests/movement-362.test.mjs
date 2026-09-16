import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
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

test('movement 362 is one rotating lower grooved cylinder driving one nonrotating upper shaft traverse', () => {
  const movement = catalog.movements[361];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 362);
  assert.equal(movement.number, '362');
  assert.equal(movement.category, 'Steam engines');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'rotating-oblique-groove-cylinder-shaft-traverse',
  );
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /rotating-lower-cylinder/);
  assert.match(data.mechanism, /closed-opposite-pitch-oblique-groove/);
  assert.match(data.mechanism, /upper-shaft-traverse/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /lower grooved cylinder/);
  assert.match(degreesOfFreedom.note, /no upper-shaft spin/);

  assert.equal(blocks.lowerInputRotor.parent, model.root);
  assert.equal(blocks.upperSlide.parent, model.root);
  assert.notEqual(blocks.lowerInputRotor, blocks.upperSlide);
  for (const component of [
    blocks.groovedCylinder,
    blocks.grooveTrack,
    blocks.lowerShaft,
    blocks.lowerRotationIndex,
    ...blocks.grooveReversalPockets,
    ...blocks.cylinderEndRims,
  ]) assert.equal(component.parent, blocks.lowerInputRotor);
  for (const component of [
    blocks.upperDrum,
    blocks.upperShaft,
    blocks.upperTranslationIndex,
    blocks.shaftTranslationIndex,
    blocks.followerBridge,
    blocks.followerStem,
    blocks.followerTip,
    ...blocks.upperDrumEndRims,
  ]) assert.equal(component.parent, blocks.upperSlide);
  assert.ok(blocks.lowerInputRotor.userData.axis.distanceTo(X_AXIS) < 1e-15);
  assert.ok(blocks.upperSlide.userData.translationAxis.distanceTo(X_AXIS)
    < 1e-15);
  assert.equal(blocks.frame.userData.fixed, true);
  assert.equal(blocks.upperBearings.length, 2);
  assert.equal(blocks.lowerBearings.length, 2);
  assert.equal(blocks.framePosts.length, 3);

  const roles = [];
  const belts = [];
  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) belts.push(object);
    if (Number.isInteger(object.userData.teeth)) gears.push(object);
  });
  for (const role of [
    'lower-cylinder-carrying-one-closed-oblique-groove',
    'one-closed-positive-and-negative-pitch-oblique-groove',
    'nonrotating-upper-shaft-drum-and-follower-traversing-together',
    'large-upper-drum-fixed-axially-to-sliding-shaft',
    'rounded-pin-on-upper-shaft-working-in-oblique-groove',
    'white-index-showing-lower-cylinder-angle-and-rate',
    'white-straight-index-on-nonrotating-traversing-upper-drum',
  ]) assert.ok(roles.includes(role), role);
  assert.equal(belts.length, 0);
  assert.equal(gears.length, 0);
  disposeModel(model.root);
});

test('movement 362 records the engraving and distinguishes its evidence from timing assumptions', () => {
  const movement = catalog.movements[361];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate362;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_362.html');
  assert.match(movement.description, /Alternating traverse of upper shaft/);
  assert.match(movement.description, /pin on the end of the shaft/);
  assert.match(movement.description, /oblique groove in the lower cylinder/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesInputSpeedOrInertia, false);
  assert.equal(data.dynamics.upperShaftSpinPrescribedBySource, false);
  assert.match(data.timeline.note, /Brown supplies no speed/);
  assert.match(data.dynamics.idealReversal, /velocity changes sign/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.upperDrumCenter.toArray(), [180, 169]);
  assert.deepEqual(plate.lowerCylinderCenter.toArray(), [393, 330]);
  assert.deepEqual(plate.followerPinTip.toArray(), [357, 243]);
  assert.deepEqual(plate.grooveUpperVisibleEnd.toArray(), [357, 243]);
  assert.deepEqual(plate.grooveLowerVisibleEnd.toArray(), [429, 452]);
  assert.equal(plate.upperDrumLeftX, 122);
  assert.equal(plate.upperDrumRightX, 237);
  assert.equal(plate.upperDrumTopY, 29);
  assert.equal(plate.upperDrumBottomY, 309);
  assert.equal(plate.lowerCylinderLeftX, 351);
  assert.equal(plate.lowerCylinderRightX, 435);
  assert.equal(plate.lowerCylinderTopY, 204);
  assert.equal(plate.lowerCylinderBottomY, 456);

  assert.deepEqual(
    sourceReference.constructionEvidence.explicitInBrownDescription,
    [
      'the upper shaft and its drum traverse alternately',
      'the follower is a pin on the end of the upper shaft',
      'the pin works in an oblique groove in the lower cylinder',
    ],
  );
  assert.match(
    sourceReference.constructionEvidence.engravingEvidence,
    /parallel horizontal shafts/,
  );
  assert.match(
    sourceReference.constructionEvidence.inference,
    /oblique plane.*unseen half.*smooth opposite traverse/,
  );
  disposeModel(model.root);
});

test('movement 362 renders one closed cylindrical groove with an oblique plane and smooth reversals', () => {
  const model = createMovementModel(catalog.movements[361]);
  const data = model.root.userData;
  const { blocks, curves, geometry } = data;
  const curve = curves.groove;

  assert.equal(blocks.grooveTrack.geometry.parameters.closed, true);
  assert.equal(
    blocks.grooveTrack.geometry.parameters.tubularSegments,
    geometry.grooveSegments,
  );
  assert.equal(blocks.grooveReversalPockets.length, 2);
  assert.deepEqual(
    new Set(blocks.grooveReversalPockets.map(({ userData }) => userData.end)),
    new Set(['left', 'right']),
  );
  near(
    geometry.groovePitchMagnitude,
    geometry.followerAmplitude,
    0,
    'maximum oblique-plane slope',
  );
  assert.ok(
    geometry.followerAmplitude + geometry.grooveTubeRadius
      < geometry.barrelAxialLength / 2,
    'groove reversals remain inside both cylinder ends',
  );

  const leftStart = curve.getPoint(0);
  const right = curve.getPoint(0.5);
  const leftClosure = curve.getPoint(1);
  vectorNear(leftStart, leftClosure, 2e-15,
    'opposite-pitch halves close into one groove');
  near(leftStart.x, -geometry.followerAmplitude, 2e-15,
    'left reversal x');
  near(leftStart.y, geometry.grooveCenterRadius, 2e-15,
    'left reversal local top');
  near(leftStart.z, 0, 2e-15, 'left reversal local depth');
  near(right.x, geometry.followerAmplitude, 2e-15,
    'right reversal x');
  near(right.y, -geometry.grooveCenterRadius, 2e-15,
    'right reversal opposite side');

  for (let index = 0; index <= 1280; index += 1) {
    const parameter = index / 1280;
    const angle = parameter * FULL_TURN;
    const point = curve.getPoint(parameter);
    near(
      point.x,
      data.grooveXAtLocalAngle(angle),
      2e-15,
      `axial groove law at ${angle}`,
    );
    near(Math.hypot(point.y, point.z), geometry.grooveCenterRadius,
      2e-15, `cylindrical radius at ${angle}`);
    near(point.y, geometry.grooveCenterRadius * Math.cos(angle),
      2e-15, `groove y at ${angle}`);
    near(point.z, -geometry.grooveCenterRadius * Math.sin(angle),
      2e-15, `groove z at ${angle}`);
  }
  near(data.groovePitchAtLocalAngle(Math.PI / 2),
    geometry.groovePitchMagnitude, 0, 'positive-pitch branch');
  near(data.groovePitchAtLocalAngle(Math.PI * 3 / 2),
    -geometry.groovePitchMagnitude, 0, 'negative-pitch branch');
  near(data.groovePitchAtLocalAngle(0), 0, 0,
    'ideal left reversal pitch');
  near(data.groovePitchAtLocalAngle(Math.PI), 0, 5e-17,
    'ideal right reversal pitch');
  assert.match(data.transmission.grooveLaw, /closed oblique planar groove/);
  disposeModel(model.root);
});

test('movement 362 keeps the upper-shaft pin exactly on the rotating groove at a fixed spatial contact angle', () => {
  const model = createMovementModel(catalog.movements[361]);
  const data = model.root.userData;
  const { geometry, stateAtDriverAngle } = data;

  for (let index = 0; index <= 1440; index += 1) {
    const driverAngle = geometry.sourceDriverAngle
      + FULL_TURN * 2 * index / 1440;
    const state = stateAtDriverAngle(driverAngle);
    near(state.surfacePointError, 0, 2e-12,
      `surface contact closure at driver angle ${driverAngle}`);
    vectorNear(state.grooveWorldPoint, state.contactPoint, 2e-12,
      `world groove point at driver angle ${driverAngle}`);
    near(state.contactPoint.x, state.outputX, 0,
      `follower axial contact at driver angle ${driverAngle}`);
    near(state.contactPoint.y, geometry.contactY, 0,
      `fixed contact y at driver angle ${driverAngle}`);
    near(state.contactPoint.z, geometry.contactZ, 0,
      `fixed contact z at driver angle ${driverAngle}`);
    near(state.radialNormal.length(), 1, 2e-15,
      `radial unit normal at driver angle ${driverAngle}`);
    near(state.grooveWorldTangent.length(), 1, 2e-15,
      `groove unit tangent at driver angle ${driverAngle}`);
    near(state.radialNormal.dot(state.grooveWorldTangent), 0, 2e-15,
      `surface tangent at driver angle ${driverAngle}`);
    near(state.radialNormalVelocityError, 0, 2e-15,
      `radial velocity closure at driver angle ${driverAngle}`);
    if (!state.atReversal) {
      near(state.flankNormalVelocityError, 0, 3e-15,
        `flank velocity closure at driver angle ${driverAngle}`);
      const parallelError = new THREE.Vector3().crossVectors(
        state.relativeGrooveVelocity,
        state.grooveWorldTangent,
      ).length();
      near(parallelError, 0, 3e-15,
        `relative motion follows groove at driver angle ${driverAngle}`);
    }
    near(
      positiveModulo(
        geometry.contactWorldAngle + state.driverAngle,
        FULL_TURN,
      ),
      state.localContactAngle,
      2e-15,
      `contact phase law at driver angle ${driverAngle}`,
    );
  }
  assert.match(data.transmission.contactPhaseLaw, /contactWorldAngle/);
  disposeModel(model.root);
});

test('movement 362 traverses smoothly in opposite directions and reverses once at each end per input turn', () => {
  const model = createMovementModel(catalog.movements[361]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const [left, rightwardMid, right, leftwardMid, closure] = [0, 2, 4, 6, 8]
    .map(stateAtTime);

  near(left.outputX, geometry.barrelCenterX - geometry.followerAmplitude,
    2e-15, 'left reversal position');
  near(rightwardMid.outputX, geometry.barrelCenterX, 2e-15,
    'rightward midpoint position');
  near(right.outputX, geometry.barrelCenterX + geometry.followerAmplitude,
    2e-15, 'right reversal position');
  near(leftwardMid.outputX, geometry.barrelCenterX, 2e-15,
    'leftward midpoint position');
  near(closure.outputX, left.outputX, 2e-15,
    'one-turn axial closure');
  assert.equal(left.atLeftReversal, true);
  assert.equal(right.atRightReversal, true);
  assert.equal(closure.atLeftReversal, true);
  assert.equal(left.outputVelocityDiscontinuousAtReversal, false);
  assert.equal(right.outputVelocityDiscontinuousAtReversal, false);
  near(left.outputVelocityX, 0, 0, 'displayed reversal velocity');
  near(right.outputVelocityX, 0, 0, 'displayed opposite reversal velocity');
  near(rightwardMid.outputVelocityX, geometry.peakTraverseSpeed,
    2e-15, 'peak rightward speed');
  near(leftwardMid.outputVelocityX, -geometry.peakTraverseSpeed,
    2e-15, 'peak leftward speed');
  assert.equal(rightwardMid.forwardTraverse, true);
  assert.equal(leftwardMid.forwardTraverse, false);
  near(rightwardMid.outputAngularSpeed, 0, 0,
    'upper drum does not acquire invented spin');
  assert.equal(rightwardMid.outputDrumSpinPrescribedBySource, false);
  near(
    closure.driverAngle - left.driverAngle,
    FULL_TURN,
    2e-15,
    'one lower-cylinder revolution',
  );
  assert.deepEqual(
    [timeline.leftReversal, timeline.rightReversal],
    [0, geometry.inputCyclePeriod / 2],
  );

  for (const time of [0.3, 1.1, 2.7, 3.6, 4.4, 5.2, 6.8, 7.7]) {
    const epsilon = 1e-6;
    const finiteDifference = (
      stateAtTime(time + epsilon).outputX
        - stateAtTime(time - epsilon).outputX
    ) / (2 * epsilon);
    near(finiteDifference, stateAtTime(time).outputVelocityX, 5e-10,
      `analytic traverse speed at ${time}`);
  }
  for (const reversalTime of [0, 4, 8]) {
    const epsilon = 1e-6;
    near(
      stateAtTime(reversalTime + epsilon).outputX,
      stateAtTime(reversalTime - epsilon).outputX,
      geometry.peakTraverseSpeed * epsilon * 2 + 1e-12,
      `position continuity at reversal ${reversalTime}`,
    );
  }
  assert.match(data.transmission.forwardLaw, /rises sinusoidally/);
  assert.match(data.transmission.returnLaw, /falls sinusoidally/);
  disposeModel(model.root);
});

test('movement 362 renderer binds its rotor and traversing assembly for 1,200 finite frames', () => {
  const model = createMovementModel(catalog.movements[361]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  const fixedFrameMatrix = blocks.frame.matrix.clone();

  for (const time of [0, 1, 2, 3.999, 4, 4.001, 6, 7.999, 8, 9]) {
    const expected = data.stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.lowerInputRotor.rotation.x, expected.driverAngle, 2e-12,
      `rendered input angle at ${time}`);
    near(blocks.upperSlide.position.x, expected.outputX, 2e-12,
      `rendered upper traverse at ${time}`);
    near(blocks.upperSlide.rotation.x, 0, 0,
      `upper assembly remains nonrotating at ${time}`);
    vectorNear(
      blocks.followerTip.getWorldPosition(new THREE.Vector3()),
      expected.contactPoint,
      2e-12,
      `rendered follower contact at ${time}`,
    );
    near(data.contacts.grooveFollower.surfacePointError, 0, 2e-12,
      `rendered groove closure at ${time}`);
    near(data.contacts.upperShaftGuides.lateralError, 0, 0,
      `upper guide line at ${time}`);
    assert.ok(blocks.frame.matrix.equals(fixedFrameMatrix));
    assert.equal(data.currentState.stage, expected.stage);
  }

  let previousX;
  let largestStep = 0;
  for (let index = 0; index <= 1200; index += 1) {
    model.update(geometry.inputCyclePeriod * 2 * index / 1200);
    model.root.updateMatrixWorld(true);
    if (previousX !== undefined) {
      largestStep = Math.max(
        largestStep,
        Math.abs(blocks.upperSlide.position.x - previousX),
      );
    }
    previousX = blocks.upperSlide.position.x;
    model.root.traverse((object) => {
      assert.ok(object.position.toArray().every(Number.isFinite));
      assert.ok(object.quaternion.toArray().every(Number.isFinite));
      if (object.geometry?.attributes?.position) {
        const values = object.geometry.attributes.position.array;
        for (let valueIndex = 0; valueIndex < values.length;
          valueIndex += 1) assert.ok(Number.isFinite(values[valueIndex]));
      }
    });
  }
  assert.ok(largestStep < 0.00336,
    `largest per-frame traverse step was ${largestStep}`);
  disposeModel(model.root);
});

test('movement 362 closes after one cylinder turn while movement 507 remains the next authored draft', () => {
  const movement362 = catalog.movements[361];
  const model362 = createMovementModel(movement362);
  const data = model362.root.userData;
  const start = data.stateAtTime(0);
  const closure = data.stateAtTime(data.geometry.inputCyclePeriod);

  near(positiveModulo(closure.driverAngle - start.driverAngle, FULL_TURN),
    0, 2e-15, 'lower rotor orientation closure');
  near(closure.outputX, start.outputX, 2e-15,
    'upper traverse closure');
  vectorNear(closure.contactPoint, start.contactPoint, 2e-15,
    'contact-point closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model362.root);
  disposeModel(model507.root);
});
