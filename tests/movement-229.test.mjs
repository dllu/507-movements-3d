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

function nearVector(actual, expected, tolerance, message) {
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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 229 is one fourteen-pitch wheel carrying one toothed-link chain', () => {
  const movement = catalog.movements[228];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 229);
  assert.equal(movement.number, '229');
  assert.equal(
    movement.title,
    'Toothed-Link Chain and Fourteen-Pitch Wheel',
  );
  assert.equal(movement.category, 'Chain gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'fourteen-pitch-toothed-link-chain-wheel');
  assert.equal(archetype, movement.archetype);
  assert.equal(mechanism, archetype);
  assert.equal(blocks.wheelRotor.userData.pitches, 14);
  assert.equal(blocks.wheel.userData.rootNotches, 14);
  assert.equal(blocks.wheel.userData.profilePointCount, 57);
  assert.equal(blocks.wheel.userData.profilePoints.length, 56);
  assert.equal(blocks.links.length, 24);
  assert.equal(blocks.plates.length, 24);
  assert.equal(blocks.pivotPins.length, 24);
  assert.equal(blocks.chain.userData.inwardToothPerLink, 1);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.interpolationStepsPerTurn, 14);
  disposeModel(model.root);
});

test('movement 229 preserves the official wheel, link, tangent, and view dimensions', () => {
  const model = createMovementModel(catalog.movements[228]);
  const {
    blocks,
    geometry,
    sourceAnimation,
    sourceReference,
    transmission,
  } = model.root.userData;

  assert.deepEqual(sourceAnimation.pulleyPitchCircle, {
    center: [0, 0],
    radius: 5.4,
  });
  assert.deepEqual(sourceAnimation.linkEnd, [2.403226, 0]);
  assert.deepEqual(sourceAnimation.chainStartTracks, [
    [[-10.19201, -17.173079], [-9.19201, -17.173079]],
    [[-9.570009, -14.851741], [-8.570009, -14.851741]],
  ]);
  assert.deepEqual(sourceAnimation.chainEnd, [11.154831, -11.144112]);
  assert.deepEqual(sourceAnimation.linkOutline, {
    halfHeight: 0.4,
    pivotHoleRadius: 0.15,
    toothBaseEndX: 1.573603,
    toothBaseStartX: 0.829623,
    toothCenter: [1.201613, -0.897845],
  });
  assert.deepEqual(sourceAnimation.viewBox, {
    bottom: -10.168663,
    height: 17,
    left: -8.5,
    top: 6.831337,
    width: 17,
  });
  assert.deepEqual(sourceAnimation.wheelProfileStart, {
    outerTip: [0.186573, 4.986224],
    root: [-0.811831, 4.290638],
    shoulderEntering: [-0.538881, 4.848961],
    shoulderLeaving: [0.899741, 4.795131],
  });
  assert.equal(sourceAnimation.sourceProfilePointCount, 57);
  assert.equal(sourceReference.plate229.pulleyPitchCount, 14);
  assert.equal(sourceReference.plate229.pivotedFlatPlateLinks, true);
  assert.equal(sourceReference.plate229.inwardPointedToothPerLink, 1);

  near(geometry.pitchRadius, 5.4 * geometry.sourceScale, 0,
    'scaled pitch radius');
  near(
    geometry.linkPitch,
    2 * geometry.pitchRadius * Math.sin(Math.PI / 14),
    0,
    'fourteen-sided pitch-polygon chord',
  );
  near(
    geometry.linkPitch,
    geometry.sourceScaledLinkPitch,
    3.5e-8,
    'rounded source link pitch',
  );
  near(
    geometry.linkToothDepth,
    geometry.sourceScaledLinkToothDepth,
    5.2e-8,
    'rounded source tooth depth',
  );
  near(geometry.leftTangentAngle, 165 * Math.PI / 180, 0,
    'left tangent angle');
  near(geometry.rightTangentAngle, 25 * Math.PI / 180, 0,
    'right tangent angle');
  near(geometry.incomingDirectionAngle, 75 * Math.PI / 180, 0,
    'incoming fall direction');
  near(geometry.outgoingDirectionAngle, -65 * Math.PI / 180, 0,
    'outgoing fall direction');

  const sourceStart0 = geometry.incomingStartAtPhaseZero.clone()
    .sub(geometry.wheelCenter)
    .multiplyScalar(1 / geometry.sourceScale);
  const sourceStart1 = geometry.incomingStartAtPhaseOne.clone()
    .sub(geometry.wheelCenter)
    .multiplyScalar(1 / geometry.sourceScale);
  nearVector(
    sourceStart0,
    new THREE.Vector3(-10.19201, -17.173079, 0),
    6.1e-6,
    'first official start track',
  );
  nearVector(
    sourceStart1,
    new THREE.Vector3(-9.570009, -14.851741, 0),
    6.1e-6,
    'second official start track',
  );

  const expectedProfileStart = [
    [-0.811831, 4.290638],
    [-0.538881, 4.848961],
    [0.186573, 4.986224],
    [0.899741, 4.795131],
  ];
  blocks.wheel.userData.profilePoints.slice(0, 4).forEach((point, index) => {
    const sourcePoint = point.clone().multiplyScalar(1 / geometry.sourceScale);
    nearVector(
      new THREE.Vector3(sourcePoint.x, sourcePoint.y, 0),
      new THREE.Vector3(...expectedProfileStart[index], 0),
      2e-6,
      `wheel profile point ${index}`,
    );
  });
  assert.equal(transmission.wheelPitches, 14);
  assert.equal(transmission.toothAdvanceInLinks, 1);
  assert.equal(transmission.chordalActionIncluded, true);
  assert.equal(transmission.officialLinearInterpolationCorrected, true);
  disposeModel(model.root);
});

test('movement 229 keeps every rigid link and engaged tooth exact through 32,769 hoist states', () => {
  const model = createMovementModel(catalog.movements[228]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumLinkLengthError = 0;
  let maximumPitchCircleError = 0;
  let maximumEngagementPhaseError = 0;
  let maximumEngagementRadiusError = 0;
  let maximumEngagementVelocityError = 0;
  let minimumIncomingSpeed = Number.POSITIVE_INFINITY;
  let maximumIncomingSpeed = 0;
  let minimumOutgoingSpeed = Number.POSITIVE_INFINITY;
  let maximumOutgoingSpeed = 0;
  let minimumNodeCount = Number.POSITIVE_INFINITY;
  let maximumNodeCount = 0;
  for (let index = 0; index <= 32768; index += 1) {
    // The wheel pays out and winds back the one finite chain over its stroke.
    const state = stateAtInputAngle(-index / 32768 * geometry.hoistStrokeAngle);
    assert.equal(state.nodes.length, 21);
    assert.equal(state.nodes[0].materialIndex, geometry.chainTailIndex);
    assert.equal(state.nodes.at(-1).materialIndex, geometry.chainHeadIndex);
    assert.equal(state.chainLinks.length, state.nodes.length - 1);
    assert.ok(state.circleNodeCount === 5 || state.circleNodeCount === 6);
    assert.equal(state.engagements.length, state.circleNodeCount - 1);
    state.nodes.forEach((node, nodeIndex) => {
      if (nodeIndex > 0) {
        assert.equal(
          state.nodes[nodeIndex - 1].materialIndex - node.materialIndex,
          1,
        );
      }
      if (node.section === 'pitch-circle') {
        maximumPitchCircleError = Math.max(
          maximumPitchCircleError,
          Math.abs(node.position.distanceTo(geometry.wheelCenter)
            - geometry.pitchRadius),
        );
      } else {
        const tangentPoint = node.section === 'incoming-tangent'
          ? geometry.leftTangentPoint
          : geometry.rightTangentPoint;
        const direction = node.section === 'incoming-tangent'
          ? geometry.incomingDirection
          : geometry.outgoingDirection;
        const offset = node.position.clone().sub(tangentPoint);
        near(
          new THREE.Vector3().crossVectors(direction, offset).z,
          0,
          1.8e-15,
          `state ${index} node ${nodeIndex} tangent line`,
        );
      }
    });
    state.chainLinks.forEach((link) => {
      maximumLinkLengthError = Math.max(
        maximumLinkLengthError,
        Math.abs(link.length - geometry.linkPitch),
      );
      near(
        link.chord.dot(link.end.velocity.clone().sub(link.start.velocity)),
        0,
        8e-15,
        `state ${index} rigid-link velocity constraint`,
      );
    });
    state.engagements.forEach((engagement) => {
      maximumEngagementPhaseError = Math.max(
        maximumEngagementPhaseError,
        Math.abs(engagement.phaseError),
      );
      maximumEngagementRadiusError = Math.max(
        maximumEngagementRadiusError,
        Math.abs(engagement.radialError),
      );
      maximumEngagementVelocityError = Math.max(
        maximumEngagementVelocityError,
        engagement.noSlipVelocityError.length(),
      );
    });
    minimumIncomingSpeed = Math.min(
      minimumIncomingSpeed,
      state.incomingLinearSpeed,
    );
    maximumIncomingSpeed = Math.max(
      maximumIncomingSpeed,
      state.incomingLinearSpeed,
    );
    minimumOutgoingSpeed = Math.min(
      minimumOutgoingSpeed,
      state.outgoingLinearSpeed,
    );
    maximumOutgoingSpeed = Math.max(
      maximumOutgoingSpeed,
      state.outgoingLinearSpeed,
    );
    minimumNodeCount = Math.min(minimumNodeCount, state.nodes.length);
    maximumNodeCount = Math.max(maximumNodeCount, state.nodes.length);
  }
  assert.ok(maximumLinkLengthError < 2.3e-15);
  assert.ok(maximumPitchCircleError < 5e-16);
  assert.ok(maximumEngagementPhaseError < 1.8e-15);
  assert.ok(maximumEngagementRadiusError < 7e-16);
  assert.ok(maximumEngagementVelocityError < 1e-15);
  assert.equal(minimumNodeCount, 21);
  assert.equal(maximumNodeCount, 21);
  assert.ok(minimumIncomingSpeed > 3.34);
  assert.ok(maximumIncomingSpeed < 3.4);
  assert.ok(minimumOutgoingSpeed > 3.34);
  assert.ok(maximumOutgoingSpeed < 3.4);
  disposeModel(model.root);
});

test('movement 229 has continuous entry and exit handoffs with stable rendered links', () => {
  const model = createMovementModel(catalog.movements[228]);
  const { blocks, geometry, stateAtInputAngle } = model.root.userData;
  const epsilon = 1e-9;
  // Inverse of the cosine hoist stroke (first half cycle).
  const timeAtAngle = (angle) => Math.acos(1 + 2 * angle / geometry.hoistStrokeAngle)
    * geometry.cyclePeriod / FULL_TURN;

  const verifyBoundary = (
    angle,
    expectedCommonNodes,
    expectedCommonLinks,
    label,
  ) => {
    const before = stateAtInputAngle(angle - epsilon);
    const after = stateAtInputAngle(angle + epsilon);
    const afterNodes = new Map(after.nodes.map(
      (node) => [node.materialIndex, node],
    ));
    let commonNodes = 0;
    before.nodes.forEach((node) => {
      const matching = afterNodes.get(node.materialIndex);
      if (!matching) return;
      commonNodes += 1;
      assert.ok(node.position.distanceTo(matching.position) < 4.4e-9);
      assert.ok(node.velocity.distanceTo(matching.velocity) < 6.9e-9);
    });
    assert.equal(commonNodes, expectedCommonNodes, `${label} common nodes`);

    model.update(timeAtAngle(angle + epsilon));
    const renderedBefore = new Map(blocks.links
      .filter((link) => link.userData.materialIndex !== null)
      .map((link) => [
        link.userData.materialIndex,
        {
          object: link,
          position: link.position.clone(),
          quaternion: link.quaternion.clone(),
        },
      ]));
    model.update(timeAtAngle(angle - epsilon));
    const renderedAfter = new Map(blocks.links
      .filter((link) => link.userData.materialIndex !== null)
      .map((link) => [
        link.userData.materialIndex,
        {
          object: link,
          position: link.position.clone(),
          quaternion: link.quaternion.clone(),
        },
      ]));
    let commonLinks = 0;
    renderedBefore.forEach((prior, materialIndex) => {
      const next = renderedAfter.get(materialIndex);
      if (!next) return;
      commonLinks += 1;
      assert.equal(prior.object, next.object);
      assert.ok(prior.position.distanceTo(next.position) < 4.4e-9);
      assert.ok(prior.quaternion.angleTo(next.quaternion) < 3.1e-8);
    });
    assert.equal(commonLinks, expectedCommonLinks, `${label} common links`);
  };

  // A finite chain: every node and link persists through each handoff.
  for (let pitchIndex = -1; pitchIndex > -geometry.hoistStrokePitches; pitchIndex -= 1) {
    verifyBoundary(
      pitchIndex * geometry.chainNodeStep,
      21,
      20,
      `entry ${pitchIndex}`,
    );
  }
  for (let pitchIndex = -1; pitchIndex >= -geometry.hoistStrokePitches; pitchIndex -= 1) {
    verifyBoundary(
      pitchIndex * geometry.chainNodeStep + geometry.rightHandoffPhase,
      21,
      20,
      `exit ${pitchIndex}`,
    );
  }
  disposeModel(model.root);
});

test('movement 229 includes physical chordal action and exact hoist-stroke advance', () => {
  const model = createMovementModel(catalog.movements[228]);
  const {
    geometry,
    stateAtInputAngle,
    transmission,
  } = model.root.userData;
  let previousAdvance = Number.NEGATIVE_INFINITY;
  for (let index = 0; index <= 4096; index += 1) {
    const inputAngle = (index / 4096 - 1) * geometry.hoistStrokeAngle;
    const state = stateAtInputAngle(inputAngle);
    assert.ok(state.chainAdvance >= previousAdvance - 2e-15);
    previousAdvance = state.chainAdvance;
    const pitchPhase = state.phaseWithinOneLink;
    if (index === 0 || index === 4096) continue;
    if (pitchPhase < 1e-5
      || geometry.chainNodeStep - pitchPhase < 1e-5
      || Math.abs(pitchPhase - geometry.rightHandoffPhase) < 1e-5) {
      continue;
    }
    const derivativeStep = 1e-7;
    const finiteDifference = (
      stateAtInputAngle(inputAngle + derivativeStep).chainAdvance
      - stateAtInputAngle(inputAngle - derivativeStep).chainAdvance
    ) / (2 * derivativeStep);
    near(
      finiteDifference,
      state.incomingLinearSpeed / geometry.inputAngularSpeed,
      2e-8,
      `state ${index} chordal derivative`,
    );
  }

  const halfPitchState = stateAtInputAngle(geometry.chainNodeStep / 2);
  const officialLinearCoordinate = -geometry.linkPitch / 2;
  assert.ok(
    Math.abs(halfPitchState.incomingCoordinate - officialLinearCoordinate)
      > 0.0015,
  );
  assert.ok(
    Math.abs(halfPitchState.incomingCoordinate - officialLinearCoordinate)
      < 0.0016,
  );

  const start = stateAtInputAngle(-geometry.hoistStrokeAngle);
  const closure = stateAtInputAngle(0);
  near(closure.sprocketAngle - start.sprocketAngle,
    -geometry.hoistStrokePitches * geometry.chainNodeStep, 0,
    'hoist stroke of the wheel');
  near(
    closure.chainAdvance - start.chainAdvance,
    transmission.chainTravelPerWheelTurn * geometry.hoistStrokePitches / 14,
    2e-15,
    'four-link chain advance',
  );
  assert.equal(closure.materialStepIndex - start.materialStepIndex, 4);
  assert.equal(closure.nodes.length, start.nodes.length);
  closure.nodes.forEach((node, index) => {
    assert.equal(node.materialIndex, start.nodes[index].materialIndex);
  });
  disposeModel(model.root);
});

test('movement 229 renders pointed plates and hinge pins at the exact chain state', () => {
  const model = createMovementModel(catalog.movements[228]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  let sphereCount = 0;
  blocks.chain.traverse((object) => {
    if (object.geometry?.type === 'SphereGeometry') sphereCount += 1;
  });
  assert.equal(sphereCount, 0);
  assert.ok(blocks.plates.every(
    (plate) => plate.geometry.type === 'ExtrudeGeometry',
  ));
  assert.ok(blocks.plates.every(
    (plate) => plate.userData.inwardPointedTooth === true,
  ));
  assert.ok(blocks.pivotPins.every(
    (pin) => pin.geometry.type === 'CylinderGeometry',
  ));
  blocks.pivotPins.forEach((pin) => {
    nearVector(pin.userData.axis, Z_AXIS, 0, 'hinge pin axis');
  });

  for (const time of [0, 0.31, 0.91, 1.73, 2.66, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    const activeLinks = blocks.links.filter(
      (link) => link.userData.materialIndex !== null,
    );
    assert.equal(activeLinks.length, state.chainLinks.length);
    state.chainLinks.forEach((link, stateIndex) => {
      const renderSlot = THREE.MathUtils.euclideanModulo(
        link.materialIndex,
        blocks.links.length,
      );
      const object = blocks.links[renderSlot];
      assert.equal(object.userData.stateIndex, stateIndex);
      assert.equal(object.userData.materialIndex, link.materialIndex);
      assert.equal(object.userData.engaged, link.engaged);
      near(object.userData.currentLength, geometry.linkPitch, 2.3e-15,
        `time ${time} link ${stateIndex} length`);
      nearVector(object.position, link.start.position, 0,
        `time ${time} link ${stateIndex} start`);
      const renderedEnd = new THREE.Vector3(geometry.linkPitch, 0, 0)
        .applyQuaternion(object.quaternion)
        .add(object.position);
      nearVector(renderedEnd, link.end.position, 2.4e-15,
        `time ${time} link ${stateIndex} end`);
      const renderedToothTip = new THREE.Vector3(
        geometry.linkToothCenterX,
        -geometry.linkToothDepth,
        0,
      ).applyQuaternion(object.quaternion).add(object.position);
      nearVector(renderedToothTip, link.toothTip, 2.4e-15,
        `time ${time} link ${stateIndex} tooth`);
      near(
        Math.abs(object.userData.plate.position.z),
        geometry.linkPlatePlaneOffset,
        0,
        `time ${time} link ${stateIndex} plate layer`,
      );
    });
    state.engagements.forEach((engagement) => {
      const renderSlot = THREE.MathUtils.euclideanModulo(
        engagement.linkMaterialIndex,
        blocks.links.length,
      );
      nearVector(
        blocks.links[renderSlot].userData.toothTipPosition,
        engagement.contactPoint,
        0,
        `time ${time} engagement ${engagement.linkMaterialIndex}`,
      );
    });
    near(blocks.wheelRotor.rotation.z, state.sprocketAngle, 1e-15,
      `time ${time} wheel transform`);
  }
  disposeModel(model.root);
});

test('movement 229 closes in four authored seconds while movement 507 stays authored', () => {
  const model = createMovementModel(catalog.movements[228]);
  const { animationTiming, geometry, stateAtTime } = model.root.userData;
  assert.equal(geometry.cyclePeriod, 4);
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.cyclePeriod);
  // Seamless loop: the hoist returns exactly to Brown's pose.
  near(closure.sprocketAngle - start.sprocketAngle, 0, 1e-15,
    'runtime wheel closure');
  closure.nodes.forEach((node, index) => {
    nearVector(node.position, start.nodes[index].position, 1e-12,
      `runtime chain closure node ${index}`);
  });
  const top = stateAtTime(geometry.cyclePeriod / 2);
  near(top.sprocketAngle, geometry.hoistStrokeAngle, 1e-15, 'hoist stroke');
  near(
    start.chainAdvance - top.chainAdvance,
    geometry.hoistStrokePitches * geometry.linkPitch,
    2e-15,
    'runtime toothed-chain hoist stroke',
  );

  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement507.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement507.root);
  disposeModel(model.root);
});
