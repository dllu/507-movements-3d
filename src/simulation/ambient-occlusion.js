import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

// Subtle screen-space ambient occlusion for the interactive viewer.
//
// Before the frame is drawn, a reduced-resolution normal/depth prepass feeds
// three's GTAO and Poisson denoise shaders. The lit materials then sample
// the result by screen position and apply it to their INDIRECT (hemisphere)
// light only, as a baked AO map would: direct sunlight, colour saturation
// and the background are untouched, and a crease that the key light still
// reaches darkens only by its share of ambient light.
//
// The prepass mirrors what the main pass draws: each opaque mesh gets a
// normal material that keeps its side, flat shading and clipping planes (so
// clean cutaways stay clean) and any vertex-deforming shader hook (laid rope).
// Transparent materials (water, glass) add no depth and take no AO, so a
// surface seen through water keeps its own occlusion. The shadow-catching
// floor, lines, points and sprites are left out.
export const AMBIENT_OCCLUSION_SETTINGS = Object.freeze({
  // AO buffer size relative to the canvas drawing buffer (pixel ratio 2), so
  // 0.5 renders AO at one sample per CSS pixel.
  resolutionScale: 0.5,
  // World-space AO radius as a fraction of the fitted model radius.
  radiusFraction: 0.08,
  samples: 16,
  denoiseSamples: 16,
  denoiseRadius: 10,
  // Occluders count only within this depth of the surface, as a fraction of
  // the AO radius, so parts far in front of a face (not touching it) cast no
  // AO onto it.
  thicknessFraction: 1,
  distanceExponent: 1.5,
  // Fraction of the computed occlusion applied to the indirect light.
  intensity: 1,
  // Adaptive switch-off ('auto'): after warm-up, AO is dropped for the view
  // once frames slower than slowFrameSeconds run back to back for
  // slowRunSeconds (so about 1.5 s of sub-34 fps playback).
  slowFrameSeconds: 1 / 34,
  slowRunSeconds: 1.5,
  warmupFrames: 10,
});

const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });

function isRenderedOpaque(material) {
  return material && material.visible !== false && !material.transparent
    && material.opacity >= 1 && material.depthWrite !== false && material.colorWrite !== false;
}

// Injected after three's own aomap_fragment: the screen-space AO scales the
// indirect light only.
const SSAO_PARS = `uniform sampler2D tScreenSpaceAO;
uniform vec2 screenSpaceAOSize;
uniform float screenSpaceAOIntensity;
`;
const SSAO_FRAGMENT = `
{
  float screenSpaceAO = mix(1.0, texture2D(tScreenSpaceAO, gl_FragCoord.xy / screenSpaceAOSize).r, screenSpaceAOIntensity);
  reflectedLight.indirectDiffuse *= screenSpaceAO;
  reflectedLight.indirectSpecular *= screenSpaceAO;
}
`;
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;
// Shared by every patched material; intensity 0 (and a white map) when AO is
// off, so patched materials render exactly as before.
export const SCREEN_SPACE_AO_UNIFORMS = {
  tScreenSpaceAO: { value: WHITE },
  screenSpaceAOSize: { value: new THREE.Vector2(1, 1) },
  screenSpaceAOIntensity: { value: 0 },
};
const patchedMaterials = new WeakSet();

function isLit(material) {
  return material.isMeshStandardMaterial || material.isMeshLambertMaterial
    || material.isMeshPhongMaterial || material.isMeshToonMaterial;
}

// Chain the AO hook onto a lit opaque material (once; later AO toggles only
// change the shared uniforms, so there is no recompile).
export function patchMaterialForScreenSpaceAO(material) {
  if (!material || patchedMaterials.has(material) || !isLit(material) || !isRenderedOpaque(material)) return false;
  patchedMaterials.add(material);
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function onBeforeCompile(shader, renderer) {
    previous?.call(this, shader, renderer);
    Object.assign(shader.uniforms, SCREEN_SPACE_AO_UNIFORMS);
    shader.fragmentShader = SSAO_PARS + shader.fragmentShader
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>${SSAO_FRAGMENT}`);
  };
  material.customProgramCacheKey = function customProgramCacheKey() {
    return `${previousKey.call(this)}|screen-space-ao`;
  };
  material.needsUpdate = true;
  return true;
}

export class ScreenSpaceAmbientOcclusion {
  constructor(renderer, scene, camera, settings = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.settings = { ...AMBIENT_OCCLUSION_SETTINGS, ...settings };
    this.pass = new GTAOPass(scene, camera, 2, 2);
    this.pass.output = GTAOPass.OUTPUT.Off;
    // This class renders the normal/depth buffer itself (see prepass).
    this.pass._renderGBuffer = false;
    this.pass.updateGtaoMaterial({
      samples: this.settings.samples,
      thickness: 0.25 * this.settings.thicknessFraction,
      distanceExponent: this.settings.distanceExponent,
      distanceFallOff: 1,
      scale: 1,
      radius: 0.25,
    });
    this.pass.updatePdMaterial({
      samples: this.settings.denoiseSamples, rings: 2, radius: this.settings.denoiseRadius,
      lumaPhi: 10, depthPhi: 2, normalPhi: 3,
    });
    this.normalMaterials = new WeakMap();
    this.ownedMaterials = [];
    this.swapped = [];
    this.hidden = [];
    this.clearColor = new THREE.Color();
    this.drawingSize = new THREE.Vector2();
  }

  setModelRadius(radius) {
    const aoRadius = Math.max(0.02, radius * this.settings.radiusFraction);
    this.pass.updateGtaoMaterial({ radius: aoRadius, thickness: aoRadius * this.settings.thicknessFraction });
    // Denoise depth tolerance in world units, so blur does not cross steps.
    this.pass.updatePdMaterial({ depthPhi: aoRadius * 0.5 });
  }

  setSize(drawingWidth, drawingHeight) {
    const scale = this.settings.resolutionScale;
    const width = Math.max(1, Math.round(drawingWidth * scale));
    const height = Math.max(1, Math.round(drawingHeight * scale));
    if (width === this.pass.width && height === this.pass.height) return;
    this.pass.setSize(width, height);
  }

  normalMaterialFor(material) {
    if (!isRenderedOpaque(material)) return HIDDEN;
    let normal = this.normalMaterials.get(material);
    if (normal) {
      normal.side = material.side;
      normal.clippingPlanes = material.clippingPlanes;
      normal.clipIntersection = material.clipIntersection;
      return normal;
    }
    normal = new THREE.MeshNormalMaterial({
      side: material.side,
      flatShading: Boolean(material.flatShading),
      clippingPlanes: material.clippingPlanes,
      clipIntersection: material.clipIntersection,
      blending: THREE.NoBlending,
    });
    // Keep vertex deformation hooks (for example the moving laid rope) so the
    // prepass sees the same surface. The rotation cue only recolours
    // fragments and is not needed here.
    if (material.onBeforeCompile && !material.userData?.rotationIndicator
      && material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
      normal.onBeforeCompile = material.onBeforeCompile;
      const key = material.customProgramCacheKey();
      normal.customProgramCacheKey = () => `ao-normal:${key}`;
    }
    this.normalMaterials.set(material, normal);
    this.ownedMaterials.push(normal);
    return normal;
  }

  prepass() {
    const { swapped, hidden } = this;
    this.scene.traverseVisible((object) => {
      if (object.isMesh) {
        const original = object.material;
        if (Array.isArray(original)) original.forEach(patchMaterialForScreenSpaceAO);
        else patchMaterialForScreenSpaceAO(original);
        const replacement = Array.isArray(original)
          ? original.map((material) => this.normalMaterialFor(material))
          : this.normalMaterialFor(original);
        swapped.push(object, original);
        object.material = replacement;
      } else if (object.isLine || object.isPoints || object.isSprite) {
        hidden.push(object);
      }
    });
    for (const object of hidden) object.visible = false;
    const renderer = this.renderer;
    const background = this.scene.background;
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const autoClear = renderer.autoClear;
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    this.scene.background = null;
    renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.pass.normalRenderTarget);
    renderer.setClearColor(0x7777ff, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(this.clearColor, clearAlpha);
    renderer.autoClear = autoClear;
    renderer.shadowMap.autoUpdate = shadowAutoUpdate;
    this.scene.background = background;
    for (let index = 0; index < swapped.length; index += 2) swapped[index].material = swapped[index + 1];
    for (const object of hidden) object.visible = true;
    swapped.length = 0;
    hidden.length = 0;
  }

  // Call before the frame is drawn: computes the AO buffer that the lit
  // materials sample.
  render() {
    const renderer = this.renderer;
    renderer.getDrawingBufferSize(this.drawingSize);
    this.setSize(this.drawingSize.x, this.drawingSize.y);
    this.prepass();
    this.pass.render(renderer, null, null);
    // A second denoise pass (other noise channel) removes the remaining grain
    // on flat faces next to creases.
    const pd = this.pass.pdMaterial;
    pd.uniforms.tDiffuse.value = this.pass.pdRenderTarget.texture;
    pd.uniforms.index.value = 1;
    this.pass._renderPass(renderer, pd, this.pass.gtaoRenderTarget, 0xffffff, 1);
    pd.uniforms.tDiffuse.value = this.pass.gtaoRenderTarget.texture;
    pd.uniforms.index.value = 0;
    renderer.setRenderTarget(null);
    SCREEN_SPACE_AO_UNIFORMS.tScreenSpaceAO.value = this.pass.gtaoRenderTarget.texture;
    SCREEN_SPACE_AO_UNIFORMS.screenSpaceAOSize.value.copy(this.drawingSize);
    SCREEN_SPACE_AO_UNIFORMS.screenSpaceAOIntensity.value = this.settings.intensity;
  }

  dispose() {
    SCREEN_SPACE_AO_UNIFORMS.tScreenSpaceAO.value = WHITE;
    SCREEN_SPACE_AO_UNIFORMS.screenSpaceAOIntensity.value = 0;
    this.pass.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedMaterials.length = 0;
  }
}

// Resolve the viewer's AO preference: 'on', 'off' or 'auto' (on unless the
// device looks low-end; auto also switches off if frames become slow).
export function shouldStartAmbientOcclusion(preference, renderer) {
  if (preference === false || preference === 'off') return false;
  if (preference === true || preference === 'on') return true;
  if (preference !== 'auto') return false;
  const cores = globalThis.navigator?.hardwareConcurrency;
  const memory = globalThis.navigator?.deviceMemory;
  if ((cores && cores <= 2) || (memory && memory <= 2)) return false;
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return !/swiftshader|llvmpipe|softpipe|software/i.test(name);
}
