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
  'watt-twin-flexible-water-mains-with-ball-socket-pipe-joints-coaxial-horizontal-frame-hinges-and-plugged-hauling-ends';
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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
  const movement = catalog.movements[467];
  return { model: createMovementModel(movement), movement };
}

test('movement 468 is two independent framed water mains with ball-socket joints and plugged tow ends', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 468);
  assert.equal(movement.number, '468');
  assert.equal(movement.title, 'Flexible water main, plan and section');
  assert.equal(movement.category, 'Hydraulics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.pipelines.length, 2);
  assert.notEqual(blocks.pipelines[0], blocks.pipelines[1]);
  assert.deepEqual(blocks.pipelines.map((pipeline) =>
    pipeline.userData.insideDiameterInches), [15, 18]);
  for (const pipeline of blocks.pipelines) {
    assert.equal(pipeline.parent, model.root);
    assert.equal(pipeline.userData.segmentGroups.length,
      geometry.segmentCount);
    assert.equal(pipeline.userData.ballJoints.length,
      geometry.segmentCount - 1);
    assert.equal(pipeline.userData.socketJoints.length,
      geometry.segmentCount - 1);
    assert.equal(pipeline.userData.hingePins.length,
      geometry.segmentCount - 1);
    assert.equal(pipeline.userData.pipeShells.length,
      geometry.segmentCount);
    assert.equal(pipeline.userData.waterCores.length,
      geometry.segmentCount);
  }
  assert.equal(blocks.northPlugs.length, 2);
  assert.equal(blocks.towCables.length, 2);
  assert.equal(blocks.winches.length, 2);
  assert.equal(degreesOfFreedom.mainsMechanicallyCoupled, false);
  assert.equal(degreesOfFreedom.synchronizedDisplayOnly, true);
  assert.equal(degreesOfFreedom.hingeTwistAllowed, false);
  assert.equal(degreesOfFreedom.hingeDegreesOfFreedomPerMain, 3);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  disposeModel(model.root);
});

test('movement 468 source record preserves the two bores, log frames, horizontal pivots, plugged tow end, and unavailable animation', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate468;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_468.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 468');
  assert.match(sourceReference.supplementaryPrimarySource,
    /John Robison.*1820.*60–62/i);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximatePlanJointCenterPixels, [278, 380]);
  assert.deepEqual(plate.approximateSectionJointCenterPixels, [285, 163]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('15-inch and 18-inch')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('log frames')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('horizontal pivots')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('north pipe end was plugged')));
  assert.match(evidence.engravingEvidence,
    /transverse frame hinge crosses the same joint center/i);
  assert.match(evidence.primaryEngineeringAccount,
    /nine feet long exclusive of joints/i);
  assert.match(evidence.primaryEngineeringAccount,
    /right angles to the pipe axes/i);
  assert.match(evidence.reconstructionDisclosure,
    /Four representative pieces per independent main/i);
  disposeModel(model.root);
});

test('movement 468 uses the exact 15:18 clear-bore ratio and nine-foot representative barrels', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const [main15, main18] = blocks.pipelines;

  assert.deepEqual(geometry.pipeInsideDiametersInches, [15, 18]);
  near(18 / 15, 1.2, 1e-14, 'historical diameter ratio');
  near(main18.userData.innerRadius / main15.userData.innerRadius,
    18 / 15, 1e-14, 'model clear-bore radius ratio');
  near(2 * main15.userData.innerRadius / geometry.modelUnitsPerFoot * 12,
    15, 1e-12, '15-inch clear bore');
  near(2 * main18.userData.innerRadius / geometry.modelUnitsPerFoot * 12,
    18, 1e-12, '18-inch clear bore');
  near(geometry.pipeBarrelLength / geometry.modelUnitsPerFoot,
    geometry.historicalPipePieceLengthFeet, 1e-12,
    'nine-foot barrel length');
  near(geometry.framePitch,
    geometry.pipeBarrelLength + geometry.jointAllowance, 1e-12,
    'frame pitch includes joint allowance');
  near(main15.userData.outerRadius - main15.userData.innerRadius,
    geometry.pipeWallThickness, 1e-12, '15-inch wall thickness');
  near(main18.userData.outerRadius - main18.userData.innerRadius,
    geometry.pipeWallThickness, 1e-12, '18-inch wall thickness');
  disposeModel(model.root);
});

test('movement 468 recursive chain has exact frame lengths and never opens a neighboring joint', () => {
  const { model } = movementModel();
  const { chainKinematics, geometry } = model.root.userData;

  for (const progress of [0, 0.08, 0.29, 0.53, 0.81, 1]) {
    const chain = chainKinematics(progress);
    assert.equal(chain.segments.length, geometry.segmentCount);
    assert.equal(chain.jointCenters.length, geometry.segmentCount + 1);
    vectorNear(chain.anchor, chain.jointCenters[0], 1e-12,
      `south end at ${progress}`);
    vectorNear(chain.northEnd, chain.jointCenters.at(-1), 1e-12,
      `north end at ${progress}`);
    chain.segments.forEach((segment, index) => {
      near(segment.start.distanceTo(segment.end), geometry.framePitch,
        2e-12, `frame pitch ${index} at ${progress}`);
      vectorNear(segment.start, chain.jointCenters[index], 2e-12,
        `segment ${index} start at ${progress}`);
      vectorNear(segment.end, chain.jointCenters[index + 1], 2e-12,
        `segment ${index} end at ${progress}`);
      vectorNear(segment.center,
        segment.start.clone().add(segment.end).multiplyScalar(0.5),
        2e-12, `segment ${index} center at ${progress}`);
      if (index > 0) {
        vectorNear(chain.segments[index - 1].end, segment.start,
          2e-12, `joint ${index} closure at ${progress}`);
      }
    });
  }
  disposeModel(model.root);
});

test('movement 468 analytic frame-chain velocities and accelerations match finite differences', () => {
  const { model } = movementModel();
  const { chainKinematics } = model.root.userData;
  const timeStep = 1e-4;

  for (const [progress, rate, acceleration] of [
    [0.16, 0.24, -0.09],
    [0.47, 0.31, 0.06],
    [0.82, -0.19, -0.04],
  ]) {
    const center = chainKinematics(progress, rate, acceleration);
    const before = chainKinematics(
      progress - rate * timeStep + 0.5 * acceleration * timeStep ** 2,
    );
    const after = chainKinematics(
      progress + rate * timeStep + 0.5 * acceleration * timeStep ** 2,
    );
    center.segments.forEach((segment, index) => {
      const finiteVelocity = after.segments[index].end.clone()
        .sub(before.segments[index].end)
        .multiplyScalar(1 / (2 * timeStep));
      const finiteAcceleration = after.segments[index].end.clone()
        .add(before.segments[index].end)
        .addScaledVector(segment.end, -2)
        .multiplyScalar(1 / timeStep ** 2);
      vectorNear(finiteVelocity, segment.endVelocity, 3e-8,
        `end velocity ${index} at ${progress}`);
      vectorNear(finiteAcceleration, segment.endAcceleration, 5e-7,
        `end acceleration ${index} at ${progress}`);
    });
  }
  disposeModel(model.root);
});

test('movement 468 visual ball, socket, and frame-hinge centers remain exactly coincident', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtPhase } = model.root.userData;

  for (const phase of [0, 0.19, 0.34, 0.48, 0.66, 0.84, 0.97]) {
    const state = stateAtPhase(phase);
    model.update(phase * geometry.cycleDuration);
    model.root.updateMatrixWorld(true);
    blocks.pipelines.forEach((pipeline, mainIndex) => {
      const z = geometry.pipelineCenterZ[mainIndex];
      for (let jointIndex = 0; jointIndex < geometry.segmentCount - 1;
        jointIndex += 1) {
        const expected = state.chain.jointCenters[jointIndex + 1].clone();
        expected.z = z;
        const ballCenter = pipeline.userData.ballJoints[jointIndex]
          .getWorldPosition(new THREE.Vector3());
        const socketCenter = pipeline.userData.socketJoints[jointIndex]
          .getWorldPosition(new THREE.Vector3());
        const hingeCenter = pipeline.userData.hingePins[jointIndex]
          .getWorldPosition(new THREE.Vector3());
        vectorNear(ballCenter, expected, 3e-12,
          `main ${mainIndex} ball ${jointIndex} at ${phase}`);
        vectorNear(socketCenter, expected, 3e-12,
          `main ${mainIndex} socket ${jointIndex} at ${phase}`);
        vectorNear(hingeCenter, expected, 3e-12,
          `main ${mainIndex} hinge ${jointIndex} at ${phase}`);
      }
    });
  }
  disposeModel(model.root);
});

test('movement 468 hinge pins stay horizontal, perpendicular to both adjacent pipe axes, and within socket capacity', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtPhase } = model.root.userData;

  for (const phase of [0.22, 0.37, 0.48, 0.63, 0.81, 0.93]) {
    const state = stateAtPhase(phase);
    model.update(phase * geometry.cycleDuration);
    model.root.updateMatrixWorld(true);
    for (const pipeline of blocks.pipelines) {
      pipeline.userData.hingePins.forEach((pin, jointIndex) => {
        const quaternion = pin.getWorldQuaternion(new THREE.Quaternion());
        const visiblePinAxis = Y_AXIS.clone().applyQuaternion(quaternion);
        near(Math.abs(visiblePinAxis.dot(geometry.hingeAxis)), 1, 2e-12,
          `horizontal pin axis ${jointIndex} at ${phase}`);
        near(visiblePinAxis.dot(state.chain.segments[jointIndex].axis),
          0, 2e-12, `upstream perpendicularity ${jointIndex} at ${phase}`);
        near(visiblePinAxis.dot(state.chain.segments[jointIndex + 1].axis),
          0, 2e-12, `downstream perpendicularity ${jointIndex} at ${phase}`);
      });
    }
    state.chain.jointDeflections.forEach((joint, index) => {
      assert.ok(Math.abs(joint.angle) <= geometry.socketAngularCapacity + 1e-12,
        `joint ${index} exceeds socket capacity at ${phase}`);
    });
  }
  disposeModel(model.root);
});

test('movement 468 installed log frames land at the prescribed clearance above the prepared bed', () => {
  const { model } = movementModel();
  const { blocks, geometry, chainKinematics } = model.root.userData;
  const installed = chainKinematics(1);

  model.update(0.60 * geometry.cycleDuration);
  model.root.updateMatrixWorld(true);
  installed.segments.forEach((segment, segmentIndex) => {
    const bedCenter = blocks.bedPieces[segmentIndex]
      .getWorldPosition(new THREE.Vector3());
    for (const pipeline of blocks.pipelines) {
      const log = pipeline.userData.frameLogs[segmentIndex * 2];
      const logCenter = log.getWorldPosition(new THREE.Vector3());
      const surfaceGap = logCenter.clone().sub(bedCenter)
        .dot(segment.normal)
        - geometry.frameLogRadius - geometry.bedThickness / 2;
      near(surfaceGap, geometry.installedFrameClearance, 2e-12,
        `frame ${segmentIndex} bed clearance`);
    }
  });
  disposeModel(model.root);
});

test('movement 468 tow cable and winch obey exact reeled-length no-slip kinematics', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const timeStep = 1e-4;

  for (const phase of [0.18, 0.27, 0.39, 0.79, 0.88, 0.95]) {
    const time = phase * geometry.cycleDuration;
    const state = stateAtTime(time);
    const before = stateAtTime(time - timeStep);
    const after = stateAtTime(time + timeStep);
    near(state.reeledCableLength,
      geometry.initialCableLength - state.cableLength, 1e-12,
      `reeled cable definition at ${phase}`);
    near(state.winchAngle * geometry.winchSpoolRadius,
      state.reeledCableLength, 1e-12,
      `no slip at ${phase}`);
    near((after.cableLength - before.cableLength) / (2 * timeStep),
      state.cableLengthRate, 2e-8,
      `cable velocity at ${phase}`);
    near((after.cableLength - 2 * state.cableLength + before.cableLength)
      / timeStep ** 2,
    state.cableLengthAcceleration, 1e-6,
    `cable acceleration at ${phase}`);
    near(state.winchAngularVelocity * geometry.winchSpoolRadius,
      state.reeledCableRate, 1e-12,
      `winch velocity no slip at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 468 update applies the analytic chain, cable length, and indexed winch angle to both independent mains', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtPhase } = model.root.userData;

  for (const phase of [0, 0.29, 0.48, 0.69, 0.87, 0.999]) {
    const state = stateAtPhase(phase);
    model.update(phase * geometry.cycleDuration);
    blocks.pipelines.forEach((pipeline, mainIndex) => {
      pipeline.userData.segmentGroups.forEach((group, segmentIndex) => {
        const segment = state.chain.segments[segmentIndex];
        vectorNear(group.position,
          new THREE.Vector3(
            segment.start.x,
            segment.start.y,
            geometry.pipelineCenterZ[mainIndex],
          ), 2e-12, `group ${mainIndex}:${segmentIndex} at ${phase}`);
        near(group.rotation.z, segment.angle, 1e-12,
          `angle ${mainIndex}:${segmentIndex} at ${phase}`);
      });
      near(blocks.towCables[mainIndex].scale.y, state.cableLength,
        2e-12, `tow cable ${mainIndex} at ${phase}`);
      near(blocks.winchRotors[mainIndex].rotation.z, state.winchAngle,
        1e-12, `winch ${mainIndex} at ${phase}`);
    });
  }
  disposeModel(model.root);
});

test('movement 468 deployment and loop reset are C2 at every schedule boundary', () => {
  const { model } = movementModel();
  const { geometry, stateAtPhase } = model.root.userData;
  const boundaries = [
    0,
    geometry.straightHoldEndPhase,
    geometry.deploymentEndPhase,
    geometry.installedHoldEndPhase,
  ];
  const step = 1e-6;
  const sampleField = (phase, field) => {
    const state = stateAtPhase(phase);
    if (field === 'progress') return state.deploymentProgress;
    if (field === 'northX') return state.chain.northEnd.x;
    return state.chain.northEnd.y;
  };

  for (const boundary of boundaries) {
    for (const field of ['progress', 'northX', 'northY']) {
      const minusTwo = sampleField(boundary - 2 * step, field);
      const minusOne = sampleField(boundary - step, field);
      const center = sampleField(boundary, field);
      const plusOne = sampleField(boundary + step, field);
      const plusTwo = sampleField(boundary + 2 * step, field);
      const leftVelocity = (center - minusOne) / step;
      const rightVelocity = (plusOne - center) / step;
      near(leftVelocity, rightVelocity, 3e-6,
        `${field} velocity continuity at ${boundary}`);
      const leftAcceleration = (center - 2 * minusOne + minusTwo)
        / step ** 2;
      const rightAcceleration = (plusTwo - 2 * plusOne + center)
        / step ** 2;
      near(leftAcceleration, rightAcceleration, 0.01,
        `${field} acceleration continuity at ${boundary}`);
    }
  }
  disposeModel(model.root);
});

test('movement 468 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement468 = catalog.movements[467];
  const movement507 = catalog.movements[506];
  const model468 = createMovementModel(movement468);
  const model507 = createMovementModel(movement507);
  const fitBounds = model468.root.userData.cameraFitBounds;

  for (const phase of [0, 0.25, 0.48, 0.65, 0.86, 0.98]) {
    model468.update(phase * model468.root.userData.geometry.cycleDuration);
    model468.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model468.root);
    for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
      bounds.max.x, bounds.max.y, bounds.max.z]) {
      assert.ok(Number.isFinite(value));
    }
    assert.ok(bounds.max.x > bounds.min.x);
    assert.ok(bounds.max.y > bounds.min.y);
    assert.ok(bounds.max.z > bounds.min.z);
    // Brown draws two figures of one joint (elevation above, plan below).
    // The analytic crossing stays hidden; the visible figures fill the fit.
    const blocks = model468.root.userData.blocks;
    for (const object of blocks.crossing) assert.equal(object.visible, false);
    const { elevation, plan } = blocks.plateFigures;
    const visible = new THREE.Box3();
    for (const figure of [elevation, plan]) {
      figure.traverseVisible((object) => {
        if (!object.isMesh) return;
        object.geometry.computeBoundingBox();
        visible.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      });
    }
    assert.ok(fitBounds.clone().expandByScalar(0.01).containsBox(visible), `figures fit at ${phase}: ${JSON.stringify([visible.min, visible.max])}`);
    const elevationBox = new THREE.Box3().setFromObject(elevation);
    const planBox = new THREE.Box3().setFromObject(plan);
    assert.ok(elevationBox.min.y > planBox.max.y, 'elevation drawn above plan');
    // Both figures reproduce the front main's middle-joint deflection.
    const time = phase * model468.root.userData.geometry.cycleDuration;
    const deflection = model468.root.userData.plateFigures.figureDeflectionAtTime(time);
    near(elevation.userData.upstream.rotation.z, -deflection, 1e-12, 'elevation deflection');
    near(plan.userData.upstream.rotation.z, -deflection, 1e-12, 'plan deflection');
    assert.ok(Math.abs(deflection) <= model468.root.userData.geometry.socketAngularCapacity);
  }
  // The default pose is Brown's flexed elevation.
  model468.update(0);
  assert.ok(model468.root.userData.plateFigures.figureDeflectionAtTime(0) > THREE.MathUtils.degToRad(20));
  assert.equal(movement468.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model468.root);
  disposeModel(model507.root);
});
