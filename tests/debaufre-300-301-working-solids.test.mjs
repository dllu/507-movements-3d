import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { DEBAUFRE_300_301_PALLET } from '../src/simulation/baked/debaufre-300-301-pallet.js';
import { createMovementModel } from '../src/simulation/registry.js';
import { densePoints } from './helpers/dense-points.mjs';
import { solidSurface } from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const create = (id = 300) => createMovementModel(catalog.movements[id - 1]);

function renderedMeshes(group) {
  const meshes = [];
  group.traverse((object) => {
    if (!object.isMesh) return;
    for (let node = object; node; node = node.parent) if (!node.visible) return;
    meshes.push(object);
  });
  return meshes;
}

function signedVolume(geometry) {
  const p = geometry.attributes.position, index = geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let volume = 0;
  for (let t = 0; t < (index?.count ?? p.count); t += 3) {
    const at = (k) => (index ? index.getX(t + k) : t + k);
    a.fromBufferAttribute(p, at(0)); b.fromBufferAttribute(p, at(1)); c.fromBufferAttribute(p, at(2));
    volume += a.dot(b.clone().cross(c)) / 6;
  }
  return volume;
}

function prepared(meshes, spacing) {
  return meshes.map((mesh) => ({ mesh, points: densePoints(mesh.geometry, spacing), field: solidSurface(mesh.geometry) }));
}

function deepest(source, target) {
  const relative = target.mesh.matrixWorld.clone().invert().multiply(source.mesh.matrixWorld), q = new THREE.Vector3();
  let depth = 0;
  for (const p of source.points) {
    q.copy(p).applyMatrix4(relative);
    if (target.field.box.containsPoint(q) && target.field.inside(q)) depth = Math.max(depth, target.field.distance(q));
  }
  return depth;
}

function worstPenetration(model, escape, pallet, samples) {
  let worst = { depth: 0 };
  for (let i = 0; i <= samples; i += 1) {
    const time = 4 * i / samples;
    model.update(time); model.root.updateMatrixWorld(true);
    for (const a of escape) for (const c of pallet) {
      const depth = Math.max(deepest(a, c), deepest(c, a));
      if (depth > worst.depth) worst = { depth, time, pair: `${a.mesh.userData.role} x ${c.mesh.userData.role}` };
    }
  }
  return worst;
}

// The escape body is everything carried by the common arbor; the pallet body
// is everything carried by the balance staff.
function bodies(model) {
  const b = model.root.userData.blocks;
  const escape = [b.frontWheel, b.rearWheel, b.commonEscapeArbor].flatMap(renderedMeshes);
  return { escape, pallet: renderedMeshes(b.palletAssembly) };
}

test('300/301 baked pallet bands match the production escapement geometry', () => {
  const g = create().root.userData.geometry;
  for (const [key, value] of Object.entries(DEBAUFRE_300_301_PALLET.geometryFingerprint)) {
    if (key === 'toothProfile') assert.deepEqual(value, { ...g.toothProfile });
    else assert.equal(value, g[key], `${key}: regenerate with scripts/generate-debaufre-300-301-pallet.mjs`);
  }
  assert.equal(DEBAUFRE_300_301_PALLET.heights.length,
    DEBAUFRE_300_301_PALLET.x.count * DEBAUFRE_300_301_PALLET.z.count);
});

test('300/301 working solids are closed, outward and connected', () => {
  const model = create();
  const { blocks, geometry: g } = model.root.userData;
  for (const mesh of [blocks.palletBody, ...blocks.palletSweptBands, ...blocks.impulseLips]) {
    assert.ok(signedVolume(mesh.geometry) > 0, `${mesh.userData.role} is outward-wound`);
  }
  // The flanges' end walls stand 0.002 inside the bands' (were coplanar).
  for (const [band, lip] of blocks.palletSweptBands.map((b, i) => [b, blocks.impulseLips[i]])) {
    band.geometry.computeBoundingBox(); lip.geometry.computeBoundingBox();
    const [bb, lb] = [band.geometry.boundingBox, lip.geometry.boundingBox];
    assert.ok(Math.abs(lb.min.x - bb.min.x - 0.002) < 1e-6);
    assert.ok(Math.abs(bb.max.x - lb.max.x - 0.002) < 1e-6);
  }
  for (const wheel of [blocks.frontWheel, blocks.rearWheel]) {
    // One closed plate: rim, spokes meeting the rim's inside, boss, teeth.
    const plate = wheel.userData.plate;
    assert.ok(signedVolume(plate.geometry) > 0, 'spoked plate is outward-wound');
    const params = plate.geometry.userData.spokedWheel;
    assert.equal(params.rimInnerRadius, g.wheelRimRadius - 0.17);
    assert.ok(params.rimInnerRadius < g.wheelRimRadius, 'spokes run into the rim');
    const p = plate.geometry.attributes.position;
    let outer = 0;
    for (let i = 0; i < p.count; i += 1) outer = Math.max(outer, Math.hypot(p.getX(i), p.getY(i)));
    assert.ok(Math.abs(outer - g.wheelContactRadius) < 1e-6, 'plate teeth reach the contact radius');
    for (const tooth of wheel.userData.toothMeshes) {
      tooth.geometry.computeBoundingSphere();
      const p = tooth.geometry.attributes.position;
      let outer = 0;
      for (let i = 0; i < p.count; i += 1) outer = Math.max(outer, Math.hypot(p.getX(i), p.getY(i)));
      assert.ok(Math.abs(outer - g.wheelContactRadius) < 1e-6, 'the barb point is the outermost tooth point');
    }
  }
  // Brown 301: 129 px between wheel planes against 344 px arbor-to-journal.
  assert.ok(Math.abs(2 * g.wheelPlaneOffset / g.wheelContactRadius - 129 / 344) < 0.01);
});

test('300/301 rigid escape and pallet bodies do not penetrate through the cycle', () => {
  const model = create();
  const { escape, pallet } = bodies(model);
  const worst = worstPenetration(model, prepared(escape, 0.02), prepared(pallet, 0.02), 160);
  assert.equal(worst.depth, 0, `${worst.pair} penetrates ${worst.depth} at ${worst.time}`);
});

test('negative control: an uncarved plain D is struck by the passing teeth', () => {
  const model = create();
  const { geometry: g, blocks } = model.root.userData;
  const shape = new THREE.Shape();
  shape.moveTo(-g.palletRadius, 0);
  shape.lineTo(g.palletRadius, 0);
  for (let k = 1; k < 64; k += 1) shape.lineTo(g.palletRadius * Math.cos(-k * Math.PI / 64), g.palletRadius * Math.sin(-k * Math.PI / 64));
  const plain = new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, depth: g.palletThickness / 2 - g.restFaceX });
  plain.rotateY(Math.PI / 2); plain.translate(g.restFaceX, 0, 0);
  const plainMesh = new THREE.Mesh(plain);
  plainMesh.userData.role = 'uncarved-plain-D-control';
  blocks.palletAssembly.add(plainMesh);
  const { escape } = bodies(model);
  const teeth = prepared(escape.filter((mesh) => mesh.userData.role === 'debaufre-ratchet-wheel-one-piece-spoked-plate'), 0.02);
  const worst = worstPenetration(model, teeth, prepared([plainMesh], 0.02), 160);
  // The 0.475-thick D (was 0.673) is struck about 0.045 deep.
  assert.ok(worst.depth > 0.03, `control detects the old tooth-through-flat failure (${worst.depth})`);
});

test('the active tooth point rests on the face and rides the carved flange', () => {
  const model = create();
  const { blocks, geometry: g, stateAtTime } = model.root.userData;
  const lipFields = blocks.impulseLips.map((lip) => solidSurface(lip.geometry));
  const bandFields = blocks.palletSweptBands.map((band) => solidSurface(band.geometry));
  const bodyField = solidSurface(blocks.palletBody.geometry);
  const rest = [Infinity, 0];
  const impulse = [Infinity, 0];
  const impulseTail = [Infinity, 0];
  let penetrations = 0;
  for (let i = 0; i <= 4000; i += 1) {
    const time = 4 * i / 4000, state = stateAtTime(time);
    if (!state.contact) continue;
    model.update(time); model.root.updateMatrixWorld(true);
    const side = state.activeWheel === 'front' ? 1 : 0;
    const wheel = state.activeWheel === 'front' ? blocks.frontWheel : blocks.rearWheel;
    const tip = wheel.userData.toothTips[state.contact.activeToothIndex];
    // The working point is the barb's edge across the wheel thickness.
    const edge = [-0.4999, 0, 0.4999].map((f) => new THREE.Vector3(tip.x, tip.y, f * g.wheelDepth)
      .applyMatrix4(wheel.userData.rotor.matrixWorld));
    const pairs = [
      [lipFields[side], blocks.impulseLips[side]],
      [bandFields[side], blocks.palletSweptBands[side]],
      [bodyField, blocks.palletBody],
    ];
    let gap = Infinity;
    for (const [field, mesh] of pairs) {
      const inverse = mesh.matrixWorld.clone().invert();
      for (const point of edge) {
        const p = point.clone().applyMatrix4(inverse);
        if (field.box.containsPoint(p) && field.inside(p)) penetrations += 1;
        gap = Math.min(gap, field.distance(p));
      }
    }
    const range = state.frictionalRest ? rest : state.contact.impulseProgress <= 0.75 ? impulse : impulseTail;
    range[0] = Math.min(range[0], gap); range[1] = Math.max(range[1], gap);
  }
  assert.equal(penetrations, 0, 'working edge never inside the pallet');
  assert.ok(Math.abs(rest[0] - g.restFaceFilm) < 1e-6, `rest gap reaches the face film: ${rest}`);
  assert.ok(rest[1] < 0.01, `rest edge stays on the face: ${rest}`);
  assert.ok(impulse[1] < 0.02, `edge rides the impulse flange: ${impulse}`);
  // Recorded residual: the prescribed wheel eases to rest before release while
  // the balance keeps turning, so the edge lifts off the flange at the end.
  assert.ok(impulseTail[1] < 0.06, `bounded end-of-impulse lift-off: ${impulseTail}`);

  // Negative control: advancing a resting wheel one degree must drive the
  // point through the rest face, so the measured gap is working proximity.
  const time = 0.1, state = stateAtTime(time);
  assert.equal(state.frictionalRest, true);
  model.update(time);
  blocks.frontWheel.userData.rotor.rotation.z += THREE.MathUtils.degToRad(1);
  model.root.updateMatrixWorld(true);
  const tipIndex = state.contact.activeToothIndex;
  const tip = blocks.frontWheel.userData.toothTips[tipIndex].clone()
    .applyMatrix4(blocks.frontWheel.userData.rotor.matrixWorld)
    .applyMatrix4(blocks.palletBody.matrixWorld.clone().invert());
  assert.ok(bodyField.inside(tip), 'advanced resting tip enters the pallet');
});

test('301 frames the side elevation and hides diagnostic witnesses', () => {
  const side = create(301), front = create(300);
  const g = side.root.userData.geometry;
  const direction = side.cameraDirection.clone().normalize();
  assert.ok(direction.dot(new THREE.Vector3(1, 0, 0)) > 0.99, 'looks along the balance staff');
  assert.ok(Math.abs(direction.z) < 1e-12, 'no yaw toward either wheel');
  assert.ok(side.root.userData.cameraFov <= 20, 'narrow field approximates Brown’s orthographic plate');
  const bounds = side.root.userData.cameraFitBounds;
  const centre = bounds.getCenter(new THREE.Vector3());
  // The camera sits on the staff axis at the expected fit distance.
  assert.ok(Math.abs(centre.y + direction.y / direction.x * 121.16 - g.palletCenterY) < 1e-9);
  for (const model of [front, side]) {
    const { blocks } = model.root.userData;
    for (const time of [0, 1, 2, 3]) {
      model.update(time);
      assert.equal(blocks.frontContactMarker.visible, false);
      assert.equal(blocks.rearContactMarker.visible, false);
    }
  }
});
