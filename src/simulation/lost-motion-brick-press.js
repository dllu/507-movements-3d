import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {lostMotionBrickGeometry,lostMotionBrickState,lostMotionBrickAtAngle} from './lost-motion-brick-press-motion.js';

export function makeLostMotionBrickPress(){
 const g=lostMotionBrickGeometry(),root=new THREE.Group(),parts={},families={},blocks={},materials=new Map();
 const group=name=>{const b=new THREE.Group();b.name='body:'+name;root.add(b);blocks[name]=b;return b;};
 group('fixed');group('input');group('rod');group('slide');group('bed');
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
 // break is drawing notation. The whole rod runs on to its eye on the pin of
 // the brick mould it draws to and fro (the kinematic output point), which
 // slides on a guided bed beyond the plate's view.
 const drawnEnd=280*g.scale-lostMotionBrickState(0,g).x;
 const outline=clip.union(capsule(outer,inner,.50,96),poly([[inner[0],-.15],[0,-.15],[0,.15],[inner[0],.15]]),poly(circle([0,0],.34,96)));
 const rod=clip.difference(outline,capsule(outer,inner,holeRadius,128),poly(circle([0,0],.164,96)));
 add('slottedRod',plate(rod,.40,.62),'rod',PALETTE.driven);
 // The mould: an open brick box on its sliding base, pinned to the rod eye.
 const mouldLength=1.5,mouldHalfHeight=.42,mouldBack=-.36,mouldFront=.36;
 add('mouldPin',disk(.16,.30,.70,96),'slide',PALETTE.ink);
 add('mouldPinHead',disk(.24,.66,.72,96),'slide',PALETTE.ink);
 const mouldBox=clip.difference(poly([[.2,-mouldHalfHeight],[.2+mouldLength,-mouldHalfHeight],[.2+mouldLength,mouldHalfHeight],[.2,mouldHalfHeight]]),
  poly([[.32,-mouldHalfHeight+.12],[.08+mouldLength,-mouldHalfHeight+.12],[.08+mouldLength,mouldHalfHeight+.01],[.32,mouldHalfHeight+.01]]));
 add('brickMould',plate(mouldBox,mouldBack,mouldFront),'slide',PALETTE.brass);
 add('mouldEar',plate(poly([[-.26,-.2],[.21,-.2],[.21,.2],[-.26,.2]]),.10,.30),'slide',PALETTE.brass);
 const low=lostMotionBrickAtAngle(g.phase+Math.PI,g).left,high=lostMotionBrickAtAngle(g.phase,g).right;
 const bedLeft=g.center[0]+low-.2,bedRight=g.center[0]+high+mouldLength+.6,bedTop=g.center[1]-mouldHalfHeight-.003;
 add('mouldBed',plate(poly([[bedLeft,bedTop-.16],[bedRight,bedTop-.16],[bedRight,bedTop],[bedLeft,bedTop]]),-.62,.52),'bed',PALETTE.frame);
 for(const [name,z0,z1]of [['mouldGuideBack',-.62,mouldBack-.004],['mouldGuideFront',mouldFront+.004,.52]])
  add(name,plate(poly([[bedLeft,bedTop],[bedRight,bedTop],[bedRight,bedTop+.28],[bedLeft,bedTop+.28]]),z0,z1),'bed',PALETTE.frame);
 // The default view frames Brown's drawn rod only.
 const drawnRodProxy=new THREE.Mesh(plate(poly([[inner[0],-.15],[drawnEnd,-.15],[drawnEnd,.15],[inner[0],.15]]),.40,.62));
 // Brown's dashed crank-pin circle is construction notation; it is not drawn.
 const update=time=>{const s=lostMotionBrickState(time,g);blocks.input.position.set(...g.center,0);blocks.input.rotation.z=s.angle;blocks.rod.position.set(g.center[0]+s.x,g.center[1],0);blocks.rod.rotation.z=s.rodAngle;blocks.slide.position.set(g.center[0]+s.x,g.center[1],0);root.updateMatrixWorld(true);root.userData.state=s;};
 update(0);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.period*i/128);for(const name of ['fixed','input'])bounds.union(new THREE.Box3().setFromObject(blocks[name],true));drawnRodProxy.position.copy(blocks.rod.position);drawnRodProxy.rotation.copy(blocks.rod.rotation);drawnRodProxy.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(drawnRodProxy,true));}drawnRodProxy.geometry.dispose();bounds.expandByScalar(.04);update(0);markShadows(root);
 Object.assign(root.userData,{parts,families,blocks,geometry:g,mechanism:'slotted-pitman-double-dwell',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,cameraFov:8,animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1},reconstructionNote:'The loose crank pin crosses the slot while the output rests at each end. A resisting load is assumed to hold the slide during the dwells. The rod runs whole past the plate break to the pinned brick mould sliding between guides on its bed; the mould, bed, depths and bearings are inferred.'});
 return{root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.01,.01,15),dispose:()=>disposeObject3D(root)};
}
