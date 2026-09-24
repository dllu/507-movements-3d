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

test('024 extruded square-tooth outlines pass through the mesh without penetration and with bounded backlash', () => {
  const model = createMovementModel(catalog.movements[23]);
  const { driver, driven } = model.root.userData.blocks;
  const gears = [driver, driven];
  const meshes = gears.map((gear) => gear.userData.rotor.children.find((part) => part.geometry?.type === 'ExtrudeGeometry'));
  const contours = meshes.map((mesh) => mesh.geometry.parameters.shapes.getPoints());
  let overallMinimum = Infinity;
  for (let sample = 0; sample <= 40; sample += 1) {
    const time = 2 * Math.PI / driver.userData.teeth / model.root.userData.kinematics.driverAngularSpeed * sample / 40;
    model.update(time, 0);
    model.root.updateMatrixWorld(true);
    const outlines = contours.map((points, index) => points.map((p) =>
      new THREE.Vector3(p.x, p.y, 0).applyMatrix4(meshes[index].matrixWorld)));
    let minimumGap = Infinity;
    for (let side = 0; side < 2; side += 1) {
      const other = gears[1 - side];
      const polygon = outlines[1 - side];
      for (const point of outlines[side]) {
        if (point.distanceTo(other.position) > other.userData.outerRadius + 0.001) continue;
        assert.ok(!inside(point, polygon), `sample ${sample}: the two tooth solids do not overlap`);
        for (let i = 1; i < polygon.length; i += 1) {
          const segment = new THREE.Line3(polygon[i - 1], polygon[i]);
          minimumGap = Math.min(minimumGap, point.distanceTo(segment.closestPointToPoint(point, true, new THREE.Vector3())));
        }
      }
    }
    overallMinimum = Math.min(overallMinimum, minimumGap);
    assert.ok(minimumGap < 0.02, `sample ${sample}: the square teeth stay engaged within their backlash (${minimumGap})`);
  }
  // Straight flanks are not conjugate: the prescribed ratio keeps a small
  // running clearance, closing to a few thousandths once per tooth pitch.
  assert.ok(overallMinimum > 0.002 && overallMinimum < 0.008, `square-tooth closest approach ${overallMinimum}`);
});

test('034 internal involutes mesh without entering either tooth solid over a complete tooth pitch', () => {
  const model = createMovementModel(catalog.movements[33]);
  const { pinion, ring } = model.root.userData.blocks;
  const pinionMesh = pinion.userData.rotor.children.find((p) => p.geometry?.type === 'ExtrudeGeometry');
  const ringMesh = ring.userData.rotor.children.find((p) => p.geometry?.type === 'ExtrudeGeometry');
  const pinionOutline = pinionMesh.geometry.parameters.shapes.getPoints();
  const ringHole = ringMesh.geometry.parameters.shapes.holes[0].getPoints();
  assert.equal(pinion.userData.teeth, 20);
  assert.equal(ring.userData.teeth, 50);
  for (let sample = 0; sample <= 40; sample += 1) {
    model.update(2 * Math.PI / pinion.userData.teeth / 1.2 * sample / 40, 0);
    model.root.updateMatrixWorld(true);
    const outlines = [pinionOutline, ringHole].map((points, index) => points.map((p) =>
      new THREE.Vector3(p.x, p.y, 0).applyMatrix4([pinionMesh, ringMesh][index].matrixWorld)));
    let minimumGap = Infinity;
    for (const point of outlines[0]) {
      assert.ok(inside(point, outlines[1]), `pose ${sample}: pinion outline enters the ring solid`);
      if (point.length() < ring.userData.tipRadius - 0.001) continue;
      for (let i = 1; i < outlines[1].length; i += 1) {
        const segment = new THREE.Line3(outlines[1][i - 1], outlines[1][i]);
        minimumGap = Math.min(minimumGap, point.distanceTo(segment.closestPointToPoint(point, true, new THREE.Vector3())));
      }
    }
    for (const point of outlines[1]) {
      assert.ok(!inside(point, outlines[0]), `pose ${sample}: ring outline enters the pinion solid`);
    }
    assert.ok(minimumGap < 0.0015, `pose ${sample}: tooth flanks remain engaged (${minimumGap})`);
    // A bevel that expands into the bore can collide even when its source
    // shape is correct. Check the actual mesh vertices in the mating plane.
    for (const [mesh, polygon, isPinion] of [[pinionMesh, outlines[1], true], [ringMesh, outlines[0], false]]) {
      const vertices = mesh.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
        if (Math.abs(point.z) > 0.14 + 1e-6) continue;
        assert.equal(inside(point, polygon), isPinion, `pose ${sample}: the bevel enters the mating tooth material`);
      }
    }
  }
});
