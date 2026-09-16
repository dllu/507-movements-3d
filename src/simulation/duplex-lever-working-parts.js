import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly} from './finite-plate-geometry.js';
import {markShadows} from './primitives.js';
function replace(mesh,geometry){mesh.geometry.dispose();mesh.geometry=geometry;}
function bore(outer,inner,length){return boredLatheGeometry([{radial:outer,axial:-length/2},{radial:outer,axial:length/2}],inner,64);}
function bar(a,b,width,material){const v=new THREE.Vector3().subVectors(b,a),m=new THREE.Mesh(new THREE.CylinderGeometry(width,width,v.length(),24),material);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}

export function correctDuplexLeverInterfaces(root,id,update){
 const d=root.userData,b=d.blocks,g=d.geometry,p={pairs:[],supports:[]};
 const isDuplex=id===293,radius=isDuplex?.14:.115;
 replace(b.wheelHub,bore(isDuplex?.43:.37,radius+.006,isDuplex?.76:.78));
 const journals=isDuplex?[[b.wheelBearing,.14],[b.balanceBearing,.13]]:[[b.wheelBearing,.115],[b.forkBearing,.12],[b.balanceBearing,.115]];
 for(const[bearing,r]of journals){replace(bearing,bore(.30,r+.006,.30).rotateX(Math.PI/2));bearing.position.z=-.79;}
 b.rearStandard.visible=false;b.base.visible=false;b.cameraEnvelope.visible=false;
 // A rear bridge joins the actual journal bodies; it lies behind every arbor.
 const centers=journals.map(([bearing])=>new THREE.Vector3(bearing.position.x,bearing.position.y,-1.03));
 for(let i=1;i<centers.length;i++){const bridge=bar(centers[0],centers[i],.10,b.rearStandard.material);bridge.userData.role='rear-bridge-between-watch-journals';b.fixedFrame.add(bridge);p.supports.push(bridge);}
 for(const center of centers){const post=bar(center,new THREE.Vector3(center.x,center.y,-.89),.20,b.rearStandard.material);post.userData.role='rear-journal-attachment';b.fixedFrame.add(post);p.supports.push(post);}
 replace(b.wheelShaft,new THREE.CylinderGeometry(radius,radius,1.66,48));b.wheelShaft.position.z=-.04;
 p.pairs.push([b.wheelShaft,b.wheelHub],[b.wheelShaft,b.wheelBearing]);
 if(isDuplex){
  replace(b.rollerHub,new THREE.CylinderGeometry(.13,.13,1.70,48));b.rollerHub.position.z=-.025;
  // The roller and arm are keyed to the staff, with an actual through bore.
  const rollerShape=b.lockingRoller.geometry.parameters.shapes.clone(),hole=new THREE.Path();hole.absarc(0,0,.136,0,Math.PI*2,true);rollerShape.holes.push(hole);
  const roller=new THREE.ExtrudeGeometry(rollerShape,{depth:g.rollerDepth,bevelEnabled:false,curveSegments:64});roller.translate(0,0,-g.rollerDepth/2);replace(b.lockingRoller,roller);
  p.pairs.push([b.rollerHub,b.balanceBearing],[b.rollerHub,b.lockingRoller]);
  d.reconstructionNote='A raised crown pin impulses pallet B once per oscillation while long teeth illustrate locking on roller A. The staff, bores and journals are reconstructed. The prescribed handoff is unresolved: the radial locking geometry lacks a resisting moment, and the solid notch and crown-pallet contact do not validate the displayed motion.';
  p.contactResidual='Radial tooth/roller tangency cannot positively lock the driven wheel. The prescribed release, silent recoil and crown impulse require a new compatible contact law.';
 }else{
  replace(b.forkPivotHub,bore(.25,.126,.92));
  const arbor=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,1.70,48),b.forkPivotHub.material);arbor.rotation.x=Math.PI/2;arbor.position.z=-.37;arbor.userData.role='pallet-fork-arbor-reaching-rear-journal';b.palletFork.add(arbor);p.arbor=arbor;
  replace(b.balanceStaff,new THREE.CylinderGeometry(.115,.115,1.82,48));b.balanceStaff.position.z=.04;
  replace(b.rollerDisk,bore(.84,.121,.22));
  p.pairs.push([arbor,b.forkPivotHub],[arbor,b.forkBearing],[b.balanceStaff,b.balanceBearing],[b.balanceStaff,b.rollerDisk]);
  // The drawn right-hand end C belongs to the same rigid lever as the fork E.
  const end=new THREE.Mesh(plate(poly([[1.42,.04],[2.95,.28],[2.81,-.48],[1.42,-.38]]),-g.forkDepth/2,g.forkDepth/2),b.anchorBody.material);end.userData.role='right-hand-end-C-of-rigid-lever-E-C';b.palletFork.add(end);p.leverEnd=end;
  d.reconstructionNote='The balance pin illustrates alternate unlocking and impulse through lever E–C, then a detached return. The arbors, bores and rigid lever are reconstructed. The prescribed working contact is unresolved: the pallets miss the wheel depth, and the curved fork does not establish a compatible finite pin handoff. This is not a validated contact or passive dynamics simulation.';
  p.contactResidual='Pallets remain above the wheel working depth; bringing them into plane exposes incompatible finite profiles. The prescribed fork/pin law must be reconstructed together with wheel impulse and banking.';
 }
 // Brown shows the staff/roller and working interfaces, not a second foreground
 // balance assembly obscuring them. Preserve those parts for metadata consumers.
 b.balanceRim.visible=false;b.balanceIndex.visible=false;for(const spoke of b.balanceSpokes)spoke.visible=false;
 for(const marker of isDuplex?[b.lockContactMarker,b.impulseContactMarker]:[b.palletContactMarker,b.pinContactMarker]){replace(marker,new THREE.SphereGeometry(.04,16,10));marker.castShadow=false;}
 p.shafts=[b.wheelShaft,isDuplex?b.rollerHub:p.arbor,...(isDuplex?[]:[b.balanceStaff])];
 d.escapementInterfaces=p;d.hideGround=true;d.minimumDisplayCycleSeconds=4;d.cameraDirection=new THREE.Vector3(0,.15,15);d.cameraFov=8;d.cameraDistanceScale=.86;
 root.traverse(o=>{for(const mat of[].concat(o.material??[]))mat.fog=false;});markShadows(root);
 const bounds=new THREE.Box3(),point=new THREE.Vector3();
 for(let i=0;i<=32;i++){update(g.balancePeriod*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{const pos=o.geometry?.attributes.position;if(pos)for(let j=0;j<pos.count;j++)bounds.expandByPoint(point.fromBufferAttribute(pos,j).applyMatrix4(o.matrixWorld));});}
 d.cameraFitBounds=bounds.expandByScalar(.15);update(0);
}
