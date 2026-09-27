import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredOscillatingEngineMovement } from '../src/simulation/authored-oscillating-engines.js';
import { createAuthoredTableEngineMovement } from '../src/simulation/authored-table-engines.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

for (const id of [344, 345]) test(`${id}: round piston rod clears the actual cover and gland bores for the full stroke`, () => {
  const { root, update } = createAuthoredOscillatingEngineMovement({ id });
  const b = root.userData.blocks;
  const rodRadius = b.pistonRod.geometry.parameters.radiusTop;
  const axisZ = b.pistonRod.position.z;
  const ray = new THREE.Raycaster();
  for (let i = 0; i <= 64; i += 1) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const direction = new THREE.Vector3(0, -1, 0).transformDirection(b.cylinderAssembly.matrixWorld);
    for (let n = -1; n < 12; n += 1) {
      const radius = n < 0 ? 0 : rodRadius;
      const origin = new THREE.Vector3(radius * Math.cos(n * Math.PI / 6), 10,
        axisZ + radius * Math.sin(n * Math.PI / 6)).applyMatrix4(b.cylinderAssembly.matrixWorld);
      ray.set(origin, direction);
      for (const cover of [...b.glandCollars, b.cylinderEndPlates[1]]) {
        assert.equal(ray.intersectObject(cover, false).length, 0, `rod clears ${cover.userData.role}`);
      }
    }
    // Negative control: just outside the bore the same ray meets solid metal.
    ray.set(new THREE.Vector3(rodRadius + 0.02, 10, axisZ).applyMatrix4(b.cylinderAssembly.matrixWorld), direction);
    for (const cover of [...b.glandCollars, b.cylinderEndPlates[1]]) {
      assert.ok(ray.intersectObject(cover, false).length > 0, `${cover.userData.role} is solid beside the bore`);
    }
  }
  disposeObject3D(root);
});

for (const id of [344, 345]) test(`${id}: trunnion stubs stay outside the bore and the rear crank clears the piston rod`, () => {
  const { root, update } = createAuthoredOscillatingEngineMovement({ id });
  const b = root.userData.blocks;
  for (let i = 0; i <= 64; i += 1) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const head = new THREE.Box3().setFromObject(b.pistonHead);
    let stubs = 0;
    b.cylinderTrunnion.traverse(stub => {
      if (!stub.isMesh) return;
      stubs += 1;
      const bounds = new THREE.Box3().setFromObject(stub);
      assert.ok(bounds.max.z < head.min.z || bounds.min.z > head.max.z,
        `${stub.userData.role} must not enter the piston's bore`);
    });
    assert.equal(stubs, 2);
    const rod = new THREE.Box3().setFromObject(b.pistonRod);
    const ray = new THREE.Raycaster();
    const eyeCenter = b.pistonCrankEye.getWorldPosition(new THREE.Vector3());
    const pinRadius = b.crankPin.geometry.parameters.radiusTop;
    for (let n = 0; n < 16; n += 1) {
      ray.set(new THREE.Vector3(eyeCenter.x + pinRadius * Math.cos(n * Math.PI / 8),
        eyeCenter.y + pinRadius * Math.sin(n * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
      assert.equal(ray.intersectObject(b.pistonCrankEye, false).length, 0);
    }
    ray.set(new THREE.Vector3(eyeCenter.x + pinRadius + 0.02, eyeCenter.y, 10), new THREE.Vector3(0, 0, -1));
    assert.ok(ray.intersectObject(b.pistonCrankEye, false).length > 0, 'negative control: eye wall is solid');
    for (const object of [b.crankArm, b.crankShaft]) {
      assert.ok(new THREE.Box3().setFromObject(object).max.z < rod.min.z,
        `${object.userData.role} is behind the swept piston rod`);
    }
    for (const rail of [b.upperRail, b.crankBearing, b.trunnionBearingBack]) {
      assert.ok(new THREE.Box3().setFromObject(rail).max.z < new THREE.Box3().setFromObject(b.crankArm).min.z,
        `${rail.userData.role} stays behind the crank`);
    }
    const casing = new THREE.Box3();
    for (const part of [b.barrel, ...b.cylinderEndPlates]) casing.union(new THREE.Box3().setFromObject(part));
    assert.ok(new THREE.Box3().setFromObject(b.trunnionBearingBack).max.z < casing.min.z,
      'trunnion rail runs behind the closed cylinder as Brown dashes it');
  }
  disposeObject3D(root);
});

test('346: crosshead fits its finite guides and side rods clear the table and their cranks', () => {
  const { root, update } = createAuthoredTableEngineMovement({ id: 346 });
  const b = root.userData.blocks;
  const ray = new THREE.Raycaster();
  for (let i = 0; i <= 64; i += 1) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const crosshead = new THREE.Box3().setFromObject(b.crosshead);
    const rails = b.guideRails.map(rail => new THREE.Box3().setFromObject(rail));
    assert.ok(crosshead.min.x > rails[0].max.x && crosshead.max.x < rails[1].min.x);
    assert.ok(crosshead.min.y > rails[0].min.y && crosshead.max.y < rails[0].max.y);
    const table = new THREE.Box3().setFromObject(b.tableTopEdge);
    for (const [j, assembly] of b.sideRodAssemblies.entries()) {
      const rod = new THREE.Box3().setFromObject(assembly.group);
      const crank = new THREE.Box3().setFromObject(b.crankArms[j]);
      assert.ok(j === 0 ? rod.max.z < table.min.z && rod.max.z < crank.min.z
        : rod.min.z > table.max.z && rod.min.z > crank.max.z);
      for (const [anchor, pin] of [[assembly.startAnchor, b.crankPinBosses[j]], [assembly.endAnchor, b.crossheadPin]]) {
        const center = anchor.getWorldPosition(new THREE.Vector3());
        const radius = pin.geometry.parameters.radiusTop;
        const pinBounds = new THREE.Box3().setFromObject(pin);
        assert.ok(pinBounds.min.z <= rod.min.z && pinBounds.max.z >= rod.max.z);
        for (let n = 0; n < 16; n += 1) {
          ray.set(new THREE.Vector3(center.x + radius * Math.cos(n * Math.PI / 8),
            center.y + radius * Math.sin(n * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
          assert.equal(ray.intersectObject(assembly.shank, false).length, 0);
        }
      }
    }
  }
  disposeObject3D(root);
});

test('346: actual rod cross-section passes through the cover, gland and guide foot', () => {
  const { root } = createAuthoredTableEngineMovement({ id: 346 });
  const b = root.userData.blocks;
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  // Probe inside the round rod's cross-section (radius 0.045 about its axis).
  const rodBox = new THREE.Box3().setFromObject(b.pistonRod), axis = rodBox.getCenter(new THREE.Vector3());
  for (const [dx, dz] of [[0, 0], [0.03, 0], [-0.03, 0], [0, 0.03], [0, -0.03], [0.02, 0.02], [-0.02, -0.02]]) {
    const x = axis.x + dx, z = axis.z + dz;
    ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
    // Pass 71 casts the covers with the barrel as one casting (cylinderWalls[0]).
    for (const part of [b.cylinderEndPlates[1] ?? b.cylinderWalls[0], b.guideFoot, ...b.gland.children]) {
      // Only the top cover and above matter; the rod never reaches the bottom cover.
      const hits = ray.intersectObject(part, false).filter((hit) => hit.point.y > rodBox.min.y);
      assert.equal(hits.length, 0, part.userData.role);
    }
  }
  disposeObject3D(root);
});
