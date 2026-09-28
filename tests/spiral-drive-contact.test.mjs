import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function renderedWheelRadius(point, geometry) {
  const { circumferenceSteps, axialSteps, depth, pitch } = geometry.userData;
  if (Math.abs(point.z) > depth / 2) return 0;
  const angle = THREE.MathUtils.euclideanModulo(Math.atan2(point.y, point.x) + pitch / 2, 2 * Math.PI);
  const angular = Math.min(circumferenceSteps - 1, Math.floor(angle / (2 * Math.PI) * circumferenceSteps));
  const axial = Math.min(axialSteps - 1, Math.floor((point.z / depth + 0.5) * axialSteps));
  const stride = circumferenceSteps + 1;
  const ray = new THREE.Ray(new THREE.Vector3(0, 0, point.z), new THREE.Vector3(point.x, point.y, 0).normalize());
  // At grid seams, Float32 coordinates can put the exact ray in an adjacent
  // cell. Query those triangles too, without substituting an analytic surface.
  for (const da of [0, -1, 1]) {
    for (const dt of [0, -1, 1]) {
      const row = axial + da;
      if (row < 0 || row >= axialSteps) continue;
      const a = row * stride + THREE.MathUtils.euclideanModulo(angular + dt, circumferenceSteps);
      for (const ids of [[a, a + 1, a + stride + 1], [a, a + stride + 1, a + stride]]) {
        const vertices = ids.map((i) => new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i));
        const hit = ray.intersectTriangle(...vertices, false, new THREE.Vector3());
        if (hit) return Math.hypot(hit.x, hit.y);
        const triangle = new THREE.Triangle(...vertices);
        const plane = triangle.getPlane(new THREE.Plane());
        const seamHit = ray.intersectPlane(plane, new THREE.Vector3());
        if (seamHit) {
          const barycentric = triangle.getBarycoord(seamHit, new THREE.Vector3());
          if (Math.min(barycentric.x, barycentric.y, barycentric.z) >= -1e-9) {
            return Math.hypot(seamHit.x, seamHit.y);
          }
        }
      }
    }
  }
  throw new Error(`The generated wheel must close around each radial ray: ${point.toArray()}.`);
}

/** Signed distance (outside positive) from a disk-local point to the flat rib:
 * the spiral band of half-width w with round plan ends, from base to top. */
function distanceToRib(point, disk) {
  const { spiralStartAngle, spiralStartRadius, spiralLead, rib } = disk.userData;
  const rho = Math.hypot(point.x, point.y);
  const turn = THREE.MathUtils.euclideanModulo(Math.atan2(point.y, point.x) - spiralStartAngle, 2 * Math.PI) / (2 * Math.PI);
  let plan = Math.abs(rho - spiralStartRadius - spiralLead * turn) - rib.halfWidth;
  for (const radius of [spiralStartRadius, spiralStartRadius + spiralLead]) {
    plan = Math.min(plan, Math.hypot(point.x - radius * Math.cos(spiralStartAngle),
      point.y - radius * Math.sin(spiralStartAngle)) - rib.halfWidth);
  }
  const vertical = point.z - rib.top;
  if (plan <= 0) return vertical;
  return vertical > 0 ? Math.hypot(plan, vertical) : plan;
}

test('029 meshes with its flat spiral rib, including the open-end handoff, and clears the disk', () => {
  const model = createMovementModel(catalog.movements[28]);
  const { disk, gear } = model.root.userData.blocks;
  const wheel = gear.userData.toothMesh;
  const rib = disk.userData.thread;
  assert.equal(rib.material, disk.userData.rotor.children[0].material, 'the rib is in the disk\'s own material');
  const ribSamples = [];
  const ribPositions = rib.geometry.attributes.position;
  for (let i = 0; i < ribPositions.count; i += 3) {
    const v = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(ribPositions, i + j));
    ribSamples.push(...v, v[0].clone().lerp(v[1], 0.5), v[1].clone().lerp(v[2], 0.5), v[2].clone().lerp(v[0], 0.5),
      v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1 / 3));
  }
  const phases = [...Array.from({ length: 65 }, (_, i) => i / 64), 0.747, 0.749, 0.751, 0.753];
  for (const phase of phases) {
    model.update(2 * Math.PI / 1.16 * phase, 0);
    model.root.updateMatrixWorld(true);
    const transform = wheel.matrixWorld.clone().invert().multiply(rib.matrixWorld);
    for (const sample of ribSamples) {
      const point = sample.clone().applyMatrix4(transform);
      if (Math.abs(point.z) > 0.1 - 1e-7 || Math.hypot(point.x, point.y) > gear.userData.outerRadius + 0.006) continue;
      const gap = Math.hypot(point.x, point.y) - renderedWheelRadius(point, wheel.geometry);
      assert.ok(gap > -1e-6, `phase ${phase}: the actual rib enters the driven wheel by ${-gap}`);
    }
    const toDisk = disk.userData.rotor.matrixWorld.clone().invert().multiply(wheel.matrixWorld);
    const positions = wheel.geometry.attributes.position;
    let closestDistance = Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(toDisk);
      assert.ok(point.z > 0.12, 'the real tooth surface clears the disk face');
      const distance = distanceToRib(point, disk);
      assert.ok(distance >= -1e-6, `phase ${phase}: the wheel surface enters the flat rib by ${-distance}`);
      closestDistance = Math.min(closestDistance, distance);
    }
    assert.ok(closestDistance < 0.004,
      `phase ${phase}: an actual wheel vertex is within 0.004 of the rib (${closestDistance})`);
    const state = model.root.userData.kinematics;
    assert.ok(Math.abs(state.threadRadialSpeed - state.gearPitchSurfaceVelocity.x) < 1e-12,
      'the thread advance and mating pitch point move in the same direction');
  }
});
