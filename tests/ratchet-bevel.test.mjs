import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeRatchetBevel } from '../src/simulation/ratchet-bevel.js';
import { makeRatchetBevelMotion } from '../src/simulation/ratchet-bevel-motion.js';
import { surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';
import { probeRatchetBevelContact } from './helpers/ratchet-bevel-contact.mjs';

function polygonClearance(p, outline) {
  let inside = false, squared = Infinity;
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i], b = outline[(i + 1) % outline.length], dx = b.x - a.x, dy = b.y - a.y;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < dx * (p.y - a.y) / dy + a.x) inside = !inside;
    const t = THREE.MathUtils.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    squared = Math.min(squared, (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2);
  }
  return (inside ? -1 : 1) * Math.sqrt(squared);
}

test('049 equal bevel gears and rebuilt rigid parts are closed with conical heels and toes', () => {
  const model = makeRatchetBevel(), g = model.root.userData.geometry, b = model.root.userData.blocks;
  assert.equal(g.ratchetTeeth, 18); assert.equal(g.teeth, 40);
  assert.ok(Math.abs(g.pitchConeAngle - Math.PI / 4) < 1e-12);
  assert.ok(g.innerDistance / g.outerDistance > 0.61 && g.innerDistance / g.outerDistance < 0.63);
  const checked = new Set();
  model.root.traverse((part) => {
    const geometry = part.geometry;
    // Spring wire ends terminate at their two attachments.
    if (!geometry || geometry.type === 'TubeGeometry' || checked.has(geometry)) return;
    checked.add(geometry); const faces = surfaceTriangles(geometry), normals = geometry.attributes.normal, edges = new Map();
    let volume = 0;
    for (const [index, triangle] of faces.entries()) {
      const { a, b, c } = triangle, normalIndex = geometry.index ? geometry.index.getX(index * 3) : index * 3;
      assert.ok(triangle.getNormal(new THREE.Vector3()).dot(new THREE.Vector3().fromBufferAttribute(normals, normalIndex)) > 0);
      volume += a.dot(b.clone().cross(c)) / 6;
      const keys = [a, b, c].map((v) => v.toArray().map((x) => Math.round(x * 1e6)).join(','));
      for (let i = 0; i < 3; i += 1) { const key = [keys[i], keys[(i + 1) % 3]].sort().join('/'); edges.set(key, (edges.get(key) ?? 0) + 1); }
    }
    assert.ok(volume > 0); assert.ok([...edges.values()].every((count) => count === 2), geometry.type + ' closed edges');
  });
  for (const gear of [b.rightGear, b.leftGear, b.outputGear]) {
    const geometry = gear.userData.toothMeshes[0].geometry, positions = geometry.attributes.position;
    const outerCone = 2 * g.outerDistance, innerCone = 2 * g.innerDistance;
    for (let i = 0; i < positions.count; i += 1) {
      const cone = Math.hypot(positions.getX(i), positions.getY(i)) + positions.getZ(i);
      assert.ok(Math.min(Math.abs(cone - outerCone), Math.abs(cone - innerCone)) < 1.5e-7,
        'both tooth ends follow cones normal to the 45-degree pitch generator');
    }
  }
});

test('049 actual bevel teeth remain engaged without intersecting either mesh', () => {
  const report = probeRatchetBevelContact(64);
  assert.equal(report.penetratingSamples, 0);
  assert.ok(report.minimumSignedDistance > 0);
  assert.ok(report.maximumPoseGap < 0.0001, 'both meshes remain close at every pose');
  console.log(JSON.stringify(report));
});

test('049 finite-pitch rectification preserves angle and torque balance across repeated reversals', () => {
  const motions = [undefined, 0.61, 0.82, 1.09].map((amplitude) => makeRatchetBevelMotion({ amplitude }));
  const epsilon = 1e-6;
  for (const motion of motions) {
    const p = motion.parameters, pitch = motion.follower.pitch;
    let dwells = 0;
    for (let i = 0; i < 1024; i += 1) {
      const time = 4 * p.cycleDuration * (i + 0.381) / 1024, state = motion.stateAt(time);
      const before = motion.stateAt(time - epsilon), after = motion.stateAt(time + epsilon);
      assert.ok(state.outputAngularSpeed <= 1e-12, 'output never reverses');
      assert.ok(Math.abs((after.outputAngle - before.outputAngle) / (2 * epsilon) - state.outputAngularSpeed) < 5e-8);
      assert.ok(Math.abs(state.driveTorque - state.resistingTorque + p.inertia * state.outputAcceleration) < 1e-12);
      assert.ok(state.driveTorque >= -1e-12, 'the pawl supplies a pushing torque, never a pulling one');
      if (state.activeSide !== 'none') {
        const relative = state.activeSide === 'right' ? state.rightRelativeAngle : state.leftRelativeAngle;
        assert.ok(Math.abs(relative / pitch - Math.round(relative / pitch)) < 1e-10, 'an actual tooth is aligned whenever the pawl drives');
      } else if (!state.driving) { dwells += 1; assert.equal(Math.abs(state.outputAngularSpeed), 0); }
    }
    if (p.backlashTravel > 1e-6) assert.ok(dwells > 0, 'nonintegral strokes retain their lost motion');
    for (let turn = 0; turn < 8; turn += 1) {
      const t = (Math.PI / 2 + turn * Math.PI) / p.frequency;
      const a = motion.stateAt(t - epsilon), b = motion.stateAt(t + epsilon);
      assert.ok(Math.abs(a.outputAngle - b.outputAngle) < 2 * p.inputAmplitude * p.frequency * epsilon + 1e-10);
    }
  }
  assert.ok(Math.abs(motions[0].parameters.backlashTravel - 0.15 * motions[0].follower.pitch) < 1e-12,
    'the default stroke overtravels so each idle pawl seats before it drives');
  const model = makeRatchetBevel(), expected = model.root.userData.motion.stateAt(7.21);
  for (const step of [0, 1 / 240, 1 / 60, 0.05, 0.1, 0.4]) {
    model.update(0); for (let t = step; step > 0 && t < 7.21; t += step) model.update(t, step);
    model.update(7.21, step); assert.ok(Math.abs(model.root.userData.ratchetState.outputAngle - expected.outputAngle) < 1e-12);
  }
});

test('049 the complete pawl skins clear the actual ratchet teeth through both half-strokes', () => {
  const model = makeRatchetBevel(), b = model.root.userData.blocks, g = model.root.userData.geometry;
  const cloud = surfacePoints(b.rightCarrier.userData.parts.pawlBody.geometry);
  let minimum = Infinity, checks = 0;
  for (let pose = 0; pose <= 1024; pose += 1) {
    model.update(g.cycleDuration * pose / 1024); model.root.updateMatrixWorld(true);
    for (const carrier of [b.rightCarrier, b.leftCarrier]) {
      const { pawlBody, ratchet } = carrier.userData.parts;
      const transform = ratchet.matrixWorld.clone().invert().multiply(pawlBody.matrixWorld);
      for (const v of cloud) {
        const p = v.clone().applyMatrix4(transform);
        if (Math.hypot(p.x, p.y) > g.tipRadius + 0.001) continue;
        assert.ok(Math.abs(p.z - g.ratchetZ) < g.ratchetDepth / 2, 'the nose operates within the wheel thickness');
        const gap = polygonClearance(p, ratchet.geometry.userData.outline); checks += 1; minimum = Math.min(minimum, gap);
        assert.ok(gap >= -1e-7, `pawl penetrates a real ratchet edge by ${-gap} at pose ${pose}`);
      }
    }
  }
  assert.ok(minimum > -1e-7 && minimum < 0.00002, `seated flush (${minimum})`);
  console.log(JSON.stringify({ movement: 49, pawlSurfaceChecks: checks, minimumClearance: minimum }));
});

test('049 each driving pawl contacts its real working face and each overrunning pawl follows the teeth', () => {
  const model = makeRatchetBevel(), b = model.root.userData.blocks, g = model.root.userData.geometry;
  const f = model.root.userData.motion.follower, ray = new THREE.Raycaster();
  let maximumContactGap = 0, rays = 0, lifted = 0;
  for (let pose = 0; pose <= 256; pose += 1) {
    model.update(4 * g.cycleDuration * (pose + 0.311) / 257); model.root.updateMatrixWorld(true);
    const state = model.root.userData.ratchetState;
    for (const [side, carrier, relative] of [['right', b.rightCarrier, state.rightRelativeAngle], ['left', b.leftCarrier, state.leftRelativeAngle]]) {
      const { pawl, pawlBody, ratchet } = carrier.userData.parts;
      assert.ok(pawl.rotation.z <= f.restAngle + 1e-12);
      const clearance = f.clearanceAt(pawl.rotation.z, relative);
      assert.ok(clearance > -1e-9);
      // p109: past a crest the pawl is held on its underside, then falls
      // (clear of the teeth, lifted more than the ramp needs); otherwise the
      // actual ramp determines the lift.
      const mode = state[`${side}PawlMode`];
      if (pawl.rotation.z < f.restAngle - 1e-6) { lifted += 1; if (mode === 'teeth') assert.ok(clearance < 1e-9, 'the actual ramp determines lift'); }
      if (side !== state.activeSide) continue;
      assert.ok(Math.abs(pawl.rotation.z - f.restAngle) < 1e-12);
      pawlBody.material.side = THREE.DoubleSide; ratchet.material.side = THREE.DoubleSide;
      const onFace = f.tip.clone().addScaledVector(new THREE.Vector2(Math.cos(g.faceAngle), Math.sin(g.faceAngle)), 0.03)
        .addScaledVector(new THREE.Vector2(Math.sin(g.faceAngle), -Math.cos(g.faceAngle)), 0.01);
      const center = new THREE.Vector3(onFace.x, onFace.y, g.ratchetZ).applyMatrix4(carrier.userData.rotor.matrixWorld);
      const direction = new THREE.Vector3(-Math.sin(g.faceAngle), Math.cos(g.faceAngle), 0).transformDirection(carrier.userData.rotor.matrixWorld);
      ray.set(center, direction);
      const noseHit = ray.intersectObject(pawlBody, false)[0], wheelHit = ray.intersectObject(ratchet, false)[0];
      assert.ok(noseHit && wheelHit);
      const gap = wheelHit.distance - noseHit.distance;
      assert.ok(gap > -1e-7 && gap < 0.00002, `actual driving-face gap ${gap}`);
      maximumContactGap = Math.max(maximumContactGap, gap); rays += 1;
    }
  }
  assert.ok(lifted > 40);
  console.log(JSON.stringify({ movement: 49, drivingContactRays: rays, maximumContactGap, liftedPoses: lifted }));
});

test('049 each pawl is one flat plate hung on its pin whose wedge tip fills the root', () => {
  const model = makeRatchetBevel(), b = model.root.userData.blocks, g = model.root.userData.geometry;
  const f = model.root.userData.motion.follower;
  for (const carrier of [b.rightCarrier, b.leftCarrier]) {
    const parts = carrier.userData.parts;
    assert.deepEqual(Object.keys(parts).sort(), ['arm', 'pawl', 'pawlBody', 'pivotPin', 'ratchet'], 'no stop pin or spring');
    assert.equal(parts.pawl.children.length, 1, 'the pawl is a single body');
    const box = new THREE.Box3().setFromBufferAttribute(parts.pawlBody.geometry.attributes.position);
    assert.ok(Math.abs(box.min.z + g.pawlDepth / 2) < 1e-6 && Math.abs(box.max.z - g.pawlDepth / 2) < 1e-6, 'one uniform extrusion');
    assert.ok(Math.abs(parts.pawl.position.z - g.ratchetZ) < 1e-12, 'in the ratchet plane');
  }
  // The tip's two flanks lie along the tooth face and the preceding back,
  // and at the seat the tip sits in the root corner.
  const face = new THREE.Vector2(Math.cos(g.faceAngle), Math.sin(g.faceAngle));
  const back = new THREE.Vector2(g.tipRadius * Math.cos(g.faceAngle - 0.9 * f.pitch), g.tipRadius * Math.sin(g.faceAngle - 0.9 * f.pitch)).sub(f.root).normalize();
  assert.ok(Math.abs(f.W.clone().sub(f.tip).normalize().dot(face) - 1) < 1e-12);
  assert.ok(Math.abs(f.U.clone().sub(f.tip).normalize().dot(back) - 1) < 1e-12);
  assert.ok(Math.abs(f.valleyAngle - Math.acos(face.dot(back))) < 1e-12);
  assert.ok(f.tip.distanceTo(f.root) < 2e-5, 'tip nestles in the root');
  assert.ok(f.W.length() > g.tipRadius, 'the working flank covers the whole tooth face');
  assert.ok(f.clearanceAt(0, 0) >= 0 && f.clearanceAt(0, 0) < 2e-5, 'seated flush without penetration');
  // Solid proportions: the boss surrounds the bore generously and the pawl
  // is broad along its whole length.
  assert.ok(g.bossRadius - g.pivotBore > 0.03);
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20, q = f.tip.clone().lerp(f.pivot, 0.25 + 0.5 * t);
    const inside = (v) => { let c = false; const o = f.pawlOutline;
      for (let k = 0, j = o.length - 1; k < o.length; j = k, k += 1)
        if ((o[k].y > v.y) !== (o[j].y > v.y) && v.x < (o[j].x - o[k].x) * (v.y - o[k].y) / (o[j].y - o[k].y) + o[k].x) c = !c; return c; };
    const axis = f.pivot.clone().sub(f.tip).normalize(), normal = new THREE.Vector2(-axis.y, axis.x);
    let width = 0;
    for (const side of [-1, 1]) for (let w = 0; inside(q.clone().addScaledVector(normal, side * (w + 0.001))); w += 0.001) width += 0.001;
    assert.ok(width > 0.075, `pawl broad along its length (${width})`);
  }
  // Gravity seats it: the pin is above the pawl's centroid side so that the
  // weight turns the tip into the wheel at every carrier angle of the stroke.
  let area = 0, cx = 0, cy = 0; const o = f.pawlOutline;
  for (let i = 0; i < o.length; i += 1) { const a = o[i], c = o[(i + 1) % o.length], w = a.x * c.y - c.x * a.y; area += w / 2; cx += (a.x + c.x) * w / 6; cy += (a.y + c.y) * w / 6; }
  const centroid = new THREE.Vector2(cx / area, cy / area).sub(f.pivot);
  for (const tilt of [-g.inputAmplitude, 0, g.inputAmplitude]) {
    const gravity = new THREE.Vector2(Math.sin(tilt), -Math.cos(tilt));
    const torque = centroid.x * gravity.y - centroid.y * gravity.x;
    // A counterclockwise (positive) turn of the pawl carries its tip inward.
    const tipArm = f.tip.clone().sub(f.pivot), inwardRate = -(-tipArm.y * f.tip.x + tipArm.x * f.tip.y) / f.tip.length();
    assert.ok(inwardRate > 0.1);
    assert.ok(torque / area > 0.01, `weight holds the tip on the teeth at tilt ${tilt} (${torque / area})`);
  }
  // The pin fills the pawl's and arm's bores through the lift.
  let pivotGap = Infinity;
  for (let pose = 0; pose <= 256; pose += 1) {
    model.update(g.cycleDuration * pose / 256); model.root.updateMatrixWorld(true);
    for (const carrier of [b.rightCarrier, b.leftCarrier]) {
      const { pawl, pivotPin } = carrier.userData.parts;
      assert.ok(Math.hypot(pawl.position.x - pivotPin.position.x, pawl.position.y - pivotPin.position.y) < 1e-12);
    }
  }
  pivotGap = g.pivotBore - g.pivotRadius; assert.ok(pivotGap > 0 && pivotGap < 0.003);
  console.log(JSON.stringify({ movement: 49, valleyDegrees: f.valleyAngle * 180 / Math.PI, pawlArea: area }));
});

test('049 real keyed carriers and loose bores clear the horizontal shaft', () => {
  const model = makeRatchetBevel(), b = model.root.userData.blocks, g = model.root.userData.geometry;
  const ray = new THREE.Raycaster(); let minimumKeyGap = Infinity, checks = 0;
  const keyCloud = surfacePoints(b.feathers[0].geometry).filter((v) => Math.abs(v.z) < 0.04);
  for (let pose = 0; pose <= 64; pose += 1) {
    model.update(g.cycleDuration * pose / 64); model.root.updateMatrixWorld(true);
    for (const [carrier, feather] of [[b.rightCarrier, b.feathers[1]], [b.leftCarrier, b.feathers[0]]]) {
      const { arm } = carrier.userData.parts; arm.material.side = THREE.DoubleSide;
      const transform = arm.matrixWorld.clone().invert().multiply(feather.matrixWorld);
      for (const point of keyCloud) {
        const local = point.clone().applyMatrix4(transform), length = Math.hypot(local.x, local.y);
        if (length < g.carrierBore) continue; // Key foot is fixed within the shaft.
        const origin = new THREE.Vector3(0, 0, local.z).applyMatrix4(arm.matrixWorld);
        const direction = new THREE.Vector3(local.x / length, local.y / length, 0).transformDirection(arm.matrixWorld);
        ray.set(origin, direction); const hit = ray.intersectObject(arm, false)[0]; assert.ok(hit);
        const gap = hit.distance - length; minimumKeyGap = Math.min(minimumKeyGap, gap); checks += 1;
        assert.ok(gap > 0.0030);
      }
    }
  }
  for (const gear of [b.rightGear, b.leftGear]) {
    const body = gear.userData.body; body.material.side = THREE.DoubleSide;
    for (let i = 0; i < 64; i += 1) {
      const angle = i * 2 * Math.PI / 64;
      const origin = new THREE.Vector3(0, 0, 0.85).applyMatrix4(body.matrixWorld);
      const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).transformDirection(body.matrixWorld);
      ray.set(origin, direction); const hit = ray.intersectObject(body, false)[0]; assert.ok(hit);
      assert.ok(hit.distance > g.shaftRadius + 0.0079);
    }
  }
  b.outputGear.userData.body.material.side = THREE.DoubleSide;
  b.outputShaftBody.material.side = THREE.DoubleSide;
  for (let i = 0; i < 64; i += 1) {
    const angle = i * 2 * Math.PI / 64;
    const origin = new THREE.Vector3(0, 0, 0.85).applyMatrix4(b.outputGear.userData.body.matrixWorld);
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).transformDirection(b.outputGear.userData.body.matrixWorld);
    ray.set(origin, direction);
    const bore = ray.intersectObject(b.outputGear.userData.body, false)[0];
    const shaft = ray.intersectObject(b.outputShaftBody, false)[0];
    assert.ok(bore && shaft);
    assert.ok(Math.abs(bore.distance - shaft.distance) < 1e-7, 'the output gear fits its shaft instead of floating around it');
  }
  for (const [carrier, bearing] of [[b.rightCarrier, b.bearings[1]], [b.leftCarrier, b.bearings[0]]]) {
    const armBounds = new THREE.Box3().setFromObject(carrier.userData.parts.arm, true);
    const frameBounds = new THREE.Box3().setFromObject(bearing.userData.body, true);
    const gap = carrier === b.rightCarrier ? frameBounds.min.x - armBounds.max.x : armBounds.min.x - frameBounds.max.x;
    assert.ok(gap > 0.0249, 'carrier arms clear the actual stationary bearing frames axially');
  }
  for (const point of surfacePoints(b.outputShaftBody.geometry)) {
    const world = point.clone().applyMatrix4(b.outputShaftBody.matrixWorld);
    assert.ok(Math.hypot(world.y, world.z) - g.shaftRadius > 0.49, 'the actual vertical shaft skin clears the horizontal shaft');
  }
  console.log(JSON.stringify({ movement: 49, keywayRays: checks, minimumKeyGap }));
});

// p109: an idle pawl leaving a crest no longer snaps into the root in one
// sample. It rides its underside over the overhang and then falls under
// gravity over dropDuration; the loop seam is continuous.
test('049 idle pawls fall into the roots smoothly and the loop seam is continuous', () => {
  const model = makeRatchetBevel(), g = model.root.userData.geometry, motion = model.root.userData.motion;
  const f = motion.follower, P = g.cycleDuration, samples = 2000;
  let previous = null, maximumStep = 0, falls = 0;
  for (let i = 0; i <= samples; i += 1) {
    const state = motion.stateAt(P * i / samples);
    for (const side of ['right', 'left']) {
      assert.ok(f.clearanceAt(state[`${side}PawlAngle`], state[`${side}RelativeAngle`]) > -1e-9, 'clear of the teeth');
      if (state[`${side}PawlMode`] === 'falling') falls += 1;
    }
    if (previous) maximumStep = Math.max(maximumStep, Math.abs(state.rightPawlAngle - previous.rightPawlAngle),
      Math.abs(state.leftPawlAngle - previous.leftPawlAngle));
    previous = state;
  }
  assert.ok(falls > 0, 'the drops are resolved in time');
  // 0.3 rad over dropDuration 0.06 s: at most about 0.04 rad per P/2000.
  assert.ok(maximumStep < 0.05, `largest pawl step ${maximumStep}`);
  const first = motion.stateAt(0), last = motion.stateAt(P);
  assert.ok(Math.abs(first.rightPawlAngle - last.rightPawlAngle) < 1e-12 && Math.abs(first.leftPawlAngle - last.leftPawlAngle) < 1e-12);
});
