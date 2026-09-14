import * as THREE from 'three';
import {bowDrillTube} from '../mujoco-bow-drill/geometry.js';

// Material coordinates stay attached to the native cord sections as they move.
// Circumferential sine/cosine avoid a UV seam on the closed tube rings.
export function bellCrankCordGeometry(points,radius,lengths){
 const sides=24,g=bowDrillTube(points,points.map(()=>radius),{sides}),coordinates=new Float32Array(g.attributes.position.count*4);
 let distance=0;
 for(let i=0;i<points.length;i++){
  if(i)distance+=lengths[i-1];
  for(let j=0;j<sides;j++){const angle=j*2*Math.PI/sides;coordinates.set([distance,Math.cos(angle),Math.sin(angle),1],4*(i*sides+j));}
 }
 // Cap coordinates remain zero: the end grain is not a helical surface.
 g.setAttribute('cordCoordinate',new THREE.BufferAttribute(coordinates,4));return g;
}

export function applyBellCrankCordFinish(material){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec4 cordCoordinate;\nvarying vec4 vCordCoordinate;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCordCoordinate = cordCoordinate;');
  shader.fragmentShader='varying vec4 vCordCoordinate;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   if (vCordCoordinate.w > 0.5) {
    vec2 direction = normalize(vCordCoordinate.yz);
    float tripleCos = direction.x * (4.0 * direction.x * direction.x - 3.0);
    float tripleSin = direction.y * (3.0 - 4.0 * direction.y * direction.y);
    float along = vCordCoordinate.x * 6.28318530718 / 0.16;
    float ridge = 0.5 + 0.5 * (tripleCos * cos(along) + tripleSin * sin(along));
    float width = max(fwidth(ridge), 0.001);
    float strand = smoothstep(0.15 - width, 0.6 + width, ridge);
    diffuseColor.rgb *= mix(0.66, 1.0, strand);
   }
  `);
 };
 material.customProgramCacheKey=()=> '126-cord-strands-v1';
}

export function applyBellCrankShaftFinish(material){
 material.onBeforeCompile=shader=>{
  const varyings='varying vec3 vShaftPosition;\nvarying vec3 vShaftNormal;\n';
  shader.vertexShader=varyings+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvShaftPosition = position;\nvShaftNormal = normal;');
  shader.fragmentShader=varyings+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   if (vShaftNormal.z > 0.99 && vShaftPosition.z > 0.1899) {
    float coordinate = (vShaftPosition.x - vShaftPosition.y) * 0.70710678 / 0.044;
    float width = max(fwidth(coordinate), 0.001);
    float stripe = 1.0 - smoothstep(0.17 - width, 0.17 + width, abs(fract(coordinate) - 0.5));
    diffuseColor.rgb = mix(vec3(0.58, 0.60, 0.58), diffuseColor.rgb, stripe);
   }
  `);
 };
 material.customProgramCacheKey=()=> '126-fixed-shaft-section-v1';
}
