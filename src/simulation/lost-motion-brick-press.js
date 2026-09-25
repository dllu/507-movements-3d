import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {lostMotionBrickGeometry,lostMotionBrickState} from './lost-motion-brick-press-motion.js';

export function makeLostMotionBrickPress(){
 const g=lostMotionBrickGeometry(),root=new THREE.Group(),parts={},families={},blocks={},materials=new Map();
 const group=name=>{const b=new THREE.Group();b.name='body:'+name;root.add(b);blocks[name]=b;return b;};
 group('fixed');group('input');group('rod');group('slide');
 const add=(name,geometry,family,color,position=[0,0,0])=>{
  if(!materials.has(color)){const m=matte(color);m.fog=false;materials.set(color,m);}
  const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;mesh.position.set(...position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
 };
 add('disk',ring(.334,g.diskRadius,-.32,0,192),'input',PALETTE.driver);
 add('outerRim',ring(189*g.scale,g.diskRadius,0,.025,192),'input',PALETTE.brass);
 add('hub',ring(.334,.675,.025,.25,128),'input',PALETTE.driver);
 add('crankPin',disk(g.pinRadius,0,.68,128),'input',PALETTE.ink,[g.crankRadius,0,0]);
 add('crankPinHead',disk(.325,.66,.72,128),'input',PALETTE.ink,[g.crankRadius,0,0]);
 add('fixedShaft',disk(.33,-.65,.30,128),'fixed',PALETTE.ink,[...g.center,0]);
 const outer=[-g.outer+g.clearance,0],inner=[-g.inner-g.clearance,0],holeRadius=(g.pinRadius+g.clearance)/Math.cos(Math.PI/256);
 // Brown breaks the rod off 280 raster pixels right of the disk centre; the
 // mold it drives (the kinematic output point) lies beyond the drawing, so no
 // slide or guide is modelled.
 const drawnEnd=280*g.scale-lostMotionBrickState(0,g).x;
 const outline=clip.union(capsule(outer,inner,.50,96),poly([[inner[0],-.15],[drawnEnd-.03,-.15],[drawnEnd+.04,-.05],[drawnEnd,.04],[drawnEnd+.05,.15],[inner[0],.15]]));
 const rod=clip.difference(outline,capsule(outer,inner,holeRadius,128));
 add('slottedRod',plate(rod,.40,.62),'rod',PALETTE.driven);
 // Brown's dashed crank-pin circle is construction notation; it is not drawn.
 const update=time=>{const s=lostMotionBrickState(time,g);blocks.input.position.set(...g.center,0);blocks.input.rotation.z=s.angle;blocks.rod.position.set(g.center[0]+s.x,g.center[1],0);blocks.rod.rotation.z=s.rodAngle;blocks.slide.position.set(g.center[0]+s.x,g.center[1],0);root.updateMatrixWorld(true);root.userData.state=s;};
 update(0);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.period*i/128);bounds.union(new THREE.Box3().setFromObject(root,true));}bounds.expandByScalar(.04);update(0);markShadows(root);
 Object.assign(root.userData,{parts,families,blocks,geometry:g,mechanism:'slotted-pitman-double-dwell',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,cameraFov:8,animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1},reconstructionNote:'The loose crank pin crosses the slot while the output rests at each end. A resisting load is assumed to hold the slide during the dwells. The rod is broken off as on the plate; its guided output end, depths and bearings are inferred.'});
 return{root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.01,.01,15),dispose:()=>disposeObject3D(root)};
}
