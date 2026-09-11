import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../src/data/movements.json', import.meta.url)));

function profileRadius(profile, axial) {
  const step = (profile.at(-1).axialPosition - profile[0].axialPosition) / (profile.length - 1);
  const coordinate = THREE.MathUtils.clamp((axial - profile[0].axialPosition) / step, 0, profile.length - 1);
  const index = Math.min(Math.floor(coordinate), profile.length - 2);
  return THREE.MathUtils.lerp(profile[index].radius, profile[index + 1].radius, coordinate - index);
}

test('045 rendered groove triangles stay within complementary nonoverlapping frusta', () => {
  const model = createMovementModel(catalog.movements[44]);
  const { driver, driven } = model.root.userData.blocks;
  const wheels = [driver, driven];
  const g = model.root.userData.geometry;
  const clouds = [];
  for (const wheel of wheels) {
    const geometry = wheel.userData.body.geometry;
    const positions = geometry.attributes.position, indices = geometry.index;
    const points = [];
    const halfPitch = g.faceWidth / (2 * g.grooveCount);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 1) {
      a.fromBufferAttribute(positions, i);
      assert.ok(a.length() > 0);
      assert.ok(Math.hypot(a.x, a.y) - profileRadius(wheel.userData.profile, a.z) < 2e-7);
      points.push(a.clone());
    }
    for (let i = 0; i < indices.count; i += 3) {
      a.fromBufferAttribute(positions, indices.getX(i));
      b.fromBufferAttribute(positions, indices.getX(i + 1));
      c.fromBufferAttribute(positions, indices.getX(i + 2));
      const low = Math.min(a.z, b.z, c.z), high = Math.max(a.z, b.z, c.z);
      assert.ok(high - low < halfPitch + 2e-7, 'triangles cannot bridge a V valley');
      const middleStrip = THREE.MathUtils.clamp(Math.floor(((low + high) / 2 + g.faceWidth / 2) / halfPitch), 0, 9);
      assert.ok(low >= -g.faceWidth / 2 + middleStrip * halfPitch - 2e-7);
      assert.ok(high <= -g.faceWidth / 2 + (middleStrip + 1) * halfPitch + 2e-7,
        'each face lies in one convex conical frustum or one flat cap');
      points.push(a.clone().add(b).add(c).multiplyScalar(1 / 3));
    }
    clouds.push(points);
  }
  const point = new THREE.Vector3();
  let checked = 0, maxPenetration = 0;
  for (let sample = 0; sample < 64; sample += 1) {
    model.update(g.inputPeriod * (sample + 0.173) / 64, 0);
    model.root.updateMatrixWorld(true);
    for (const side of [0, 1]) {
      const mate = 1 - side;
      const transform = wheels[mate].userData.body.matrixWorld.clone().invert()
        .multiply(wheels[side].userData.body.matrixWorld);
      for (const p of clouds[side]) {
        point.copy(p).applyMatrix4(transform);
        const penetration = profileRadius(wheels[mate].userData.profile, point.z) - Math.hypot(point.x, point.y);
        maxPenetration = Math.max(maxPenetration, penetration);
        assert.ok(penetration < 2e-7, 'an actual groove face enters the complementary wheel envelope');
        checked += 1;
      }
    }
  }
  console.log('045 triangle/envelope clearance', { poses: 64, checked, maxPenetration });
});

test('045 actual rotating faceted surfaces stay in contact across all ten V faces', () => {
  const model = createMovementModel(catalog.movements[44]);
  const { driver, driven } = model.root.userData.blocks;
  const wheels = [driver, driven], g = model.root.userData.geometry;
  const queries = wheels.map((wheel) => new THREE.Mesh(wheel.userData.body.geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(), direction = new THREE.Vector3();
  let maxGap = 0, rays = 0;
  for (let sample = 0; sample < 64; sample += 1) {
    model.update(g.inputPeriod * (sample + 0.317) / 64, 0);
    model.root.updateMatrixWorld(true);
    const inverses = wheels.map((wheel) => wheel.userData.body.matrixWorld.clone().invert());
    // Four positions in each V face, offset from vertices/cap seams to avoid
    // ambiguous ray/triangle edge hits. Test every face, including both ends.
    for (let station = 0; station < 40; station += 1) {
      const axial = -g.faceWidth / 2 + g.faceWidth * (station + 0.273) / 40;
      let gap = g.centerDistance;
      for (const side of [0, 1]) {
        origin.copy(wheels[side].position).setX(axial).applyMatrix4(inverses[side]);
        direction.set(0, side === 0 ? -1 : 1, 0).transformDirection(inverses[side]);
        raycaster.set(origin, direction);
        const hits = raycaster.intersectObject(queries[side], false);
        assert.ok(hits.length > 0, 'the ray meets the rendered working face');
        gap -= hits[0].distance;
        rays += 1;
      }
      assert.ok(gap > -2e-7, 'rendered contact surfaces are separate');
      assert.ok(gap < 0.00025, 'faceting does not open a visible contact gap: ' + gap);
      maxGap = Math.max(maxGap, gap);
    }
  }
  console.log('045 rendered working gap', { poses: 64, rays, maxGap });
});
