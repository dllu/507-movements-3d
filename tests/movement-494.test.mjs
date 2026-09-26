import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const sourceText = await readFile(
  new URL('../src/simulation/authored-stone-tongs.js', import.meta.url),
  'utf8',
);

const ARCHETYPE = 'weight-tightened-rhombus-link-stone-lifting-tongs';

function movementModel() {
  const movement = catalog.movements[493];
  return { model: createMovementModel(movement), movement };
}

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function cableEndpoints(cable) {
  const visible = cable.children.filter((segment) => segment.visible);
  assert.equal(visible.length, 1);
  cable.updateWorldMatrix(true, true);
  // A laid rope carries its centreline; a cylinder segment spans local y +-0.5.
  const path = visible[0].geometry.parameters?.path;
  if (path) {
    return {
      end: path.getPoint(1).applyMatrix4(visible[0].matrixWorld),
      start: path.getPoint(0).applyMatrix4(visible[0].matrixWorld),
    };
  }
  return {
    end: new THREE.Vector3(0, 0.5, 0)
      .applyMatrix4(visible[0].matrixWorld),
    start: new THREE.Vector3(0, -0.5, 0)
      .applyMatrix4(visible[0].matrixWorld),
  };
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

test('movement 494 is two crossed tong bodies, two links, one shackle, and one stone', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom } = model.root.userData;

  assert.equal(movement.id, 494);
  assert.equal(movement.number, '494');
  assert.equal(movement.title, 'Tongs for lifting stones, etc');
  assert.equal(movement.category, 'Presses & clamps');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.leftJaw.parent, model.root);
  assert.equal(blocks.rightJaw.parent, model.root);
  assert.notEqual(blocks.leftJaw, blocks.rightJaw);
  assert.equal(blocks.leftJawParts.curvedJaw.parent, blocks.leftJaw);
  assert.equal(blocks.rightJawParts.curvedJaw.parent, blocks.rightJaw);
  assert.equal(blocks.leftJawParts.upperArm.parent, blocks.leftJaw);
  assert.equal(blocks.rightJawParts.upperArm.parent, blocks.rightJaw);
  assert.equal(blocks.leftUpperLink.parent, model.root);
  assert.equal(blocks.rightUpperLink.parent, model.root);
  assert.equal(blocks.stoneBody.parent, blocks.stone);
  assert.equal(blocks.shackleRing.parent, blocks.shackle);
  assert.equal(blocks.hoistRope.parent, model.root);
  assert.equal(blocks.stoneContactSockets.length, 2);
  assert.equal(blocks.sidePivotPins.length, 2);
  assert.equal(degreesOfFreedom.independentHoistInputs, 1);
  assert.equal(degreesOfFreedom.independentJawCoordinates, 0);
  assert.equal(degreesOfFreedom.independentLinkCoordinates, 0);
  assert.equal(degreesOfFreedom.independentStoneCoordinates, 0);
  assert.equal(degreesOfFreedom.tongJawBodies, 2);
  assert.equal(degreesOfFreedom.upperLinks, 2);

  const belts = [];
  const hoistRopes = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isHoistRope) hoistRopes.push(object);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(hoistRopes, [blocks.hoistRope]);
  assert.doesNotMatch(sourceText, /makeBelt|beltPath|pulley/i);
  disposeModel(model.root);
});

test('movement 494 records Brown, the official canvas, and Fidler’s weight-tightened nippers', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate494;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_494.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.officialInlineModelUrl, movement.sourceUrl);
  assert.match(movement.description,
    /pull on the shackle which connects the two links.*upper arms of the tongs.*points press themselves against or into the stone.*greater the weight the harder the tongs bite/s);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialCyclesPerMinute, 15);
  assert.equal(sourceAnimation.officialCyclePeriodSecond, 4);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, true);
  assert.deepEqual(sourceAnimation.officialPhaseLandmarks,
    [0, 0.2, 0.4, 0.5, 0.7, 0.9, 1]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateJawFulcrumPixels, [261, 217]);
  assert.deepEqual(plate.approximateShacklePivotPixels, [261, 119]);
  assert.deepEqual(plate.approximateSideLinkPivotsPixels,
    [212, 166, 309, 166]);
  assert.deepEqual(plate.approximateBitePointPixels,
    [170, 367, 353, 367]);
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.officialCanvasEvidence,
    /four 1\.8-unit rhombus members.*35- and 45-degree jaw poses.*\(-2,1\)\/\(2,1\).*0\.480709-unit rigid stone lift.*15 cycles per minute/s);
  assert.match(evidence.fidlerCorroboration,
    /Henry Fidler’s 1893.*page 218.*upper eyes are drawn inward.*tightening their points.*anti-tear-out.*center-of-gravity precautions/s);
  assert.match(evidence.reconstructionDisclosure,
    /Source-space pivot.*bite.*outline.*phase.*travel values.*layer separation.*ideal virtual-work annotation.*original 3D/s);
  assert.match(sourceReference.fidlerArchivePageUrl,
    /archive\.org\/details\/notesonbuildingc02fidliala\/page\/n244/);
  disposeModel(model.root);
});

test('movement 494 reproduces the exact official close-lift-hold-lower-open schedule', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const cases = [
    [0, 0, 35, 0],
    [0.2, 1, 45, 0],
    [0.4, 1, 45, 0.480709],
    [0.5, 1, 45, 0.480709],
    [0.7, 1, 45, 0],
    [0.9, 0, 35, 0],
    [1, 0, 35, 0],
  ];
  for (const [phase, closure, angleDegree, lift] of cases) {
    const state = stateAtTime(phase * geometry.cycleDuration);
    near(state.closureProgress, closure, 8e-16,
      `closure at source phase ${phase}`);
    near(THREE.MathUtils.radToDeg(state.leftJawAngle), angleDegree,
      8e-15, `left jaw angle at source phase ${phase}`);
    near(THREE.MathUtils.radToDeg(state.rightJawAngle),
      180 - angleDegree, 8e-15,
      `right jaw angle at source phase ${phase}`);
    near(state.stoneLift, lift, 8e-16,
      `stone lift at source phase ${phase}`);
  }

  for (let sample = 0; sample < 4000; sample += 1) {
    const phase = sample / 4000;
    const state = stateAtTime(phase * geometry.cycleDuration);
    let expectedClosure;
    if (phase < 0.2) expectedClosure = phase / 0.2;
    else if (phase <= 0.7) expectedClosure = 1;
    else if (phase < 0.9) expectedClosure = (0.9 - phase) / 0.2;
    else expectedClosure = 0;
    near(state.closureProgress, expectedClosure, 8e-16,
      `piecewise jaw schedule ${sample}`);
    if (state.stoneLift > 1e-15) {
      near(state.closureProgress, 1, 0,
        `stone cannot lift with open jaws ${sample}`);
    }
  }
  assert.equal(geometry.officialCyclesPerMinute, 15);
  assert.equal(geometry.cycleDuration, 4);
  assert.deepEqual(geometry.sourcePhaseLandmarks,
    [0, 0.2, 0.4, 0.5, 0.7, 0.9, 1]);
  assert.match(model.root.userData.dynamics.sourceLinearTimingDisclosure,
    /15-cycles-per-minute.*piecewise-linear jaw rotation.*0\/\.2\/\.4\/\.5\/\.7\/\.9.*four-second cycle.*dwells/s);
  disposeModel(model.root);
});

test('movement 494 maintains four exact equal rhombus sides for every jaw angle', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const fulcrumAt = (state) => new THREE.Vector2(0, state.jawPivotY);

  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1200,
    );
    const fulcrum = fulcrumAt(state);
    for (const [start, end, label] of [
      [fulcrum, state.leftLinkPivot, 'left jaw upper arm'],
      [state.leftLinkPivot, state.shacklePivot, 'left upper link'],
      [state.shacklePivot, state.rightLinkPivot, 'right upper link'],
      [state.rightLinkPivot, fulcrum, 'right jaw upper arm'],
    ]) {
      near(start.distanceTo(end), geometry.memberLength, 8e-16,
        `${label} at sample ${sample}`);
    }
    near(state.leftLinkPivot.x, -state.rightLinkPivot.x, 0,
      `side-pivot x symmetry ${sample}`);
    near(state.leftLinkPivot.y, state.rightLinkPivot.y, 0,
      `side-pivot y symmetry ${sample}`);
    near(state.shacklePivot.x, 0, 0,
      `shackle constrained vertically ${sample}`);
    near(state.shacklePivot.y,
      state.jawPivotY
        + 2 * geometry.memberLength * Math.sin(state.leftJawAngle),
      0, `rhombus vertical diagonal ${sample}`);
  }
  assert.match(transmission.equalMemberConstraint,
    /P_fulcrum,P_side_left.*P_side_left,P_shackle.*P_shackle,P_side_right.*P_side_right,P_fulcrum.*1\.8/s);
  assert.match(transmission.symmetry,
    /x_side_left=-x_side_right.*x_bite_left=-x_bite_right/s);
  disposeModel(model.root);
});

test('movement 494 closes both source bite points before carrying the stone without slip', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  const open = stateAtTime(0);
  assert.ok(open.leftBiteContactError > 0.66);
  assert.ok(open.rightBiteContactError > 0.66);
  assert.equal(open.biteContact, false);

  const closed = stateAtTime(0.2 * geometry.cycleDuration);
  assert.ok(closed.leftBiteContactError < 7e-7);
  assert.ok(closed.rightBiteContactError < 7e-7);
  assert.equal(closed.biteContact, true);
  near(closed.stoneLift, 0, 0, 'bite closes before stone lift');

  for (let sample = 200; sample <= 700; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1000,
    );
    assert.equal(state.biteContact, true);
    assert.ok(state.leftBiteContactError < 7e-7);
    assert.ok(state.rightBiteContactError < 7e-7);
    near(state.leftBite.y - state.leftStoneContact.y,
      closed.leftBite.y - closed.leftStoneContact.y, 9e-16,
      `left bite has no vertical slip ${sample}`);
    near(state.rightBite.y - state.rightStoneContact.y,
      closed.rightBite.y - closed.rightStoneContact.y, 9e-16,
      `right bite has no vertical slip ${sample}`);
  }
  assert.match(transmission.biteClosure,
    /p_bite_left.*\(-2,1\+delta_stone\).*mirrored right=\(2,1\+delta_stone\)/s);
  assert.match(transmission.loadLock,
    /delta_stone>0 only when theta_left=45deg.*theta_right=135deg.*both bite contacts are closed/s);
  assert.match(dynamics.contactSequence,
    /first narrows.*four equal 1\.8-unit members.*35 to 45 degrees.*stone stays down.*meet.*\(-2,1\).*\(2,1\).*only in that closed pose.*0\.480709/s);
  disposeModel(model.root);
});

test('movement 494 ideal virtual work makes each bite force proportional to hoist load', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 800; sample += 1) {
    const phase = 0.2 * sample / 800;
    const state = stateAtTime(phase * geometry.cycleDuration);
    const expectedRiseRate = 2 * geometry.memberLength
      * Math.cos(state.leftJawAngle);
    const expectedInwardRate =
      -geometry.leftBiteLocal.x * Math.sin(state.leftJawAngle)
      - geometry.leftBiteLocal.y * Math.cos(state.leftJawAngle);
    near(state.shackleRiseRatePerRadian, expectedRiseRate, 0,
      `shackle virtual displacement ${sample}`);
    near(state.biteInwardRatePerRadian, expectedInwardRate, 0,
      `bite virtual displacement ${sample}`);
    near(state.biteForcePerUnitHoistTension,
      expectedRiseRate / (2 * expectedInwardRate), 0,
      `virtual-work force ratio ${sample}`);
    assert.ok(state.biteForcePerUnitHoistTension > 0.39);
    assert.ok(state.biteForcePerUnitHoistTension < 0.52);
    const unitLoadBite = state.biteForcePerUnitHoistTension;
    near(2 * unitLoadBite, state.biteForcePerUnitHoistTension * 2,
      0, `doubling weight doubles bite ${sample}`);
  }
  assert.match(dynamics.biteForceLaw,
    /virtual work gives F_bite_per_side\/T_hoist=.*positive throughout.*bite force rises linearly with suspended weight/s);
  assert.match(dynamics.safetyDisclosure,
    /not a lifting rating.*far enough below the top.*tearing out.*center of gravity.*below the points/s);
  disposeModel(model.root);
});

test('movement 494 renderer keeps the links closed and the 3D bite markers coincident', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 0.29, 0.8, 1.21, 1.6, 2, 2.53, 2.8,
    3.17, 3.6, 4]) {
    // The display clock starts in the source's lifted dwell.
    const state = stateAtTime(time + geometry.displayPhaseOffset * geometry.cycleDuration);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.leftJaw.rotation.z, state.leftJawAngle, 0,
      `left jaw render angle ${time}`);
    near(blocks.rightJaw.rotation.z, state.rightJawAngle, 0,
      `right jaw render angle ${time}`);
    near(blocks.stone.position.y,
      geometry.sourceVerticalOriginScene
        + state.stoneLift * geometry.sourceScale,
      0, `stone render translation ${time}`);

    const scenePoint = (point, z) => new THREE.Vector3(
      point.x * geometry.sourceScale,
      geometry.sourceVerticalOriginScene + point.y * geometry.sourceScale,
      z,
    );
    vectorNear(
      blocks.sidePivotPins[0].position,
      scenePoint(state.leftLinkPivot, 0.13),
      0,
      `left side pivot render ${time}`,
    );
    vectorNear(
      blocks.sidePivotPins[1].position,
      scenePoint(state.rightLinkPivot, -0.13),
      0,
      `right side pivot render ${time}`,
    );
    vectorNear(
      blocks.shacklePivotPin.position,
      scenePoint(state.shacklePivot, 0),
      0,
      `shackle pivot render ${time}`,
    );
    assert.equal(blocks.leftJawParts.biteMarker.visible,
      state.biteContact);
    assert.equal(blocks.rightJawParts.biteMarker.visible,
      state.biteContact);

    if (state.biteContact) {
      vectorNear(
        // The contact index is not drawn (source presentation removes it);
        // its seat point stays fixed in the tong.
        blocks.leftJaw.localToWorld(blocks.leftJawParts.biteMarker.position.clone()),
        blocks.stoneContactSockets[0].getWorldPosition(
          new THREE.Vector3(),
        ),
        5e-7,
        `left 3D bite contact ${time}`,
      );
      vectorNear(
        // The contact index is not drawn (source presentation removes it);
        // its seat point stays fixed in the tong.
        blocks.rightJaw.localToWorld(blocks.rightJawParts.biteMarker.position.clone()),
        blocks.stoneContactSockets[1].getWorldPosition(
          new THREE.Vector3(),
        ),
        5e-7,
        `right 3D bite contact ${time}`,
      );
    }
  }
  disposeModel(model.root);
});

test('movement 494 closes its hoist rope, swept bounds, and leaves spinning movement 507 next', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const initial = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  for (const key of [
    'closureProgress',
    'jawPivotY',
    'leftJawAngle',
    'rightJawAngle',
    'sidePivotHalfWidth',
    'sidePivotY',
    'stoneLift',
  ]) near(closure[key], initial[key], 0, `${key} exact closure`);
  vectorNear(closure.shacklePivot, initial.shacklePivot, 0,
    'shackle exact closure');
  vectorNear(closure.leftBite, initial.leftBite, 0,
    'left bite exact closure');

  for (const time of [0, 0.8, 1.6, 2, 2.8, 3.6, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const endpoints = cableEndpoints(blocks.hoistRope);
    vectorNear(endpoints.start, geometry.fixedHoistPoint, 2e-14,
      `fixed hoist end ${time}`);
    vectorNear(endpoints.end,
      blocks.shackle.position.clone().add(geometry.shackleRopePointLocal),
      2e-14, `moving shackle end ${time}`);
  }

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 480; sample += 1) {
    model.update(geometry.cycleDuration * sample / 480);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));
  assert.ok(model.root.userData.groundFloorY <= swept.min.y);

  const next = catalog.movements[506];
  const nextModel = createMovementModel(next);
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.match(next.title, /very slow motion/);
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.archetype, ARCHETYPE);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});
