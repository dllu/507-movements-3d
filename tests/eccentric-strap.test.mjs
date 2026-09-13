import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../src/data/movements.json', import.meta.url)));
const model = createMovementModel(catalog.movements[88]);
const u = model.root.userData, b = u.blocks, g = u.geometry, j = u.joints, d = j.dimensions;
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const world = object => object.getWorldPosition(new THREE.Vector3());
const bounds = object => new THREE.Box3().setFromObject(object, true);
after(() => {
  const geometries = new Set(), materials = new Set();
  model.root.traverse(o => {if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material);});
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
});

// Intersect actual native triangles without relying on construction metadata.
function wallDistance(geometry, origin, direction) {
  const positions = geometry.attributes.position, index = geometry.index;
  const ray = new THREE.Ray(new THREE.Vector3(...origin), new THREE.Vector3(...direction));
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], hit = new THREE.Vector3();
  let minimum = Infinity;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    for (let k = 0; k < 3; k++) vertices[k].fromBufferAttribute(positions, index ? index.getX(i + k) : i + k);
    if (ray.intersectTriangle(...vertices, false, hit)) minimum = Math.min(minimum, hit.distanceTo(ray.origin));
  }
  return minimum;
}

test('089 actual rod eye, wrist and eccentric bearing stay connected throughout two cycles', () => {
  for (let i = 0; i <= 720; i++) {
    const time = i * g.cyclePeriod / 360;
    model.update(time); model.root.updateMatrixWorld(true);
    const state = u.kinematics, eye = world(b.rodEndEye), wrist = world(b.wristPin), center = world(b.sheaveBody);
    near(eye.distanceTo(wrist), 0); near(center.distanceTo(world(b.strap)), 0);
    near(center.distanceTo(eye), g.eccentricRodLength); near(eye.y, g.sliderY);
    near(center.distanceTo(g.shaftCenter), g.eccentricity);
    const a = u.stateAtTime(time - 1e-5), z = u.stateAtTime(time + 1e-5);
    near(state.outputVelocity.x, (z.outputPoint.x - a.outputPoint.x) / 2e-5, 1e-8);
    near(state.strapAngularSpeed, (z.strapAngle - a.strapAngle) / 2e-5, 1e-8);
  }
  near(u.stateAtTime(0).outputPoint.x - u.stateAtTime(g.cyclePeriod / 2).outputPoint.x, 2 * g.eccentricity);
  assert.equal(u.minimumDisplayCycleSeconds, 4);
  assert.ok(u.animationTiming.displayCycleDuration >= 4 - 1e-12);
});

test('089 bored flange, fork, rod, pin and retaining channels are closed finite solids', () => {
  const meshes = [];
  for (const part of [b.innerCouplingPlate, b.outerCouplingPlate, ...b.couplingBolts,
    b.eccentricRod, b.crosshead, b.wristPin, ...b.guideRails]) part.traverse(o => {if (o.isMesh) meshes.push(o);});
  for (const mesh of meshes) {
    const check = inspectWeightedClutchSolid(mesh.geometry);
    assert.equal(check.components, 1, mesh.userData.role);
    assert.ok(check.volume > 0, mesh.userData.role);
    assert.equal(check.unmatchedEdges + check.degenerate + check.wrongNormals + check.nonfinite, 0, JSON.stringify(check));
  }
});

test('089 two axial flange bolts cross both abutting plates through real bores', () => {
  model.update(0); model.root.updateMatrixWorld(true);
  assert.equal(b.couplingBolts.length, 2);
  near(bounds(b.innerCouplingPlate).max.x, bounds(b.outerCouplingPlate).min.x, 1e-7);
  for (const flange of [b.innerCouplingPlate, b.outerCouplingPlate]) {
    for (const sign of [-1, 1]) for (let i = 0; i < 48; i++) {
      const angle = i * Math.PI * 2 / 48;
      const distance = wallDistance(flange.geometry, [0, sign * .31, 0], [0, Math.cos(angle), Math.sin(angle)]);
      assert.ok(distance > d.flangeBoltRadius + .0019 && distance < d.flangeBoreRadius + 1e-7);
    }
  }
  // The old flared neck filled the bolt's lower half; the neck now ends
  // before the plates, below both bolt bores.
  assert.ok(bounds(b.couplingNeck).max.x < bounds(b.innerCouplingPlate).max.x);
  assert.ok(bounds(b.couplingNeck).max.y < world(b.strap).y + .31 - d.flangeBoltRadius);
});

test('089 the wrist pin has a bored eye and two clear cheeks instead of overlapping solid blocks', () => {
  for (const [geometry, origin] of [
    [b.eccentricRod.geometry, [g.eccentricRodLength, 0, 0]],
    ...j.cheeks.map(mesh => [mesh.geometry, [0, 0, (mesh.geometry.userData.plate.low + mesh.geometry.userData.plate.high) / 2]]),
  ]) for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI * 2 / 48;
    const distance = wallDistance(geometry, origin, [Math.cos(angle), Math.sin(angle), 0]);
    assert.ok(distance > d.pinRadius + .0019 && distance < d.wristBoreRadius + 1e-6);
  }
  model.update(0); model.root.updateMatrixWorld(true);
  near(bounds(b.eccentricRod).max.z + .005, bounds(j.cheeks[1]).min.z, 1e-7);
  near(bounds(b.eccentricRod).min.z - .005, bounds(j.cheeks[0]).max.z, 1e-7);
  near(bounds(b.outputStem).min.x, bounds(j.bridge).max.x, 1e-7);
});

test('089 channel faces retain the crosshead in both directions and clear the swinging rod', () => {
  const point = new THREE.Vector3();
  for (let i = 0; i <= 180; i++) {
    model.update(i * g.cyclePeriod / 180); model.root.updateMatrixWorld(true);
    const wrist = world(b.wristPin), inverse = b.crosshead.matrixWorld.clone().invert();
    for (const guide of b.guideRails) {
      const sign = guide.userData.side === 'lower' ? -1 : 1;
      const local = guide.worldToLocal(wrist.clone().add(new THREE.Vector3(0, sign * d.crossheadHalfHeight, 0)));
      near(wallDistance(guide.geometry, local.toArray(), [0, sign, 0]), d.guideClearance, 1e-7);
      for (const side of [-1, 1]) {
        const lipPoint = guide.worldToLocal(wrist.clone().add(new THREE.Vector3(0, sign * .32, side * d.forkOuterZ)));
        near(wallDistance(guide.geometry, lipPoint.toArray(), [0, 0, side]), d.guideClearance, 1e-7);
      }
    }
    const p = b.eccentricRod.geometry.attributes.position;
    for (let k = 0; k < p.count; k++) {
      point.fromBufferAttribute(p, k).applyMatrix4(b.eccentricRod.matrixWorld);
      if (point.x >= g.guideMinimumX && point.x <= g.guideMaximumX) {
        assert.ok(Math.abs(point.y - g.sliderY) < d.crossheadHalfHeight + d.guideClearance);
        assert.ok(Math.abs(point.z) < d.forkOuterZ);
      }
      point.applyMatrix4(inverse);
      assert.ok(point.x < .27 - .019, 'rod strikes the fork bridge');
    }
  }
});

test('089 analytic swing limits keep the complete rod clear between checked poses', () => {
  // For all allowed angles, the bore contains the pin's entire circumscribed
  // circle. The rod and cheeks occupy disjoint axial intervals.
  assert.ok(d.wristBoreRadius * Math.cos(Math.PI / 128) > d.pinRadius + .0019);
  assert.ok(d.flangeBoreRadius * Math.cos(Math.PI / 128) > d.flangeBoltRadius + .0019);
  assert.ok(d.forkInnerZ - d.eyeHalfDepth >= .005 - 1e-12);
  const swing = g.maximumStrapAngle;
  const guideRodHeight = (g.outputMaximumX - g.guideMinimumX) * Math.tan(swing) + .12 / Math.cos(swing);
  assert.ok(guideRodHeight < d.crossheadHalfHeight + d.guideClearance);
  assert.ok(g.outputMinimumX - .30 > g.guideMinimumX);
  assert.ok(g.outputMaximumX + .42 < g.guideMaximumX);
  const p = b.eccentricRod.geometry.attributes.position;
  let maximumRodX = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) - g.eccentricRodLength, y = p.getY(i);
    const angles = [-swing, swing], stationary = -Math.atan2(y, x);
    for (let k = -1; k <= 1; k++) if (Math.abs(stationary + k * 2 * Math.PI) <= swing) angles.push(stationary + k * 2 * Math.PI);
    for (const angle of angles) maximumRodX = Math.max(maximumRodX, x * Math.cos(angle) - y * Math.sin(angle));
  }
  assert.ok(maximumRodX < .27 - .019, 'continuous rod sweep reaches the fork bridge');
  model.update(0); model.root.updateMatrixWorld(true);
  const base = bounds(b.baseRail);
  for (const support of b.guideSupports) {
    const box = bounds(support);
    assert.ok(box.max.x < base.max.x && box.min.x > base.min.x, 'guide support is beyond its base');
  }
});
