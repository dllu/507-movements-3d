import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const role=(root,name)=>{let found;root.traverse(o=>{if(o.userData.role===name)found=o;});return found;};
const bore=(outer,inner,length)=>boredLatheGeometry([{axial:-length/2,radial:outer},{axial:length/2,radial:outer}],inner,64);
const shaft=(o,r,length,z)=>{replace(o,new T.CylinderGeometry(r,r,length,32));o.rotation.x=Math.PI/2;o.position.z=z;};
function mesh(parent,geometry,material,name){const o=new T.Mesh(geometry,material);o.userData.role=name;parent.add(o);return o;}

export function correctSinglePinParts(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 // The plate's own opening edges are the pallets; the ideal face centrelines
 // stay as hidden references for the kinematic checks.
 for(const o of[b.upperDeadEdge,b.lowerDeadEdge,b.upperImpulseEdge,b.lowerImpulseEdge])o.visible=false;
 // Suspension pin through the eye's bore; the disc arbor runs in a fixed
 // bush behind the disc.
 const suspension=role(root,'fixed-pendulum-pivot');shaft(suspension,.07,g.palletDepth+.12,g.plateZ);
 const housing=role(root,'fixed-single-pin-disc-arbor');replace(housing,bore(.16,.118,.2));housing.position.z=g.diskZ-g.diskDepth/2-.11;
 const arborEnd=g.diskFront,arborLength=arborEnd-(housing.position.z-.1);shaft(b.diskHub,.115,arborLength,arborEnd-arborLength/2);
 replace(b.disk,bore(g.diskRadius,.118,g.diskDepth));
 d.workingPartsReview={scope:'Pendulum plate with the escapement opening cut to Brown\'s shape: concentric dead edges and straight upright impulse edges, the pin standing from the disc behind the plate, bored eye, disc and arbor bush.',qualification:'The disc is driven until the pin meets the actual opening edges: it rests on the concentric dead faces, rolls round the neck corner and pushes the upright face, with positive work, all solved against the plate. Only the short drop onto the opposite dead face is prescribed; the pendulum law is prescribed and forces are not solved, so passive operation is not qualified.',contactMarkersSuppressed:true};
}

// Movement 306 only; 307 builds its own finite parts.
export function correctThreeLegParts(root,id){
 if(id!==306)throw new Error(`correctThreeLegParts is specific to 306, not ${id}`);
 const d=root.userData,b=d.blocks,g=d.geometry;
 for(const edge of b.faceEdges)edge.visible=false;
 if(id===306){
  // Brown shows only a small boss at the wheel centre: a short bored hub just
  // proud of the legs on an arbor ending at its face.
  shaft(b.fixedArbor,.09,.82,-.21);replace(b.wheelHub,bore(.14,.093,.36));b.wheelHub.position.z=.04;
  const strut=mesh(b.fixedFrame,plate(clip.difference(clip.union(capsule([0,0],[0,1.38],.12,32),poly(circle([0,0],.22,64))),poly(circle([0,0],.093,64))),-.09,.09),b.fixedFrame.children[0].material,'bored-back-strut-joining-wheel-arbor-to-frame-bridge');strut.position.z=-.47;
  b.arborSupport=strut;
  // Actual screw bores are outside the working aperture.
  const shape=b.plate.geometry.parameters.shapes;
  for(const screw of b.screwMeshes){const hole=new T.Path();hole.absarc(screw.position.x,screw.position.y,.123,0,2*Math.PI,true);shape.holes.push(hole);}
  const geometry=new T.ExtrudeGeometry(shape,{depth:g.palletDepth,bevelEnabled:false,curveSegments:12});geometry.translate(0,0,-g.palletDepth/2);replace(b.plate,geometry);
 }
 d.workingPartsReview={scope:'Bored wheel hub on its fixed arbor, screwed plate and the finite opening faces that select every wheel event.',qualification:'The wheel follows the finite upper/lower impulse steps and the horizontal side rests and falls freely between them; the pendulum is prescribed and forces are not solved.',contactMarkersSuppressed:true};
}

export function finishPinEscapement(model){
 const {root,update}=model,d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=6;
 const bounds=new T.Box3();for(let i=0;i<=32;i++){update(4*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}update(0);
 d.cameraFitBounds=bounds;d.cameraDistanceScale=1.05;d.cameraDirection=new T.Vector3(.8,.5,14);model.cameraDirection=d.cameraDirection;return model;
}
