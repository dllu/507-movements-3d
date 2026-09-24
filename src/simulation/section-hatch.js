import * as THREE from 'three';
import {plate,poly,circle,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte} from './primitives.js';

// Brown sections a shaft end facing the viewer with parallel 45-degree lines.
// Returns a thin paper face with ink stripes on the plane z = 0, facing +Z
// (flip the group to face -Z). Both meshes are presentation-only: they add
// no working surface and should not be registered as mass-bearing parts.
export function hatchedSectionFace(radius,{name='shaft-section',stripes=6,width=.023*radius/.56}={}) {
  const group=new THREE.Group(),d=Math.SQRT1_2,point=(t,n)=>[t*d-n*d,t*d+n*d];
  group.name=name;
  const bands=[];
  for(let i=-stripes;i<=stripes;i++){const c=i*radius/(stripes+.5),w=width/2;bands.push(poly([point(-2*radius,c-w),point(2*radius,c-w),point(2*radius,c+w),point(-2*radius,c+w)]));}
  const lines=clip.intersection(clip.union(...bands),poly(circle([0,0],radius*.97,96)));
  const materials=[PALETTE.paper,PALETTE.ink].map(color=>{const m=matte(color,{roughness:.65,metalness:.05});m.fog=false;return m;});
  const face=new THREE.Mesh(disk(radius*.995,0,.004,96),materials[0]);face.name=name+'-face';
  const ink=new THREE.Mesh(plate(lines,.004,.007),materials[1]);ink.name=name+'-lines';
  for(const mesh of [face,ink]){mesh.userData.presentationOnly=true;mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);}
  return group;
}
