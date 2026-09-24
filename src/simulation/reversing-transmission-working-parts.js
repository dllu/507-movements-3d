import {installMangle371Profiles,installParsons394Profiles} from './reversing-transmission-tooth-profiles.js';
import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,sector,polygonClipping as clip} from './finite-plate-geometry.js';
import {markShadows} from './primitives.js';
const rectangle=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const replace=(mesh,geometry,reset=false)=>{mesh.geometry.dispose();mesh.geometry=geometry;if(reset)mesh.rotation.set(0,0,0);};
export function mangle371Web(depth){
 const holes=[circle([0,0],.11,96)];
 for(let i=0;i<4;i++){
  const a=Math.PI/4+i*Math.PI/2;
  holes.push(Array.from({length:96},(_,j)=>{const t=j*2*Math.PI/96,r=.81+.49*Math.cos(t),s=.54*Math.sin(t);return[r*Math.cos(a)-s*Math.sin(a),r*Math.sin(a)+s*Math.cos(a)];}));
 }
 return plate(clip.difference(poly(circle([0,0],1.35,192)),...holes.map(poly)),-depth/2,depth/2);
}
export function finishMangle371(root,update){
 const d=root.userData,b=d.blocks;
 b.wheelWeb.rotation.z=-d.stateAtTime(0).wheelAngle;
 replace(b.outputIndex,new THREE.BoxGeometry(.09,.022,.006));b.outputIndex.position.set(.04,0,.543);
 replace(b.carrierCollar,ring(.077,.18,-.12,.12,96).rotateY(Math.PI/2),true);
 replace(b.carrierBridge,plate(clip.difference(rectangle(-.12,-.36,.12,.36),poly(circle([0,0],.077,96))),-.08,.08).rotateY(Math.PI/2));
 replace(b.fixedBearing,ring(.11,.20,-.11,.11,96),true);
 replace(b.bearingPost,plate(clip.difference(rectangle(-.10,-1.17,.10,1.17),poly(circle([0,1.13],.11,96))),-.12,.12));
 replace(b.wheelHub,ring(.11,.31,-.15,.15,96),true);
 b.guideShoes=[];
 for(const y of[-.43,.43]){
  const shoe=new THREE.Mesh(plate(clip.difference(rectangle(-.15,-.115,.15,.115),rectangle(-.130,-.064,.052,.064)),-.10,.10),b.carrierBridge.material);
  shoe.position.set(-.72,y,0);shoe.userData.role='bored-cross-slide-shoe-with-radial-float';b.pinionCarrier.add(shoe);b.guideShoes.push(shoe);
 }
 for(const marker of[b.frontContactMarker,b.rearContactMarker,b.terminalContactMarker])marker.userData.referenceOnly=true;
 d.reconstructionNote='The initial rear-face terminal matches the source opening below the shaft. Bored journals, radial-float guide shoes and a connected four-window web are finite reconstructions. Finite tooth bars are cut offline against both face runs and terminal rollovers; open root rails replace the interfering solid median disk. The 33-degree opening, the narrowest the pinion crossover clears, is still wider than the engraving. Motion remains prescribed by the ideal pitch law, with finite backlash and unqualified passive crossover loads; pitch points are hidden rather than presented as contact witnesses.';
 const wrapped=time=>{update(time);for(const marker of[b.frontContactMarker,b.rearContactMarker,b.terminalContactMarker])marker.visible=false;};
 installMangle371Profiles(root);
 return finishView(root,wrapped,Math.max(3,d.geometry.inputRevolutionPeriod),new THREE.Vector3(.35,.2,15),d.geometry.mechanismCyclePeriod);
}
export function finishParsons394(root,update){
 const d=root.userData,g=d.geometry,b=d.blocks,r=b.rackCarrier.userData,o=b.outputRotor.userData;
 const guide=b.fixedFrame.children.find(x=>x.userData.role==='fixed-guide-for-reciprocating-input-rod');b.rodGuide=guide;
 guide.position.x=g.rackHalfStraight+g.rackPitchHalfHeight+1.45;
 replace(guide,plate(clip.difference(rectangle(-.525,-.37,.525,.37),capsule([.13,-g.crossShiftRadius],[.13,g.crossShiftRadius],.115,64)),-.15,.15).rotateY(-Math.PI/2));
 replace(r.inputRod,new THREE.CylinderGeometry(.11,.11,2.75,48));r.inputRod.position.x+=.25;r.pistonHead.position.x+=.50;
 const foot=new THREE.Vector3(guide.position.x-.5,-1.71,-.42),head=new THREE.Vector3(guide.position.x-.05,-.36,-.42),delta=head.clone().sub(foot);
 const post=new THREE.Mesh(new THREE.BoxGeometry(.20,delta.length(),.26),guide.material);
 post.position.copy(foot).add(head).multiplyScalar(.5);post.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
 post.userData.role='connected-input-guide-support';b.fixedFrame.add(post);b.rodGuideSupport=post;
 // The old teeth ended 0.14 short of their supporting body.
 replace(r.outerRim,plate(clip.difference(capsule([-g.rackHalfStraight,0],[g.rackHalfStraight,0],g.rackPitchHalfHeight+.48,96),capsule([-g.rackHalfStraight,0],[g.rackHalfStraight,0],g.rackPitchHalfHeight+.095,96)),-.12,.18));
 for(const mesh of b.rackCarrier.children)if(/straight-web-of-endless-rack/.test(mesh.userData.role??''))mesh.visible=false;
 replace(o.hub,ring(.100,.18,-.775,.775,96),true);
 for(const [flange,rim,radius,z]of[[o.largeFlange,o.largeFlangeRim,g.largeFlangeRadius,g.largePlaneZ],[o.smallFlange,o.smallFlangeRim,g.smallFlangeRadius,g.smallPlaneZ]]){
  replace(rim,new THREE.TorusGeometry(radius-.024,.016,10,96));rim.position.z=z+.071;
 }
 b.finiteGuideWalls=[];b.guideAttachments=[];
 for(const[groove,side,radius,z]of[[b.largeGroove,1,g.largeFlangeRadius,g.largePlaneZ],[b.smallGroove,-1,g.smallFlangeRadius,g.smallPlaneZ]]){
  for(const rail of groove.userData.rails)rail.visible=false;
  const c=side*g.guideHalfStraight,inner=radius+g.crossShiftRadius+.0006,outer=inner+.10,start=side>0?-Math.PI/2:Math.PI/2;
  const wall=new THREE.Mesh(plate(sector(inner,outer,start,start+Math.PI,192),z-.085,z+.085),groove.userData.rails[0].material);
  wall.position.x=c;wall.userData.role='finite-open-flange-guide-working-wall';wall.userData.innerRadius=inner;wall.userData.radius=radius;wall.userData.side=side;groove.add(wall);b.finiteGuideWalls.push(wall);
  groove.userData.workingWall=wall;groove.userData.workingClearance=.0006;
  for(const y of[-1,1]){
   const mouth=new THREE.Mesh(plate(rectangle(Math.min(c,c-side*.32),y>0?inner:-outer,Math.max(c,c-side*.32),y>0?outer:-inner),z-.085,z+.085),wall.material);
   mouth.userData.role='finite-open-flange-guide-mouth';groove.add(mouth);b.finiteGuideWalls.push(mouth);
   // Place attachments outside the complete flange sweep, joining both
   // the guide lip and the actual rack body at its side plane.
   const supportY=1.15;
   const web=new THREE.Mesh(new THREE.BoxGeometry(.16,supportY+.06-inner,.17),wall.material);
   web.position.set(c-side*.22,y*(inner+(supportY+.06-inner)/2),z);
   web.userData.role='guide-wall-to-rack-attachment';groove.add(web);b.guideAttachments.push(web);
   const spacer=new THREE.Mesh(new THREE.BoxGeometry(.16,.12,Math.abs(z-.03)+.26),wall.material);
   spacer.position.set(c-side*.22,y*supportY,(z+.03)/2);
   spacer.userData.role='guide-attachment-spacer-outside-pinion-sweep';groove.add(spacer);b.guideAttachments.push(spacer);
  }
 }
 d.reconstructionNote='Both side guides have finite open mouths around the full flange envelopes; the former inverted inner arcs intersected the flanges. The rod guide permits the small transverse shift, and the teeth join a solid rack body. The unequal circular flanges are coaxial with the pinion; their handoff angle assumes no-slip friction, since a circular normal alone supplies no shaft torque. The pinion is mounted half a tooth pitch from the former colliding phase, and the rack flanks are cut offline through the complete cycle. Shortened terminal-region teeth and finite backlash retain an unqualified loaded-handoff residual; the prescribed motion is not a solved passive transmission.';
 installParsons394Profiles(root);
 return finishView(root,update,8,new THREE.Vector3(.25,.12,15),d.timeline.cycleDuration);
}
function finishView(root,update,minimum,cameraDirection,cycle){
 const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=minimum;d.cameraFov=8;d.cameraDistanceScale=.96;
 root.traverse(o=>{for(const material of[].concat(o.material??[]))material.fog=false;});markShadows(root);
 const bounds=new THREE.Box3(),p=new THREE.Vector3();
 for(let i=0;i<=64;i++){update(cycle*i/64);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(o.isMesh&&[].concat(o.material??[]).some(m=>m.visible!==false)){const a=o.geometry.attributes.position;for(let j=0;j<a.count;j++)bounds.expandByPoint(p.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld));}});}
 d.cameraFitBounds=bounds.expandByScalar(.025);d.cameraDirection=cameraDirection;update(0);return{root,update,cameraDirection};
}
