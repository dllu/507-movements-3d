import * as T from 'three';
import {plate} from './finite-plate-geometry.js';
import {geneva215ContactData as raw} from './geneva-stop-215-contact-data.js';
const step=Math.PI/3,tau=2*Math.PI;
function slopes(rows,h){const delta=rows.slice(1).map((a,i)=>(a-rows[i])/h);return rows.map((_,i)=>i===0?delta[0]:i===rows.length-1?delta.at(-1):delta[i-1]*delta[i]<=0?0:2*delta[i-1]*delta[i]/(delta[i-1]+delta[i]));}
function interpolate(span,x){const u=(x-span.start)/span.h,i=Math.min(span.rows.length-2,Math.floor(Math.max(0,u))),t=Math.max(0,Math.min(1,u-i)),a=span.rows[i],b=span.rows[i+1],s=span.slopes[i]*span.h,r=span.slopes[i+1]*span.h;return{angle:(2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*s+(-2*t**3+3*t*t)*b+(t**3-t*t)*r,speed:((6*t*t-6*t)*a+(3*t*t-4*t+1)*s+(-6*t*t+6*t)*b+(3*t*t-2*t)*r)/span.h,acceleration:((12*t-6)*a+(6*t-4)*s+(-12*t+6)*b+(6*t-2)*r)/span.h**2};}

// Offline cutter and contact roots select the loaded flank. Runtime only
// evaluates monotone Hermite spans; it does not search polygons or solve forces.
export function finishGeneva215Contact(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,source={stateAtInputTravel:d.stateAtInputTravel,stateAtTime:d.stateAtTime,stopWheelAngleAtInputTravel:d.stopWheelAngleAtInputTravel,engagementAtInputTravel:d.engagementAtInputTravel,canonicalStates:d.canonicalStates},oldUpdate=model.update;
 d.sourceKinematics=source;
 const entry=[...raw.entry],tail=[...raw.tail];entry[entry.length-1]=source.stopWheelAngleAtInputTravel(raw.entryEnd);tail[0]=source.stopWheelAngleAtInputTravel(raw.tailStart);for(let i=1;i<tail.length;i++)tail[i]=Math.max(tail[i-1],tail[i]);
 const spans=[[0,raw.entryEnd,entry],[raw.tailStart,raw.tailEnd,tail]].map(([start,end,rows])=>{const h=(end-start)/(rows.length-1),s=slopes(rows,h);s[0]=start===0?0:source.stateAtInputTravel(start).engagement.instantaneousRatio;s[s.length-1]=start===0?source.stateAtInputTravel(end).engagement.instantaneousRatio:0;return{start,end,rows,h,slopes:s};});
 function law(u){const k=Math.floor(u/tau),phase=u-k*tau,span=spans.find(s=>phase>=s.start&&phase<=s.end);if(span){const x=interpolate(span,phase);return{...x,angle:k*step+x.angle,handoff:true};}if(phase>raw.tailEnd)return{angle:(k+1)*step,speed:0,acceleration:0,handoff:false};const s=source.stateAtInputTravel(u);return{angle:s.stopWheelAngle,speed:s.engagement.instantaneousRatio,acceleration:s.engagement.ratioDerivative,handoff:false};}
 d.contactBranch={entryEnd:raw.entryEnd,exitStart:raw.tailStart,exitEnd:raw.tailEnd,selectedOutputTorqueSign:1,forceSolved:false,profileTolerance:2.2e-5};
 d.stateAtInputTravel=(u,v=0,a=0)=>{
  const s=source.stateAtInputTravel(u,v,a),q=law(s.inputTravel),p=s.engagement.pinCenter.clone().sub(g.stopWheelCenter).rotateAround({x:0,y:0},-q.angle),localPinAngle=T.MathUtils.euclideanModulo(p.angle(),tau),active=q.speed>1e-12,slotIndex=active?T.MathUtils.euclideanModulo(Math.round((localPinAngle-Math.PI/6)/step),6):null,pocketIndex=Math.round(T.MathUtils.euclideanModulo(Math.PI-q.angle,tau)/step)%6,normalPocket=pocketIndex!==5,pocketCenterLocal=new T.Vector2(g.centerDistance*Math.cos(pocketIndex*step),g.centerDistance*Math.sin(pocketIndex*step)),pocketCenterWorld=pocketCenterLocal.clone().rotateAround({x:0,y:0},q.angle).add(g.stopWheelCenter),lockActive=!active&&normalPocket;
  const engagement={...s.engagement,active,instantaneousRatio:q.speed,ratioDerivative:q.acceleration,pinInStopWheelLocal:p,localPinAngle,slotIndex,slotCenterAngle:slotIndex===null?null:Math.PI/6+slotIndex*step,slotRadialPosition:p.length(),handoff:q.handoff,selectedOutputTorqueSign:1};
  const lock={...s.lock,active:lockActive,normalPocket,pocketIndex,pocketCenterLocal,pocketCenterWorld};
  const stage=s.limit.blocked?s.stage:active?(q.handoff?'finite-mouth-contact-handoff':'face-pin-radial-slot-index'):lockActive?'crescent-lock-dwell':'convex-terminal-sector-approaching-crescent-cusp';
  return{...s,stage,contactMode:stage,stopWheelAngle:q.angle,stopWheelAngularSpeed:q.speed*s.inputAngularSpeed,stopWheelAngularAcceleration:q.speed*s.inputAngularAcceleration+q.acceleration*s.inputAngularSpeed**2,engagement,lock};
 };
 d.stopWheelAngleAtInputTravel=u=>law(u).angle;
 d.engagementAtInputTravel=u=>d.stateAtInputTravel(u).engagement;
 d.stateAtTime=t=>{const s=source.stateAtTime(t);return{...s,...d.stateAtInputTravel(s.inputTravel,s.inputAngularSpeed,s.inputAngularAcceleration)};};
 d.canonicalStates=Object.fromEntries(Object.entries(d.canonicalTimes).map(([key,t])=>[key,d.stateAtTime(t)]));
 d.geometry.workingStopWheelRegions=raw.regions;
 const old=b.stopWheelBody.geometry;b.stopWheelBody.geometry=plate(raw.regions,-g.stopWheelDepth/2,g.stopWheelDepth/2);old.dispose();
 const pin=b.facePin.geometry,pinParameters=pin.parameters;b.facePin.geometry=new T.CylinderGeometry(pinParameters.radiusTop,pinParameters.radiusBottom,pinParameters.height,256);pin.dispose();
 d.reconstructionNote='The relieved slot mouths and baked contact branch remove the handoff collision while preserving the interior load faces and terminal stops. A positive output-contact bias selects the branch; reverse playback requires assisting preload. Input motion, impact, friction and loading remain prescribed. Final lock capture is within the 0.000022 profile tolerance.';
 d.sourceAnimation.runtimeReconstructsFiniteMouthHandoffs=true;
 // Brown draws the first index half done: the pin on the line of centres
 // inside the left slot, the crescent's mouth facing the wheel. The display
 // loop opens there; state queries keep phase time.
 {let low=0,high=d.canonicalTimes.firstIndexComplete;for(let i=0;i<80;i++){const mid=(low+high)/2;if(d.stateAtTime(mid).inputTravel<step/2)low=mid;else high=mid;}
  d.canonicalTimes.platePose=(low+high)/2;d.canonicalStates.platePose=d.stateAtTime(d.canonicalTimes.platePose);d.displayTimeOffset=d.canonicalTimes.platePose;}
 model.update=displayTime=>{const t=displayTime+d.displayTimeOffset;oldUpdate(t);const s=d.stateAtTime(t);for(const part of[b.stopWheel,b.stopWheelShaft]){part.userData.rotor.rotation.z=s.stopWheelAngle;part.userData.angularSpeed=s.stopWheelAngularSpeed;}d.contacts={convexTerminalSector:s.limit.stopContact,crescentLockingPocket:s.lock.active?s.lock:null,facePinSlot:s.engagement.active?s.engagement:null};d.kinematics=s;};
 model.update(0);return model;
}
