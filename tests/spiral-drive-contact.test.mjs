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
  const a = axial * stride + angular;
  const origin = new THREE.Vector3(0, 0, point.z);
  const direction = new THREE.Vector3(point.x, point.y, 0).normalize();
  const ray = new THREE.Ray(origin, direction);
  for (const ids of [[a, a + 1, a + stride + 1], [a, a + stride + 1, a + stride]]) {
    const vertices = ids.map((i) => new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i));
    const hit = ray.intersectTriangle(...vertices, false, new THREE.Vector3());
    if (hit) return Math.hypot(hit.x, hit.y);
  }
  throw new Error('The wheel surface must close around every radial ray.');
}

function distanceToSpiral(point, disk, closestPoint = null) {
  const { spiralStartAngle, spiralStartRadius, spiralLead, threadZ } = disk.userData;
  const guess = THREE.MathUtils.euclideanModulo(Math.atan2(point.y, point.x) - spiralStartAngle, 2 * Math.PI) / (2 * Math.PI);
  let minimum = Infinity;
  for (const start of [guess, 0, 1]) {
    let progress = start;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const angle = spiralStartAngle + progress * 2 * Math.PI;
      const radius = spiralStartRadius + progress * spiralLead;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const x = radius * c - point.x;
      const y = radius * s - point.y;
      const dx = spiralLead * c - 2 * Math.PI * radius * s;
      const dy = spiralLead * s + 2 * Math.PI * radius * c;
      const ddx = -4 * Math.PI * spiralLead * s - 4 * Math.PI ** 2 * radius * c;
      const ddy = 4 * Math.PI * spiralLead * c - 4 * Math.PI ** 2 * radius * s;
      progress = THREE.MathUtils.clamp(progress - (x * dx + y * dy) / (dx * dx + dy * dy + x * ddx + y * ddy), 0, 1);
    }
    const radius = spiralStartRadius + progress * spiralLead;
    const angle = spiralStartAngle + progress * 2 * Math.PI;
    const distance = Math.hypot(point.x - radius * Math.cos(angle), point.y - radius * Math.sin(angle), point.z - threadZ);
    if (distance < minimum) {
      minimum = distance;
      closestPoint?.set(radius * Math.cos(angle), radius * Math.sin(angle), threadZ);
    }
  }
  return minimum;
}

test('029 meshes with its round spiral, including the open-end handoff, and clears the disk', () => {
  const model = createMovementModel(catalog.movements[28]);
  const { disk, gear } = model.root.userData.blocks;
  const wheel = gear.userData.toothMesh;
  const phases = [...Array.from({ length: 65 }, (_, i) => i / 64), 0.747, 0.749, 0.751, 0.753];
  for (const phase of phases) {
    model.update(2 * Math.PI / 1.16 * phase, 0);
    model.root.updateMatrixWorld(true);
    const inverseWheel = wheel.matrixWorld.clone().invert();
    for (const part of [disk.userData.thread, ...disk.userData.threadCaps]) {
      const transform = inverseWheel.clone().multiply(part.matrixWorld);
      const positions = part.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(transform);
        if (Math.abs(point.z) > 0.1 || Math.hypot(point.x, point.y) > gear.userData.outerRadius + 0.006) continue;
        const gap = Math.hypot(point.x, point.y) - renderedWheelRadius(point, wheel.geometry);
        assert.ok(gap > -1e-6, `phase ${phase}: actual thread enters the driven wheel by ${-gap}`);
      }
    }
    const toDisk = disk.userData.rotor.matrixWorld.clone().invert().multiply(wheel.matrixWorld);
    const positions = wheel.geometry.attributes.position;
    let closestDistance = Infinity;
    const closestVertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(toDisk);
      assert.ok(point.z > 0.12, 'the real tooth surface clears the disk face');
      if (point.z > disk.userData.threadZ + disk.userData.ridgeRadius + 0.002) continue;
      const distance = distanceToSpiral(point, disk);
      assert.ok(distance >= disk.userData.ridgeRadius - 1e-6,
        `phase ${phase}: the wheel surface enters the continuous round thread`);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestVertex.copy(point);
      }
    }
    const centerlinePoint = new THREE.Vector3();
    distanceToSpiral(closestVertex, disk, centerlinePoint);
    const origin = closestVertex.applyMatrix4(disk.userData.rotor.matrixWorld);
    const direction = centerlinePoint.applyMatrix4(disk.userData.rotor.matrixWorld).sub(origin).normalize();
    const hits = new THREE.Raycaster(origin, direction, 0, 0.1)
      .intersectObjects([disk.userData.thread, ...disk.userData.threadCaps], false);
    assert.ok(hits.length > 0 && hits[0].distance < 0.004,
      `phase ${phase}: an actual wheel vertex is within 0.004 of the rendered thread surface`);
    const state = model.root.userData.kinematics;
    assert.ok(Math.abs(state.threadRadialSpeed - state.gearPitchSurfaceVelocity.x) < 1e-12,
      'the thread advance and mating pitch point move in the same direction');
  }
});
