import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  AMBIENT_OCCLUSION_SETTINGS, ScreenSpaceAmbientOcclusion, shouldStartAmbientOcclusion,
} from '../src/simulation/ambient-occlusion.js';

const fakeRenderer = (name) => ({
  getContext: () => ({
    getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }),
    getParameter: () => name,
  }),
});

test('AO preference: explicit settings win, auto skips software renderers', () => {
  const gpu = fakeRenderer('ANGLE (NVIDIA, Vulkan)');
  assert.equal(shouldStartAmbientOcclusion(undefined, gpu), false);
  assert.equal(shouldStartAmbientOcclusion(false, gpu), false);
  assert.equal(shouldStartAmbientOcclusion('off', gpu), false);
  assert.equal(shouldStartAmbientOcclusion('on', fakeRenderer('SwiftShader')), true);
  assert.equal(shouldStartAmbientOcclusion('auto', gpu), true);
  assert.equal(shouldStartAmbientOcclusion('auto', fakeRenderer('ANGLE (Google, SwiftShader Device)')), false);
  assert.equal(shouldStartAmbientOcclusion('auto', fakeRenderer('llvmpipe (LLVM 15)')), false);
});

test('AO prepass mirrors opaque materials and turns transparent ones into transmittance masks', () => {
  const ao = new ScreenSpaceAmbientOcclusion({}, new THREE.Scene(), new THREE.PerspectiveCamera());
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const opaque = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, clippingPlanes: [plane] });
  const normal = ao.normalMaterialFor(opaque);
  assert.ok(normal.isMeshNormalMaterial);
  assert.equal(normal.side, THREE.DoubleSide);
  assert.deepEqual(normal.clippingPlanes, [plane]);
  assert.equal(ao.normalMaterialFor(opaque), normal);
  const water = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.4, depthWrite: false });
  const mask = ao.normalMaterialFor(water);
  assert.ok(mask.isMeshBasicMaterial && mask.transparent);
  assert.equal(mask.opacity, 0.4);
  assert.equal(mask.blendDstAlpha, THREE.OneMinusSrcAlphaFactor);
  assert.equal(ao.normalMaterialFor(new THREE.ShadowMaterial({ opacity: 0.14 })).visible, false);
  assert.equal(ao.normalMaterialFor(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })).visible, false);
  assert.ok(AMBIENT_OCCLUSION_SETTINGS.intensity > 0 && AMBIENT_OCCLUSION_SETTINGS.intensity <= 1);
  ao.dispose();
});
