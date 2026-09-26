import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Subtle screen-space ambient occlusion for the interactive viewer.
//
// The scene is still drawn straight to the canvas exactly as before (same
// tone mapping, background, shadows and rotation cue). Afterwards a reduced
// resolution normal/depth prepass feeds three's GTAO and Poisson denoise
// shaders, and the result multiplies the finished frame. Background pixels
// stay 1.0, so the paper colour is untouched and only contact creases and
// inner corners darken slightly.
//
// The prepass mirrors what the main pass draws: each opaque mesh gets a
// normal material that keeps its side, flat shading and clipping planes (so
// clean cutaways stay clean) and any vertex-deforming shader hook (laid rope).
// Transparent materials (water, glass) add no depth; instead they scale the
// buffer's alpha by (1 - opacity), and the final multiply fades AO by that
// transmittance, so water-filled channels in sections are not greyed while
// parts inside thin glass keep most of their AO. The shadow-catching floor,
// lines, points and sprites are left out.
export const AMBIENT_OCCLUSION_SETTINGS = Object.freeze({
  // AO buffer size relative to the canvas drawing buffer (pixel ratio 2), so
  // 0.5 renders AO at one sample per CSS pixel.
  resolutionScale: 0.5,
  // World-space AO radius as a fraction of the fitted model radius.
  radiusFraction: 0.08,
  samples: 16,
  denoiseSamples: 16,
  denoiseRadius: 10,
  thickness: 1,
  distanceExponent: 1.5,
  // Fraction of the computed occlusion applied to the frame.
  intensity: 0.9,
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

function isSeenTransparent(material) {
  return material && material.visible !== false && material.colorWrite !== false
    && !material.isShadowMaterial && material.opacity > 0.01;
}

// Final multiply. The normal buffer's alpha holds the transmittance of the
// transparent surfaces (water, glass) in front of the opaque surface, so AO
// fades behind water instead of greying it.
const BLEND_SHADER = {
  uniforms: { tAO: { value: null }, tNormal: { value: null }, intensity: { value: 1 } },
  vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tAO;
uniform sampler2D tNormal;
uniform float intensity;
varying vec2 vUv;
void main() {
  float ao = texture2D(tAO, vUv).r;
  float transmittance = texture2D(tNormal, vUv).a;
  gl_FragColor = vec4(vec3(mix(1.0, ao, intensity * transmittance * transmittance * transmittance)), 1.0);
}`,
};

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
      thickness: this.settings.thickness,
      distanceExponent: this.settings.distanceExponent,
      distanceFallOff: 1,
      scale: 1,
      radius: 0.25,
    });
    this.pass.updatePdMaterial({
      samples: this.settings.denoiseSamples, rings: 2, radius: this.settings.denoiseRadius,
      lumaPhi: 10, depthPhi: 2, normalPhi: 3,
    });
    this.blendMaterial = new THREE.ShaderMaterial({
      ...BLEND_SHADER,
      uniforms: THREE.UniformsUtils.clone(BLEND_SHADER.uniforms),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.quad = new FullScreenQuad(this.blendMaterial);
    this.normalMaterials = new WeakMap();
    this.maskMaterials = new WeakMap();
    this.ownedMaterials = [];
    this.swapped = [];
    this.hidden = [];
    this.clearColor = new THREE.Color();
    this.drawingSize = new THREE.Vector2();
  }

  setModelRadius(radius) {
    const aoRadius = Math.max(0.02, radius * this.settings.radiusFraction);
    this.pass.updateGtaoMaterial({ radius: aoRadius });
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

  // Transparent surfaces leave colour, normal and depth alone and only scale
  // the buffer's alpha by (1 - opacity).
  transmittanceMaterialFor(material) {
    let mask = this.maskMaterials.get(material);
    if (!mask) {
      mask = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.ZeroFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      });
      this.maskMaterials.set(material, mask);
      this.ownedMaterials.push(mask);
    }
    mask.opacity = material.opacity;
    mask.side = material.side;
    mask.depthTest = material.depthTest;
    mask.clippingPlanes = material.clippingPlanes;
    mask.clipIntersection = material.clipIntersection;
    return mask;
  }

  normalMaterialFor(material) {
    if (!isRenderedOpaque(material)) {
      return isSeenTransparent(material) ? this.transmittanceMaterialFor(material) : HIDDEN;
    }
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

  // Call after the frame has been rendered to the canvas.
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
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    this.blendMaterial.uniforms.intensity.value = this.settings.intensity;
    this.blendMaterial.uniforms.tAO.value = this.pass.gtaoRenderTarget.texture;
    this.blendMaterial.uniforms.tNormal.value = this.pass.normalRenderTarget.texture;
    this.quad.render(renderer);
    renderer.autoClear = autoClear;
  }

  dispose() {
    this.pass.dispose();
    this.quad.dispose();
    this.blendMaterial.dispose();
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
