import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { makePulley } from '../src/simulation/primitives.js';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const modelFor = (id) => createMovementModel(catalog.movements.find((movement) => movement.id === id));
const white = new THREE.Color(0xfaf9f5);

function whiteMeshes(root) {
  const marks = [];
  root.traverse((part) => {
    if (part.isMesh && part.material?.color?.equals(white)) marks.push(part);
  });
  return marks;
}

function minRadialDistance(mesh, frame, center) {
  mesh.updateWorldMatrix(true, false);
  const toFrame = frame.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  const position = mesh.geometry.attributes.position;
  const point = new THREE.Vector3();
  let min = Infinity;
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(toFrame);
    min = Math.min(min, Math.hypot(point.x - center.x, point.y - center.y));
  }
  return min;
}

test('gear plates 24-46 drop painted indices the engravings do not show', () => {
  for (const id of [24, 25, 26, 27, 29, 30, 31, 33, 34, 43]) {
    const model = modelFor(id);
    assert.equal(whiteMeshes(model.root).length, 0, `${id} keeps white index marks`);
    // 30 is now built without index marks, so there is nothing to remove.
    if (id !== 30) assert.ok(model.root.userData.sourceAbsentIndicesRemoved > 0, `${id} had no marks to remove`);
  }
  // Plain friction surfaces keep their indices so their slip stays legible.
  for (const id of [28, 32]) {
    assert.ok(whiteMeshes(modelFor(id).root).length > 0, `${id} lost its legibility marks`);
  }
});

test('024 shafts are keyed inside plain bosses and turn with their wheels', () => {
  const model = modelFor(24);
  const { driver, driven } = model.root.userData.blocks;
  for (const gear of [driver, driven]) {
    const { shaft, hubRadius, pitchRadius, rotor } = gear.userData;
    assert.equal(shaft.parent, rotor);
    assert.ok(shaft.userData.keyedToGear);
    assert.ok(Math.abs(hubRadius / pitchRadius - 0.43) < 1e-9);
  }
  const before = driver.userData.shaft.getWorldQuaternion(new THREE.Quaternion());
  model.update(1.3, 0.1);
  model.root.updateMatrixWorld(true);
  const after = driver.userData.shaft.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(before.angleTo(after) > 0.5, 'keyed shaft did not turn with its gear');
});

test('025 shaft collars turn with the shafts they are fixed to', () => {
  const model = modelFor(25);
  const { collars, shaftA, shaftB } = model.root.userData.blocks;
  assert.equal(collars.length, 3);
  for (const time of [0, 0.7, 2.9]) {
    model.update(time, 0.1);
    for (const collar of collars) {
      const shaft = collar.userData.fixedToShaft;
      assert.ok(shaft === shaftA || shaft === shaftB);
      const angle = (object) => object.userData.rotor.rotation.z;
      assert.ok(Math.abs(angle(collar) - angle(shaft)) < 1e-12, `collar slips on its shaft at t=${time}`);
      assert.ok(collar.userData.rotor.quaternion.angleTo(shaft.userData.rotor.quaternion) < 1e-6);
    }
  }
});

test('027 rollers are bored clear of their pins and their hubs stay within the face', () => {
  const model = modelFor(27);
  model.root.updateMatrixWorld(true);
  const carriers = [];
  model.root.traverse((part) => { if (part.userData.rollers) carriers.push(part); });
  assert.ok(carriers.length > 0);
  for (const carrier of carriers) {
    const frame = carrier.userData.rotor;
    for (const roller of carrier.userData.rollers) {
      const center = roller.position;
      let clearance = Infinity;
      roller.traverse((part) => {
        if (part.isMesh) clearance = Math.min(clearance, minRadialDistance(part, frame, center));
      });
      assert.ok(clearance > 0.035 + 0.001, `roller solid inside its 0.035 pin: ${clearance}`);
      const box = new THREE.Box3();
      roller.traverse((part) => {
        if (!part.isMesh) return;
        part.geometry.computeBoundingBox();
        box.union(part.geometry.boundingBox.clone().applyMatrix4(
          frame.matrixWorld.clone().invert().multiply(part.matrixWorld)));
      });
      assert.ok(box.max.z - center.z <= 0.14 + 0.03 && center.z - box.min.z <= 0.14 + 0.03,
        'roller hub overhangs its face width');
    }
  }
  // Negative control: an unbored sheave is solid on its axis.
  const solid = makePulley({ axis: new THREE.Vector3(0, 0, 1), grooves: 0, radius: 0.15, spokes: 0, width: 0.28 });
  solid.updateMatrixWorld(true);
  let solidClearance = Infinity;
  solid.traverse((part) => {
    if (part.isMesh) solidClearance = Math.min(solidClearance, minRadialDistance(part, solid, new THREE.Vector3()));
  });
  assert.ok(solidClearance < 0.035);
});

test('028 disk boss is a concave trumpet, not a straight cone', () => {
  const model = modelFor(28);
  let boss;
  model.root.traverse((part) => { if (part.userData.role === 'concave-trumpet-boss') boss = part; });
  assert.ok(boss, 'missing trumpet boss');
  const flare = boss.geometry.parameters.points.filter((point) => point.x > 0.4 + 1e-9);
  const sagBelowChord = (points) => {
    const first = new THREE.Vector2(0.4, points[0].y - (points[1].y - points[0].y));
    const last = points.at(-1);
    return Math.max(...points.slice(0, -1).map((point) => {
      const chord = first.x + (last.x - first.x) * (point.y - first.y) / (last.y - first.y);
      return chord - point.x;
    }));
  };
  assert.ok(Math.abs(flare.at(-1).x - 0.56) < 1e-9);
  assert.ok(sagBelowChord(flare) > 0.03, 'boss flank is not concave');
  const cone = flare.map((point, index) => new THREE.Vector2(
    0.4 + 0.16 * (index + 1) / flare.length, point.y));
  assert.ok(sagBelowChord(cone) < 1e-9, 'negative control: a straight cone reads as concave');
});

test('043 view keeps the lower wheel edge-on and turns the upper wheel toward the eye', () => {
  const model = modelFor(43);
  const { drivenAxis, driverAxis } = model.root.userData.gearContact;
  const worldAxis = (axis) => axis.clone().applyQuaternion(model.root.quaternion);
  const view = model.cameraDirection.clone().normalize();
  assert.ok(Math.abs(worldAxis(drivenAxis).dot(view)) < 0.05);
  assert.ok(worldAxis(driverAxis).dot(view) < -0.4);
  const previousView = new THREE.Vector3(6.8, 0.1, 8.6).normalize();
  assert.ok(Math.abs(worldAxis(drivenAxis).dot(previousView)) > 0.3,
    'negative control: the earlier oblique view foreshortens the driven wheel');
});
