import * as THREE from 'three';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalPlate,horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {portedBarrel} from './lift-pump-working-parts.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const rectangle=(w,h,cx=0,cy=0)=>poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]]);
const add=(parent,geometry,material,role)=>{const mesh=new THREE.Mesh(geometry,material);mesh.userData.role=role;parent.add(mesh);return mesh;};
export function correctBalancePumps(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 // Pass 93: round bosses (r 0.14, about twice the pin's radius) at the two
 // pitman pins, concentric with them, so each pin stands in the middle of
 // metal instead of filling the 0.14-deep bar edge to edge.
 replace(b.beamBar,plate(clip.difference(clip.union(rectangle(g.beamHalfLength*2,.14),poly(circle([0,0],.235,64)),
  ...[-1,1].map(side=>poly(circle([side*g.attachmentRadius,0],.14,64)))),poly(circle([0,0],.174,64))),-.12,.12));
 // A split deck lets the beam rock and its links descend between the treads.
 replace(b.platform,horizontalPlate(clip.difference(rectangle(4.25,1.65,0,-.18),rectangle(4.4,.72)),1.50,1.66));b.platform.position.set(0,0,0);
 replace(b.foundation,horizontalPlate(clip.difference(rectangle(7,3.2),...[-1,1].map(side=>poly(circle([side*g.cylinderOffset,0],.12,64)))),-1.52,-1.37));b.foundation.position.set(0,0,0);
 b.attachmentPins.forEach(pin=>replace(pin,new THREE.CylinderGeometry(.072,.072,.72,32)));
 for(const a of b.pumpAssemblies){
   const x=a.side*g.cylinderOffset;
   replace(a.cylinder,portedBarrel(g.cylinderInnerRadius,.30,g.cylinderBottomY,g.cylinderTopY,-1.03,.13,1));a.cylinder.position.set(x,0,0);a.cylinder.rotation.y=-Math.PI/2;
   const link=boredPlanarLinkGeometry({length:g.pitmanLength,width:.09,eyeRadius:.125,boreRadius:.076,depth:.09});link.translate(-g.pitmanLength/2,0,0).rotateZ(Math.PI/2).scale(1,1/g.pitmanLength,1);replace(a.pitman,link);
   replace(a.crosshead,plate(clip.difference(clip.union(rectangle(.16,.22,0,-.11),poly(circle([0,0],.135,64))),poly(circle([0,0],.076,64))),-.10,.10));
   a.jointPin=add(root,new THREE.CylinderGeometry(.072,.072,.65,32),a.pistonRod.material,'actual-crosshead-pitman-pin');a.jointPin.rotation.x=Math.PI/2;
   replace(a.inletPipe,horizontalTurned([[-.115,.070],[-.115,.11],[.115,.11],[.115,.070]]));a.inletPipe.position.y=-1.315;
   replace(a.inletWater,new THREE.CylinderGeometry(.066,.066,.23,24));a.inletWater.position.y=-1.315;
   a.inletSeat=add(root,horizontalRing(.09,g.cylinderInnerRadius,-.05,0),a.inletValve.material,'finite-inlet-check-seat');a.inletSeat.position.set(x,g.cylinderBottomY+.12-.0225,0);
   a.deliverySeat=add(root,horizontalRing(.10,.17,-.05,0),a.deliveryValve.material,'finite-delivery-check-seat');a.deliverySeat.position.set(x,-.6725,.55);
   a.deliveryBody=add(root,horizontalTurned([[-.25,.08],[-.25,.11],[-.18,.205],[.18,.205],[.25,.11],[.25,.08],[.18,.17],[-.18,.17]]),a.cylinder.material,'finite-delivery-check-chamber');a.deliveryBody.position.set(x,-.65,.55);
   const lower=new THREE.CatmullRomCurve3([new THREE.Vector3(x,-1.03,.20),new THREE.Vector3(x,-1.03,.40),new THREE.Vector3(x,-.90,.55)]);
   const upper=new THREE.CatmullRomCurve3([new THREE.Vector3(x,-.40,.55),new THREE.Vector3(x,.20,.55),new THREE.Vector3(a.side*.34,.48,.55),new THREE.Vector3(0,.62,.55)]);
   replace(a.deliveryPipe,mergePassageParts([curvedPipeWall(lower,.08,.11,40),curvedPipeWall(upper,.08,.11,64)]));
   const flow=new THREE.CurvePath();flow.add(lower);flow.add(new THREE.LineCurve3(lower.getPoint(1),upper.getPoint(0)));flow.add(upper);replace(a.deliveryWater,new THREE.TubeGeometry(flow,96,.052,12,false));
   a.cover=add(root,horizontalRing(.056,.30,-.045,.045),a.cylinder.material,'bored-pump-rod-cover');a.cover.position.set(x,g.cylinderTopY,0);
 }
 replace(b.commonOutlet,horizontalTurned([[-.36,.19],[-.36,.23],[-.06,.125],[.36,.125],[.36,.072],[-.06,.072]]));b.commonOutlet.position.z=.55;b.commonOutletWater.position.z=.55;
 d.updateWorkingParts=state=>state.pumps.forEach((s,i)=>{
   const a=b.pumpAssemblies[i];a.pitman.position.z=.25;a.jointPin.position.copy(s.crosshead);a.jointPin.position.z=.10;
   const top=s.crosshead.y-.20,bottom=s.piston.y;a.pistonRod.position.y=(top+bottom)/2;a.pistonRod.scale.y=top-bottom;
   a.deliveryValve.position.set(a.side*g.cylinderOffset,-.65+.075*s.deliveryOpenAmount,.55);
 });
 d.reconstructionNote='Exact beam/pitman slider motion with finite joint bores and separate delivery passages. Check timing, operator forcing and fluid transport remain prescribed; no passive check forces, pressure losses or seal leakage are solved.';
 finish(root,g.cycleDuration);
}

function finish(root,minimum){
 const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=minimum;
 root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});
 const bounds=new THREE.Box3(),p=new THREE.Vector3();
 for(let i=0;i<=32;i++){d.update(d.geometry.cycleDuration*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{const a=o.geometry?.attributes.position;if(a)for(let j=0;j<a.count;j++)bounds.expandByPoint(p.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld));});}
 d.cameraFitBounds=bounds.expandByScalar(.12);d.cameraDirection=new THREE.Vector3(.7,.65,15);d.cameraDistanceScale=1.06;d.cameraFov=12;
}
