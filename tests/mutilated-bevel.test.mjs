import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeMutilatedBevelAlternator } from '../src/simulation/mutilated-bevel.js';
import { setSpin } from '../src/simulation/primitives.js';
import { prepareBevelAngularOverlap } from '../scripts/lib/bevel-angular-overlap.mjs';
import { prepareBevelSurfaces, sampleBevelPair } from '../scripts/lib/bevel-working-surfaces.mjs';

const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const dispose = model => model.root.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
const pose = (model, coordinate) => {
  const p = model.root.userData.geometry;
  model.update((coordinate - p.initialCyclePhase) * p.period);
  model.root.updateMatrixWorld(true);
  return model.root.userData.kinematics;
};

test('074 reconstructs the opposed bevel outputs and the half-toothed larger driver', () => {
  const model = makeMutilatedBevelAlternator(), d = model.root.userData, b = d.blocks, p = d.geometry;
  assert.deepEqual(Object.keys(b), ['gearA', 'gearB', 'driverC']);
  assert.deepEqual(b.gearA.userData.axis.toArray(), [-1, 0, 0]);
  assert.deepEqual(b.gearB.userData.axis.toArray(), [1, 0, 0]);
  assert.deepEqual(b.driverC.userData.axis.toArray(), [0, -1, 0]);
  assert.equal(b.gearA.userData.toothMeshes.length, 32);
  assert.equal(b.gearB.userData.toothMeshes.length, 32);
  assert.equal(b.driverC.userData.toothMeshes.length, 20);
  near(p.outputAngle + p.driverAngle, Math.PI / 2);
  near(Math.tan(p.outputAngle), p.outputTeeth / p.driverTeeth);
  near(p.driverRadius / p.outputRadius, p.driverTeeth / p.outputTeeth);
  assert.ok(p.outputInnerScale > p.driverInnerScale);
  assert.match(d.idealConstraints, /Counts and sector-end relief are reconstructed/);
  assert.match(d.idealConstraints, /bearing friction/);
  assert.equal(d.kinematics.lockedA, undefined);
  dispose(model);
});

test('074 actual tooth and integral body skins are closed, outward and nondegenerate', () => {
  const model = makeMutilatedBevelAlternator(), seen = new Set();
  model.root.traverse(mesh => {
    const g = mesh.geometry;
    if (!g || seen.has(g)) return;
    seen.add(g);
    const p = g.attributes.position, n = g.attributes.normal, edges = new Map();
    let volume = 0;
    for (let i = 0; i < (g.index?.count ?? p.count); i += 3) {
      const ids = [0, 1, 2].map(j => g.index ? g.index.getX(i + j) : i + j);
      const vertices = ids.map(j => new THREE.Vector3().fromBufferAttribute(p, j));
      const [a, b, c] = vertices, cross = b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(cross.lengthSq() > 1e-22, `${mesh.name}: degenerate triangle`);
      volume += a.dot(b.clone().cross(c)) / 6;
      const normal = ids.reduce((sum, j) => sum.add(new THREE.Vector3().fromBufferAttribute(n, j)), new THREE.Vector3());
      assert.ok(cross.dot(normal) > 0, `${mesh.name}: inward shading normal`);
      const keys = vertices.map(v => v.toArray().join(','));
      for (let j = 0; j < 3; j++) {
        const from = keys[j], to = keys[(j + 1) % 3], key = from < to ? from + '/' + to : to + '/' + from;
        const edge = edges.get(key) ?? { count: 0, winding: 0 };
        edge.count++; edge.winding += from < to ? 1 : -1; edges.set(key, edge);
      }
    }
    assert.ok(volume > 0, `${mesh.name}: positive enclosed volume`);
    assert.ok([...edges.values()].every(e => e.count === 2 && e.winding === 0), `${mesh.name}: unpaired triangle edge`);
  });
  assert.equal(seen.size, 10);
  dispose(model);
});

test('074 original heel and toe vertices and shading lie on the analytic conical ends', () => {
  const model = makeMutilatedBevelAlternator();
  for (const gear of Object.values(model.root.userData.blocks)) {
    const d = gear.userData, mesh = d.toothMeshes.find(m => !m.geometry.userData.polygons);
    const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal, count = p.count / 6;
    for (let i = 0; i < 2 * count; i++) {
      const inner = i < count, distance = inner ? d.innerDistance : d.outerDistance;
      const radius = Math.hypot(p.getX(i), p.getY(i)), tangent = Math.tan(d.pitchConeAngle);
      near(p.getZ(i) + tangent * radius, distance / Math.cos(d.pitchConeAngle) ** 2, 3e-7);
      const expected = new THREE.Vector3(tangent * p.getX(i) / radius, tangent * p.getY(i) / radius, 1)
        .normalize().multiplyScalar(inner ? -1 : 1);
      near(expected.dot(new THREE.Vector3().fromBufferAttribute(n, i)), 1, 1e-7);
    }
  }
  const cuts = model.root.userData.profile.relievedTeeth;
  assert.deepEqual(cuts.map(c => c.index), [0, 1, 18, 19]);
  assert.ok(cuts.every(c => c.metadata.polygons.length === 1));
  dispose(model);
});

test('074 arbitrary seeking preserves output phase, opposite world rotation and cycle advance', () => {
  const model = makeMutilatedBevelAlternator(), d = model.root.userData, at = d.stateAtTime;
  for (const time of [-100, -8, -.0001, 0, .371, 2.35, 7.999, 8, 37, 100]) {
    const first = at(time), next = at(time + 8), opposite = at(time + 4);
    near(next.driverAngle - first.driverAngle, -2 * Math.PI);
    near(next.angleA - first.angleA, Math.PI * 1.25);
    near(next.angleB - first.angleB, Math.PI * 1.25);
    near(opposite.angleA, first.angleB);
    model.update(time + 500); model.update(time);
    near(d.blocks.gearA.userData.rotor.rotation.z, first.angleA);
    near(d.blocks.gearB.userData.rotor.rotation.z, first.angleB);
    assert.ok(first.angularSpeedA >= -1e-12 && first.angularSpeedB >= -1e-12);
  }
  const first = pose(model, .3), last = pose(model, .4);
  near(first.angleA, last.angleA); assert.ok(last.angleB > first.angleB);
  const a = pose(model, .8), b = pose(model, .9);
  near(a.angleB, b.angleB); assert.ok(b.angleA > a.angleA);
  dispose(model);
});

test('074 every interpolated interval stays forward and within readable output speed', () => {
  const model = makeMutilatedBevelAlternator();
  for (const s of model.motion.spline.intervals) {
    const ts = [0, 1], stationary = -s.b / (3 * s.a);
    if (s.a && stationary > 0 && stationary < 1) ts.push(stationary);
    for (const t of ts) {
      const speed = (3 * s.a * t * t + 2 * s.b * t + s.c) / s.width / 8;
      assert.ok(speed > -1e-10 && speed < 1.23);
    }
  }
  near(model.root.userData.animationTiming.authoredCyclePeriod, 8);
  assert.equal(model.root.userData.minimumDisplayCycleSeconds, 8);
  assert.equal(model.root.userData.hideGround, true);
  assert.deepEqual(model.cameraDirection.toArray(), [0, 0, 10]);
  dispose(model);
});

test('074 rendered teeth admit forward drive and clear both outputs through handoffs', () => {
  const model = makeMutilatedBevelAlternator(), b = model.root.userData.blocks;
  const overlaps = [prepareBevelAngularOverlap(b.gearA, b.driverC), prepareBevelAngularOverlap(b.gearB, b.driverC)];
  for (let i = 0; i < 257; i++) {
    const u = .25 + (i + .173) / 257;
    pose(model, u);
    for (const overlap of overlaps) assert.ok(overlap().maximumArea < 1e-10, `Tooth intrusion at ${u}`);
  }
  for (const u of [.51, .57, .73, .83, .97]) {
    const state = pose(model, u);
    setSpin(b.gearA, state.angleA - 1e-5); model.root.updateMatrixWorld(true);
    assert.ok(overlaps[0]().maximumArea > 1e-11, `No pushing flank at ${u}`);
  }
  dispose(model);
});

test('074 Float32 gear, shaft and body surfaces clear each other at entry and release', () => {
  const model = makeMutilatedBevelAlternator(), b = model.root.userData.blocks;
  const prepared = Object.fromEntries(Object.entries(b).map(([name, gear]) => [name, prepareBevelSurfaces(gear)]));
  for (const u of [.225, .48749, .48769722, .488, .493, .73, .98749, .988, .9916285, .9944401, .99721574, 1.025]) {
    pose(model, u);
    for (const [first, last] of [['gearA', 'driverC'], ['gearB', 'driverC']]) {
      for (const [a, c] of [[first, last], [last, first]]) {
        assert.equal(sampleBevelPair(prepared[a], prepared[c]).inside, 0, `${a}/${c} at ${u}`);
      }
    }
    const A = new THREE.Box3().setFromObject(b.gearA), B = new THREE.Box3().setFromObject(b.gearB);
    assert.ok(A.max.x < B.min.x);
  }
  dispose(model);
});
