import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeReversingClutch } from '../src/simulation/reversing-clutch.js';
import { surfaceTriangles } from './helpers/solid-surface.mjs';
import { probeReversingClutchContact } from './helpers/reversing-clutch-contact.mjs';
import { probeReversingCrownContact } from './helpers/reversing-crown-contact.mjs';
import { probeReversingBevelContact } from './helpers/reversing-bevel-contact.mjs';

test('053 has closed outward solids, loose bored bevel gears and two keyed triangular crowns', () => {
  const model = makeReversingClutch(), seen = new Set();
  model.root.traverse((part) => {
    const g = part.geometry; if (!g || seen.has(g)) return; seen.add(g);
    const edges = new Map(); let volume = 0;
    for (const [i, face] of surfaceTriangles(g).entries()) {
      assert.ok(face.getArea() > 1e-20);
      const index = g.index ? g.index.getX(i * 3) : i * 3;
      assert.ok(face.getNormal(new THREE.Vector3()).dot(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, index)) > 0);
      volume += face.a.dot(face.b.clone().cross(face.c)) / 6;
      const keys = [face.a, face.b, face.c].map((v) => v.toArray().map((x) => Math.round(x * 1e7)).join(','));
      for (let j = 0; j < 3; j += 1) {
        const key = [keys[j], keys[(j + 1) % 3]].sort().join('/'); edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0); assert.ok([...edges.values()].every((count) => count === 2), `${g.type} closed edges`);
  });
  const { blocks: b, parts, geometry: p } = model.root.userData;
  for (const side of ['left', 'right']) {
    assert.equal(parts[`${side}Crown`].parent, b[`${side}Gear`].userData.rotor);
    assert.equal(parts[`${side}SlidingCrown`].parent, b.sliding.userData.rotor);
    assert.ok(b[`${side}Gear`].userData.body.geometry.userData.profile.every(([, radius]) => radius >= p.looseBore));
    assert.ok(parts[`${side}SlidingCrown`].geometry.userData.keyHalfWidth > 0);
    const g = parts[`${side}Crown`].geometry.userData;
    assert.equal(g.symmetric, true); assert.equal(g.jawCount, 12);
    assert.equal(g.stations.filter((s) => Math.abs(s.height - p.jawHeight) < 1e-12).length, 13);
  }
  assert.equal(parts.feather.parent, b.shaft.userData.rotor);
  assert.equal(parts.core.parent, b.sliding.userData.rotor);
});

test('053 reverses through a stopped neutral interval and balances cam, drive, load and output motion', () => {
  const model = makeReversingClutch(), p = model.root.userData.geometry, at = model.root.userData.rawStateAtTime;
  assert.ok(p.stopTime < p.cyclePeriod / 2);
  assert.ok(p.engagementAngularImpulse > 0);
  for (let i = 0; i < 4053; i += 1) {
    const t = (i + 0.317) * p.cyclePeriod * 4 / 4053, s = at(t), dt = 1e-6, sign = s.side === 'left' ? 1 : -1;
    assert.ok(s.outputAngularSpeed * sign >= 0);
    assert.ok(Math.abs((at(t + dt).outputAngle - at(t - dt).outputAngle) / (2 * dt) - s.outputAngularSpeed) < 1e-8);
    assert.ok(Math.abs((at(t + dt).outputAngularSpeed - at(t - dt).outputAngularSpeed) / (2 * dt) - s.outputAcceleration) < 1e-8);
    assert.ok(Math.abs((at(t + dt).clutchX - at(t - dt).clutchX) / (2 * dt) - s.axialSpeed) < 1e-8);
    assert.ok(Math.abs(at(t + p.cyclePeriod).outputAngle - s.outputAngle) < 1e-11);
    assert.ok(Math.abs(p.inertia * s.outputAcceleration - s.outputTorque) < 1e-12);
    assert.ok(Math.abs(Math.hypot(s.followerX - p.pivotX, s.followerY - p.pivotY) - p.leverLength) < 1e-12);
    const upper = new THREE.Vector2(s.followerX - p.pivotX, s.followerY - p.pivotY);
    const handle = new THREE.Vector2(s.handleX - p.pivotX, s.handleY - p.pivotY);
    assert.ok(Math.abs(upper.dot(handle)) < 1e-12); assert.ok(Math.abs(handle.length() - p.handleLength) < 1e-12);
    if (s.locked) {
      assert.ok(s.transmittedTorque * sign > 0, 'both flanks push; no tensile tooth force');
      assert.ok(s.activeJawOverlap > 0);
      const drivePower = s.transmittedTorque * sign * p.inputAngularSpeed;
      const selectorPower = s.selectorAxialForce * s.axialSpeed;
      assert.ok(Math.abs(drivePower + selectorPower - s.transmittedTorque * s.outputAngularSpeed) < 1e-12);
      if (s.axialMode === 'inserted') assert.equal(s.outputAngularSpeed, sign * p.inputAngularSpeed);
    } else { assert.ok(s.transmittedTorque === 0); assert.ok(s.selectorAxialForce === 0); }
  }
  for (const half of [0, p.cyclePeriod / 2]) for (const boundary of [0, p.entryTime, p.lockTime, p.insertedTime,
    p.withdrawalTime, p.releaseTime, p.stopTime, p.neutralTime, p.cyclePeriod / 2]) {
    const before = at(half + boundary - 1e-8), after = at(half + boundary + 1e-8);
    assert.ok(Math.abs(after.outputAngle - before.outputAngle) < 3e-8);
    assert.ok(Math.abs(after.clutchX - before.clutchX) < 3e-8);
  }
  const expected = model.root.userData.stateAtTime(17.23);
  for (const step of [0, 1 / 240, 1 / 60, 0.05, 0.1, 0.4]) {
    model.update(0); for (let t = step; step > 0 && t < 17.23; t += step) model.update(t, step);
    model.update(17.23, step); assert.deepEqual(model.root.userData.kinematics, expected);
  }
});

test('053 every loaded crown tooth reaches the actual opposing flank in both directions', () => {
  const report = probeReversingCrownContact(32);
  assert.equal(report.penetratingSamples, 0); assert.ok(report.minimumGap > 0);
  assert.ok(report.maximumToothGap < 0.0002, JSON.stringify(report)); console.log(JSON.stringify(report));
});

test('053 all three bevel gears have sustained contact and clear their opposing actual teeth and rims', () => {
  const report = probeReversingBevelContact(32);
  assert.equal(report.penetratingSamples, 0); assert.ok(report.minimumSignedDistance > 0);
  assert.ok(report.maximumPoseGap < 0.0001, JSON.stringify(report)); console.log(JSON.stringify(report));
});

test('053 keyed sleeve, loose gears, shoe and retained selector pivots clear their actual moving skins', () => {
  const model = makeReversingClutch(), { geometry: p, blocks: b, parts } = model.root.userData;
  model.root.traverse((part) => { if (part.material) part.material.side = THREE.DoubleSide; });
  const ray = new THREE.Raycaster(); let rays = 0;
  const minima = { sleeve: Infinity, key: Infinity, pivot: Infinity, follower: Infinity, handle: Infinity, shoe: Infinity, cap: Infinity };
  const gap = (name, origin, direction, first, second) => {
    ray.set(origin, direction); const a = ray.intersectObject(first, true)[0], c = ray.intersectObject(second, true)[0];
    assert.ok(a && c, `${name} ray reaches both skins`); rays += 1;
    minima[name] = Math.min(minima[name], c.distance - a.distance);
  };
  for (let pose = 0; pose < 65; pose += 1) {
    model.update(p.cyclePeriod * (pose + 0.319) / 65); model.root.updateMatrixWorld(true);
    const s = model.root.userData.kinematics;
    for (let i = 0; i < 12; i += 1) {
      const theta = 2 * Math.PI * (i + 0.271) / 12, c = Math.cos(theta), sn = Math.sin(theta);
      for (const sign of [-1, 1]) gap('sleeve', new THREE.Vector3(sign * 0.85, 0, 0), new THREE.Vector3(0, c, sn),
        parts.shaftBody, b[sign < 0 ? 'leftGear' : 'rightGear'].userData.body);
      gap('pivot', new THREE.Vector3(p.pivotX, p.pivotY, p.leverZ), new THREE.Vector3(c, sn, 0), parts.pivotPin, parts.leverBody);
      gap('follower', new THREE.Vector3(s.followerX, s.followerY, 0.15), new THREE.Vector3(c, sn, 0), parts.followerPin, b.shoe);
      gap('handle', new THREE.Vector3(s.handleX, s.handleY, p.rodZ), new THREE.Vector3(c, sn, 0), parts.handlePin, parts.rodBody);
    }
    for (const side of [-1, 1]) {
      gap('shoe', new THREE.Vector3(s.followerX, s.followerY + 0.014, 0.153), new THREE.Vector3(side, 0, 0), b.shoe,
        parts[side < 0 ? 'leftSlidingCrown' : 'rightSlidingCrown']);
      gap('key', new THREE.Vector3(0, 0.066, s.clutchX).applyMatrix4(b.shaft.userData.rotor.matrixWorld),
        new THREE.Vector3(side, 0, 0).transformDirection(b.shaft.userData.rotor.matrixWorld), parts.feather, parts.core);
    }
    gap('cap', new THREE.Vector3(p.pivotX + 0.035, p.pivotY, p.leverZ), new THREE.Vector3(0, 0, 1), parts.leverBody, parts.pivotCaps[1]);
    gap('cap', new THREE.Vector3(s.followerX + 0.017, s.followerY, 0.153), new THREE.Vector3(0, 0, -1), b.shoe, parts.followerCaps[0]);
    gap('cap', new THREE.Vector3(s.handleX + 0.023, s.handleY, p.rodZ), new THREE.Vector3(0, 0, 1), parts.rodBody, parts.handleCaps[1]);
  }
  assert.ok(minima.sleeve > 0.00498); assert.ok(minima.pivot > 0.00098);
  assert.ok(minima.follower > 0.00078); assert.ok(minima.handle > 0.00098);
  assert.ok(minima.shoe > 0.0000098 && minima.shoe < 0.0000102);
  assert.ok(minima.key > 0.0000098 && minima.key < 0.0000102); assert.ok(minima.cap > 0.00399);
  console.log(JSON.stringify({ movement: 53, hardwareRays: rays, minima }));
});

test('053 clears every separately moving member throughout the reversing operation', () => {
  const report = probeReversingClutchContact(16, false);
  assert.equal(report.penetratingSamples, 0, JSON.stringify(report)); console.log(JSON.stringify(report));
});

test('p101: 053 top driving bevel is steel grey, contrasting with the ochre left bevel it meshes with', () => {
  const model = makeReversingClutch(), {inputGear, leftGear} = model.root.userData.blocks;
  const colour = (gear) => { let c; gear.traverse((o) => { if (!c && o.isMesh && o.material.color.getHex() !== 0xffffff) c = o.material.color; }); return c; };
  const hsl = colour(inputGear).getHSL({});
  assert.ok(hsl.s < 0.1, 'input bevel is a neutral steel');
  assert.ok(Math.abs(colour(leftGear).getHSL({}).s - hsl.s) > 0.4);
});
