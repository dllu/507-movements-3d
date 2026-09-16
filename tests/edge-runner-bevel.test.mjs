import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredEdgeRunnerMovement as create } from '../src/simulation/authored-edge-runners.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

test('375 bevel teeth have involute flanks, conical ends and correct cap normals', () => {
  const b = create({ id: 375 }).root.userData.blocks;
  for (const gear of [b.largeBevelGear, b.inputPinion]) {
    const u = gear.userData, geometry = u.toothMeshes[0].geometry;
    assert.equal(u.toothProfile, 'back-cone-involute-approximation');
    const p = geometry.attributes.position, normals = geometry.attributes.normal, count = p.count / 6;
    for (const offset of [0, count]) {
      const levels = [];
      for (let i = offset; i < offset + count; i++) {
        const x = p.getX(i), y = p.getY(i), radius = Math.hypot(x, y);
        levels.push(p.getZ(i) + Math.tan(u.pitchConeAngle) * radius);
        const expected = new THREE.Vector3(Math.tan(u.pitchConeAngle) * x / radius,
          Math.tan(u.pitchConeAngle) * y / radius, 1).normalize().multiplyScalar(offset === 0 ? -1 : 1);
        assert.ok(expected.distanceTo(new THREE.Vector3().fromBufferAttribute(normals, i)) < 1e-6);
      }
      assert.ok(Math.max(...levels) - Math.min(...levels) < 5e-7, 'end must lie on its back cone');
      const z = Array.from({ length: count }, (_, i) => p.getZ(offset + i));
      assert.ok(Math.max(...z) - Math.min(...z) > .01, 'end must not collapse to a flat axial face');
    }
  }
});

test('375 complete finite bevel pair clears with close engagement over a repeated tooth pitch', () => {
  const m = create({ id: 375 }), d = m.root.userData, b = d.blocks;
  const parts = [b.largeBevelGear, b.inputPinion].map(gear => [gear.userData.body, ...gear.userData.toothMeshes]);
  const samples = new Map(), fields = new Map(), bounds = new Map();
  for (const part of parts.flat()) if (!samples.has(part.geometry)) {
    samples.set(part.geometry, surfacePoints(part.geometry));
    fields.set(part.geometry, solidSurface(part.geometry));
    bounds.set(part.geometry, new THREE.Box3().setFromBufferAttribute(part.geometry.attributes.position));
  }
  let minimum = Infinity, maximumWorkingGap = 0, queries = 0;
  for (let i = 0; i <= 64; i++) {
    m.update(i / 64 * d.geometry.carrierPeriod / d.geometry.largeGearTeeth);
    m.root.updateMatrixWorld(true); let workingGap = Infinity;
    for (const [from, to] of [[0, 1], [1, 0]]) for (const a of parts[from]) for (const target of parts[to]) {
      const transform = target.matrixWorld.clone().invert().multiply(a.matrixWorld), field = fields.get(target.geometry);
      const box = bounds.get(a.geometry).clone().applyMatrix4(transform);
      if (!box.expandByScalar(.004).intersectsBox(field.box)) continue;
      for (const p of samples.get(a.geometry)) {
        const q = p.clone().applyMatrix4(transform);
        if (field.box.distanceToPoint(q) > .004) continue;
        const gap = field.signedDistance(q, .01); queries++;
        minimum = Math.min(minimum, gap); workingGap = Math.min(workingGap, gap);
        assert.ok(gap > .001, `${a.userData.role} / ${target.userData.role}: ${gap}`);
      }
    }
    assert.ok(workingGap < .002, `missing engagement at ${i}: ${workingGap}`);
    maximumWorkingGap = Math.max(maximumWorkingGap, workingGap);
  }
  console.log({ minimum, maximumWorkingGap, queries });
});
