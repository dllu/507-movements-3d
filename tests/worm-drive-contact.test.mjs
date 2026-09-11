import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { wormWheelGeometry } from '../src/simulation/worm-gear-geometry.js';
import { wormCut } from '../src/data/contact-profiles.js';
import { surfaceTriangles } from './helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

test('031 baked teeth reproduce the corrected runtime cylindrical hob without neighbor erosion', () => {
  const parameters = JSON.parse(wormCut.key);
  assert.equal(parameters.teeth, 29);
  const regenerated = wormWheelGeometry(parameters, { regenerate: true });
  assert.deepEqual(regenerated.userData.radii, wormCut.radii);
  assert.equal(regenerated.userData.angularSteps, 256);
  assert.equal(regenerated.userData.axialSteps, 32);
  assert.equal(regenerated.userData.phaseSteps, 1600);
  const baked = wormWheelGeometry(parameters);
  assert.deepEqual(baked.attributes.position.array, regenerated.attributes.position.array);
  assert.deepEqual(baked.index.array, regenerated.index.array);
});

test('031 actual loaded-flank normals deliver positive wheel torque with the synchronized power ratio', () => {
  const model = createMovementModel(catalog.movements[30]);
  const { blocks, geometry: p } = model.root.userData;
  const worm = blocks.worm.userData.thread, wheel = blocks.wheel.userData.toothMesh;
  const wormTree = triangleTree(worm.geometry);
  const faces = surfaceTriangles(wheel.geometry).filter(face => {
    const q = face.getMidpoint(new THREE.Vector3()), n = face.getNormal(new THREE.Vector3());
    return -q.clone().cross(n).z > 0.1 * Math.hypot(q.x, q.y);
  });
  const workingTree = triangleTree(new THREE.BufferGeometry().setFromPoints(faces.flatMap(face => [face.a, face.b, face.c])));
  for (let i = 0; i < 9; i++) {
    model.update(2 * Math.PI / 2.2 * (i + 0.173) / 9);
    model.root.updateMatrixWorld(true);
    const closest = meshPairDistance(wormTree, workingTree, wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld), 0.01);
    assert.ok(closest.witness && closest.distance > 1e-6 && closest.distance < 0.00004,
      `pose ${i}: a finite positive loaded-flank clearance`);
    const a = new THREE.Vector3().fromArray(closest.witness.a).applyMatrix4(wheel.matrixWorld);
    const b = new THREE.Vector3().fromArray(closest.witness.b).applyMatrix4(wheel.matrixWorld);
    const force = b.clone().sub(a).normalize();
    const outputTorque = b.clone().sub(p.wheelCenter).cross(force).dot(p.wheelAxis);
    const inputTorque = a.clone().sub(p.wormCenter).cross(force.clone().negate()).dot(p.wormAxis);
    const state = model.root.userData.kinematics;
    const inputPower = inputTorque * state.wormAngularSpeed, outputPower = outputTorque * state.wheelAngularSpeed;
    assert.ok(outputTorque > 0, `pose ${i}: the working normal drives the output`);
    assert.ok(Math.abs(inputPower + outputPower) / Math.max(Math.abs(inputPower), Math.abs(outputPower)) < 0.02,
      `pose ${i}: actual force moments agree with the motion ratio`);
  }
});

function renderedWheelRadius(point, geometry) {
  const { circumferenceSteps, axialSteps, depth, pitch } = geometry.userData;
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

test('031 has a closed, axially straight-flanked screw with integral end caps', () => {
  const model = createMovementModel(catalog.movements[30]);
  const mesh = model.root.userData.blocks.worm.userData.thread;
  const geometry = mesh.geometry;
  const { pitch, pitchRadius, pressureAngle, tipRadius, rootRadius, length } = geometry.userData;
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const edges = new Map();
  const key = (p) => [p.x, p.y, p.z].map((v) => Math.round(v * 1e9)).join(',');
  for (let i = 0; i < positions.count; i += 3) {
    const points = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(positions, i + offset));
    const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]));
    if (normal.lengthSq() < 1e-22) continue;
    for (let j = 0; j < 3; j += 1) {
      const a = key(points[j]);
      const b = key(points[(j + 1) % 3]);
      const edge = a < b ? `${a}/${b}` : `${b}/${a}`;
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
    const expected = new THREE.Vector3().fromBufferAttribute(normals, i);
    assert.ok(normal.dot(expected) > 0, 'winding follows the outward cap/flank normal');
    for (const point of points) {
      assert.ok(Math.abs(point.z) <= length / 2 + 1e-7);
      const radius = Math.hypot(point.x, point.y);
      if (radius < rootRadius - 1e-5 || Math.abs(point.z) > length / 2 - 1e-6) continue;
      const axial = point.z - Math.atan2(point.y, point.x) * pitch / (2 * Math.PI);
      const offset = Math.abs(THREE.MathUtils.euclideanModulo(axial + pitch / 2, pitch) - pitch / 2);
      const sectionRadius = THREE.MathUtils.clamp(pitchRadius + (pitch / 4 - offset) / Math.tan(pressureAngle), rootRadius, tipRadius);
      assert.ok(Math.abs(radius - sectionRadius) < 2e-6, 'screw vertices follow the specified axial trapezoid');
    }
  }
  for (const count of edges.values()) assert.equal(count, 2, 'every nondegenerate boundary edge has two incident faces');
});

test('031 generated worm wheel clears both screw flanks and remains engaged throughout one input turn', () => {
  const model = createMovementModel(catalog.movements[30]);
  const { worm, wheel } = model.root.userData.blocks;
  const thread = worm.userData.thread;
  const wheelMesh = wheel.userData.toothMesh;
  const { pitchRadius, pitch, tipRadius, rootRadius, pressureAngle, length } = thread.geometry.userData;
  const wheelPositions = wheelMesh.geometry.attributes.position;
  const threadPositions = thread.geometry.attributes.position;
  const wheelSamples = [];
  for (let i = 0; i < wheelPositions.count; i += 1) {
    wheelSamples.push(new THREE.Vector3().fromBufferAttribute(wheelPositions, i));
  }
  const wheelIndices = wheelMesh.geometry.index;
  const flankIndexCount = wheelMesh.geometry.userData.axialSteps
    * wheelMesh.geometry.userData.circumferenceSteps * 6;
  for (let i = 0; i < flankIndexCount; i += 3) {
    const center = new THREE.Vector3();
    for (let j = 0; j < 3; j += 1) {
      center.add(new THREE.Vector3().fromBufferAttribute(wheelPositions, wheelIndices.getX(i + j)));
    }
    wheelSamples.push(center.multiplyScalar(1 / 3));
  }
  const threadSamples = [];
  for (let i = 0; i < threadPositions.count; i += 3) {
    const vertices = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(threadPositions, i + j));
    threadSamples.push(...vertices, vertices[0].clone().lerp(vertices[1], 0.5),
      vertices[1].clone().lerp(vertices[2], 0.5), vertices[2].clone().lerp(vertices[0], 0.5),
      vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1 / 3));
  }
  for (let phase = 0; phase <= 64; phase += 1) {
    model.update(2 * Math.PI / 2.2 * phase / 64, 0);
    model.root.updateMatrixWorld(true);
    const toWheel = wheelMesh.matrixWorld.clone().invert().multiply(thread.matrixWorld);
    for (const sample of threadSamples) {
      const point = sample.clone().applyMatrix4(toWheel);
      if (Math.abs(point.z) > wheel.userData.depth / 2 || Math.hypot(point.x, point.y) > wheel.userData.outerRadius + 0.005) continue;
      const gap = Math.hypot(point.x, point.y) - renderedWheelRadius(point, wheelMesh.geometry);
      assert.ok(gap >= -1e-6, `phase ${phase}: an actual screw vertex enters the wheel by ${-gap}`);
    }
    const toWorm = thread.matrixWorld.clone().invert().multiply(wheelMesh.matrixWorld);
    let closestGap = Infinity;
    const closest = new THREE.Vector3();
    const closestNormal = new THREE.Vector3();
    for (const sample of wheelSamples) {
      const point = sample.clone().applyMatrix4(toWorm);
      const radius = Math.hypot(point.x, point.y);
      if (Math.abs(point.z) > length / 2 || radius > tipRadius + 0.01) continue;
      const axial = point.z - Math.atan2(point.y, point.x) * pitch / (2 * Math.PI);
      const signedOffset = THREE.MathUtils.euclideanModulo(axial + pitch / 2, pitch) - pitch / 2;
      const offset = Math.abs(signedOffset);
      const sectionRadius = THREE.MathUtils.clamp(pitchRadius + (pitch / 4 - offset) / Math.tan(pressureAngle), rootRadius, tipRadius);
      const gap = radius - sectionRadius;
      assert.ok(gap >= -1e-6, `phase ${phase}: an actual wheel vertex enters the screw by ${-gap}`);
      const slope = sectionRadius > rootRadius && sectionRadius < tipRadius
        ? -Math.sign(signedOffset) / Math.tan(pressureAngle) : 0;
      const cosine = point.x / radius;
      const sine = point.y / radius;
      const normal = new THREE.Vector3(cosine - slope * pitch / (2 * Math.PI * radius) * sine,
        sine + slope * pitch / (2 * Math.PI * radius) * cosine, -slope);
      const normalGap = gap / normal.length();
      // A tangent extrapolated past the crest is not a point on the finite
      // flank. Select contact candidates inside its working radial interval.
      if (radius < tipRadius - 0.01 && sectionRadius > rootRadius + 0.01 && normalGap < closestGap) {
        closestGap = normalGap;
        closest.copy(point);
        closestNormal.copy(normal).normalize();
      }
    }
    const origin = closest.clone().applyMatrix4(thread.matrixWorld);
    const towardFlank = closestNormal.negate().transformDirection(thread.matrixWorld);
    const hits = new THREE.Raycaster(origin, towardFlank, 0, 0.03).intersectObject(thread, false);
    assert.ok(hits.length > 0 && hits[0].distance < 0.004,
      `phase ${phase}: an actual wheel vertex remains within 0.004 of a rendered screw flank (${hits[0]?.distance})`);
  }
});
