import * as THREE from 'three';
import {bevelToothGeometry,bevelBodyGeometry} from './bevel-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {makeShaft,makeBeam,matte,PALETTE,setSpin,markShadows} from './primitives.js';
import {plate,poly,polygonClipping as clip} from './finite-plate-geometry.js';
import {applyRotationIndicator} from './rotation-indicator.js';
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
 // p93: Brown draws the two speeds on one shaft line: the upper wheel is
 // fast on a sleeve (the wider tube above it) and the lower wheel on the
 // inner shaft that runs through the sleeve and on past both ends. Each
 // turns with its wheel and carries the quadrant speed cue.
 const sleeveOuter=.2,sleeveTop=1.0;
 refine(upperOutput,{height:.14,bore:sleeveOuter+.006,hubLow:upperOutput.userData.hubLow,hubHigh:upperOutput.userData.hubHigh,hubOuter:sleeveOuter+.115,thickness:.98});
 upperOutput.userData.fastOnSleeve=true;lowerOutput.userData.fastOnInnerShaft=true;
 const inputShaft=makeShaft({axis:inputAxis,length:2.7,radius:.105,color:PALETTE.ink});inputShaft.position.copy(inputAxis).multiplyScalar(1.75);
 const commonSpindle=makeShaft({axis:down,length:3.4,radius:.115,color:PALETTE.ink});commonSpindle.position.y=-.4;
 commonSpindle.userData.role='inner-shaft-fast-to-lower-wheel';
 const sleeve=makeShaft({axis:up,length:.1,radius:.1,color:PALETTE.ink}),sleeveMesh=sleeve.userData.rotor.children[0];
 const sleeveLow=upperOutput.userData.hubLow+.01;
 replace(sleeveMesh,boredLatheGeometry([{radial:sleeveOuter,axial:sleeveLow},{radial:sleeveOuter,axial:sleeveTop}],.121,64));sleeveMesh.rotation.set(Math.PI/2,0,0);
 sleeve.userData.role='sleeve-fast-to-upper-wheel';
 // p106: the sleeve is fast to the toothed upper wheel, whose teeth already
 // show its speed; the quadrant cue on this short dark tube read as two flat
 // facets, so only the inner spindle (whose top shows above) keeps the cue.
 applyRotationIndicator(commonSpindle,{axis:'auto'});
 root.add(driver,upperOutput,lowerOutput,inputShaft,commonSpindle,sleeve);
 const upperContactPoint=inputAxis.clone().multiplyScalar(Math.cos(delta)).addScaledVector(radialUp,Math.sin(delta)).multiplyScalar(R*(1+fraction)/2),lowerContactPoint=inputAxis.clone().multiplyScalar(Math.cos(delta)).addScaledVector(radialUp,-Math.sin(delta)).multiplyScalar(R*(1+fraction)/2);
 const angle=(gear,point)=>{const p=point.clone().applyQuaternion(gear.quaternion.clone().invert());return Math.atan2(p.y,p.x);};
 const inputPhase=angle(driver,upperContactPoint),upperPhase=angle(upperOutput,upperContactPoint)-Math.PI/nu,lowerPhase=angle(lowerOutput,lowerContactPoint)-Math.PI/nl,inputAngularSpeed=1.08,inputCyclePeriod=turn/inputAngularSpeed;
 const stateAtTime=time=>{const inputAngle=inputPhase+inputAngularSpeed*time,upperOutputAngle=upperPhase-inputAngularSpeed*nd/nu*time,lowerOutputAngle=lowerPhase-inputAngularSpeed*nd/nl*time;return{inputAngle,upperOutputAngle,lowerOutputAngle,inputAngularSpeed,upperOutputAngularSpeed:-inputAngularSpeed*nd/nu,lowerOutputAngularSpeed:-inputAngularSpeed*nd/nl,upperPhysicalAngularSpeed:-inputAngularSpeed*nd/nu,lowerPhysicalAngularSpeed:inputAngularSpeed*nd/nl,innerShaftAngularSpeed:-inputAngularSpeed*nd/nl,sleeveAngularSpeed:-inputAngularSpeed*nd/nu};};
 Object.assign(root.userData,{archetype:'compound-bevel-driver-coaxial-loose-differential-speed-wheels',mechanism:'single-inclined-bevel-drives-two-unequal-loose-coaxial-wheels',blocks:{driver,upperOutput,lowerOutput,inputShaft,commonSpindle,sleeve},geometry:{driverTeeth:nd,upperOutputTeeth:nu,lowerOutputTeeth:nl,inputAxis,upperOutputAxis:up,lowerOutputAxis:down,tilt,driverPitchConeAngle:delta,upperOutputPitchConeAngle:upperCone,lowerOutputPitchConeAngle:lowerCone,coneDistance:R,faceInnerFraction:fraction,upperContactPoint,lowerContactPoint,inputPhase,upperPhase,lowerPhase},transmission:{inputCyclePeriod,inputToUpperPhysicalRatio:-nd/nu,inputToLowerPhysicalRatio:nd/nl,looseOutputWheelCount:2,rigidDriverSectionCount:1,simultaneousMeshCount:2,sleeveAndInnerShaftOutputs:true},stateAtTime,canonicalTimes:{oneInputTurn:inputCyclePeriod,commonFourTurnPose:4*inputCyclePeriod},sourceAnimation:{available:false,sourceUrl:'https://507movements.com/mm_200.html',reason:'The official animation is unavailable.'}});
 const update=time=>{const s=stateAtTime(time);setSpin(driver,s.inputAngle);setSpin(inputShaft,s.inputAngle);setSpin(upperOutput,s.upperOutputAngle);setSpin(lowerOutput,s.lowerOutputAngle);setSpin(commonSpindle,s.lowerOutputAngle);setSpin(sleeve,s.upperOutputAngle);root.userData.kinematics=s;};
 finish(root,'One inclined driving wheel meshes with two wheels on one shaft line: the upper fast on a sleeve, the lower on the inner shaft running through it. The outputs turn oppositely at one-half and three-quarters input speed. Tooth counts and the resulting shaft inclination are reconstructed.',12);
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
 // Brown draws frame A as a broad flat rectangular frame (double outline, a
 // thin band about 0.26 wide) lying in the plate's plane round D, with F
 // running through its two end bars. p93: it had been built 1.3 behind F and
 // joined by bent rods, with an undrawn strut across D's face. Now it is one
 // flat frame centred on F (z 0): the right end bar is fast on F in a round
 // boss, the left one runs on E's sleeve in a bored boss, and D's stud stands
 // radially in a boss fast on F under D (a differential spider), so nothing
 // crosses D and nothing floats.
 const g=root.userData.geometry,band=.26,members=[];
 b.carrierAssembly.traverse(o=>{if(o.userData.role==='source-rectangular-carrier-frame-A-member')members.push(o);});
 if(members.length){
  const frameMaterial=matte(PALETTE.frame,{metalness:.12,roughness:.6}),half=.07;
  // The right bar keeps clear of hollow shaft C (which starts at x -0.974).
  const left=g.frameLeftX,right=-.985,top=g.frameTopY,bottom=g.frameBottomY;
  const shaftR=g.centralShaftRadius??.078;
  let sleeveR=.17;b.carrierAssembly.parent.traverse(o=>{if(o.userData.role==='loose-output-E-sleeve-around-F'&&o.userData.boreRadius)sleeveR=Math.max(sleeveR,.17);});
  const bosses=[{x0:left,x1:left+band,bore:sleeveR+.012,outer:.3,role:'frame-A-left-boss-running-on-E-sleeve'},{x0:right-band,x1:right,bore:shaftR+.002,outer:.2,role:'frame-A-right-boss-fast-on-F'}];
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  let outline=clip.difference(poly(rect(left,bottom,right,top)),poly(rect(left+band,bottom+band,right-band,top-band)));
  for(const boss of bosses){const cut=Math.sqrt(boss.outer**2-half**2)-.003;outline=clip.difference(outline,poly(rect(boss.x0-.01,-cut,boss.x1+.01,cut)));}
  const flatFrame=new THREE.Mesh(plate(outline,-half,half),frameMaterial);
  flatFrame.userData.role='broad-flat-rectangular-carrier-frame-A';flatFrame.userData.carrierFrameMember=true;
  for(const member of members)member.visible=false;
  b.carrierAssembly.add(flatFrame);b.flatFrameA=flatFrame;
  b.frameBossesA=bosses.map(({x0,x1,bore,outer,role})=>{
   const mesh=new THREE.Mesh(boredLatheGeometry([{radial:outer,axial:x0},{radial:outer,axial:x1}],bore,64).rotateZ(-Math.PI/2),frameMaterial);
   mesh.userData.role=role;mesh.userData.carrierFrameMember=true;b.carrierAssembly.add(mesh);return mesh;});
  // D's stud: radial from a boss fast on F directly under D.
  let axle=null,apexX=null;b.carrierAssembly.traverse(o=>{if(o.userData.role==='transverse-axle-for-carried-planet-D')axle=o;});
  if(axle){
   apexX=axle.position.x;const studLow=.1,studHigh=1.3,mesh=axle.userData.rotor?.children[0]??axle.children[0];
   replace(mesh,new THREE.CylinderGeometry(.066,.066,studHigh-studLow,22));axle.position.z=(studLow+studHigh)/2;
   const spider=new THREE.Mesh(boredLatheGeometry([{radial:.18,axial:apexX-.13},{radial:.18,axial:apexX+.13}],shaftR+.002,64).rotateZ(-Math.PI/2),frameMaterial);
   spider.userData.role='spider-boss-fast-on-F-carrying-D-stud';b.carrierAssembly.add(spider);b.spiderBossD=spider;
  }
  b.carrierAssembly.traverse(o=>{if(/^inferred-planet-journal-(cantilever|support)$/.test(o.userData.role??''))o.visible=false;});
  Object.assign(g,{flatFrameZ:0,flatFrameBand:band,flatFrameRightX:right});
 }
 finish(root,'The six equal gears make F and C counterrotate. The carrier fixed to F then drives E at three times input speed; the caption’s stated doubling conflicts with these gear constraints. Hidden journal supports and tooth sections are reconstructed.',12);
}
