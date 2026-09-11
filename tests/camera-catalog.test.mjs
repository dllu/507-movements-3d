import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { MovementEngine } from '../src/simulation/engine.js';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

test('actual engine camera fit contains sampled rendered vertices of all 507 models at three aspect ratios', () => {
  for (const movement of catalog.movements) {
    const model = createMovementModel(movement);
    model.update?.(0, 0);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 100);
    const controls = {
      target: new THREE.Vector3(),
      update() { camera.lookAt(this.target); camera.updateMatrixWorld(true); },
    };
    const engine = { model, camera, controls, container: { clientWidth: 1, clientHeight: 1 } };
    for (const aspect of [0.7, 1.2, 2.4]) {
      engine.container.clientWidth = aspect;
      // fitCamera clamps DOM dimensions to at least one pixel.
      engine.container.clientWidth *= 1000;
      engine.container.clientHeight = 1000;
      MovementEngine.prototype.fitCamera.call(engine, model.cameraDirection);
      const crop = model.root.userData.cameraFitBounds;
      const point = new THREE.Vector3();
      const period = model.root.userData.animationTiming.authoredCyclePeriod;
      let previousPhase = 0;
      // These phases differ from the 96-step measurement grid. Hold the
      // initial camera fixed while checking the moving, rendered geometry.
      for (const phase of [0, 0.137, 0.371, 0.613, 0.887, 1]) {
        model.update?.(period * phase, period * (phase - previousPhase));
        model.root.updateMatrixWorld(true);
        let count = 0;
        model.root.traverseVisible((object) => {
          const positions = object.geometry?.attributes.position;
          if (!positions) return;
          for (let i = 0; i < positions.count; i += 1) {
            point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            if (crop?.isBox3 && !crop.containsPoint(point)) continue;
            point.project(camera);
            assert.ok(Number.isFinite(point.x + point.y + point.z));
            assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1,
              'movement ' + movement.id + ', aspect ' + aspect + ', phase ' + phase + ': vertex ' + i + ' lies outside the camera');
            count += 1;
          }
        });
        assert.ok(count > 0);
        previousPhase = phase;
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
