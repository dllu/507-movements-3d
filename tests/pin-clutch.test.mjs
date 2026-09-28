import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makePinClutch } from '../src/simulation/pin-clutch.js';
import { surfaceTriangles } from './helpers/solid-surface.mjs';
import { probePinClutchContact } from './helpers/pin-clutch-contact.mjs';

test('052 consists of closed outward solids with a bored loose driver and a continuous output shaft', () => {
  const model = makePinClutch(), seen = new Set();
  model.root.traverse((part) => {
    const geometry = part.geometry; if (!geometry || seen.has(geometry)) return; seen.add(geometry);
    const edges = new Map(), faces = surfaceTriangles(geometry); let volume = 0;
    for (const [index, face] of faces.entries()) {
      assert.ok(face.getArea() > 1e-20);
      const normalIndex = geometry.index ? geometry.index.getX(index * 3) : index * 3;
      assert.ok(face.getNormal(new THREE.Vector3()).dot(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, normalIndex)) > 0);
      volume += face.a.dot(face.b.clone().cross(face.c)) / 6;
      const keys = [face.a, face.b, face.c].map((p) => p.toArray().map((x) => Math.round(x * 1e6)).join(','));
      for (let i = 0; i < 3; i += 1) {
        const key = [keys[i], keys[(i + 1) % 3]].sort().join('/'); edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0); assert.ok([...edges.values()].every((count) => count === 2), `${geometry.type} closed edges`);
  });
  const { blocks: b, parts } = model.root.userData;
  // Only the disk and hub slide; the shaft, end barrel and feather stay put axially.
  assert.equal(parts.outputDisk.parent, b.output.userData.rotor); assert.equal(parts.outputHub.parent, b.output.userData.rotor);
  for (const part of [parts.shaft, parts.knob, parts.feather]) assert.equal(part.parent, b.spindle.userData.rotor);
  const p = model.root.userData.geometry, xs = new Set();
  for (let i = 0; i < 64; i += 1) { model.update(p.cyclePeriod * i / 64); xs.add(b.spindle.position.x); }
  assert.equal(xs.size, 1, 'the shaft does not slide');
  assert.equal(parts.studs.length, 2); assert.equal(parts.outputDisk.geometry.parameters.shapes.holes.length, 3);
  assert.ok(parts.driverBody.geometry.userData.profile.every(([, r]) => r > 0), 'the driver sleeve is genuinely hollow');
});

test('052 takes up clearance before driving and has continuous one-way motion through repeated engagements', () => {
  const model = makePinClutch(), p = model.root.userData.geometry, at = model.root.userData.stateAtTime;
  for (const time of [p.entryTime, (p.entryTime + p.lockTime) / 2, p.lockTime - 1e-8]) {
    const state = at(time); assert.equal(state.locked, false); assert.equal(state.outputAngularSpeed, 0); assert.equal(state.studNormalForce, 0);
  }
  assert.ok(at(p.lockTime).insertion > 0); assert.ok(at(p.lockTime).relativeAngle > 0);
  for (let i = 0; i < 2053; i += 1) {
    const time = (i + 0.317) * p.cyclePeriod * 4 / 2053, state = at(time), dt = 1e-6;
    assert.ok(state.outputAngularSpeed >= 0 && state.outputAngularSpeed <= p.driverAngularSpeed);
    assert.ok(Math.abs((at(time + dt).outputAngle - at(time - dt).outputAngle) / (2 * dt) - state.outputAngularSpeed) < 1e-8);
    assert.ok(Math.abs(at(time + p.cyclePeriod).outputAngle - state.outputAngle - Math.PI) < 1e-11);
    assert.ok(Math.abs(Math.hypot(state.followerX - p.leverPivotX, state.followerY - p.leverPivotY) - p.leverLength) < 1e-12);
    const upper = new THREE.Vector2(state.followerX - p.leverPivotX, state.followerY - p.leverPivotY);
    const handle = new THREE.Vector2(state.handleX - p.leverPivotX, state.handleY - p.leverPivotY);
    assert.ok(Math.abs(upper.dot(handle)) < 1e-12, 'the two lever arms are perpendicular');
    if (state.locked) {
      assert.ok(state.insertion > 0 && state.studNormalForce > 0);
      assert.ok(Math.abs(2 * state.studNormalForce * p.contactTorqueArm - p.resistingTorque) < 1e-12);
    } else assert.equal(state.studNormalForce, 0);
    if (state.outputAcceleration < 0) assert.ok(Math.abs(p.inertia * state.outputAcceleration + p.resistingTorque) < 1e-12);
  }
  for (const boundary of [p.entryTime, p.lockTime, p.insertedTime, p.withdrawalTime, p.releaseTime, p.stopTime, p.cyclePeriod]) {
    const before = at(boundary - 1e-8), after = at(boundary + 1e-8);
    assert.ok(Math.abs(after.outputAngle - before.outputAngle) < 3e-8);
    assert.ok(Math.abs(after.outputFaceX - before.outputFaceX) < 3e-8);
  }
  const expected = at(17.23);
  for (const step of [0, 1 / 240, 1 / 60, 0.05, 0.1, 0.4]) {
    model.update(0); for (let t = step; step > 0 && t < 17.23; t += step) model.update(t, step);
    model.update(17.23, step); assert.deepEqual(model.root.userData.kinematics, expected);
  }
});

test('052 loaded studs reach the real hole walls through three successive engagements', () => {
  const model = makePinClutch(), { geometry: p, parts, blocks: b } = model.root.userData;
  model.root.traverse((part) => { if (part.material) part.material.side = THREE.DoubleSide; });
  const holeCenters = parts.outputDisk.geometry.parameters.shapes.holes.slice(1).map((path) => {
    const box = new THREE.Box2().setFromPoints(path.getPoints()); return box.getCenter(new THREE.Vector2());
  });
  const times = [];
  for (let cycle = 0; cycle < 3; cycle += 1) for (let i = 0; i < 129; i += 1) {
    times.push(cycle * p.cyclePeriod + p.lockTime + (p.releaseTime - p.lockTime) * (i + 0.219) / 129);
  }
  const ray = new THREE.Raycaster(); let minimumGap = Infinity, maximumGap = 0, rays = 0;
  for (const time of times) {
    model.update(time); model.root.updateMatrixWorld(true); const s = model.root.userData.kinematics;
    const axial = (s.outputFaceX + p.studTipX) / 2;
    for (const stud of parts.studs) {
      const center = new THREE.Vector3(0, 0, axial).applyMatrix4(stud.matrixWorld);
      const centers = holeCenters.map(({ x, y }) => new THREE.Vector3(x, y, axial - s.outputFaceX).applyMatrix4(b.output.userData.rotor.matrixWorld));
      const hole = centers.sort((a, b) => a.distanceTo(center) - b.distanceTo(center))[0];
      assert.ok(center.distanceTo(hole) > 0.0099, 'loaded studs are eccentric in their clearance holes');
      const direction = center.clone().sub(hole).normalize(); ray.set(center, direction);
      const pinHit = ray.intersectObject(stud, false)[0], wallHit = ray.intersectObject(parts.outputDisk, false)[0];
      assert.ok(pinHit && wallHit); const gap = wallHit.distance - pinHit.distance;
      minimumGap = Math.min(minimumGap, gap); maximumGap = Math.max(maximumGap, gap); rays += 1;
      assert.ok(gap > 0 && gap < 0.00003, `loaded wall clearance ${gap}`);
    }
  }
  console.log(JSON.stringify({ movement: 52, loadedContactRays: rays, minimumGap, maximumGap }));
});

test('052 sleeve, selector shoe, pivots and retaining caps clear their actual moving skins', () => {
  const model = makePinClutch(), { geometry: p, blocks: b, parts } = model.root.userData;
  model.root.traverse((part) => { if (part.material) part.material.side = THREE.DoubleSide; });
  const ray = new THREE.Raycaster(); let minSleeve = Infinity, minPivot = Infinity, minFollower = Infinity, minShoe = Infinity, minCap = Infinity;
  let rays = 0;
  const gap = (origin, direction, first, second) => {
    ray.set(origin, direction); const a = ray.intersectObject(first, true)[0], c = ray.intersectObject(second, true)[0];
    assert.ok(a && c); rays += 1; return c.distance - a.distance;
  };
  for (let pose = 0; pose < 129; pose += 1) {
    model.update(p.cyclePeriod * (pose + 0.319) / 129); model.root.updateMatrixWorld(true);
    const s = model.root.userData.kinematics;
    for (let i = 0; i < 16; i += 1) {
      const theta = 2 * Math.PI * (i + 0.271) / 16, c = Math.cos(theta), sn = Math.sin(theta);
      minSleeve = Math.min(minSleeve, gap(new THREE.Vector3(-0.35, 0, 0), new THREE.Vector3(0, c, sn), parts.shaft, parts.driverBody));
      minPivot = Math.min(minPivot, gap(new THREE.Vector3(p.leverPivotX, p.leverPivotY, p.leverZ), new THREE.Vector3(c, sn, 0), parts.pivotPin, parts.leverBody));
      minFollower = Math.min(minFollower, gap(new THREE.Vector3(s.followerX, s.followerY, b.shoe.position.z), new THREE.Vector3(c, sn, 0), parts.followerPin, b.shoe));
    }
    for (const side of [-1, 1]) minShoe = Math.min(minShoe, gap(new THREE.Vector3(s.followerX, s.followerY + 0.038, b.shoe.position.z),
      new THREE.Vector3(side, 0, 0), b.shoe, parts.outputHub));
    minCap = Math.min(minCap, gap(new THREE.Vector3(p.leverPivotX + 0.055, p.leverPivotY, p.leverZ), new THREE.Vector3(0, 0, 1), parts.leverBody, parts.pivotCaps[1]));
    const followerOrigin = new THREE.Vector3(0.038, p.leverLength, 0).applyMatrix4(b.lever.matrixWorld);
    minCap = Math.min(minCap, gap(followerOrigin, new THREE.Vector3(0, 0, 1), parts.leverBody, parts.followerCap));
    minCap = Math.min(minCap, gap(new THREE.Vector3(s.followerX + 0.038, s.followerY, b.shoe.position.z),
      new THREE.Vector3(0, 0, -1), b.shoe, parts.followerBackCap));
  }
  assert.ok(minSleeve > 0.00296); assert.ok(minPivot > 0.00098); assert.ok(minFollower > 0.00098);
  assert.ok(minShoe > 0.0000098 && minShoe < 0.0000102); assert.ok(minCap > 0.00499);
  console.log(JSON.stringify({ movement: 52, hardwareRays: rays, minSleeve, minPivot, minFollower, minShoe, minCap }));
});

test('052 clears every separately moving member through entry, driving, withdrawal and coasting', () => {
  const report = probePinClutchContact(64);
  assert.equal(report.penetratingSamples, 0, JSON.stringify(report)); console.log(JSON.stringify(report));
});
