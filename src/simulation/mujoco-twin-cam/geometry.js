import * as THREE from 'three';
import {twinCamSource as g,twinCamContours,twinCamLevers} from './source.js';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {rigidFamilyInertia} from '../mujoco/mass.js';
export function makeTwinCamGeometry({guided=true}={}){
 const root=new THREE.Group(),cams=new THREE.Group(),parts={},levers=[],rollers=[],rods=[],sliders=[],families={};
 cams.position.set((g.shaft[0]-g.pivot[0])*g.scale,(g.pivot[1]-g.shaft[1])*g.scale,0);root.add(cams);
 const materials=Object.fromEntries(['driver','driven','brass','ink'].map(k=>{const m=matte(PALETTE[k],{roughness:.65,metalness:.14});m.fog=false;return [k,m];}));
 const add=(name,geometry,parent,color)=>{const mesh=new THREE.Mesh(geometry,materials[color]);mesh.name=name;parent.add(mesh);parts[name]=mesh;return mesh;};
 twinCamContours().forEach((contour,i)=>add('cam'+i,plate(clip.difference(poly(contour),poly(circle([0,0],.134,96))),-.12,.12).translate(0,0,g.planes[i]),cams,i?'brass':'driver'));
 add('cam-shaft',disk(.13,-.98,.68,96),cams,'ink');
 add('cam-retainer',disk(.20,.68,.72,96),cams,'ink');
 for(const name of ['cam0','cam1','cam-shaft','cam-retainer'])families[name]='cams';
 add('pivot-shaft',disk(.12,-.98,.80,96),root,'ink');
 add('pivot-retainer',disk(.20,.80,.84,96),root,'ink');
 const shaftPoint=[cams.position.x,cams.position.y];
 const rear=clip.difference(clip.union(capsule([0,0],shaftPoint,.17,48),poly(circle([0,0],.35,96)),poly(circle(shaftPoint,.35,96))),poly(circle([0,0],.124,96)),poly(circle(shaftPoint,.134,96)));
 add('rear-bearing-frame',plate(rear,-.95,-.70),root,'ink');
 twinCamLevers.forEach((l,i)=>{
  const lever=new THREE.Group(),roller=new THREE.Group();lever.position.z=l.z;roller.position.x=l.length;lever.add(roller);root.add(lever);levers.push(lever);rollers.push(roller);
  const shape=clip.difference(clip.union(poly([[0,-.13],[l.attachment,-.14],[l.length,-.07],[l.length,.07],[l.attachment,.14],[0,.13]]),poly(circle([0,0],.30,96)),poly(circle([l.attachment,0],.23,96)),poly(circle([l.length,0],l.radius*.7,96))),poly(circle([0,0],.124,96)),poly(circle([l.length,0],.094,96)),poly(circle([l.attachment,0],.074,96)));
  add('lever'+i,plate(shape,.24,.36),lever,'driven');
  add('roller'+i,ring(.094,l.radius,-.14,.14,96),roller,'brass');
  add('roller-axle'+i,disk(.09,-.16,.37,96).translate(l.length,0,0),lever,'ink');
  add('roller-retainer'+i,disk(.13,.37,.40,96).translate(l.length,0,0),lever,'brass');
  const rod=new THREE.Group();rod.position.set(l.attachment,0,l.rodZ);lever.add(rod);rods.push(rod);
  let rodShape=clip.difference(clip.union(poly(circle([0,0],.17,96)),poly([[-.09,0],[.09,0],[.09,-.36],[.036,-.36],[.036,-l.rodLength],[-.036,-l.rodLength],[-.036,-.36],[-.09,-.36]])),poly(circle([0,0],.074,96)));
  if(guided)rodShape=clip.difference(clip.union(rodShape,poly(circle([0,-l.rodPinDistance],.13,96))),poly(circle([0,-l.rodPinDistance],.074,96)));
  add('rod'+i,plate(rodShape,0,.10),rod,'brass');
  add('rod-pin'+i,disk(.07,.23,.55,96).translate(l.attachment,0,0),lever,'ink');
  add('rod-retainer'+i,disk(.10,.55,.58,96).translate(l.attachment,0,0),lever,'ink');
  for(const name of ['lever','roller-axle','roller-retainer','rod-pin','rod-retainer'])families[name+i]='lever'+i;
  families['roller'+i]='roller'+i;families['rod'+i]='rod'+i;
  if(guided){
   const slider=new THREE.Group();slider.position.set(l.guideX,l.guideY,l.z+l.rodZ);root.add(slider);sliders.push(slider);
   const block=clip.difference(poly([[-.16,-.15],[.16,-.15],[.16,.15],[-.16,.15]]),poly(circle([0,0],.074,96)));
   add('slider'+i,plate(block,-.20,-.03),slider,'driven');
   add('slider-pin'+i,disk(.07,-.20,.13,96),slider,'ink');
   add('slider-retainer'+i,disk(.10,.13,.16,96),slider,'ink');
   for(const name of ['slider','slider-pin','slider-retainer'])families[name+i]='slider'+i;
   // These rear channels are inferred output guides, absent from the engraving.
   const low=i?-.25:-1.05,high=i?.85:.25;
   for(const side of [-1,1]){
    const x=side*.205,shape=poly([[x-.025,low],[x+.025,low],[x+.025,high],[x-.025,high]]);
    add('guide'+i+'-'+side,plate(shape,-.23,-.01).translate(l.guideX,l.guideY,l.z+l.rodZ),root,'ink');
   }
   add('guide-back'+i,plate(poly([[-.23,low],[.23,low],[.23,high],[-.23,high]]),-.29,-.23).translate(l.guideX,l.guideY,l.z+l.rodZ),root,'ink');
  }
 });
 const mass=Object.fromEntries([...new Set(Object.values(families))].map(name=>[name,rigidFamilyInertia(parts,families,name)]));
 const sync=s=>{cams.rotation.z=s.shaft;levers[0].rotation.z=s.upper;levers[1].rotation.z=s.lower;rollers[0].rotation.z=s.upperRoll;rollers[1].rotation.z=s.lowerRoll;rods[0].rotation.z=s.upperRod??-s.upper;rods[1].rotation.z=s.lowerRod??-s.lower;if(guided){sliders[0].position.y=twinCamLevers[0].guideY+(s.upperSlide??0);sliders[1].position.y=twinCamLevers[1].guideY+(s.lowerSlide??0);}root.updateMatrixWorld(true);};
 root.userData={parts,families,mass,blocks:{cams,levers,rollers,rods,sliders},hideGround:true,reconstructionStatus:'candidate'};
 sync({shaft:0,upper:twinCamLevers[0].angle,lower:twinCamLevers[1].angle,upperRoll:0,lowerRoll:0});markShadows(root);
 // The broad cam extends farther right halfway through a turn than in the
 // engraving pose. Include its entire sweep in the preview camera fit.
 const camRadius=Math.max(...twinCamContours().flat().map(p=>Math.hypot(...p)));
 root.userData.cameraFitBounds=new THREE.Box3().setFromObject(root).union(new THREE.Box3(
  new THREE.Vector3(cams.position.x-camRadius,cams.position.y-camRadius,-.98),
  new THREE.Vector3(cams.position.x+camRadius,cams.position.y+camRadius,.84)));
 return {root,sync,dispose:()=>disposeObject3D(root)};
}
