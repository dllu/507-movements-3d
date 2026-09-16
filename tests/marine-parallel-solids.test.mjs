import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredMarineParallelMotion } from '../src/simulation/authored-marine-parallel-motions.js';
import { createAuthoredBeamEngineParallelMotion } from '../src/simulation/authored-beam-engine-parallel-motions.js';
import { polygonClipping as clip } from '../src/simulation/finite-plate-geometry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

for (const id of [332, 333, 335, 336]) test(`${id}: finite rod eyes clear real moving pins throughout the stroke`, () => {
  const model = (id === 335 ? createAuthoredBeamEngineParallelMotion : createAuthoredMarineParallelMotion)({ id });
  const rods = [];
  model.root.traverse(object => { if (object.userData.bores) rods.push(object); });
  assert.ok(rods.length >= 4);
  const ray = new THREE.Raycaster();
  let matchingPins = 0;
  for (let sample = 0; sample <= 32; sample += 1) {
    model.update(4 * sample / 32); model.root.updateMatrixWorld(true);
    for (const mesh of rods) for (const bore of mesh.userData.bores) {
      const center = new THREE.Vector3(bore.x, bore.y, 0).applyMatrix4(mesh.matrixWorld);
      const pin = Object.values(model.root.userData.blocks.jointPins).find(pin => {
        const p = pin.getWorldPosition(new THREE.Vector3());
        return Math.hypot(p.x - center.x, p.y - center.y) < 1e-8;
      });
      if (!pin) {
        const slab = new THREE.Box3().setFromObject(mesh);
        let engaged = false;
        model.root.traverse(shaft => {
          if (shaft.geometry?.type !== 'CylinderGeometry') return;
          const p = shaft.getWorldPosition(new THREE.Vector3());
          if (Math.hypot(p.x - center.x, p.y - center.y) > 1e-8
            || shaft.geometry.parameters.radiusTop >= bore.radius) return;
          const bounds = new THREE.Box3().setFromObject(shaft);
          if (bounds.min.z <= slab.min.z && bounds.max.z >= slab.max.z) engaged = true;
        });
        assert.ok(engaged, 'stationary axle spans the full thickness of its bored radius bar');
        continue;
      }
      matchingPins += 1;
      const radius = pin.geometry.parameters.radiusTop;
      assert.ok(radius < bore.radius, `pin fits ${mesh.userData.role}`);
      for (let i = 0; i < 16; i += 1) {
        const angle = i * Math.PI / 8;
        ray.set(new THREE.Vector3(center.x + radius * Math.cos(angle),
          center.y + radius * Math.sin(angle), 10), new THREE.Vector3(0, 0, -1));
        assert.equal(ray.intersectObject(mesh, false).length, 0, 'real pin cross-section clears rendered eye');
      }
    }
  }
  assert.ok(matchingPins >= (id === 335 ? 7 : 8) * 33);
  assert.equal(model.root.userData.hideGround, true);
  disposeObject3D(model.root);
});

const toothPolygon = mesh => [[mesh.geometry.parameters.shapes.getPoints(64).map(point =>
  new THREE.Vector3(point.x, point.y, 0).applyMatrix4(mesh.matrixWorld).toArray().slice(0, 2))]];
const area = polygons => polygons.reduce((sum, [ring]) => sum + Math.abs(ring.reduce((a, p, i) => {
  const q = ring[(i + 1) % ring.length]; return a + p[0] * q[1] - p[1] * q[0];
}, 0)) / 2, 0);
const pointEdgeDistance = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

test('334: involute sector and rack have no swept tooth overlap and retain a close mesh', t => {
  const { root, update } = createAuthoredBeamEngineParallelMotion({ id: 334 });
  const b = root.userData.blocks;
  assert.ok(b.sectorTeeth[0].geometry.userData.involute);
  let largestNearestGap = 0;
  for (let sample = 0; sample <= 96; sample += 1) {
    update(4 * sample / 96); root.updateMatrixWorld(true);
    let minimumGap = Infinity;
    for (const gear of b.sectorTeeth) {
      const gp = toothPolygon(gear), gr = gp[0][0];
      for (const rack of b.rackTeeth) {
        const rp = toothPolygon(rack), rr = rp[0][0];
        assert.ok(area(clip.intersection(gp, rp)) < 1e-10, 'finite tooth sections must not overlap');
        for (const point of gr) for (let i = 0; i < rr.length; i += 1) {
          minimumGap = Math.min(minimumGap, pointEdgeDistance(point, rr[i], rr[(i + 1) % rr.length]));
        }
      }
    }
    largestNearestGap = Math.max(largestNearestGap, minimumGap);
  }
  assert.ok(largestNearestGap < 0.001, `mesh must stay engaged: nearest gap ${largestNearestGap}`);
  t.diagnostic(`Maximum nearest tooth gap: ${largestNearestGap} model units`);
  disposeObject3D(root);
});

test('334: rack wear strip is tangent to the roller and its shaft has a real bore', () => {
  const { root, update } = createAuthoredBeamEngineParallelMotion({ id: 334 });
  const b = root.userData.blocks, g = root.userData.geometry;
  const ray = new THREE.Raycaster();
  for (let i = 0; i <= 32; i += 1) {
    update(4 * i / 32); root.updateMatrixWorld(true);
    const strip = new THREE.Box3().setFromObject(b.rackBackWearStrip);
    assert.ok(Math.abs(strip.min.x - (g.rollerCenterA.x + g.rollerRadius)) < 1e-7);
    for (let j = 0; j < 16; j += 1) {
      ray.set(new THREE.Vector3(g.rollerCenterA.x + 0.30 * g.rollerRadius * Math.cos(j * Math.PI / 8),
        g.rollerCenterA.y + 0.30 * g.rollerRadius * Math.sin(j * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
      assert.equal(ray.intersectObject(b.rollerDisk, false).length, 0);
    }
  }
  disposeObject3D(root);
});
