import * as THREE from 'three';
import {twinCamSource as g,twinCamContours,twinCamLevers} from './source.js';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeTwinCamGeometry(){
 const root=new THREE.Group(),cams=new THREE.Group(),parts={},levers=[],rollers=[];
 cams.position.set((g.shaft[0]-g.pivot[0])*g.scale,(g.pivot[1]-g.shaft[1])*g.scale,0);root.add(cams);
 const materials=Object.fromEntries(['driver','driven','brass','ink'].map(k=>{const m=matte(PALETTE[k],{roughness:.65,metalness:.14});m.fog=false;return [k,m];}));
 const add=(name,geometry,parent,color)=>{const mesh=new THREE.Mesh(geometry,materials[color]);mesh.name=name;parent.add(mesh);parts[name]=mesh;return mesh;};
 twinCamContours().forEach((contour,i)=>add('cam'+i,plate(clip.difference(poly(contour),poly(circle([0,0],.134,96))),-.12,.12).translate(0,0,g.planes[i]),cams,i?'brass':'driver'));
 add('cam-shaft',disk(.13,-.65,.68,96).translate(cams.position.x,cams.position.y,0),root,'ink');
 add('pivot-shaft',disk(.12,-.6,.82,96),root,'ink');
 twinCamLevers.forEach((l,i)=>{
  const lever=new THREE.Group(),roller=new THREE.Group();lever.position.z=l.z;roller.position.x=l.length;lever.add(roller);root.add(lever);levers.push(lever);rollers.push(roller);
  const shape=clip.difference(clip.union(capsule([0,0],[l.length,0],.10,48),poly(circle([0,0],.30,96)),poly(circle([l.length,0],l.radius*.7,96))),poly(circle([0,0],.124,96)),poly(circle([l.length,0],.094,96)));
  add('lever'+i,plate(shape,.24,.36),lever,'driven');
  add('roller'+i,ring(.094,l.radius,-.14,.14,96),roller,'brass');
  add('roller-axle'+i,disk(.09,-.16,.385,96).translate(l.length,0,0),lever,'ink');
  add('roller-retainer'+i,disk(.13,.37,.40,96).translate(l.length,0,0),lever,'brass');
 });
 const sync=s=>{cams.rotation.z=s.shaft;levers[0].rotation.z=s.upper;levers[1].rotation.z=s.lower;rollers[0].rotation.z=s.upperRoll;rollers[1].rotation.z=s.lowerRoll;root.updateMatrixWorld(true);};
 root.userData={parts,blocks:{cams,levers,rollers},hideGround:true,reconstructionStatus:'candidate'};
 sync({shaft:0,upper:twinCamLevers[0].angle,lower:twinCamLevers[1].angle,upperRoll:0,lowerRoll:0});markShadows(root);
 return {root,sync,dispose:()=>disposeObject3D(root)};
}
