import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeUniversalJoint } from '../src/simulation/universal-joint.js';
import { surfaceTriangles } from './helpers/solid-surface.mjs';
import { probeUniversalJointContact } from './helpers/universal-joint-contact.mjs';

test('050 and 051 have closed, outward rigid solids and genuinely open pivot passages', () => {
  for (const id of [50, 51]) {
    const model = makeUniversalJoint(id), checked = new Set();
    model.root.traverse((part) => {
      const geometry = part.geometry; if (!geometry || checked.has(geometry)) return; checked.add(geometry);
      const edges = new Map(), faces = surfaceTriangles(geometry), normals = geometry.attributes.normal;
      let volume = 0;
      for (const [index, face] of faces.entries()) {
        const { a, b, c } = face, normalIndex = geometry.index ? geometry.index.getX(index * 3) : index * 3;
        assert.ok(face.getNormal(new THREE.Vector3()).dot(new THREE.Vector3().fromBufferAttribute(normals, normalIndex)) > 0,
          `${id} outward normals`);
        volume += a.dot(b.clone().cross(c)) / 6;
        const keys = [a, b, c].map((v) => v.toArray().map((x) => Math.round(x * 1e6)).join(','));
        for (let i = 0; i < 3; i += 1) {
          const key = [keys[i], keys[(i + 1) % 3]].sort().join('/'); edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      assert.ok(volume > 0); assert.ok([...edges.values()].every((count) => count === 2), `${id} ${geometry.type} closed edges`);
    });
    assert.equal(Boolean(model.root.userData.blocks.middle), id === 50);
    assert.equal(Boolean(model.root.userData.blocks.rightCross), id === 50);
  }
});

test('050 and 051 derive their speeds from perpendicular trunnions and preserve phase through repeated turns', () => {
  for (const id of [50, 51]) {
    const model = makeUniversalJoint(id), p = model.root.userData.geometry;
    const beta = id === 50 ? p.bendAngle : 2 * p.bendAngle, cosine = Math.cos(beta), sine = Math.sin(beta);
    let minimum = Infinity, maximum = -Infinity;
    for (let sample = 0; sample <= 1024; sample += 1) {
      const angle = -4 * Math.PI + 8 * Math.PI * (sample + 0.371) / 1025;
      const state = model.root.userData.stateAtInputAngle(angle), firstOutput = id === 50 ? state.middleAngle : state.outputAngle;
      assert.ok(Math.abs(Math.sin(firstOutput) * Math.cos(angle) - cosine * Math.sin(angle) * Math.cos(firstOutput)) < 1e-12);
      const firstSpeed = id === 50 ? state.middleAngularSpeed : state.outputAngularSpeed;
      assert.ok(Math.abs(firstSpeed / p.inputAngularSpeed - cosine / (1 - sine ** 2 * Math.sin(angle) ** 2)) < 1e-12);
      assert.ok(Math.abs(state.left.inputTrunnionAxis.dot(state.left.outputTrunnionAxis)) < 1e-12);
      if (state.right) {
        assert.ok(Math.abs(state.right.inputTrunnionAxis.dot(state.right.outputTrunnionAxis)) < 1e-12);
        assert.ok(Math.abs(state.outputAngle - angle) < 1e-12);
        assert.ok(Math.abs(state.outputAngularSpeed - p.inputAngularSpeed) < 1e-12);
      }
      const t = (angle - p.sourcePhase) / p.inputAngularSpeed, dt = 1e-6;
      assert.ok(Math.abs((model.root.userData.stateAtTime(t + dt).outputAngle - model.root.userData.stateAtTime(t - dt).outputAngle)
        / (2 * dt) - state.outputAngularSpeed) < 5e-9);
      const next = model.root.userData.stateAtInputAngle(angle + 2 * Math.PI);
      assert.ok(Math.abs(next.outputAngle - state.outputAngle - 2 * Math.PI) < 1e-11);
      minimum = Math.min(minimum, firstSpeed); maximum = Math.max(maximum, firstSpeed);
      assert.ok(state.outputAngularSpeed > 0);
    }
    assert.ok(minimum < p.inputAngularSpeed && maximum > p.inputAngularSpeed);
    const expected = model.root.userData.stateAtTime(11.37);
    for (const step of [0, 1 / 240, 1 / 60, 0.05, 0.1, 0.4]) {
      model.update(0); for (let time = step; step > 0 && time < 11.37; time += step) model.update(time, step);
      model.update(11.37, step); assert.ok(Math.abs(model.root.userData.kinematics.outputAngle - expected.outputAngle) < 1e-12);
    }
  }
});

test('050 and 051 keep every real pin centered in a clear bore and every retaining cap outside the fork', () => {
  for (const id of [50, 51]) {
    const model = makeUniversalJoint(id), b = model.root.userData.blocks, p = model.root.userData.geometry;
    model.root.traverse((part) => { if (part.material) part.material.side = THREE.DoubleSide; });
    const bearings = [], add = (member, eyes, cross, pinOffset) => {
      for (let i = 0; i < 2; i += 1) bearings.push({ member, eye: eyes[i], cross, pin: cross.userData.parts.pins[pinOffset + i] });
    };
    add(b.inputYoke, b.inputYoke.userData.parts.eyes, b.leftCross, 0);
    if (b.middle) {
      add(b.middle, b.middle.userData.parts.eyes.slice(0, 2), b.leftCross, 2);
      add(b.middle, b.middle.userData.parts.eyes.slice(2, 4), b.rightCross, 0);
      add(b.outputYoke, b.outputYoke.userData.parts.eyes, b.rightCross, 2);
    } else add(b.outputYoke, b.outputYoke.userData.parts.eyes, b.leftCross, 2);
    const ray = new THREE.Raycaster(); let minimumGap = Infinity, maximumGap = 0, minimumCapGap = Infinity, rays = 0;
    for (let pose = 0; pose <= 256; pose += 1) {
      model.update(p.cyclePeriod * (pose + 0.219) / 257); model.root.updateMatrixWorld(true);
      for (const { member, eye, cross, pin } of bearings) {
        const center = new THREE.Vector3(0, 0, p.trunnionRadius).applyMatrix4(eye.matrixWorld);
        const pinCenter = new THREE.Vector3(0, 0, p.trunnionRadius).applyMatrix4(pin.matrixWorld);
        assert.ok(center.distanceTo(pinCenter) < 1e-12, 'the actual mesh frames share one bearing center');
        for (let i = 0; i < 12; i += 1) {
          const theta = 2 * Math.PI * (i + 0.317) / 12;
          const direction = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0).transformDirection(eye.matrixWorld);
          ray.set(center, direction);
          const boreHit = ray.intersectObject(member, true)[0], pinHit = ray.intersectObject(cross, true)[0];
          assert.ok(boreHit && pinHit); assert.equal(boreHit.object, eye, 'the curved strap does not fill the pivot bore');
          assert.equal(pinHit.object, pin);
          const gap = boreHit.distance - pinHit.distance;
          minimumGap = Math.min(minimumGap, gap); maximumGap = Math.max(maximumGap, gap); rays += 1;
          assert.ok(gap > 0.000974 && gap < 0.001026);
        }
        const origin = new THREE.Vector3(0.049, 0, 0.76).applyMatrix4(eye.matrixWorld);
        const direction = new THREE.Vector3(0, 0, 1).transformDirection(eye.matrixWorld);
        ray.set(origin, direction);
        const forkHit = ray.intersectObject(eye, false)[0], capHit = ray.intersectObjects(cross.userData.parts.caps, false)[0];
        assert.ok(forkHit && capHit);
        const capGap = capHit.distance - forkHit.distance;
        minimumCapGap = Math.min(minimumCapGap, capGap); assert.ok(capGap > 0.00399 && capGap < 0.00401);
      }
    }
    console.log(JSON.stringify({ movement: id, boreRays: rays, minimumGap, maximumGap, minimumCapGap }));
  }
});

for (const id of [50, 51]) test(`${String(id).padStart(3, '0')} actual skins clear every separate moving member through one turn`, () => {
  const report = probeUniversalJointContact(id, 64);
  assert.equal(report.penetratingSamples, 0, JSON.stringify(report.witness));
  assert.ok(report.surfaceChecks > 1_000_000);
  console.log(JSON.stringify(report));
});
