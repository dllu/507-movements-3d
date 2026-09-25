import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { makeBandEpicyclic } from '../src/simulation/band-epicyclic.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { gearBoundary, boundaryIndex, planarPairDistance } from '../scripts/lib/coaxial-planar-distance.mjs';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const model = makeBandEpicyclic(), { parts, blocks, geometry: p } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const cross = (a, b) => a.x * b.y - a.y * b.x;

test('057 has eighteen closed solids with consistent outward normals and independent bearings', () => {
  for (const [name, mesh] of Object.entries(parts)) {
    const g = mesh.geometry, edges = new Map(); let volume = 0;
    for (const [i, face] of surfaceTriangles(g).entries()) {
      assert.ok(face.getArea() > 1e-20, `${name}: nonzero face`);
      const normal = face.getNormal(new THREE.Vector3());
      for (let j = 0; j < 3; j += 1) {
        const index = g.index ? g.index.getX(3 * i + j) : 3 * i + j;
        assert.ok(normal.dot(new THREE.Vector3().fromBufferAttribute(g.attributes.normal, index)) > 0, `${name}: outward corner normal`);
      }
      volume += face.a.dot(face.b.clone().cross(face.c)) / 6;
      const keys = [face.a, face.b, face.c].map(v => v.toArray().map(x => Math.round(x * 1e7)).join(','));
      for (let j = 0; j < 3; j += 1) {
        const a = keys[j], b = keys[(j + 1) % 3], key = a < b ? `${a}/${b}` : `${b}/${a}`;
        const edge = edges.get(key) ?? { count: 0, direction: 0 };
        edge.count += 1; edge.direction += a < b ? 1 : -1; edges.set(key, edge);
      }
    }
    assert.ok(volume > 0, `${name}: positive volume`);
    assert.ok([...edges.values()].every(e => e.count === 2 && e.direction === 0), `${name}: closed oriented edges`);
  }
  assert.equal(Object.keys(parts).length, 18);
  assert.equal(parts.sunDrum.parent, parts.sun);
  assert.equal(parts.ringPulley.parent, parts.ring);
  assert.equal(parts.planetAxle.parent, blocks.carrier);
  assert.equal(parts.planet.parent, blocks.carrier);
  assert.notEqual(parts.planetAxle, parts.planet.parent, 'the axle stays with the carrier while the planet spins');
});

test('057 maintains both actual involute contacts and transmits compressive torque through a full relative tooth cycle', () => {
  const points = gearBoundary(parts.planet), targets = Object.fromEntries(['sun', 'ring'].map(name => [name, boundaryIndex(gearBoundary(parts[name]))]));
  for (let i = 0; i < 257; i += 1) {
    setTime(p.relativeToothPeriod * (i + 0.317) / 257);
    const moments = [];
    for (const name of ['sun', 'ring']) {
      const transform = parts[name].matrixWorld.clone().invert().multiply(parts.planet.matrixWorld);
      const result = planarPairDistance(points, targets[name], transform);
      assert.equal(result.intersections, 0, `${name}: no tooth crossing`);
      assert.ok(result.distance > 0.00002 && result.distance < 0.000031, `${name}: small working gap`);
      const { a, b } = result.witness, force = { x: (a.x - b.x) / result.distance, y: (a.y - b.y) / result.distance };
      const center = { x: transform.elements[12], y: transform.elements[13] }, lever = { x: a.x - center.x, y: a.y - center.y };
      moments.push({ planet: cross(lever, force), target: -cross(b, force), carrier: cross(center, force) });
    }
    const [sun, ring] = moments, sunLoad = -ring.planet / sun.planet;
    assert.ok(sunLoad > 0, 'positive normal loads balance the free planet torque');
    const sunMoment = sun.target * sunLoad, ringMoment = ring.target, carrierMoment = sun.carrier * sunLoad + ring.carrier;
    assert.ok(sunMoment < 0 && ringMoment < 0 && carrierMoment > 0, 'ring input supplies sun absorption and carrier output');
    const residual = Math.abs(sunMoment * p.sunSpeed + ringMoment * p.ringSpeed + carrierMoment * p.carrierSpeed);
    assert.ok(residual / Math.abs(ringMoment * p.ringSpeed) < 0.0025, 'actual flank normals preserve power within tessellation error');
  }
});

test('057 carrier and bearing surfaces clear the bands and independently rotating shafts throughout an orbit', () => {
  const names = ['sunShaft', 'carrierSleeve', 'carrierArm', 'planetAxle', 'planet', 'innerBelt'];
  const data = Object.fromEntries(names.map(name => [name, { mesh: parts[name], solid: solidSurface(parts[name].geometry), points: surfacePoints(parts[name].geometry) }]));
  for (let i = 0; i < 13; i += 1) {
    setTime(p.carrierPeriod * i / 12);
    const bandBox = new THREE.Box3().setFromObject(parts.innerBelt, true);
    for (const name of ['carrierSleeve', 'carrierArm', 'planetAxle', 'planetCollar', 'planetCap']) {
      const box = new THREE.Box3().setFromObject(parts[name], true);
      assert.ok(box.min.z - bandBox.max.z > 0.013, `${name}: the full carrier remains in front of the crossed band`);
    }
    for (const [first, second] of [['sunShaft', 'carrierSleeve'], ['sunShaft', 'carrierArm'], ['planetAxle', 'planet']]) {
      for (const [a, b] of [[data[first], data[second]], [data[second], data[first]]]) {
        const matrix = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
        for (const point of a.points) {
          const q = point.clone().applyMatrix4(matrix);
          if (b.solid.inside(q)) assert.ok(b.solid.distance(q) < 1e-6, `${first}/${second}: no bearing penetration`);
        }
      }
    }
  }
});

test('057 round bands fit all four pulley grooves and have separated actual skins at the crossover', () => {
  const names = ['driverPulley', 'sunDrum', 'ringPulley'];
  const solids = Object.fromEntries(names.map(name => [name, solidSurface(parts[name].geometry)]));
  const points = Object.fromEntries(['outerBelt', 'innerBelt'].map(name => [name, surfacePoints(parts[name].geometry)]));
  for (const time of [0, 0.173]) {
    setTime(time);
    for (const [beltName, pulleyName] of [['outerBelt', 'driverPulley'], ['outerBelt', 'ringPulley'], ['innerBelt', 'driverPulley'], ['innerBelt', 'sunDrum']]) {
      const matrix = parts[pulleyName].matrixWorld.clone().invert().multiply(parts[beltName].matrixWorld);
      const solid = solids[pulleyName]; let nearest = 0.003;
      for (const [i, point] of points[beltName].entries()) {
        const q = point.clone().applyMatrix4(matrix);
        assert.equal(solid.inside(q), false, `${beltName}/${pulleyName}: no cord penetration`);
        if (i % 64 === 0) nearest = Math.min(nearest, solid.distance(q, nearest));
      }
      assert.ok(nearest > 0.00015 && nearest < 0.001, `${beltName}/${pulleyName}: actual surfaces remain in working contact`);
    }
  }
  const rope = parts.innerBelt, g = rope.geometry, lengths = rope.userData.curve.getCurveLengths(), length = lengths.at(-1);
  const span = (low, high) => {
    const positions = [];
    for (let i = 0; i < g.index.count; i += 3) {
      const indices = [0, 1, 2].map(j => g.index.getX(i + j));
      if (indices.some(index => g.attributes.uv.getX(index) < low || g.attributes.uv.getX(index) > high)) continue;
      for (const index of indices) positions.push(g.attributes.position.getX(index), g.attributes.position.getY(index), g.attributes.position.getZ(index));
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return triangleTree(geometry);
  };
  const result = meshPairDistance(span(0, lengths[0] / length), span(lengths[1] / length, lengths[2] / length), new THREE.Matrix4(), 0.01);
  // Laid-rope strands meet only at their crowns, so the crossed spans (centrelines
  // 2 * 0.0402 apart) keep a small positive gap between strand surfaces.
  assert.ok(result.witness && result.distance > 0.0002 && result.distance < 0.004, 'mutually supported spans have a small positive skin gap');
});

test('057 keeps physical differential ratios, repeatable seeking and continuous belt material flow', () => {
  const dt = 1e-5;
  for (const time of [-2.13, 0, 0.319, 23.47, 116.26, p.carrierPeriod, 561.12]) {
    setTime(time);
    const matrices = Object.values(parts).map(mesh => mesh.matrixWorld.clone());
    const angles = [parts.sun.rotation.z, parts.ring.rotation.z, blocks.carrier.rotation.z, parts.planet.rotation.z + blocks.carrier.rotation.z];
    const colors = parts.innerBelt.geometry.attributes.position.array.slice();
    setTime(time + dt);
    const next = [parts.sun.rotation.z, parts.ring.rotation.z, blocks.carrier.rotation.z, parts.planet.rotation.z + blocks.carrier.rotation.z];
    for (const [i, speed] of [p.sunSpeed, p.ringSpeed, p.carrierSpeed, p.planetSpeed].entries()) assert.ok(Math.abs((next[i] - angles[i]) / dt - speed) < 1e-7);
    setTime(time + 3.7); setTime(time);
    Object.values(parts).forEach((mesh, i) => assert.ok(mesh.matrixWorld.equals(matrices[i]), 'seeking restores the same physical pose'));
    assert.deepEqual(parts.innerBelt.geometry.attributes.position.array, colors, 'the laid-rope lay also seeks without remembered state');
  }
  assert.ok(Math.abs(p.sunTeeth * (p.sunSpeed - p.carrierSpeed) + p.ringTeeth * (p.ringSpeed - p.carrierSpeed)) < 1e-12);
  assert.equal(model.root.userData.animationTiming.authoredCyclePeriod, p.carrierPeriod, 'the display profile covers a full carrier orbit');
  assert.ok(p.carrierPeriod > 200, 'near cancellation is preserved instead of accelerating the carrier independently');
});
