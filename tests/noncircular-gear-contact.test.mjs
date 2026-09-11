import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { rackGeneratedOutline } from '../src/simulation/noncircular-gear-geometry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function radiusAt(point, polygon) {
  const count = polygon.length - 1;
  const angle = THREE.MathUtils.euclideanModulo(Math.atan2(point.y, point.x), 2 * Math.PI);
  const index = Math.min(count - 1, Math.floor(angle / (2 * Math.PI) * count));
  const a = polygon[index];
  const b = polygon[index + 1];
  const length = Math.hypot(point.x, point.y);
  return (a.x * b.y - a.y * b.x) / (point.x / length * (b.y - a.y) - point.y / length * (b.x - a.x));
}

function distanceToOutline(point, polygon) {
  const p = new THREE.Vector2(point.x, point.y);
  const count = polygon.length - 1;
  const angle = THREE.MathUtils.euclideanModulo(Math.atan2(p.y, p.x), 2 * Math.PI);
  const index = Math.floor(angle / (2 * Math.PI) * count);
  let distance = Infinity;
  for (const offset of [-1, 0, 1]) {
    const i = THREE.MathUtils.euclideanModulo(index + offset, count);
    const a = polygon[i];
    const b = polygon[i + 1];
    const edge = b.clone().sub(a);
    const progress = THREE.MathUtils.clamp(p.clone().sub(a).dot(edge) / edge.lengthSq(), 0, 1);
    distance = Math.min(distance, p.distanceTo(a.clone().addScaledVector(edge, progress)));
  }
  return distance;
}

test('a circular blank reduces the rack generator to the standard 20-degree involute flanks', () => {
  const pitchPoints = Array.from({ length: 720 }, (_, i) =>
    new THREE.Vector2(Math.cos(i * Math.PI / 360), Math.sin(i * Math.PI / 360)));
  const cut = rackGeneratedOutline({ pitchPoints, teeth: 20, contactPointIndex: 0, toothAtContact: true });
  const polygon = [...cut.points, cut.points[0]];
  const pressureAngle = Math.PI / 9;
  const baseRadius = Math.cos(pressureAngle);
  for (const radius of [1.015, 1.045, 1.075]) {
    const parameter = Math.sqrt((radius / baseRadius) ** 2 - 1);
    const involute = parameter - Math.atan(parameter);
    const halfAngle = Math.PI / 40 + Math.tan(pressureAngle) - pressureAngle - involute;
    for (const side of [-1, 1]) {
      const generatedRadius = radiusAt(new THREE.Vector2(Math.cos(halfAngle), side * Math.sin(halfAngle)), polygon);
      assert.ok(generatedRadius <= radius + 0.00002, 'the relieved cut stays inside the theoretical involute');
      assert.ok(generatedRadius >= radius - 0.0025, 'working flanks match the involute within the cutting clearance');
    }
  }
});

for (const id of [30, 33, 35]) {
  test(`${String(id).padStart(3, '0')} rack-generated tooth solids clear and remain engaged over a full variable-speed cycle`, () => {
    const model = createMovementModel(catalog.movements[id - 1]);
    const blocks = model.root.userData.blocks;
    const driver = blocks.driver ?? blocks.ellipse;
    const driven = blocks.driven ?? blocks.pinion;
    const meshes = [driver, driven].map((g) => g.userData.rotor.children.find((p) => p.userData.rackGeneratedGear));
    const outlines = meshes.map((mesh) => mesh.geometry.parameters.shapes.getPoints());
    const outerRadii = outlines.map((points) => Math.max(...points.map((p) => p.length())));
    for (const [index, mesh] of meshes.entries()) {
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i);
        const length = Math.hypot(point.x, point.y);
        if (length < 0.001) continue;
        // Use actual distance to the polygon for Float32 boundary rounding;
        // radial error alone is amplified at almost-radial tooth flanks.
        assert.ok(length <= radiusAt(point, outlines[index])
          || distanceToOutline(point, outlines[index]) < 2e-7,
          'actual bevel and cap vertices stay within their generated solid outline');
      }
    }
    for (let sample = 0; sample <= 191; sample += 1) {
      model.update(model.root.userData.animationTiming.authoredCyclePeriod * sample / 191, 0);
      model.root.updateMatrixWorld(true);
      let closest = Infinity;
      for (let side = 0; side < 2; side += 1) {
        const transform = meshes[1 - side].matrixWorld.clone().invert().multiply(meshes[side].matrixWorld);
        for (const point of outlines[side]) {
          const local = new THREE.Vector3(point.x, point.y, 0).applyMatrix4(transform);
          const length = Math.hypot(local.x, local.y);
          if (length > outerRadii[1 - side] + 0.005) continue;
          const gap = length - radiusAt(local, outlines[1 - side]);
          assert.ok(gap > -1e-6, `pose ${sample}: a rendered tooth outline enters its mate by ${-gap}`);
          closest = Math.min(closest, gap);
        }
      }
      assert.ok(closest < 0.0025, `pose ${sample}: generated flanks stay engaged (${closest})`);
    }
  });
}
