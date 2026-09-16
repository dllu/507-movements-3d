import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const role=(root,name)=>{let found;root.traverse(o=>{if(o.userData.role===name)found=o;});return found;};
const bore=(outer,inner,length)=>boredLatheGeometry([{axial:-length/2,radial:outer},{axial:length/2,radial:outer}],inner,64);
const shaft=(o,r,length,z)=>{replace(o,new T.CylinderGeometry(r,r,length,32));o.rotation.x=Math.PI/2;o.position.z=z;};
function mesh(parent,geometry,material,name){const o=new T.Mesh(geometry,material);o.userData.role=name;parent.add(o);return o;}

export function correctSinglePinParts(root){
 const d=root.userData,b=d.blocks,g=d.geometry,D=g.centerDistance,r=g.pinRadius;
 // Brown's upper-left and lower-right white areas are openings. Their solid
 // upright pallet faces belong on the opposite sides of the running pin.
 const arc=(a,c,R)=>Array.from({length:161},(_,i)=>{const x=a+(c-a)*i/160;return[x,-Math.sqrt(R*R-x*x)]});
 const upper=[...arc(r,.90,g.upperDeadFaceRadius),[.88,-D+.31],[.63,-D+.58],[.27,-D+.66],[r,-D+.47]];
 const lower=[...arc(-.90,-r,g.lowerDeadFaceRadius),[-r,-D-.47],[-.27,-D-.66],[-.63,-D-.58],[-.88,-D-.31]];
 for(const[o,p]of[[b.upperPallet,upper],[b.lowerPallet,lower]])replace(o,plate(poly(p),-.185,.185));
 b.upperPallet.userData.role='upper-solid-pallet-right-of-upper-left-opening';b.lowerPallet.userData.role='lower-solid-pallet-left-of-lower-right-opening';
 for(const o of[b.upperDeadEdge,b.lowerDeadEdge,b.upperImpulseEdge,b.lowerImpulseEdge])o.visible=false;
 const suspension=role(root,'fixed-pendulum-pivot');shaft(suspension,.118,.82,-.05);
 replace(b.pivotRing,bore(.33,.123,.33));b.pivotRing.rotation.x=Math.PI/2;
 const housing=role(root,'fixed-single-pin-disc-arbor');replace(housing,bore(.16,.118,.47));housing.position.z=-.325;
 shaft(b.diskHub,.115,.710,-.225);replace(b.disk,bore(g.diskRadius,.118,g.diskDepth));
 const cap=mesh(b.wheelRotor,new T.CylinderGeometry(.13,.13,.035,48),b.disk.material,'disk-face-cap-carrying-the-eccentric-pin');cap.rotation.x=Math.PI/2;cap.position.z=.1425;b.pinCarrier=cap;
 role(root,'pendulum-plate-neck').scale.x=1.3;
 // End the arbor at the disk face, behind the eccentric pin and working plate.
 shaft(b.rubyPin,r,.46,g.workingPlaneZ);b.diskRim.position.z=.145;b.diskIndex.position.z=.1425;
 b.palletMounts=[1,-1].map(side=>{const o=mesh(b.palletAssembly,new T.CylinderGeometry(.055,.055,.10,32),b.plate.material,'pallet-mount-across-axial-stand-off');o.rotation.x=Math.PI/2;o.position.set(side*.87,-D+side*.30,.18);return o;});
 d.workingPartsReview={scope:'Finite straight impulse faces, concentric rests, correct Z-opening handedness, pin/arbor stack and support bores.',qualification:'Upright impulse contact and positive work are checked against actual finite faces. Prescribed release/landing has a small corner interference and short gaps from the dead faces; passive operation is not qualified.',measuredBaseline:{pinPalletPenetration:.061,arborPalletPenetration:.108},contactMarkersSuppressed:true};
}

export function correctThreeLegParts(root,id){
 const d=root.userData,b=d.blocks,g=d.geometry;
 for(const edge of b.faceEdges)edge.visible=false;
 if(id===306){
  shaft(b.fixedArbor,.09,1.16,-.08);replace(b.wheelHub,bore(.20,.093,.70));
  const strut=mesh(b.fixedFrame,plate(clip.difference(clip.union(capsule([0,0],[0,1.38],.12,32),poly(circle([0,0],.22,64))),poly(circle([0,0],.093,64))),-.09,.09),b.fixedFrame.children[0].material,'bored-back-strut-joining-wheel-arbor-to-frame-bridge');strut.position.z=-.47;
  b.arborSupport=strut;
  // Actual screw bores are outside the working aperture.
  const shape=b.plate.geometry.parameters.shapes;
  for(const screw of b.screwMeshes){const hole=new T.Path();hole.absarc(screw.position.x,screw.position.y,.123,0,2*Math.PI,true);shape.holes.push(hole);}
  const geometry=new T.ExtrudeGeometry(shape,{depth:g.palletDepth,bevelEnabled:false,curveSegments:12});geometry.translate(0,0,-g.palletDepth/2);replace(b.plate,geometry);
 }else{
  shaft(role(root,'three-leg-wheel-arbor'),.078,.96,-.06);shaft(role(root,'pendulum-pallet-pivot'),.078,.96,-.06);
  replace(b.wheelHub,bore(.20,.082,1.12));replace(b.pivotEye,bore(.345,.083,.18));b.pivotEye.rotation.x=Math.PI/2;
  const outline=b.plate.geometry.parameters.shapes.extractPoints(16);
  replace(b.plate,plate(clip.difference(clip.union(poly(outline.shape.map(p=>p.toArray())),poly(circle([0,0],.345,64))),...outline.holes.map(h=>poly(h.map(p=>p.toArray()))),poly(circle([0,0],.083,64))),-g.palletDepth/2,g.palletDepth/2));
  // The backward impulse pins need a physical carrier on their rear plane;
  // their old ends stopped well short of the long front locking arms.
  const carrier=mesh(b.wheelRotor,bore(.47,.082,.12),b.longToothMeshes[0].material,'rear-disk-carrying-three-backward-impulse-pins');carrier.rotation.x=Math.PI/2;carrier.position.z=-.10;b.impulsePinCarrier=carrier;
 }
 d.workingPartsReview={scope:'Actual wheel and suspension journals, pin carriers and fixed supports; original working material retained.',qualification:'Generated point traces do not qualify the finite plate or backing faces. Tooth/pallet interference remains unresolved; the motion is prescribed and no passive contact solution is claimed.',measuredBaseline:id===306?{toothPlatePenetration:.149}:{longToothStopPenetration:.0933,pinBackingPenetration:.0698},contactMarkersSuppressed:true};
}

export function finishPinEscapement(model){
 const {root,update}=model,d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=6;
 const bounds=new T.Box3();for(let i=0;i<=32;i++){update(4*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}update(0);
 d.cameraFitBounds=bounds;d.cameraDistanceScale=1.05;d.cameraDirection=new T.Vector3(.8,.5,14);model.cameraDirection=d.cameraDirection;return model;
}
