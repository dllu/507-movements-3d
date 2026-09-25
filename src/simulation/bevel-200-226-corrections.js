import * as THREE from 'three';
import {bevelToothGeometry,bevelBodyGeometry} from './bevel-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {makeShaft,makeBeam,matte,PALETTE,setSpin,markShadows} from './primitives.js';
const turn=2*Math.PI,replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
function ring(inner,outer,low,high){return boredLatheGeometry([{radial:outer,axial:low},{radial:outer,axial:high}],inner,64).rotateX(Math.PI/2);}
function refine(gear,{height=.22,bore,hubLow,hubHigh,hubOuter,thickness=.96}={}){
 const u=gear.userData,raw=bevelToothGeometry({teeth:u.teeth,innerDistance:u.innerDistance,outerDistance:u.outerDistance,pitchConeAngle:u.pitchConeAngle,toothHeight:height,toothThicknessFactor:thickness,flankSegments:18,tipSegments:8});
 replace(u.body,bevelBodyGeometry(raw,bore));const old=u.toothMeshes[0].geometry;for(const tooth of u.toothMeshes)tooth.geometry=raw;old.dispose();
 replace(u.hub,ring(bore,hubOuter,hubLow,hubHigh));u.hub.position.set(0,0,0);u.hub.rotation.set(0,0,0);
 u.inset.position.z=raw.userData.root.z+.018;u.inset.visible=false;u.inset.userData.retiredInkOutline=true;u.indicator.position.z=raw.userData.root.z+.035;
 Object.assign(u,{boreRadius:bore,toothHeight:raw.userData.height,hubLow,hubHigh,hubOuter,toothThicknessFactor:thickness});
}
function finish(root,note,period){root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=period;root.userData.reconstructionNote=note;root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});markShadows(root);}
// A single tilted cone can mesh with opposite, unequal coaxial wheels.
// sin(tilt)=(Nu-Nl)/(2Nd), tan(delta)=2Nd*cos(tilt)/(Nu+Nl).
// All three share one apex and one outer cone distance, hence equal module.
export function singleInclinedTwoSpeedBevel(makeGear){
 const root=new THREE.Group(),nd=24,nu=48,nl=32,r=.8,tilt=Math.asin((nu-nl)/(2*nd)),delta=Math.atan(2*nd*Math.cos(tilt)/(nu+nl)),upperCone=Math.PI/2+tilt-delta,lowerCone=Math.PI/2-tilt-delta,R=r/Math.sin(delta),fraction=.8;
 const inputAxis=new THREE.Vector3(Math.cos(tilt),-Math.sin(tilt),0),up=new THREE.Vector3(0,1,0),down=up.clone().negate(),radialUp=new THREE.Vector3(Math.sin(tilt),Math.cos(tilt),0);
 const make=(axis,teeth,cone,color,bore,role)=>{const outer=R*Math.cos(cone),inner=outer*fraction,gear=makeGear({axis,teeth,pitchConeAngle:cone,innerDistance:inner,outerDistance:outer,toothHeight:.14,boreRadius:bore,color});gear.userData.role=role;refine(gear,{height:.14,bore,hubLow:Math.max(.14,inner-.04),hubHigh:outer+.18,hubOuter:bore+.105,thickness:.98});return gear;};
 const driver=make(inputAxis,nd,delta,PALETTE.driver,.107,'single-inclined-driving-bevel'),upperOutput=make(up,nu,upperCone,PALETTE.driven,.117,'large-upper-loose-output'),lowerOutput=make(down,nl,lowerCone,PALETTE.driven,.117,'small-lower-loose-output');
 upperOutput.userData.looseOnCommonSpindle=lowerOutput.userData.looseOnCommonSpindle=true;
 const inputShaft=makeShaft({axis:inputAxis,length:2.7,radius:.105,color:PALETTE.ink});inputShaft.position.copy(inputAxis).multiplyScalar(1.75);
 const commonSpindle=makeShaft({axis:up,length:3.4,radius:.115,color:PALETTE.ink});commonSpindle.position.y=-.4;commonSpindle.userData.stationary=true;
 root.add(driver,upperOutput,lowerOutput,inputShaft,commonSpindle);
 const upperContactPoint=inputAxis.clone().multiplyScalar(Math.cos(delta)).addScaledVector(radialUp,Math.sin(delta)).multiplyScalar(R*(1+fraction)/2),lowerContactPoint=inputAxis.clone().multiplyScalar(Math.cos(delta)).addScaledVector(radialUp,-Math.sin(delta)).multiplyScalar(R*(1+fraction)/2);
 const angle=(gear,point)=>{const p=point.clone().applyQuaternion(gear.quaternion.clone().invert());return Math.atan2(p.y,p.x);};
 const inputPhase=angle(driver,upperContactPoint),upperPhase=angle(upperOutput,upperContactPoint)-Math.PI/nu,lowerPhase=angle(lowerOutput,lowerContactPoint)-Math.PI/nl,inputAngularSpeed=1.08,inputCyclePeriod=turn/inputAngularSpeed;
 const stateAtTime=time=>{const inputAngle=inputPhase+inputAngularSpeed*time,upperOutputAngle=upperPhase-inputAngularSpeed*nd/nu*time,lowerOutputAngle=lowerPhase-inputAngularSpeed*nd/nl*time;return{inputAngle,upperOutputAngle,lowerOutputAngle,inputAngularSpeed,upperOutputAngularSpeed:-inputAngularSpeed*nd/nu,lowerOutputAngularSpeed:-inputAngularSpeed*nd/nl,upperPhysicalAngularSpeed:-inputAngularSpeed*nd/nu,lowerPhysicalAngularSpeed:inputAngularSpeed*nd/nl,spindleAngularSpeed:0};};
 Object.assign(root.userData,{archetype:'compound-bevel-driver-coaxial-loose-differential-speed-wheels',mechanism:'single-inclined-bevel-drives-two-unequal-loose-coaxial-wheels',blocks:{driver,upperOutput,lowerOutput,inputShaft,commonSpindle},geometry:{driverTeeth:nd,upperOutputTeeth:nu,lowerOutputTeeth:nl,inputAxis,upperOutputAxis:up,lowerOutputAxis:down,tilt,driverPitchConeAngle:delta,upperOutputPitchConeAngle:upperCone,lowerOutputPitchConeAngle:lowerCone,coneDistance:R,faceInnerFraction:fraction,upperContactPoint,lowerContactPoint,inputPhase,upperPhase,lowerPhase},transmission:{inputCyclePeriod,inputToUpperPhysicalRatio:-nd/nu,inputToLowerPhysicalRatio:nd/nl,looseOutputWheelCount:2,rigidDriverSectionCount:1,simultaneousMeshCount:2,stationaryCommonSpindle:true},stateAtTime,canonicalTimes:{oneInputTurn:inputCyclePeriod,commonFourTurnPose:4*inputCyclePeriod},sourceAnimation:{available:false,sourceUrl:'https://507movements.com/mm_200.html',reason:'The official animation is unavailable.'}});
 const update=time=>{const s=stateAtTime(time);setSpin(driver,s.inputAngle);setSpin(inputShaft,s.inputAngle);setSpin(upperOutput,s.upperOutputAngle);setSpin(lowerOutput,s.lowerOutputAngle);root.userData.kinematics=s;};
 finish(root,'One inclined driving wheel meshes with two loose wheels on the same stationary spindle. The outputs turn oppositely at one-half and three-quarters input speed. Tooth counts and the resulting shaft inclination are reconstructed.',12);
 root.userData.fidelity='authored';update(0);return{root,update,cameraDirection:new THREE.Vector3(1.5,1.2,12)};
}
export function correctSixBevelTrain(root){
 const b=root.userData.blocks;
 for(const[gear,bore,outer]of[[b.inputGearB,.092,.17],[b.shaftGearF,.080,.17],[b.hollowDriveGear,.170,.27],[b.sideGearC,.170,.27],[b.planetGearD,.068,.17],[b.outputGearE,.172,.27]])refine(gear,{bore,hubLow:.74,hubHigh:1.16,hubOuter:outer,thickness:.985});
 root.traverse(o=>{
  if(o.userData.role==='visible-index-on-hollow-shaft-C'){replace(o,new THREE.BoxGeometry(.065,.23,.04));o.position.y=.295;}
  if(o.userData.role==='three-times-speed-output-index'){replace(o,new THREE.BoxGeometry(.055,.38,.045));o.position.y=.375;}
  const r={'right-fixed-bearing-for-shaft-F':.080,'left-fixed-bearing-around-output-E-and-shaft-F':.172,'upper-fixed-bearing-for-input-shaft-B':.092}[o.userData.role];if(r){replace(o,ring(r,.292,-.057,.057));o.userData.boreRadius=r;}
 });
 const collar=new THREE.Mesh(ring(.076,.13,-.025,.025),matte(PALETTE.frame));collar.rotation.y=Math.PI/2;collar.position.x=-3.47;collar.userData.role='carrier-fixed-shaft-collar';
 const spoke=makeBeam(new THREE.Vector3(-3.47,0,-.1),new THREE.Vector3(-3.47,0,-1.3),{color:PALETTE.frame,thickness:.05,depth:.08}),tie=makeBeam(new THREE.Vector3(-3.47,0,-1.3),new THREE.Vector3(root.userData.geometry.frameLeftX,0,-1.3),{color:PALETTE.frame,thickness:.05,depth:.08});
 b.carrierAssembly.add(collar,spoke,tie);b.carrierShaftConnection=[collar,spoke,tie];
 finish(root,'The six equal gears make F and C counterrotate. The carrier fixed to F then drives E at three times input speed; the caption’s stated doubling conflicts with these gear constraints. Hidden journal supports and tooth sections are reconstructed.',12);
}
