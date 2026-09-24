import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeJawClutch } from '../src/simulation/jaw-clutch.js';
import { makeJawClutchMotion } from '../src/simulation/jaw-clutch-motion.js';
import { densePoints } from './helpers/dense-points.mjs';

const tau = 2 * Math.PI;
function triangles(geometry, first = 0, count = Infinity) {
  const p = geometry.attributes.position, index = geometry.index;
  const end = Math.min((index?.count ?? p.count) / 3, first + count), result = [];
  for (let i = first; i < end; i += 1) result.push([0, 1, 2].map((j) =>
    new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(3 * i + j) : 3 * i + j)));
  return result;
}
function cloud(faces) {
  const points = [], keys = new Set();
  const add = (p) => { const key = p.toArray().map((x) => Math.round(x * 1e8)).join(',');
    if (!keys.has(key)) { keys.add(key); points.push(p); } };
  for (const vertices of faces) {
    vertices.forEach(add); add(vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1 / 3));
    for (let i = 0; i < 3; i += 1) add(vertices[i].clone().add(vertices[(i + 1) % 3]).multiplyScalar(0.5));
  }
  return points;
}
// Project the actual front triangles into the shaft-normal plane. Binning
// changes query cost, not the triangles or their barycentric intersections.
function frontSurface(geometry) {
  const { frontTriangleStart, frontTriangleCount } = geometry.userData;
  const faces = triangles(geometry, frontTriangleStart, frontTriangleCount);
  const bins = Array.from({ length: 1024 }, () => []), workingFaces = [];
  for (const [a, b, c] of faces) {
    const cross = b.clone().sub(a).cross(c.clone().sub(a));
    if (cross.z ** 2 < 1e-12 * cross.lengthSq()) workingFaces.push(new THREE.Triangle(a, b, c));
    const determinant = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(determinant) < 1e-13) continue;
    const center = Math.atan2(a.y + b.y + c.y, a.x + b.x + c.x);
    const angles = [a, b, c].map((v) => center + THREE.MathUtils.euclideanModulo(Math.atan2(v.y, v.x) - center + Math.PI, tau) - Math.PI);
    const low = Math.floor(Math.min(...angles) / tau * bins.length) - 1;
    const high = Math.floor(Math.max(...angles) / tau * bins.length) + 1;
    for (let i = low; i <= high; i += 1) bins[THREE.MathUtils.euclideanModulo(i, bins.length)].push({ a, b, c, determinant });
  }
  const surface = (p) => {
    const index = Math.floor(THREE.MathUtils.euclideanModulo(Math.atan2(p.y, p.x), tau) / tau * bins.length);
    let first = Infinity;
    for (const { a, b, c, determinant } of bins[index]) {
      const u = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / determinant;
      const v = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / determinant;
      if (u >= -2e-7 && v >= -2e-7 && u + v <= 1 + 2e-7) first = Math.min(first, u * a.z + v * b.z + (1 - u - v) * c.z);
    }
    return first;
  };
  surface.workingDistance = (p) => {
    const nearest = new THREE.Vector3();
    return Math.min(...workingFaces.map((face) => face.closestPointToPoint(p, nearest).distanceTo(p)));
  };
  return surface;
}
function outlineOf(mesh) {
  const p = mesh.geometry.attributes.position, points = [], seen = new Set();
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y), key = `${x},${y}`;
    if (r < mesh.geometry.userData.rootRadius - 0.001 || seen.has(key)) continue;
    seen.add(key); points.push(new THREE.Vector2(x, y));
  }
  return points.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
}
function radialBoundary(outline) {
  const angles = outline.map((p) => Math.atan2(p.y, p.x));
  return (angle) => {
    let low = 0, high = angles.length;
    while (low < high) { const mid = (low + high) >> 1; if (angles[mid] <= angle) low = mid + 1; else high = mid; }
    const a = outline[(low + outline.length - 1) % outline.length], b = outline[low % outline.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    return (a.x * dy - a.y * dx) / (Math.cos(angle) * dy - Math.sin(angle) * dx);
  };
}

test('048 rebuilt parts are closed solids with outward faces', () => {
  const model = makeJawClutch();
  for (const [name, part] of Object.entries(model.root.userData.blocks)) {
    if (!part.isMesh) continue;
    const edges = new Map(), faces = triangles(part.geometry), n = part.geometry.attributes.normal, index = part.geometry.index;
    let volume = 0;
    for (const [i, [a, b, c]] of faces.entries()) {
      const normal = new THREE.Vector3().fromBufferAttribute(n, index ? index.getX(i * 3) : i * 3);
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).dot(normal) > 0, name + ' triangle normals');
      volume += a.dot(b.clone().cross(c)) / 6;
      const keys = [a, b, c].map((v) => v.toArray().map((x) => Math.round(x * 1e6)).join(','));
      for (let j = 0; j < 3; j += 1) {
        const key = [keys[j], keys[(j + 1) % 3]].sort().join('/'); edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0, name + ' outward winding');
    assert.ok([...edges.values()].every((n) => n === 2), name + ' closed edges');
  }
});

test('048 actual rack-generated gear surfaces clear throughout one tooth engagement', () => {
  const model = makeJawClutch(), { gearBody, pinionBody } = model.root.userData.blocks, g = model.root.userData.geometry;
  const members = [gearBody, pinionBody].map((mesh) => {
    const outline = outlineOf(mesh); return { mesh, outline, boundary: radialBoundary(outline) };
  });
  let minimum = Infinity, checks = 0;
  for (let pose = 0; pose <= 256; pose += 1) {
    const time = pose / 256 * tau / (g.pinionTeeth * Math.abs(model.root.userData.clutchState.pinionAngularSpeed));
    model.update(time - g.sourcePhase * g.cycleDuration); model.root.updateMatrixWorld(true);
    for (let member = 0; member < 2; member += 1) {
      const source = members[member], target = members[1 - member];
      const transform = target.mesh.matrixWorld.clone().invert().multiply(source.mesh.matrixWorld);
      for (let i = 0; i < source.outline.length; i += 1) for (const fraction of [0, 0.5]) {
        const xy = source.outline[i].clone().lerp(source.outline[(i + 1) % source.outline.length], fraction);
        const point = new THREE.Vector3(xy.x, xy.y, 0).applyMatrix4(transform); checks += 1;
        const radius = Math.hypot(point.x, point.y);
        if (radius > target.mesh.geometry.userData.outerRadius + 0.01) continue;
        const gap = radius - target.boundary(Math.atan2(point.y, point.x)); minimum = Math.min(minimum, gap);
        assert.ok(gap >= -1e-7, `actual gear penetration ${-gap} at pose ${pose}`);
      }
    }
  }
  assert.ok(minimum < 0.0015, 'the generated teeth mesh closely');
  console.log(JSON.stringify({ mechanism: 48, gearSurfaceChecks: checks, minimumRadialClearance: minimum }));
});

test('048 insertion, locking, release and coast conserve output angle across events and frames', () => {
  const motion = makeJawClutchMotion(), p = motion.parameters, epsilon = 1e-6;
  for (let i = 0; i < 4096; i += 1) {
    const time = p.cycleDuration * (i + 0.381) / 4096, state = motion.stateAt(time);
    const before = motion.stateAt(time - epsilon), after = motion.stateAt(time + epsilon);
    assert.ok(Math.abs((after.outputAngle - before.outputAngle) / (2 * epsilon) - state.outputAngularSpeed) < 2e-9);
    assert.ok(state.outputAngularSpeed <= 1e-12 && state.outputAngularSpeed >= motion.driveSpeed - 1e-12);
    if (state.locked) {
      assert.ok(state.dogOverlap > -1e-12);
      assert.ok(Math.abs(state.relativeAngle - motion.contactPhase) < 2e-12);
    }
    // The rounded crests may still overlap axially after release; the
    // penetration test below checks that they clear while the output coasts.
    if (state.flankOverlap > 1e-10 && !state.locked) {
      assert.equal(state.mode, 'waiting', 'coasting starts only after the axial driving flanks separate');
      assert.ok(state.relativeAngle < motion.contactPhase);
      assert.ok(state.relativeAngle > -motion.contactPhase);
    }
  }
  for (const phase of [0, p.lockPhase, p.releasePhase, p.releasePhase + motion.coastDuration / p.cycleDuration, 1]) {
    const a = motion.stateAt(phase * p.cycleDuration - epsilon), b = motion.stateAt(phase * p.cycleDuration + epsilon);
    assert.ok(Math.abs(b.outputAngle - a.outputAngle) <= -motion.driveSpeed * 2 * epsilon + 1e-12);
  }
  const model = makeJawClutch();
  for (const delta of [0, 1 / 240, 1 / 60, 0.05, 0.1, 0.4]) {
    model.update(0, 0); for (let t = delta; delta > 0 && t < 7.21; t += delta) model.update(t, delta);
    model.update(7.21, delta);
    const expected = motion.stateAt(7.21 + model.root.userData.geometry.sourcePhase * p.cycleDuration);
    assert.ok(Math.abs(expected.outputAngle - model.root.userData.blocks.output.userData.rotor.rotation.z) < 1e-12);
  }
});

test('048 tapered jaws never penetrate during approach, insertion, drive or withdrawal', () => {
  const model = makeJawClutch(), g = model.root.userData.geometry, { inputBody, outputBody } = model.root.userData.blocks;
  const gi = inputBody.geometry.userData;
  const points = cloud(triangles(inputBody.geometry, gi.frontTriangleStart, gi.frontTriangleCount));
  const outputFront = frontSurface(outputBody.geometry);
  let minimum = Infinity, checks = 0;
  for (let pose = 0; pose <= 512; pose += 1) {
    model.update(g.cycleDuration * pose / 512 - g.sourcePhase * g.cycleDuration); model.root.updateMatrixWorld(true);
    const transform = outputBody.matrixWorld.clone().invert().multiply(inputBody.matrixWorld);
    for (const point of points) {
      const p = point.clone().applyMatrix4(transform), front = outputFront(p);
      if (!Number.isFinite(front)) continue;
      checks += 1; let gap = front - p.z;
      // A point on a vertical working flank can lie behind its adjacent
      // tooth tip in an axial projection. Check its distance to the actual
      // flank triangle before calling that projection an intersection.
      if (gap < 0 && outputFront.workingDistance(p) < 3e-7) gap = 0;
      minimum = Math.min(minimum, gap);
      assert.ok(gap >= -3e-7, `jaw penetration ${-gap} at pose ${pose}`);
    }
  }
  assert.ok(minimum < 1e-6, 'the surface samples include contact');
  console.log(JSON.stringify({ mechanism: 48, jawSurfaceChecks: checks, minimumAxialClearance: minimum }));
});

test('048 all six working flanks make real contact while engaged', () => {
  const model = makeJawClutch(), g = model.root.userData.geometry, { inputBody, outputBody } = model.root.userData.blocks;
  const ray = new THREE.Raycaster(); outputBody.material.side = THREE.DoubleSide;
  let maximumError = 0, checks = 0;
  for (let pose = 0; pose <= 64; pose += 1) {
    const phase = g.lockPhase + 0.001 + (g.releasePhase - g.lockPhase - 0.002) * pose / 64;
    model.update(g.cycleDuration * (phase - g.sourcePhase)); model.root.updateMatrixWorld(true);
    // Centre of the engaged axial band: the rounded crests above it carry no drive.
    const overlap = model.root.userData.clutchState.flankOverlap, axial = 0.69 + g.jawHeight - g.crestDepth - overlap / 2;
    for (let dog = 0; dog < g.jawCount; dog += 1) for (const radius of [0.25, 0.4, 0.5]) {
      const angle = g.jawPhase + (dog - g.jawFraction / 2) * tau / g.jawCount;
      const contact = new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), axial).applyMatrix4(inputBody.matrixWorld);
      const direction = new THREE.Vector3(Math.sin(angle), -Math.cos(angle), 0).transformDirection(inputBody.matrixWorld);
      ray.set(contact.clone().addScaledVector(direction, -0.001), direction);
      const hit = ray.intersectObject(outputBody, false)[0]; assert.ok(hit, 'a physical output flank must receive the ray');
      const error = Math.abs(hit.distance - 0.001); maximumError = Math.max(maximumError, error); checks += 1;
      assert.ok(error < 2e-7, `working jaw flank gap ${error}`);
    }
  }
  console.log(JSON.stringify({ mechanism: 48, workingFlankRays: checks, maximumContactError: maximumError }));
});

test('048 the rigid lever follower clears the actual rotating sleeve', () => {
  const model = makeJawClutch(), g = model.root.userData.geometry, b = model.root.userData.blocks;
  const parts = [b.leverBody, b.follower, b.followerPin, b.rodBody];
  // Vertices and edge midpoints miss the lever plate's broad faces, where it
  // passes in front of the collar and shoulder; sample those faces densely.
  const points = parts.map((part) => (part === b.leverBody ? densePoints(part.geometry, 0.01) : cloud(triangles(part.geometry))));
  const profile = g.outputProfile.slice(3, -1).filter(([, r]) => r > g.boreRadius);
  const envelope = (x) => {
    let radius = -Infinity;
    for (let i = 0; i + 1 < profile.length; i += 1) {
      const [a, ra] = profile[i], [z, rz] = profile[i + 1];
      if (x < Math.min(a, z) - 1e-8 || x > Math.max(a, z) + 1e-8) continue;
      radius = Math.max(radius, a === z ? Math.max(ra, rz) : THREE.MathUtils.lerp(ra, rz, (x - a) / (z - a)));
    }
    return radius;
  };
  let minimum = Infinity, checks = 0;
  const collarRay = new THREE.Raycaster(); let collarContactError = 0, collarRays = 0;
  for (let pose = 0; pose <= 512; pose += 1) {
    model.update(g.cycleDuration * pose / 512 - g.sourcePhase * g.cycleDuration); model.root.updateMatrixWorld(true);
    const state = model.root.userData.clutchState;
    const left = g.grooveLeft - g.stroke + state.shift, right = g.grooveRight - g.stroke + state.shift;
    assert.ok(state.followerPoint.x - g.followerRadius >= left - 1e-12);
    assert.ok(state.followerPoint.x + g.followerRadius <= right + 1e-12);
    if (state.followerSide !== 'free') {
      const side = state.followerSide === 'left' ? -1 : 1, wall = side < 0 ? left : right;
      collarRay.set(new THREE.Vector3(wall - side * 0.001, state.followerPoint.y, 0.315), new THREE.Vector3(side, 0, 0));
      const hit = collarRay.intersectObject(b.outputBody, false)[0]; assert.ok(hit, 'follower touches the actual collar lip');
      collarContactError = Math.max(collarContactError, Math.abs(hit.distance - 0.001)); collarRays += 1;
      assert.ok(Math.abs(hit.distance - 0.001) < 2e-7);
    }
    for (let part = 0; part < parts.length; part += 1) for (const point of points[part]) {
      const world = point.clone().applyMatrix4(parts[part].matrixWorld);
      const x = world.x - b.output.position.x, limit = envelope(x); if (!Number.isFinite(limit)) continue;
      const gap = Math.hypot(world.y, world.z) - limit;
      // At the flat contact walls, the roller's side contact has zero axial
      // gap; the conservative radial envelope includes that intentional face.
      if (Math.abs(world.x - left) < 2e-7 || Math.abs(world.x - right) < 2e-7) continue;
      checks += 1; minimum = Math.min(minimum, gap);
      assert.ok(gap >= -1e-7, `sleeve contact with ${parts[part].type}: ${gap} at pose ${pose}`);
    }
  }
  assert.ok(g.keyLeft > 0.87, 'the fixed feather starts beyond the loose input jaws');
  assert.ok(g.featherHalfWidth < g.keyHalfWidth && g.keyTop < g.keywayTop);
  assert.ok(g.keyTop > g.boreRadius && g.keyBottom < g.shaftRadius, 'feather engages the actual keyway');
  console.log(JSON.stringify({ mechanism: 48, leverSurfaceChecks: checks, minimumRadialClearance: minimum, collarRays, collarContactError }));
});

test('048 the feather and shafts clear their actual bores throughout the slide', () => {
  const model = makeJawClutch(), g = model.root.userData.geometry, b = model.root.userData.blocks;
  const ray = new THREE.Raycaster();
  for (const part of [b.outputBody, b.inputBody, b.gearBody, b.pinionBody]) part.material.side = THREE.DoubleSide;
  let minimum = Infinity, checks = 0;
  for (let pose = 0; pose <= 128; pose += 1) {
    model.update(g.cycleDuration * pose / 128 - g.sourcePhase * g.cycleDuration); model.root.updateMatrixWorld(true);
    for (const localX of [1.50, 1.90, 2.36, 2.68]) {
      const shaftX = localX + b.output.position.x;
      assert.ok(shaftX > g.keyLeft && shaftX < g.keyRight, 'every hub station remains on the fixed feather');
      for (const [x, y] of [[-g.featherHalfWidth, g.keyTop], [0, g.keyTop], [g.featherHalfWidth, g.keyTop],
        [-g.featherHalfWidth, g.boreRadius], [g.featherHalfWidth, g.boreRadius]]) {
        const length = Math.hypot(x, y), localDirection = new THREE.Vector3(x / length, y / length, 0);
        const origin = new THREE.Vector3(0, 0, shaftX).applyMatrix4(b.shaft.userData.rotor.matrixWorld);
        const direction = localDirection.clone().transformDirection(b.shaft.userData.rotor.matrixWorld);
        ray.set(origin, direction);
        const hit = ray.intersectObject(b.outputBody, false)[0]; assert.ok(hit, 'ray reaches the real keyway wall');
        const clearance = hit.distance - length; minimum = Math.min(minimum, clearance); checks += 1;
        assert.ok(clearance > 0.0025, `feather clearance ${clearance}`);
      }
    }
  }
  for (const [part, radius] of [[b.inputBody, g.shaftRadius], [b.gearBody, g.shaftRadius], [b.pinionBody, 0.078]]) {
    const axial = part === b.inputBody ? 0.4 : 0;
    for (let i = 0; i < 64; i += 1) {
      const angle = i * tau / 64;
      const origin = new THREE.Vector3(0, 0, axial).applyMatrix4(part.matrixWorld);
      const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).transformDirection(part.matrixWorld);
      ray.set(origin, direction); const hit = ray.intersectObject(part, false)[0]; assert.ok(hit);
      assert.ok(hit.distance - radius > 0.0049, 'loose gear and input member clear the shaft');
    }
  }
  console.log(JSON.stringify({ mechanism: 48, keywayRays: checks, minimumKeywayClearance: minimum }));
});

test('048 rack-generated working flanks agree with the independent involute equation', () => {
  const model = makeJawClutch(), { gearBody, pinionBody } = model.root.userData.blocks;
  let worst = 0, checks = 0;
  for (const body of [gearBody, pinionBody]) {
    const g = body.geometry.userData, radius = g.pitchRadius, base = radius * Math.cos(Math.PI / 9);
    const inv = (r) => { const t = Math.sqrt((r / base) ** 2 - 1); return t - Math.atan(t); };
    for (const point of outlineOf(body)) {
      const r = point.length();
      if (r < base + 0.007 || r >= g.outerRadius - 0.001) continue;
      const toothAngle = Math.abs(THREE.MathUtils.euclideanModulo(Math.atan2(point.y, point.x) + Math.PI / g.teeth,
        tau / g.teeth) - Math.PI / g.teeth);
      const halfAngle = Math.PI / (2 * g.teeth) - g.module * 0.008 / (2 * radius) + inv(radius) - inv(r);
      const error = Math.abs(toothAngle - halfAngle) * r; worst = Math.max(worst, error); checks += 1;
      assert.ok(error < 0.00015, `generated flank departs from the involute by ${error}`);
    }
  }
  assert.ok(checks > 1000);
  console.log(JSON.stringify({ mechanism: 48, independentInvoluteChecks: checks, maximumTangentialError: worst }));
});
