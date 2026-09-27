import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  STREAM_GRAVITY,
  WaterSpray,
  WaterStream,
  ballisticPath,
  guidedPath,
  joinPaths,
  solveBallisticSpeed,
} from '../src/simulation/water-stream.js';

const near = (a, b, tolerance, message) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);

test('ballistic paths follow the projectile law and carry speed and time of flight', () => {
  const origin = new THREE.Vector3(1, 3, 0), velocity = new THREE.Vector3(2, 0.5, -1);
  const path = ballisticPath({origin, velocity, endY: 0, samples: 20});
  const tEnd = path.times.at(-1);
  near(path.points.at(-1).y, 0, 1e-9, 'stops at endY');
  path.points.forEach((p, i) => {
    const t = path.times[i];
    near(p.x, 1 + 2 * t, 1e-12, 'x');
    near(p.y, 3 + 0.5 * t - 0.5 * STREAM_GRAVITY * t * t, 1e-12, 'y');
    near(path.speeds[i], Math.hypot(2, 0.5 - STREAM_GRAVITY * t, -1), 1e-12, 'speed');
  });
  assert.ok(tEnd > 0);
  const target = new THREE.Vector3(3, 1, 0), direction = new THREE.Vector3(1, 0.5, 0);
  const speed = solveBallisticSpeed({origin: new THREE.Vector3(), direction, target});
  const hit = ballisticPath({origin: new THREE.Vector3(), velocity: direction.clone().normalize().multiplyScalar(speed),
    duration: 3 / (speed * direction.clone().normalize().x), samples: 4}).points.at(-1);
  near(hit.distanceTo(target), 0, 1e-9, 'solved launch speed reaches the target');
});

test('a joined stream is one continuous mesh whose section follows continuity', () => {
  const channel = guidedPath([new THREE.Vector3(-2, 1, 0), new THREE.Vector3(0, 1, 0)], {speed: 1.5, samples: 8});
  const fall = ballisticPath({origin: new THREE.Vector3(0, 1, 0), velocity: new THREE.Vector3(1.5, 0, 0), endY: -1, samples: 16});
  const path = joinPaths(channel, fall);
  assert.equal(path.points.length, 9 + 16, 'shared joint point dropped');
  for (let i = 1; i < path.times.length; i += 1) assert.ok(path.times[i] > path.times[i - 1], 'time increases');
  const stream = new WaterStream(path, {width: 0.3, thickness: 0.05, widthExponent: 0.25, cyclePeriod: 4});
  // No gaps: consecutive section centres are close, and every ring is used by the index.
  for (let i = 1; i < path.points.length; i += 1) assert.ok(path.points[i].distanceTo(path.points[i - 1]) < 0.35);
  const index = stream.geometry.index.array;
  const used = new Set(index);
  const ring = stream.options.radialSegments + 1;
  for (let i = 0; i < path.points.length * ring; i += 1) assert.ok(used.has(i), 'every side vertex is stitched');
  // Section area (a * b) goes as flow / speed.
  const [a0, b0] = stream.sectionAt(0);
  const last = path.points.length - 1;
  const [a1, b1] = stream.sectionAt(last);
  near((a1 * b1) / (a0 * b0), path.speeds[0] / path.speeds[last], 1e-9, 'continuity');
  // Changing the flow rewrites the same buffers.
  const buffer = stream.geometry.attributes.position.array;
  stream.setFlow(2);
  assert.equal(stream.geometry.attributes.position.array, buffer, 'buffers reused');
  const [a2, b2] = stream.sectionAt(0);
  near((a2 * b2) / (a0 * b0), 2, 1e-9, 'area doubles with flow');
  // Playback scrolls texture only, seamlessly over the loop.
  const before = Float32Array.from(buffer);
  stream.update(1.3);
  assert.deepEqual(Float32Array.from(stream.geometry.attributes.position.array), before, 'no geometry work per frame');
  const offsetAt = (t) => { stream.update(t); return stream.material.map.offset.y; };
  near(THREE.MathUtils.euclideanModulo(offsetAt(0) - offsetAt(4), 1) % 1, 0, 1e-9, 'texture loop closes');
  // Front faces are outward: the first side triangle's winding agrees with its normals.
  const p = stream.geometry.attributes.position, n = stream.geometry.attributes.normal;
  const [i0, i1, i2] = index;
  const v = (k) => new THREE.Vector3().fromBufferAttribute(p, k);
  const face = v(i1).sub(v(i0)).cross(v(i2).sub(v(i0)));
  assert.ok(face.dot(new THREE.Vector3().fromBufferAttribute(n, i0)) > 0, 'winding matches normals');
  stream.geometry.dispose();
  stream.material.dispose();
});

test('spray is capped, deterministic and loops with the cycle', () => {
  const spray = new WaterSpray({origin: new THREE.Vector3(), count: 500, lifetime: 0.4, cyclePeriod: 4.1});
  assert.equal(spray.count, 64, 'instance count capped');
  const matrixAt = (t) => { spray.update(t); return Array.from(spray.instanceMatrix.array); };
  const a = matrixAt(0.7), b = matrixAt(0.7 + 4.1);
  a.forEach((value, i) => near(value, b[i], 1e-9, 'periodic'));
  assert.equal(spray.castShadow, false);
  spray.castShadow = true;
  assert.equal(spray.castShadow, false, 'water never casts shadows');
});
