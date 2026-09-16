import * as T from 'three';
import { ring } from './finite-plate-geometry.js';
const tau=2*Math.PI,rot=(p,a)=>new T.Vector2(p.x*Math.cos(a)-p.y*Math.sin(a),p.x*Math.sin(a)+p.y*Math.cos(a)),perp=p=>new T.Vector2(-p.y,p.x),cross=(a,b)=>a.x*b.y-a.y*b.x;
const unwrap=(a,t)=>{while(a-t>Math.PI)a-=tau;while(a-t< -Math.PI)a+=tau;return a;};
const solve=(f,lo,hi)=>{for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid;}return(lo+hi)/2;};

export function makeGeneva212ContactLaw(g){
 const finger=g.driverFingerArc.at(-1),rawMouth=g.slotPolylines[2][0];
 const mouth=g.stopWheelOutline.reduce((a,b)=>a.distanceTo(rawMouth)<b.distanceTo(rawMouth)?a:b);
 const inner=g.slotPolylines[2][1],edge=inner.clone().sub(mouth),normal=new T.Vector2(edge.y,-edge.x).normalize(),h=normal.dot(mouth);
 const tip=g.driverLockingArcRaw.at(-1).clone().multiplyScalar(g.constructionScale),theta0=tip.angle(),r=g.driverLockingRadius,D=g.centerDistance;
 function entry(a){
  const v=rot(finger,a),q=g.driverCenter.clone().add(v).sub(g.stopWheelCenter),arg=q.angle()-normal.angle(),sep=Math.acos(h/q.length()),expected=-g.stopStepAngle*a/g.normalIndexInputAngle;
  const angle=[arg-sep,arg+sep].map(x=>unwrap(x,expected)).sort((a,b)=>Math.abs(a-expected)-Math.abs(b-expected))[0],n=rot(normal,angle),pn=perp(n),velocity=perp(v),den=pn.dot(q),speed=-n.dot(velocity)/den;
  const acceleration=-(n.dot(v.clone().negate())+2*speed*pn.dot(velocity)-speed*speed*n.dot(q))/den;
  return{angle,speed,acceleration};
 }
 const split=Math.acos((g.driverFingerRadius**2-D*D-mouth.lengthSq())/(2*D*mouth.length()));
 const plateau=[Math.PI/2-split-mouth.angle(),Math.PI/2+split-mouth.angle()].map(a=>unwrap(a,-.92)).sort((a,b)=>Math.abs(a+.92)-Math.abs(b+.92))[0];
 function tail(a){
  const theta=a+theta0,A=r*Math.cos(theta),B=D-r*Math.sin(theta),den=A*A+B*B,N=2*r*(r-D*Math.sin(theta)),derivative=-2*r*D*Math.cos(theta);
  return{angle:2*Math.atan2(A,B)-g.stopStepAngle,speed:N/den,acceleration:derivative/den-N*derivative/den**2};
 }
 const entryEnd=solve(a=>entry(a).angle-plateau,.65,.75),tailStart=solve(a=>tail(a).angle-plateau,.78,.84),tailEnd=Math.PI/2-theta0,startError=entry(0).angle;
 function local(a){
  if(a<entryEnd){const q=entry(a),u=1-a/entryEnd;return{angle:q.angle-startError*u*u,speed:q.speed+2*startError*u/entryEnd,acceleration:q.acceleration-2*startError/entryEnd**2,stage:'finger-corner-slot-drive'};}
  if(a<tailStart)return{angle:plateau,speed:0,acceleration:0,stage:'rounded-finger-mouth-hold'};
  if(a<tailEnd)return{...tail(a),stage:'rim-corner-pocket-drive'};
  return{angle:-g.stopStepAngle,speed:0,acceleration:0,stage:'concentric-pocket-lock'};
 }
 function law(input){const clamped=T.MathUtils.clamp(input,0,g.forwardInputLimit),turn=Math.min(3,Math.floor((clamped+1e-12)/tau)),phase=clamped-turn*tau,q=local(Math.max(0,phase));return{...q,angle:q.angle-turn*g.stopStepAngle,turn,phase};}
 return{law,local,entryEnd,tailStart,tailEnd,plateau,mouth,finger,tip,normal};
}

export function finishGeneva212Contact(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,branch=makeGeneva212ContactLaw(g),source={stateAtInputAngle:d.stateAtInputAngle,stateAtTime:d.stateAtTime,stopWheelAngleAtInputAngle:d.stopWheelAngleAtInputAngle,canonicalStates:d.canonicalStates,canonicalTimes:d.canonicalTimes},oldUpdate=model.update;
 d.sourceKinematics=source;
 d.contactBranch212={entryEnd:branch.entryEnd,tailStart:branch.tailStart,tailEnd:branch.tailEnd,plateau:branch.plateau,profileTolerance:3e-6,forceSolved:false,selectedOutputTorqueSign:-1};
 d.stopWheelAngleAtInputAngle=input=>branch.law(input).angle;
 d.stateAtInputAngle=(input,v=0,a=0)=>{
  const s=source.stateAtInputAngle(input,v,a),q=branch.law(s.driverAngle),active=q.stage!=='concentric-pocket-lock',lockActive=!active&&q.turn<3,pocketIndex=lockActive?q.turn+1:null,pocketCenter=lockActive?rot(g.lockPocketCenters[pocketIndex],q.angle).add(g.stopWheelCenter):null;
  return{...s,stage:s.atTerminalStop?s.stage:q.stage,contactMode:s.atTerminalStop?s.stage:q.stage,stopWheelAngle:q.angle,stopWheelAngularSpeed:q.speed*s.driverAngularSpeed,stopWheelAngularAcceleration:q.speed*s.driverAngularAcceleration+q.acceleration*s.driverAngularSpeed**2,outputSteps:-q.angle/g.stopStepAngle,limit:{...s.limit,convexArcEndpoints:[g.convexStopArc[0],g.convexStopArc.at(-1)].map(p=>rot(p,q.angle).add(g.stopWheelCenter))},
   engagement:{...s.engagement,active:active&&!s.atTerminalStop,activeSlotIndex:active?q.turn+1:null,instantaneousRatio:q.speed,ratioDerivative:q.acceleration,officialPhaseError:Math.abs(q.angle-s.stopWheelAngle),workingContactStage:q.stage},
   lock:{...s.lock,active:lockActive,pocketIndex,pocketCenter,concentricityError:pocketCenter? pocketCenter.distanceTo(g.driverCenter):null,radialClearance:0}};
 };
 d.stateAtTime=time=>{const s=source.stateAtTime(time);return{...s,...d.stateAtInputAngle(s.driverAngle,s.driverAngularSpeed,s.driverAngularAcceleration)};};
 d.canonicalTimes={...d.canonicalTimes};
 for(const [i,key]of ['firstIndexComplete','secondIndexComplete','thirdIndexComplete'].entries()){
  const target=i*tau+branch.tailEnd;let lo=0,hi=d.timeline.forwardMotionDuration;
  for(let k=0;k<48;k++){const mid=(lo+hi)/2;if(source.stateAtTime(mid).driverAngle<target)lo=mid;else hi=mid;}d.canonicalTimes[key]=hi;
 }
 d.transmission.workingIndexInputAngle=branch.tailEnd;
 d.canonicalStates=Object.fromEntries(Object.entries(d.canonicalTimes).map(([key,t])=>[key,d.stateAtTime(t)]));
 // These outlines were drawing annotations; they expanded into the working
 // contact plane. The unchanged solid profiles provide their own visible edge.
 for(const key of ['driverEdge','stopWheelEdge','driverFingerHighlight'])if(b[key])b[key].visible=false;
 for(const[hub,bore]of[[b.driverHub,.089],[b.stopWheelHub,.086]]){const box=new T.Box3().setFromBufferAttribute(hub.geometry.attributes.position),outer=Math.max(Math.abs(box.min.x),Math.abs(box.max.x));hub.geometry.dispose();hub.geometry=ring(bore,outer,-.10,.10,96);}
 // Keep the indexes on actual material: the former upper index crossed the
 // empty mouth of a slot, and both bars floated above their supporting faces.
 for(const[index,hub]of[[b.driverIndex,b.driverHub],[b.stopWheelIndex,b.stopWheelHub]]){
  const angle=index.rotation.z;index.geometry.dispose();index.geometry=new T.BoxGeometry(.35,.052,.026);
  index.position.set(.32*Math.cos(angle),.32*Math.sin(angle),hub.position.z+.113);
 }
 d.reconstructionNote='The existing finger, mouth and rim now form a contacting index branch, capturing the lock at 54.78° rather than the source animation’s linear 51° schedule. Handoff impacts and input motion are prescribed; reverse playback requires an assisting output bias. Friction, inertia and loaded force balance are not simulated.';
 d.sourceAnimation.runtimeReconstructsFiniteContact=true;
 model.update=time=>{oldUpdate(time);const s=d.stateAtTime(time);for(const part of[b.stopWheel,b.stopWheelShaft]){part.userData.rotor.rotation.z=s.stopWheelAngle;part.userData.angularSpeed=s.stopWheelAngularSpeed;}d.kinematics=s;d.contacts={windingFingerSlot:s.engagement.active?s.engagement:null,lockingPocket:s.lock.active?s.lock:null,convexTerminalStop:s.atTerminalStop?s.limit:null};};
 model.update(0);return model;
}
