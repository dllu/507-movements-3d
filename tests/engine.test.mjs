import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  perspectiveBoxFitDistance,
  perspectiveObjectFitDistance,
  groundFloorFor,
  MovementEngine,
} from '../src/simulation/engine.js';

test('ground uses the swept mechanism envelope even when a camera crop or authored floor is higher', () => {
  const root = new THREE.Group();
  root.userData.sampledFloorY = -4;
  root.userData.groundFloorY = -1;
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const bounds = new THREE.Box3(new THREE.Vector3(-1, -2, -1), new THREE.Vector3(1, 1, 1));
  assert.ok(groundFloorFor({ root }, bounds) < -4);
});

test('ground remains below translated and deformed geometry beyond the sampled envelope', () => {
  const engine = Object.create(MovementEngine.prototype);
  engine.scene = new THREE.Scene();
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  root.add(mesh);
  engine.model = { root };
  engine.addGround();
  mesh.position.y = -5;
  engine.updateGroundClearance();
  assert.ok(engine.ground.position.y < -5.5);
  const position = mesh.geometry.attributes.position;
  position.setY(0, -9);
  position.needsUpdate = true;
  engine.updateGroundClearance();
  assert.ok(engine.ground.position.y < -14);
  mesh.geometry.dispose();
  mesh.material.dispose();
  engine.ground.geometry.dispose();
  engine.ground.material.dispose();
});

test('a rotating wheel does not lower the floor through empty bounding-box corners', () => {
  const engine = Object.create(MovementEngine.prototype);
  engine.scene = new THREE.Scene();
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 96));
  mesh.rotation.x = Math.PI / 2;
  root.add(mesh);
  engine.model = { root };
  engine.addGround();
  const floor = engine.ground.position.y;
  for (let sample = 0; sample <= 71; sample += 1) {
    root.rotation.z = sample * Math.PI * 2 / 71;
    engine.updateGroundClearance();
    assert.ok(Math.abs(engine.ground.position.y - floor) < 1e-7,
      'a circular wheel keeps the same floor throughout rotation');
  }
  mesh.geometry.dispose();
  mesh.material.dispose();
  engine.ground.geometry.dispose();
  engine.ground.material.dispose();
});

function projectedCornerExtents(bounds, direction, fieldOfView, aspect, distance) {
  const camera = new THREE.PerspectiveCamera(fieldOfView, aspect, 0.01, 1000);
  const center = bounds.getCenter(new THREE.Vector3());
  camera.position.copy(center).add(direction.clone().normalize().multiplyScalar(distance));
  camera.lookAt(center);
  camera.updateMatrixWorld(true);

  let maximumX = 0;
  let maximumY = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new THREE.Vector3(x, y, z).project(camera);
        maximumX = Math.max(maximumX, Math.abs(projected.x));
        maximumY = Math.max(maximumY, Math.abs(projected.y));
      }
    }
  }
  return { maximumX, maximumY };
}

test('perspective camera fit contains every corner of wide and tall mechanisms', () => {
  const cases = [
    {
      bounds: new THREE.Box3(
        new THREE.Vector3(-8, -2.2, -0.7),
        new THREE.Vector3(8, 2.2, 0.7),
      ),
      direction: new THREE.Vector3(7, 5, 9),
      aspect: 16 / 9,
    },
    {
      bounds: new THREE.Box3(
        new THREE.Vector3(-1.5, -7, -2),
        new THREE.Vector3(1.5, 7, 2),
      ),
      direction: new THREE.Vector3(6, 4, 8),
      aspect: 0.72,
    },
  ];

  for (const { bounds, direction, aspect } of cases) {
    const distance = perspectiveBoxFitDistance(bounds, direction, 36, aspect);
    const extents = projectedCornerExtents(bounds, direction, 36, aspect, distance);
    assert.ok(extents.maximumX < 1, `horizontal extent ${extents.maximumX} is contained`);
    assert.ok(extents.maximumY < 1, `vertical extent ${extents.maximumY} is contained`);
  }
});

test('perspective camera fit handles a vertical authored view', () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(-4, -0.5, -3),
    new THREE.Vector3(4, 0.5, 3),
  );
  const direction = new THREE.Vector3(0, 1, 0);
  const distance = perspectiveBoxFitDistance(bounds, direction, 36, 1);
  const extents = projectedCornerExtents(bounds, direction, 36, 1, distance);
  assert.ok(Number.isFinite(distance));
  assert.ok(extents.maximumX < 1);
  assert.ok(extents.maximumY < 1);
});

test('rendered-vertex fit ignores empty bounding-box corners', () => {
  const root = new THREE.Group();
  const diagonal = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.2, 0.2),
    new THREE.MeshBasicMaterial(),
  );
  diagonal.rotation.z = Math.PI / 4;
  root.add(diagonal);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const direction = new THREE.Vector3(6, 4, 8);
  const boxDistance = perspectiveBoxFitDistance(bounds, direction, 36, 1.2);
  const objectDistance = perspectiveObjectFitDistance(
    root,
    bounds,
    direction,
    36,
    1.2,
  );
  assert.ok(objectDistance < boxDistance * 0.9,
    'empty corners do not force the camera away from a diagonal solid');
  diagonal.geometry.dispose();
  diagonal.material.dispose();
});
