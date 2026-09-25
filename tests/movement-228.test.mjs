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

test('movement 228 is one twelve-pitch pulley carrying one ladder-rung chain', () => {
  const movement = catalog.movements[227];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 228);
  assert.equal(movement.number, '228');
  assert.equal(movement.title, 'Ladder-Rung Chain and Toothed Pulley');
  assert.equal(movement.category, 'Chain gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'twelve-pitch-ladder-rung-chain-pulley');
  assert.equal(archetype, movement.archetype);
  assert.equal(mechanism, archetype);
  assert.equal(blocks.sprocketRotor.userData.pitches, 12);
  assert.equal(blocks.disk.userData.rungPockets, 12);
  assert.equal(blocks.teeth.length, 12);
  assert.equal(new Set(blocks.teeth).size, 12);
  assert.equal(blocks.chain.userData.parallelSideLinkRows, 2);
  assert.equal(blocks.chain.userData.hasTransverseRungs, true);
  // Ten tail sections per leg run the chain down into its navel pipes.
  assert.equal(blocks.sections.length, 27);
  assert.equal(blocks.sideLinks.length, 54);
  assert.equal(blocks.rungs.length, 27);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialPageHasCanvasAnimation, false);
  disposeModel(model.root);
});

test('movement 228 preserves the six-interval half-wrap visible in the source plate', () => {
  const model = createMovementModel(catalog.movements[227]);
  const {
    blocks,
    geometry,
    sourceReference,
    transmission,
  } = model.root.userData;
  const plate = sourceReference.plate228;

  assert.equal(
    plate.chainConstruction,
    'two parallel side-link rows with transverse rungs',
  );
  assert.equal(plate.visibleUpperWrapRungIntervals, 6);
  assert.equal(plate.inferredPulleyPitchCount, 12);
  assert.equal(plate.solidPulleyFace, true);
  assert.equal(plate.rearRungSeparatingTeethVisible, true);
  assert.equal(plate.chainLeavesFrameAtBothLowerEdges, true);
  assert.equal(geometry.upperWrapPitchCount, 6);
  assert.equal(geometry.pulleyPitchCount, 12);
  near(geometry.chainNodeStep, Math.PI / 6, 0, 'pitch angle');
  near(
    geometry.linkPitch,
    2 * geometry.pitchRadius * Math.sin(Math.PI / 12),
    0,
    'twelve-sided pitch-polygon chord',
  );
  assert.ok(geometry.diskRadius < geometry.pitchRadius);
  assert.ok(geometry.toothRootRadius < geometry.diskRadius);
  assert.ok(geometry.toothTipRadius > geometry.pitchRadius);
  // As engraved, the wedges stand on a broad rim; their roots are buried in it.
  assert.ok(geometry.toothDepth < geometry.diskDepth);
  assert.ok(
    geometry.sidePlaneOffset - geometry.sidePlaneAlternation
      > geometry.toothDepth / 2,
  );
  assert.equal(transmission.pulleyPitches, 12);
  assert.equal(transmission.chainPitchPolygonSides, 12);
  assert.equal(transmission.toothAdvanceInRungs, 1);
  assert.equal(transmission.rungsAdvancedPerPulleyTurn, 12);
  assert.equal(transmission.chordalActionIncluded, true);
  assert.equal(blocks.disk.userData.pitchRadius, geometry.pitchRadius);
  blocks.teeth.forEach((tooth, index) => {
    assert.equal(tooth.userData.index, index);
    near(
      tooth.rotation.z,
      geometry.toothCenterPhase + index * geometry.chainNodeStep,
      0,
      `tooth ${index} source phase`,
    );
  });
  disposeModel(model.root);
});

test('movement 228 keeps every rigid ladder section exact through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[227]);
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
    assert.equal(state.nodes.length, 28);
    assert.equal(state.chainSections.length, 27);
    assert.equal(state.engagements.length, 6);
    state.chainSections.forEach((section) => {
      maximumLinkLengthError = Math.max(
        maximumLinkLengthError,
        Math.abs(section.length - geometry.linkPitch),
      );
      nearVector(
        section.sideLinkPlaneNormal,
        Z_AXIS,
        0,
        `state ${index} side-link plane`,
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
      maximumEngagementPhaseError = Math.max(
        maximumEngagementPhaseError,
        Math.abs(engagement.phaseError),
      );
      maximumEngagementVelocityError = Math.max(
        maximumEngagementVelocityError,
        engagement.noSlipVelocityError.length(),
      );
    });
    state.pocketAngles.forEach((pocketAngle, pocketIndex) => {
      near(
        state.toothAngles[pocketIndex] - pocketAngle,
        geometry.toothCenterPhase,
        1e-15,
        `state ${index} tooth/pocket separation ${pocketIndex}`,
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
  assert.ok(maximumLinkLengthError < 2.6e-15);
  assert.ok(maximumPitchCircleError < 5e-16);
  assert.ok(maximumEngagementPhaseError < 1e-15);
  assert.ok(maximumEngagementVelocityError < 1e-15);
  assert.ok(minimumChordalVelocityFactor > 2);
  near(maximumChordalVelocityFactor, geometry.pitchRadius, 0,
    'maximum chordal velocity factor');
  disposeModel(model.root);
});

test('movement 228 has smooth pin handoffs and advances twelve rungs per turn', () => {
  const model = createMovementModel(catalog.movements[227]);
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
        node.position.distanceTo(matching.position) < 4.2e-9,
        `boundary ${boundary} rung ${node.materialIndex} position is continuous`,
      );
      assert.ok(
        node.velocity.distanceTo(matching.velocity) < 6.5e-9,
        `boundary ${boundary} rung ${node.materialIndex} velocity is continuous`,
      );
    });
    assert.equal(commonNodes, 27);

    model.update((angle - epsilon) / geometry.inputAngularSpeed);
    const renderedBefore = new Map(blocks.sections.map((section) => [
      section.userData.materialIndex,
      {
        object: section,
        position: section.position.clone(),
        quaternion: section.quaternion.clone(),
      },
    ]));
    model.update((angle + epsilon) / geometry.inputAngularSpeed);
    const renderedAfter = new Map(blocks.sections.map((section) => [
      section.userData.materialIndex,
      {
        object: section,
        position: section.position.clone(),
        quaternion: section.quaternion.clone(),
      },
    ]));
    let commonRenderedSections = 0;
    before.chainSections.forEach((section) => {
      const prior = renderedBefore.get(section.materialIndex);
      const next = renderedAfter.get(section.materialIndex);
      if (!prior || !next) return;
      commonRenderedSections += 1;
      assert.equal(prior.object, next.object);
      assert.ok(prior.position.distanceTo(next.position) < 4.2e-9);
      assert.ok(prior.quaternion.angleTo(next.quaternion) < 3.1e-8);
    });
    assert.equal(commonRenderedSections, 26);
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
    'twelve-rung chain advance',
  );
  assert.equal(closure.materialStepIndex - start.materialStepIndex, 12);
  closure.nodes.forEach((node, index) => {
    nearVector(
      node.position,
      start.nodes[index].position,
      2e-15,
      `closure rung ${index}`,
    );
    assert.equal(node.materialIndex - start.nodes[index].materialIndex, 12);
  });
  disposeModel(model.root);
});

test('movement 228 renders rigid side links and transverse contact rungs without markers', () => {
  const model = createMovementModel(catalog.movements[227]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  let sphereCount = 0;
  blocks.chain.traverse((object) => {
    if (object.geometry?.type === 'SphereGeometry') sphereCount += 1;
  });
  assert.equal(sphereCount, 0);
  assert.ok(blocks.sideLinks.every(
    (sideLink) => sideLink.geometry.type === 'TubeGeometry',
  ));
  assert.ok(blocks.rungs.every(
    (rung) => rung.geometry.type === 'CylinderGeometry',
  ));
  blocks.sections.forEach((section) => {
    assert.equal(section.userData.sideLinks.length, 2);
    assert.equal(section.userData.rung.userData.transverseRung, true);
    nearVector(section.userData.rung.userData.axis, Z_AXIS, 0, 'rung axis');
  });

  for (const time of [0, 0.37, 1.1, 2.29, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    state.chainSections.forEach((link, stateIndex) => {
      const renderSlot = THREE.MathUtils.euclideanModulo(
        link.materialIndex,
        blocks.sections.length,
      );
      const object = blocks.sections[renderSlot];
      assert.equal(object.userData.stateIndex, stateIndex);
      assert.equal(object.userData.materialIndex, link.materialIndex);
      near(object.userData.currentLength, geometry.linkPitch, 2.6e-15,
        `time ${time} section ${stateIndex} length`);
      nearVector(object.position, link.start.position, 0,
        `time ${time} section ${stateIndex} start`);
      const renderedEnd = new THREE.Vector3(geometry.linkPitch, 0, 0)
        .applyQuaternion(object.quaternion)
        .add(object.position);
      nearVector(renderedEnd, link.end.position, 2.7e-15,
        `time ${time} section ${stateIndex} end`);
      const [rearSideLink, frontSideLink] = object.userData.sideLinks;
      assert.ok(rearSideLink.position.z < -geometry.toothDepth / 2);
      assert.ok(frontSideLink.position.z > geometry.toothDepth / 2);
      near(
        Math.abs(rearSideLink.position.z),
        Math.abs(frontSideLink.position.z),
        0,
        `time ${time} section ${stateIndex} symmetric side rows`,
      );
    });
    state.engagements.forEach((engagement) => {
      const renderSlot = THREE.MathUtils.euclideanModulo(
        engagement.rungMaterialIndex,
        blocks.sections.length,
      );
      const section = blocks.sections[renderSlot];
      nearVector(
        section.position,
        engagement.contactPoint,
        0,
        `time ${time} engaged rung ${engagement.rungMaterialIndex}`,
      );
    });
    near(blocks.sprocketRotor.rotation.z, state.sprocketAngle, 1e-15,
      `time ${time} pulley transform`);
  }
  disposeModel(model.root);
});

test('movement 228 closes in four authored seconds while movement 507 stays authored', () => {
  const model = createMovementModel(catalog.movements[227]);
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
    'runtime ladder-chain closure',
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
