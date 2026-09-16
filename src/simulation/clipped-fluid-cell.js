import * as THREE from 'three';
import {makeCellWaterGeometry} from './water-wheel-solids.js';
export {makeCellWaterGeometry};
// Small convex cell clipped by a world-horizontal surface; fixed vertex buffer.
export function updateClippedCell(mesh,outline,angle,fill,maximumDepth,width){
  const c=Math.cos(angle),s=Math.sin(angle),points=outline.map(([x,y])=>new THREE.Vector2(x*c-y*s,x*s+y*c));
  const level=Math.min(...points.map(p=>p.y))+fill*maximumDepth,clipped=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(a.y<=level)clipped.push(a);if((a.y<level&&b.y>level)||(a.y>level&&b.y<level))clipped.push(new THREE.Vector2(a.x+(b.x-a.x)*(level-a.y)/(b.y-a.y),level));}
  const g=mesh.geometry,p=g.attributes.position;let count=0;
  const vertex=(v,z)=>p.setXYZ(count++,v.x,v.y,z);
  if(clipped.length>=3){
    for(let i=1;i<clipped.length-1;i++)for(const side of[-1,1]){const triangle=side>0?[clipped[0],clipped[i],clipped[i+1]]:[clipped[0],clipped[i+1],clipped[i]];for(const v of triangle)vertex(v,side*width/2);}
    for(let i=0;i<clipped.length;i++){const a=clipped[i],b=clipped[(i+1)%clipped.length];for(const[v,z]of[[a,-1],[b,-1],[b,1],[a,-1],[b,1],[a,1]])vertex(v,z*width/2);}
  }
  for(let i=count;i<p.count;i++)p.setXYZ(i,0,0,0);g.setDrawRange(0,count);p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();mesh.position.set(0,0,0);mesh.rotation.z=-angle;mesh.scale.set(1,1,1);mesh.visible=fill>.002;
}
