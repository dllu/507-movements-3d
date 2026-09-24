import * as THREE from 'three';
import {createAuthoredSelectableCamMovement} from './authored-selectable-cams.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {hatchedSectionFace} from './section-hatch.js';

export function makeSelectableCamValve(){
 const model=createAuthoredSelectableCamMovement({id:150}),{root}=model,b=root.userData.blocks,g=root.userData.geometry;
 const legacyUpdate=model.update,legacyState=root.userData.stateAtTime;
 const guideX=g.sourceValvePinProjected.x,rodLength=g.sourceValvePinProjected.y-(g.sourceShaft.y-354)*g.sourceScale,pinDistance=rodLength-.13;
 // Fit the lever in the 0.06-unit gap beside the selected cam.
 const leverPlane=g.workingCamPlaneZ+g.camDepth/2+.03;
 g.leverPlaneZ=leverPlane;b.lever.position.z=leverPlane;
 b.followerRoller.root.position.z=g.workingCamPlaneZ-leverPlane;
 b.leverPivotPost.position.z=leverPlane-.25;
 const rodZ=leverPlane+.20;
 const withValve=state=>{
  const top=state.follower.outputPin.clone(),dx=guideX-top.x,drop=Math.sqrt(pinDistance**2-dx**2);
  if(!Number.isFinite(drop))throw new RangeError('Valve rod cannot reach its guide');
  const vx=state.follower.outputPinPerDriveRadian.x*state.driveAngularSpeed,vy=state.follower.outputPinPerDriveRadian.y*state.driveAngularSpeed;
  const bottom=new THREE.Vector2(guideX,top.y-drop),velocityY=vy-dx*vx/drop;
  const {outputSlotOffsetX,...follower}=state.follower;
  return {...state,valveStroke:undefined,follower:{...follower,sliderPosition:bottom.clone(),outputSliderPosition:bottom.clone(),outputVelocityY:velocityY,outputYPerDriveRadian:follower.outputPinPerDriveRadian.y-dx*follower.outputPinPerDriveRadian.x/drop},valve:{top,bottom,angle:Math.atan2(dx,drop),velocityY}};
 };
 const stateAtTime=time=>withValve(legacyState(time));
 const materials=Object.fromEntries(['driven','brass','ink','frame'].map(n=>{const m=matte(PALETTE[n],{roughness:.65,metalness:.15});m.fog=false;return[n,m];}));
 const parts={};
 const add=(name,geometry,parent,color)=>{const mesh=new THREE.Mesh(geometry,materials[color]);mesh.name=name;parent.add(mesh);parts[name]=mesh;return mesh;};
 // Dispose removed geometry only: its materials are shared by retained parts.
 const detachedMaterials=new Set();
 const remove=o=>{o.removeFromParent();o.traverse(p=>{p.geometry?.dispose();for(const m of [p.material].flat())if(m)detachedMaterials.add(m);});};
 for(const o of [b.valveSlider.root,b.valveGuide,b.leverBody,b.leverPivotFace,b.leverPivotRing,b.leverIndex,b.followerRoller.face,b.followerRoller.cap,b.followerRoller.index])remove(o);
 const retainedMaterials=new Set();root.traverse(o=>{for(const m of [o.material].flat())if(m)retainedMaterials.add(m);});
 for(const m of detachedMaterials)if(!retainedMaterials.has(m))m.dispose();
 const leverOutline=clip.union(poly([[0,-.14],[g.outputArmLength,-.14],[g.leverLength,-.075],[g.leverLength,.075],[g.outputArmLength,.14],[0,.14]]),poly(circle([0,0],.44,96)),poly(circle([g.outputArmLength,0],.23,96)),poly(circle([g.leverLength,0],.19,96)));
 const holes=clip.union(poly(circle([0,0],.264,96)),poly(circle([g.outputArmLength,0],.074,96)),poly(circle([g.leverLength,0],.094,96)));
 add('pinned-lever',plate(clip.difference(leverOutline,holes),-.015,.015),b.lever,'driven');
 b.fixedLeverPivotShaft.geometry.dispose();b.fixedLeverPivotShaft.geometry=new THREE.CylinderGeometry(.26,.26,.40,96);b.fixedLeverPivotShaft.position.z=leverPlane-.16;
 add('pivot-retainer',disk(.30,leverPlane+.04,leverPlane+.07,96).translate(g.leverPivot.x,g.leverPivot.y,0),b.fixedFrame,'ink');
 b.outputPin.geometry.dispose();b.outputPin.geometry=disk(.07,-.09,.29,96);b.outputPin.rotation.set(0,0,0);b.outputPin.position.z=0;b.outputPin.userData.role='ordinary-valve-rod-upper-pin';
 add('upper-pin-retainer',disk(.105,.29,.32,96).translate(g.outputArmLength,0,0),b.lever,'ink');
 b.followerRoller.tread.geometry.dispose();b.followerRoller.tread.geometry=ring(.094,g.rollerRadius,-g.rollerWidth/2,g.rollerWidth/2,96);b.followerRoller.tread.rotation.set(0,0,0);
 b.followerAxle.geometry.dispose();b.followerAxle.geometry=disk(.09,g.workingCamPlaneZ-leverPlane-.15,.017,96);b.followerAxle.rotation.set(0,0,0);b.followerAxle.position.z=0;
 add('roller-axle-retainer',disk(.13,.017,.027,96).translate(g.leverLength,0,0),b.lever,'brass');
 // Brown sections the shaft end nearest the viewer with parallel hatching.
 // Thin paper faces with ink section lines replace the dark ends; they turn
 // with the shaft and add no working surface.
 let shaft;root.traverse(o=>{if(o.userData.role==='long-keyed-shaft-through-sliding-cam-series')shaft=o;});
 for(const side of [-1,1]){
  // Source presentation turns the model end for end: local -Z faces the viewer.
  const face=hatchedSectionFace(shaft.geometry.parameters.radiusTop,{name:'hatched-shaft-end-'+(side<0?'front':'rear')});
  face.position.z=side*shaft.geometry.parameters.height/2;if(side<0)face.rotation.y=Math.PI;shaft.parent.add(face);
 }
 const rod=new THREE.Group(),slider=new THREE.Group();root.add(rod,slider);
 const rodOutline=clip.union(poly(circle([0,0],.17,96)),poly([[-.09,0],[.09,0],[.09,-.34],[.045,-.34],[.045,-rodLength],[-.045,-rodLength],[-.045,-.34],[-.09,-.34]]),poly(circle([0,-pinDistance],.12,96)));
 add('pinned-valve-rod',plate(clip.difference(rodOutline,poly(circle([0,0],.074,96)),poly(circle([0,-pinDistance],.064,96))),-.08,.08),rod,'brass');
 add('valve-slide',plate(clip.difference(poly([[-.16,-.14],[.16,-.14],[.16,.14],[-.16,.14]]),poly(circle([0,0],.064,96))),-.29,-.11),slider,'driven');
 add('lower-pin',disk(.06,-.29,.10,96),slider,'ink');add('lower-pin-retainer',disk(.09,.10,.13,96),slider,'ink');
 const ys=Array.from({length:257},(_,i)=>stateAtTime(g.demonstrationPeriod*i/256).valve.bottom.y),low=Math.min(...ys)-.19,high=Math.max(...ys)+.19;
 for(const side of [-1,1])add('output-guide-'+side,plate(poly([[side*.205-.025,low],[side*.205+.025,low],[side*.205+.025,high],[side*.205-.025,high]]),rodZ-.32,rodZ-.09).translate(guideX,0,0),b.fixedFrame,'frame');
 add('output-guide-back',plate(poly([[guideX-.23,g.baseY+.095],[guideX+.23,g.baseY+.095],[guideX+.23,high],[guideX-.23,high]]),rodZ-.38,rodZ-.32),b.fixedFrame,'frame');
 add('output-guide-foot',new THREE.BoxGeometry(.24,.19,3.60).translate(guideX,g.baseY,0),b.fixedFrame,'frame');
 const update=time=>{legacyUpdate(time);const s=stateAtTime(time);rod.position.set(s.valve.top.x,s.valve.top.y,rodZ);rod.rotation.z=s.valve.angle;slider.position.set(s.valve.bottom.x,s.valve.bottom.y,rodZ);root.userData.kinematics=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{stateAtTime,reconstructionStatus:'candidate',reconstructionNote:'The lever uses ordinary pin joints. A reconstructed lower slide guides the valve output vertically while the connecting rod tilts. The lower guide and supporting frame are not shown in the engraving.',valveGeometry:{guideX,rodLength,pinDistance,rodZ,low,high},valveParts:parts,valveBodies:{rod,slider}});
 root.userData.stateAtCyclePhase=phase=>stateAtTime(phase*g.demonstrationPeriod);
 const operatingState=root.userData.operatingStateAtDriveAngle;
 root.userData.operatingStateAtDriveAngle=(index,angle)=>withValve(operatingState(index,angle));
 root.userData.canonicalStates={source:stateAtTime(0),commonHeelByCam:g.configs.map((_,i)=>root.userData.operatingStateAtDriveAngle(i,g.commonHeelDriveAngle))};
 update(0);markShadows(root);
 return {...model,update,reset:()=>update(0),dispose:()=>disposeObject3D(root)};
}
