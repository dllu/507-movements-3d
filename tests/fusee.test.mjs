import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { makeFuseeMotion, fuseeParameters } from '../src/simulation/fusee-motion.js';
import { steppedFuseeGeometry } from '../src/simulation/fusee-geometry.js';
import { fuseeSpringGeometry } from '../src/simulation/fusee-spring.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function assertClosedOutward(geometry) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, index = geometry.index;
  const edges = new Map();
  const vertices = Array.from({ length: p.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, i));
  const keys = vertices.map((v) => v.toArray().map((x) => Math.round(x * 1e6)).join(','));
  let volume = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((j) => index ? index.getX(i + j) : i + j);
    const [a, b, c] = ids.map((j) => vertices[j]);
    const cross = b.clone().sub(a).cross(c.clone().sub(a));
    if (cross.lengthSq() < 1e-20) continue;
    assert.ok(cross.dot(new THREE.Vector3().fromBufferAttribute(n, ids[0])) > -1e-10,
      'shading normals agree with visible triangle winding');
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j += 1) {
      const a = keys[ids[j]], b = keys[ids[(j + 1) % 3]];
      const key = a < b ? a + ':' + b : b + ':' + a;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((count) => count === 2), 'every rendered edge bounds two faces');
  assert.ok(volume > 0, 'the closed surface faces outward');
}

test('046 fixes every rigid chain pitch and both rotating attachments throughout winding', () => {
  const motion = makeFuseeMotion(), p = fuseeParameters;
  let previous;
  for (let sample = 0; sample <= 256; sample += 1) {
    const state = motion.stateAtProgress(sample / 256);
    assert.equal(state.pins.length, state.linkCount + 1);
    assert.ok(Math.abs(state.residual) < 2e-9);
    let length = 0;
    for (let i = 0; i < state.linkCount; i += 1) {
      const distance = state.pins[i].distanceTo(state.pins[i + 1]);
      assert.ok(Math.abs(distance - state.linkPitch) < 1e-10, 'individual links cannot stretch');
      length += distance;
    }
    assert.ok(Math.abs(length - motion.totalChainLength) < 1e-8);
    const first = new THREE.Vector3(p.barrelCenterX + p.barrelRadius * Math.cos(state.barrelAngle),
      p.barrelChainZTop, -p.barrelRadius * Math.sin(state.barrelAngle));
    const endAngle = state.fuseeAngle + 2 * Math.PI * p.grooveTurns;
    const last = new THREE.Vector3(p.fuseeCenterX + p.fuseeBottomRadius * Math.cos(endAngle),
      p.fuseeZBottom, -p.fuseeBottomRadius * Math.sin(endAngle));
    assert.ok(state.pins[0].distanceTo(first) < 1e-10);
    assert.ok(state.pins.at(-1).distanceTo(last) < 2e-9);
    if (previous) {
      assert.ok(state.barrelTurns > previous.barrelTurns);
      assert.ok(state.fuseeLength < previous.fuseeLength);
      assert.ok(state.fuseeRadius >= previous.fuseeRadius - 1e-12, 'the contact never steps back up a tier');
    }
    previous = state;
  }
});

test('046 helical-ledge fusee and deforming ribbon remain closed with outward shading', () => {
  const motion = makeFuseeMotion();
  const body = steppedFuseeGeometry(fuseeParameters);
  assertClosedOutward(body);
  const ribbon = fuseeSpringGeometry(motion.stateAtProgress(0, false).barrelAngle);
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const state = motion.stateAtProgress(progress, false);
    ribbon.userData.setBarrelAngle(state.barrelAngle);
    assertClosedOutward(ribbon);
    const data = ribbon.userData;
    assert.ok(Math.abs(data.currentNeutralLength - data.neutralLength) < 1e-8);
    const inner = data.centers[0], outer = data.centers.at(-1);
    assert.ok(inner.distanceTo(new THREE.Vector3(data.innerRadius * Math.cos(data.innerAngle),
      data.innerRadius * Math.sin(data.innerAngle), 0)) < 1e-12, 'the inner end stays on its fixed clamp');
    assert.ok(outer.distanceTo(new THREE.Vector3(data.outerRadius * Math.cos(state.barrelAngle),
      data.outerRadius * Math.sin(state.barrelAngle), 0)) < 1e-12, 'the outer end follows the barrel clamp');
    const positions = ribbon.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      assert.ok(radius > 0.104 && radius < 0.93, 'moving coils clear the arbor and barrel wall');
      assert.ok(positions.getZ(i) > -0.50 && positions.getZ(i) < 0.55, 'ribbon clears the cup floor and rim');
    }
  }
});

test('046 tilted joint pins fit the rendered bores of every chain plate and end clevis', () => {
  const model = createMovementModel(catalog.movements[45]);
  const { chain, barrelAnchor, fuseeAnchor, springBox, fusee } = model.root.userData.blocks;
  const motion = model.root.userData.motion, data = chain.userData;
  const plate = new THREE.Matrix4(), pin = new THREE.Matrix4(), transform = new THREE.Matrix4();
  const center = new THREE.Vector3(), axis = new THREE.Vector3();
  let minimum = Infinity, checked = 0;
  const inspect = (plateMatrix, pinMatrix, boreX, thickness, radius) => {
    transform.copy(plateMatrix).invert().multiply(pinMatrix);
    center.setFromMatrixPosition(transform);
    axis.set(0, 1, 0).transformDirection(transform);
    for (const z of [-thickness / 2, thickness / 2]) {
      const distance = (z - center.z) / axis.z;
      assert.ok(Math.abs(distance) + data.pinRadius * Math.hypot(axis.x, axis.y) / Math.abs(axis.z) < 0.037,
        'the finite joint pin reaches through the complete plate thickness');
      const x = center.x + axis.x * distance - boreX, y = center.y + axis.y * distance;
      // The oblique pin ellipse lies inside this circle. The actual bored
      // polygon contains the inscribed circle used as the available space.
      const clearance = radius * Math.cos(Math.PI / 16) - Math.hypot(x, y) - data.pinRadius / Math.abs(axis.z);
      minimum = Math.min(minimum, clearance);
      assert.ok(clearance > 0, 'a pin enters a plate wall at a changing helix/span angle: ' + clearance);
      checked += 1;
    }
  };
  const steps = 1024;
  for (let sample = 0; sample <= steps; sample += 1) {
    const state = motion.stateAtProgress(sample / steps);
    data.setState(state);
    springBox.userData.rotor.rotation.z = state.barrelAngle;
    fusee.userData.rotor.rotation.z = state.fuseeAngle;
    model.root.updateMatrixWorld(true);
    let evenIndex = 0, oddIndex = 0;
    for (let i = 0; i < data.linkCount; i += 1) {
      const mesh = i % 2 === 0 ? data.evenPlates : data.oddPlates;
      for (let leaf = 0; leaf < (i % 2 === 0 ? 3 : 2); leaf += 1) {
        mesh.getMatrixAt(i % 2 === 0 ? evenIndex++ : oddIndex++, plate);
        for (const end of [0, 1]) {
          data.pins.getMatrixAt(i + end, pin);
          inspect(plate, pin, (end - 0.5) * state.linkPitch, data.plateThickness, data.boreRadius);
        }
      }
    }
    for (const [anchor, end] of [[barrelAnchor, 0], [fuseeAnchor, data.linkCount]]) {
      const expected = anchor.userData.pinCenter.clone().applyMatrix4(anchor.matrixWorld);
      assert.ok(expected.distanceTo(state.pins[end]) < 2e-9, 'clevis bore and terminal chain pin remain concentric');
      data.pins.getMatrixAt(end, pin);
      for (const leaf of anchor.children) {
        inspect(leaf.matrixWorld, pin, anchor.userData.pinRadius, anchor.userData.thickness, anchor.userData.boreRadius);
      }
    }
  }
  console.log('046 pin/bore clearance', { poses: steps + 1, checked, minimum });
});

test('046 adjacent articulated leaves remain in separate axial slabs', () => {
  const model = createMovementModel(catalog.movements[45]);
  const data = model.root.userData.blocks.chain.userData, motion = model.root.userData.motion;
  const half = new THREE.Vector3(data.linkPitch / 2 + data.plateRadius, data.plateRadius, data.plateThickness / 2);
  const transform = new THREE.Matrix4();
  let minimum = Infinity, checked = 0;
  for (let sample = 0; sample <= 128; sample += 1) {
    data.setState(motion.stateAtProgress(sample / 128));
    const groups = [], leaves = [data.evenPlates, data.oddPlates];
    const counts = [0, 0];
    for (let i = 0; i < data.linkCount; i += 1) {
      const side = i % 2;
      groups.push(Array.from({ length: side === 0 ? 3 : 2 }, () => {
        const matrix = new THREE.Matrix4();
        leaves[side].getMatrixAt(counts[side]++, matrix);
        return matrix;
      }));
    }
    for (let i = 1; i < groups.length; i += 1) {
      for (const left of groups[i - 1]) for (const right of groups[i]) {
        // A separating axis along either leaf's extrusion normal proves
        // their complete bounding boxes (and hence all triangles) disjoint.
        let separation = -Infinity;
        for (const [first, second] of [[left, right], [right, left]]) {
          transform.copy(first).invert().multiply(second);
          const e = transform.elements;
          const projected = Math.abs(e[2]) * half.x + Math.abs(e[6]) * half.y + Math.abs(e[10]) * half.z;
          separation = Math.max(separation, Math.abs(e[14]) - half.z - projected);
        }
        minimum = Math.min(minimum, separation);
        assert.ok(separation > 0, 'neighboring chain leaves overlap: ' + separation);
        checked += 1;
      }
    }
  }
  console.log('046 neighboring plate separation', { poses: 129, checked, minimum });
});

test('046 chain surfaces clear the actual fusee triangles on the helical ledge', () => {
  const model = createMovementModel(catalog.movements[45]);
  const { chain, fusee, springBox } = model.root.userData.blocks;
  const data = chain.userData, motion = model.root.userData.motion;
  const geometry = fusee.userData.body.geometry;
  const p = (geometry.index ? geometry.toNonIndexed() : geometry).attributes.position;
  const bucketCount = 512, buckets = Array.from({ length: bucketCount }, () => []);
  const bucketFor = (point) => Math.floor(THREE.MathUtils.euclideanModulo(Math.atan2(point.y, point.x), 2 * Math.PI)
    / (2 * Math.PI) * bucketCount) % bucketCount;
  for (let i = 0; i < p.count; i += 3) {
    const vertices = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(p, i + j));
    if (Math.max(...vertices.map((v) => v.z)) - Math.min(...vertices.map((v) => v.z)) < 1e-8) continue;
    const triangle = new THREE.Triangle(...vertices);
    const middle = vertices[0].clone().add(vertices[1]).add(vertices[2]);
    const bucket = bucketFor(middle);
    for (const offset of [-1, 0, 1]) buckets[(bucket + offset + bucketCount) % bucketCount].push(triangle);
  }
  const point = new THREE.Vector3(), local = new THREE.Vector3(), hit = new THREE.Vector3();
  const transform = new THREE.Matrix4(), inverse = new THREE.Matrix4();
  const ray = new THREE.Ray(), direction = new THREE.Vector3();
  const pinMatrix = new THREE.Matrix4(), pinPositions = data.pins.geometry.attributes.position;
  let minimum = Infinity, minimumBarrel = Infinity, checked = 0;
  for (let sample = 0; sample <= 128; sample += 1) {
    const state = motion.stateAtProgress(sample / 128);
    data.setState(state);
    fusee.userData.rotor.rotation.z = state.fuseeAngle;
    model.root.updateMatrixWorld(true);
    inverse.copy(fusee.userData.body.matrixWorld).invert();
    const inspect = () => {
      minimumBarrel = Math.min(minimumBarrel, Math.hypot(point.x - motion.parameters.barrelCenterX, point.z)
        - springBox.userData.barrelOuterRadius);
      if (Math.hypot(local.x, local.y) > 1.24) return;
      assert.ok(local.z > geometry.userData.bodyBottom && local.z < geometry.userData.bodyTop,
        'the moving chain stays between both solid terminal disks');
      direction.set(local.x, local.y, 0).normalize();
      ray.origin.set(0, 0, local.z);
      ray.direction.copy(direction);
      let radius = 0;
      for (const triangle of buckets[bucketFor(local)]) {
        if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) {
          radius = Math.max(radius, Math.hypot(hit.x, hit.y));
        }
      }
      assert.ok(radius > 0, 'the independent radial ray hits the actual machined body');
      const clearance = Math.hypot(local.x, local.y) - radius;
      minimum = Math.min(minimum, clearance);
      assert.ok(clearance > 0, 'a chain plate or pin enters a rendered ledge: ' + clearance);
      checked += 1;
    };
    for (let link = 0; link < data.linkCount; link += 1) {
      const halfWidth = link % 2 === 0 ? 0.030 : 0.017;
      transform.copy(inverse).multiply(data.links[link].matrix);
      for (const z of [-halfWidth, halfWidth]) {
        // Both axial edges of the inward plate face, including the straight
        // edge and cap extremes. These are actual rendered surface points.
        for (const [x, y] of [[-data.linkPitch / 2, data.plateRadius], [0, data.plateRadius],
          [data.linkPitch / 2, data.plateRadius], [-data.linkPitch / 2 - data.plateRadius, 0],
          [data.linkPitch / 2 + data.plateRadius, 0]]) {
          point.set(x, y, z).applyMatrix4(data.links[link].matrix);
          local.set(x, y, z).applyMatrix4(transform);
          inspect();
        }
      }
    }
    for (let pin = 0; pin < data.pins.count; pin += 1) {
      data.pins.getMatrixAt(pin, pinMatrix);
      transform.copy(inverse).multiply(pinMatrix);
      for (let vertex = 0; vertex < pinPositions.count; vertex += 1) {
        point.fromBufferAttribute(pinPositions, vertex).applyMatrix4(pinMatrix);
        local.fromBufferAttribute(pinPositions, vertex).applyMatrix4(transform);
        inspect();
      }
    }
  }
  assert.ok(minimumBarrel > 0);
  assert.ok(minimum < 0.003, 'the winding chain stays close to the working riser');
  console.log('046 chain / actual fusee triangles', { poses: 129, rays: checked, minimum, minimumBarrel });
});

test('046 p99: one helical ledge on a cone — radial steps only, none round the circumference', () => {
  const p = fuseeParameters, geometry = steppedFuseeGeometry(p), body = geometry.userData;
  const turn = 2 * Math.PI;
  assert.equal(body.helicalLedge, true);
  // Every vertical face of the body faces radially (riser or rim): there is
  // no step face across the circumference anywhere.
  const position = geometry.attributes.position;
  let vertical = 0;
  for (let i = 0; i < position.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(position, i + k));
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() < 1e-20) continue;
    normal.normalize();
    if (Math.abs(normal.z) > 1e-3) continue;
    const middle = a.clone().add(b).add(c).setZ(0).normalize();
    assert.ok(Math.abs(normal.dot(middle)) > 0.99, 'a vertical face must face radially, not tangentially');
    vertical += 1;
  }
  assert.ok(vertical > 1000);
  // Followed round the circumference just outside a riser, the tread height
  // changes continuously (linearly with angle): one helix, no jumps.
  for (const start of [0, 3, 7.5, 12]) {
    let previous;
    for (let i = 0; i <= 2000; i += 1) {
      const theta = start + turn * i / 2000;
      const height = body.surfaceHeightAt(body.riserRadiusAt(theta) + p.riserGap, theta);
      if (previous !== undefined) assert.ok(Math.abs(height - previous) < p.leadPerTurn / 2000 + 1e-9, 'no step round the circumference');
      previous = height;
    }
  }
  // Radially the section is a staircase: one lead per turn outward.
  for (const theta of [1, 5, 9]) {
    const inner = body.surfaceHeightAt(body.riserRadiusAt(theta) + 0.05, theta);
    const outer = body.surfaceHeightAt(body.riserRadiusAt(theta + turn) + 0.05, theta);
    assert.ok(Math.abs(inner - outer - p.leadPerTurn) < 1e-9);
  }
  // The chain centre line is the Archimedean spiral in plan and a conical helix.
  const path = makeFuseeMotion().tierPath;
  for (let i = 0; i <= 400; i += 1) {
    const theta = path.wrapAngle * i / 400, point = path.at(theta);
    assert.ok(Math.abs(point.radius - p.chainRadiusStart - p.radialPitch * theta / turn) < 1e-12);
    assert.ok(Math.abs(point.height - p.fuseeZTop + p.leadPerTurn * theta / turn) < 1e-12);
  }
});

test('046 p99: the chain lies on the helical tread against the riser all the way, never hovering', () => {
  const p = fuseeParameters, motion = makeFuseeMotion(), body = steppedFuseeGeometry(p).userData;
  const turn = 2 * Math.PI, slope = p.radialPitch / turn;
  let total = 0, minimumBacking = Infinity;
  for (let sample = 0; sample <= 96; sample += 1) {
    const state = motion.stateAtProgress(sample / 96);
    const onFusee = state.barrelLength + state.spanLength;
    state.pins.forEach((pin, index) => {
      if (state.stations[index] <= onFusee + 1e-9) return;
      const x = pin.x - p.fuseeCenterX, y = -pin.z, radius = Math.hypot(x, y);
      const phi = Math.atan2(y, x) - state.fuseeAngle;
      const base = THREE.MathUtils.euclideanModulo(phi, turn);
      const theta = base + turn * Math.round((radius - p.chainRadiusStart - slope * base) / p.radialPitch);
      total += 1;
      assert.ok(Math.abs(radius - p.riserGap - body.riserRadiusAt(theta)) < 1e-6, 'the pin runs against the spiral riser');
      const tread = p.topTread - p.leadPerTurn * theta / turn;
      assert.ok(Math.abs(pin.y - 0.037 - tread - 0.002) < 1e-6, 'the pin ends sit 0.002 over the helical tread');
      // The riser behind stands above the chain.
      const riserTop = body.surfaceHeightAt(body.riserRadiusAt(theta) - 1e-4, theta);
      minimumBacking = Math.min(minimumBacking, riserTop - (pin.y + 0.037));
    });
  }
  assert.ok(total > 3000);
  assert.ok(minimumBacking > 0.1, 'the riser backs the whole chain height: ' + minimumBacking);
  console.log('046 helical seating', { poses: 97, pins: total, minimumBacking });
});

test('046 p99: the span leaves along the helix, clears the ledge, and the barrel lays separate turns', () => {
  const p = fuseeParameters, motion = makeFuseeMotion(), body = steppedFuseeGeometry(p).userData;
  let maximumSlope = 0, minimumClearance = Infinity;
  for (let sample = 0; sample <= 400; sample += 1) {
    const state = motion.stateAtProgress(sample / 400, sample % 8 === 0);
    const run = state.barrelContact.clone().sub(state.fuseeContact);
    const angle = Math.atan2(run.y, Math.hypot(run.x, run.z));
    maximumSlope = Math.max(maximumSlope, angle);
    // The span rises towards the barrel at the helix's own lead angle.
    const point = motion.tierPath.at(2 * Math.PI * p.grooveTurns * state.progress);
    assert.ok(Math.abs(Math.tan(angle) + point.dHeight / Math.hypot(point.radius, point.dRadius)) < 1e-9);
    if (!state.pins) continue;
    // Span pins over the fusee clear the ledge surface under both plate edges.
    state.pins.forEach((pin, index) => {
      const station = state.stations[index];
      if (station <= state.barrelLength || station >= state.barrelLength + state.spanLength - 1e-9) return;
      const x = pin.x - p.fuseeCenterX, y = -pin.z, radius = Math.hypot(x, y);
      if (radius > p.baseRadius + 0.02) return;
      const phi = Math.atan2(y, x) - state.fuseeAngle;
      for (const offset of [-0.017, 0, 0.017]) {
        const surface = body.surfaceHeightAt(radius + offset, phi);
        minimumClearance = Math.min(minimumClearance, pin.y - 0.037 - surface);
      }
    });
  }
  assert.ok(minimumClearance > 0, 'the span clears the ledge: ' + minimumClearance);
  assert.ok(maximumSlope < 4.3 * Math.PI / 180, 'the lead angle is small: ' + maximumSlope);
  // Barrel: each turn lies clear below the last.
  const end = motion.stateAtProgress(1, false).barrelLength;
  let minimumDrop = Infinity;
  for (let sigma = 0; sigma < end; sigma += 0.01) {
    const target = motion.barrelTurnsAtLength(sigma) + 1;
    let low = sigma, high = sigma + 8;
    while (high - low > 1e-6) {
      const middle = (low + high) / 2;
      if (motion.barrelTurnsAtLength(middle) < target) low = middle; else high = middle;
    }
    if (low < end) minimumDrop = Math.min(minimumDrop, motion.barrelHeightAtLength(sigma) - motion.barrelHeightAtLength(low));
  }
  assert.ok(minimumDrop > 0.1, 'each barrel turn lies clear below the last: ' + minimumDrop);
  console.log('046 span and barrel', { maximumSlopeDegrees: maximumSlope * 180 / Math.PI, minimumClearance, minimumDrop });
});

// Closest distance between nondegenerate finite segments, including
// parallel cases. Used with conservative swept solids, independently of
// the helical chain construction and the spring's radial parameterization.
function segmentDistance(a, b, c, d) {
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = d.x - c.x, vy = d.y - c.y, vz = d.z - c.z;
  const wx = a.x - c.x, wy = a.y - c.y, wz = a.z - c.z;
  const aa = ux * ux + uy * uy + uz * uz, bb = ux * vx + uy * vy + uz * vz;
  const cc = vx * vx + vy * vy + vz * vz, dd = ux * wx + uy * wy + uz * wz;
  const ee = vx * wx + vy * wy + vz * wz, denominator = aa * cc - bb * bb;
  let s = denominator > 1e-20 ? THREE.MathUtils.clamp((bb * ee - cc * dd) / denominator, 0, 1) : 0;
  let t = (bb * s + ee) / cc;
  if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-dd / aa, 0, 1); }
  else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((bb - dd) / aa, 0, 1); }
  return Math.hypot(wx + ux * s - vx * t, wy + uy * s - vy * t, wz + uz * s - vz * t);
}

test('046 separate chain portions and spring turns do not pass through one another', () => {
  const motion = makeFuseeMotion();
  const ribbon = fuseeSpringGeometry(motion.stateAtProgress(0, false).barrelAngle);
  let minChain = Infinity, minSpring = Infinity, chainPairs = 0, springPairs = 0;
  for (let sample = 0; sample <= 64; sample += 1) {
    const state = motion.stateAtProgress(sample / 64);
    ribbon.userData.setBarrelAngle(state.barrelAngle);
    for (let a = 0; a < state.linkCount; a += 1) {
      for (let b = a + 2; b < state.linkCount; b += 1) {
        const gap = segmentDistance(state.pins[a], state.pins[a + 1], state.pins[b], state.pins[b + 1]) - 2 * 0.038;
        minChain = Math.min(minChain, gap);
        assert.ok(gap > 0, 'nonadjacent links or pins intersect their conservative swept capsules');
        chainPairs += 1;
      }
    }
    const data = ribbon.userData, centers = data.centers;
    const halfTurn = Math.floor(data.segments * Math.PI / data.angle);
    for (let a = 0; a < centers.length - 1; a += 1) {
      for (let b = a + halfTurn; b < centers.length - 1; b += 1) {
        const gap = segmentDistance(centers[a], centers[a + 1], centers[b], centers[b + 1]) - data.thickness;
        minSpring = Math.min(minSpring, gap);
        assert.ok(gap > 0, 'distinct ribbon turns enter one another');
        springPairs += 1;
      }
    }
  }
  console.log('046 chain and spring self-clearance', { poses: 65, chainPairs, springPairs, minChain, minSpring });
});

test('046 p93: the chain is dark steel, so it does not read as a white dashed line on the page', () => {
  const model = createMovementModel(catalog.movements[45]);
  const data = model.root.userData.blocks.chain.userData;
  for (const mesh of [data.evenPlates, data.oddPlates, data.pins]) assert.ok(mesh.material.color.getHSL({}).l < 0.4);
});
