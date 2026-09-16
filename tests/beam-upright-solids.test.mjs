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

for (const [id, factory] of [[342, createAuthoredAtmosphericBeamEngine], [343, createAuthoredUprightEngineParallelMotion]]) {
  test(`${id}: piston joins its rod and stays inside the finite cylinder throughout the stroke`, () => {
    const { root, update } = factory({ id }); const b = root.userData.blocks;
    for (let i = 0; i <= 64; i++) {
      update(4 * i / 64); root.updateMatrixWorld(true);
      const head = bounds(b.pistonHead), rod = bounds(b.pistonRod);
      const walls = b.cylinderWalls.map(bounds), bottom = bounds(b.cylinderBottom);
      assert.ok(head.intersectsBox(rod), 'piston head is joined to rod');
      assert.ok(head.min.x > walls[0].max.x && head.max.x < walls[1].min.x, 'head between cylinder walls');
      assert.ok(head.min.y > bottom.max.y && head.max.y < walls[0].max.y, 'head stays within stroke limits');
      assert.ok(head.min.z >= walls[0].min.z && head.max.z <= walls[0].max.z, 'head and cylinder share working plane');
      const guides = b.pistonGuides.map(bounds);
      assert.ok(rod.min.x > guides[0].max.x && rod.max.x < guides[1].min.x, 'rod clears finite guide faces');
    }
    disposeObject3D(root);
  });
}

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
      [b.pistonTopBoss, b.pistonTopPin], [b.pumpRodTopBoss, b.pumpJointPin]]) {
      clearsBore(part, world(pin), pin.geometry.parameters.radiusTop); pinSpans(pin, part);
    }
  }
  disposeObject3D(root);
});

test('343: bored linkage eyes engage pins in separated working layers', () => {
  const { root, update } = createAuthoredUprightEngineParallelMotion({ id: 343 }); const b = root.userData.blocks;
  for (let i = 0; i <= 64; i++) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    for (const [part, pin] of [[b.connectingRod, b.jointPins.P], [b.connectingRod, b.jointPins.C],
      [b.topRadiusRod, b.jointPins.U], [b.bottomRadiusRod, b.jointPins.D],
      [b.topRadiusRod, b.topPivotBearing.shaft], [b.bottomRadiusRod, b.bottomPivotBearing.shaft],
      [b.crosspiece, b.jointPins.C], [b.crosspiece, b.jointPins.U], [b.crosspiece, b.jointPins.D],
      [b.pistonTopEye, b.jointPins.C], [b.crankBearing, b.crankShaft], [b.flywheelHub, b.crankShaft]]) {
      clearsBore(part, world(pin), pin.geometry.parameters.radiusTop); pinSpans(pin, part);
    }
    const rod = bounds(b.connectingRod), radius = bounds(b.topRadiusRod), cross = bounds(b.crosspiece), piston = bounds(b.pistonRod);
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
