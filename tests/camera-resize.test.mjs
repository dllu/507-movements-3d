import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MovementEngine } from '../src/simulation/engine.js';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

function makeEngine() {
  const engine = Object.create(MovementEngine.prototype);
  engine.model = createMovementModel(catalog.movements[63]);
  engine.model.update(0, 0);
  engine.camera = new THREE.PerspectiveCamera();
  engine.controls = new OrbitControls(engine.camera);
  engine.controls.enableDamping = true;
  engine.container = { clientWidth: 912, clientHeight: 788 };
  engine.renderer = { setSize() {} };
  engine.fitCamera(engine.model.cameraDirection);
  return engine;
}

function assertAllVerticesFit(engine) {
  const point = new THREE.Vector3();
  engine.camera.updateMatrixWorld(true);
  engine.model.root.updateMatrixWorld(true);
  engine.model.root.traverseVisible(object => {
    const positions = object.geometry?.attributes.position;
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(engine.camera);
      assert.ok(Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) < 1,
        `${object.name} vertex ${i} is outside the resized camera`);
    }
  });
}

test('desktop/mobile resizing refits the full mechanism and preserves a chosen orbit, pan and relative zoom', () => {
  const engine = makeEngine();
  const desktopDistance = engine.camera.position.distanceTo(engine.controls.target);
  engine.container.clientWidth = 358;
  engine.container.clientHeight = 532;
  engine.resize();
  assertAllVerticesFit(engine);
  const mobileDistance = engine.camera.position.distanceTo(engine.controls.target);
  assert.ok(mobileDistance > desktopDistance * 1.5);

  const axis = new THREE.Vector3(0.6, 0.3, 1).normalize();
  const target = engine.controls.target.clone().add(new THREE.Vector3(0.1, 0.2, 0.3));
  engine.controls.target.copy(target);
  engine.camera.position.copy(target).addScaledVector(axis, mobileDistance * 0.8);
  engine.controls.update();
  engine.container.clientWidth = 912;
  engine.container.clientHeight = 788;
  engine.resize();
  assert.ok(engine.controls.target.distanceTo(target) < 1e-10);
  const offset = engine.camera.position.clone().sub(target);
  assert.ok(Math.abs(offset.length() / desktopDistance - 0.8) < 1e-10);
  assert.ok(offset.normalize().distanceTo(axis) < 1e-10);
});

test('reset consumes pending orbit inertia, uses the current viewport and retains the selected full view', () => {
  const engine = makeEngine();
  const direction = engine.model.root.userData.fullCameraDirection;
  engine.fitCamera(direction);
  // Simulate an unfinished damped gesture in the real OrbitControls.
  engine.controls._sphericalDelta.theta = 0.8;
  engine.controls._sphericalDelta.phi = 0.2;
  engine.controls._panOffset.set(0.1, 0.2, 0);
  engine.controls.update();
  // Reset can precede the queued ResizeObserver callback.
  engine.container.clientWidth = 358;
  engine.container.clientHeight = 532;
  engine.resetView();
  const position = engine.camera.position.clone(), target = engine.controls.target.clone();
  assert.ok(position.clone().sub(target).normalize().distanceTo(direction.clone().normalize()) < 1e-10);
  for (let i = 0; i < 80; i++) engine.controls.update();
  assert.ok(engine.camera.position.distanceTo(position) < 1e-10);
  assert.ok(engine.controls.target.distanceTo(target) < 1e-10);
  assert.equal(engine.controls.enableDamping, true);
  assertAllVerticesFit(engine);
});

test('358 closeup still permits inspecting the complete retained track at maximum zoom-out', () => {
  const engine = Object.create(MovementEngine.prototype);
  engine.model = createMovementModel(catalog.movements[357]);
  engine.camera = new THREE.PerspectiveCamera();
  engine.controls = new OrbitControls(engine.camera);
  engine.container = {clientWidth: 390, clientHeight: 532};
  try {
    engine.fitCamera(engine.model.cameraDirection);
    const closeupDistance = engine.camera.position.distanceTo(engine.controls.target);
    engine.camera.position.copy(engine.controls.target).addScaledVector(
      engine.model.cameraDirection.clone().normalize(), engine.controls.maxDistance);
    engine.controls.update();
    for (const time of [0, 3, 6, 9, 12]) {
      engine.model.update(time);
      assertAllVerticesFit(engine);
    }
    assert.ok(engine.camera.position.distanceTo(engine.controls.target) > closeupDistance * 2);
  } finally { disposeObject3D(engine.model.root); }
});
