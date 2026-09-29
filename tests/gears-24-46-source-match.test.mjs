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

test('025 p96: shafts, collars and hubs are smooth (at least 48 sides)', () => {
  const model = modelFor(25);
  let cylinders = 0;
  model.root.traverse((part) => {
    if (part.geometry?.type !== 'CylinderGeometry') return;
    cylinders += 1;
    assert.ok(part.geometry.parameters.radialSegments >= 48);
  });
  assert.ok(cylinders >= 7);
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
      // p89: the hub stands 0.01 proud of both drum faces and the drum is
      // bored to the hub's outer radius, so they share no face (z-fight).
      const drum = roller.userData.tread, hub = roller.userData.hub;
      const radial = (g) => { let lo = Infinity; const p = g.attributes.position; for (let i = 0; i < p.count; i++) lo = Math.min(lo, Math.hypot(p.getX(i), p.getZ(i))); return lo; };
      const extent = (g) => { g.computeBoundingBox(); return g.boundingBox; };
      assert.ok(Math.abs(radial(drum.geometry) - 0.067) < 1e-6, 'drum bored to the hub radius');
      assert.ok(Math.abs(extent(hub.geometry).max.y - extent(drum.geometry).max.y - 0.01) < 1e-6);
      assert.ok(Math.abs(extent(drum.geometry).min.y - extent(hub.geometry).min.y - 0.01) < 1e-6);
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

test('027 rollers hang on true eyes of one chamfered carrier plate; the wheel has Brown\'s sector frames', () => {
  const model = modelFor(27);
  model.root.updateMatrixWorld(true);
  const { driver, driven } = model.root.userData.blocks;
  const frame = driver.userData.rotor;
  const plate = frame.children.find((part) => part.userData.role === 'three-arm-carrier-plate-with-roller-eyes');
  assert.ok(plate, 'one carrier plate');
  const { eyeRadius, plateHalfThickness: h } = driver.userData;
  const position = plate.geometry.attributes.position, normal = plate.geometry.attributes.normal;
  // Indexed with authored normals (the load-time facet smoother leaves it alone).
  assert.ok(plate.geometry.index && normal);
  for (const roller of driver.userData.rollers) {
    const c = roller.position;
    // The outline round each pin is an arc of eyeRadius concentric with it:
    // wall vertices near the pin whose normal points away from it lie on that circle.
    let near = 0;
    for (let i = 0; i < position.count; i += 1) {
      const z = position.getZ(i), d = Math.hypot(position.getX(i) - c.x, position.getY(i) - c.y);
      const radial = ((position.getX(i) - c.x) * normal.getX(i) + (position.getY(i) - c.y) * normal.getY(i)) / d;
      if (Math.abs(normal.getZ(i)) < 1e-6 && d < 1.2 * eyeRadius && radial > 1 - 1e-6) {
        near += 1;
        assert.ok(Math.abs(d - eyeRadius) < 1e-6, `eye vertex off its circle: ${d}`);
        assert.ok(Math.abs(z) <= h);
      }
    }
    assert.ok(near > 100, 'each eye is a densely sampled arc');
    // The roller runs on its pin just behind the eye, with no shared face.
    const hubFront = new THREE.Box3().setFromObject(roller).applyMatrix4(frame.matrixWorld.clone().invert()).max.z;
    assert.ok(hubFront < -h && hubFront > -h - 0.006, `roller hub ${hubFront} not seated behind the eye`);
  }
  const pins = frame.children.filter((part) => part.userData.role === 'roller-pin-through-eye');
  assert.equal(pins.length, 3);
  for (const pin of pins) {
    const box = new THREE.Box3().setFromObject(pin).applyMatrix4(frame.matrixWorld.clone().invert());
    assert.ok(box.max.z > h && box.min.z < -h - 0.3, 'each pin runs through its eye into its roller');
  }
  // Chamfer normals: every band vertex normal is unit and the chamfers lean 45 degrees.
  let chamfers = 0;
  for (let i = 0; i < normal.count; i += 1) {
    const nz = Math.abs(normal.getZ(i));
    if (nz > 0.1 && nz < 0.9) { chamfers += 1; assert.ok(Math.abs(nz - Math.SQRT1_2) < 1e-6); }
  }
  assert.ok(chamfers > 0);
  // The wheel: grooves run out through the rim between raised sector frames
  // with a constant web width; no ink floor planes remain.
  assert.equal(driven.userData.grooves.filter((groove) => groove.isMesh).length, 0);
  assert.ok(driven.userData.webWidth > 0.1 && driven.userData.pocketOuterRadius < driven.userData.radius);
  let inkPlanes = 0;
  driven.traverse((part) => { if (part.isMesh && part.geometry.type === 'ShapeGeometry') inkPlanes += 1; });
  assert.equal(inkPlanes, 0);
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
  // p93-g fitted the view to both of Brown's shaft lines; that fit keeps the
  // lower wheel's axis within 6 degrees of the picture plane (sin 6 = 0.105).
  assert.ok(Math.abs(worldAxis(drivenAxis).dot(view)) < Math.sin(6 * Math.PI / 180));
  assert.ok(worldAxis(driverAxis).dot(view) < -0.4);
  const previousView = new THREE.Vector3(6.8, 0.1, 8.6).normalize();
  assert.ok(Math.abs(worldAxis(drivenAxis).dot(previousView)) > 0.3,
    'negative control: the earlier oblique view foreshortens the driven wheel');
});
