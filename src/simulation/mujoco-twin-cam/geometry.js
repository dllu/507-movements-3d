import * as THREE from 'three';
import {twinCamSource as g,twinCamContours,twinCamLevers} from './source.js';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {rigidFamilyInertia} from '../mujoco/mass.js';
export function makeTwinCamGeometry(){
 const root=new THREE.Group(),cams=new THREE.Group(),parts={},levers=[],rollers=[],rods=[],families={};
 cams.position.set((g.shaft[0]-g.pivot[0])*g.scale,(g.pivot[1]-g.shaft[1])*g.scale,0);root.add(cams);
 const materials=Object.fromEntries(['driver','driven','brass','ink'].map(k=>{const m=matte(PALETTE[k],{roughness:.65,metalness:.14});m.fog=false;return [k,m];}));
 const add=(name,geometry,parent,color)=>{const mesh=new THREE.Mesh(geometry,materials[color]);mesh.name=name;parent.add(mesh);parts[name]=mesh;return mesh;};
 twinCamContours().forEach((contour,i)=>add('cam'+i,plate(clip.difference(poly(contour),poly(circle([0,0],.134,96))),-.12,.12).translate(0,0,g.planes[i]),cams,i?'brass':'driver'));
 add('cam-shaft',disk(.13,-.65,.68,96).translate(cams.position.x,cams.position.y,0),root,'ink');
 add('pivot-shaft',disk(.12,-.6,.82,96),root,'ink');
 twinCamLevers.forEach((l,i)=>{
  const lever=new THREE.Group(),roller=new THREE.Group();lever.position.z=l.z;roller.position.x=l.length;lever.add(roller);root.add(lever);levers.push(lever);rollers.push(roller);
  const shape=clip.difference(clip.union(poly([[0,-.13],[l.attachment,-.14],[l.length,-.07],[l.length,.07],[l.attachment,.14],[0,.13]]),poly(circle([0,0],.30,96)),poly(circle([l.attachment,0],.23,96)),poly(circle([l.length,0],l.radius*.7,96))),poly(circle([0,0],.124,96)),poly(circle([l.length,0],.094,96)),poly(circle([l.attachment,0],.074,96)));
  add('lever'+i,plate(shape,.24,.36),lever,'driven');
  add('roller'+i,ring(.094,l.radius,-.14,.14,96),roller,'brass');
  add('roller-axle'+i,disk(.09,-.16,.37,96).translate(l.length,0,0),lever,'ink');
  add('roller-retainer'+i,disk(.13,.37,.40,96).translate(l.length,0,0),lever,'brass');
  const rod=new THREE.Group();rod.position.set(l.attachment,0,l.rodZ);lever.add(rod);rods.push(rod);
  const rodShape=clip.difference(clip.union(poly(circle([0,0],.17,96)),poly([[-.09,0],[.09,0],[.09,-.36],[.036,-.36],[.036,-l.rodLength],[-.036,-l.rodLength],[-.036,-.36],[-.09,-.36]])),poly(circle([0,0],.074,96)));
  add('rod'+i,plate(rodShape,0,.10),rod,'brass');
  add('rod-pin'+i,disk(.07,.23,.55,96).translate(l.attachment,0,0),lever,'ink');
  add('rod-retainer'+i,disk(.10,.55,.58,96).translate(l.attachment,0,0),lever,'ink');
  for(const name of ['lever','roller-axle','roller-retainer','rod-pin','rod-retainer'])families[name+i]='lever'+i;
  families['roller'+i]='roller'+i;families['rod'+i]='rod'+i;
 });
 const mass=Object.fromEntries(['lever0','lever1','roller0','roller1','rod0','rod1'].map(name=>[name,rigidFamilyInertia(parts,families,name)]));
 const sync=s=>{cams.rotation.z=s.shaft;levers[0].rotation.z=s.upper;levers[1].rotation.z=s.lower;rollers[0].rotation.z=s.upperRoll;rollers[1].rotation.z=s.lowerRoll;rods[0].rotation.z=s.upperRod??-s.upper;rods[1].rotation.z=s.lowerRod??-s.lower;root.updateMatrixWorld(true);};
 root.userData={parts,families,mass,blocks:{cams,levers,rollers,rods},hideGround:true,reconstructionStatus:'candidate'};
 sync({shaft:0,upper:twinCamLevers[0].angle,lower:twinCamLevers[1].angle,upperRoll:0,lowerRoll:0});markShadows(root);
 return {root,sync,dispose:()=>disposeObject3D(root)};
}
