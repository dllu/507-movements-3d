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
  'endless-chain-pump-with-sealing-disks-water-tight-riser-and-powered-upper-wheel';
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

function movementModel() {
  const movement = catalog.movements[461];
  return { model: createMovementModel(movement), movement };
}

test('movement 462 is one endless chain with twelve functional sealing disks, a water-tight riser, and two wheels', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 462);
  assert.equal(movement.number, '462');
  assert.equal(movement.title, 'Endless-chain disk pump');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.endlessChain.parent, model.root);
  assert.equal(blocks.cylinder.parent, model.root);
  assert.equal(blocks.cylinderWater.parent, model.root);
  assert.equal(blocks.topWheel.rotor.parent, model.root);
  assert.equal(blocks.bottomWheel.rotor.parent, model.root);
  assert.equal(blocks.carriers.length, 24);
  assert.equal(blocks.carriers.filter(({ disk }) => disk !== null).length, 12);
  assert.ok(blocks.carriers.every(({ carrier, link }) =>
    carrier.parent === model.root && link.parent === carrier));
  assert.ok(blocks.carriers.filter(({ disk }) => disk !== null)
    .every(({ carrier, disk }) => disk.parent === carrier));
  assert.equal(geometry.carrierCount, 24);
  assert.equal(geometry.diskCount, 12);
  assert.equal(geometry.wheelPocketCount, 8);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.topWheelPowerInput, true);
  assert.equal(degreesOfFreedom.bottomWheelIndependent, false);
  assert.equal(degreesOfFreedom.carrierMotionIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.equal(roles.filter((role) =>
    role === 'one-continuous-endless-chain-around-two-equal-wheels').length, 1);
  assert.equal(roles.filter((role) =>
    role.startsWith('water-sealing-chain-disk-')).length, 12);
  assert.equal(roles.filter((role) =>
    /marker|tracer|bead/i.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 462 source record distinguishes Brown evidence from engineered dimensions and timing', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate462;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_462.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 462');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateTopWheelCenterPixels, [317, 99]);
  assert.deepEqual(plate.approximateBottomWheelCenterPixels, [315, 413]);
  assert.deepEqual(plate.approximateCylinderBoundsPixels, [226, 176, 94, 190]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('endless chain')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('water-tight cylinder')));
  assert.match(evidence.engravingEvidence, /left ascending leg/i);
  assert.match(evidence.engravingEvidence, /lower wheel submerged/i);
  assert.match(evidence.reconstructionDisclosure, /no wheel diameter/i);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/i);
  disposeModel(model.root);
});

test('movement 462 carrier pitch closes exactly around both wheels and both straight chain legs', () => {
  const { model } = movementModel();
  const { geometry } = model.root.userData;
  const {
    bottomWheelCenter,
    carrierCount,
    carrierSpacing,
    diskCount,
    diskEveryCarriers,
    diskSpacing,
    pitchRadius,
    topWheelCenter,
    totalPathLength,
    visualRepeatCarrierShift,
    visualRepeatWheelAngle,
    wheelCenterDistance,
    wheelPitchCircumference,
    wheelPocketCount,
  } = geometry;

  near(wheelPitchCircumference, FULL_TURN * pitchRadius, 1e-12,
    'wheel pitch circumference');
  near(wheelPocketCount * carrierSpacing, wheelPitchCircumference, 1e-12,
    'eight chain pitches close one wheel circumference');
  near(carrierCount * carrierSpacing, totalPathLength, 1e-12,
    'twenty-four chain pitches close the endless path');
  near(totalPathLength, 2 * wheelCenterDistance + wheelPitchCircumference,
    1e-12, 'two tangents plus two semicircles close the path');
  near(diskSpacing, diskEveryCarriers * carrierSpacing, 1e-12,
    'sealing-disk pitch');
  assert.equal(diskCount * diskEveryCarriers, carrierCount);
  assert.equal(visualRepeatCarrierShift, wheelPocketCount);
  near(visualRepeatWheelAngle, FULL_TURN, 1e-12,
    'indexed wheel visual repeat');
  near(topWheelCenter.x, bottomWheelCenter.x, 1e-12,
    'wheel centers are vertically aligned');
  near(topWheelCenter.y - bottomWheelCenter.y, wheelCenterDistance, 1e-12,
    'wheel center separation');
  disposeModel(model.root);
});

test('movement 462 chain path has exact tangent points and continuous position and velocity at all four joins', () => {
  const { model } = movementModel();
  const { geometry, pathPointAtDistance } = model.root.userData;
  const {
    bottomWheelCenter,
    pitchRadius,
    topWheelCenter,
    totalPathLength,
    wheelCenterDistance,
  } = geometry;
  const topArcEnd = wheelCenterDistance + Math.PI * pitchRadius;
  const rightVerticalEnd = topArcEnd + wheelCenterDistance;
  const boundaries = [
    {
      distance: 0,
      position: new THREE.Vector3(-pitchRadius, bottomWheelCenter.y, 0),
      tangent: new THREE.Vector3(0, 1, 0),
    },
    {
      distance: wheelCenterDistance,
      position: new THREE.Vector3(-pitchRadius, topWheelCenter.y, 0),
      tangent: new THREE.Vector3(0, 1, 0),
    },
    {
      distance: topArcEnd,
      position: new THREE.Vector3(pitchRadius, topWheelCenter.y, 0),
      tangent: new THREE.Vector3(0, -1, 0),
    },
    {
      distance: rightVerticalEnd,
      position: new THREE.Vector3(pitchRadius, bottomWheelCenter.y, 0),
      tangent: new THREE.Vector3(0, -1, 0),
    },
    {
      distance: totalPathLength,
      position: new THREE.Vector3(-pitchRadius, bottomWheelCenter.y, 0),
      tangent: new THREE.Vector3(0, 1, 0),
    },
  ];

  const epsilon = 1e-7;
  for (const boundary of boundaries) {
    const exact = pathPointAtDistance(boundary.distance);
    const before = pathPointAtDistance(boundary.distance - epsilon);
    const after = pathPointAtDistance(boundary.distance + epsilon);
    vectorNear(exact.position, boundary.position, 2e-12,
      `exact tangent position at ${boundary.distance}`);
    vectorNear(exact.tangent, boundary.tangent, 2e-12,
      `exact tangent direction at ${boundary.distance}`);
    assert.ok(before.position.distanceTo(after.position) <= 2.01 * epsilon,
      `position is continuous at ${boundary.distance}`);
    assert.ok(before.tangent.distanceTo(after.tangent)
      <= 1.01 * epsilon / pitchRadius,
    `velocity direction is continuous at ${boundary.distance}`);
    near(before.tangent.length(), 1, 1e-12, 'incoming unit tangent');
    near(after.tangent.length(), 1, 1e-12, 'outgoing unit tangent');
  }
  disposeModel(model.root);
});

test('movement 462 every carrier advances at one constant arc-length speed without a straight-to-wheel velocity jump', () => {
  const { model } = movementModel();
  const { geometry, pathPointAtDistance, stateAtInputAngle } =
    model.root.userData;

  for (let sample = -20; sample <= 80; sample += 1) {
    const inputAngle = sample * 0.173;
    const state = stateAtInputAngle(inputAngle);
    near(state.chainSpeed, geometry.linearSpeed, 1e-12, 'uniform chain speed');
    assert.equal(state.carrierStates.length, geometry.carrierCount);
    state.carrierStates.forEach((carrier, index) => {
      const expected = pathPointAtDistance(
        index * geometry.carrierSpacing + state.chainTravel,
      );
      vectorNear(carrier.position, expected.position, 1e-12,
        `carrier ${index} path position`);
      vectorNear(carrier.tangent, expected.tangent, 1e-12,
        `carrier ${index} path tangent`);
      vectorNear(carrier.velocity,
        expected.tangent.clone().multiplyScalar(geometry.linearSpeed),
        1e-12, `carrier ${index} velocity`);
      near(carrier.velocity.length(), geometry.linearSpeed, 1e-12,
        `carrier ${index} constant speed`);
      assert.equal(carrier.hasSealingDisk,
        index % geometry.diskEveryCarriers === 0);
    });
  }
  disposeModel(model.root);
});

test('movement 462 upper powered wheel and submerged return wheel obey the same exact no-slip law', () => {
  const { model } = movementModel();
  const { geometry, stateAtInputAngle } = model.root.userData;
  const inputAngle = 1.731;
  const inputSpeed = 1.94;
  const inputAcceleration = -0.37;
  const state = stateAtInputAngle(
    inputAngle,
    inputSpeed,
    inputAcceleration,
  );

  near(state.chainTravel, geometry.pitchRadius * inputAngle, 1e-12,
    'chain travel');
  near(state.chainSpeed, geometry.pitchRadius * inputSpeed, 1e-12,
    'chain speed');
  near(state.chainAcceleration,
    geometry.pitchRadius * inputAcceleration, 1e-12,
    'chain tangential acceleration');
  near(state.wheelAngle, -state.chainTravel / geometry.pitchRadius, 1e-12,
    'wheel no-slip angle');
  near(state.wheelSpeed, -state.chainSpeed / geometry.pitchRadius, 1e-12,
    'wheel no-slip speed');
  near(state.wheelAcceleration,
    -state.chainAcceleration / geometry.pitchRadius, 1e-12,
    'wheel no-slip acceleration');
  assert.ok(state.carrierStates.some(({ segment, velocity }) =>
    segment === 'ascending-water-tight-cylinder-leg' && velocity.y > 0));
  assert.ok(state.carrierStates.some(({ segment, velocity }) =>
    segment === 'exposed-descending-return-leg' && velocity.y < 0));
  assert.match(model.root.userData.transmission.noSlip,
    /theta_top=theta_bottom=-s\/R/);
  disposeModel(model.root);
});

test('movement 462 sealing geometry forms equally spaced ideal displacement buckets and reports the correct flow', () => {
  const { model } = movementModel();
  const { geometry, stateAtInputAngle } = model.root.userData;
  const state = stateAtInputAngle(0.63, 1.27);
  const expectedArea = Math.PI * geometry.cylinderInnerRadius ** 2;

  near(geometry.radialSealClearance,
    geometry.cylinderInnerRadius - geometry.diskRadius, 1e-12,
    'radial disk clearance');
  assert.ok(geometry.radialSealClearance > 0);
  assert.ok(geometry.radialSealClearance < geometry.cylinderInnerRadius * 0.06);
  near(geometry.theoreticalBucketVolume,
    expectedArea * geometry.diskSpacing, 1e-12,
    'ideal volume between sealing disks');
  near(geometry.theoreticalFlowRate,
    expectedArea * geometry.linearSpeed, 1e-12,
    'nominal ideal flow');
  near(state.theoreticalFlowRate,
    expectedArea * state.chainSpeed, 1e-12,
    'state-dependent ideal flow');
  assert.equal(state.ascendingDiskCount, state.ascendingDiskIndices.length);
  assert.ok(state.ascendingDiskCount >= 3);
  assert.ok(state.ascendingDiskCount <= 5);
  state.ascendingDiskIndices.forEach((index) => {
    const carrier = state.carrierStates[index];
    assert.equal(carrier.hasSealingDisk, true);
    assert.equal(carrier.segment, 'ascending-water-tight-cylinder-leg');
    assert.ok(carrier.position.y >= geometry.cylinderBottomY
      - geometry.diskThickness / 2);
    assert.ok(carrier.position.y <= geometry.cylinderTopY
      + geometry.diskThickness / 2);
  });
  const reverse = stateAtInputAngle(0.63, -1.27);
  near(reverse.theoreticalFlowRate, 0, 1e-12,
    'forward-delivery flow clamps to zero in reverse');
  disposeModel(model.root);
});

test('movement 462 analytic carrier velocity and centripetal acceleration match finite differences on every path piece', () => {
  const { model } = movementModel();
  const { geometry, stateAtInputAngle } = model.root.userData;
  const topArcEnd = geometry.wheelCenterDistance
    + Math.PI * geometry.pitchRadius;
  const rightVerticalEnd = topArcEnd + geometry.wheelCenterDistance;
  const sampleDistances = [
    geometry.wheelCenterDistance * 0.43,
    geometry.wheelCenterDistance + Math.PI * geometry.pitchRadius * 0.47,
    topArcEnd + geometry.wheelCenterDistance * 0.43,
    rightVerticalEnd + Math.PI * geometry.pitchRadius * 0.47,
  ];
  const speed = geometry.inputAngularSpeed;
  const timeStep = 1e-4;

  sampleDistances.forEach((distance, sampleIndex) => {
    const angle = distance / geometry.pitchRadius;
    const center = stateAtInputAngle(angle, speed).carrierStates[0];
    const before = stateAtInputAngle(
      angle - speed * timeStep,
      speed,
    ).carrierStates[0];
    const after = stateAtInputAngle(
      angle + speed * timeStep,
      speed,
    ).carrierStates[0];
    const numericalVelocity = after.position.clone().sub(before.position)
      .multiplyScalar(1 / (2 * timeStep));
    const numericalAcceleration = after.position.clone()
      .add(before.position)
      .addScaledVector(center.position, -2)
      .multiplyScalar(1 / timeStep ** 2);
    vectorNear(numericalVelocity, center.velocity, 2e-8,
      `sample ${sampleIndex} analytic velocity`);
    vectorNear(numericalAcceleration, center.acceleration, 2e-6,
      `sample ${sampleIndex} analytic acceleration`);
    if (center.segment.includes('wheel-semicircle')) {
      near(center.acceleration.length(),
        geometry.linearSpeed ** 2 / geometry.pitchRadius, 1e-12,
        `sample ${sampleIndex} centripetal acceleration`);
      near(center.acceleration.dot(center.velocity), 0, 1e-12,
        `sample ${sampleIndex} acceleration is normal to velocity`);
    } else {
      near(center.acceleration.length(), 0, 1e-12,
        `sample ${sampleIndex} straight-leg acceleration`);
    }
  });
  disposeModel(model.root);
});

test('movement 462 renderer maps every carrier and disk smoothly to the analytic chain tangent while fixed works stay fixed', () => {
  const { model } = movementModel();
  const { blocks, stateAtTime } = model.root.userData;
  const fixedCylinderPosition = blocks.cylinder.position.clone();
  const fixedSupportPosition = blocks.support.position.clone();
  const localAxis = new THREE.Vector3(0, 1, 0);

  for (const time of [0, 0.37, 1.91, 4.18]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.topWheel.rotor.rotation.z, state.wheelAngle, 1e-12,
      `upper wheel render angle at ${time}`);
    near(blocks.bottomWheel.rotor.rotation.z, state.wheelAngle, 1e-12,
      `lower wheel render angle at ${time}`);
    blocks.carriers.forEach(({ carrier, disk }, index) => {
      const carrierState = state.carrierStates[index];
      vectorNear(carrier.position, carrierState.position, 1e-12,
        `rendered carrier ${index} position at ${time}`);
      const renderedAxis = localAxis.clone().applyQuaternion(carrier.quaternion);
      vectorNear(renderedAxis, carrierState.tangent, 1e-12,
        `rendered carrier ${index} tangent at ${time}`);
      if (disk) assert.equal(disk.parent, carrier);
    });
    vectorNear(blocks.cylinder.position, fixedCylinderPosition, 0,
      'water-tight cylinder remains fixed');
    vectorNear(blocks.support.position, fixedSupportPosition, 0,
      'upper support remains fixed');
  }
  disposeModel(model.root);
});

test('movement 462 indexed-wheel visual configuration closes after one wheel revolution', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);

  near(geometry.cycleDuration,
    geometry.wheelPitchCircumference / geometry.linearSpeed, 1e-12,
    'one-revolution cycle duration');
  near(closure.wheelAngle - source.wheelAngle, -FULL_TURN, 1e-12,
    'indexed wheels make one full turn');
  closure.carrierStates.forEach((carrier, index) => {
    const matchingIndex = (index + geometry.visualRepeatCarrierShift)
      % geometry.carrierCount;
    const matchingSource = source.carrierStates[matchingIndex];
    vectorNear(carrier.position, matchingSource.position, 2e-12,
      `carrier ${index} closes onto equivalent carrier`);
    vectorNear(carrier.tangent, matchingSource.tangent, 2e-12,
      `carrier ${index} tangent closes`);
    assert.equal(carrier.hasSealingDisk, matchingSource.hasSealingDisk);
  });
  model.update(geometry.cycleDuration);
  near(blocks.topWheel.rotor.rotation.z, -FULL_TURN, 1e-12,
    'rendered upper index completes one revolution');
  near(blocks.bottomWheel.rotor.rotation.z, -FULL_TURN, 1e-12,
    'rendered lower index completes one revolution');
  disposeModel(model.root);
});

test('movement 462 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement462 = catalog.movements[461];
  const movement507 = catalog.movements[506];
  const model462 = createMovementModel(movement462);
  const model507 = createMovementModel(movement507);
  model462.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model462.root);
  const fitBounds = model462.root.userData.cameraFitBounds;

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.ok(fitBounds.min.x <= bounds.min.x);
  assert.ok(fitBounds.min.y <= bounds.min.y);
  assert.ok(fitBounds.min.z <= bounds.min.z);
  assert.ok(fitBounds.max.x >= bounds.max.x);
  assert.ok(fitBounds.max.y >= bounds.max.y);
  assert.ok(fitBounds.max.z >= bounds.max.z);
  assert.equal(movement462.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model462.root);
  disposeModel(model507.root);
});
