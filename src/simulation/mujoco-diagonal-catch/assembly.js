import * as THREE from 'three';
import {createAuthoredDiagonalCatchMovement} from '../authored-diagonal-catches.js';
import {diagonalCatchProfile,diagonalLatchFinger} from './catch-profile.js';
import {plate,poly,circle,ring,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {disposeObject3D} from '../dispose-model.js';
import {makeDiagonalCatchUpdater} from './update-solids.js';

function lowerBacking(finger){
 const local=([x,y])=>[(x-271)*.0125-finger.fit.pivot[0],(234-y)*.0125-finger.fit.pivot[1]];
 // Concave inner edge and convex outer rim traced from the crescent in 181.
 // The registered holding heel lies beyond that tracing. A narrow rear bridge
 // connects it to the crescent without filling the source's open inner curve.
 const crescent=new THREE.Shape();crescent.moveTo(295,323);
 crescent.bezierCurveTo(312,319,326,315,329,288);
 crescent.bezierCurveTo(340,319,338,343,317,365);
 crescent.quadraticCurveTo(306,376,289,375);crescent.lineTo(285,351);crescent.closePath();
 const heel=finger.heelRaster.map(local),heldCenter=heel.reduce((s,p)=>[s[0]+p[0]/heel.length,s[1]+p[1]/heel.length],[0,0]);
 const a=-finger.fit.angle,center=[heldCenter[0]*Math.cos(a)-heldCenter[1]*Math.sin(a),heldCenter[0]*Math.sin(a)+heldCenter[1]*Math.cos(a)];
 const bridge=new THREE.QuadraticBezierCurve(new THREE.Vector2(...center),new THREE.Vector2(...local([321,273])),new THREE.Vector2(...local([328,301]))).getPoints(24).map(p=>p.toArray());
 return clip.union(poly(circle([0,0],.38,96)),poly(crescent.getPoints(16).map(p=>local(p.toArray()))),finger.polygons,
  ...bridge.slice(1).map((p,i)=>capsule(bridge[i],p,.06,12)));
}

// Complete visible assembly around the qualified planar contact profiles.
// Back plates and axial webs connect the contact fingers to their bored hubs.
// Their depths are inferred; audit the serialized assembly separately from
// the isolated contact trajectory whenever this geometry changes.
export function createDiagonalCatchAssembly(){
 const legacy=createAuthoredDiagonalCatchMovement({id:181}),root=legacy.root,b=root.userData.blocks,g=root.userData.geometry;
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
  // its end falls behind the sectioned piston rod. The offset is inferred;
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
   const stem=new THREE.Mesh(plate(poly(web),backHigh-.01,front-.08),handleMaterial);
   stem.userData.role=side+'-finger-axial-web-'+index;body.add(stem);
  }
 }
 const groups={upper:b.upperHandle,lower:b.lowerHandle,catch:b.catchGroup,piston:b.pistonGroup,
  upperWeight:b.upperWeightAssembly,lowerWeight:b.lowerWeightAssembly,catchWeight:b.catchWeightAssembly};
 for(const [name,object]of Object.entries(groups))object.name='body:'+name;
 // The engraving hatches the projecting tappet's end face. Surface marks make
 // its translation legible head-on without adding a floating contact marker.
 const hatchPoints=[],halfWidth=(g.tappetShoeRightX-g.tappetShoeLeftX)/2-.025,halfHeight=.225;
 for(let offset=-.3;offset<=.300001;offset+=.1){
  const left=Math.max(-halfWidth,-halfHeight-offset),right=Math.min(halfWidth,halfHeight-offset);
  if(right>left)for(const x of [left,right])hatchPoints.push(new THREE.Vector3(b.tappet.position.x+x,x+offset,.2805));
 }
 b.tappet.material=b.tappet.material.clone();b.tappet.material.color.set('#f59a76');
 const hatching=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hatchPoints),new THREE.LineBasicMaterial({color:'#49352d'}));
 hatching.name='tappet-face-hatching';b.pistonGroup.add(hatching);
 const parts={},families={};
 root.traverse(o=>{if(o.isMesh){
  const name=o===b.pistonRod?'sectioned-piston-rod':(o.userData.role??'part')+'#'+Object.keys(parts).length;o.name=name;parts[name]=o;
  o.castShadow=true;o.receiveShadow=true;
  let parent=o;while(parent&&!parent.name.startsWith('body:'))parent=parent.parent;
  families[name]=parent?.name.slice(5)??'fixed';
 }});
 // The section mesh needs a stable runtime name in serialized playback.
 b.pistonRod.userData.sectioned=true;
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
