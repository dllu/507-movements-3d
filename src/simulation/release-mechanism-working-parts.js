import * as THREE from 'three';
import {circle, poly, plate, capsule, ring, polygonClipping as clip} from './finite-plate-geometry.js';
import {markShadows} from './primitives.js';
const rectangle=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
function replaceGroup(group,geometry){const material=group.children[0].material;for(const c of [...group.children]){c.geometry?.dispose();group.remove(c);}const mesh=new THREE.Mesh(geometry,material);group.add(mesh);return mesh;}
function arm(a,b,width,eye,bore,depth){return plate(clip.difference(clip.union(capsule(a,b,width/2,24),poly(circle(a,eye,64))),poly(circle(a,bore,64))),-depth/2,depth/2);}
function finish(model,note,period){const d=model.root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=period;d.reconstructionNote=note;model.root.traverse(o=>{if(o.isMesh)for(const m of[].concat(o.material))m.fog=false;});markShadows(model.root);return model;}

export function finishSounding247Parts(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,old=model.update;
 const upper=b.catchAssembly.children.find(o=>o.userData.role==='probe-driven-upper-bell-crank-arm');
 const lower=b.catchAssembly.children.find(o=>o.userData.role==='lower-weight-releasing-catch-arm');
 const upperPlate=replaceGroup(upper,plate(clip.difference(clip.union(capsule([0,0],g.upperContactLocal.toArray(),.065,32),poly(circle([0,0],.19,64))),poly(circle([0,0],.154,64)),poly(circle(g.upperContactLocal.toArray(),.022,64))),-.07,.07));
 const lowerPlate=replaceGroup(lower,arm([0,0],[.35,-.78],.13,.19,.154,.14));
 b.catchAssembly.position.z=0;b.probeAssembly.position.z=-.25;b.pivotPin.position.z=0;b.detentSpring.position.z=-.25;
 // Widen only the contact pad in X to retain the moving rounded arm end.
 replace(b.probePusher,new THREE.BoxGeometry(.59,.12,.12));b.probePusher.position.x=-.155;b.probePusher.position.y-=.065;b.probePusher.position.z+=.14;
 const roller=new THREE.Mesh(ring(.022,.065,.10,.18,128),b.catchNose.material);roller.position.set(g.upperContactLocal.x,g.upperContactLocal.y,0);b.catchAssembly.add(roller);
 const axle=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.27,24),b.pivotPin.material);axle.rotation.x=Math.PI/2;axle.position.set(g.upperContactLocal.x,g.upperContactLocal.y,.055);b.catchAssembly.add(axle);
 const bridge=new THREE.Mesh(new THREE.BoxGeometry(.10,.07,.18),b.probePusher.material);bridge.position.set(b.probeShaft.position.x,b.probePusher.position.y-.02,.30);b.probeAssembly.add(bridge);
 replace(b.catchNose,plate(capsule([.30,-.84],g.catchSupportLocal.toArray(),.025,64),-.05,.05));
 const bore=[b.probeShaft.position.x,b.probeShaft.position.z+b.probeAssembly.position.z-b.lowerGuideBlock.position.z];
 const guide=plate(clip.difference(clip.union(rectangle(-.34,-.34,.34,.34),poly(circle(bore,.092,64))),poly(circle(bore,.060,64))),-.21,.21);guide.rotateX(Math.PI/2);replace(b.lowerGuideBlock,guide);
 b.catchIndex.visible=false;
 d.releaseWorkingParts={upperPlate,lowerPlate,guide:b.lowerGuideBlock,probeBoreRadius:.060,roller,axle,bridge};
 model.update=time=>{old(time);const contact=d.contacts.probeToBellCrank;contact.contactPoint.y-=.065;contact.contactPoint.z=.14;};
 model.update(0);
 model=finishSounding247Seat(model);
 return finish(model,'The probe guide and catch journal have real passages, and the finite probe pad supports the rounded upper arm. A rounded finite nose supports the bored weight; after seabed contact, weight release occurs at zero vertical support force and inherits the support velocity. Depth offsets, guided descent/recovery, detent force, friction and loaded impacts remain prescribed, not dynamically validated.',8);
}

export function finishOtis278Parts(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,old=model.update,parts={leverPlates:[],pawlPlates:[]};
 const levels=[.14,.46];
 for(const [i,side]of['left','right'].entries()){
  const lever=b[side+'Lever'],upper=b[side+'UpperArm'],lower=b[side+'LowerArm'],sign=i?-1:1;
  const lowerEnd=new THREE.Vector2(sign*g.lowerArmLength*Math.cos(g.elbowAngle),g.lowerArmLength*Math.sin(g.elbowAngle));
  const upperPlate=replaceGroup(upper,arm([0,0],[sign*1.58,0],.17,.18,.134,.14));
  const lowerOutline=clip.union(capsule([0,0],lowerEnd.toArray(),.095,24),poly(circle([0,0],.18,64)),poly(circle(lowerEnd.toArray(),.15,64)));
  const lowerPlate=replaceGroup(lower,plate(clip.difference(lowerOutline,poly(circle([0,0],.134,64)),poly(circle(lowerEnd.toArray(),.109,64))),-.07,.07));
  lever.position.z=levels[i];parts.leverPlates.push(upperPlate,lowerPlate);
  const pawl=b[side+'Pawl'],shape=clip.union(rectangle(0,-.09,g.pawlLength,.09),poly(circle([0,0],.145,64)));
  const mesh=replaceGroup(pawl,plate(clip.difference(shape,poly(circle([0,0],.109,64))),-.07,.07));
  pawl.userData.setEndpoints=(a,z)=>{mesh.position.copy(a);mesh.rotation.z=Math.atan2(z.y-a.y,z.x-a.x);};parts.pawlPlates.push(mesh);
 }
 // Two separate through-slots enclose the crossing arms. Plate coordinates
 // (Y,Z) are extruded across X; the connecting bridge is outside both slots.
 let eye=rectangle(-.18,-.40,.18,.115);
 for(const z of levels)eye=clip.difference(eye,rectangle(-.125,z-.44-.078,.125,z-.44+.078));
 const eyeGeometry=plate(eye,-.17,.17);eyeGeometry.applyMatrix4(new THREE.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1));replace(b.slidingEye,eyeGeometry);
 b.verticalPin.userData.setEndpoints(new THREE.Vector3(0,.175,0),new THREE.Vector3(0,g.ropeEyeOffset,0));
 for(const tooth of b.rackTeeth){const shape=tooth.geometry.parameters.shapes,points=shape.extractPoints(1).shape.map(p=>[p.x,p.y>.019?0:p.y]);replace(tooth,plate(poly(points),-.23,.23));}
 for(const o of [...b.pawlTips,...b.catchMarkers])o.visible=false;
 d.releaseWorkingParts=parts;d.releaseWorkingParts.eye=b.slidingEye;d.releaseWorkingParts.layerCenters=levels;
 model.update=time=>{old(time);for(const o of [...b.pawlTips,...b.catchMarkers])o.visible=false;};model.update(0);
 model.cameraDirection=new THREE.Vector3(.8,1.5,15);
 return finish(model,'The source arrested pose starts after rope failure. Separate elbow-lever layers pass through real eye slots; bored joints connect finite flat pawls to the hook-rack seats. Eye running clearance, spring motion, manual reset and loaded arrest are prescribed, not force-simulated.',8);
}


function finishSounding247Seat(model){
 const d=model.root.userData,g=d.geometry,b=d.blocks,source=d.stateAtTime,old=model.update,r=.025,zMax=.05,bore=g.boreRadius*Math.cos(b.weightShell.geometry.parameters.phiLength/(2*b.weightShell.geometry.parameters.segments))-.000005;
 const center=a=>new THREE.Vector2(g.catchSupportLocal.x*Math.cos(a)-g.catchSupportLocal.y*Math.sin(a)+g.pivot.x,g.catchSupportLocal.x*Math.sin(a)+g.catchSupportLocal.y*Math.cos(a)+g.pivot.y);
 const support=(a,details=false)=>{const end=center(a),start=new THREE.Vector2(.30*Math.cos(a)+.84*Math.sin(a)+g.pivot.x,.30*Math.sin(a)-.84*Math.cos(a)+g.pivot.y),slope=(end.y-start.y)/(end.x-start.x);
  const xs=[start.x,end.x];for(const z of[0,zMax]){const R=Math.sqrt(g.weightOuterRadius**2-z*z),inner=Math.sqrt(bore**2-z*z),factor=slope/Math.sqrt(1+slope*slope);xs.push(THREE.MathUtils.clamp((R+r)*factor,start.x,end.x),THREE.MathUtils.clamp(inner+r*factor,start.x,end.x));}
  let height=-Infinity,point;for(const cx of xs){const cy=start.y+slope*(cx-start.x);for(const z of[0,zMax,Math.min(zMax,Math.sqrt(Math.max(0,bore**2-cx**2)))]){const R=Math.sqrt(g.weightOuterRadius**2-z*z),inner=Math.sqrt(bore**2-z*z),x=Math.max(inner,cx*R/(R+r));if(x<=cx+r+1e-12){const y=cy+Math.sqrt(Math.max(0,r*r-(x-cx)**2)),h=y+Math.sqrt(g.weightOuterRadius**2-x*x-z*z);if(h>height){height=h;point=new THREE.Vector3(x,y,z);}}}}return details?{height,point}:height;};

 // The source lowering/recovery is prescribed. After the probe touches the
 // bed, use unilateral vertical support: release when its normal force vanishes.
 const envelope=t=>{const s=source(t);return s.bodyPositionY+support(s.catchAngle);};
 const dh=1e-4,acceleration=t=>(envelope(t+dh)-2*envelope(t)+envelope(t-dh))/(dh*dh),gravity=g.modelGravity;
 let lo=d.timeline.supportRelease,hi=d.timeline.catchFullyRetracted;
 for(let i=0;i<48;i++){const mid=(lo+hi)/2,p=center(source(mid).catchAngle);if(Math.hypot(p.x+r,zMax)>bore)lo=mid;else hi=mid;}
 const geometricWithdrawal=(lo+hi)/2;
 lo=d.timeline.seabedContact;hi=lo;
 while(hi<geometricWithdrawal-dh&&acceleration(hi)>=-gravity){lo=hi;hi+=.001;}
 for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(acceleration(mid)>=-gravity)lo=mid;else hi=mid;}
 const nominalSeat=g.pivot.y+g.catchSupportLocal.y+g.weightOpeningHalfHeight,seatOffset=support(0)-nominalSeat,dropStart=d.timeline.rodRecovered,dropSpan=d.timeline.weightSeated-dropStart,release=(lo+hi)/2,releaseHeight=envelope(release),releaseVelocity=(envelope(release+dh)-envelope(release-dh))/(2*dh),ground=g.weightOpeningHalfHeight;
 const impact=release+(releaseVelocity+Math.sqrt(releaseVelocity**2+2*gravity*(releaseHeight-ground)))/gravity;
 function centerY(time){const s=source(time),t=s.cycleTime;
  if(t<release)return s.bodyPositionY+support(s.catchAngle);
  if(t<impact-1e-12)return Math.max(ground,releaseHeight+releaseVelocity*(t-release)-.5*gravity*(t-release)**2);
  if(t<d.timeline.rodRecovered)return ground;
  // The fresh weight runs down the line onto the reset catch; its run is
  // shifted progressively so that it ends on the finite seat.
  if(t<dropStart)return s.weightCenterY;
  if(t<d.timeline.weightSeated)return s.weightCenterY+seatOffset*(t-dropStart)/dropSpan;
  return envelope(time);
 }
 d.nominalKinematics247={stateAtTime:source,stateAtCyclePhase:d.stateAtCyclePhase,timeline:{...d.timeline},geometry:{...g}};
 d.finiteSeat247={noseRadius:r,noseHalfDepth:zMax,conservativeBoreRadius:bore,releaseTime:release,releaseHeight,releaseVelocity,geometricWithdrawal,impactTime:impact,fallGravity:gravity,supportHeight:support,sourceGravity:g.modelGravity,forceSolved:false};
 d.stateAtTime=time=>{const s=source(time),t=s.cycleTime,y=centerY(time);let v,acc;
  if(t<release){v=(envelope(time+dh)-envelope(time-dh))/(2*dh);acc=acceleration(time);}
  else if(t<impact){v=releaseVelocity-gravity*(t-release);acc=-gravity;}
  else if(t<d.timeline.rodRecovered){v=0;acc=0;}
  else if(t<dropStart){v=s.weightVelocity;acc=s.weightAcceleration;}
  else if(t<d.timeline.weightSeated){v=s.weightVelocity+seatOffset/dropSpan;acc=s.weightAcceleration;}
  else{v=s.bodyVelocity;acc=s.bodyAcceleration;}
  const active=t<release||t>=d.timeline.weightSeated,p=center(s.catchAngle),overlap=Math.hypot(p.x+r,zMax)-bore;return{...s,supportOverlap:overlap,supportRadialClearance:-overlap,supportRadialReach:bore+overlap,weightOnSeabed:t>=impact&&t<d.timeline.rodRecovered,weightCenterY:y,weightLowerOpeningY:y-g.weightOpeningHalfHeight,weightUpperOpeningY:y+g.weightOpeningHalfHeight,weightVelocity:v,weightAcceleration:acc,catchSupportPosition:s.catchSupportPosition.clone().setZ(0),catchToWeightContactActive:active,finiteSeatActive:active,finiteSeatReleaseTime:release,stage:t>=release&&t<impact?'weight-free-fall':t>=d.nominalKinematics247.timeline.supportRelease&&t<release?'finite-nose-withdrawing-before-release':s.stage};};

 d.stateAtCyclePhase=q=>d.stateAtTime(q*d.timeline.cycleClosure);
 model.update=time=>{old(time);const s=d.stateAtTime(time);b.weightAssembly.position.y=s.weightCenterY;d.kinematics=s;const seat=s.finiteSeatActive?support(s.catchAngle,true):null;d.contacts.catchToWeight={active:s.finiteSeatActive,nominalPointSuperseded:true,supportEnvelopeHeight:s.weightCenterY,supportPoint:seat?.point.clone().add(new THREE.Vector3(0,s.bodyPositionY,0))??null};d.contacts.weightToSeabed={active:s.weightOnSeabed,gap:s.weightLowerOpeningY,impactSpeed:gravity*(impact-release)-releaseVelocity};};
 d.timeline.nominalSupportRelease=d.timeline.supportRelease;d.timeline.supportRelease=release;d.timeline.nominalWeightImpact=d.timeline.weightImpact;d.timeline.weightImpact=impact;
 d.dynamics={forceSolved:false,unilateralVerticalRelease:true,releaseVelocityContinuous:true,releaseAccelerationContinuous:true,prescribedDescentAndRecovery:true,loadedImpactSolved:false};
 d.canonicalStates={...d.canonicalStates,loaded:d.stateAtTime(0),release:d.stateAtTime(release),impact:d.stateAtTime(impact),recovered:d.stateAtTime(d.timeline.rodRecovered)};
 model.update(0);return model;
}
