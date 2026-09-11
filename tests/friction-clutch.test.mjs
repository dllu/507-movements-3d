import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeFrictionClutch } from '../src/simulation/friction-clutch.js';
import { makeFrictionClutchMotion } from '../src/simulation/friction-clutch-motion.js';

function surfaceCloud(geometry) {
  const p = geometry.attributes.position, index = geometry.index, points = [], keys = new Set();
  const add = (point) => {
    const key = point.toArray().map((x) => Math.round(x * 1e8)).join(',');
    if (!keys.has(key)) { keys.add(key); points.push(point); }
  };
  for (let i = 0; i < p.count; i += 1) add(new THREE.Vector3().fromBufferAttribute(p, i));
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const vertices = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j));
    add(vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1 / 3));
    for (let j = 0; j < 3; j += 1) add(vertices[j].clone().add(vertices[(j + 1) % 3]).multiplyScalar(0.5));
  }
  return points;
}

test('047 clutch speed and angle are independent of frame size and agree with torque balance', () => {
  const motion = makeFrictionClutchMotion(), p = motion.parameters;
  const e = motion.events;
  assert.ok(e.start < e.lock && e.lock < e.release && e.release < e.stop && e.stop < p.cycleDuration);
  const epsilon = 1e-5;
  for (let sample = 0; sample < 2000; sample += 1) {
    const time = p.cycleDuration * (sample + 0.371) / 2000;
    const state = motion.stateAt(time), a = motion.stateAt(time - epsilon), b = motion.stateAt(time + epsilon);
    assert.ok(state.outputAngularSpeed >= -1e-12 && state.outputAngularSpeed <= p.inputAngularSpeed + 1e-12);
    assert.ok(Math.abs((b.outputAngle - a.outputAngle) / (2 * epsilon) - state.outputAngularSpeed) < 2e-8,
      'reported speed equals the derivative of the actual output angle');
    assert.ok(Math.abs((b.outputAngularSpeed - a.outputAngularSpeed) / (2 * epsilon)
      - state.outputAngularAcceleration) < 1e-7);
    assert.ok(Math.abs(state.appliedFrictionTorque - state.appliedLoadTorque
      - p.inertia * state.outputAngularAcceleration) < 1e-12,
    'slipping torque and the resisting load also balance while the output is stalled');
    assert.ok(state.appliedFrictionTorque * state.slipAngularSpeed >= -1e-12,
      'sliding friction dissipates energy');
    if (state.contactPressure > 1e-12) assert.ok(state.shift < 1e-12, 'friction acts only after the annular faces meet');
    if (state.outputAngularSpeed > 1e-12) {
      assert.ok(Math.abs(state.appliedFrictionTorque - p.loadTorque - p.inertia * state.outputAngularAcceleration) < 1e-12);
      assert.ok(state.appliedFrictionTorque <= p.frictionTorque * state.contactPressure + 1e-10);
    }
    if (state.locked) assert.ok(Math.abs(state.outputAngularSpeed - state.inputAngularSpeed) < 1e-12);
  }
  // Independent midpoint integration of available friction minus resisting
  // torque during the slipping acceleration interval recovers the input speed.
  let integratedSpeed = 0;
  const steps = 20000, dt = (e.lock - e.start) / steps;
  for (let i = 0; i < steps; i += 1) {
    const t = e.start + (i + 0.5) * dt;
    const phase = t / p.cycleDuration;
    const u = (phase - 0.30) / 0.08;
    const pressure = phase < 0.38 ? u * u * (3 - 2 * u) : 1;
    integratedSpeed += (p.frictionTorque * pressure - p.loadTorque) / p.inertia * dt;
  }
  assert.ok(Math.abs(integratedSpeed - p.inputAngularSpeed) < 1e-8);
  const model = makeFrictionClutch();
  for (const delta of [0, 1 / 240, 1 / 60, 0.05, 0.1, 0.4]) {
    model.update(0, 0);
    for (let t = delta; delta > 0 && t < 7.21; t += delta) model.update(t, delta);
    model.update(7.21, delta);
    assert.ok(Math.abs(model.root.userData.clutchState.outputAngle
      - motion.stateAt(7.21).outputAngle - model.root.userData.geometry.outputPhase) < 1e-12);
  }
});

test('047 complete machined members and the shaft are closed and have outward normals', () => {
  const model = makeFrictionClutch();
  for (const name of ['input', 'output', 'shaft']) {
    const geometry = model.root.userData.blocks[name].userData.body.geometry;
    const p = geometry.attributes.position, normals = geometry.attributes.normal;
    const vertices = Array.from({ length: p.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, i));
    const keys = vertices.map((v) => v.toArray().map((x) => Math.round(x * 1e6)).join(','));
    const edges = new Map();
    let volume = 0;
    for (let i = 0; i < p.count; i += 3) {
      const [a, b, c] = vertices.slice(i, i + 3);
      const cross = b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(cross.dot(new THREE.Vector3().fromBufferAttribute(normals, i)) > 0);
      volume += a.dot(b.clone().cross(c)) / 6;
      for (const [j, k] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
        const a = keys[j], b = keys[k], key = a < b ? a + ':' + b : b + ':' + a;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0, name + ' has outward triangle winding');
    assert.ok([...edges.values()].every((count) => count === 2), name + ' has no open edges or missing faces');
  }
});

test('047 annular tongue clears both groove walls and makes actual axial face contact', () => {
  const model = makeFrictionClutch(), g = model.root.userData.geometry;
  const { input, output } = model.root.userData.blocks;
  const points = surfaceCloud(output.userData.body.geometry);
  const world = new THREE.Vector3(), ray = new THREE.Raycaster();
  const queries = [input, output].map((member) => new THREE.Mesh(member.userData.body.geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  let checked = 0, rays = 0, minimumSideClearance = Infinity, maxGapError = 0;
  for (let pose = 0; pose <= 256; pose += 1) {
    model.update(g.cycleDuration * pose / 256, 0);
    model.root.updateMatrixWorld(true);
    const shift = model.root.userData.clutchState.shift;
    for (const p of points) {
      world.copy(p).applyMatrix4(output.userData.body.matrixWorld);
      const x = world.x - g.offsetX, radius = Math.hypot(world.y, world.z);
      assert.ok(x >= 0.168 - 1e-7, 'the tongue tip cannot pass the recess floor');
      if (x > 0.467 + 1e-7) continue;
      // The machined recess is bounded by circular polygons. These bounds
      // include their inward faceting at every relative angular position.
      const innerClearance = radius - 0.794;
      const outerClearance = 0.890 * Math.cos(Math.PI / 256) - radius;
      minimumSideClearance = Math.min(minimumSideClearance, innerClearance, outerClearance);
      assert.ok(innerClearance > 0 && outerClearance > 0, 'the tongue enters a cylindrical groove wall');
      checked += 1;
    }
    for (let side = 0; side < 2; side += 1) queries[side].matrixWorld.copy([input, output][side].userData.body.matrixWorld);
    for (const radius of [0.815, 0.842, 0.870]) for (let angle = 0; angle < 12; angle += 1) {
      const theta = 2 * Math.PI * (angle + 0.173) / 12;
      const hits = [];
      for (const side of [0, 1]) {
        ray.set(new THREE.Vector3(side === 0 ? 2 : -2, radius * Math.cos(theta), radius * Math.sin(theta)),
          new THREE.Vector3(side === 0 ? -1 : 1, 0, 0));
        const intersections = ray.intersectObject(queries[side], false);
        assert.ok(intersections.length > 0, 'a ray meets the rendered annular working face');
        hits.push(intersections[0].point.x);
        rays += 1;
      }
      const gap = hits[1] - hits[0];
      maxGapError = Math.max(maxGapError, Math.abs(gap - shift));
      assert.ok(gap >= -1e-7 && Math.abs(gap - shift) < 1e-7, 'the rendered working gap matches the actual axial travel');
    }
  }
  console.log('047 annular contact', { poses: 257, checked, rays, minimumSideClearance, maxGapError });
});

test('047 follower keeps contact with either collar lip without penetrating the rotating sleeve', () => {
  const model = makeFrictionClutch(), g = model.root.userData.geometry;
  const { follower, followerPin, lever } = model.root.userData.blocks;
  const parts = [follower, followerPin, lever.userData.body];
  const clouds = parts.map((part) => surfaceCloud(part.geometry));
  const world = new THREE.Vector3();
  let checked = 0, minimum = Infinity, maxContactError = 0;
  for (let pose = 0; pose <= 1024; pose += 1) {
    model.update(g.cycleDuration * pose / 1024, 0);
    model.root.updateMatrixWorld(true);
    const state = model.root.userData.clutchState;
    assert.ok(Math.abs(state.followerPoint.distanceTo(model.root.userData.motion.pivot) - g.leverLength) < 1e-12);
    for (const lip of [g.grooveLeft, g.grooveRight]) {
      assert.ok(state.followerPoint.distanceTo(new THREE.Vector3(state.shift + lip, -g.collarRadius, 0))
        >= g.rollerRadius + g.followerClearance - 1e-12, 'both collar corners clear the complete follower circle');
    }
    if (state.followerSide !== 'free') {
      const x = state.shift + (state.followerSide === 'left' ? g.grooveLeft : g.grooveRight);
      const gap = state.followerPoint.distanceTo(new THREE.Vector3(x, -g.collarRadius, 0)) - g.rollerRadius;
      maxContactError = Math.max(maxContactError, Math.abs(gap - g.followerClearance));
      assert.ok(Math.abs(gap - g.followerClearance) < 1e-12);
    }
    for (let part = 0; part < parts.length; part += 1) for (const point of clouds[part]) {
      world.copy(point).applyMatrix4(parts[part].matrixWorld);
      const x = world.x - g.offsetX - state.shift, radius = Math.hypot(world.y, world.z);
      if (x < 0.729 || x > 1.222) continue;
      const outerRadius = x < g.grooveLeft || x > g.grooveRight ? 0.25 : 0.182;
      const gap = radius - outerRadius;
      minimum = Math.min(minimum, gap);
      assert.ok(gap > -1e-7, 'a follower or lever surface passes into the rotating sleeve: ' + gap);
      checked += 1;
    }
  }
  console.log('047 follower and lever clearance', { poses: 1025, checked, minimum, maxContactError });
});

test('047 fixed section faces occupy the actual keyed solids at both cut planes', () => {
  const model = makeFrictionClutch(), g = model.root.userData.geometry;
  const { input, output, inputSection, outputSection } = model.root.userData.blocks;
  const queries = [input, output].map((member) => new THREE.Mesh(member.userData.body.geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const ray = new THREE.Raycaster(), point = new THREE.Vector3(), direction = new THREE.Vector3(1, 0, 0);
  let checked = 0;
  for (let pose = 0; pose < 512; pose += 1) {
    const angle = 2 * Math.PI * (pose + 0.273) / 512;
    const shift = g.stroke * (pose % 3) / 2;
    output.userData.rotor.rotation.z = angle;
    outputSection.userData.setAngle(angle);
    output.position.x = g.offsetX + shift;
    outputSection.position.x = output.position.x;
    model.root.updateMatrixWorld(true);
    for (let side = 0; side < 2; side += 1) {
      const section = [inputSection, outputSection][side], member = [input, output][side];
      queries[side].matrixWorld.copy(member.userData.body.matrixWorld);
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(queries[side].matrixWorld);
      for (const cap of section.userData.caps) {
        const p = cap.geometry.attributes.position, indices = cap.geometry.index;
        for (let i = 0; i < indices.count; i += 3) {
          const vertices = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + j)));
          if (vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).lengthSq() < 1e-14) continue;
          point.copy(vertices[0]).add(vertices[1]).add(vertices[2]).multiplyScalar(1 / 3).applyMatrix4(cap.matrixWorld);
          assert.ok(Math.abs(point.z) < 1e-7 || Math.abs(point.z - g.sectionBackZ) < 1e-7, 'the cut planes do not rotate');
          ray.set(point, direction);
          const intersections = ray.intersectObject(queries[side], false).filter((hit) => hit.distance > 1e-7);
          assert.ok(intersections.length > 0, 'a section face lies inside its complete physical solid');
          const normal = intersections[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
          assert.ok(normal.dot(direction) > 0, 'the first ray crossing exits the full solid, including the rotating keyway');
          checked += 1;
        }
      }
    }
  }
  console.log('047 section / full-solid consistency', { poses: 512, checked });
});

test('047 the feather fits the actual rotating keyway and its pins fit real bores', () => {
  const model = makeFrictionClutch(), g = model.root.userData.geometry;
  const { output, shaft, feather, lever, follower, followerPin, pivotPin } = model.root.userData.blocks;
  const query = new THREE.Mesh(output.userData.body.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const transform = new THREE.Matrix4(), point = new THREE.Vector3(), direction = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const keyPoints = surfaceCloud(feather.geometry);
  let minimum = Infinity, rays = 0;
  for (let pose = 0; pose <= 128; pose += 1) {
    model.update(g.cycleDuration * pose / 128, 0);
    model.root.updateMatrixWorld(true);
    transform.copy(output.userData.body.matrixWorld).invert().multiply(feather.matrixWorld);
    for (const source of keyPoints) {
      point.copy(source).applyMatrix4(transform);
      if (point.z <= 0.572 + 1e-7 || point.z >= 1.222 - 1e-7) continue;
      direction.set(point.x, point.y, 0).normalize();
      ray.set(new THREE.Vector3(0, 0, point.z), direction);
      const intersections = ray.intersectObject(query, false);
      assert.ok(intersections.length > 0, 'the bore ray hits the actual keyed wall');
      const clearance = intersections[0].distance - Math.hypot(point.x, point.y);
      minimum = Math.min(minimum, clearance);
      assert.ok(clearance > 0, 'the rendered key enters the rendered sleeve');
      rays += 1;
    }
    for (const [pin, bore, radius, localPoint] of [[pivotPin, lever, lever.userData.pivotBore, new THREE.Vector3(0, 0, 0)],
      [followerPin, lever, lever.userData.followerBore, new THREE.Vector3(0, g.leverLength, 0)]]) {
      const center = new THREE.Vector3().setFromMatrixPosition(pin.matrixWorld).applyMatrix4(bore.matrixWorld.clone().invert());
      assert.ok(Math.hypot(center.x - localPoint.x, center.y - localPoint.y) < 1e-12);
      assert.ok(pin.geometry.parameters.radiusTop < radius * Math.cos(Math.PI / 32));
    }
  }
  assert.ok(shaft.userData.shaftRadius < g.boreRadius * Math.cos(Math.PI / 256));
  assert.ok(shaft.userData.keyLeft > 0.467, 'the feather cannot enter the loose input member');
  assert.ok(shaft.userData.keyLeft < 0.572 && shaft.userData.keyRight > 1.222 + g.stroke,
    'the fixed key supports the sleeve throughout its stroke');
  assert.ok(followerPin.geometry.parameters.radiusTop < follower.userData.boreRadius * Math.cos(Math.PI / 256));
  assert.ok(lever.userData.leverBackZ > 0.036, 'lever and follower faces have axial clearance');
  console.log('047 feather / actual bore clearance', { poses: 129, rays, minimum });
});
