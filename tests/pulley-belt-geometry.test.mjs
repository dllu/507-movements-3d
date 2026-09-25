import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { flatBeltGeometry } from '../src/simulation/belt-geometry.js';
import { beltCurveCrossed, beltCurveOpen, makePulley, makeMovingBelt } from '../src/simulation/primitives.js';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const modelFor = (id) => createMovementModel(catalog.movements[id - 1]);

function assertClosedOutward(geometry) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const vertices = Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i));
  const keys = vertices.map((point) => point.toArray().map((value) => Math.round(value * 1e6)).join(','));
  const edges = new Map();
  let volume = 0;
  const indices = geometry.index.array;
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = [indices[i], indices[i + 1], indices[i + 2]];
    const [a, b, c] = triangle.map((index) => vertices[index]);
    const cross = b.clone().sub(a).cross(c.clone().sub(a));
    assert.ok(cross.length() > 1e-10, 'surface triangles have nonzero area');
    const normals = triangle.map((index) => new THREE.Vector3().fromBufferAttribute(normal, index));
    assert.ok(cross.dot(normals[0].add(normals[1]).add(normals[2])) > 0, 'shading normals face out with the triangle winding');
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const start = keys[triangle[edgeIndex]];
      const end = keys[triangle[(edgeIndex + 1) % 3]];
      const key = [start, end].sort().join(':');
      const edge = edges.get(key) ?? { count: 0, direction: 0 };
      edge.count += 1;
      edge.direction += start < end ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, 'the belt encloses positive material volume');
  for (const edge of edges.values()) assert.deepEqual(edge, { count: 2, direction: 0 });
}

test('flat closed and quarter-twisted open bands have closed outward skins with sharp section edges', () => {
  const open = new THREE.LineCurve3(new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 2, 0));
  const closed = beltCurveOpen(new THREE.Vector2(-2, 0), new THREE.Vector2(2, 0), 0.8, 1.1);
  const crossed = beltCurveCrossed(new THREE.Vector2(0, 2), new THREE.Vector2(0, -2), 0.8, 0.8);
  for (const [curve, options] of [
    [closed, {}],
    [crossed, {}],
    [open, { closed: false, widthDirection: (u) => new THREE.Vector3(Math.sin(u * Math.PI / 2), 0, Math.cos(u * Math.PI / 2)) }],
  ]) {
    const geometry = flatBeltGeometry(curve, options);
    assertClosedOutward(geometry);
    geometry.dispose();
  }
});

test('four-spoke pulley has real openings between four radial spokes', () => {
  const pulley = makePulley({ radius: 1, width: 0.3, spokes: 4 });
  pulley.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (let i = 0; i < 4; i += 1) {
    for (const [offset, expectedHit] of [[0, true], [Math.PI / 4, false]]) {
      const angle = i * Math.PI / 2 + offset;
      ray.set(new THREE.Vector3(0.55 * Math.cos(angle), 0.55 * Math.sin(angle), 2), new THREE.Vector3(0, 0, -1));
      assert.equal(ray.intersectObject(pulley, true).length > 0, expectedHit);
    }
  }
});

test('belt markers remain narrow surface stripes instead of large beads', () => {
  const curve = beltCurveOpen(new THREE.Vector2(-2, 0), new THREE.Vector2(2, 0), 0.8, 0.8);
  for (const options of [{ radius: 0.05 }, { width: 0.18, thickness: 0.024 }]) {
    const belt = makeMovingBelt(curve, options);
    const marker = belt.children.find((child) => child.userData.isFlowMarker);
    marker.geometry.computeBoundingBox();
    const size = marker.geometry.boundingBox.getSize(new THREE.Vector3());
    if (options.width) {
      assert.ok(size.y < 0.027 && size.z < 0.036);
    } else {
      assert.ok(Math.max(size.x, size.y, size.z) < 0.106);
    }
  }
});

test('opening flat bands clear the actual pulley flanges as well as the treads', () => {
  for (const id of [1, 2, 3, 5, 6, 7, 11]) {
    const model = modelFor(id);
    const { belt } = model.root.userData.blocks;
    const pulleys = [];
    model.root.traverse((object) => { if (object.userData.tread) pulleys.push(object); });
    for (const time of [0, 0.5, 3.5, 6, 8]) {
      model.update(time, 0.016);
      model.root.updateMatrixWorld(true);
      const mesh = belt.userData.mesh;
      const positions = mesh.geometry.attributes.position;
      for (const pulley of pulleys) {
        const inverse = pulley.userData.rotor.matrixWorld.clone().invert();
        // Retired ink-outline rims are hidden placeholders, not flanges.
        const flanges = pulley.userData.rotor.children.filter((object) => object.geometry?.type === 'TorusGeometry'
          && !object.userData.retiredInkOutline);
        for (let i = 0; i < positions.count; i += 1) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
          for (const flange of flanges) {
            const { radius, tube } = flange.geometry.parameters;
            const gap = Math.hypot(Math.hypot(point.x, point.y) - radius, point.z - flange.position.z) - tube;
            assert.ok(gap > -1e-6, 'movement ' + id + ' band clears the flange solid, gap ' + gap);
          }
        }
      }
    }
  }
});

test('003 guide wheels align in the source elevation and their complete rendered bounds are separated', () => {
  const model = modelFor(3);
  const { guideA, guideB } = model.root.userData.blocks;
  model.root.updateMatrixWorld(true);
  const boundsA = new THREE.Box3().setFromObject(guideA);
  const boundsB = new THREE.Box3().setFromObject(guideB);
  assert.ok(boundsA.min.z > boundsB.max.z + 0.25, 'entire guide rims and hubs have axial clearance');
  assert.ok(Math.abs(guideA.position.y - guideB.position.y) < 1e-8);
  assert.ok(Math.abs(guideA.position.x - guideB.position.x) < 0.01);
});

test('all four speed steps fit the same physical band and sit on horizontal shafts stacked vertically', () => {
  const model = modelFor(8);
  const { driver, driven, belts } = model.root.userData.blocks;
  model.root.updateMatrixWorld(true);
  assert.equal(driver.userData.radii.length, 4);
  assert.equal(driven.userData.radii.length, 4);
  assert.ok(driver.getWorldPosition(new THREE.Vector3()).y > driven.getWorldPosition(new THREE.Vector3()).y + 5);
  const axis = new THREE.Vector3(0, 0, 1).transformDirection(driver.matrixWorld);
  assert.ok(Math.abs(axis.x) > 0.9999);
  const lengths = belts.map((belt) => belt.userData.curve.getLength());
  assert.ok(Math.max(...lengths) - Math.min(...lengths) < 2e-5, 'full tangent-and-wrap lengths agree');
  for (const [index, belt] of belts.entries()) {
    const positions = belt.userData.mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i);
      for (const pulley of [driver, driven]) {
        const radialDistance = Math.hypot(point.x - pulley.position.x, point.y - pulley.position.y);
        const radius = pulley.userData.radii[index];
        assert.ok(radialDistance >= radius - 1e-6, 'band vertices clear the actual tread radius');
      }
    }
  }
});

test('speed step motion is seekable and its position derivatives match the declared ratios', () => {
  const model = modelFor(8);
  const time = 5.6;
  const dt = 0.0001;
  model.update(time, 0);
  const before = { ...model.root.userData.kinematics };
  model.update(time + dt, dt);
  const after = model.root.userData.kinematics;
  assert.ok(Math.abs((after.driverAngle - before.driverAngle) / dt + before.driverAngularSpeed) < 1e-5);
  assert.ok(Math.abs((after.drivenAngle - before.drivenAngle) / dt + before.drivenAngularSpeed) < 1e-5);
  model.update(0, 0);
  for (let i = 1; i <= 100; i += 1) model.update(time * i / 100, time / 100);
  assert.equal(model.root.userData.kinematics.driverAngle, before.driverAngle);
  assert.equal(model.root.userData.kinematics.drivenAngle, before.drivenAngle);
  for (const shift of [4.2, 8.4, 12.6, 16.8]) {
    model.update(shift, 0);
    assert.ok(Math.abs(model.root.userData.kinematics.driverAngularSpeed) < 1e-10, 'the drive stops when the band changes steps');
  }
});

test('007 traverses a flat band over one upper drum and three unobstructed lower treads', () => {
  const model = modelFor(7);
  const { driver, lowerPulleys, belt } = model.root.userData.blocks;
  assert.ok(driver.userData.width > 1.2, 'one broad drum supports the complete selector travel');
  assert.equal(lowerPulleys.length, 3);
  for (const time of [0, 3.3, 3.5, 3.7, 5, 7.5, 11.5, 13, 15.5]) {
    model.update(time, 0.016);
    model.root.updateMatrixWorld(true);
    const mesh = belt.userData.mesh;
    const positions = mesh.geometry.attributes.position;
    for (const pulley of [driver, ...lowerPulleys]) {
      const inverse = pulley.userData.rotor.matrixWorld.clone().invert();
      for (let i = 0; i < positions.count; i += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        if (Math.abs(point.z) < pulley.userData.width / 2) {
          assert.ok(Math.hypot(point.x, point.y) >= pulley.userData.treadRadius - 1e-6,
            'the shifting band stays outside the complete cylindrical tread');
        }
      }
    }
  }
});

test('sector-band material advances once with wrap transfer and has clearance at the crossing', () => {
  const model = modelFor(6);
  model.update(0);
  const { belt } = model.root.userData.blocks;
  // The band ends are fixed to the sector, so arc length from the first
  // anchor is a material coordinate even though no flow stripes are drawn.
  const materialPoint = (s) => belt.userData.curve.getPointAt(s / belt.userData.curve.getLength());
  const length = belt.userData.curve.getLength();
  let material = null;
  for (let i = 0; i <= 400 && material === null; i += 1) {
    const point = materialPoint(length * i / 400);
    if (point.y < -2.45 && Math.abs(point.x) < 1.4) material = length * i / 400;
  }
  assert.ok(material !== null, 'a material point is on the straight lower leaf');
  const before = materialPoint(material);
  const speed = model.root.userData.kinematics.beltSpeed;
  model.update(0.0001);
  assert.ok(Math.abs(belt.userData.curve.getLength() - length) < 1e-9);
  assert.ok(Math.abs(materialPoint(material).distanceTo(before) / 0.0001 - speed) < 0.001);
  const outgoing = belt.userData.curve.curves[1];
  const returning = belt.userData.curve.curves[5];
  const a = outgoing.getPoint(outgoing.peak);
  const b = returning.getPoint(returning.peak);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-8);
  // A flat band clears by its width; the laid rope of 6 by its diameter.
  assert.ok(Math.abs(a.z - b.z) > (belt.userData.width ?? belt.userData.thickness) + 0.09);
});

test('tensioner pivots on a rigid arm, keeps one planar inextensible belt, and begins in the source contact pose', () => {
  const model = modelFor(5);
  const { arm, belt, idler } = model.root.userData.blocks;
  const { armLength } = model.root.userData.geometry;
  assert.equal(model.root.userData.kinematics.transmission, 1);
  assert.equal(model.root.userData.kinematics.hasIdlerContact, true);
  for (let i = 0; i <= 80; i += 1) {
    model.update(i / 8);
    assert.ok(Math.abs(arm.children[1].position.distanceTo(arm.children[2].position) - armLength) < 1e-12,
      'actual lever endpoints stay one rigid length apart');
    assert.ok(Math.abs(belt.userData.length - model.root.userData.nominalBeltLength) < 1e-8);
    const center = model.root.userData.kinematics.idlerCenter;
    for (let j = 0; j <= 128; j += 1) {
      const point = belt.userData.curve.getPointAt(j / 128);
      assert.ok(Math.abs(point.z) < 1e-12, 'slack buckles stay in the pulley plane');
      assert.ok(point.distanceTo(center) >= idler.userData.treadRadius + 0.012 - 1e-8,
        'both free leaves and the wrap stay outside the idler solid');
    }
  }
});

for (const id of [9, 10]) {
  test(`cone drive ${id} renders closed bands following the contact radius at both edges`, () => {
    const model = modelFor(id);
    const { driver, driven, belt } = model.root.userData.blocks;
    for (const phase of [0, 0.25, 0.75]) {
      model.update(phase * Math.PI * 4, 0.016);
      assertClosedOutward(belt.userData.mesh.geometry);
      const positions = belt.userData.mesh.geometry.attributes.position;
      for (const pulley of [driver, driven]) {
        let contactVertices = 0;
        for (let i = 0; i < positions.count; i += 1) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, i);
          const level = point.z / pulley.userData.length + 0.5;
          const radius = pulley.userData.radiusAt(level);
          const gap = Math.hypot(point.x - pulley.position.x, point.y - pulley.position.y) - radius;
          assert.ok(gap > -1e-6, `band edge is outside cone ${id}, gap ${gap}`);
          if (Math.abs(gap) < 1e-6) contactVertices += 1;
        }
        assert.ok(contactVertices > 40, 'both band edges actually touch the cone over the wrap');
      }
    }
  });
}
