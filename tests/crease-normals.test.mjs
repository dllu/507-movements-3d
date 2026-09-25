import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { creaseIndexedNormals, creaseLatheNormals, creaseNormalsIn } from '../src/simulation/crease-normals.js';
import { makePulley } from '../src/simulation/primitives.js';
import { bevelBodyGeometry, bevelToothGeometry } from '../src/simulation/bevel-geometry.js';
import { LaidRopeGeometry } from '../src/simulation/laid-rope.js';

// Largest angle between a vertex normal and the face normal of any triangle
// using that vertex: a flat face shaded as a dome shows tens of degrees here.
function worstFaceDeviation(geometry) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const [a, b, c, face, vertex] = Array.from({ length: 5 }, () => new THREE.Vector3());
  let worst = 0;
  for (let k = 0; k < count; k += 3) {
    const ids = [0, 1, 2].map((j) => (index ? index.getX(k + j) : k + j));
    a.fromBufferAttribute(position, ids[0]);
    b.fromBufferAttribute(position, ids[1]);
    c.fromBufferAttribute(position, ids[2]);
    face.subVectors(c, b).cross(a.sub(b));
    if (face.lengthSq() < 1e-20) continue;
    face.normalize();
    for (const id of ids) worst = Math.max(worst, face.angleTo(vertex.fromBufferAttribute(normal, id).normalize()));
  }
  return THREE.MathUtils.radToDeg(worst);
}

const annulusProfile = [
  new THREE.Vector2(0.1, -0.1), new THREE.Vector2(0.6, -0.1), new THREE.Vector2(0.6, 0.1),
  new THREE.Vector2(0.1, 0.1), new THREE.Vector2(0.1, -0.1),
];

test('a creased lathe keeps flat faces, tread and bore hard-edged', () => {
  const raw = new THREE.LatheGeometry(annulusProfile, 48);
  assert.ok(worstFaceDeviation(raw) > 40, 'three smooths the square profile corners');
  const geometry = creaseLatheNormals(new THREE.LatheGeometry(annulusProfile, 48).rotateX(Math.PI / 2));
  assert.equal(geometry.type, 'LatheGeometry');
  assert.equal(geometry.parameters.points.length, 5);
  assert.equal(geometry.attributes.position.count, 49 * 8);
  assert.ok(worstFaceDeviation(geometry) < 4, `${worstFaceDeviation(geometry)} degrees`);
});

test('finely sampled lathe curves stay smooth and mirrored lathes keep outward normals', () => {
  const points = Array.from({ length: 33 }, (_, i) => {
    const angle = -Math.PI / 2 + Math.PI * i / 32;
    return new THREE.Vector2(Math.max(0, Math.cos(angle)), Math.sin(angle));
  });
  const sphere = new THREE.LatheGeometry(points, 32);
  const count = sphere.attributes.position.count;
  creaseLatheNormals(sphere);
  assert.equal(sphere.attributes.position.count, count);
  const mirrored = new THREE.LatheGeometry(annulusProfile, 16).scale(-1, 1, 1);
  creaseLatheNormals(mirrored);
  const p = new THREE.Vector3(); const n = new THREE.Vector3();
  // A tread vertex's normal points away from the axis.
  for (let i = 0; i < mirrored.attributes.position.count; i += 1) {
    p.fromBufferAttribute(mirrored.attributes.position, i);
    n.fromBufferAttribute(mirrored.attributes.normal, i);
    if (Math.abs(Math.hypot(p.x, p.z) - 0.6) < 1e-6 && Math.abs(n.y) < 1e-6) {
      assert.ok(n.x * p.x + n.z * p.z > 0);
    }
  }
});

test('a regrouped lathe is creased without disturbing its groups', () => {
  const geometry = new THREE.LatheGeometry(annulusProfile, 64);
  const indices = Array.from(geometry.index.array);
  geometry.setIndex([...indices.slice(6), ...indices.slice(0, 6)]);
  geometry.addGroup(0, 6, 0);
  geometry.addGroup(6, indices.length - 6, 1);
  creaseLatheNormals(geometry);
  assert.equal(geometry.groups.length, 2);
  assert.equal(geometry.index.count, indices.length);
  assert.ok(worstFaceDeviation(geometry) < 5);
});

test('indexed blocks split at hard edges while coarse spheres stay smooth', () => {
  const box = mergeVertices(new THREE.BoxGeometry(1, 2, 3).deleteAttribute('normal').deleteAttribute('uv'));
  box.computeVertexNormals();
  assert.ok(worstFaceDeviation(box) > 45);
  const welded = box.attributes.position.array.slice();
  creaseIndexedNormals(box);
  assert.equal(box.attributes.position.count, 24);
  // Split copies are appended: each original vertex keeps its index, so
  // structured-grid readers (e.g. the 026 and 029 contact tests) still work.
  assert.deepEqual(Array.from(box.attributes.position.array.slice(0, welded.length)), Array.from(welded));
  assert.ok(worstFaceDeviation(box) < 1e-3);
  const sphere = new THREE.SphereGeometry(1, 16, 8);
  const count = sphere.attributes.position.count;
  creaseIndexedNormals(sphere);
  assert.equal(sphere.attributes.position.count, count);
});

test('few-sided cylinders and cones render as flat-faced prisms', () => {
  const root = new THREE.Group();
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 6));
  const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4));
  const round = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 24));
  root.add(nut, tooth, round);
  const roundCount = round.geometry.attributes.position.count;
  creaseNormalsIn(root);
  assert.ok(worstFaceDeviation(nut.geometry) < 1e-3);
  assert.ok(worstFaceDeviation(tooth.geometry) < 1e-3);
  assert.equal(nut.geometry.groups.length, 3);
  assert.equal(round.geometry.attributes.position.count, roundCount);
});

test('shared pulley and bevel builders shade flat faces flat', () => {
  const pulley = makePulley({ radius: 0.6, width: 0.27, spokes: 0, grooves: 0, bore: 0.1 });
  assert.equal(pulley.userData.tread.geometry.type, 'LatheGeometry');
  assert.ok(worstFaceDeviation(pulley.userData.tread.geometry) < 4);
  // The 40-sided hub wall stays smooth: half a segment, 4.5 degrees.
  assert.ok(worstFaceDeviation(pulley.userData.hub.geometry) < 5);
  const tooth = bevelToothGeometry({ teeth: 18, innerDistance: 0.4, outerDistance: 0.6, pitchConeAngle: Math.PI / 4, toothHeight: 0.12 });
  for (const bore of [0, 0.08]) assert.ok(worstFaceDeviation(bevelBodyGeometry(tooth, bore)) < 4);
});

test('open laid-rope strand ends are flat caps', () => {
  const rope = new LaidRopeGeometry([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0.2, 0), new THREE.Vector3(2, 0, 0.1)], 64, 0.05);
  const { position, normal } = rope.attributes;
  const index = rope.index;
  // Every cap triangle uses the strand-end centre; all three normals are axial.
  const ends = new Set();
  const perStrand = position.count / 3 - 2 * rope._laid.around;
  for (let k = 0; k < 3; k += 1) {
    const centre = k * perStrand + (rope._laid.along + 1) * rope._laid.around;
    ends.add(centre); ends.add(centre + 1);
  }
  let caps = 0;
  const n0 = new THREE.Vector3(); const n1 = new THREE.Vector3();
  for (let k = 0; k < index.count; k += 3) {
    const ids = [0, 1, 2].map((j) => index.getX(k + j));
    if (!ends.has(ids[0])) continue;
    caps += 1;
    n0.fromBufferAttribute(normal, ids[0]);
    for (const id of ids) assert.ok(n1.fromBufferAttribute(normal, id).angleTo(n0) < 1e-6);
  }
  assert.equal(caps, 3 * 2 * rope._laid.around);
  rope.setTravel(0.3);
  assert.ok(rope.attributes.position.array.every(Number.isFinite));
});
