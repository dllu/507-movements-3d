import * as THREE from 'three';
import paths from './baked/star-tappet-paths.js';
import {plate,poly,circle,capsule,ring,add,sub,rotate,polygonClipping as clip} from './finite-plate-geometry.js';
const TAPPET_NOSE_START=-2.35,TAPPET_EDGE_REACH=.65,TAPPET_NOSE_END=1.2;
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
// Brown's holding click is a slender spring hook that runs round outside the
// star's points from its pivot eye above and drops its rounded nose into the
// space before a point. Set out at rest in the star's frame (wheel angle 0):
// a band concentric with the star, clear of the tips, then a straight hook,
// tapering to the nose circle, into the tooth space. Returned in the click's
// frame (pivot at the origin, nose centre on +x).
export const CLICK_BAND_HALF_WIDTH=.06,CLICK_BAND_CLEARANCE=.05,CLICK_EYE_RADIUS=.09,CLICK_HOOK_TURN=0;
export function holdingClickOutline(g){
  const P=g.holdingClickPivot,a0=g.holdingClickRestAngle,Lc=g.holdingClickLength,rc=g.holdingClickRadius-.0005,w=CLICK_BAND_HALF_WIDTH;
  const C=[P.x+Lc*Math.cos(a0),P.y+Lc*Math.sin(a0)],Rb=g.ratchetOuterRadius+CLICK_BAND_CLEARANCE+w;
  const out=[Math.cos(Math.atan2(C[1],C[0])+CLICK_HOOK_TURN),Math.sin(Math.atan2(C[1],C[0])+CLICK_HOOK_TURN)];
  const along=C[0]*out[0]+C[1]*out[1],t=-along+Math.sqrt(along*along-(C[0]*C[0]+C[1]*C[1])+Rb*Rb),K=[C[0]+t*out[0],C[1]+t*out[1]];
  const pa=Math.atan2(P.y,P.x);let ka=Math.atan2(K[1],K[0]);while(ka-pa>Math.PI)ka-=2*Math.PI;while(ka-pa<-Math.PI)ka+=2*Math.PI;
  const pr=Math.hypot(P.x,P.y),fillet=.16,arc=[];
  for(let i=0;i<=60;i++){const f=i/60,angle=pa+(ka-pa)*f,s=Math.min(1,f/.3),r=pr+(Rb-pr)*s*s*(3-2*s);arc.push([r*Math.cos(angle),r*Math.sin(angle)]);}
  // Trim the arc a fillet length short of the corner and round the corner.
  let run=0,cut=arc.length-1;for(let i=arc.length-1;i>0;i--){run+=Math.hypot(...sub(arc[i],arc[i-1]));if(run>=fillet){cut=i-1;break;}}
  const start=arc[cut],end=add(K,[-out[0]*fillet,-out[1]*fillet]),line=arc.slice(0,cut+1).map(p=>[p,w]);
  for(let i=1;i<=10;i++){const f=i/10;line.push([[start[0]*(1-f)**2+2*K[0]*(1-f)*f+end[0]*f*f,start[1]*(1-f)**2+2*K[1]*(1-f)*f+end[1]*f*f],w]);}
  for(let i=1;i<=12;i++){const f=i/12;line.push([add(end,[(C[0]-end[0])*f,(C[1]-end[1])*f]),w+(rc-w)*Math.min(1,f/.8)]);}
  const local=line.map(([p,r])=>[rotate(sub(p,[P.x,P.y]),-a0),r]),upper=[],lower=[];
  local.forEach(([p,r],i)=>{const q=local[Math.min(local.length-1,i+1)][0],o=local[Math.max(0,i-1)][0],d=sub(q,o),n=Math.hypot(...d),nx=-d[1]/n,ny=d[0]/n;upper.push([p[0]+nx*r,p[1]+ny*r]);lower.push([p[0]-nx*r,p[1]-ny*r]);});
  const [tip]=local.at(-1),d=sub(tip,local.at(-2)[0]),ta=Math.atan2(d[1],d[0]),nose=[];
  for(let i=1;i<24;i++){const t=ta+Math.PI/2-Math.PI*i/24;nose.push(add(tip,[rc*Math.cos(t),rc*Math.sin(t)]));}
  const ring=[...upper,...nose,...lower.reverse()];
  return clip.union(poly(ring),poly(circle([0,0],CLICK_EYE_RADIUS,64)));
}
export function finishStarTappet(root){
  const d=root.userData,b=d.blocks,g=d.geometry;
  const replace=(mesh,geometry,reset=false)=>{mesh.geometry.dispose();mesh.geometry=geometry;if(reset)mesh.rotation.set(0,0,0);};
  // Brown draws each nose as the rounded end of its own flat hook. The star,
  // the tappet's hook and the holding click share one plane (world z 0.5), so
  // each nose is part of its plate outline and bears on the star directly.
  // Ideal smooth hooked plate and narrow carrier strip preserve the solved
  // source hinge/tip; their layer separation is unchanged.
  // Brown's arm is a broad flat bar (about 0.48 across at the plate's scale)
  // with a rounded end round its pivot, carrying the tappet near its left end.
  const carrierOutline=capsule([-.12,0],[g.carrierLength+.8,0],.22,48);
  replace(b.carrierBody,plate(clip.difference(carrierOutline,poly(circle([0,0],.089,128)),poly(circle([g.carrierLength,0],.074,128))),-.085,.085));
  // Brown's tappet is a beak: its upper edge sweeps down and back from the
  // rounded nose, so the driven point's tip passes clear of it while the nose
  // (its arc covering every drive contact direction) bears on the face.
  const L=g.tappetLength,rn=g.tappetNoseRadius-.0005,hook=new THREE.Shape();hook.moveTo(-.1,-.11);
  const noseStart=[L+rn*Math.cos(TAPPET_NOSE_START),rn*Math.sin(TAPPET_NOSE_START)],noseTangent=[-Math.sin(TAPPET_NOSE_START),Math.cos(TAPPET_NOSE_START)];
  hook.quadraticCurveTo(noseStart[0]-TAPPET_EDGE_REACH*noseTangent[0],noseStart[1]-TAPPET_EDGE_REACH*noseTangent[1],...noseStart);
  hook.absarc(L,0,rn,TAPPET_NOSE_START,TAPPET_NOSE_END,false);
  hook.quadraticCurveTo(L*.83,.52,L*.43,.4);
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
  b.ratchet.userData.indicator.position.set(0,.21,g.ratchetDepth/2+.004);
  b.tappetHingeIndex.position.z=.09;
  replace(b.tappetHingeHub,ring(.074,.13,-.07,.07,128),true);
  replace(b.carrierBearing,ring(.089,.15,-.03,.03,128),true);
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.62,64),b.tappetBody.material);pin.rotation.x=Math.PI/2;pin.position.set(0,0,-.2);pin.userData.role='finite-independent-tappet-hinge-pin';b.tappet.add(pin);
  replace(b.holdingClickBody,plate(clip.difference(holdingClickOutline(g),poly(circle([0,0],.074,128))),-.06,.06));
  replace(b.holdingClickBearing,ring(.074,.12,-.035,.035,128),true);
  const shaft=b.holdingClickShaft.userData.rotor.children.find(o=>o.isMesh);replace(shaft,new THREE.CylinderGeometry(.07,.07,.34,64));
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
