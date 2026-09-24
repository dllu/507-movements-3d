import { frictionBackstopData } from './friction-windlass-backstop-data.js';
import * as T from 'three';
import {plate,poly,circle,capsule,sector,polygonClipping as clip} from './finite-plate-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {helicalThread,threadAngles,chamferedHex} from './mujoco-screw/thread-geometry.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const bore=(outer,inner,length,segments=96)=>boredLatheGeometry([{axial:-length/2,radial:outer},{axial:length/2,radial:outer}],inner,segments);
const V=(x,y,z=0)=>new T.Vector3(x,y,z);
const rot=(v,a)=>v.clone().applyAxisAngle(V(0,0,1),a);
function mesh(parent,geometry,material,role){const m=new T.Mesh(geometry,material);m.userData.role=role;parent.add(m);return m;}

export function correctFriction267(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry;
 replace(b.rim,bore(g.rimOuterRadius,g.rimInnerRadius,.72,768).rotateX(Math.PI/2));b.rim.position.z=.06;b.innerLiner.visible=false;
 const shape=b.arms[0].children[0].geometry.parameters.shapes.extractPoints(24).shape.map(p=>p.toArray());
 const region=clip.difference(clip.intersection(clip.union(poly(shape),poly(circle([0,0],.18,64)),poly(circle(g.tipCenterRelative.toArray(),g.armEndHalfWidth,64))),poly(circle([-g.pivotRadius,0],g.rimInnerRadius,512))),poly(circle([0,0],g.pivotBossRadius+.004,64)));
 for(const arm of b.arms)replace(arm.children[0],plate(region,-g.armDepth/2,g.armDepth/2));
 const cap=mesh(b.carrierRotor,bore(.37,.305,.24),b.carrier.material,'shaft-collar-joining-four-arm-carrier');cap.rotation.x=Math.PI/2;cap.position.z=.12;b.carrierCollar=cap;
 d.workingPartsReview={qualification:'Actual finite eccentric arm faces now meet the rim in the same axial band and retreat on reverse drag. Engagement and spring preload remain prescribed; no force threshold or passive clutch simulation is claimed.'};
 return model;
}

export function correctFriction280(model){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry,oldState=d.stateAtTime,oldUpdate=model.update;
 const R=g.wheelRadius,Ri=g.wheelInnerRadius,P=d.fourBar.shortLeverPivot.length(),L=g.rockerLength,C=g.couplerLength,H=d.fourBar.handlePivot.clone(),crank=g.inputCrankLength;
 const released=-.09,step=g.outputStopPitch,engage=g.inputEngageAngle,oldPower=g.inputPowerAngle;
 const solve=(input,beta)=>{const upper=H.clone().add(V(crank*Math.cos(input),crank*Math.sin(input))),v=V(P+L*Math.cos(beta),L*Math.sin(beta)),r=v.length(),u=upper.length(),k=(u*u+r*r-C*C)/(2*u*r);if(Math.abs(k)>1)throw Error('Moving jaw circle closure unreachable');const angle=Math.atan2(upper.y,upper.x)-Math.acos(k)-Math.atan2(v.y,v.x);return{angle,upper,lower:rot(v,angle),pivot:V(P*Math.cos(angle),P*Math.sin(angle))};};
 const engageAngle=solve(engage,0).angle;let lo=oldPower,hi=engage;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(solve(mid,0).angle-engageAngle>step)lo=mid;else hi=mid;}const power=(lo+hi)/2;
 const position=time=>{const s=oldState(time);let input=s.inputAngle,rateScale=1;if(s.stage==='upstroke-rim-clamped-friction-drive'||s.stage==='top-handle-dwell-rim-clamped'){rateScale=(power-engage)/(oldPower-engage);input=engage+(input-engage)*rateScale;}else if(s.stage==='downstroke-clamp-released-wheel-held'){rateScale=(g.inputReturnAngle-power)/(g.inputReturnAngle-oldPower);input=power+(input-oldPower)*rateScale;}
  const beta=released*s.shoeGap/g.maximumShoeGap,q=solve(input,beta),contact=rot(V(P,0).add(rot(V(R*Math.cos(.12)-P,R*Math.sin(.12)),beta)),q.angle),actualGap=Math.max(0,contact.length()-R),advance=s.driving?q.angle-engageAngle:s.cycleTime>=d.timeline.driveEnd?step:0;
  return{...s,inputAngle:input,inputAngularSpeed:s.inputAngularSpeed*rateScale,inputAngularAcceleration:s.inputAngularAcceleration*rateScale,jawAngle:q.angle,relativeLeverAngle:beta,shoeCenter:contact,shoeGap:actualGap,rockerAngle:q.angle+beta,shortLeverPivot:q.pivot,upperPin:q.upper,lowerPin:q.lower,wheelAngle:s.cycleIndex*step+advance,couplerLengthError:q.upper.distanceTo(q.lower)-C,rockerLengthError:q.pivot.distanceTo(q.lower)-L,outputDirection:'counterclockwise',noSlipArcSpeedError:s.clampActive?0:null};};
 const state=time=>{const s=position(time),h=1e-5,a=position(time-h),c=position(time+h);s.jawAngularSpeed=(c.jawAngle-a.jawAngle)/(2*h);s.wheelAngularSpeed=s.driving?s.jawAngularSpeed:0;s.rockerAngularSpeed=(c.rockerAngle-a.rockerAngle)/(2*h);s.shoeVelocity=c.shoeCenter.clone().sub(a.shoeCenter).multiplyScalar(1/(2*h));return s;};
 // A rear web and true annular rim leave a working inner surface for the jaws.
 replace(b.wheelDisk,bore(R-.05,.235,.08).rotateX(Math.PI/2));b.wheelDisk.position.z=0;b.wheelDisk.rotation.set(0,0,0);
 replace(b.outerRim,bore(R,Ri,.70,768).rotateX(Math.PI/2));
 const oldLine=b.wheelRotor.children.find(o=>o.userData.role==='visible-inner-surface-of-wheel-rim');if(oldLine)oldLine.visible=false;
 b.ratchetWheel.position.z=.67;
 for(const tooth of b.ratchetTeeth)replace(tooth,plate(poly(frictionBackstopData.profile),-.08,.08));
 for(const [i,pawl]of[b.upperPawl,b.lowerPawl].entries()){pawl.children[0].visible=false;const row=frictionBackstopData.rows[i];mesh(pawl,plate(clip.difference(clip.union(capsule([0,0],[row.length,0],.065,32),poly(circle([0,0],.18,64))),poly(circle([0,0],.094,96))),-.06,.06),b.wheelDisk.material,'bored-holding-pawl-arm');}
 // Brown draws both pawls as plain links, as broad as the coupler, with
 // eyes round small pins; the pins stay inside those eyes.
 for(const pawl of[b.upperPawl,b.lowerPawl])pawl.position.z=.67;
 for(const pin of b.holdingPawlPivotPins){pin.position.z=.67;replace(pin,new T.CylinderGeometry(.09,.09,.48,40));}
 b.upperPawlTip.material=b.lowerPawlTip.material=b.wheelDisk.material;
 const jaw=new T.Group();jaw.userData.role='cast-jaw-travelling-circumferentially-with-the-rim';root.add(jaw);b.movingJaw=jaw;
 for(const o of b.jawSides){o.visible=false;}
 for(const flange of b.jawFlanges){jaw.add(flange);flange.position.set(0,0,0);replace(flange,plate(sector(Ri-.14,Ri,-.18,.18,96),flange===b.jawFlanges[0]?-.46:.10,flange===b.jawFlanges[0]?-.10:.46));}
 b.jawCheeks=[];
 const cheek=clip.difference(poly([[Ri-.14,-.29],[P+.23,-.29],[P+.23,.29],[Ri-.14,.29]]),poly(circle([P,0],.174,96)));
 for(const side of[-1,1]){const m=mesh(jaw,plate(cheek,side<0?-.54:.40,side<0?-.40:.54),b.jawPivotBridge.material,'bored-cheek-of-travelling-cast-jaw');b.jawCheeks.push(m);}
 jaw.add(b.jawPivotBridge);b.jawPivotBridge.position.set(P,0,-.34);replace(b.jawPivotBridge,bore(.24,.174,.42));
 const frontJournal=mesh(jaw,bore(.24,.174,.42),b.jawPivotBridge.material,'front-travelling-jaw-journal');frontJournal.rotation.x=Math.PI/2;frontJournal.position.set(P,0,.34);b.frontJawJournal=frontJournal;
 jaw.add(b.shortLeverPivotPin);b.shortLeverPivotPin.position.set(P,0,0);replace(b.shortLeverPivotPin,new T.CylinderGeometry(.17,.17,1.3,64));
 b.jawPivotHeads=[-1,1].map(side=>{const head=mesh(jaw,new T.CylinderGeometry(.23,.23,.14,64),b.shortLeverPivotPin.material,'retained-jaw-pivot-head');head.rotation.x=Math.PI/2;head.position.set(P,0,side*.60);return head;});
 jaw.add(b.shortLever);b.shortLever.position.set(P,0,0);
 // Eccentric shoe meets an upper quadrant of the outer rim. Positive relative
 // lever rotation wedges inward; reversing that angle lifts it clear.
 const delta=.12,normal=[Math.cos(delta),Math.sin(delta)],tip=[R*normal[0]-P,R*normal[1]],center=[tip[0]+.085*normal[0],tip[1]+.085*normal[1]];
 const arm=clip.difference(clip.union(capsule([0,0],[L,0],.115,32),capsule([0,0],center,.105,48),poly(circle([0,0],.215,64)),poly(circle([L,0],.21,64))),poly(circle([0,0],.174,96)),poly(circle([L,0],.174,96)),poly(circle([-P,0],R+.001,512)));
 b.shortLeverBody.visible=false;b.shortLeverBody=mesh(b.shortLever,plate(arm,-.10,.10),b.clampShoe.material,'bored-eccentric-short-lever');b.shortLeverBody.position.set(0,0,0);b.shortLeverBody.rotation.set(0,0,0);b.shortLeverBody.scale.set(1,1,1);
 const shoe=clip.difference(poly(circle(center,.085,96)),poly(circle([-P,0],R,512)));
 // The shoe stays 0.01 inside the two jaw journals (their faces at |z|=.13).
 replace(b.clampShoe,plate(shoe,-.12,.12));b.clampShoe.position.set(0,0,0);
 // A real bored rod bridges the front plane of both link pins.
 b.connectingRod.visible=false;const link=mesh(root,boredPlanarLinkGeometry({length:C,width:.17,eyeRadius:.23,boreRadius:.174,depth:.16}),b.wheelDisk.material,'bored-coupler-closing-handle-to-travelling-jaw');b.finiteCoupler=link;
 replace(b.lowerLinkPin,new T.CylinderGeometry(.17,.17,1.90,48));b.lowerLinkPin.position.z=.30;
 replace(b.upperLinkPin,new T.CylinderGeometry(.15,.15,1.0,48));
 const ratchetCarrier=mesh(b.wheelRotor,bore(g.ratchetRootRadius,.235,.05),b.wheelDisk.material,'rear-web-carrying-backstop-ratchet');ratchetCarrier.rotation.x=Math.PI/2;ratchetCarrier.position.z=.60;b.ratchetCarrier=ratchetCarrier;
 d.stateAtTime=state;d.legacyGroundedFourBar=d.fourBar;delete d.fourBar;
 d.geometry={...g,movingJawPivotRadius:P,relativeReleaseAngle:released,shoeContactPoint:V(...tip),inputPowerAngle:power,engageJawAngle:engageAngle};
 d.workingPartsReview={qualification:'Moving-jaw circle closure and finite inner/outer friction faces are reconstructed. Lever take-up, friction lock and backstop selection are prescribed; load capacity and passive pawl contacts are unqualified.',sourceCorrection:'The cast block travels with the rim; its lever pin is fixed in that block, not grounded. Upward pull advances this reconstruction counterclockwise.'};
 d.mechanism='one alternating long hand lever and one rigid coupler move a rim-travelling two-jaw cast-iron block; its eccentric short lever clamps the rim for the upward stroke, then the downstroke releases and slides while two staggered pawls are prescribed to prevent reverse motion';
 model.update=time=>{oldUpdate(time);const s=state(time);b.handLever.rotation.z=s.inputAngle;jaw.rotation.z=s.jawAngle;b.shortLever.rotation.z=s.relativeLeverAngle;b.clampShoe.position.set(0,0,0);b.wheelRotor.rotation.z=s.wheelAngle;link.position.copy(s.upperPin);link.position.z=.90;link.rotation.z=Math.atan2(s.lowerPin.y-s.upperPin.y,s.lowerPin.x-s.upperPin.x);const phase=((s.wheelAngle/frictionBackstopData.pitch)%1+1)%1,u=phase*frictionBackstopData.count,j=Math.floor(u),f=u-j;
 for(const [i,pawl]of[b.upperPawl,b.lowerPawl].entries()){const row=frictionBackstopData.rows[i],lift=row.lifts[j]*(1-f)+row.lifts[(j+1)%frictionBackstopData.count]*f;pawl.rotation.z=row.base-lift;}
 d.kinematics=s;d.contacts.upperHoldingPawl={active:false,qualification:'prescribed outward envelope; passive seating unqualified'};d.contacts.lowerHoldingPawl={active:false,qualification:'prescribed outward envelope; passive seating unqualified'};d.contacts.shoeRim={active:s.clampActive,gap:s.shoeGap,noSlipArcSpeedError:s.noSlipArcSpeedError};};
 d.transmission.inputOutputDirection='The rising outer lever end drives the rim-travelling jaw and wheel counterclockwise; return is unloaded and held.';d.transmission.outputTurnsPerInputStroke=step/(2*Math.PI);delete d.transmission.outputRatio;delete d.stateAtInputAngle;delete d.inputScheduleAtTime;delete d.sourceReference.plate280.sourceIdealizationPixelErrors;
 d.transmission.outputDirection='counterclockwise';d.transmission.outputAdvancePerCycle=step;
 d.backstopReview={direction:'counterclockwise overrun; radial locking face opposes clockwise motion',playback:'Baked continuous outward clearance envelope; no passive seating/load claim.'};
 model.update(0);return model;
}

export function correctFriction413(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,role=name=>{let found;model.root.traverse(o=>{if(o.userData.role===name)found=o;});return found;};
 const pitch=g.threadLead,external={inner:.1295,outer:.16,low:-1.12,high:-.26,width:pitch/2,lead:pitch/(2*Math.PI),phase:-1.12},internal={inner:.132,outer:.166,low:-.11,high:.11,width:pitch/2-.002,lead:external.lead,phase:external.phase+pitch/2-g.looseNutX};
 const thread=p=>helicalThread(p,threadAngles(p,64)).rotateY(Math.PI/2);
 replace(b.threadedEnd,thread(external));b.threadedEnd.rotation.set(0,0,0);
 replace(b.nutBody,chamferedHex({radius:.27,bore:.165,low:-.11,high:.11,phase:0,bottomBevel:.02,topBevel:.02},Array.from({length:97},(_,i)=>2*Math.PI*i/96)).rotateY(Math.PI/2));b.nutBody.rotation.set(0,0,0);
 const nutThread=mesh(b.adjustmentNut,thread(internal),b.nutBody.material,'mating-internal-adjustment-thread');b.internalThread=nutThread;
 replace(role('adjustment-nut-threaded-collar'),bore(.20,.165,.22));
 replace(b.nutHandle,plate(clip.difference(poly([[-.06,-.39],[.06,-.39],[.06,.39],[-.06,.39]]),poly(circle([0,0],.165,96))),-.08,.08).rotateY(Math.PI/2));
 replace(b.leftClampPlate,bore(.72,.164,.14));replace(b.rightClampPlate,bore(.72,.134,.14));
 for(const[name,r]of[['fixed-upper-shaft-bearing',.134],['fixed-lower-shaft-bearing',.154]]){const bearing=role(name);replace(bearing,bore(name.includes('upper')?.24:.27,r,.38));bearing.position.z=0;
  const support=mesh(b.fixedFrame,plate(clip.difference(poly([[-.30,-.29],[.60,-.29],[.60,.29],[-.30,.29]]),poly(circle([0,0],r,96))),-.14,.14).rotateY(Math.PI/2),bearing.material,'bored-bridge-joining-bearing-to-back-standard');support.position.copy(bearing.position);
 }
 // The two rigid V flanks now have the same axial stations as the uncompressed
 // rubber V, rather than an unrelated wider pair separated by a torus.
 replace(b.lowerLeftHalf,new T.CylinderGeometry(g.lowerGrooveRootRadius,g.lowerGrooveLipRadius,.25,128));b.lowerLeftHalf.position.x=-.125;
 replace(b.lowerRightHalf,new T.CylinderGeometry(g.lowerGrooveLipRadius,g.lowerGrooveRootRadius,.25,128));b.lowerRightHalf.position.x=.125;
 b.grooveRoot.visible=false;role('rubber-v-edge-crown').visible=false;
 for(const[name,side]of[['left-lip-of-rigid-v-groove',-1],['right-lip-of-rigid-v-groove',1]])role(name).position.x=side*.29;
 b.contactIndicators.forEach(o=>o.visible=false);b.compressionGuide.visible=false;
 d.threadProfiles={external,internal};d.workingPartsReview={qualification:'Closed mating screw/nut threads follow the displayed advance, with real shaft journals and matching unloaded V profiles. Rubber remains a free-expansion volume proxy: its loaded groove penetration is not a validated deformation or traction solution.'};return model;
}

export function finishFrictionFamily(model,id){const{root,update}=model,d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=id===267?9.2:id===280?8:9;root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});const period=d.timeline?.demonstrationPeriod??d.geometry?.cyclePeriod??9,bounds=new T.Box3();for(let i=0;i<=32;i++){update(period*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}update(0);d.cameraFitBounds=bounds;d.cameraDistanceScale=1.04;model.cameraDirection=new T.Vector3(id===413?-4:.6,id===413?2:.5,12);return model;}
