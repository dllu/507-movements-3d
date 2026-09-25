import * as THREE from 'three';
import {createDiagonalCatchScaffold} from '../authored-diagonal-catches.js';
import {diagonalCatchProfile,diagonalLatchFinger} from './catch-profile.js';
import {plate,poly,circle,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {disposeObject3D} from '../dispose-model.js';
import {makeDiagonalCatchUpdater,DIAGONAL_CATCH_ROD_EDGE_Y} from './update-solids.js';

function lowerBacking(finger){
 const local=([x,y])=>[(x-271)*.0125-finger.fit.pivot[0],(234-y)*.0125-finger.fit.pivot[1]];
 // One continuous crescent supports the same face during trip and retention.
 // Its tip compromises between the two inconsistent engraved positions.
 const crescent=new THREE.Shape();crescent.moveTo(295,323);
 crescent.bezierCurveTo(312,319,326,315,329,288);
 crescent.bezierCurveTo(340,319,338,343,317,365);
 crescent.quadraticCurveTo(306,376,289,375);crescent.lineTo(285,351);crescent.closePath();
 return clip.union(poly(circle([0,0],.38,96)),poly(crescent.getPoints(16).map(p=>local(p.toArray()))),finger.polygons);
}

// Complete visible assembly around the qualified planar contact profiles.
// Back plates and axial webs connect the contact fingers to their bored hubs.
// Their depths are inferred; audit the serialized assembly separately from
// the isolated contact trajectory whenever this geometry changes.
export function createDiagonalCatchAssembly(){
 const legacy=createDiagonalCatchScaffold({id:181}),root=legacy.root,b=root.userData.blocks,g=root.userData.geometry;
 const catchMaterial=b.catchHub.material,handleMaterial=b.upperHandleHub.material;
 const remove=object=>{object.removeFromParent();object.traverse(o=>o.geometry?.dispose());};
 for(const name of ['catchBackbone','catchWeightArm','upperHook','lowerHook',
  'upperHandleLatchArm','lowerHandleLatchArm','upperHandleLatchRoller','lowerHandleLatchRoller'])remove(b[name]);
 const catchPlate=new THREE.Mesh(plate(diagonalCatchProfile().polygons,-g.catchDepth/2,g.catchDepth/2),catchMaterial);
 catchPlate.userData.role='continuous-source-diagonal-catch';b.catchGroup.add(catchPlate);
 for(const side of ['upper','lower']){
  const body=b[side+'Handle'],finger=diagonalLatchFinger(side),front=g.catchPlaneZ-body.position.z;
  const tip=b[side+'HandleWorkingTip'];tip.geometry.dispose();
  tip.geometry=plate(poly(circle([0,0],.10,64)),-g.handleDepth*.52,g.handleDepth*.52);
  tip.rotation.set(0,0,0);
  const patch=new THREE.Mesh(plate(finger.polygons,front-.1,front+.1),handleMaterial);
  patch.userData.role=side+'-finite-catching-finger';body.add(patch);
  // Plate 182 reveals the upper horn above the hub. In the closed position
  // its end falls behind the piston rod. The offset is inferred;
  // the already-qualified front catching face remains in the catch plane.
  const horn=side==='upper'?[[219,50],[232,57],[233,68],[267,84],[252,109],[231,122],[219,89]].map(([x,y])=>{
   const dx=(x-270)*.0125-finger.fit.pivot[0],dy=(236-y)*.0125-finger.fit.pivot[1],a=-finger.fit.angle;
   return[dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)];
  }):[];
  const backingOutline=side==='upper'
   ?clip.union(poly(circle([0,0],.38,96)),poly(horn),finger.polygons)
   :lowerBacking(finger);
  const backing=clip.difference(backingOutline,poly(circle([0,0],.12,96)));
  const backLow=side==='upper'?-.46:-.09,backHigh=side==='upper'?-.34:.09;
  const support=new THREE.Mesh(plate(backing,backLow,backHigh),handleMaterial);
  support.userData.role=side+'-continuous-finger-back-plate';body.add(support);
  if(side==='upper'){
   const sleeve=new THREE.Mesh(ring(.12,.19,backLow,.01,96),handleMaterial);
   sleeve.userData.role='upper-finger-bored-offset-sleeve';body.add(sleeve);
  }
  for(const [index,polygon]of finger.polygons.entries()){
   const points=polygon[0].slice(0,-1),center=points.reduce((s,p)=>[s[0]+p[0]/points.length,s[1]+p[1]/points.length],[0,0]);
   const web=points.map(p=>p.map((v,i)=>center[i]+(v-center[i])*.5));
   // Keep the axial web inside its (possibly non-convex) finger outline.
   const stem=new THREE.Mesh(plate(clip.intersection(poly(web),[polygon]),backHigh-.01,front-.08),handleMaterial);
   stem.userData.role=side+'-finger-axial-web-'+index;body.add(stem);
  }
 }
 // Brown's plates draw rod eyes, shaft ends and the tappet face with ink
 // notation (dark eye outlines, section hatching, broken rod ends). The model
 // shows the parts themselves: plain steel shaft heads, rods and eyes of one
 // steel, a whole piston rod that travels with its tappet, and each back-weight
 // rod hanging whole from its eye to the weight it carries below the picture.
 const steel=new THREE.MeshStandardMaterial({color:'#c3c7c1',roughness:.55,metalness:.15});
 const rodSteel=new THREE.MeshStandardMaterial({color:'#7d8581',roughness:.5,metalness:.2});
 const iron=new THREE.MeshStandardMaterial({color:'#4a5150',roughness:.7,metalness:.1});
 const eyes=[];root.traverse(o=>{if(o.isMesh&&/back-weight-eye$/.test(o.userData.role??''))eyes.push(o);});
 for(const eye of eyes)remove(eye);
 root.traverse(o=>{
  if(!o.isMesh)return;
  if(o.userData.role==='back-weight-rod-hinge-pin'){
   const p=o.geometry.parameters;o.geometry.dispose();
   o.geometry=new THREE.CylinderGeometry(.06,.06,p.height,40);o.material=steel;
  }else if(/fixed-round-head$/.test(o.userData.role??''))o.material=steel;
  else if(/-bored-rod-eye$/.test(o.userData.role??''))o.material=rodSteel;
 });
 const groups={upper:b.upperHandle,lower:b.lowerHandle,catch:b.catchGroup,piston:b.pistonGroup,
  upperWeight:b.upperWeightAssembly,lowerWeight:b.lowerWeightAssembly,catchWeight:b.catchWeightAssembly};
 for(const [name,object]of Object.entries(groups))object.name='body:'+name;
 // The shoe is fixed to the rod's front face (z=-.27): seat it there rather
 // than burying .01 of it in the rod it slides past.
 {const p=b.tappet.geometry.parameters;b.tappet.geometry.dispose();
  b.tappet.geometry=new THREE.BoxGeometry(p.width,p.height,.55);b.tappet.position.z=.005;}
 b.tappet.material=b.tappet.material.clone();b.tappet.material.color.set('#c9563d');
 // Whole piston rod with square ends, long enough that neither end enters
 // Brown's picture over the stroke (piston y -1.64..1.96).
 {const top=(234-23)*.0125+1.65+.8,bottom=(234-500)*.0125-1.96-.8;
  b.pistonRod.geometry.dispose();
  b.pistonRod.geometry=new THREE.BoxGeometry(33*.0125,top-bottom,.17);b.pistonRod.geometry.translate(0,(top+bottom)/2,0);
  b.pistonRod.position.y=0;b.pistonRod.userData.role='whole-piston-rod';delete b.pistonRod.userData.sectioned;}
 root.updateMatrixWorld(true);
 for(const name of ['upperWeight','lowerWeight','catchWeight']){
  const group=groups[name],rod=group.children.find(o=>o.isMesh&&/vertical-rod/.test(o.userData.role??''));
  const anchor={upperWeight:b.upperHandleWeightAnchor,lowerWeight:b.lowerHandleWeightAnchor,catchWeight:b.catchWeightAnchor}[name];
  const eyeY=root.worldToLocal(anchor.getWorldPosition(new THREE.Vector3())).y;
  // Fixed rod length: its lower end stays below the drawing edge in every pose.
  const length=eyeY-.14-DIAGONAL_CATCH_ROD_EDGE_Y+2.4,p=rod.geometry.parameters;
  // The weight (radius .16) clears the piston rod by about .03 at its closest.
  rod.geometry.dispose();rod.geometry=new THREE.BoxGeometry(p.width,length,p.depth);
  rod.scale.set(1,1,1);rod.position.y=-.14-length/2;rod.material=rodSteel;
  const weight=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,1,40),iron);
  weight.position.y=-.14-length-.5;weight.userData.role=name+'-cast-back-weight';group.add(weight);
 }
 const parts={},families={};
 root.traverse(o=>{if(o.isMesh){
  const name=o===b.pistonRod?'piston-rod':(o.userData.role??'part')+'#'+Object.keys(parts).length;o.name=name;parts[name]=o;
  o.castShadow=true;o.receiveShadow=true;
  let parent=o;while(parent&&!parent.name.startsWith('body:'))parent=parent.parent;
  families[name]=parent?.name.slice(5)??'fixed';
 }});
 root.userData={parts,families,blocks:groups,geometry:g,hideGround:true,materialsIgnoreSceneFog:true,
  cameraFov:8,cameraDistanceScale:1.02,supportsRestart:true,reconstructionStatus:'under-review',
  simulationBackend:'offline-projected-mujoco-candidate',mechanism:'passive-diagonal-catch',
  animationTiming:{authoredCyclePeriod:18,displayCycleDuration:18,playbackTimeScale:1}};
 const anchors={upperWeight:b.upperHandleWeightAnchor,lowerWeight:b.lowerHandleWeightAnchor,catchWeight:b.catchWeightAnchor};
 for(const [name,object]of Object.entries(anchors))object.name='anchor:'+name;
 const update=makeDiagonalCatchUpdater(root);
 update([0,0,0,g.source181PistonY]);
 return {root,parts,families,update,dispose:()=>disposeObject3D(root)};
}
