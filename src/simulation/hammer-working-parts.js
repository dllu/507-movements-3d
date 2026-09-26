import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {curvedPipeWall} from './finite-fluid-passages.js';
import {portedBarrel} from './lift-pump-working-parts.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
const tube=(r,h,b)=>boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],b,64);
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const rect=(w,h)=>poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]);
function link(length,bore,eye,width,depth,axis='z'){
 const g=boredPlanarLinkGeometry({length,width,eyeRadius:eye,boreRadius:bore,depth});g.translate(-length/2,0,0).rotateZ(Math.PI/2).scale(1,1/length,1);if(axis==='x')g.rotateY(Math.PI/2);return g;
}
function ends(parent,x,z,low,high,r,bore,material){
 const lower=new THREE.Mesh(tube(r,.08,bore),material);lower.position.set(x,low-.04,z);lower.userData.role='bored-lower-cylinder-head';parent.add(lower);
 const upper=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.08,64),material);upper.position.set(x,high+.04,z);upper.userData.role='closed-upper-cylinder-head';parent.add(upper);return[lower,upper];
}
export function correctHammerWorkingParts(root,id){
 const d=root.userData,b=d.blocks,g=d.geometry;b.foundation.visible=false;d.hideGround=true;
 // The authored bottom coordinate is the striking plane, not the face center.
 const faceThickness=b.hammerFace.geometry.parameters.height;
 b.hammerFace.position.y+=faceThickness/2;
 const head=b.hammerHead.geometry.parameters;replace(b.hammerHead,new THREE.CylinderGeometry(head.radiusTop,head.radiusBottom,head.height-faceThickness,head.radialSegments).translate(0,faceThickness/2,0));
 if(id!==472){const body=b.anvil.children.find(o=>o!==b.anvilFace);body.position.y-=b.anvilFace.geometry.parameters.height;}
 const assembly=b.movingAssembly??b.hammerAssembly;
 assembly.children.filter(o=>o.geometry?.type==='TorusGeometry').forEach(o=>o.visible=false);
 b.workingCaps=[];
 if(id===470){
  b.pressFrame.children.filter(o=>!o.userData.role&&o.geometry?.type==="CylinderGeometry").forEach(o=>o.visible=false);
  for(const column of b.pressFrame.children.filter(o=>o.userData.role?.startsWith("frame-column-"))){replace(column,new THREE.BoxGeometry(.28,4.30,.48));column.position.y=1.04;}
  replace(b.fixedCylinder,portedBarrel(g.cylinderInnerRadius,g.cylinderOuterRadius,g.cylinderInnerBottomY-.08,g.cylinderInnerTopY+.08,1.34,.085,1));b.fixedCylinder.position.y=0;
  replace(b.piston,new THREE.CylinderGeometry(g.pistonRadius,g.pistonRadius,g.pistonThickness,64));
  b.workingCaps=ends(root,0,0,g.cylinderInnerBottomY,g.cylinderInnerTopY,g.cylinderOuterRadius,.078,b.cylinderRings[0].material);
  // The barrel's admission port faces the front, under Brown's valve chest.
  b.fixedCylinder.rotation.y=-Math.PI/2;
  replace(b.supplyPipe,tube(.085,1,.06));
  d.reconstructionNote='Steam pressure is prescribed to raise the rigid piston/rod/head, followed by the authored exhaust transition and analytic gravity fall. The finite striking face meets the anvil without overlap. The instantaneous stop is an ideal inelastic impact; deformation, rebound, valve-port flow and force transfer are not simulated.';
 }else if(id===471){
  replace(b.cylinderShell,portedBarrel(g.cylinderInnerRadius,g.cylinderOuterRadius,-g.cylinderHalfChamberHeight-.08,g.cylinderHalfChamberHeight+.08,.20,.085,-1));
  replace(b.piston,new THREE.CylinderGeometry(g.cylinderInnerRadius-.003,g.cylinderInnerRadius-.003,g.pistonThickness,64));
  b.workingCaps=ends(b.movingCylinder,0,0,-g.cylinderHalfChamberHeight,g.cylinderHalfChamberHeight,g.cylinderOuterRadius,.071,b.pistonRod.material);
  replace(b.atmosphericPort,tube(.085,.24,.062));b.atmosphericPort.position.z=0;
  for(const column of b.fixedFrame.children.filter(o=>o.geometry?.parameters.height===5.47)){replace(column,new THREE.BoxGeometry(.27,6.12,.48));column.position.y=1.25;}
  const bearing=new THREE.Mesh(tube(.17,.18,.107),b.fixedDriveShaft.material);bearing.rotation.x=Math.PI/2;bearing.position.set(g.crankCenter.x,g.crankCenter.y,.52);root.add(bearing);b.crankBearing=bearing;
  for(const [size,pos]of[[[.65,.10,.15],[.855,g.crankCenter.y,.52]],[[.15,.10,.70],[1.18,g.crankCenter.y,.17]]]){const support=new THREE.Mesh(new THREE.BoxGeometry(...size),b.fixedFrame.children[0].material);support.position.set(...pos);root.add(support);}
  replace(b.crankDisk,tube(g.crankRadius*.66,.22,.107));b.crankDisk.position.z=-.20;
  const arm=b.crankAssembly.children.find(o=>o.geometry?.type==='BoxGeometry');arm.position.z=-.20;
  b.crankAssembly.children.filter(o=>o!==arm&&o.geometry?.type==='BoxGeometry').forEach(o=>o.position.z=-.065);
  replace(b.fixedDriveShaft,new THREE.CylinderGeometry(.105,.105,.40,32));b.fixedDriveShaft.position.z=.70;
  replace(b.crankPinVisual,new THREE.CylinderGeometry(.095,.095,.40,32));b.crankPinVisual.position.z=-.06;
  replace(b.connectingRod,link(g.connectingRodLength,.097,.145,.10,.10));
  replace(b.cylinderDriveLug,plate(clip.difference(rect(.32,.28),poly(circle([0,0],.097,64))),-.25,.25));b.cylinderDriveLug.position.z=.65;
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.64,32),b.crankPinVisual.material);pin.rotation.x=Math.PI/2;pin.position.set(0,-g.cylinderDriveAttachmentOffsetY,.76);b.movingCylinder.add(pin);b.cylinderJointPin=pin;
  d.reconstructionNote='The crank drives the cylinder through a bored connecting rod; the longer hammer rod keeps its head below the cylinder throughout the stroke. The hammer trajectory and trapped-air pressure curves are prescribed illustrations. They do not solve the passive piston force balance or impact, rebound, leakage and valve timing.';
 }else{
  replace(b.pumpShell,tube(g.pumpInnerRadius+.085,g.pumpCylinderInnerTopY-g.pumpCylinderInnerBottomY+.16,g.pumpInnerRadius));
  replace(b.hammerCylinderShell,tube(g.hammerInnerRadius+.085,g.hammerCylinderInnerTopY-g.hammerCylinderInnerBottomY+.16,g.hammerInnerRadius));
  b.workingCaps=ends(root,g.hammerAxisX,g.hammerAxisZ,g.hammerCylinderInnerBottomY,g.hammerCylinderInnerTopY,g.hammerInnerRadius+.085,.068,b.hammerCylinderRings[0].material);
  // Trunk-piston pump: retain the open swinging-rod entrance and disclose it.
  replace(b.pumpConnectingRod,link(g.pumpConnectingRodLength,.082,.12,.08,.10,'x'));
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.22,32),b.pumpConnectingRod.material);pin.rotation.z=Math.PI/2;pin.position.y=g.pumpWristOffset;replace(pin,new THREE.CylinderGeometry(.08,.08,.40,32));b.pumpPistonAssembly.add(pin);b.pumpWristPin=pin;
  b.pumpForks=[];for(const x of[-.11,.11]){const eye=new THREE.Mesh(tube(.12,.06,.082),pin.material);eye.rotation.z=Math.PI/2;eye.position.set(x,g.pumpWristOffset,0);b.pumpPistonAssembly.add(eye);b.pumpForks.push(eye);
   const foot=new THREE.Mesh(new THREE.BoxGeometry(.06,.055,.12),pin.material);foot.position.set(x,.09,0);b.pumpPistonAssembly.add(foot);b.pumpForks.push(foot);}
  const crankPin=b.driveAssembly.children.find(o=>o.geometry?.parameters.radiusTop===.08);replace(crankPin,new THREE.CylinderGeometry(.08,.08,.22,32));b.pumpCrankPin=crankPin;
  replace(b.frictionWheel,tube(g.frictionWheelRadius,.16,.087));replace(b.drivePulley,tube(.73,.36,.087));
  b.frictionContactTrack.visible=false;
  const slot=clip.difference(rect(.64,.30),rect(.364,.164));replace(b.valveChest,plate(slot,-.65,.65).rotateY(Math.PI/2));b.valveChest.position.set(g.valveChestX,g.valveLinkageY,g.valveSliderAxisZ);
  // A bored forked rod rides on the disk's vertical crank pin.
  replace(b.valveConnectingRod,link(g.valveConnectingRodLength,.072,.11,.07,.06,'x'));
  d.reconstructionNote='The air pump, reservoir, friction drive and hammer retain their source arrangement and imposed timing ratio. Finite rod passages and striking surfaces are corrected. Hammer motion, air pressures and impact stopping remain prescribed; the trunk-piston pump entrance, valve porting, pressure seals, friction slip and rebound are not dynamically validated.';
 }
 d.minimumDisplayCycleSeconds=id===470?g.cycleDuration:id===471?5.6:9.6;
 root.traverse(o=>{for(const material of o.material?[].concat(o.material):[])material.fog=false;});
}
