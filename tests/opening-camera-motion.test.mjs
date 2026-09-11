import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { MovementEngine } from '../src/simulation/engine.js';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

test('reviewed opening models and 043 stay in one fixed camera through their complete motion', () => {
  for (const id of [...Array.from({ length: 22 }, (_, i) => i + 1), 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52]) {
    const model = createMovementModel(catalog.movements[id - 1]);
    const period = model.root.userData.animationTiming.authoredCyclePeriod;
    assert.ok(model.root.userData.sampledMotionBounds, 'motion envelope exists for ' + id);
    for (const aspect of [0.7, 1.2, 2.4]) {
      model.update(0, 0);
      const camera = new THREE.PerspectiveCamera();
      const controls = {
        target: new THREE.Vector3(),
        update() { camera.lookAt(this.target); camera.updateMatrixWorld(true); },
      };
      const engine = { model, camera, controls, container: { clientWidth: 1000 * aspect, clientHeight: 1000 } };
      MovementEngine.prototype.fitCamera.call(engine, model.cameraDirection);
      const point = new THREE.Vector3();
      // Use different sample times from the profile generator, without
      // refitting the camera at each pose.
      for (let sample = 0; sample <= 37; sample += 1) {
        model.update(period * sample / 37, sample === 0 ? 0 : period / 37);
        model.root.updateMatrixWorld(true);
        model.root.traverseVisible((object) => {
          const positions = object.geometry?.attributes.position;
          if (!positions) return;
          if (object.isInstancedMesh) {
            object.computeBoundingBox();
            for (const x of [object.boundingBox.min.x, object.boundingBox.max.x]) {
              for (const y of [object.boundingBox.min.y, object.boundingBox.max.y]) {
                for (const z of [object.boundingBox.min.z, object.boundingBox.max.z]) {
                  point.set(x, y, z).applyMatrix4(object.matrixWorld).project(camera);
                  assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1,
                    'movement ' + id + ' keeps the bounds of every instance inside the frame');
                }
              }
            }
            return;
          }
          for (let i = 0; i < positions.count; i += 1) {
            point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
            assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1,
              'movement ' + id + ', aspect ' + aspect + ', sample ' + sample + ' stays inside the frame');
          }
        });
      }
    }
    const geometries = new Set();
    const materials = new Set();
    model.root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [object.material].flat()) if (material) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
});
