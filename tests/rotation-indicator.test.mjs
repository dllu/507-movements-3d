import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyRotationIndicator, hasRotationIndicator, rotationIndicatorFrame } from '../src/simulation/rotation-indicator.js';
import { makeConePulley, makePulley, makeSteppedPulley, matte } from '../src/simulation/primitives.js';

const spinPoint = (mesh, point) => point.clone().applyMatrix4(rotationIndicatorFrame([mesh.material].flat()[0]));

test('the quadrant cue is a per-mesh material patch with no extra meshes', () => {
  const material = matte(0xde5a3f);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 32), material);
  const sibling = new THREE.Mesh(mesh.geometry, material);
  const group = new THREE.Group();
  group.add(mesh, sibling);
  applyRotationIndicator(mesh);
  assert.equal(group.children.length, 2);
  assert.ok(hasRotationIndicator(mesh));
  assert.notEqual(mesh.material, material, 'the patched material is the mesh\'s own');
  assert.equal(sibling.material, material, 'shared materials elsewhere stay plain');
  assert.equal(mesh.geometry, sibling.geometry, 'geometry and normals are untouched');
  assert.equal(mesh.material.color.getHex(), 0xde5a3f);
  assert.equal(mesh.material.customProgramCacheKey(), 'rotation-indicator-v2');
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>',
  };
  mesh.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /rotationQuadrant/);
  assert.ok(shader.uniforms.rotationIndicatorFrame);
  // A cylinder turns about its geometry Y axis: that axis maps to the spin Z.
  const axisPoint = spinPoint(mesh, new THREE.Vector3(0, 0.1, 0));
  assert.ok(Math.hypot(axisPoint.x, axisPoint.y) < 1e-9);
  // Applying twice does nothing more.
  const patched = mesh.material;
  applyRotationIndicator(mesh);
  assert.equal(mesh.material, patched);
  // Later clones (cutaways, clipping) keep the cue.
  const copy = patched.clone();
  assert.ok(copy.userData.rotationIndicator);
  assert.equal(copy.customProgramCacheKey(), 'rotation-indicator-v2');
  assert.ok(rotationIndicatorFrame(copy).equals(rotationIndicatorFrame(patched)));
});

test('a frame ancestor supplies the spin axis for grouped meshes', () => {
  const pulley = makePulley({ radius: 1, spokes: 0 });
  const rotor = pulley.userData.rotor;
  const tread = pulley.userData.tread;
  assert.ok(hasRotationIndicator(tread));
  assert.ok(hasRotationIndicator(pulley.userData.hub));
  // A point on the rotor's Z axis lies on the spin axis in the shader frame.
  const local = new THREE.Vector3(0, 0, 0.1).applyMatrix4(tread.matrix.clone().invert());
  const onAxis = spinPoint(tread, local);
  assert.ok(Math.hypot(onAxis.x, onAxis.y) < 1e-9);
  assert.equal(rotor.children.filter((child) => child.isMesh && child.visible
    && child.material.color?.getHex() === 0xfaf9f5).length, 0, 'no white index marks');
});

test('spoked pulleys show their turning through their spokes; plain ones carry the cue', () => {
  const spoked = makePulley({ radius: 1, spokes: 4 });
  assert.ok(!hasRotationIndicator(spoked.userData.tread));
  assert.ok(hasRotationIndicator(makePulley({ radius: 1, spokes: 4, rotationIndicator: true }).userData.tread));
  assert.ok(!hasRotationIndicator(makePulley({ spokes: 0, rotationIndicator: false }).userData.tread));
  const stepped = makeSteppedPulley();
  const steps = stepped.userData.rotor.children.filter((child) => child.userData.role === 'stepped-pulley-tread');
  assert.equal(steps.length, 3);
  assert.ok(steps.every(hasRotationIndicator));
  assert.equal(stepped.userData.rotor.children.length, 3, 'no stripe meshes on the steps');
  const cone = makeConePulley();
  assert.ok(hasRotationIndicator(cone.userData.body));
  assert.equal(cone.userData.rotor.children.length, 2, 'cone body and shaft only');
});

test('the auto axis finds a solid of revolution and skips shapes that are not', () => {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 48).rotateX(Math.PI / 2).translate(0.3, 0, 0), matte(0x315f78));
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.1), matte(0x315f78));
  group.add(disc, spoke);
  const patched = applyRotationIndicator(group, { axis: 'auto' });
  assert.deepEqual(patched, [disc]);
  // The disc's axis is geometry Z through its offset centre.
  const onAxis = spinPoint(disc, new THREE.Vector3(0.3, 0, 0.05));
  assert.ok(Math.hypot(onAxis.x, onAxis.y) < 1e-6);
  const offAxis = spinPoint(disc, new THREE.Vector3(0.8, 0, 0));
  assert.ok(Math.abs(Math.hypot(offAxis.x, offAxis.y) - 0.5) < 1e-6);
});

test('every listed role pattern gives a production part the cue', async () => {
  const { readFile } = await import('node:fs/promises');
  const { default: loadMujoco } = await import('@mujoco/mujoco');
  const { default: entries } = await import('../src/data/rotation-indicators.js');
  const { loadMovementModel, physicsFactories } = await import('../src/simulation/model-loader.js');
  const { applySourcePresentation } = await import('../src/simulation/source-presentation.js');
  const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (resource, ...rest) => {
    const url = new URL(resource);
    return url.protocol === 'file:' ? new Response(await readFile(url)) : nativeFetch(resource, ...rest);
  };
  try {
    for (const [key, patterns] of Object.entries(entries)) {
      const movement = catalog.movements[Number(key) - 1];
      let model;
      if (physicsFactories[movement.id]) {
        model = (await physicsFactories[movement.id]())(await loadMujoco());
        applySourcePresentation(model, movement);
      } else model = await loadMovementModel(movement);
      const cued = [];
      model.root.traverse((object) => { if (object.isMesh && hasRotationIndicator(object)) cued.push(object); });
      for (const entry of patterns) {
        const pattern = new RegExp(`^(?:${typeof entry === 'string' ? entry : entry.pattern})$`);
        const hit = cued.some((mesh) => {
          for (let node = mesh; node; node = node.parent) if (pattern.test(node.userData.role || node.name || '')) return true;
          return false;
        });
        assert.ok(hit, `${key}: ${pattern} gives a visible solid of revolution the cue`);
      }
      model.dispose?.();
    }
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
