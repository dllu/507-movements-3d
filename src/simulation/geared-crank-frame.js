import * as THREE from 'three';
import {plate,poly,circle,capsule,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {gearedCrankSource as g,gearedCrankState,sourcePoint,groovePoint} from './geared-crank-source.js';
import {matte,PALETTE} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

// Brown's oblong is a grooved band on the large gear's face: one solid band
// swept round the groove's centre line, its U section two walls joined by a
// floor, with the working channel cut into its front. It is seated on (and
// sunk slightly into) the front of the spoked gear plate, clear of the
// pinion. The long lever's pin runs in the channel.
export const gearedCrankGroove={pinRadius:4.5*g.scale,channelHalfWidth:4.7*g.scale,bandHalfWidth:9.5*g.scale,low:-.14,floor:-.07,high:.09};
// U-section band swept along the groove centre line: section points are
// (offset along the outward normal, z), anticlockwise; each section edge is a
// flat strip with its own normals, smooth along the curve.
function grooveBand(G,count=768){
 const section=[[-G.bandHalfWidth,G.low],[G.bandHalfWidth,G.low],[G.bandHalfWidth,G.high],[G.channelHalfWidth,G.high],[G.channelHalfWidth,G.floor],
  [-G.channelHalfWidth,G.floor],[-G.channelHalfWidth,G.high],[-G.bandHalfWidth,G.high]];
 const frames=Array.from({length:count},(_,i)=>{const a=2*Math.PI*i/count,h=1e-5,p=groovePoint(a),t=groovePoint(a+h).sub(groovePoint(a-h)).normalize();return {p,n:[t.y,-t.x]};});
 const position=[],normal=[],index=[];
 for(let e=0;e<section.length;e++){
  const [d0,z0]=section[e],[d1,z1]=section[(e+1)%section.length],len=Math.hypot(d1-d0,z1-z0);
  // Outward section normal of an anticlockwise loop: (dz,-dd)/len.
  const sn=[(z1-z0)/len,-(d1-d0)/len],base=position.length/3;
  for(const {p,n} of frames)for(const [d,z] of [[d0,z0],[d1,z1]]){
   position.push(p.x+d*n[0],p.y+d*n[1],z);normal.push(sn[0]*n[0],sn[0]*n[1],sn[1]);
  }
  for(let i=0;i<count;i++){
   const j=(i+1)%count,a=base+2*i,b=base+2*i+1,c=base+2*j,d=base+2*j+1;
   index.push(a,c,b,b,c,d);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
 geometry.setIndex(index);
 // Orient every strip so its winding agrees with its normals.
 const P=geometry.attributes.position,N=geometry.attributes.normal,idx=geometry.index.array,v=[0,1,2].map(()=>new THREE.Vector3());
 for(let k=0;k<idx.length;k+=3){
  [0,1,2].forEach(m=>v[m].fromBufferAttribute(P,idx[k+m]));
  const f=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])),nn=new THREE.Vector3().fromBufferAttribute(N,idx[k]);
  if(f.dot(nn)<0){const t=idx[k+1];idx[k+1]=idx[k+2];idx[k+2]=t;}
 }
 geometry.computeBoundingSphere();return geometry;
}
export function makeGearedCrankFrame(){
 const root=new THREE.Group(),lever=new THREE.Group(),drive=new THREE.Group(),fixed=new THREE.Group(),parts={},families={};root.add(lever,drive,fixed);
 lever.name='lever';drive.name='drive';fixed.name='fixed';
 const material=matte(PALETTE.driver,{roughness:.65,metalness:.14});material.fog=false;
 const add=(name,geometry,body)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;body.add(mesh);parts[name]=mesh;families[name]=body.name;return mesh;};
 const G=gearedCrankGroove;
 add('oblong-groove-band',grooveBand(G),drive);
 const p=sourcePoint(g.pivot).toArray(),pin=sourcePoint(g.pin).toArray(),eye=sourcePoint(g.eye).toArray();
 // One rigid bent lever: long arm to the groove pin, short arm to the eye.
 const outline=clip.union(capsule(p,pin,.13,48),capsule(pin,eye,.10,48),poly(circle(p,.32,64)),poly(circle(pin,.2,64)),poly(circle(eye,.32,64)));
 const shape=clip.difference(outline,poly(circle(p,.163,64)),poly(circle(eye,.14,64)));
 lever.position.set(...p,0);
 add('rocking-lever',plate(shape,.12,.22).translate(-p[0],-p[1],0),lever);
 add('groove-pin',disk(G.pinRadius,-.055,.22,64).translate(pin[0]-p[0],pin[1]-p[1],0),lever);
 add('groove-pin-head',disk(.17,.22,.27,64).translate(pin[0]-p[0],pin[1]-p[1],0),lever);
 add('rear-supported-gear-shaft',disk(.18,-.8,.18,64),fixed);
 add('rocker-pivot',disk(.16,.18,.60,64).translate(...p,0),fixed);
 add('rocker-pivot-retainer',disk(.21,.56,.60,64).translate(...p,0),fixed);
 const source=gearedCrankState(0);
 const update=time=>{const s=gearedCrankState(time);drive.rotation.z=s.rotation;lever.rotation.z=s.leverAngle;root.updateMatrixWorld(true);return s;};
 root.userData={parts,families,blocks:{lever,drive,fixed},reconstructionStatus:'candidate',hideGround:true,groove:G,initialState:source};update(0);
 return {root,update,dispose:()=>disposeObject3D(root)};
}
