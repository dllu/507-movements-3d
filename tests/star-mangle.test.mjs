import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeStarMangle } from '../src/simulation/star-mangle.js';
import { solidSurface, surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const model = makeStarMangle(), { parts, geometry: p, loadedMotion } = model.root.userData;
const cache = new Map();
const surface = mesh => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, { solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) });
  return cache.get(mesh.geometry);
};
const setPath = travel => { model.root.userData.updateTravel(travel); model.root.updateMatrixWorld(true); };
const phases = Array.from({ length: 17 }, (_, i) => p.cycleTravel * (i + 0.371) / 17);
for (const start of [p.runTravel, p.returnStart]) for (const fraction of [0.07, 0.25, 0.5, 0.75, 0.93]) phases.push(start + Math.PI * fraction);

test('054 radial teeth, both guide faces and rims form closed solids with outward normals', () => {
  const seen = new Set();
  model.root.traverse(part => {
    const g = part.geometry; if (!g || seen.has(g)) return; seen.add(g);
    const edges = new Map(), directions = new Map(); let volume = 0;
    for (const [i, face] of surfaceTriangles(g).entries()) {
      assert.ok(face.getArea() > 1e-20, 'nondegenerate face');
      const normal = face.getNormal(new THREE.Vector3());
      for (let j = 0; j < 3; j += 1) {
        const index = g.index ? g.index.getX(3 * i + j) : 3 * i + j;
        assert.ok(normal.dot(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, index)) > 0, 'outward corner normal');
      }
      volume += face.a.dot(face.b.clone().cross(face.c)) / 6;
      const keys = [face.a, face.b, face.c].map(v => v.toArray().map(x => Math.round(x * 1e7)).join(','));
      for (let j = 0; j < 3; j += 1) {
        const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1); directions.set(key, (directions.get(key) ?? 0) + (a < b ? 1 : -1));
      }
    }
    assert.ok(volume > 0);
    assert.ok([...edges.values()].every(n => n === 2), 'closed edges');
    assert.ok([...directions.values()].every(n => n === 0), 'consistent winding');
  });
  assert.equal(seen.size, 21);
  assert.ok(parts.crabBlock.isMesh && !parts.bridge && !parts.stem, "A is one solid block, not a bridge and stem");
});

test('054 rendered tooth skins clear in both directions through running and crossover phases', () => {
  let checks = 0, maximumGap = 0;
  for (const travel of phases) {
    setPath(travel); let nearest = 0.001;
    for (const tooth of parts.teeth) for (const [from, to] of [[tooth, parts.pinion], [parts.pinion, tooth]]) {
      const a = surface(from), b = surface(to), transform = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      if (!a.solid.box.clone().applyMatrix4(transform).intersectsBox(b.solid.box)) continue;
      for (const v of a.points) {
        const point = v.clone().applyMatrix4(transform); checks += 1;
        if (b.solid.inside(point)) assert.ok(b.solid.distance(point) < 1e-6, `tooth penetration at ${travel}`);
        else nearest = Math.min(nearest, b.solid.distance(point, nearest));
      }
    }
    maximumGap = Math.max(maximumGap, nearest);
  }
  assert.ok(maximumGap < 0.0001, `sampled contact gap ${maximumGap}`);
  assert.ok(checks > 4_000_000);
});

test('054 exact triangle distances retain driving contact at former floating and grazing positions', () => {
  const trees = new Map();
  const tree = mesh => { if (!trees.has(mesh.geometry)) trees.set(mesh.geometry, triangleTree(mesh.geometry)); return trees.get(mesh.geometry); };
  for (const travel of [23.91508031213931, 62.05806928123896, 76.35868105864944,
    ...[p.runTravel, p.returnStart].flatMap(start => [0, 0.25, 0.5, 0.75, 1].map(f => start + Math.PI * f))]) {
    setPath(travel); const inverse = parts.pinion.matrixWorld.clone().invert(); let nearest = { distance: 0.001 };
    for (const tooth of parts.teeth) {
      const value = meshPairDistance(tree(tooth), tree(parts.pinion), inverse.clone().multiply(tooth.matrixWorld), nearest.distance);
      if (value.distance < nearest.distance) nearest = value;
    }
    assert.ok(nearest.distance > 1e-7 && nearest.distance < 0.00004, `exact contact gap ${nearest.distance} at ${travel}`);
    const normal = new THREE.Vector3().fromArray(nearest.witness.a).sub(new THREE.Vector3().fromArray(nearest.witness.b)).normalize();
    const point = new THREE.Vector3().fromArray(nearest.witness.b);
    assert.ok(normal.dot(new THREE.Vector3(-point.y, point.x, 0)) > 0.04, 'the first contact transmits positive input torque');
  }
});

test('054 constant input rotation produces continuous, repeatable wheel and bearing motion', () => {
  const epsilon = 1e-6;
  for (let i = 0; i < 2048; i += 1) {
    const t = p.cycleDuration * (i + 0.413) / 2048;
    const before = model.root.userData.stateAtTime(t - epsilon), state = model.root.userData.stateAtTime(t), after = model.root.userData.stateAtTime(t + epsilon);
    assert.ok(state.inputDerivative > 0.65);
    assert.ok(Math.abs((after.pinionAngle - before.pinionAngle) / (2 * epsilon) - p.inputSpeed) < 1e-7);
    assert.ok(Math.abs((after.wheelAngle - before.wheelAngle) / (2 * epsilon) - state.wheelAngularSpeed) < 2e-5);
    assert.ok(Math.abs((after.centerY - before.centerY) / (2 * epsilon) - state.centerVelocityY) < 2e-5);
    assert.ok(Math.abs((after.centerZ - before.centerZ) / (2 * epsilon) - state.centerVelocityZ) < 2e-5);
    assert.ok(Math.abs(state.centerY ** 2 - state.centerZ ** 2 - (p.wheelRadius ** 2 - p.pinionRadius ** 2)) < 2e-12);
  }
  for (const start of [p.runTravel, p.returnStart]) {
    const state = loadedMotion.atInputTravel(loadedMotion.inputAtPath(start + Math.PI / 2));
    assert.ok(Math.abs(state.wheelAngularSpeed) < 1e-10, 'the wheel stops before reversing');
  }
  for (const t of [-13.7, 0, 7.13, 58.29]) {
    model.update(t); const before = [parts.pinion, parts.teeth[7]].map(mesh => { model.root.updateMatrixWorld(true); return mesh.matrixWorld.clone(); });
    model.update(t + p.cycleDuration); model.root.updateMatrixWorld(true);
    [parts.pinion, parts.teeth[7]].forEach((mesh, i) => assert.ok(mesh.matrixWorld.elements.every((v, j) => Math.abs(v - before[i].elements[j]) < 1e-10)));
    model.update(t - 1, 0.2); model.update(t, 0.01); model.root.updateMatrixWorld(true);
    assert.ok(parts.pinion.matrixWorld.elements.every((v, j) => Math.abs(v - before[0].elements[j]) < 1e-10), 'seeking and frame order do not change the result');
  }
});

test('054 each crossover has two physical collar-retaining faces', () => {
  const zAxis = new THREE.Vector3(0, 0, 1); parts.collar.material.side = THREE.DoubleSide;
  for (const [index, start] of [p.runTravel, p.returnStart].entries()) for (const fraction of [0.031, 0.125, 0.25, 0.375, 0.4999, 0.5001, 0.625, 0.75, 0.875, 0.969]) {
    const a = Math.PI * fraction; setPath(start + a); const state = model.root.userData.kinematics;
    for (const guide of [parts.crabEnds[index], parts.crabReturns[index]]) {
      const { centerAt, guideSide, terminal } = guide.geometry.userData;
      const derivative = centerAt(a + 1e-5).sub(centerAt(a - 1e-5));
      const normal = new THREE.Vector3(0, -derivative.z, derivative.y).normalize().multiplyScalar(guideSide).applyAxisAngle(zAxis, state.wheelAngle + terminal);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, state.centerY - 0.265, state.centerZ), normal);
      const hit = ray.intersectObject(guide, false)[0], collarHit = ray.intersectObject(parts.collar, false).at(-1);
      assert.ok(hit && collarHit, 'both real surfaces intersect the contact ray');
      assert.ok(hit.distance - collarHit.distance > 0.00007 && hit.distance - collarHit.distance < 0.00014, 'the collar fits the captured slot');
    }
  }
});
