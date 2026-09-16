import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredOscillatingEngineMovement } from '../src/simulation/authored-oscillating-engines.js';
import { createAuthoredTableEngineMovement } from '../src/simulation/authored-table-engines.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

for (const id of [344, 345]) test(`${id}: piston rod clears the actual cover and gland passages for the full stroke`, () => {
  const { root, update } = createAuthoredOscillatingEngineMovement({ id });
  const b = root.userData.blocks;
  const ray = new THREE.Raycaster();
  for (let i = 0; i <= 64; i += 1) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const direction = new THREE.Vector3(0, -1, 0).transformDirection(b.cylinderAssembly.matrixWorld);
    for (const x of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
      const origin = new THREE.Vector3(x * 0.15625 * root.userData.geometry.sourceScale,
        10, 0.42 + z * 0.10).applyMatrix4(b.cylinderAssembly.matrixWorld);
      ray.set(origin, direction);
      for (const cover of [...b.glandCollars, b.cylinderEndPlates[1]]) {
        assert.equal(ray.intersectObject(cover, false).length, 0, `rod clears ${cover.userData.role}`);
      }
    }
  }
  disposeObject3D(root);
});

for (const id of [344, 345]) test(`${id}: stub trunnions and rear crank leave the complete piston layer clear`, () => {
  const { root, update } = createAuthoredOscillatingEngineMovement({ id });
  const b = root.userData.blocks;
  for (let i = 0; i <= 64; i += 1) {
    update(4 * i / 64); root.updateMatrixWorld(true);
    const head = new THREE.Box3().setFromObject(b.pistonHead);
    const index = new THREE.Box3().setFromObject(b.pistonHeadIndex);
    b.cylinderTrunnion.traverse(stub => {
      if (!stub.isMesh) return;
      const bounds = new THREE.Box3().setFromObject(stub);
      assert.ok(bounds.max.z < head.min.z || bounds.min.z > index.max.z);
    });
    const rod = new THREE.Box3().setFromObject(b.pistonRod);
    const bridge = b.cylinderAssembly.children.find(part => part.userData.role === 'front-trunnion-bridge-clear-of-piston-stroke');
    const frontBearing = new THREE.Box3().setFromObject(b.trunnionBearingFront);
    assert.ok(new THREE.Box3().setFromObject(bridge).max.z < frontBearing.min.z);
    const ray = new THREE.Raycaster();
    const eyeCenter = b.pistonCrankEye.getWorldPosition(new THREE.Vector3());
    const pinRadius = b.crankPin.geometry.parameters.radiusTop;
    for (let n = 0; n < 16; n += 1) {
      ray.set(new THREE.Vector3(eyeCenter.x + pinRadius * Math.cos(n * Math.PI / 8),
        eyeCenter.y + pinRadius * Math.sin(n * Math.PI / 8), 10), new THREE.Vector3(0, 0, -1));
      assert.equal(ray.intersectObject(b.pistonCrankEye, false).length, 0);
    }
    for (const object of [b.crankDisk, b.crankHub, b.crankArm, b.crankShaft]) {
      assert.ok(new THREE.Box3().setFromObject(object).max.z < rod.min.z,
        `${object.userData.role} is behind the swept piston rod`);
    }
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
  for (const x of [-0.045, 0, 0.045]) for (const z of [0.03, 0.14, 0.25]) {
    ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
    for (const part of [b.cylinderEndPlates[1], b.guideFoot, ...b.gland.children]) {
      assert.equal(ray.intersectObject(part, false).length, 0, part.userData.role);
    }
  }
  disposeObject3D(root);
});
