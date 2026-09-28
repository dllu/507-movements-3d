import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { makePulley, makeShaft } from '../src/simulation/primitives.js';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const modelFor = (id) => createMovementModel(catalog.movements[id - 1]);
const IDS = Array.from({ length: 23 }, (_, index) => index + 1);

const isDescendant = (object, ancestor) => {
  for (let node = object; node; node = node.parent) if (node === ancestor) return true;
  return false;
};

// Axial solids of a sheave (drum, rim, hub, grooved step) as local-Y lathes or
// cylinders. Returns the smallest radius at which the part has material.
const innerRadius = (mesh) => {
  const { type, parameters } = mesh.geometry;
  if (type === 'CylinderGeometry') return 0;
  return Math.min(...parameters.points.map((point) => point.x));
};
const axialRange = (mesh) => {
  const { type, parameters } = mesh.geometry;
  if (type === 'CylinderGeometry') return [-parameters.height / 2, parameters.height / 2];
  const ys = parameters.points.map((point) => point.y);
  return [Math.min(...ys), Math.max(...ys)];
};

// Any straight pin or shaft that is not carried by a sheave's rotor but lies
// on that sheave's axis must pass through a bore, not through solid material.
function unboredJournals(root) {
  root.updateMatrixWorld(true);
  const sheaves = [];
  const pins = [];
  root.traverse((object) => {
    const rotor = object.userData.rotor;
    if (rotor && (object.userData.faceIndicators
      || rotor.children.some((part) => part.userData.role === 'stepped-pulley-tread'))) sheaves.push(object);
    const geometry = object.geometry;
    if (object.isMesh && geometry?.type === 'CylinderGeometry'
      && geometry.parameters.radiusTop === geometry.parameters.radiusBottom
      && geometry.parameters.radiusTop <= 0.15) pins.push(object);
  });
  const faults = [];
  const inverse = new THREE.Matrix4();
  for (const sheave of sheaves) {
    const rotor = sheave.userData.rotor;
    const parts = rotor.children.filter((part) => part.isMesh
      && ['CylinderGeometry', 'LatheGeometry'].includes(part.geometry.type)
      && Math.abs(Math.abs(part.rotation.x) - Math.PI / 2) < 1e-9);
    for (const part of parts) {
      inverse.copy(part.matrixWorld).invert();
      const [low, high] = axialRange(part);
      for (const pin of pins) {
        if (isDescendant(pin, rotor) || pin === part) continue;
        const half = pin.geometry.parameters.height / 2;
        const ends = [half, -half].map((y) => new THREE.Vector3(0, y, 0)
          .applyMatrix4(pin.matrixWorld).applyMatrix4(inverse));
        if (ends.some((end) => Math.hypot(end.x, end.z) > 1e-4)) continue;
        const overlap = Math.min(high, Math.max(ends[0].y, ends[1].y))
          - Math.max(low, Math.min(ends[0].y, ends[1].y));
        if (overlap <= 1e-4) continue;
        const clearance = innerRadius(part) - pin.geometry.parameters.radiusTop;
        if (clearance < -1e-9) faults.push({ part: part.userData.role ?? part.geometry.type, clearance });
      }
    }
  }
  return faults;
}

test('belts-1-23: the journal checker rejects an unbored sheave on a fixed pin (negative control)', () => {
  const build = (bore) => {
    const root = new THREE.Group();
    const sheave = makePulley({ radius: 0.4, width: 0.2, spokes: 0, bore });
    root.add(sheave, makeShaft({ radius: 0.065, length: 0.6 }));
    return root;
  };
  assert.ok(unboredJournals(build(0)).length > 0, 'a solid drum and hub on a pin are reported');
  assert.deepEqual(unboredJournals(build(0.072)), []);
  const keyed = new THREE.Group();
  const sheave = makePulley({ radius: 0.4, width: 0.2, spokes: 0 });
  sheave.userData.rotor.add(makeShaft({ radius: 0.065, length: 0.6 }));
  keyed.add(sheave);
  assert.deepEqual(unboredJournals(keyed), [], 'a shaft keyed into the rotor turns with the sheave');
});

test('belts-1-23: makePulley bore is opt-in and a bored hub keeps a wall on small sheaves', () => {
  const solid = makePulley({ radius: 0.4, width: 0.2, spokes: 0 });
  const bored = makePulley({ radius: 0.17, width: 0.2, spokes: 0, bore: 0.082 });
  const types = (pulley) => pulley.userData.rotor.children.map((part) => part.geometry.type);
  assert.deepEqual(types(solid).slice(0, 1), ['CylinderGeometry']);
  assert.equal(types(solid).filter((type) => type === 'LatheGeometry').length, 0);
  const lathes = bored.userData.rotor.children.filter((part) => part.geometry.type === 'LatheGeometry');
  assert.equal(lathes.length, 2, 'drum and hub are both annular');
  for (const lathe of lathes) {
    const radii = lathe.geometry.parameters.points.map((point) => point.x);
    assert.equal(Math.min(...radii), 0.082);
    assert.ok(Math.max(...radii) >= 0.082 + 0.03 - 1e-12);
  }
  for (const mark of bored.userData.faceIndicators) {
    const inner = mark.position.x - mark.geometry.parameters.width / 2;
    assert.ok(inner > 0.082 + 0.03, 'face index marks stay outside the bored hub');
  }
});

test('belts-1-23: every sheave in 1-23 is keyed to its shaft or bored for its fixed pin', () => {
  for (const id of IDS) {
    const model = modelFor(id);
    for (const time of [0, 1.7, 4.4]) {
      model.update(time, 0.016);
      assert.deepEqual(unboredJournals(model.root), [], `movement ${id} at t=${time}`);
    }
  }
});

test('belts-1-23: no undrawn flow stripes or effort grips are added to 1-23', () => {
  for (const id of IDS) {
    const model = modelFor(id);
    const extras = [];
    model.root.traverse((object) => {
      if (object.userData.isFlowMarker || object.geometry?.type === 'CapsuleGeometry') extras.push(object);
    });
    assert.equal(extras.length, 0, `movement ${id} has ${extras.length} undrawn markers or grips`);
  }
});

test('belts-1-23: no undrawn white index stripes, rim patches or belt markers remain in 1-23', () => {
  const white = new THREE.Color(0xfaf9f5);
  for (const id of IDS) {
    const model = modelFor(id);
    const marks = [];
    model.root.traverse((object) => {
      if (object.isMesh && [object.material].flat().every((material) => material?.color?.equals(white))) marks.push(object);
    });
    assert.equal(marks.length, 0, `movement ${id} still draws ${marks.length} white index marks`);
    assert.ok(model.root.userData.removedWhiteIndexMarks >= 0);
  }
});

test('belts-1-23: 003 and 011 drums are plain cylinders as engraved, without flange rings', () => {
  for (const id of [3, 11]) {
    const { driver } = modelFor(id).root.userData.blocks;
    const tori = driver.userData.rotor.children.filter((part) => part.geometry?.type === 'TorusGeometry');
    assert.equal(tori.length, 0, `movement ${id} drum`);
  }
  const { driven } = modelFor(3).root.userData.blocks;
  assert.ok(driven.userData.rotor.children.some((part) => part.geometry?.type === 'TorusGeometry'),
    'control: the spoked pulley keeps its drawn rim');
});

test('belts-1-23: 004 guide sheaves stand wide of the driver as engraved', () => {
  const model = modelFor(4);
  const [driver, , left, right] = model.root.userData.beltContacts;
  for (const guide of [left, right]) {
    const offset = Math.abs(guide.object.position.x - driver.object.position.x) / driver.radius;
    assert.ok(offset > 2.3 && offset < 2.9, `guide offset ${offset.toFixed(2)} driver radii (source ~2.54)`);
  }
});

test('belts-1-23: 018 middle and movable sheaves are sized near the engraved three-quarters of the top', () => {
  const { upperRadius, lowerFixedRadius, movableRadius } = modelFor(18).root.userData.geometry;
  const ratio = lowerFixedRadius / upperRadius;
  assert.ok(ratio > 0.70 && ratio < 0.80, `middle/upper ratio ${ratio} (engraving ~0.74)`);
  const movableRatio = movableRadius / upperRadius;
  assert.ok(movableRatio > 0.66 && movableRatio < 0.74, `movable/upper ratio ${movableRatio} (engraving ~0.70)`);
  assert.ok(movableRadius < lowerFixedRadius, 'the movable sheave is the smallest, as engraved');
});

test('belts-1-23: 012 and 013 fixed sheaves hang by an open hook from a ceiling staple', () => {
  const twelve = modelFor(12).root.userData.blocks;
  assert.equal(twelve.hook.geometry.type, 'TorusGeometry');
  const hasTube = (group) => {
    let found = false;
    group.traverse((part) => { if (part.geometry?.type === 'TubeGeometry') found = true; });
    return found;
  };
  assert.ok(hasTube(twelve.suspension), 'the hanger carries the open J hook');
  const box = (object) => new THREE.Box3().setFromObject(object);
  twelve.suspension.updateMatrixWorld(true);
  assert.ok(Math.abs(box(twelve.hook).max.y - box(twelve.support).min.y) < 1e-6,
    'the staple is seated on the ceiling underside');
  // 12's eye is an eye bolt: its shank runs from inside the ring's crown up
  // into the beam, so the ring is not held by a tangent touch.
  const shank = box(twelve.eyeBoltShank), ring = box(twelve.hook), beam = box(twelve.support);
  assert.ok(shank.min.y < ring.max.y - 0.02 && shank.max.y > beam.min.y + 0.06 && shank.max.y < beam.max.y,
    'the shank is buried in both the ring and the beam');
  assert.ok(Math.abs((shank.min.x + shank.max.x) / 2 - (ring.min.x + ring.max.x) / 2) < 1e-6);
  const thirteen = modelFor(13).root.userData.blocks;
  thirteen.fixedHanger.updateMatrixWorld(true);
  assert.ok(hasTube(thirteen.fixedHanger));
  assert.ok(thirteen.anchorEye.position.y < box(thirteen.support).min.y);
});

test('belts-1-23 p93: 003 and 004 sheaves show cast ring hubs and short shaft stubs, as engraved', () => {
  for (const [id, keys] of [[3, ['driven', 'guideA', 'guideB']], [4, ['guideLeft', 'guideRight']]]) {
    const root = modelFor(id).root, blocks = root.userData.blocks ?? {};
    const pulleys = keys.map((key) => blocks[key]).filter(Boolean);
    if (id === 4) root.traverse((o) => { if (o.userData?.hub && o.userData.tread?.userData.role === 'solid-pulley-drum') pulleys.push(o); });
    assert.ok(pulleys.length >= 2, `${id} pulleys`);
    for (const pulley of pulleys) {
      const data = pulley.userData;
      assert.equal(data.hub.material, data.tread.material, `${id} hub in the wheel's metal`);
      const shaft = data.rotor.children.find((child) => child.userData.role === 'keyed-shaft');
      const length = new THREE.Box3().setFromObject(shaft).getSize(new THREE.Vector3());
      const shaftLength = shaft.userData.length ?? Math.max(length.x, length.y, length.z);
      assert.ok(shaftLength <= data.width + 0.10 + 1e-6, `${id} stub ${shaftLength}`);
    }
  }
});
