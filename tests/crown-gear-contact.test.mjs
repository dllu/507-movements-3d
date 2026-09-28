import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

// Intersect an axial line with the actual triangle vertices, rather than
// checking against the generating formula or only a nominal pitch circle.
function faceHeight(point, geometry) {
  const { angularSteps, radialSteps, innerRadius, outerRadius, pitch } = geometry.userData;
  const angle = THREE.MathUtils.euclideanModulo(Math.atan2(point.y, point.x) + pitch / 2, pitch) - pitch / 2;
  const radius = Math.hypot(point.x, point.y);
  if (radius < innerRadius - 1e-6 || radius > outerRadius + 1e-6) return Infinity;
  const p = new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0);
  const angular = Math.min(angularSteps - 1, Math.floor((angle / pitch + 0.5) * angularSteps));
  const row = Math.floor((radius - innerRadius) / (outerRadius - innerRadius) * radialSteps);
  const positions = geometry.attributes.position;
  for (let radial = Math.max(0, row - 1); radial <= Math.min(radialSteps - 1, row + 1); radial += 1) {
    const a = radial * (angularSteps + 1) + angular;
    for (const ids of [[a, a + 1, a + angularSteps + 2], [a, a + angularSteps + 2, a + angularSteps + 1]]) {
      const vertices = ids.map((index) => new THREE.Vector3().fromBufferAttribute(positions, index));
      const heights = vertices.map((v) => v.z);
      vertices.forEach((v) => { v.z = 0; });
      const weights = new THREE.Triangle(...vertices).getBarycoord(p, new THREE.Vector3());
      if (weights && Math.min(weights.x, weights.y, weights.z) >= -1e-7) {
        return weights.x * heights[0] + weights.y * heights[1] + weights.z * heights[2];
      }
    }
  }
  return Infinity;
}

// p90: the square-toothed spur generates steeper crown flanks, so the
// conservative neighbour relief leaves up to 0.004 of working gap.
test('026 generated crown and actual square-tooth pinion clear and remain engaged over a tooth cycle', () => {
  const model = createMovementModel(catalog.movements[25]);
  const { crown, spur } = model.root.userData.blocks;
  const toothGeometry = crown.userData.faceTeeth[0].geometry;
  const pinion = spur.userData.rotor.children.find((part) => part.geometry?.type === 'ExtrudeGeometry');
  const outline = pinion.geometry.parameters.shapes.getPoints();
  const pinionPoints = [];
  // Include the unchamfered profile at the middle and near both axial ends.
  for (const z of [-0.16, 0, 0.16]) {
    for (let i = 1; i < outline.length; i += 1) {
      for (let fraction = 0; fraction < 1; fraction += 0.25) {
        const p = outline[i - 1].clone().lerp(outline[i], fraction);
        pinionPoints.push(new THREE.Vector3(p.x, p.y, z));
      }
    }
  }
  // Check real bevel/cap vertices too, including shapes that can exceed the
  // declared outline when an invalid profile produces a self-crossing bevel.
  const positions = pinion.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) pinionPoints.push(new THREE.Vector3().fromBufferAttribute(positions, i));
  for (let sample = 0; sample <= 40; sample += 1) {
    model.update(2 * Math.PI / spur.userData.teeth / 1.24 * sample / 40, 0);
    model.root.updateMatrixWorld(true);
    const toCrown = crown.userData.rotor.matrixWorld.clone().invert().multiply(pinion.matrixWorld);
    let minimumGap = Infinity;
    for (const vertex of pinionPoints) {
      const point = vertex.clone().applyMatrix4(toCrown);
      if (point.z < -0.29) continue;
      const gap = faceHeight(point, toothGeometry) - point.z;
      assert.ok(gap > -2e-6, `pose ${sample}: pinion enters the rendered crown by ${-gap}`);
      minimumGap = Math.min(minimumGap, gap);
    }
    assert.ok(minimumGap < 0.0045, `pose ${sample}: the tooth flanks remain engaged, gap ${minimumGap}`);
    const inversePinion = pinion.matrixWorld.clone().invert();
    for (const tooth of crown.userData.faceTeeth) {
      const transform = inversePinion.clone().multiply(tooth.matrixWorld);
      for (let i = 0; i < toothGeometry.userData.surfaceCount; i += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(toothGeometry.attributes.position, i).applyMatrix4(transform);
        if (Math.abs(point.z) > 0.16 || Math.hypot(point.x, point.y) >= spur.userData.outerRadius) continue;
        assert.ok(!inside(point, outline), `pose ${sample}: crown face enters the pinion solid`);
      }
    }
  }
});

test('026 crown teeth are flat-topped square teeth on a deep rim, and the spur boss runs through both faces', () => {
  const model = createMovementModel(catalog.movements[25]);
  const { crown, spur } = model.root.userData.blocks;
  const face = crown.userData.faceTeeth[0].geometry.userData;
  const tipFace = Math.min(...face.heights);
  for (let radial = 0; radial <= face.radialSteps; radial += 1) {
    const row = face.heights.slice(radial * (face.angularSteps + 1), (radial + 1) * (face.angularSteps + 1));
    const flat = row.filter((height) => height <= tipFace + 1e-9).length / face.angularSteps;
    assert.ok(flat > 0.15, `row ${radial}: the tooth keeps a flat tip (${flat} of a pitch)`);
  }
  const diameter = 2 * crown.userData.outerFaceRadius;
  assert.ok(crown.userData.bodyThickness > 0.08 * diameter, 'the crown rim is deep, as drawn');
  assert.equal(spur.userData.toothProfile, 'source-square-straight-flank');
  assert.ok(spur.userData.hubLength > spur.userData.toothHeight + 0.42 * 0.82, 'the boss stands proud of both spur faces');
  assert.ok(spur.userData.hubRadius >= 2.5 * 0.075);
});
