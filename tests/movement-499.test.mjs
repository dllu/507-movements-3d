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
    '../src/simulation/authored-bourdon-pressure-gauges.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'center-fed-double-ended-bourdon-tube-differential-sector-pinion-gauge';

function movementModel() {
  const movement = catalog.movements[498];
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

test('movement 499 is Brown’s center-fixed double-ended tube, not a generic one-ended gauge', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom } = model.root.userData;

  assert.equal(movement.id, 499);
  assert.equal(movement.number, '499');
  assert.match(movement.title, /^Aneroid gauge.*Bourdon gauge/);
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.tubeBranches.length, 2);
  assert.deepEqual(blocks.tubeBranches.map((branch) =>
    branch.userData.branchSide), [-1, 1]);
  assert.ok(blocks.tubeBranches.every((branch) =>
    branch.userData.crossSection.nonCircular));
  assert.ok(blocks.tubeBranches.every((branch) =>
    branch.userData.crossSection.inPlaneDimension
      > branch.userData.crossSection.throughDepthDimension));
  assert.equal(blocks.tubeCaps.length, 2);
  assert.ok(blocks.tubeCaps.every((cap) => cap.userData.closed));
  assert.equal(blocks.links.length, 2);
  assert.equal(blocks.sectorTeeth.length, 5);
  assert.equal(blocks.scaleTicks.length, 11);
  assert.equal(blocks.centerClamp.userData.sourceLabel, 'C');
  assert.equal(degreesOfFreedom.independentPressureInputs, 1);
  assert.equal(degreesOfFreedom.independentTubeBranchCoordinates, 0);
  assert.equal(degreesOfFreedom.independentSectorCoordinates, 0);
  assert.equal(degreesOfFreedom.independentPointerCoordinates, 0);
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 499 records Brown’s unavailable animation and Bourdon’s original patent evidence', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_499.html');
  assert.match(movement.description,
    /bent tube closed at its ends, secured at C, the middle of its length.*ends free.*tends to straighten.*toothed sector-piece.*pinion/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_499\.png$/);
  assert.match(sourceReference.brownSpecificity,
    /fixed at its middle C.*both ends free and closed.*both ends linked to one toothed sector.*pointer pinion/i);
  assert.match(sourceReference.bourdonPatentCorroboration.patent,
    /Eugene Bourdon.*US Patent 9,163.*1852/);
  assert.match(sourceReference.bourdonPatentCorroboration.detail,
    /flattened thin metallic tube.*increased pressure tends to straighten.*toothed sector and pinion/i);
  assert.equal(sourceReference.bourdonPatentCorroboration.url,
    'https://patents.google.com/patent/US9163A/en');
  assert.match(sourceReference.reconstructionDisclosure,
    /official page marks Animated unavailable.*36:12 sector\/pinion pitch ratio.*explicit reconstruction choices/i);
  disposeModel(model.root);
});

test('movement 499 keeps both tube halves fixed at C and preserves each branch arc length while straightening', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  let previousLeftRadius = geometry.relaxedBranchRadius;
  let previousRightRadius = geometry.relaxedBranchRadius;
  for (let sample = 0; sample <= 600; sample += 1) {
    const time = geometry.cycleDuration * 0.5 * sample / 600;
    const state = stateAtTime(time);
    state.branchCenterlines.forEach((points, branchIndex) => {
      vectorNear(points[0], geometry.fixedMidpoint.clone().setZ(0.04),
        1e-15, `fixed center C ${sample}/${branchIndex}`);
      near(state.branchRadii[branchIndex]
        * state.branchArcAngles[branchIndex], geometry.branchArcLength,
      9e-16, `constant branch arc length ${sample}/${branchIndex}`);
      assert.equal(points.length, geometry.branchSegmentCount + 1);
      vectorNear(points.at(-1), state.tubeEndPoints[branchIndex], 0,
        `published free endpoint ${sample}/${branchIndex}`);
    });
    assert.ok(state.branchRadii[0] >= previousLeftRadius - 2e-15,
      `left branch straightens monotonically ${sample}`);
    assert.ok(state.branchRadii[1] >= previousRightRadius - 2e-15,
      `right branch straightens monotonically ${sample}`);
    assert.ok(state.branchArcAngles[0]
      <= geometry.relaxedBranchArcAngle + 2e-15);
    assert.ok(state.branchArcAngles[1]
      <= geometry.relaxedBranchArcAngle + 2e-15);
    previousLeftRadius = state.branchRadii[0];
    previousRightRadius = state.branchRadii[1];
  }
  const relaxed = stateAtTime(0);
  const pressurized = stateAtTime(geometry.cycleDuration / 2);
  assert.ok(Math.abs(pressurized.tubeEndPoints[0].x)
    > Math.abs(relaxed.tubeEndPoints[0].x));
  assert.ok(Math.abs(pressurized.tubeEndPoints[1].x)
    > Math.abs(relaxed.tubeEndPoints[1].x));
  disposeModel(model.root);
});

test('movement 499 closes both rigid end links exactly throughout the pressure cycle', () => {
  const { model } = movementModel();
  const { geometry, linkage, stateAtTime } = model.root.userData;
  for (let sample = 0; sample <= 1000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 1000);
    near(state.tubeEndPoints[0].distanceTo(state.sectorInputPins[0]),
      linkage.leftLinkLength, 3e-15,
      `left rigid-link closure ${sample}`);
    near(state.tubeEndPoints[1].distanceTo(state.sectorInputPins[1]),
      linkage.rightLinkLength, 3e-15,
      `right rigid-link closure ${sample}`);
    near(state.leftLinkLengthResidual, 0, 3e-15,
      `left published closure residual ${sample}`);
    near(state.rightLinkLengthResidual, 0, 3e-15,
      `right published closure residual ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 499 sector and pointer pinion obey their external pitch-radius ratio', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  near(transmission.gearRatio, 3, 5e-16, '36:12 pitch ratio');
  assert.equal(transmission.sectorEquivalentTeeth, 36);
  assert.equal(transmission.pinionTeeth, 12);
  assert.equal(transmission.pointerTurnsWithPinion, true);
  for (let sample = 0; sample <= 900; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 900);
    near(state.pinionAngle,
      -state.sectorAngle * transmission.gearRatio, 0,
      `external mesh displacement ${sample}`);
    near(state.pinionAngularVelocity,
      -state.sectorAngularVelocity * transmission.gearRatio, 0,
      `external mesh speed ${sample}`);
    near(state.pointerAngle, 2.35 + state.pinionAngle, 0,
      `pointer keyed to pinion ${sample}`);
    near(state.gearPitchVelocityResidual, 0, 3e-17,
      `no-slip pitch velocity ${sample}`);
    near(state.scaleReading,
      state.pressureFraction * geometry.maximumScaleReading, 0,
      `pressure-proportional scale ${sample}`);
  }
  const maximum = stateAtTime(geometry.cycleDuration / 2);
  near(maximum.gaugePressurePascal,
    transmission.maximumDemonstrationPressurePascal, 0,
    'maximum demonstration pressure');
  near(maximum.pointerAngle, 0.97, 3e-16,
    'full-scale pointer angle');
  disposeModel(model.root);
});

test('movement 499 renderer follows the solved tube, links, sector, pinion, and pointer', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  for (let sample = 0; sample <= 320; sample += 1) {
    const time = geometry.cycleDuration * sample / 320;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.sector.rotation.z, state.sectorAngle, 0,
      `rendered sector ${sample}`);
    near(blocks.pinion.userData.rotor.rotation.z, state.pinionAngle, 0,
      `rendered pinion ${sample}`);
    near(blocks.pointer.rotation.z, state.pointerAngle, 0,
      `rendered pointer ${sample}`);
    for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
      const renderedPoints = blocks.tubeBranches[branchIndex]
        .userData.centerlinePoints;
      vectorNear(renderedPoints[0],
        state.branchCenterlines[branchIndex][0], 0,
        `rendered tube fixed point ${sample}/${branchIndex}`);
      vectorNear(renderedPoints.at(-1), state.tubeEndPoints[branchIndex], 0,
        `rendered tube free point ${sample}/${branchIndex}`);
      vectorNear(blocks.tubeEndPins[branchIndex].position,
        state.tubeEndPoints[branchIndex], 0,
        `rendered tube-end pin ${sample}/${branchIndex}`);
      vectorNear(blocks.links[branchIndex].children[1].position,
        state.tubeEndPoints[branchIndex], 0,
        `rendered link start ${sample}/${branchIndex}`);
      vectorNear(blocks.links[branchIndex].children[2].position,
        state.sectorInputPins[branchIndex], 0,
        `rendered link end ${sample}/${branchIndex}`);
    }
    near(blocks.pressureCore.material.opacity,
      0.10 + 0.52 * state.pressureFraction, 0,
      `rendered pressure visibility ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 499 scale is an arched band carried by the case, in front of tube B', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const band = blocks.scaleArc;
  const spec = band.userData.scaleBand;
  band.geometry.computeBoundingBox();
  const box = band.geometry.boundingBox;
  // The ends run past the bezel into the case rim, and are seated back into it.
  let reach = 0;
  const p = band.geometry.attributes.position;
  for (let i = 0; i < p.count; i += 1) reach = Math.max(reach, Math.hypot(p.getX(i), p.getY(i)));
  assert.ok(reach > spec.bezelRadius + 0.2, `band reaches the rim: ${reach}`);
  assert.ok(box.min.z <= spec.seat + 1e-6 && spec.seat < -0.02, 'band ends seated in the rim');
  // Concentric with the pointer spindle; the pointer reaches its lower edge.
  assert.ok(Math.abs(geometry.pinionCenter.x) < 1e-12);
  const tip = new THREE.Box3().setFromObject(blocks.pointerTip);
  model.root.updateMatrixWorld(true);
  for (const tick of blocks.scaleTicks) {
    assert.ok(tick.position.z > spec.front, 'graduations printed on the band face');
  }
  // Tube B stays behind the band over the whole cycle.
  for (let i = 0; i <= 32; i += 1) {
    model.update(geometry.cycleDuration * i / 32);
    model.root.updateMatrixWorld(true);
    for (const branch of blocks.tubeBranches) {
      const b = new THREE.Box3().setFromObject(branch);
      assert.ok(b.max.z < spec.back, `tube behind band ${i}: ${b.max.z}`);
    }
  }
  assert.ok(Number.isFinite(tip.max.x));
  disposeModel(model.root);
});

test('movement 499 closes smoothly, fits all poses, and leaves movement 507 next', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const initial = stateAtTime(0);
  const turnaround = stateAtTime(geometry.cycleDuration / 2);
  const closure = stateAtTime(geometry.cycleDuration);
  near(initial.pressureFractionVelocity, 0, 0,
    'initial pressure velocity');
  near(turnaround.pressureFractionVelocity, 0, 6e-17,
    'turnaround pressure velocity');
  near(closure.pressureFractionVelocity, 0, 0,
    'closure pressure velocity');
  near(closure.cyclePosition, initial.cyclePosition, 0,
    'cycle-position closure');
  near(closure.sectorAngle, initial.sectorAngle, 0,
    'sector closure');
  near(closure.pointerAngle, initial.pointerAngle, 0,
    'pointer closure');
  for (let index = 0; index < 2; index += 1) {
    near(closure.branchRadii[index], initial.branchRadii[index], 0,
      `branch radius closure ${index}`);
    vectorNear(closure.tubeEndPoints[index], initial.tubeEndPoints[index],
      0, `tube end closure ${index}`);
  }

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 360; sample += 1) {
    model.update(geometry.cycleDuration * sample / 360);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));

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
