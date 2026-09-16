import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
function boreCylinder(o,bore){const p=o.geometry.parameters;replace(o,boredLatheGeometry([{axial:-p.height/2,radial:p.radiusBottom},{axial:p.height/2,radial:p.radiusTop}],bore,64));}

export function correctCylinderWorkingParts(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 // The cylinder itself transmits balance torque across the working band. A
 // solid spindle through that band obstructs the entering escape-wheel tooth.
 const sections=[[-2.60,g.workingBandStartZ-.025],[g.workingBandEndZ+.025,2.23]].map(([lo,hi])=>{
  const geometry=new T.CylinderGeometry(.105,.105,hi-lo,32);geometry.rotateX(Math.PI/2);geometry.translate(0,0,(lo+hi)/2);return geometry;
 });
 replace(b.balanceStaff,mergeGeometries(sections));for(const geometry of sections)geometry.dispose();b.balanceStaff.rotation.set(0,0,0);
 b.balanceStaff.userData.role='two-end-pivots-with-clear-hollow-working-band';
 for(const o of[b.lowerCollar,b.upperCollar,b.lowerCone,b.upperCone])boreCylinder(o,.108);
 boreCylinder(b.wheelHub,.123);
 // Put both fixed journals behind the rotating lower collet; the old
 // standard plane cut through that cone even before its bore was corrected.
 const frameZ=-2.45,baseTop=b.base.position.y+.12;
 b.base.position.z=frameZ+.04;
 b.wheelBearing.position.z=frameZ+.12;b.cylinderBearing.position.z=frameZ+.12;
 const shaftRear=-2.60,shaftFront=g.wheelPlaneZ+.90;
 replace(b.wheelShaft,new T.CylinderGeometry(.12,.12,shaftFront-shaftRear,32));b.wheelShaft.position.z=(shaftFront+shaftRear)/2;
 const bridge=clip.union(capsule([0,baseTop],[0,g.cylinderCenter.y+.55],.13,32),poly(circle([0,g.wheelCenter.y],.32,64)),poly(circle([0,g.cylinderCenter.y],.30,64)));
 replace(b.rearStandard,plate(clip.difference(bridge,poly(circle([0,g.wheelCenter.y],.123,64)),poly(circle([0,g.cylinderCenter.y],.108,64))),-.11,.11));
 b.rearStandard.position.set(0,0,frameZ);b.rearStandard.rotation.set(0,0,0);
 for(const[o,bore]of[[b.wheelBearing,.123],[b.cylinderBearing,.108]]){
  replace(o,boredLatheGeometry([{axial:-.15,radial:.38},{axial:.15,radial:.38}],bore,64));o.rotation.x=Math.PI/2;
 }
 // Raised pallet stems previously hung just outside the annular wheel rim.
 const footGeometry=plate(capsule([2.46,0],[2.70,0],.10,24),g.wheelPlaneZ-.10,g.wheelPlaneZ+.10);
 const palletFeet=b.palletAssemblies.map((assembly,index)=>{const foot=new T.Mesh(footGeometry,b.wheelRim.material);foot.userData.role='raised-pallet-stem-foot-connected-to-wheel-rim';foot.userData.index=index;assembly.add(foot);return foot;});
 const balanceHub=new T.Mesh(boredLatheGeometry([{axial:-.10,radial:.20},{axial:.10,radial:.20}],.108,64),b.lowerCollar.material);balanceHub.rotation.x=Math.PI/2;balanceHub.position.z=g.balancePlaneZ;balanceHub.userData.role='bored-hub-joining-balance-spokes-to-end-pivot';b.cylinderAssembly.add(balanceHub);
 // These tubes were derived from a zero-size point trajectory and do not
 // constitute working surfaces. Keep the diagnostic objects out of the view.
 for(const o of[b.entryLipTrace,b.exitLipTrace,b.innerLockTrace,b.outerLockTrace])o.visible=false;
 b.contactMarker.visible=false;
 b.palletFeet=palletFeet;b.balanceHub=balanceHub;
 d.finiteContactReview={qualification:'Support, journal and hollow-passage corrections only. Finite pallet/cylinder and lip contact remains unresolved; the existing point-contact schedule is prescribed and does not qualify the visible solids.',
  measuredResiduals:{baselineShellPenetration:.08129,baselineLipPenetration:.02589},
  noPassiveForceValidation:true,contactMarkersSuppressed:true};
}

export function finishCylinderReview(model,id){
 const {root,update}=model,d=root.userData,b=d.blocks;
 if(id===295){b.sectionStaff.removeFromParent();const hub=d.balanceHubForSectionRemoval;if(hub)hub.removeFromParent();}
 b.cameraEnvelope.visible=false;d.hideGround=true;d.minimumDisplayCycleSeconds=6;
 const bounds=new T.Box3();
 for(let i=0;i<=32;i++){update(4*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(!o.geometry||o.userData.cameraFitGuide)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}
 update(0);d.cameraFitBounds=bounds;d.cameraDistanceScale=1.06;
 model.cameraDirection=id===294?new T.Vector3(-10,2.8,4.6):new T.Vector3(.8,.4,12);
 d.cameraDirection=model.cameraDirection;return model;
}
