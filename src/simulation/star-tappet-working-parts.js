import * as THREE from 'three';
import paths from './baked/star-tappet-paths.js';
import {plate,poly,circle,capsule,ring,polygonClipping as clip} from './finite-plate-geometry.js';
function sample(values,q){const x=q*(values.length-1),i=Math.min(values.length-2,Math.floor(x)),f=x-i;return{angle:values[i]*(1-f)+values[i+1]*f,derivative:(Math.abs(f)<1e-7&&i>0?(values[i+1]-values[i-1])/2:values[i+1]-values[i])*(values.length-1)};}
export function starTappetState(s,g,profileClearanceAt){
  if(s.stage==='arm-rising-clear-after-index')s.stage='handoff-dwell-after-index';
  if(s.stage==='arm-returning-clear-to-next-tooth')s.stage='holding-dwell-before-return';
  const tappet=sample(paths.tappet,s.cyclePhase),holding=sample(paths.holding,s.cyclePhase);
  s.tappetDelta=tappet.angle;s.tappetDeltaSpeed=tappet.derivative/4;
  s.tappetAngle=s.carrierAngle+g.tappetRestRelativeAngle+tappet.angle;
  s.tappetAngularSpeed=s.carrierAngularSpeed+s.tappetDeltaSpeed;
  s.tappetNoseCenter=s.tappetHinge.clone().add(new THREE.Vector2(Math.cos(s.tappetAngle),Math.sin(s.tappetAngle)).multiplyScalar(g.tappetLength));
  const contact=profileClearanceAt(s.tappetNoseCenter,g.tappetNoseRadius-.0005,s.wheelAngle);
  s.tappetClearance=contact.clearance;
  s.returnContact=s.driveContact?null:{...contact,engaged:contact.clearance<.008};
  s.holdingClickAngle=g.holdingClickRestAngle+holding.angle;s.holdingClickDelta=holding.angle;
  s.holdingClickAngularSpeed=holding.derivative/4;s.holdingClickDeflected=Math.abs(holding.angle)>1e-8;
  const center=g.holdingClickPivot.clone().add(new THREE.Vector2(Math.cos(s.holdingClickAngle),Math.sin(s.holdingClickAngle)).multiplyScalar(g.holdingClickLength));
  const hold=profileClearanceAt(center,g.holdingClickRadius-.0005,s.wheelAngle);
  s.holdingClickState={...hold,clickDelta:holding.angle,deflected:s.holdingClickDeflected,engaged:hold.clearance<.001};
  s.holdingClickEngaged=s.holdingClickState.engaged;
  s.holdingTorque=s.holdingClickEngaged?-hold.profilePoint.x*hold.normal.y+hold.profilePoint.y*hold.normal.x:null;
  s.ratchetLockedAgainstReverse=s.wheelDwelling&&s.holdingClickEngaged;
  s.prescribedReturnAndDrop=true;return s;
}
export function finishStarTappet(root){
  const d=root.userData,b=d.blocks,g=d.geometry;
  const replace=(mesh,geometry,reset=false)=>{mesh.geometry.dispose();mesh.geometry=geometry;if(reset)mesh.rotation.set(0,0,0);};
  for(const[nose,r]of[[b.tappetNose,g.tappetNoseRadius],[b.holdingClickNose,g.holdingClickRadius]]){
    replace(nose,new THREE.CylinderGeometry(r-.0005,r-.0005,.72,96));nose.position.z=-.13;
  }
  // Brown draws each nose as the rounded end of its own hook, not a black
  // stud: the rear-reaching noses take their parent part's colour.
  b.tappetNose.material=b.tappetBody.material;b.holdingClickNose.material=b.holdingClickBody.material;
  // Ideal smooth hooked plate and narrow carrier strip preserve the solved
  // source hinge/tip; their layer separation is unchanged.
  // Brown's arm is a broad flat bar (about 0.48 across at the plate's scale)
  // with a rounded end round its pivot, carrying the tappet near its left end.
  const carrierOutline=capsule([-.12,0],[g.carrierLength+.8,0],.22,48);
  replace(b.carrierBody,plate(clip.difference(carrierOutline,poly(circle([0,0],.089,128)),poly(circle([g.carrierLength,0],.074,128))),-.085,.085));
  const hook=new THREE.Shape();hook.moveTo(-.1,-.1);
  hook.quadraticCurveTo(g.tappetLength*.55,.03,g.tappetLength,0);
  hook.quadraticCurveTo(g.tappetLength*.83,.41,g.tappetLength*.43,.33);
  hook.quadraticCurveTo(.08,.26,-.1,.1);hook.closePath();
  replace(b.tappetBody,plate(clip.difference(poly(hook.extractPoints(24).shape.map(p=>p.toArray())),poly(circle([0,0],.074,128))),-.09,.09));
  // Brown's tappet continues past its hinge into a tail lobe that he dashes
  // behind the arm; only its lower edge shows below the arm. The tail is a
  // second plate behind the arm (world z 0.01..0.19; arm 0.215..0.385), keyed
  // with the front hook to a hinge pin that turns in the arm's bore. The small
  // return spring, also behind the arm, bears up on the lobe (tailLobe).
  const tailLobe={center:[-.5,.28],radius:.2};
  const tail=new THREE.Mesh(plate(clip.difference(clip.union(capsule([0,.04],tailLobe.center,.15,48),poly(circle(tailLobe.center,tailLobe.radius,96)),poly(circle([0,0],.13,96))),poly(circle([0,0],.074,128))),-.49,-.31),b.tappetBody.material);
  tail.userData.role='tappet-tail-lobe-behind-arm';b.tappet.add(tail);
  g.tappetTailLobe=tailLobe;
  replace(b.ratchet.userData.indicator,new THREE.BoxGeometry(.04,.16,.008));
  b.ratchet.userData.indicator.position.set(0,.21,.214);
  b.tappetHingeIndex.position.z=.09;
  replace(b.tappetHingeHub,ring(.074,.13,-.07,.07,128),true);
  replace(b.carrierBearing,ring(.089,.15,-.03,.03,128),true);
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.62,64),b.tappetNose.material);pin.rotation.x=Math.PI/2;pin.position.set(0,0,-.2);pin.userData.role='finite-independent-tappet-hinge-pin';b.tappet.add(pin);
  const curve=b.holdingClickBody.geometry.parameters.path.getPoints(32).map(p=>[p.x,p.y]);
  let outline=poly(circle([0,0],.115,64));for(let i=1;i<curve.length;i++)outline=clip.union(outline,capsule(curve[i-1],curve[i],.085,8));
  replace(b.holdingClickBody,plate(clip.difference(outline,poly(circle([0,0],.074,128))),-.06,.06));
  replace(b.holdingClickBearing,ring(.074,.12,-.035,.035,128),true);
  const shaft=b.holdingClickShaft.userData.rotor.children.find(o=>o.isMesh);replace(shaft,new THREE.CylinderGeometry(.07,.07,.8,64));
  replace(b.ratchet.userData.hub,ring(.104,.31,-.21,.21,128));
  // The old spring lived half a unit in front of its clamp/arm. Keep the
  // same bending curve but move it into the arm/tappet layers and join it.
  // Spring and clamp sit behind the arm, in the tail lobe's plane (world 0.1).
  b.tappetSpring.position.z=-.7;b.springClamp.position.z=-.2;
  const clampBridge=new THREE.Mesh(new THREE.BoxGeometry(.28,.16,.1),b.springClamp.material);clampBridge.position.set(.39,.16,-.1);b.carrierGroup.add(clampBridge);
  // Brown draws plain pivot holes and a spring riveted to the arm: the star's
  // hub, the tappet's hinge boss and the spring clamp take their parts' colours
  // and the fixed bearing washers are only a rim round their pins.
  b.ratchet.userData.hub.material=b.ratchet.userData.body.material;b.tappetHingeHub.material=b.tappetBody.material;
  b.springClamp.material=b.carrierBody.material;clampBridge.material=b.carrierBody.material;
  d.workingParts={pin,tail,clampBridge,paths};d.minimumDisplayCycleSeconds=6;d.hideGround=true;
  d.sourceAnimation.reason='Animation unavailable: fetched source has no inline add_model registration or mm_present program.';
  d.reconstructionNote='The spring-held tappet drives the rising face of the six-point star; finite noses reach the wheel. The return and holding-click drop follow continuous prescribed clearance paths, with inferred spring bias and a dwell for transfer. Spring forces, impact, friction and loaded transfer are not dynamically validated.';
  d.dynamics={forceValidated:false,prescribedReturnAndHolding:true,velocityContinuous:false};
  root.traverse(o=>{if(o.isMesh)for(const material of[].concat(o.material))material.fog=false;});
}
