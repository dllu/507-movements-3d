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

test('039 actual involute flanks remain engaged and clear while the planet rocks with the rod', () => {
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
  let largestGap = 0;
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
    assert.ok(gap < 0.0015, `pose ${sample}: working gap ${gap}`);
    largestGap = Math.max(largestGap, gap);
  }
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

test('039 has clear carrier bores and separate planes for the flywheel, gears, rod and arm', () => {
  const model = createMovementModel(catalog.movements[38]);
  const { sun, planet, carrier, arm, connectingRod, rodBoss, flywheel, planetShaft, sunShaft } = model.root.userData.blocks;
  const g = model.root.userData.geometry;
  const initialRodTransform = new THREE.Matrix4();
  for (let sample = 0; sample < 65; sample += 1) {
    model.update(g.orbitPeriod * sample / 64, 0);
    model.root.updateMatrixWorld(true);
    const wheelBounds = new THREE.Box3().setFromObject(flywheel);
    for (const part of [planet, planetShaft]) {
      const bounds = new THREE.Box3().setFromObject(part);
      assert.ok(bounds.min.z - wheelBounds.max.z > 0.0169,
        'all orbiting parts, including the rear shaft tip, clear the flywheel');
    }
    const armBounds = new THREE.Box3().setFromObject(arm);
    const rodBounds = new THREE.Box3().setFromObject(connectingRod);
    const bossBounds = new THREE.Box3().setFromObject(rodBoss);
    // The rod crosses the sun axis once per orbit, so it must run outboard
    // of the arm and of the sun-shaft end on which the arm pivots.
    assert.ok(rodBounds.min.z - armBounds.max.z > 0.0149, 'the rod sweeps in front of the arm');
    assert.ok(bossBounds.min.z - armBounds.max.z > 0.0099, 'the arm clears the planet/rod attachment boss');
    assert.ok(rodBounds.min.z - new THREE.Box3().setFromObject(sunShaft).max.z > 0.0199,
      'the sun shaft ends inside the arm, behind the rod');
    assert.ok(rodBounds.min.z - new THREE.Box3().setFromObject(sun.userData.flange).max.z > 0.0149,
      'the inclined rod passes in front of the rotating sun flange');
    for (const x of [0, g.centerDistance]) {
      for (let ray = 0; ray < 16; ray += 1) {
        // Probe face interiors; an exact polygon vertex can fall between
        // two floating-point ray/triangle edge tests.
        const angle = 2 * Math.PI * (ray + 0.317) / 16;
        const origin = new THREE.Vector3(x, 0, 0.205).applyMatrix4(carrier.matrixWorld);
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
  assert.equal(flywheel.geometry.parameters.shapes.holes.length, 4,
    'the recessed web is one solid with four real radial slits');
});

test('039 flywheel web is parted by four narrow slits, not opened into thin spokes', () => {
  const model = createMovementModel(catalog.movements[38]);
  const { flywheel, flywheelRim } = model.root.userData.blocks;
  const g = model.root.userData.geometry;
  const slitArea = (hole) => Math.abs(THREE.ShapeUtils.area(hole.getPoints(48)));
  const webArea = Math.PI * (g.flywheelInnerRadius ** 2 - g.flywheelHubRadius ** 2);
  const openArea = flywheel.geometry.parameters.shapes.holes.reduce((sum, hole) => sum + slitArea(hole), 0);
  assert.ok(openArea / webArea < 0.12, `plate 39 web is mostly solid (open fraction ${openArea / webArea})`);
  // Negative control: the replaced four-spoke web left most of the annulus open.
  const spokeHalfAngle = Math.asin(0.085 / g.flywheelInnerRadius);
  const oldOpenFraction = 1 - 4 * 2 * spokeHalfAngle / (2 * Math.PI);
  assert.ok(oldOpenFraction > 0.8);
  const rimBounds = new THREE.Box3().setFromObject(flywheelRim);
  const webBounds = new THREE.Box3().setFromObject(flywheel);
  assert.ok(rimBounds.max.z - webBounds.max.z > 0.035, 'the web is recessed behind the rim face');
  for (const hole of flywheel.geometry.parameters.shapes.holes) {
    const radii = hole.getPoints(48).map((point) => point.length());
    assert.ok(Math.max(...radii) <= g.flywheelInnerRadius + 1e-9, 'each slit stops at the continuous rim');
    const innerEnd = Math.min(...radii);
    assert.ok(innerEnd > g.flangeRadius && innerEnd < g.pitchRadius - 1.1 * g.module,
      'each slit ends inward behind the solid sun-gear body, outside its hub flange');
  }
});
