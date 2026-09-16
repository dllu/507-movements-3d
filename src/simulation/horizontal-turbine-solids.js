import * as THREE from 'three';
import {plate,poly,ring,turned} from './finite-plate-geometry.js';

export function horizontalRing(inner,outer,low,high,segments=256){
  const geometry=ring(inner,outer,low,high,segments);geometry.rotateX(-Math.PI/2);return geometry;
}
export function horizontalTurned(profile){const geometry=turned(profile,256);geometry.rotateX(-Math.PI/2);return geometry;}
export function horizontalPlate(polygons,low,high){const geometry=plate(polygons,low,high);geometry.rotateX(-Math.PI/2);return geometry;}

// The original plan view gives a curved wall, not a round pipe. Offset its
// centerline analytically, then extrude the closed section to working height.
export function horizontalVane(points,halfWidth,low,high){
  const planar=points.map(p=>new THREE.Vector2(p.x,-p.z));
  const sides=[[],[]];
  for(let i=0;i<planar.length;i++){
    const direction=planar[Math.min(i+1,planar.length-1)].clone().sub(planar[Math.max(0,i-1)]).normalize();
    const normal=new THREE.Vector2(-direction.y,direction.x).multiplyScalar(halfWidth);
    sides[0].push(planar[i].clone().add(normal).toArray());sides[1].push(planar[i].clone().sub(normal).toArray());
  }
  return horizontalPlate(poly([...sides[0],...sides[1].reverse()]),low,high);
}
