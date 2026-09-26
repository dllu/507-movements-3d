import * as THREE from 'three';

// See-through foreground parts. Where Brown draws working details dotted or
// dashed because a foreground part covers them (the rim and tappet behind
// 70's wheel C, the studs inside 71's wheel B, 67's gear behind tumbler E),
// that foreground part is rendered semi-transparent so the working parts
// behind it show, instead of drawing Brown's hidden-line notation. Every such
// part gets the same treatment:
// - one face opacity, SEE_THROUGH_OPACITY;
// - a view-angle edge term: where the surface turns away from the viewer
//   (rims, bevels, the silhouette) the opacity rises towards
//   SEE_THROUGH_EDGE_OPACITY, so the part still reads as a solid body with
//   visible edges rather than as a flat tinted film;
// - depthWrite off and renderOrder SEE_THROUGH_RENDER_ORDER, so everything
//   behind is drawn first and shows through, while opaque parts in front
//   still occlude it through the depth test;
// - front faces only (the parts are closed solids; their back faces would
//   only double the tint);
// - no shadow casting (markShadows honours userData.seeThrough), so the part
//   does not darken the working parts it is meant to reveal.
// Apply it only to the occluding foreground part, never to construction
// lines or paths, which are not drawn at all.
export const SEE_THROUGH_OPACITY = 0.45;
export const SEE_THROUGH_EDGE_OPACITY = 0.9;
export const SEE_THROUGH_RENDER_ORDER = 2;

// Fragment patch shared with rotation-indicator.js, which re-applies it when
// it installs the quadrant cue on a see-through material.
export function patchSeeThroughShader(shader, settings) {
  if (!settings || !shader.fragmentShader.includes('vViewPosition')) return;
  const face = Number(settings.opacity).toFixed(4);
  const edge = Number(settings.edgeOpacity).toFixed(4);
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
{
  // Opacity rises where the surface turns away from the viewer.
  float seeThroughFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
  float seeThroughEdge = pow(clamp(1.0 - seeThroughFacing, 0.0, 1.0), 2.0);
  diffuseColor.a = mix(${face}, ${edge}, seeThroughEdge);
}
#include <opaque_fragment>`);
}

function install(material, settings) {
  material.transparent = true;
  material.opacity = settings.opacity;
  material.depthWrite = false;
  material.side = THREE.FrontSide;
  material.userData.seeThrough = { ...settings };
  if (!material.userData.rotationIndicator) {
    // rotation-indicator.js applies the patch itself for cued materials.
    material.onBeforeCompile = (shader) => patchSeeThroughShader(shader, settings);
    material.customProgramCacheKey = () => `see-through-${settings.opacity}-${settings.edgeOpacity}`;
    material.clone = function cloneSeeThrough() {
      return install(new this.constructor().copy(this), settings);
    };
  }
  material.needsUpdate = true;
  return material;
}

// Make one mesh, or every mesh under an object, see-through. Materials are
// cloned so shared materials elsewhere are unaffected. Returns the meshes.
export function makeSeeThrough(object, options = {}) {
  const settings = {
    opacity: options.opacity ?? SEE_THROUGH_OPACITY,
    edgeOpacity: options.edgeOpacity ?? SEE_THROUGH_EDGE_OPACITY,
  };
  const meshes = [];
  const visit = (mesh) => {
    if (!mesh.isMesh || mesh.userData.seeThrough) return;
    const materials = [mesh.material].flat().map((material) => install(material.clone(), settings));
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.userData.seeThrough = true;
    mesh.renderOrder = SEE_THROUGH_RENDER_ORDER;
    mesh.castShadow = false;
    meshes.push(mesh);
  };
  if (object.isMesh) visit(object);
  else object.traverse(visit);
  return meshes;
}

export function isSeeThrough(mesh) {
  return Boolean(mesh?.userData?.seeThrough);
}
