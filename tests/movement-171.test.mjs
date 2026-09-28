import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

// Pass 90: each eccentric-rod pin runs through a round link lug concentric
// with it and through the rod's own integral eye; no loose torus washers.
test('171 rod pins pass through round link lugs and the rods\' own eyes', () => {
  const model = createAuthoredMarineValveGearMovement({id: 171});
  try {
    const b = model.root.userData.blocks;
    for (const assembly of b.linkPinAssemblies) {
      assert.equal(assembly.children.length, 1);
      assert.equal(assembly.children[0].geometry.type, 'CylinderGeometry');
    }
    const plate = b.upperLinkPlate;
    const ray = new THREE.Raycaster();
    for (const time of [0, 4.5, 9, 13.5]) {
      model.update(time);
      model.root.updateMatrixWorld(true);
      for (const assembly of b.linkPinAssemblies) {
        const centre = assembly.getWorldPosition(new THREE.Vector3());
        // Link material all round the pin between its 0.074 bore and 0.12.
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 8;
          ray.set(new THREE.Vector3(centre.x + 0.11 * Math.cos(a), centre.y + 0.11 * Math.sin(a), 5), new THREE.Vector3(0, 0, -1));
          assert.ok(ray.intersectObject(plate, false).length > 0, `link lug missing at ${time}, ${i}`);
        }
      }
    }
  } finally { disposeObject3D(model.root); }
});
