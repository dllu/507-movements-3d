// Retain the engraving's parallel section lines on the exposed spindle end.
// Material-only hatching rotates with the actual shaft; it adds no geometry.
export function applyBowDrillShaftHatching(material) {
  material.onBeforeCompile=shader=>{
    const varyings='varying vec3 vBowDrillPosition;\nvarying vec3 vBowDrillNormal;\n';
    shader.vertexShader=varyings+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvBowDrillPosition = position;\nvBowDrillNormal = normal;');
    shader.fragmentShader=varyings+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if (vBowDrillNormal.z > 0.99 && vBowDrillPosition.z > 0.2399) {
        float coordinate = vBowDrillPosition.x / 0.044;
        float width = max(fwidth(coordinate), 0.001);
        float stripe = 1.0 - smoothstep(0.17 - width, 0.17 + width, abs(fract(coordinate) - 0.5));
        diffuseColor.rgb = mix(vec3(0.58, 0.60, 0.58), diffuseColor.rgb, stripe);
      }
    `);
  };
  material.customProgramCacheKey=()=> '124-shaft-section-lines-v1';
}
