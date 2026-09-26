import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import {
  makeSeeThrough, isSeeThrough, SEE_THROUGH_OPACITY, SEE_THROUGH_EDGE_OPACITY, SEE_THROUGH_RENDER_ORDER,
} from '../src/simulation/see-through-part.js';
import { applyRotationIndicator, hasRotationIndicator } from '../src/simulation/rotation-indicator.js';
import { matte, markShadows } from '../src/simulation/primitives.js';
import { createMovementModel } from '../src/simulation/registry.js';
import { makeVariableCrankGeometry } from '../src/simulation/mujoco-variable-crank/geometry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const dispose = (root) => root.traverse((object) => {
  object.geometry?.dispose();
  [object.material].flat().forEach((material) => material?.dispose());
});

test('see-through parts share one style: face opacity, edge term, no depth write, drawn after, no shadow', () => {
  const material = matte(0xde5a3f);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2), material);
  const sibling = new THREE.Mesh(mesh.geometry, material);
  const root = new THREE.Group();
  root.add(mesh, sibling);
  assert.deepEqual(makeSeeThrough(mesh), [mesh]);
  assert.ok(isSeeThrough(mesh));
  assert.equal(sibling.material, material, 'shared materials elsewhere stay opaque');
  assert.equal(material.transparent, false);
  const m = mesh.material;
  assert.equal(m.transparent, true);
  assert.equal(m.opacity, SEE_THROUGH_OPACITY);
  assert.equal(m.depthWrite, false);
  assert.equal(m.side, THREE.FrontSide);
  assert.equal(mesh.renderOrder, SEE_THROUGH_RENDER_ORDER);
  assert.deepEqual(m.userData.seeThrough, { opacity: SEE_THROUGH_OPACITY, edgeOpacity: SEE_THROUGH_EDGE_OPACITY });
  const shader = { fragmentShader: 'varying vec3 vViewPosition;\n#include <opaque_fragment>' };
  m.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /seeThroughEdge/);
  // Clones (cutaways, recolouring) keep the treatment.
  assert.equal(m.clone().userData.seeThrough.opacity, SEE_THROUGH_OPACITY);
  assert.equal(m.clone().depthWrite, false);
  markShadows(root);
  assert.equal(mesh.castShadow, false, 'a see-through part does not shade what it reveals');
  assert.equal(sibling.castShadow, true);
  assert.deepEqual(makeSeeThrough(mesh), [], 'applying twice is a no-op');
});

test('a see-through part can also carry the quadrant rotation cue, in either order', () => {
  for (const order of ['cue-first', 'see-through-first']) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 48), matte(0x3f7fde));
    if (order === 'cue-first') { applyRotationIndicator(mesh); makeSeeThrough(mesh); } else { makeSeeThrough(mesh); applyRotationIndicator(mesh); }
    assert.ok(hasRotationIndicator(mesh) && isSeeThrough(mesh), order);
    assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.material.depthWrite, false);
    assert.match(mesh.material.customProgramCacheKey(), /see-through/);
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\nvarying vec3 vViewPosition;\n#include <color_fragment>\n#include <opaque_fragment>',
    };
    mesh.material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /rotationQuadrant/);
    assert.match(shader.fragmentShader, /seeThroughEdge/);
  }
});

// Where Brown dots working parts behind a foreground part, that part (and
// only that part) is see-through.
const SEE_THROUGH = {
  63: ['see-through-broad-hooked-pawl-plate'],
  67: ['tumblerPlate'],
  70: ['driverCover'],
  71: ['B-front-plate-carrying-guard-rim'],
  279: ['left-taper-bearing-lining-piece', 'right-taper-bearing-lining-piece', 'left-adjustable-taper-gib', 'right-adjustable-taper-gib'],
  // 281's groove is on the disk's front face; its hand crank behind is
  // seen by rotating, so the disk is opaque.
  281: [],
};
for (const [id, expected] of Object.entries(SEE_THROUGH)) {
  test(`movement ${id} makes exactly the occluding foreground part see-through`, () => {
    const model = createMovementModel(catalog.movements[id - 1]);
    const found = [];
    model.root.traverse((object) => {
      if (!isSeeThrough(object)) return;
      const role = object.userData.role || object.name
        || (object.userData.driverDisk ? 'driverBody' : object.parent?.userData.role || object.parent?.name);
      found.push(role);
    });
    assert.equal(found.length, expected.length, `${id}: ${found}`);
    for (const role of expected) assert.ok(found.includes(role), `${id}: ${role} in ${found}`);
    dispose(model.root);
  });
}

test('movement 94 shows the spiral groove plate through its see-through slotted plate', () => {
  const visual = makeVariableCrankGeometry();
  const { parts } = visual.root.userData;
  assert.ok(isSeeThrough(parts.radialPlate));
  assert.equal(parts.radialPlate.castShadow, false);
  for (const name of ['spiralPlate', 'frontHub', 'bolt', 'boltHead']) assert.equal(isSeeThrough(parts[name]), false, name);
  dispose(visual.root);
});
