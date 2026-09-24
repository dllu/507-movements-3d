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

test('movement 227 is one six-tooth pulley carrying one alternating-plane chain', () => {
  const movement = catalog.movements[226];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 227);
  assert.equal(movement.number, '227');
  assert.equal(
    movement.title,
    'Alternating-Plane Link Chain and Six-Tooth Pulley',
  );
  assert.equal(movement.category, 'Chain gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'six-tooth-alternating-plane-link-chain-pulley',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(mechanism, archetype);
  assert.equal(blocks.sprocket.userData.teeth, 6);
  assert.equal(blocks.chain.userData.alternatingLinkPlanes, true);
  // One spare slot keeps each slot's parity (plate or loop) fixed.
  assert.equal(blocks.links.length, 22);
  assert.equal(new Set(blocks.links).size, 22);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.chainPositionsPerPulleyTurn, 12);
  assert.equal(sourceAnimation.sourceProfileSegmentCount, 36);
  disposeModel(model.root);
});

test('movement 227 preserves the official pitch circle, link pitch, and source view', () => {
  const model = createMovementModel(catalog.movements[226]);
  const {
    blocks,
    geometry,
    sourceAnimation,
    sourceReference,
    transmission,
  } = model.root.userData;

  assert.deepEqual(sourceAnimation.pulleyPitchCircle, {
    center: [0, 0],
    radius: 5,
  });
  assert.deepEqual(sourceAnimation.linkEnd, [2.58819, 0]);
  assert.deepEqual(sourceAnimation.linkStartTracks, [
    [[-5, -15.529143], [-4, -15.529143]],
    [[-5, -12.940952], [-4, -12.940952]],
  ]);
  assert.deepEqual(sourceAnimation.viewBox, {
    bottom: -9,
    height: 18,
    left: -9,
    top: 9,
    width: 18,
  });
  assert.equal(sourceReference.plate227.pulleyToothCount, 6);
  assert.equal(sourceReference.plate227.shownChainPlanes, 'alternating');
  near(geometry.pitchRadius, 5 * geometry.sourceScale, 0,
    'scaled pitch radius');
  near(
    geometry.linkPitch,
    2 * geometry.pitchRadius * Math.sin(Math.PI / 12),
    0,
    'twelve-sided pitch-polygon chord',
  );
  near(
    geometry.sourceScaledLinkPitch,
    geometry.linkPitch,
    2e-7,
    'rounded source link pitch',
  );
  near(
    geometry.toothTipRadius,
    (Math.hypot(1.674168, 6.248079) + 0.2) * geometry.sourceScale,
    0,
    'source tooth-tip envelope',
  );
  assert.equal(transmission.pulleyTeeth, 6);
  assert.equal(transmission.chainPitchPolygonSides, 12);
  assert.equal(transmission.toothAdvanceInLinks, 2);
  assert.equal(transmission.chordalActionIncluded, true);
  assert.equal(blocks.sprocket.userData.pitchRadius, geometry.pitchRadius);
  assert.equal(blocks.sprocket.userData.toothDirections.length, 6);
  blocks.sprocket.userData.toothDirections.forEach((direction, index, all) => {
    const next = all[(index + 1) % all.length];
    near(direction.length(), 1, 2e-16, `tooth direction ${index}`);
    near(
      Math.acos(THREE.MathUtils.clamp(direction.dot(next), -1, 1)),
      Math.PI / 3,
      2e-15,
      `tooth spacing ${index}`,
    );
  });
  disposeModel(model.root);
});

test('movement 227 keeps every rigid link exact through 32,769 input states', () => {
  const model = createMovementModel(catalog.movements[226]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  let maximumLinkLengthError = 0;
  let maximumPitchCircleError = 0;
  let maximumEngagementPhaseError = 0;
  let maximumEngagementVelocityError = 0;
  let minimumChordalVelocityFactor = Number.POSITIVE_INFINITY;
  let maximumChordalVelocityFactor = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const inputAngle = index / 32768 * FULL_TURN;
    const state = stateAtInputAngle(inputAngle);
    assert.equal(state.nodes.length, 22);
    assert.equal(state.chainLinks.length, 21);
    assert.ok(state.engagements.length === 2 || state.engagements.length === 3);
    state.chainLinks.forEach((link) => {
      maximumLinkLengthError = Math.max(
        maximumLinkLengthError,
        Math.abs(link.length - geometry.linkPitch),
      );
      assert.equal(
        link.plane,
        Math.abs(link.materialIndex % 2) === 0
          ? 'coplanar-with-sprocket'
          : 'perpendicular-to-sprocket',
      );
    });
    state.nodes.forEach((node) => {
      const local = node.position.clone().sub(geometry.wheelCenter);
      if (node.section === 'arc') {
        maximumPitchCircleError = Math.max(
          maximumPitchCircleError,
          Math.abs(local.length() - geometry.pitchRadius),
        );
      } else {
        near(
          local.x,
          node.section === 'left'
            ? -geometry.pitchRadius
            : geometry.pitchRadius,
          0,
          `state ${index} ${node.section} run`,
        );
      }
    });
    state.engagements.forEach((engagement) => {
      // Teeth pass through the perpendicular (odd) links, as Brown draws.
      assert.equal(Math.abs(engagement.linkMaterialIndex % 2), 1);
      maximumEngagementPhaseError = Math.max(
        maximumEngagementPhaseError,
        Math.abs(engagement.phaseError),
      );
      maximumEngagementVelocityError = Math.max(
        maximumEngagementVelocityError,
        engagement.noSlipVelocityError.length(),
      );
    });
    minimumChordalVelocityFactor = Math.min(
      minimumChordalVelocityFactor,
      state.chordalVelocityFactor,
    );
    maximumChordalVelocityFactor = Math.max(
      maximumChordalVelocityFactor,
      state.chordalVelocityFactor,
    );
  }
  assert.ok(maximumLinkLengthError < 2.1e-15);
  assert.ok(maximumPitchCircleError < 5e-16);
  assert.ok(maximumEngagementPhaseError < 1e-15);
  assert.ok(maximumEngagementVelocityError < 1e-15);
  assert.ok(minimumChordalVelocityFactor > 1.95);
  near(maximumChordalVelocityFactor, geometry.pitchRadius, 0,
    'maximum chordal velocity factor');
  disposeModel(model.root);
});

test('movement 227 has smooth straight-to-pulley handoffs and exact full-turn advance', () => {
  const model = createMovementModel(catalog.movements[226]);
  const {
    blocks,
    geometry,
    stateAtInputAngle,
    transmission,
  } = model.root.userData;
  const epsilon = 1e-9;
  for (let boundary = 0; boundary <= 12; boundary += 1) {
    const angle = boundary * geometry.chainNodeStep;
    const before = stateAtInputAngle(angle - epsilon);
    const after = stateAtInputAngle(angle + epsilon);
    const afterByMaterialIndex = new Map(after.nodes.map(
      (node) => [node.materialIndex, node],
    ));
    let commonNodes = 0;
    before.nodes.forEach((node) => {
      const matching = afterByMaterialIndex.get(node.materialIndex);
      if (!matching) return;
      commonNodes += 1;
      assert.ok(
        node.position.distanceTo(matching.position) < 4.1e-9,
        `boundary ${boundary} node ${node.materialIndex} position is continuous`,
      );
      assert.ok(
        node.velocity.distanceTo(matching.velocity) < 6.4e-9,
        `boundary ${boundary} node ${node.materialIndex} velocity is continuous`,
      );
    });
    assert.equal(commonNodes, 21);

    model.update((angle - epsilon) / geometry.inputAngularSpeed);
    const renderedBefore = new Map(blocks.links.map((link) => [
      link.userData.materialIndex,
      {
        object: link,
        position: link.position.clone(),
        quaternion: link.quaternion.clone(),
      },
    ]));
    model.update((angle + epsilon) / geometry.inputAngularSpeed);
    const renderedAfter = new Map(blocks.links.map((link) => [
      link.userData.materialIndex,
      {
        object: link,
        position: link.position.clone(),
        quaternion: link.quaternion.clone(),
      },
    ]));
    let commonRenderedLinks = 0;
    before.chainLinks.forEach((link) => {
      const prior = renderedBefore.get(link.materialIndex);
      const next = renderedAfter.get(link.materialIndex);
      if (!prior || !next) return;
      commonRenderedLinks += 1;
      assert.equal(prior.object, next.object);
      assert.ok(prior.position.distanceTo(next.position) < 4.1e-9);
      assert.ok(prior.quaternion.angleTo(next.quaternion) < 4.3e-8);
    });
    assert.equal(commonRenderedLinks, 20);
  }

  let previousAdvance = Number.NEGATIVE_INFINITY;
  for (let index = 0; index <= 4096; index += 1) {
    const inputAngle = index / 4096 * FULL_TURN;
    const state = stateAtInputAngle(inputAngle);
    assert.ok(state.chainAdvance >= previousAdvance - 2e-15);
    previousAdvance = state.chainAdvance;
    if (index === 0 || index === 4096) continue;
    if (Math.abs(inputAngle / geometry.chainNodeStep
      - Math.round(inputAngle / geometry.chainNodeStep)) < 1e-5) continue;
    const derivativeStep = 1e-7;
    const finiteDifference = (
      stateAtInputAngle(inputAngle + derivativeStep).chainAdvance
      - stateAtInputAngle(inputAngle - derivativeStep).chainAdvance
    ) / (2 * derivativeStep);
    near(
      finiteDifference,
      state.chordalVelocityFactor,
      2e-8,
      `state ${index} chordal derivative`,
    );
  }
  const start = stateAtInputAngle(0);
  const closure = stateAtInputAngle(FULL_TURN);
  near(closure.sprocketAngle - start.sprocketAngle, -FULL_TURN, 0,
    'one pulley revolution');
  near(
    closure.chainAdvance - start.chainAdvance,
    transmission.chainTravelPerPulleyTurn,
    2e-15,
    'twelve-link chain advance',
  );
  assert.equal(
    closure.materialStepIndex - start.materialStepIndex,
    12,
  );
  closure.nodes.forEach((node, index) => {
    nearVector(
      node.position,
      start.nodes[index].position,
      2e-15,
      `closure node ${index}`,
    );
    assert.equal(
      node.materialIndex - start.nodes[index].materialIndex,
      12,
    );
  });
  disposeModel(model.root);
});

test('movement 227 renders interlocked plate and loop links in genuinely orthogonal planes', () => {
  const model = createMovementModel(catalog.movements[226]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  let sphereCount = 0;
  blocks.chain.traverse((object) => {
    if (object.geometry?.type === 'SphereGeometry') sphereCount += 1;
  });
  assert.equal(sphereCount, 0);
  // Brown draws flat plate links pierced at each joint; the links standing
  // across the teeth are flat loops seen edge-on.
  assert.equal(blocks.links.length % 2, 0);
  assert.equal(blocks.links[1].geometry.type, 'TubeGeometry');
  assert.equal(blocks.links[0].geometry.type, 'ExtrudeGeometry');
  assert.equal(blocks.links[0].geometry.parameters.shapes.holes.length, 2);
  assert.ok(geometry.linkLoopHalfWidth > geometry.linkWireRadius * 2.8);
  assert.ok(geometry.sprocketDepth < geometry.linkLoopHalfWidth * 2);

  for (const time of [0, 0.37, 1.1, 2.29, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    state.chainLinks.forEach((link, index) => {
      const renderSlot = THREE.MathUtils.euclideanModulo(
        link.materialIndex,
        blocks.links.length,
      );
      const object = blocks.links[renderSlot];
      assert.equal(object.userData.stateIndex, index);
      assert.equal(object.userData.materialIndex, link.materialIndex);
      assert.equal(object.userData.plane, link.plane);
      near(object.userData.currentLength, geometry.linkPitch, 2.1e-15,
        `time ${time} link ${index} length`);
      nearVector(object.position, link.start.position, 0,
        `time ${time} link ${index} start`);
      const renderedNormal = Z_AXIS.clone().applyQuaternion(object.quaternion);
      nearVector(
        renderedNormal,
        link.planeNormal,
        5e-16,
        `time ${time} link ${index} plane normal`,
      );
      if (index > 0) {
        near(
          Math.abs(link.planeNormal.dot(state.chainLinks[index - 1].planeNormal)),
          0,
          5e-16,
          `time ${time} links ${index - 1}/${index} are orthogonal`,
        );
      }
    });
    near(blocks.sprocketRotor.rotation.z, state.sprocketAngle, 1e-15,
      `time ${time} pulley transform`);
  }
  disposeModel(model.root);
});

test('movement 227 runtime closes in four authored seconds while 262 stays authored', () => {
  const model = createMovementModel(catalog.movements[226]);
  const { animationTiming, geometry, stateAtTime } = model.root.userData;
  assert.equal(geometry.cyclePeriod, 4);
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.cyclePeriod);
  near(closure.sprocketAngle - start.sprocketAngle, -FULL_TURN, 0,
    'runtime pulley closure');
  near(
    closure.chainAdvance - start.chainAdvance,
    12 * geometry.linkPitch,
    2e-15,
    'runtime chain closure',
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
