import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function polygonQuery(points) {
  const bins = new Map();
  for (const [index, a] of points.entries()) {
    const b = points[(index + 1) % points.length];
    if (a.distanceToSquared(b) < 1e-20) continue;
    for (let bin = Math.floor(Math.min(a.y, b.y) / 0.01);
      bin <= Math.floor(Math.max(a.y, b.y) / 0.01); bin += 1) {
      if (!bins.has(bin)) bins.set(bin, []);
      bins.get(bin).push({ a, b });
    }
  }
  return (point) => {
    const bin = Math.floor(point.y / 0.01);
    let inside = false, distance = Infinity;
    for (const { a, b } of bins.get(bin) ?? []) {
      if ((a.y > point.y) !== (b.y > point.y)
        && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    for (let neighbor = bin - 1; neighbor <= bin + 1; neighbor += 1) {
      for (const { a, b } of bins.get(neighbor) ?? []) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const fraction = THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.y - a.y) * dy)
          / (dx * dx + dy * dy), 0, 1);
        distance = Math.min(distance, Math.hypot(point.x - a.x - fraction * dx, point.y - a.y - fraction * dy));
      }
    }
    return { inside, distance };
  };
}

test('039 actual square-tooth flanks clear with bounded backlash while the planet rocks with the rod', () => {
  const model = createMovementModel(catalog.movements[38]);
  const { sun, planet } = model.root.userData.blocks;
  const meshes = [sun.userData.body, planet.userData.body];
  const outlines = meshes.map((mesh) => mesh.geometry.parameters.shapes.getPoints().slice(0, -1));
  const queries = outlines.map(polygonQuery);
  const clouds = outlines.map((points) => points.flatMap((a, index) => {
    const b = points[(index + 1) % points.length];
    return [a, a.clone().lerp(b, 1 / 3), a.clone().lerp(b, 2 / 3)];
  }));
  const point = new THREE.Vector3();
  let largestGap = 0, smallestGap = Infinity;
  for (let sample = 0; sample < 192; sample += 1) {
    model.update(model.root.userData.geometry.orbitPeriod * (sample + 0.173) / 192, 0);
    model.root.updateMatrixWorld(true);
    let gap = Infinity;
    for (const side of [0, 1]) {
      const transform = meshes[1 - side].matrixWorld.clone().invert().multiply(meshes[side].matrixWorld);
      for (const p of clouds[side]) {
        point.set(p.x, p.y, 0).applyMatrix4(transform);
        if (Math.hypot(point.x, point.y) > 0.80) continue;
        const query = queries[1 - side](point);
        assert.ok(!query.inside || query.distance < 2e-7,
          `pose ${sample}: gear ${side} enters its mate by ${query.distance}`);
        gap = Math.min(gap, query.distance);
      }
    }
    assert.ok(gap < 0.02, `pose ${sample}: working gap ${gap}`);
    largestGap = Math.max(largestGap, gap);
    smallestGap = Math.min(smallestGap, gap);
  }
  // Plate 39's square teeth are not conjugate: they keep a running clearance
  // that closes to a few thousandths once per tooth pitch.
  assert.ok(smallestGap > 0.002 && smallestGap < 0.008, `closest square-tooth approach ${smallestGap}`);
  for (const [side, mesh] of meshes.entries()) {
    const positions = mesh.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index);
      const query = queries[side](point);
      assert.ok(query.inside || query.distance < 2e-7, 'the actual chamfer stays inside its tested tooth outline');
    }
  }
  console.log('039 maximum sampled working gap', largestGap);
});

test('039 has clear carrier bores and separate planes for the fixed ring, gears, rod and arm', () => {
  const model = createMovementModel(catalog.movements[38]);
  const { sun, planet, carrier, arm, connectingRod, rodBoss, ringSegments: flywheel, planetShaft, sunShaft, armStud } = model.root.userData.blocks;
  const g = model.root.userData.geometry;
  const initialRodTransform = new THREE.Matrix4();
  for (let sample = 0; sample < 65; sample += 1) {
    model.update(g.orbitPeriod * sample / 64, 0);
    model.root.updateMatrixWorld(true);
    const wheelBounds = new THREE.Box3().setFromObject(flywheel);
    for (const part of [planet, planetShaft]) {
      const bounds = new THREE.Box3().setFromObject(part);
      assert.ok(bounds.min.z - wheelBounds.max.z > 0.0169,
        'all orbiting parts, including the rear shaft tip, clear the fixed ring');
    }
    const armBounds = new THREE.Box3().setFromObject(arm);
    // Pass 54 models the rod whole with a wrist pin in its upper eye that runs
    // back to the undrawn beam. The layering below concerns the rod body where
    // it crosses the wheels; the pin, a rod length above them, is checked
    // separately to stay clear of the arm and the sun shaft in the plate plane.
    connectingRod.geometry.computeBoundingBox();
    const rodBounds = connectingRod.geometry.boundingBox.clone().applyMatrix4(connectingRod.matrixWorld);
    const wristPin = connectingRod.children.find((child) => child.userData.role === 'upper-wrist-pin-in-rod-eye');
    const pinBounds = new THREE.Box3().setFromObject(wristPin);
    for (const part of [arm, sunShaft, armStud, flywheel]) {
      assert.ok(pinBounds.min.y > new THREE.Box3().setFromObject(part).max.y + 0.1,
        'the upper wrist pin stays a rod length clear of the wheels and arm');
    }
    assert.ok(armBounds.min.z - pinBounds.max.z > 0.0049, 'the wrist pin does not stand out in front of the arm plane');
    const bossBounds = new THREE.Box3().setFromObject(rodBoss);
    // Plate 39 draws the arm over the rod. The rod crosses the sun axis once
    // per orbit, so it runs between the gears and the arm, in front of the
    // sun-shaft end and behind the arm's sun-end stud.
    assert.ok(armBounds.min.z - rodBounds.max.z > 0.0049, 'the arm lies in front of the rod');
    assert.ok(armBounds.min.z - bossBounds.max.z > 0.0049, 'the arm clears the planet/rod attachment boss');
    assert.ok(rodBounds.min.z - new THREE.Box3().setFromObject(sunShaft).max.z > 0.0099,
      'the sun shaft ends behind the rod');
    assert.ok(new THREE.Box3().setFromObject(armStud).min.z - rodBounds.max.z > 0.0049,
      'the arm stud stays in front of the rod');
    assert.ok(rodBounds.min.z - new THREE.Box3().setFromObject(sun.userData.flange).max.z > 0.0149,
      'the inclined rod passes in front of the rotating sun flange');
    for (const x of [0, g.centerDistance]) {
      for (let ray = 0; ray < 16; ray += 1) {
        // Probe face interiors; an exact polygon vertex can fall between
        // two floating-point ray/triangle edge tests.
        const angle = 2 * Math.PI * (ray + 0.317) / 16;
        const origin = new THREE.Vector3(x, 0, 0.295).applyMatrix4(carrier.matrixWorld);
        const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).transformDirection(carrier.matrixWorld);
        const hits = new THREE.Raycaster(origin, direction, 0, 0.3).intersectObject(arm, false);
        assert.ok(hits.length > 0 && hits[0].distance - g.axleRadius > 0.0059,
          'both rotating shafts fit the actual carrier holes with running clearance');
      }
    }
    const relativeRod = planet.userData.rotor.matrixWorld.clone().invert().multiply(connectingRod.matrixWorld);
    if (sample === 0) initialRodTransform.copy(relativeRod);
    for (let index = 0; index < 16; index += 1) {
      assert.ok(Math.abs(relativeRod.elements[index] - initialRodTransform.elements[index]) < 1e-12,
        'the actual rod mesh remains rigidly attached to the planet');
    }
  }
  assert.equal(flywheel.geometry.parameters.shapes.length, 4, 'the ring has four separate segments');
});

test('039 fixed ring is Brown\'s open four-part ring: a rim and four separate segments round an open middle', () => {
  const model = createMovementModel(catalog.movements[38]);
  const { ringSegments, ringRim, sun } = model.root.userData.blocks;
  const g = model.root.userData.geometry;
  const shapes = ringSegments.geometry.parameters.shapes;
  assert.equal(shapes.length, 4, 'four separate segments, not one slit disk');
  for (const shape of shapes) {
    assert.equal(shape.holes.length, 0);
    const radii = shape.getPoints(48).map((point) => point.length());
    assert.ok(Math.min(...radii) > g.flangeRadius && Math.min(...radii) < g.pitchRadius - 1.1 * g.module,
      'each segment stops inward behind the sun-gear body, leaving the middle open round the hub flange');
    assert.ok(Math.max(...radii) < g.ringRadius, 'each segment runs under the continuous rim');
  }
  // Brown's gaps are about as wide as a tenth of the ring radius.
  assert.ok(2 * g.gapHalfWidth / g.ringRadius > 0.1 && 2 * g.gapHalfWidth / g.ringRadius < 0.13);
  const rimBounds = new THREE.Box3().setFromObject(ringRim);
  const segmentBounds = new THREE.Box3().setFromObject(ringSegments);
  assert.ok(rimBounds.max.z - segmentBounds.max.z > 0.035, 'the segments are recessed behind the rim face');
  // The ring is fixed: it is not carried by the sun and does not move.
  assert.equal(ringRim.parent, model.root); assert.equal(ringSegments.parent, model.root);
  model.update(0, 0); model.root.updateMatrixWorld(true);
  const start = ringSegments.matrixWorld.clone();
  model.update(g.orbitPeriod * 0.37, 0); model.root.updateMatrixWorld(true);
  assert.ok(ringSegments.matrixWorld.equals(start) && sun.userData.rotor.rotation.z !== 0);
});
