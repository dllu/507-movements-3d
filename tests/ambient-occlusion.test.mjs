import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  AMBIENT_OCCLUSION_SETTINGS, SCREEN_SPACE_AO_UNIFORMS, ScreenSpaceAmbientOcclusion,
  patchMaterialForScreenSpaceAO, shouldStartAmbientOcclusion,
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

test('AO prepass mirrors opaque materials and leaves transparent ones out', () => {
  const ao = new ScreenSpaceAmbientOcclusion({}, new THREE.Scene(), new THREE.PerspectiveCamera());
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const opaque = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, clippingPlanes: [plane] });
  const normal = ao.normalMaterialFor(opaque);
  assert.ok(normal.isMeshNormalMaterial);
  assert.equal(normal.side, THREE.DoubleSide);
  assert.deepEqual(normal.clippingPlanes, [plane]);
  assert.equal(ao.normalMaterialFor(opaque), normal);
  const water = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.4, depthWrite: false });
  assert.equal(ao.normalMaterialFor(water).visible, false);
  assert.equal(ao.normalMaterialFor(new THREE.ShadowMaterial({ opacity: 0.14 })).visible, false);
  assert.ok(AMBIENT_OCCLUSION_SETTINGS.intensity > 0 && AMBIENT_OCCLUSION_SETTINGS.intensity <= 1);
  ao.dispose();
});

test('AO scales only the indirect light of lit opaque materials, once', () => {
  const lit = new THREE.MeshStandardMaterial();
  let hooked = 0;
  lit.onBeforeCompile = () => { hooked += 1; };
  assert.equal(patchMaterialForScreenSpaceAO(lit), true);
  assert.equal(patchMaterialForScreenSpaceAO(lit), false);
  const shader = { uniforms: {}, fragmentShader: 'void main() {\n#include <aomap_fragment>\n}' };
  lit.onBeforeCompile(shader, null);
  assert.equal(hooked, 1, 'the original hook still runs');
  assert.match(shader.fragmentShader, /reflectedLight\.indirectDiffuse \*= screenSpaceAO/);
  assert.doesNotMatch(shader.fragmentShader, /\.directDiffuse \*=|gl_FragColor/);
  assert.equal(shader.uniforms.screenSpaceAOIntensity, SCREEN_SPACE_AO_UNIFORMS.screenSpaceAOIntensity);
  assert.match(lit.customProgramCacheKey(), /screen-space-ao/);
  assert.equal(patchMaterialForScreenSpaceAO(new THREE.MeshBasicMaterial()), false);
  assert.equal(patchMaterialForScreenSpaceAO(new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 })), false);
});
