import * as THREE from 'three';
import {splitRim213Contact as bake} from './baked/split-rim-213-contact.js';
import { markShadows } from './primitives.js';
import {nearest390Outline} from './dual-band-pawl-contact.js';
const TAU=2*Math.PI,step=TAU/bake.steps;
const slopes=new Map([bake.angles,bake.firstAngles,bake.reverseAngles,bake.repeatReverseAngles].map(values=>[values,values.map((v,i)=>{
 if(i===0||i===bake.steps)return 0;const a=(v-values[i-1])/step,b=(values[i+1]-v)/step;return a*b>0?2*a*b/(a+b):0;
})]));
export function splitRim213Motion(input,pitch,reverse=false){
 const turn=Math.floor(Math.max(0,input)/TAU);
 if(turn>=5)return{angle:bake.initialAngle-5*pitch,derivative:0,secondDerivative:0};
 const values=reverse?(turn===4?bake.reverseAngles:bake.repeatReverseAngles):(turn===0?bake.firstAngles:bake.angles);
 const x=(input-turn*TAU)/step,i=Math.min(bake.steps-1,Math.max(0,Math.floor(x))),t=x-i,a=values[i],b=values[i+1],u=slopes.get(values)[i]*step,v=slopes.get(values)[i+1]*step;
 return{angle:(2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*u+(-2*t**3+3*t*t)*b+(t**3-t*t)*v-turn*pitch,
 derivative:((6*t*t-6*t)*a+(3*t*t-4*t+1)*u+(-6*t*t+6*t)*b+(3*t*t-2*t)*v)/step,
 secondDerivative:((12*t-6)*a+(6*t-4)*u+(-12*t+6)*b+(6*t-2)*v)/(step*step)};
}
export function finishSplitRim213(root,legacyUpdate){
 const d=root.userData,b=d.blocks,g=d.geometry,legacyState=d.stateAtInputTravel;
 // Brown cuts the split as a narrow parallel-sided slot from the rim to the
 // inner circle. The baked contact outline keeps its wedge (the pin never
 // reaches it); the displayed ring trims the wedge to a constant-width slot.
 const slotHalfWidth=.13,outerR=Math.hypot(...bake.outline[0]),innerR=Math.hypot(...bake.outline.at(-1)),
  arc=(r,a0,a1,n)=>Array.from({length:n+1},(_,i)=>{const a=a0+(a1-a0)*i/n;return[r*Math.cos(a),r*Math.sin(a)];}),
  outerHalf=Math.asin(slotHalfWidth/outerR),innerHalf=Math.asin(slotHalfWidth/innerR),
  bakedOuter=bake.outline.slice(0,bake.outline.length-bake.outline.slice().reverse().findIndex(q=>Math.abs(Math.hypot(...q)-outerR)<1e-6)),
  startAngle=Math.atan2(bakedOuter[0][1],bakedOuter[0][0]),endAngle=Math.atan2(bakedOuter.at(-1)[1],bakedOuter.at(-1)[0]),
  displayOutline=[...arc(outerR,Math.PI/2+outerHalf,startAngle,6).slice(0,-1),...bakedOuter,...arc(outerR,endAngle,Math.PI/2-outerHalf,6).slice(1),
   ...arc(innerR,Math.PI/2-innerHalf,Math.PI/2+innerHalf-2*Math.PI,512)];
 const shape=new THREE.Shape(displayOutline.map(p=>new THREE.Vector2(...p)));
 b.stopWheelBody.geometry.dispose();b.stopWheelBody.geometry=new THREE.ExtrudeGeometry(shape,{depth:g.stopWheelDepth,bevelEnabled:false,steps:1,curveSegments:1}).translate(0,0,-g.stopWheelDepth/2);
 b.facePin.geometry.dispose();b.facePin.geometry=new THREE.CylinderGeometry(g.facePinRadius,g.facePinRadius,.9,128);
 b.stopWheelOutline.visible=false;for(const part of [...b.stopToothHighlights,...b.stopShoulderHighlights])part.visible=false;
 g.stopRingOutline=bake.outline.map(p=>new THREE.Vector2(...p));g.stopOuterProfile=bake.outer.map(p=>new THREE.Vector2(...p));
 g.initialStopWheelAngle=bake.reverseAngles[0];g.finalStopWheelAngle=bake.initialAngle-5*g.stopPitchAngle;
 g.finiteToothRadiusRange=bake.regularRadiusRange;g.reversalTakeup=bake.initialAngle-bake.reverseAngles[0];
 const contact=(pin,angle)=>{
  const p=pin.clone().sub(g.stopWheelCenter).rotateAround(new THREE.Vector2(),-angle),hit=nearest390Outline(p.toArray(),bake.outline),normal=new THREE.Vector2(p.x-hit.point[0],p.y-hit.point[1]).normalize(),point=new THREE.Vector2(...hit.point);
  const moment=-(point.x*normal.y-point.y*normal.x);
  return{gap:hit.distance-g.facePinRadius,moment,normal:normal.rotateAround(new THREE.Vector2(),angle),point:point.rotateAround(new THREE.Vector2(),angle).add(g.stopWheelCenter)};
 };
 d.finiteContactAt=contact;
 d.stateAtInputTravel=(input,speed=0,acceleration=0)=>{
  const state=legacyState(input,speed,acceleration),motion=splitRim213Motion(state.inputTravel,g.stopPitchAngle,speed<0),hit=contact(state.engagement.pinCenter,motion.angle);
  const active=Math.abs(motion.derivative)>1e-8;
  state.stopWheelAngle=motion.angle;state.stopWheelAngularSpeed=motion.derivative*state.driverAngularSpeed;state.stopWheelAngularAcceleration=motion.derivative*state.driverAngularAcceleration+motion.secondDerivative*state.driverAngularSpeed**2;
  state.engagement={...state.engagement,active,outputProgress:Math.max(0,Math.min(1,(bake.initialAngle-state.completedIndexes*g.stopPitchAngle-motion.angle)/g.stopPitchAngle)),contactPoint:hit.point,normal:hit.normal,clearance:hit.gap,outputMomentArm:hit.moment,instantaneousRatio:motion.derivative};
  state.frictionRetention.active=!active;state.finiteContact=hit;
  return state;
 };
 d.stateAtTime=time=>{const input=d.inputStateAtTime(time);return{...d.stateAtInputTravel(input.angle,input.angularSpeed,input.angularAcceleration),demonstrationDirection:input.direction,phaseTime:input.phaseTime,time,timelineSegment:input.timelineSegment};};
 d.stopWheelAngleAtInputTravel=(input,reverse=false)=>splitRim213Motion(Math.max(0,Math.min(input,g.forwardInputLimit)),g.stopPitchAngle,reverse).angle;
 d.transmission.outputTravelAngle=g.initialStopWheelAngle-g.finalStopWheelAngle;d.transmission.reversalTakeup=g.reversalTakeup;
 d.canonicalStates=Object.fromEntries(Object.entries(d.canonicalTimes).map(([key,time])=>[key,d.stateAtTime(time)]));
 d.minimumDisplayCycleSeconds=18;d.hideGround=true;d.cameraFov=8;
 d.reconstructionNote='The full pin follows separately baked clockwise and reverse retaining branches of a finite five-tooth profile. The reconstructed teeth are shorter than the first tracing (tip radius 1.870 versus 2.124). Reversal takes up 0.00109 radians before indexing; later turns advance one pitch. The split rim and both terminal stops remain. Contact geometry and continuity are checked; spring friction, impacts and load capacity are not dynamically solved.';
 root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
 // The display loop opens at Brown's pose (third index in progress, slot at the
 // top, the pin between the middle teeth); state queries keep phase time.
 d.displayTimeOffset=d.canonicalTimes.sourcePose;
 // The static friction band reads as Brown's single inner circle, not a brass ring.
 b.frictionBand.material=b.frictionDrum.material;
 const update=displayTime=>{const time=displayTime+d.displayTimeOffset;legacyUpdate(time);const s=d.stateAtTime(time);b.stopWheel.userData.rotor.rotation.z=s.stopWheelAngle;b.stopWheel.userData.angularSpeed=s.stopWheelAngularSpeed;b.activeContactMarker.visible=s.engagement.active;if(s.engagement.active){b.activeContactMarker.position.x=s.engagement.contactPoint.x;b.activeContactMarker.position.y=s.engagement.contactPoint.y;}d.contacts.facePinTooth=s.engagement.active?s.engagement:null;d.kinematics=s;};
 markShadows(root);d.fidelity='authored';update(0);return{root,update,cameraDirection:new THREE.Vector3(.2,.15,15)};
}
