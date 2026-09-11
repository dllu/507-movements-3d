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
  new URL(
    '../src/simulation/authored-stone-lewises.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'central-hoist-wedge-spreading-two-stone-lifting-packing-pieces';

function movementModel() {
  const movement = catalog.movements[492];
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

test('movement 493 is one central hoist wedge, two packing wedges, and one stone', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom } = model.root.userData;

  assert.equal(movement.id, 493);
  assert.equal(movement.number, '493');
  assert.equal(movement.title, '“Lewis,” for lifting stone in building');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.centerTaper.parent, blocks.centerPin);
  assert.equal(blocks.centerHead.parent, blocks.centerPin);
  assert.equal(blocks.shackleRing.parent, blocks.centerPin);
  assert.equal(blocks.shacklePin.parent, blocks.centerPin);
  assert.equal(blocks.leftPacking.packing.parent, model.root);
  assert.equal(blocks.rightPacking.packing.parent, model.root);
  assert.equal(blocks.leftPacking.body.parent,
    blocks.leftPacking.packing);
  assert.equal(blocks.rightPacking.body.parent,
    blocks.rightPacking.packing);
  assert.equal(blocks.stoneBody.parent, blocks.stone);
  assert.ok(blocks.boreWalls.every((wall) => wall.parent === blocks.stone));
  assert.equal(blocks.hoistRope.parent, model.root);
  assert.equal(blocks.hoistGuide.parent, model.root);
  assert.equal(degreesOfFreedom.independentHoistInputs, 1);
  assert.equal(degreesOfFreedom.independentPackingCoordinates, 0);
  assert.equal(degreesOfFreedom.independentStoneCoordinates, 0);
  assert.equal(degreesOfFreedom.packingPieces, 2);
  assert.equal(degreesOfFreedom.rigidStoneCoordinates, 1);

  const hoistRopes = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isHoistRope) hoistRopes.push(object);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(hoistRopes, [blocks.hoistRope]);
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeBelt|beltPath|pulley/i);
  disposeModel(model.root);
});

test('movement 493 records Brown, the official canvas model, and Fidler’s Lewis construction', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate493;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_493.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.officialInlineModelUrl, movement.sourceUrl);
  assert.match(movement.description,
    /central taper pin or wedge.*two wedge-like packing-pieces.*one on each side.*inserted together in a hole drilled into the stone.*central wedge is hoisted.*packing-pieces out.*stone to be lifted/s);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.officialCyclesPerMinute, 15);
  assert.equal(sourceAnimation.officialCyclePeriodSecond, 4);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, true);
  assert.deepEqual(sourceAnimation.officialPhaseLandmarks,
    [0, 0.138, 0.4, 0.5, 0.762, 0.9, 1]);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBoreBoundsPixels,
    [207, 244, 307, 414]);
  assert.deepEqual(plate.approximateShackleBoundsPixels,
    [211, 105, 307, 248]);
  assert.deepEqual(plate.approximateStoneBoundsPixels,
    [46, 244, 490, 496]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.officialCanvasEvidence,
    /15-cycles-per-minute.*0\/\.138\/\.4\/\.5\/\.762\/\.9.*2-unit center-pin stroke.*\.047586-unit symmetric packing spread.*1\.31-unit stone lift.*straight bore and taper profiles/s);
  assert.match(evidence.fidlerCorroboration,
    /Henry Fidler’s 1893.*pages 217–218.*three separate iron pieces.*broad-bottom center wedge.*side pieces outward.*increasing strain tightening the grip/s);
  assert.match(evidence.reconstructionDisclosure,
    /source-space profiles.*phase timing.*relative travels.*Extrusion depth.*cutaway.*original 3D engineering choices/s);
  assert.match(sourceReference.fidlerArchivePageUrl,
    /archive\.org\/details\/notesonbuildingc02fidliala\/page\/n243/);
  disposeModel(model.root);
});

test('movement 493 exactly reproduces all six official piecewise-linear source poses', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const cases = [
    [0, 0, 0, 0],
    [0.138, 0.69, 0, 0.047586],
    [0.4, 2, 1.31, 0.047586],
    [0.5, 2, 1.31, 0.047586],
    [0.762, 0.69, 0, 0.047586],
    [0.9, 0, 0, 0],
    [1, 0, 0, 0],
  ];
  for (const [phase, center, stone, spread] of cases) {
    const state = stateAtTime(phase * geometry.cycleDuration);
    near(state.centralLift, center, 8e-16,
      `official center position at phase ${phase}`);
    near(state.stoneLift, stone, 8e-16,
      `official stone position at phase ${phase}`);
    near(state.packingSpread, spread, 8e-16,
      `official packing position at phase ${phase}`);
  }

  for (let sample = 0; sample < 4000; sample += 1) {
    const phase = sample / 4000;
    const state = stateAtTime(phase * geometry.cycleDuration);
    let expectedCenter;
    if (phase < 0.4) expectedCenter = 5 * phase;
    else if (phase <= 0.5) expectedCenter = 2;
    else if (phase < 0.9) expectedCenter = 5 * (0.9 - phase);
    else expectedCenter = 0;
    near(state.centralLift, expectedCenter, 9e-16,
      `linear center schedule ${sample}`);

    let expectedStone;
    if (phase <= 0.138 || phase >= 0.762) expectedStone = 0;
    else if (phase < 0.4) expectedStone = 5 * (phase - 0.138);
    else if (phase <= 0.5) expectedStone = 1.31;
    else expectedStone = 5 * (0.762 - phase);
    near(state.stoneLift, expectedStone, 9e-16,
      `linear stone schedule ${sample}`);
  }
  assert.equal(geometry.officialCyclesPerMinute, 15);
  assert.equal(geometry.cycleDuration, 4);
  assert.deepEqual(geometry.sourcePhaseLandmarks,
    [0, 0.138, 0.4, 0.5, 0.762, 0.9, 1]);
  assert.match(model.root.userData.dynamics.sourceLinearTimingDisclosure,
    /piecewise-linear interpolation.*instantaneous speed changes.*exact source poses.*four-second period.*dwells/s);
  disposeModel(model.root);
});

test('movement 493 matched tapers maintain contact while the center wedge spreads both packings symmetrically', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission, wedgeInterfaceAtState } =
    model.root.userData;

  near(geometry.lockStroke, 0.69, 2e-16,
    'center-only locking stroke');
  near(geometry.packingMaximumSpread, 0.047586, 3e-17,
    'each packing spread');
  near(geometry.kinematicWedgeSlope,
    geometry.packingMaximumSpread / geometry.lockStroke, 0,
    'wedge displacement ratio');
  near(geometry.sourceCentralTaperSlope,
    geometry.kinematicWedgeSlope, 3.7e-7,
    'rounded official central taper matches motion ratio');
  near(geometry.sourcePackingTaperSlope,
    geometry.kinematicWedgeSlope, 4.4e-7,
    'rounded official packing taper matches motion ratio');

  for (let sample = 0; sample <= 1600; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 1600,
    );
    near(state.packingSpread, state.kinematicPackingSpread, 3e-16,
      `wedge displacement closure ${sample}`);
    near(state.packingAnchorX,
      geometry.packingAnchorStartX + state.packingSpread, 0,
      `right packing coordinate ${sample}`);
    for (let interfaceSample = 0; interfaceSample <= 8;
      interfaceSample += 1) {
      const contact = wedgeInterfaceAtState(
        state,
        interfaceSample / 8,
      );
      assert.ok(contact.overlapTop > contact.overlapBottom);
      assert.ok(Math.abs(contact.rightClosureError) < 4.6e-7,
        `right taper contact ${sample}/${interfaceSample}`);
      assert.ok(Math.abs(contact.leftClosureError) < 4.6e-7,
        `left taper contact ${sample}/${interfaceSample}`);
      near(contact.centralLeftX, -contact.centralRightX, 0,
        `central taper symmetry ${sample}/${interfaceSample}`);
      near(contact.packingLeftX, -contact.packingRightX, 0,
        `packing symmetry ${sample}/${interfaceSample}`);
    }
  }
  assert.equal(transmission.wedgeSlopeConstraint,
    'k_wedge=0.047586/0.69');
  assert.match(transmission.symmetricSpreadConstraint,
    /x_right=-x_left=0\.702414\+k_wedge/);
  disposeModel(model.root);
});

test('movement 493 reaches both bore walls before the stone can move and then lifts without slip', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;

  for (let sample = 0; sample < 552; sample += 1) {
    const state = stateAtTime(sample / 1000);
    assert.ok(state.wallClearance > 0);
    near(state.stoneLift, 0, 0,
      `stone waits before wall contact ${sample}`);
    assert.equal(state.packingsAgainstWall, false);
  }
  const contact = stateAtTime(
    geometry.lockingPhase * geometry.cycleDuration,
  );
  near(contact.wallClearance, 0, 0, 'exact simultaneous wall contact');
  near(contact.packingAnchorX, geometry.boreHalfWidth, 0,
    'packing outer face reaches bore wall');
  near(contact.stoneLift, 0, 0,
    'stone has not moved at first contact');
  assert.equal(contact.packingsAgainstWall, true);

  for (let sample = 553; sample <= 3048; sample += 1) {
    const time = sample / 1000;
    const phase = time / geometry.cycleDuration;
    const state = stateAtTime(time);
    if (phase <= geometry.stoneHomePhase) {
      near(state.wallClearance, 0, 2e-16,
        `outer face stays on wall ${sample}`);
      near(state.relativeWedgeAdvance, geometry.lockStroke, 5e-16,
        `wedge remains locked ${sample}`);
      near(state.packingAnchorY - geometry.packingAnchorStartY,
        state.stoneLift, 1e-15,
        `packing and stone have no vertical slip ${sample}`);
      assert.equal(state.stoneSupportedByWedgedPackings, true);
    }
  }
  const released = stateAtTime(
    geometry.releasedPhase * geometry.cycleDuration,
  );
  near(released.stoneLift, 0, 2e-15, 'stone returned before release');
  near(released.packingSpread, 0, 2e-16, 'packings retract at release');
  near(released.wallClearance,
    geometry.packingMaximumSpread, 2e-16,
    'wall clearance restored');

  assert.match(transmission.wallContactConstraint,
    /bore_half_width=0\.75 before stone motion/);
  assert.match(transmission.lockedLiftConstraint,
    /delta_y_packing=delta_y_stone.*0\.69 after wall contact/s);
  assert.match(dynamics.contactSequence,
    /first raises only.*central wedge.*drive the two packing pieces symmetrically outward.*exact wall contact.*stationary relative to the stone.*carries.*stone upward together/s);
  assert.match(dynamics.forcePath,
    /Hoist tension.*opposed normal forces.*vertical outer faces.*bore walls.*stone weight.*not a safe working load/s);
  assert.match(dynamics.straightBoreDisclosure,
    /Fidler.*hole wider at the bottom.*Movement 493 canvas.*1\.5-unit straight-sided slot.*vertical-faced packing pieces/s);
  disposeModel(model.root);
});

test('movement 493 renderer binds the exact center, packing, stone, and contact coordinates', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  model.update(0);
  model.root.updateMatrixWorld(true);
  const fixedMatrices = [
    blocks.hoistGuide,
    blocks.upwardIndex,
    blocks.upwardIndexShaft,
  ].map((object) => object.matrixWorld.clone());

  for (const time of [0, 0.21, 0.552, 1.03, 1.6, 1.87, 2, 2.61,
    3.048, 3.39, 3.6, 4]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.centerPin.position.y,
      geometry.sourceVerticalOriginScene
        + state.centerPinAnchorY * geometry.sourceScale,
      0, `rendered center pin at ${time}`);
    near(blocks.stone.position.y,
      geometry.sourceVerticalOriginScene
        + state.stoneLift * geometry.sourceScale,
      0, `rendered stone at ${time}`);
    near(blocks.rightPacking.packing.position.x,
      state.packingAnchorX * geometry.sourceScale,
      0, `rendered right packing x at ${time}`);
    near(blocks.leftPacking.packing.position.x,
      -state.packingAnchorX * geometry.sourceScale,
      0, `rendered left packing x at ${time}`);
    near(blocks.rightPacking.packing.position.y,
      geometry.sourceVerticalOriginScene
        + state.packingAnchorY * geometry.sourceScale,
      0, `rendered right packing y at ${time}`);
    near(blocks.leftPacking.packing.position.y,
      blocks.rightPacking.packing.position.y,
      0, `packing vertical symmetry at ${time}`);
    assert.equal(blocks.leftPacking.wallContactMarker.visible,
      state.packingsAgainstWall);
    assert.equal(blocks.rightPacking.wallContactMarker.visible,
      state.packingsAgainstWall);

    const rightWallX = blocks.boreWalls[1]
      .getWorldPosition(new THREE.Vector3()).x;
    const leftWallX = blocks.boreWalls[0]
      .getWorldPosition(new THREE.Vector3()).x;
    near(rightWallX, geometry.boreHalfWidth * geometry.sourceScale, 0,
      `right bore wall fixed laterally at ${time}`);
    near(leftWallX, -geometry.boreHalfWidth * geometry.sourceScale, 0,
      `left bore wall fixed laterally at ${time}`);
    near(
      blocks.boreWalls[1].getWorldPosition(new THREE.Vector3()).y
        - blocks.boreWalls[0].getWorldPosition(new THREE.Vector3()).y,
      0,
      0,
      `bore walls remain one rigid stone at ${time}`,
    );
    fixedMatrices.forEach((matrix, index) => {
      assert.ok([
        blocks.hoistGuide,
        blocks.upwardIndex,
        blocks.upwardIndexShaft,
      ][index].matrixWorld.equals(matrix),
      `fixed hoist index ${index} moved at ${time}`);
    });
  }
  disposeModel(model.root);
});

test('movement 493 hoist rope stays attached to the rising central shackle only', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;

  for (const time of [0, 0.37, 0.552, 1.6, 2, 2.74, 3.6, 4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const endpoints = cableEndpoints(blocks.hoistRope);
    vectorNear(endpoints.start, geometry.fixedHoistPoint, 2e-14,
      `fixed hoist-rope end at ${time}`);
    vectorNear(endpoints.end, new THREE.Vector3(
      0,
      blocks.centerPin.position.y + geometry.shackleRopePointLocalY,
      blocks.centerPin.position.z,
    ), 2e-14, `shackle hoist-rope end at ${time}`);
    assert.ok(endpoints.start.y > endpoints.end.y);
  }
  assert.equal(blocks.hoistRope.userData.isHoistRope, true);
  assert.equal(blocks.hoistRope.userData.isBelt, false);
  disposeModel(model.root);
});

test('movement 493 closes, fits every official phase, and leaves spinning movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const initial = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  for (const key of [
    'centerPinAnchorY',
    'centralLift',
    'kinematicPackingSpread',
    'packingAnchorX',
    'packingAnchorY',
    'packingSpread',
    'packingSpreadClosureError',
    'relativeWedgeAdvance',
    'stoneLift',
    'wallClearance',
  ]) {
    near(closure[key], initial[key], 0, `${key} exact cycle closure`);
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
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
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
