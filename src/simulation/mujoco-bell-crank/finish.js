import * as THREE from 'three';
import {LaidRopeGeometry,replaceWithLaidRope} from '../laid-rope.js';

// Brown hatches both cords as laid rope: the shared three-strand rope on a
// smooth curve through the native cord sections. Each path starts at a cord
// end, so arc length is the material coordinate and the lay stays with the
// sections as they move.
const cordCurve=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
export function bellCrankCordGeometry(points,radius){return new LaidRopeGeometry(cordCurve(points),points.length*4,radius,8,false);}
export function updateBellCrankCord(mesh,points,radius){return replaceWithLaidRope(mesh,cordCurve(points),{radius,tubularSegments:points.length*4});}

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
