import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

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

function vector3Near(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function worldPosition(object) {
  return object.getWorldPosition(new THREE.Vector3());
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

test('movement 351 is one gravity-drop stamp driven by one mutilated pinion', () => {
  const movement = catalog.movements[350];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 351);
  assert.equal(movement.number, '351');
  assert.equal(movement.title,
    'Stamp. Vertical percussive falls derived from horizontal rotating shaft');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype,
    'gravity-drop-stamp-with-six-tooth-mutilated-pinion');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /eight-tooth-mutilated-pinion/);
  assert.match(mechanism, /raises-one-single-sided-vertical-rack/);
  assert.match(mechanism, /ten-position-blank-sector-releases/);
  assert.match(mechanism, /fall-under-gravity-impact-the-lower-stop/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.match(degreesOfFreedom.input, /continuously rotating/);
  assert.match(degreesOfFreedom.output, /translating vertically/);
  assert.match(transmission.lift, /exactly eight rack pitches/);
  assert.match(transmission.engagedVelocityConstraint,
    /rackVelocity = -driverAngularVelocity \* pitchRadius/);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.inputShaft.parent, model.root);
  assert.equal(blocks.rack.parent, model.root);
  assert.equal(blocks.contactMarker.parent, model.root);
  assert.equal(blocks.gearBody.parent, blocks.pinion);
  assert.equal(blocks.gearRootOutline.parent, blocks.pinion);
  assert.equal(blocks.pinionHub.parent, blocks.pinion);
  assert.equal(blocks.pinionIndicator.parent, blocks.pinion);
  assert.equal(blocks.blankSectorIndicator.parent, blocks.pinion);
  assert.equal(blocks.pinionPitchContactAnchor.parent, blocks.pinion);
  assert.equal(blocks.rackBar.parent, blocks.rack);
  assert.equal(blocks.stampDie.parent, blocks.rack);
  assert.equal(blocks.dieFace.parent, blocks.rack);
  assert.equal(blocks.stampFaceAnchor.parent, blocks.rack);
  assert.equal(blocks.rackPitchContactAnchor.parent, blocks.rack);
  assert.equal(blocks.gearTeeth.length, 8);
  assert.equal(blocks.gearToothFaceLines.length, 8);
  assert.equal(blocks.rackTeeth.length, 8);
  assert.equal(blocks.rackToothFaceLines.length, 8);
  assert.equal(blocks.guideAssemblies.length, 2);
  assert.equal(blocks.pinion.userData.mutilated, true);
  assert.equal(blocks.pinion.userData.teeth, 18);
  assert.equal(blocks.pinion.userData.missingToothCount, 10);
  assert.deepEqual(blocks.pinion.userData.installedToothIndices,
    [0, 1, 2, 3, 4, 5, 6, 7]);
  // Brown draws no rod guides: they stay as kinematic references only.
  blocks.guideAssemblies.forEach(({ guide }) => {
    assert.equal(guide.parent, null);
    assert.equal(guide.userData.openTowardRackTeeth, true);
  });

  assert.equal(contacts.gearRackPitchContact.fixedAxisMember,
    blocks.pinion);
  assert.equal(contacts.gearRackPitchContact.movingRackMember,
    blocks.rack);
  assert.equal(contacts.rackInOpenGuides.movingMember, blocks.rack);
  assert.equal(contacts.rackInOpenGuides.fixedMembers.length, 2);
  assert.equal(contacts.stampAtLowerStop.restitution, 0);
  assert.match(contacts.stampAtLowerStop.type,
    /perfectly-inelastic-percussive-stamp-impact/);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /^installed-mutilated-pinion-tooth-/.test(role)).length, 8);
  assert.equal(roles.filter((role) =>
    /^single-sided-rack-tooth-/.test(role)).length, 8);
  assert.equal(roles.filter((role) =>
    /C-shaped-rack-guide-open-to-teeth|back-bar|back-arm|fixed-bearing/.test(role)).length, 0);
  assert.equal(roles.filter((role) => role ===
    'heavy-falling-polygonal-stamp-head').length, 1);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)),
    false);
  disposeModel(model.root);
});

test('movement 351 reconstructs the eight-tooth engraving without claiming a source animation', () => {
  const model = createMovementModel(catalog.movements[350]);
  const {
    dynamics,
    geometry,
    sourceAnimation,
    sourceReference,
  } = model.root.userData;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_351.html');
  assert.equal(sourceAnimation.presentationTiming.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.presentationTiming.durationSeconds, 4);
  assert.equal(sourceAnimation.presentationTiming.sourcePrescribed, false);
  assert.equal(sourceAnimation.reconstruction.virtualToothCount, 18);
  assert.equal(sourceAnimation.reconstruction.installedToothCount, 8);
  assert.equal(sourceAnimation.reconstruction.missingToothCount, 10);
  assert.match(sourceAnimation.reconstruction.dynamics,
    /exact uniform-gravity free flight/);
  assert.match(sourceAnimation.referenceScope, /eight visible sector teeth/);

  assert.equal(geometry.virtualToothCount, 18);
  assert.equal(geometry.sectorToothCount, 8);
  assert.equal(geometry.missingToothCount, 10);
  near(geometry.toothPitchAngle, 2 * Math.PI / 18, 0,
    'one-eighteenth-turn angular pitch');
  near(geometry.rackToothPitch,
    geometry.pitchRadius * geometry.toothPitchAngle, 0,
    'rack linear pitch');
  near(geometry.rackStroke,
    geometry.sectorToothCount * geometry.rackToothPitch, 0,
    'eight-pitch lift');
  near(geometry.engagementFraction, 8 / 18, 0,
    'eight eighteenths of one driver turn engage');
  assert.ok(geometry.gearRootRadius < geometry.pitchRadius);
  assert.ok(geometry.pitchRadius < geometry.gearOuterRadius);
  assert.ok(geometry.rackToothRootX < geometry.pitchLineX);
  assert.ok(geometry.pitchLineX < geometry.rackToothTipX);
  assert.ok(geometry.wheelCenter.x - geometry.gearRootRadius
    > geometry.rackToothTipX,
  'the blank root disk clears rack tooth tips');
  assert.ok(geometry.wheelCenter.x - geometry.gearOuterRadius
    > geometry.rackToothRootX,
  'installed pinion teeth retain root clearance');
  assert.ok(geometry.wheelCenter.x - geometry.gearOuterRadius
    < geometry.pitchLineX,
  'installed pinion teeth cross the rack pitch line');
  assert.ok(geometry.upperGuideY > geometry.wheelCenter.y);
  assert.ok(geometry.lowerGuideY < geometry.wheelCenter.y);
  near(dynamics.releaseTime,
    geometry.engagementFraction * geometry.cyclePeriod, 0,
    'release after the eighth pitch');

  const plate = sourceReference.brownPlate351;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.deepEqual(plate.rasterGearCenter, new THREE.Vector2(305, 216));
  assert.deepEqual(plate.rasterPitchContact, new THREE.Vector2(244, 216));
  assert.equal(plate.rasterGearOuterRadius, 70);
  assert.equal(plate.rasterRackCenterX, 222);
  assert.match(plate.inferredTopology,
    /eight consecutive teeth on an eighteen-position pinion/);
  disposeModel(model.root);
});

test('movement 351 maintains exact pitch mesh through all eight tooth handoffs', () => {
  const model = createMovementModel(catalog.movements[350]);
  const { geometry, stateAtCycleCoordinate } = model.root.userData;

  for (let sample = 0; sample < 24576; sample += 1) {
    const phase = geometry.engagementFraction * sample / 24576;
    const state = stateAtCycleCoordinate(phase);
    assert.equal(state.gearEngaged, true);
    assert.equal(state.freeFlight, false);
    assert.equal(state.lowerStopEngaged, false);
    near(state.rackDisplacement,
      geometry.fullTurn * geometry.pitchRadius * phase,
      9e-16, `pitch-line lift ${sample}`);
    near(state.rackVelocity, geometry.rackLiftVelocity, 0,
      `constant engaged lift velocity ${sample}`);
    near(state.rackAcceleration, 0, 0,
      `engaged acceleration ${sample}`);
    near(state.pitchesLifted, phase * geometry.virtualToothCount,
      2e-15, `pitches lifted ${sample}`);
    near(state.meshPhaseInvariant, -0.5, 2e-15,
      `mesh phase invariant ${sample}`);
    near(state.meshPhaseError, 0, 2e-15,
      `mesh phase error ${sample}`);
    near(state.surfaceVelocityError, 0, 0,
      `pitch-line velocity error ${sample}`);
    const expectedTooth = Math.min(
      geometry.sectorToothCount - 1,
      Math.floor(phase * geometry.virtualToothCount),
    );
    assert.equal(state.activeGearToothIndex, expectedTooth);
    assert.equal(state.activeRackGapIndex, -expectedTooth - 1);
  }

  for (let toothIndex = 0;
    toothIndex < geometry.sectorToothCount;
    toothIndex += 1) {
    const centerPhase = (geometry.gearBaseAngle - Math.PI
      + toothIndex * geometry.toothPitchAngle) / geometry.fullTurn;
    const state = stateAtCycleCoordinate(centerPhase);
    const toothWorldAngle = geometry.gearBaseAngle
      + toothIndex * geometry.toothPitchAngle
      - geometry.fullTurn * centerPhase;
    near(toothWorldAngle, Math.PI, 9e-16,
      `tooth ${toothIndex} centered at left pitch point`);
    near(state.rackDisplacement, geometry.pitchRadius * geometry.fullTurn * centerPhase,
      9e-16, `tooth ${toothIndex} preserves the rack pitch law`);
  }
  const beforeRelease = stateAtCycleCoordinate(
    geometry.engagementFraction - 1e-12,
  );
  near(beforeRelease.rackDisplacement, geometry.rackStroke,
    2e-11, 'eighth tooth reaches full geared lift');
  near(beforeRelease.driverAngularVelocity,
    -geometry.fullTurn / geometry.cyclePeriod, 0,
    'pinion rotates clockwise at constant rate');
  disposeModel(model.root);
});

test('movement 351 gives the released stamp an exact gravity trajectory', () => {
  const model = createMovementModel(catalog.movements[350]);
  const {
    dynamics,
    geometry,
    stateAtCycleCoordinate,
    stateAtUnshiftedTime: stateAtTime,
  } = model.root.userData;
  const release = stateAtTime(dynamics.releaseTime);
  near(release.rackDisplacement, geometry.rackStroke, 0,
    'release displacement');
  near(release.rackVelocity, geometry.rackLiftVelocity, 0,
    'release retains pitch-line velocity');
  near(release.rackAcceleration, -dynamics.gravity, 0,
    'gravity begins immediately at release');
  assert.equal(release.gearEngaged, false);
  assert.equal(release.freeFlight, true);

  for (let sample = 0; sample < 16384; sample += 1) {
    const tau = dynamics.ballisticTimeToImpact * sample / 16384;
    const time = dynamics.releaseTime + tau;
    const state = stateAtTime(time);
    assert.equal(state.gearEngaged, false);
    assert.equal(state.freeFlight, true);
    assert.equal(state.lowerStopEngaged, false);
    near(state.rackDisplacement,
      geometry.rackStroke + geometry.rackLiftVelocity * tau
        - 0.5 * dynamics.gravity * tau ** 2,
      5e-15, `ballistic position ${sample}`);
    near(state.rackVelocity,
      geometry.rackLiftVelocity - dynamics.gravity * tau,
      4e-15, `ballistic velocity ${sample}`);
    near(state.rackAcceleration, -dynamics.gravity, 0,
      `ballistic acceleration ${sample}`);
    near(state.mechanicalEnergy, dynamics.releaseMechanicalEnergy,
      2e-13, `ballistic energy ${sample}`);
    near(state.stampFaceY,
      geometry.stampFaceRestY + state.rackDisplacement, 0,
      `stamp face follows rack ${sample}`);
  }

  const apex = stateAtCycleCoordinate(dynamics.ballisticApexPhase);
  near(apex.rackVelocity, 0, 0, 'ballistic apex speed');
  near(apex.rackDisplacement, dynamics.maximumRackDisplacement,
    9e-16, 'ballistic apex height');
  assert.ok(dynamics.maximumRackDisplacement > geometry.rackStroke,
    'release velocity carries the rack above the geared endpoint');
  const beforeImpact = stateAtTime(dynamics.impactTime - 1e-10);
  near(beforeImpact.rackDisplacement, 0, 9e-10,
    'ballistic path reaches the lower stop continuously');
  near(beforeImpact.rackVelocity, dynamics.impactVelocity, 1e-9,
    'pre-impact velocity');
  const impact = stateAtTime(dynamics.impactTime);
  near(impact.rackDisplacement, 0, 0, 'impact stop position');
  near(impact.rackVelocity, 0, 0, 'zero-restitution impact velocity');
  assert.equal(impact.lowerStopEngaged, true);
  disposeModel(model.root);
});

test('movement 351 impacts before the blank sector ends and dwells safely', () => {
  const model = createMovementModel(catalog.movements[350]);
  const {
    contacts,
    dynamics,
    geometry,
    stateAtUnshiftedTime: stateAtTime,
  } = model.root.userData;

  assert.ok(dynamics.impactPhase > geometry.engagementFraction);
  assert.ok(dynamics.impactPhase < 1);
  assert.ok(dynamics.dwellTime > 0);
  assert.ok(dynamics.dwellFraction > 0);
  near(dynamics.impactKineticEnergy,
    dynamics.releaseMechanicalEnergy, 2e-14,
    'free-flight energy becomes impact energy');
  near(contacts.stampAtLowerStop.impactVelocity,
    dynamics.impactVelocity, 0, 'published impact velocity');
  near(contacts.stampAtLowerStop.impactEnergy,
    dynamics.impactKineticEnergy, 0, 'published impact energy');
  assert.equal(dynamics.restitution, 0);

  for (let sample = 0; sample < 4096; sample += 1) {
    const time = THREE.MathUtils.lerp(
      dynamics.impactTime,
      geometry.cyclePeriod,
      sample / 4096,
    );
    const state = stateAtTime(time);
    assert.equal(state.gearEngaged, false);
    assert.equal(state.freeFlight, false);
    assert.equal(state.lowerStopEngaged, true);
    near(state.rackDisplacement, 0, 0,
      `lower-stop displacement ${sample}`);
    near(state.rackVelocity, 0, 0,
      `lower-stop velocity ${sample}`);
    near(state.rackAcceleration, 0, 0,
      `lower-stop acceleration ${sample}`);
    near(state.anvilClearance, 0, 0,
      `closed anvil clearance ${sample}`);
    assert.ok(state.toothlessClearancePitches >= 0);
  }
  const impact = stateAtTime(dynamics.impactTime);
  assert.ok(impact.toothlessClearancePitches > 1,
    'more than one pitch of blank sector remains when the stamp lands');
  const closure = stateAtTime(geometry.cyclePeriod);
  assert.equal(closure.gearEngaged, true);
  near(closure.rackDisplacement, 0, 0,
    'rack is ready at reengagement');
  disposeModel(model.root);
});

test('movement 351 analytic lift and fall rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[350]);
  const { dynamics, stateAtUnshiftedTime: stateAtTime } = model.root.userData;
  const velocityStep = 2e-6;
  const accelerationStep = 1e-4;
  const samples = [
    0.17, 0.63, 1.22, 1.81, 2.21,
    2.43, 2.57, 2.83, 3.12, 3.34,
    3.51, 3.79,
  ];

  for (const time of samples) {
    assert.ok(Math.abs(time - dynamics.releaseTime) > accelerationStep);
    assert.ok(Math.abs(time - dynamics.impactTime) > accelerationStep);
    const state = stateAtTime(time);
    const beforeV = stateAtTime(time - velocityStep);
    const afterV = stateAtTime(time + velocityStep);
    near(state.rackVelocity,
      (afterV.rackDisplacement - beforeV.rackDisplacement)
        / (2 * velocityStep),
      8e-10, `analytic rack velocity ${time}`);
    near(state.driverAngularVelocity,
      (afterV.driverAngle - beforeV.driverAngle)
        / (2 * velocityStep),
      4e-10, `analytic driver rate ${time}`);
    const beforeA = stateAtTime(time - accelerationStep);
    const afterA = stateAtTime(time + accelerationStep);
    near(state.rackAcceleration,
      (afterA.rackVelocity - beforeA.rackVelocity)
        / (2 * accelerationStep),
      8e-10, `analytic rack acceleration ${time}`);
  }
  disposeModel(model.root);
});

test('movement 351 renderer keeps the mesh, rack guides, and impact face closed', () => {
  const model = createMovementModel(catalog.movements[350]);
  const { blocks, contacts, geometry } = model.root.userData;
  const expectedContact = geometry.gearContactPoint;

  for (const time of [0, 0.2, 0.6, 1.0, 1.4, 1.8, 2.2,
    2.399, 2.4, 2.55, 2.9, 3.3, 3.41, 3.7, 3.99, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    near(blocks.pinion.rotation.z, state.driverAngle, 0,
      `rendered pinion angle ${time}`);
    near(blocks.rack.position.y, state.rackDisplacement, 0,
      `rendered rack displacement ${time}`);
    vector3Near(worldPosition(blocks.pinionPitchContactAnchor),
      expectedContact, 1e-15,
    `pinion pitch-contact anchor ${time}`);
    vector3Near(worldPosition(blocks.rackPitchContactAnchor),
      expectedContact, 1e-15,
    `rack pitch-contact anchor ${time}`);
    vector3Near(worldPosition(blocks.stampFaceAnchor),
      new THREE.Vector3(
        geometry.rackCenterX,
        state.stampFaceY,
        geometry.jointPlaneZ,
      ),
      4e-15,
      `stamp impact-face anchor ${time}`,
    );
    assert.equal(blocks.contactMarker.visible, false);
    assert.equal(blocks.impactHalo.visible, false);
    assert.equal(contacts.stampAtLowerStop.engaged,
      state.lowerStopEngaged);
    assert.equal(contacts.gearRackPitchContact.activeGearToothIndex,
      state.activeGearToothIndex);
    assert.equal(contacts.gearRackPitchContact.activeRackGapIndex,
      state.activeRackGapIndex);
    if (state.gearEngaged) {
      vector3Near(contacts.gearRackPitchContact.contactPoint,
        expectedContact, 0, `reported pitch contact ${time}`);
      near(contacts.gearRackPitchContact.meshPhaseError,
        0, 2e-15, `reported mesh error ${time}`);
      near(contacts.gearRackPitchContact.surfaceVelocityError,
        0, 0, `reported surface speed error ${time}`);
    } else {
      assert.equal(contacts.gearRackPitchContact.contactPoint, null);
    }
    contacts.rackInOpenGuides.points.forEach((point, index) => {
      vector3Near(point, new THREE.Vector3(
        geometry.rackCenterX,
        [geometry.upperGuideY, geometry.lowerGuideY][index],
        geometry.rackPlaneZ,
      ), 0, `fixed guide contact ${index} ${time}`);
    });
  }
  disposeModel(model.root);
});

test('movement 351 closes one shaft revolution and leaves movement 507 authored', () => {
  const model = createMovementModel(catalog.movements[350]);
  const { geometry, stateAtUnshiftedTime: stateAtTime } = model.root.userData;
  const start = stateAtTime(0);
  const finish = stateAtTime(geometry.cyclePeriod);
  near(finish.cyclePhase, start.cyclePhase, 0, 'cycle-phase closure');
  near(finish.rackDisplacement, start.rackDisplacement, 0,
    'rack-position closure');
  near(finish.rackVelocity, start.rackVelocity, 0,
    'rack-velocity closure');
  near(finish.rackAcceleration, start.rackAcceleration, 0,
    'rack-acceleration closure');
  near(finish.stampFaceY, start.stampFaceY, 0,
    'stamp-face closure');
  near(finish.driverAngle, start.driverAngle - geometry.fullTurn, 0,
    'one clockwise shaft turn');
  near(finish.driverAngularVelocity, start.driverAngularVelocity, 0,
    'driver-rate closure');
  assert.equal(finish.gearEngaged, start.gearEngaged);
  assert.equal(finish.activeGearToothIndex,
    start.activeGearToothIndex);
  near(finish.meshPhaseError, start.meshPhaseError, 0,
    'mesh-error closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});

test('movement 351 runs the rack teeth up to the top collar, which clears the pinion at every pose', () => {
  const model = createMovementModel(catalog.movements[350]);
  const { blocks, geometry, stampTripParts } = model.root.userData;
  const tipRadius = stampTripParts.mesh.tipRadius;
  const teeth = blocks.rackTeeth.filter((tooth) => tooth.visible);
  assert.equal(teeth.length, geometry.sectorToothCount);
  model.update(0);
  model.root.updateMatrixWorld(true);
  const collar = new THREE.Box3().setFromObject(blocks.topRodCap);
  const toothTop = Math.max(...teeth.map((tooth) => new THREE.Box3().setFromObject(tooth).max.y));
  const gap = collar.min.y - toothTop;
  // Brown's teeth reach the collar: no plain stretch of rod between them.
  assert.ok(gap > 0 && gap < geometry.rackToothPitch / 2, `top tooth to collar gap ${gap}`);
  const centre = worldPosition(blocks.pinion ?? blocks.inputShaft);
  let minimum = Infinity;
  for (let index = 0; index <= 512; index += 1) {
    model.update(geometry.cyclePeriod * index / 512);
    model.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(blocks.topRodCap);
    const dx = Math.max(box.min.x - centre.x, 0, centre.x - box.max.x);
    const dy = Math.max(box.min.y - centre.y, 0, centre.y - box.max.y);
    minimum = Math.min(minimum, Math.hypot(dx, dy) - tipRadius);
  }
  assert.ok(minimum > 0.005, `top collar clears the pinion tip circle: ${minimum}`);
  disposeModel(model.root);
});
