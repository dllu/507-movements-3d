import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { capsule, plate } from './finite-plate-geometry.js';
import { markShadows } from './primitives.js';
import envelope from './generated/anchor-escapement-envelopes.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
function journal(outer,bore,length){return boredLatheGeometry([{radial:outer,axial:-length/2},{radial:outer,axial:length/2}],bore,64);}
export function correctAnchorEscapement(root,id,update){
 const d=root.userData,b=d.blocks,g=d.geometry,p={pairs:[]};
 if(id===288){
  const outline=o=>o.geometry.parameters.shapes.getPoints().map(v=>v.toArray());
  p.originalProfiles={wheel:outline(b.toothedRim),anchor:outline(b.anchorBody),left:outline(b.leftPallet.userData.body),right:outline(b.rightPallet.userData.body)};
  const shape=b.toothedRim.geometry.parameters.shapes;
  const toothGeometry=new THREE.ExtrudeGeometry(shape,{depth:g.wheelDepth,bevelEnabled:false,curveSegments:64});toothGeometry.translate(0,0,-g.wheelDepth/2);replace(b.toothedRim,toothGeometry);
  const data=envelope[id];
  replace(b.anchorBody,plate(data.anchor,-g.anchorDepth/2,g.anchorDepth/2));
  for(const[side,pallet]of[['left',b.leftPallet],['right',b.rightPallet]])replace(pallet.userData.body,plate(data[side],-(g.anchorDepth+.04)/2,(g.anchorDepth+.04)/2));
  const strap=new THREE.Mesh(plate(capsule(...data.leftAttachment,.065,24),.15,.32),b.anchorBody.material);strap.userData.role='front-layer-attachment-of-left-working-pallet';b.anchor.add(strap);p.strap=strap;
  p.pairs.push([b.toothedRim,b.anchorBody],[b.toothedRim,b.leftPallet.userData.body],[b.toothedRim,b.rightPallet.userData.body],[b.toothedRim,strap]);
  b.crutch.visible=false;b.crutchIndex.visible=false;
  d.reconstructionNote='The wheel recoils on each outgoing nonconcentric pallet and advances on return, then drops to the other pallet. Finite working profiles follow this prescribed contact path. Tooth landing has an idealized velocity change; impact, friction and pendulum energy balance are not dynamically simulated.';
  p.contactQualification='Finite envelope with 0.0015 nominal clearance; active-face proximity and reaction direction checked. Prescribed path, not passive dynamics.';
 }else{
  b.anchorBody.position.z=.20; // The structural arch clears the wheel plane; pallets retain their working layer.
  p.pairs.push([b.toothedRim,b.anchorBody]);
  d.reconstructionNote='Concentric locking faces illustrate a stationary escape wheel during repose, followed by impulse and drop. The prescribed timing is retained, but finite tooth/pallet interference during the handoff remains unresolved; this model is not contact validated or a passive dynamics simulation.';
  p.contactQualification='Unresolved finite tooth/pallet interference: a naive clearance cut would remove up to 0.316 of the intended active face. Original timing and working profiles retained.';
 }
 replace(b.wheelHub,journal(.42,.146,.74));
 for(const bearing of[b.wheelBearing,b.anchorBearing]){replace(bearing,journal(bearing===b.wheelBearing?.40:.33,.146,.42).rotateX(Math.PI/2));bearing.position.z=-.70;}
 const arbor=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,1.30,48),b.anchorPivotHub.material);arbor.rotation.x=Math.PI/2;arbor.position.z=-.25;arbor.userData.role='anchor-arbor-reaching-fixed-rear-journal';b.anchor.add(arbor);p.arbor=arbor;
 p.pairs.push([b.wheelShaft,b.wheelHub],[b.wheelShaft,b.wheelBearing],[arbor,b.anchorBearing],[arbor,b.rearStandard]);
 const rearLow=g.wheelCenter.y-g.toothTipRadius-.10,rearHigh=g.anchorPivot.y+.45;
 replace(b.rearStandard,new THREE.BoxGeometry(.22,rearHigh-rearLow,.24));b.rearStandard.position.set(0,(rearHigh+rearLow)/2,-.95);b.rearStandard.rotation.set(0,0,0);
 b.base.visible=false;b.cameraEnvelope.visible=false;b.crutchIndex.visible=false;
 replace(b.contactMarker,new THREE.SphereGeometry(.045,16,12));
 d.hideGround=true;d.minimumDisplayCycleSeconds=4;d.cameraDirection=new THREE.Vector3(0,.15,15);d.cameraFov=8;d.cameraDistanceScale=.85;d.escapementWorkingParts=p;
 root.traverse(o=>{for(const mat of[].concat(o.material??[]))mat.fog=false;});markShadows(root);b.contactMarker.castShadow=false;
 const bounds=new THREE.Box3(),point=new THREE.Vector3();
 for(let i=0;i<=32;i++){update(g.pendulumPeriod*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{const a=o.geometry?.attributes.position;if(a)for(let j=0;j<a.count;j++)bounds.expandByPoint(point.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld));});}
 d.cameraFitBounds=bounds.expandByScalar(.15);update(0);
}
