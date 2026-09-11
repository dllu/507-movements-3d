import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

test('015 rope clears every actual grooved step and does not intersect another strand', () => {
  const model = createMovementModel(catalog.movements[14]);
  const blocks = model.root.userData.compoundBlocks;
  for (let phase = 0; phase <= 29; phase += 1) {
    model.update(model.root.userData.animationTiming.authoredCyclePeriod * phase / 29, 0);
    model.root.updateMatrixWorld(true);
    const mesh = blocks.rope.userData.mesh;
    const positions = mesh.geometry.attributes.position;
    for (const block of [blocks.top, blocks.bottom]) {
      for (const step of block.userData.groovedSteps) {
        const inverse = step.matrixWorld.clone().invert();
        const profile = step.geometry.parameters.points;
        for (let i = 0; i < positions.count; i += 1) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
          if (p.y <= profile[0].y || p.y >= profile.at(-1).y) continue;
          const next = profile.findIndex((point, index) => index > 1 && point.y >= p.y);
          const a = profile[next - 1];
          const b = profile[next];
          const radius = THREE.MathUtils.lerp(a.x, b.x, (p.y - a.y) / (b.y - a.y));
          assert.ok(Math.hypot(p.x, p.z) - radius > -0.0001,
            `phase ${phase}: rope clears the actual revolved groove, including its shoulders`);
        }
        assert.equal(step.geometry.groups.length, 2, 'one face material and one groove material keep draw calls bounded');
      }
    }
    const curve = blocks.rope.userData.curve;
    const points = curve.getSpacedPoints(1200);
    const skip = Math.ceil(0.12 / (curve.getLength() / 1200));
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + skip; j < points.length; j += 1) {
        assert.ok(points[i].distanceToSquared(points[j]) > 0.056 ** 2,
          'separate strands have room for their full rope diameter');
      }
    }
  }
});

test('015 preserves Brown’s wording and explains the fixed-anchor six-part reconstruction', () => {
  assert.match(catalog.movements[14].description, /Power as 1 to 7/);
  assert.match(catalog.movements[14].mechanicalNote, /six supporting rope parts/);
  const model = createMovementModel(catalog.movements[14]);
  const anchor = model.root.userData.attachments.anchor.clone();
  for (const time of [0, 1, 3, 8]) {
    model.update(time, 0);
    assert.ok(model.root.userData.attachments.anchor.distanceTo(anchor) < 1e-12);
    const curve = model.root.userData.compoundBlocks.rope.userData.curve;
    assert.equal(curve.curves.filter((part) => part.type === 'LineCurve3').length, 7);
    assert.ok(curve.curves.at(-1).getPoint(1).y < curve.curves.at(-1).getPoint(0).y);
  }
});

test('015 quantifies the contact-speed approximation introduced by finite fleet angles', () => {
  const model = createMovementModel(catalog.movements[14]);
  const blocks = model.root.userData.compoundBlocks;
  const contact = (time, index) => {
    model.update(time, 0);
    const curve = blocks.rope.userData.curve;
    const arc = curve.curves[index];
    return {
      point: arc.getPoint(0.5),
      distance: curve.curves.slice(0, index).reduce((sum, part) => sum + part.getLength(), 0) + arc.getLength() / 2,
    };
  };
  const delta = 1e-4;
  for (const time of [0.4, 1.1, 3.6, 7, 9.8]) {
    for (const index of [1, 3, 5, 7, 9, 11]) {
      const before = contact(time - delta, index);
      const after = contact(time + delta, index);
      model.update(time, 0);
      const state = model.root.userData.kinematics;
      const arc = blocks.rope.userData.curve.curves[index];
      const tangent = arc.getTangent(0.5);
      const ropeVelocity = after.point.sub(before.point).multiplyScalar(1 / (2 * delta))
        .addScaledVector(tangent, -(after.distance - before.distance) / (2 * delta));
      const lower = index % 4 === 1;
      const center = lower ? blocks.bottom.position : blocks.top.position;
      const surfaceVelocity = new THREE.Vector3(0, lower ? state.loadSpeed : 0, 0)
        .add(new THREE.Vector3(0, 0, state.blockAngularSpeed).cross(arc.getPoint(0.5).sub(center)));
      const error = Math.abs(surfaceVelocity.sub(ropeVelocity).dot(tangent));
      assert.ok(error < Math.abs(state.loadSpeed) * 0.03,
        `the retained rigid-groove approximation stays within 3% of load speed, error ${error}`);
    }
  }
});
