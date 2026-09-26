import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function surfaceSamples(mesh) {
  const position = mesh.geometry.attributes.position;
  const index = mesh.geometry.index;
  const points = Array.from({ length: position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(position, i));
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const a = points[index ? index.getX(i) : i];
    const b = points[index ? index.getX(i + 1) : i + 1];
    const c = points[index ? index.getX(i + 2) : i + 2];
    for (const weights of [[1/3, 1/3, 1/3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]]) {
      points.push(a.clone().multiplyScalar(weights[0]).addScaledVector(b, weights[1]).addScaledVector(c, weights[2]));
    }
  }
  return points;
}

test('037 conical teeth and cut studs clear the opposite rotating solids', () => {
  const model = createMovementModel(catalog.movements[36]);
  const { fullFaceTeeth, studs, toothedCone, studCone } = model.root.userData.blocks;
  const g = model.root.userData.geometry;
  const outline = toothedCone.userData.unitOutline;
  const count = outline.length, turn = 2 * Math.PI;
  const headPoints = studs.map(surfaceSamples);
  const toothPoints = fullFaceTeeth.map(surfaceSamples);
  let minStudClearance = Infinity, minBodyClearance = Infinity, maxWorkingGap = 0;
  const p = new THREE.Vector3();
  for (let sample = 0; sample < 128; sample += 1) {
    model.update(g.cycleDuration * (sample + 0.371) / 128, 0);
    model.root.updateMatrixWorld(true);
    const leftInverse = toothedCone.userData.rotor.matrixWorld.clone().invert();
    const rightInverse = studCone.userData.rotor.matrixWorld.clone().invert();
    let workingGap = Infinity;
    for (const [i, stud] of studs.entries()) {
      const transform = leftInverse.clone().multiply(stud.matrixWorld);
      for (const point of headPoints[i]) {
        p.copy(point).applyMatrix4(transform);
        const radius = Math.hypot(p.x, p.y);
        const pitchRadius = g.meanPitchRadius + g.radiusSlope * p.z;
        if (radius > pitchRadius * (1 + 2 / g.toothedConeTeeth) + 0.25) continue;
        const angle = THREE.MathUtils.euclideanModulo(Math.atan2(p.y, p.x), turn);
        const col = Math.floor(angle / turn * count);
        const a = outline[col], b = outline[(col + 1) % count];
        const surface = (a.x * b.y - a.y * b.x) * pitchRadius
          / (p.x / radius * (b.y - a.y) - p.y / radius * (b.x - a.x));
        const clearance = radius - surface;
        minStudClearance = Math.min(minStudClearance, clearance);
        workingGap = Math.min(workingGap, clearance);
      }
    }
    maxWorkingGap = Math.max(maxWorkingGap, workingGap);
    for (const [i, tooth] of fullFaceTeeth.entries()) {
      const transform = rightInverse.clone().multiply(tooth.matrixWorld);
      for (const point of toothPoints[i]) {
        p.copy(point).applyMatrix4(transform);
        const bodyRadius = THREE.MathUtils.lerp(g.studBodyBottomRadius, g.studBodyTopRadius,
          (p.z + g.coneHalfHeight) / (2 * g.coneHalfHeight));
        minBodyClearance = Math.min(minBodyClearance, Math.hypot(p.x, p.y) - bodyRadius);
      }
    }
  }
  // Pass 65 seats the stud body just outside the stub teeth.
  assert.ok(minBodyClearance > 0.01, `tooth/body clearance: ${minBodyClearance}`);
  assert.ok(minStudClearance >= -0.000002, `stud/tooth clearance: ${minStudClearance}`);
  // Keep the unresolved engagement visible. A clearance cut is not evidence
  // that every pose has a torque-transmitting contact.
  assert.equal(model.root.userData.contactValidation.status, 'incomplete');
  console.log(JSON.stringify({ minStudClearance, minBodyClearance, maxWorkingGap }));
});
