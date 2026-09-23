import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredAtmosphericBeamEngine } from '../src/simulation/authored-atmospheric-beam-engines.js';
import { createAuthoredUprightEngineParallelMotion } from '../src/simulation/authored-upright-engine-parallel-motions.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const bounds = part => new THREE.Box3().setFromObject(part);
const world = part => part.getWorldPosition(new THREE.Vector3());
function clearsBore(part, center, radius) {
  const ray = new THREE.Raycaster();
  for (let i = 0; i < 16; i++) {
    ray.set(new THREE.Vector3(center.x + radius * Math.cos(i * Math.PI / 8),
      center.y + radius * Math.sin(i * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(part, true).length, 0, `${part.userData.role}: finite pin fits open bore`);
  }
}
function pinSpans(pin, part) {
  const p = bounds(pin), b = bounds(part);
  assert.ok(p.min.z <= b.min.z && p.max.z >= b.max.z, `${part.userData.role}: engaged pin length`);
}

test('342: round piston joins its rod and stays inside the open-top cylinder bore', () => {
  const { root, update } = createAuthoredAtmosphericBeamEngine({ id: 342 }); const b = root.userData.blocks;
  const bore = b.openCylinder.geometry.userData.boreRadius;
  const headRadius = b.pistonHead.geometry.parameters.radiusTop;
  assert.ok(headRadius < bore - .01, 'piston head clears the bore');
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const head = bounds(b.pistonHead), rod = bounds(b.pistonRod), cylinder = bounds(b.openCylinder);
    assert.ok(head.intersectsBox(rod), 'piston head is joined to rod');
    assert.ok(Math.abs(world(b.pistonHead).x - world(b.openCylinder).x) < 1e-12, 'coaxial piston');
    assert.ok(head.min.y > bounds(b.cylinderBottom).max.y && head.max.y < cylinder.max.y, 'head stays within the barrel');
    assert.ok(bounds(b.pistonCrosshead).max.x - bounds(b.pistonCrosshead).min.x < 2 * bore, 'crosshead can enter the open top');
  }
  disposeObject3D(root);
});

test('343: round piston joins its rod and stays inside the plate cylinder barrel', () => {
  const { root, update } = createAuthoredUprightEngineParallelMotion({ id: 343 }); const b = root.userData.blocks;
  const bore = b.cylinderBody.geometry.userData.boreRadius;
  assert.ok(b.pistonHead.geometry.parameters.radiusTop < bore - .01, 'piston head clears the barrel bore');
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const head = bounds(b.pistonHead), rod = bounds(b.pistonRod);
    assert.ok(head.intersectsBox(rod), 'piston head is joined to rod');
    assert.ok(Math.abs(world(b.pistonHead).z - world(b.cylinderBody).z) < 1e-12, 'coaxial piston');
    assert.ok(Math.abs(world(b.pistonHead).x - world(b.cylinderBody).x)
      <= root.userData.geometry.maximumLateralDeviation + 1e-12, 'piston stays on its near-straight locus');
    assert.ok(head.min.y > bounds(b.cylinderBottom).max.y && head.max.y < bounds(b.cylinderTop).min.y,
      'head stays below the cover and above the bottom');
    const rodHalfDiagonal = Math.hypot(rod.max.x - rod.min.x, rod.max.z - rod.min.z) / 2;
    for (const part of [b.cylinderGland, b.cylinderNeck, b.cylinderTop]) {
      assert.ok(rodHalfDiagonal + Math.abs(world(b.pistonRod).x) < part.geometry.userData.boreRadius,
        `${part.userData.role} passes the piston rod`);
    }
  }
  disposeObject3D(root);
});

test('342: alternating bored chain plates engage common pins and rollers meet the shoe', () => {
  const { root, update } = createAuthoredAtmosphericBeamEngine({ id: 342 });
  const b = root.userData.blocks, g = root.userData.geometry;
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    for (const [j, link] of b.chainLinks.entries()) {
      for (const [boss, pin] of [[link.startBoss, link.startPin], [link.endBoss, link.endPin]]) {
        clearsBore(boss, world(pin), .051); clearsBore(link.body, world(pin), .051); pinSpans(pin, boss);
      }
      clearsBore(link.roller, world(link.startPin), .051); pinSpans(link.startPin, link.roller);
      if (j) {
        const previous = b.chainLinks[j - 1];
        assert.ok(world(previous.endPin).distanceTo(world(link.startPin)) < 1e-12);
        const a = bounds(previous.endBoss), c = bounds(link.startBoss);
        assert.ok(a.max.z < c.min.z || c.max.z < a.min.z, 'adjacent plates leave articulation clearance');
      }
      const center = world(link.roller); const radial = Math.hypot(center.x, center.y);
      assert.ok(radial - .09 >= g.pitchRadius - .09 - 1e-12, 'roller does not cut into circular shoe');
      if (Math.abs(radial - g.pitchRadius) < 1e-10) {
        const ray = new THREE.Raycaster(center, new THREE.Vector3(-center.x, -center.y, 0).normalize());
        const hits = ray.intersectObject(b.chainShoe, false);
        assert.ok(hits.length && Math.abs(hits[0].distance - .09) < .001, 'actual shoe face is within mesh tolerance of roller tread');
      }
    }
    for (const eye of b.terminalEyes) clearsBore(eye, world(eye), .051);
    assert.ok(world(b.terminalEyes[0]).distanceTo(world(b.terminalEyes[1])) > .2, 'terminal eyes have room for both pins');
    for (const [part, pin] of [[b.pivotBearing, b.pivotShaft], [b.pivotBoss, b.pivotShaft],
      [b.pistonTopBoss, b.chainLinks[0].startPin]]) {
      clearsBore(part, world(pin), pin.geometry.parameters.radiusTop); pinSpans(pin, part);
    }
  }
  disposeObject3D(root);
});

test('343: bored linkage eyes engage pins in separated working layers', () => {
  const { root, update } = createAuthoredUprightEngineParallelMotion({ id: 343 }); const b = root.userData.blocks;
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    assert.ok(b.jointPins.U.parent === b.topRadiusRod && b.jointPins.D.parent === b.bottomRadiusRod,
      'radius-rod pins are fast in their rods');
    assert.ok(b.jointPins.P.parent === b.inputCrank && b.jointPins.C.parent === b.pistonOutput);
    for (const [part, pin] of [[b.connectingRod, b.jointPins.P], [b.connectingRod, b.jointPins.C],
      [b.topRadiusRod.children[0], b.topPivotBearing.shaft], [b.bottomRadiusRod.children[0], b.bottomPivotBearing.shaft],
      [b.crosspiece, b.jointPins.C], [b.crosspiece, b.jointPins.U], [b.crosspiece, b.jointPins.D],
      [b.pistonTopEye, b.jointPins.C], [b.crankBearing, b.crankShaft], [b.flywheelHub, b.crankShaft]]) {
      clearsBore(part, world(pin), pin.geometry.parameters.radiusTop); pinSpans(pin, part);
    }
    const rod = bounds(b.connectingRod), radius = bounds(b.topRadiusRod.children[0]), cross = bounds(b.crosspiece), piston = bounds(b.pistonRod);
    assert.ok(rod.max.z < radius.min.z && radius.max.z < cross.min.z && cross.max.z < piston.min.z);
    for (const pivot of [b.topPivotBearing, b.bottomPivotBearing]) {
      assert.ok(bounds(pivot.bearing).max.z < radius.min.z);
      assert.ok(bounds(pivot.support).intersectsBox(bounds(pivot.bearing)));
      assert.ok(b.framePillars.some(pillar => bounds(pillar).intersectsBox(bounds(pivot.support))));
    }
    assert.ok(bounds(b.flywheel).max.z < bounds(b.framePillars[0]).min.z);
  }
  disposeObject3D(root);
});
