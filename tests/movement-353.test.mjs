import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

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

function timeAtPhase(data, phase) {
  const { geometry } = data;
  return (phase - geometry.initialCyclePhase) * geometry.lobeCyclePeriod;
}

function pointToSegmentDistance(point, start, end) {
  const edge = end.clone().sub(start);
  const denominator = edge.lengthSq();
  if (denominator < 1e-20) return point.distanceTo(start);
  const fraction = THREE.MathUtils.clamp(
    point.clone().sub(start).dot(edge) / denominator,
    0,
    1,
  );
  return point.distanceTo(start.clone().addScaledVector(edge, fraction));
}

function pointInsidePolygon(point, polygon) {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const a = polygon[index];
    const b = polygon[previous];
    if (
      (a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
    ) inside = !inside;
  }
  return inside;
}

test('movement 353 is one four-wiper first-order gravity trip hammer', () => {
  const movement = catalog.movements[352];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    contacts,
    degreesOfFreedom,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 353);
  assert.equal(movement.number, '353');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'first-order-four-wiper-gravity-trip-hammer');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /four-lobe-wiper-wheel/);
  assert.match(mechanism, /first-order-hammer-helve/);
  assert.match(mechanism, /fulcrum-between-effort-and-left-hand-load/);
  assert.match(mechanism, /compound-pendulum-gravity-strike/);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.match(degreesOfFreedom.input, /counter-clockwise/);
  assert.match(degreesOfFreedom.output, /fulcrum between its head and driven tail/);

  assert.equal(blocks.fixedFrame.parent, model.root);
  assert.equal(blocks.cam.parent, model.root);
  assert.equal(blocks.camRotor.parent, blocks.cam);
  assert.equal(blocks.camBody.parent, blocks.camRotor);
  assert.equal(blocks.camDisk.parent, blocks.camBody);
  assert.equal(blocks.wiperMeshes.length, 4);
  blocks.wiperMeshes.forEach((wiper, index) => {
    assert.equal(wiper.parent, blocks.camBody);
    assert.equal(wiper.userData.index, index);
    assert.equal(wiper.userData.tipRadius,
      model.root.userData.geometry.wiperTipRadius);
    assert.match(wiper.userData.role, /leading-radial-working-face/);
  });
  assert.equal(blocks.inputShaft.parent, model.root);
  assert.equal(blocks.hammer.parent, model.root);
  assert.equal(blocks.hammerRotor.parent, blocks.hammer);
  for (const member of [
    blocks.helve,
    blocks.hammerHead,
    blocks.movingJournalBlock,
    blocks.movingPivotHub,
    blocks.followerNose,
    blocks.hammerIndicator,
  ]) assert.equal(member.parent, blocks.hammerRotor);
  assert.equal(blocks.hammerPivotShaft.parent, model.root);
  assert.equal(blocks.anvilFace.parent, blocks.fixedFrame);
  assert.equal(contacts.fixedFulcrum.fixedMember, blocks.hammerPivotShaft);
  assert.equal(contacts.fixedFulcrum.movingMember, blocks.movingPivotHub);
  assert.equal(contacts.wiperTailFollower.camMember, blocks.camBody);
  assert.equal(contacts.wiperTailFollower.followerMember, blocks.followerNose);
  assert.equal(contacts.anvilImpact.fixedMember, blocks.anvilFace);
  assert.equal(contacts.anvilImpact.movingMember, blocks.hammerHead);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    /triangular-wiper-with-counter-clockwise-leading-radial-working-face/.test(role)).length, 4);
  assert.equal(roles.some((role) => /generic|procedural/i.test(role)), false);
  disposeModel(model.root);
});

test('movement 353 preserves the engraving, editorial correction, and contrast with 72', () => {
  const model = createMovementModel(catalog.movements[352]);
  const data = model.root.userData;
  const { geometry, leverClassification, sourceAnimation, sourceReference } = data;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourceUrl,
    'https://507movements.com/mm_353.html');
  assert.equal(sourceAnimation.presentationTiming.sourcePrescribed, false);
  assert.equal(sourceAnimation.referenceMovement72.sourceUrl,
    'https://507movements.com/mm_072.html');
  assert.match(sourceAnimation.referenceMovement72.difference,
    /same side of its fulcrum/);
  assert.equal(sourceReference.editorialCorrection.originalPrintedReference, 74);
  assert.equal(sourceReference.editorialCorrection.correctedReference, 72);
  assert.match(sourceReference.editorialCorrection.sourceSiteNote,
    /mistake/);

  const plate = sourceReference.brownPlate353;
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.visibleWiperCount, 4);
  assert.equal(plate.inferredRaisedPose, true);
  vectorNear(plate.rasterFulcrum, new THREE.Vector2(255, 281), 0,
    'raster fulcrum');
  vectorNear(plate.rasterCamCenter, new THREE.Vector2(431, 264), 0,
    'raster cam center');
  vectorNear(plate.rasterFollowerCenter, new THREE.Vector2(343, 314), 0,
    'raster tail center');
  vectorNear(plate.rasterStrikePoint, new THREE.Vector2(60, 292), 0,
    'raster strike point');
  vectorNear(plate.rasterAnvilTop, new THREE.Vector2(60, 400), 0,
    'raster anvil top');
  near(geometry.camCenter.x - geometry.hammerPivot.x,
    (431 - 255) * geometry.sourceScale, 0, 'scaled cam x');
  near(geometry.camCenter.y - geometry.hammerPivot.y,
    (281 - 264) * geometry.sourceScale, 2e-16, 'scaled cam y');
  near(geometry.followerCenterLocal.x,
    (343 - 255) * geometry.sourceScale, 0, 'scaled follower x');
  near(geometry.followerCenterLocal.y,
    (281 - 314) * geometry.sourceScale, 0, 'scaled follower y');
  near(geometry.strikePointLocal.x,
    (60 - 255) * geometry.sourceScale, 0, 'scaled strike x');
  near(geometry.strikePointLocal.y,
    (281 - 292) * geometry.sourceScale, 0, 'scaled strike y');
  near(geometry.anvilStrikePointLocal.y,
    geometry.sourceAnvilTopLocalY, 2e-15, 'engraving-derived fall angle');
  near(geometry.impactHammerAngle,
    THREE.MathUtils.degToRad(34.3093738646648), 2e-15,
    'engraving-derived hammer stroke');
  assert.equal(geometry.lobeCount, 4);
  assert.ok(geometry.driverAngularSpeed > 0,
    'the source arrow is counter-clockwise');

  assert.equal(leverClassification.order, 1);
  assert.equal(leverClassification.oppositeSides, true);
  assert.ok(geometry.strikePointLocal.x < 0);
  assert.ok(geometry.followerCenterLocal.x > 0);
  assert.match(leverClassification.fulcrum, /between/);

  const movement72 = createMovementModel(catalog.movements[71]);
  const geometry72 = movement72.root.userData.geometry;
  const striker72 = movement72.root.userData.parts.striker;
  striker72.geometry.computeBoundingBox();
  const strikerCenter72 = striker72.geometry.boundingBox.getCenter(new THREE.Vector3());
  assert.ok(strikerCenter72.x * geometry72.noseOffset[0] > 0,
  'movement 72 puts effort and load on the same side of its fulcrum');
  assert.ok(geometry.strikePointLocal.x
    * geometry.followerCenterLocal.x < 0,
  'movement 353 puts effort and load on opposite sides');
  disposeModel(movement72.root);
  disposeModel(model.root);
});

test('movement 353 keeps exact unilateral contact along every finite wiper face', () => {
  const model = createMovementModel(catalog.movements[352]);
  const data = model.root.userData;
  const { geometry } = data;
  let previousHammerAngle = Infinity;
  let observedMinimumRadius = Infinity;

  for (let sample = 0; sample <= 8192; sample += 1) {
    const phase = THREE.MathUtils.lerp(
      geometry.contactStartPhase,
      geometry.contactEndPhase,
      sample / 8192,
    );
    const state = data.stateAtCycleCoordinate(phase);
    assert.equal(state.camContactEngaged, true);
    assert.equal(state.stage, 'wiper-depresses-tail-and-lifts-head');
    assert.ok(state.hammerAngle <= previousHammerAngle + 2e-15,
      'the wiper monotonically lifts the head');
    previousHammerAngle = state.hammerAngle;
    assert.ok(state.camFollowerContactError < 9e-15);
    assert.ok(state.camFollowerNormalVelocityError < 8e-16);
    near(state.camNormal.length(), 1, 3e-16, 'unit contact normal');
    const radial = state.camContactPoint.clone()
      .sub(geometry.camCenter)
      .setZ(0);
    near(radial.length(), state.contactRadialCoordinate, 2e-15,
      'radial face coordinate');
    near(radial.dot(new THREE.Vector3(
      state.camNormal.x,
      state.camNormal.y,
      0,
    )), 0, 2e-15, 'normal perpendicular to radial face');
    const centerSeparation = state.followerCenter.clone()
      .sub(state.camContactPoint)
      .setZ(0);
    near(centerSeparation.length(), geometry.followerRadius, 4e-15,
      'rounded follower radius');
    assert.ok(centerSeparation.normalize().dot(new THREE.Vector3(
      state.camNormal.x,
      state.camNormal.y,
      0,
    )) > 1 - 2e-15);
    assert.ok(state.contactRadialCoordinate
      >= geometry.minimumContactRadius - 2e-15);
    assert.ok(state.contactRadialCoordinate
      <= geometry.wiperTipRadius + 2e-15);
    assert.ok(state.wiperTipClearance >= -2e-15);
    assert.ok(state.effortTorqueSense < -1.13,
      'the leading face can only push the right tail clockwise');
    observedMinimumRadius = Math.min(
      observedMinimumRadius,
      state.contactRadialCoordinate,
    );
  }

  const pickup = data.stateAtCycleCoordinate(geometry.contactStartPhase);
  const release = data.stateAtCycleCoordinate(geometry.contactEndPhase);
  near(pickup.hammerAngle, geometry.impactHammerAngle, 0,
    'pickup at anvil angle');
  near(release.hammerAngle, geometry.raisedHammerAngle, 0,
    'release at engraved raised angle');
  near(release.contactRadialCoordinate, geometry.wiperTipRadius, 9e-16,
    'release exactly at finite tip');
  near(release.wiperTipClearance, 0, 9e-16,
    'zero tip clearance at release');
  near(observedMinimumRadius, geometry.minimumContactRadius, 2e-8,
    'audited minimum working radius');
  assert.ok(geometry.minimumContactRadius > geometry.camBaseRadius,
    'the full contact remains on the protruding blade');
  assert.ok(geometry.contactTravelAngle < geometry.lobePitch,
    'each wiper releases before the next arrives');

  // Audit the complete rendered wheel, not merely the active analytic face.
  // The other three blades and central disk must clear the moving follower.
  let minimumRenderedGap = Infinity;
  for (let sample = 0; sample <= 8192; sample += 1) {
    const state = data.stateAtCycleCoordinate(sample / 8192);
    const localCenter3 = state.followerCenter.clone()
      .sub(geometry.camCenter)
      .setZ(0)
      .applyAxisAngle(Z_AXIS, -state.driverAngle);
    const localCenter = new THREE.Vector2(localCenter3.x, localCenter3.y);
    let surfaceDistance = localCenter.length() - geometry.camBaseRadius;
    for (const profile of geometry.wiperProfiles) {
      let profileDistance = Infinity;
      for (let edge = 0; edge < profile.length; edge += 1) {
        profileDistance = Math.min(
          profileDistance,
          pointToSegmentDistance(
            localCenter,
            profile[edge],
            profile[(edge + 1) % profile.length],
          ),
        );
      }
      if (pointInsidePolygon(localCenter, profile)) {
        profileDistance *= -1;
      }
      surfaceDistance = Math.min(surfaceDistance, profileDistance);
    }
    const renderedGap = surfaceDistance - geometry.followerRadius;
    minimumRenderedGap = Math.min(minimumRenderedGap, renderedGap);
    if (state.camContactEngaged) {
      near(renderedGap, 0, 3e-14, `rendered face contact ${sample}`);
    }
  }
  assert.ok(minimumRenderedGap >= -3e-14,
    'the full four-wiper solid never enters the rounded follower');
  disposeModel(model.root);
});

test('movement 353 has the exact opposite-side displacement law of a first-order lever', () => {
  const model = createMovementModel(catalog.movements[352]);
  const data = model.root.userData;
  const { geometry } = data;
  const pickup = data.stateAtCycleCoordinate(geometry.contactStartPhase);
  const middle = data.stateAtCycleCoordinate(
    (geometry.contactStartPhase + geometry.contactEndPhase) / 2,
  );
  const release = data.stateAtCycleCoordinate(geometry.contactEndPhase);

  assert.ok(release.strikePoint.y > pickup.strikePoint.y,
    'left hammer head rises');
  assert.ok(release.followerCenter.y < pickup.followerCenter.y,
    'right tail descends');
  near(pickup.strikePoint.y, geometry.anvilTopY, 0,
    'pickup begins at the anvil');
  assert.ok(release.anvilGap > 1.83);
  for (const state of [pickup, middle, release]) {
    near(state.strikePoint.clone().sub(geometry.hammerPivot).setZ(0).length(),
      geometry.loadLeverArm, 8e-16, 'rigid load lever arm');
    near(state.followerCenter.clone().sub(geometry.hammerPivot).setZ(0).length(),
      geometry.effortLeverArm, 7e-16, 'rigid effort lever arm');
  }
  assert.ok(middle.hammerAngularSpeed < 0);
  const strikeRadius = middle.strikePoint.clone().sub(geometry.hammerPivot);
  const followerRadius = middle.followerCenter.clone()
    .sub(geometry.hammerPivot);
  const headVerticalSpeed = middle.hammerAngularSpeed * strikeRadius.x;
  const tailVerticalSpeed = middle.hammerAngularSpeed * followerRadius.x;
  assert.ok(headVerticalSpeed > 0);
  assert.ok(tailVerticalSpeed < 0);
  near(
    Math.abs(headVerticalSpeed / tailVerticalSpeed),
    Math.abs(strikeRadius.x / followerRadius.x),
    3e-16,
    'instantaneous lever velocity ratio',
  );
  disposeModel(model.root);
});

test('movement 353 coasts, reverses, and falls with exact compound-pendulum energy', () => {
  const model = createMovementModel(catalog.movements[352]);
  const data = model.root.userData;
  const { contacts, dynamics, geometry } = data;
  assert.ok(dynamics.pickupAngularSpeed < 0);
  assert.ok(dynamics.releaseAngularSpeed < dynamics.pickupAngularSpeed);
  assert.ok(dynamics.freeFlightApexAngle < geometry.raisedHammerAngle);
  assert.ok(dynamics.ascentDuration > 0);
  assert.ok(dynamics.descentDuration > dynamics.ascentDuration);
  near(dynamics.gravityFallDuration,
    dynamics.ascentDuration + dynamics.descentDuration, 0,
    'complete free-flight duration');
  near(geometry.impactPhase,
    geometry.contactEndPhase
      + dynamics.gravityFallDuration / geometry.lobeCyclePeriod,
    0, 'impact phase');
  assert.ok(geometry.impactPhase < 1);
  assert.ok(dynamics.dwellDuration > 0.50);

  const release = data.stateAtCycleCoordinate(geometry.contactEndPhase);
  near(release.hammerAngularSpeed, dynamics.releaseAngularSpeed, 0,
    'velocity-continuous release');
  near(release.mechanicalEnergy, dynamics.releaseMechanicalEnergy, 2e-14,
    'release energy');
  const apexPhase = geometry.contactEndPhase
    + dynamics.ascentDuration / geometry.lobeCyclePeriod;
  const apex = data.stateAtCycleCoordinate(apexPhase);
  near(apex.hammerAngle, dynamics.freeFlightApexAngle, 5e-15,
    'coasting apex angle');
  near(apex.hammerAngularSpeed, 0, 2e-7, 'zero apex speed');

  for (let sample = 1; sample < 4096; sample += 1) {
    const phase = THREE.MathUtils.lerp(
      geometry.contactEndPhase,
      geometry.impactPhase,
      sample / 4096,
    );
    const state = data.stateAtCycleCoordinate(phase);
    assert.equal(state.stage, 'released-compound-pendulum-gravity-fall');
    assert.ok(state.hammerAngle >= dynamics.freeFlightApexAngle - 2e-14);
    assert.ok(state.hammerAngle <= geometry.impactHammerAngle + 2e-14);
    near(state.mechanicalEnergy, dynamics.releaseMechanicalEnergy, 4e-14,
      `free-flight energy ${sample}`);
    const centerOffset = state.centerOfMass.clone()
      .sub(geometry.hammerPivot);
    near(state.hammerAngularAcceleration,
      -dynamics.gravityCoefficient * centerOffset.x, 5e-16,
      `gravity torque ${sample}`);
    assert.ok(state.anvilGap > -3e-14);
  }

  const impact = data.stateAtCycleCoordinate(geometry.impactPhase);
  near(impact.hammerAngle, geometry.impactHammerAngle, 0,
    'impact angle');
  near(impact.hammerAngularSpeed, dynamics.impactAngularSpeed, 0,
    'impact speed');
  near(impact.anvilGap, 0, 0, 'impact closes anvil gap');
  assert.equal(impact.anvilContactEngaged, true);
  const dwell = data.stateAtCycleCoordinate(
    (geometry.impactPhase + 1) / 2,
  );
  assert.equal(dwell.stage, 'inelastic-impact-dwell-on-anvil');
  assert.equal(dwell.hammerAngularSpeed, 0);
  assert.equal(dwell.anvilContactEngaged, true);
  near(dynamics.releaseMechanicalEnergy - dwell.mechanicalEnergy,
    dynamics.impactKineticEnergy, 3e-14, 'inelastic impact energy loss');
  assert.equal(contacts.anvilImpact.restitution, 0);
  disposeModel(model.root);
});

test('movement 353 analytic contact and free-flight rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[352]);
  const data = model.root.userData;
  const { dynamics, geometry } = data;

  for (const phase of [
    geometry.contactStartPhase + 0.03,
    0.18,
    0.29,
    geometry.contactEndPhase - 0.03,
  ]) {
    const time = timeAtPhase(data, phase);
    const step = 1e-5;
    const before = data.stateAtTime(time - step);
    const state = data.stateAtTime(time);
    const after = data.stateAtTime(time + step);
    near((after.hammerAngle - before.hammerAngle) / (2 * step),
      state.hammerAngularSpeed, 7e-10, `contact speed at ${phase}`);
    near((after.hammerAngle - 2 * state.hammerAngle
      + before.hammerAngle) / step ** 2,
    state.hammerAngularAcceleration, 4e-5,
    `contact acceleration at ${phase}`);
  }

  const apexPhase = geometry.contactEndPhase
    + dynamics.ascentDuration / geometry.lobeCyclePeriod;
  for (const phase of [
    geometry.contactEndPhase + 0.035,
    apexPhase - 0.035,
    apexPhase + 0.035,
    geometry.impactPhase - 0.035,
  ]) {
    const time = timeAtPhase(data, phase);
    const step = 1e-3;
    const before = data.stateAtTime(time - step);
    const state = data.stateAtTime(time);
    const after = data.stateAtTime(time + step);
    near((after.hammerAngle - before.hammerAngle) / (2 * step),
      state.hammerAngularSpeed, 8e-7, `free-flight speed at ${phase}`);
    near((after.hammerAngle - 2 * state.hammerAngle
      + before.hammerAngle) / step ** 2,
    state.hammerAngularAcceleration, 2e-5,
    `free-flight acceleration at ${phase}`);
  }
  disposeModel(model.root);
});

test('movement 353 renderer binds the wiper face, tail, fulcrum, and anvil', () => {
  const model = createMovementModel(catalog.movements[352]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  const phases = [
    0.01,
    geometry.contactStartPhase,
    (geometry.contactStartPhase + geometry.contactEndPhase) / 2,
    geometry.contactEndPhase,
    geometry.contactEndPhase + 0.04,
    geometry.impactPhase,
    0.90,
  ];
  for (const phase of phases) {
    model.update(timeAtPhase(data, phase), 0.016);
    model.root.updateMatrixWorld(true);
    const state = data.kinematics;
    near(blocks.camRotor.rotation.z, state.driverAngle, 0,
      `rendered cam angle ${phase}`);
    near(blocks.inputShaft.userData.rotor.rotation.z, state.driverAngle, 0,
      `rendered shaft angle ${phase}`);
    near(blocks.hammerRotor.rotation.z, state.hammerAngle, 0,
      `rendered hammer angle ${phase}`);
    near(blocks.hammerPivotShaft.userData.rotor.rotation.z, 0, 0,
      `fixed fulcrum shaft ${phase}`);
    vectorNear(blocks.followerNose.getWorldPosition(new THREE.Vector3()),
      state.followerCenter, 8e-16, `rendered follower center ${phase}`);
    assert.equal(blocks.contactMarker.visible, state.camContactEngaged);
    assert.equal(blocks.impactMarker.visible, state.anvilContactEngaged);
    if (state.camContactEngaged) {
      vectorNear(blocks.contactMarker.position, state.camContactPoint, 0,
        `contact marker ${phase}`);
      const renderedCamPoint = blocks.camRotor.localToWorld(
        new THREE.Vector3(
          state.camLocalContactPoint.x,
          state.camLocalContactPoint.y,
          geometry.activeContactPlaneZ - geometry.camCenter.z,
        ),
      );
      vectorNear(renderedCamPoint, state.camContactPoint, 2e-15,
        `rendered leading face ${phase}`);
      assert.equal(data.contacts.wiperTailFollower.engaged, true);
      vectorNear(data.contacts.wiperTailFollower.camPoint,
        state.camContactPoint, 0, `published cam point ${phase}`);
      vectorNear(data.contacts.wiperTailFollower.followerPoint,
        state.followerContactPoint, 0, `published follower point ${phase}`);
    } else {
      assert.equal(data.contacts.wiperTailFollower.engaged, false);
      assert.equal(data.contacts.wiperTailFollower.camPoint, null);
      assert.equal(data.contacts.wiperTailFollower.followerPoint, null);
    }
  }
  vectorNear(data.contacts.fixedFulcrum.axis, Z_AXIS, 0, 'fulcrum axis');
  vectorNear(data.contacts.fixedFulcrum.point, geometry.hammerPivot, 0,
    'fulcrum point');
  disposeModel(model.root);
});

test('movement 353 makes four blows per turn, closes, and leaves 364 authored', () => {
  const model = createMovementModel(catalog.movements[352]);
  const data = model.root.userData;
  const { geometry, transmission } = data;
  assert.equal(transmission.blowsPerWheelRevolution, 4);
  assert.match(transmission.contactConstraint, /finite radial leading face/);
  assert.match(transmission.gravityReturn, /actual release speed/);
  assert.match(transmission.leverLaw, /fulcrum separates/);
  near(model.root.userData.animationTiming.authoredCyclePeriod,
    geometry.lobeCyclePeriod, 0, 'one displayed event period');

  for (const phase of [0.01, 0.2, 0.55, 0.9]) {
    const start = data.stateAtCycleCoordinate(phase);
    const finish = data.stateAtCycleCoordinate(phase + geometry.lobeCount);
    near(finish.driverAngle - start.driverAngle, geometry.fullTurn, 2e-15,
      `wheel closure ${phase}`);
    near(finish.hammerAngle, start.hammerAngle, 2e-15,
      `hammer closure ${phase}`);
    near(finish.hammerAngularSpeed, start.hammerAngularSpeed, 2e-15,
      `hammer rate closure ${phase}`);
    assert.equal(finish.stage, start.stage);
    assert.equal(finish.activeLobeIndex, start.activeLobeIndex);
    assert.equal(finish.strikesCompleted - start.strikesCompleted, 4);
  }

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});
