import * as THREE from 'three';
import {createAuthoredSelectableCamMovement} from './authored-selectable-cams.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

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
 // Parts retired upstream (e.g. the former dark pivot ring) may be absent.
 const remove=o=>{if(!o)return;o.removeFromParent();o.traverse(p=>{p.geometry?.dispose();for(const m of [p.material].flat())if(m)detachedMaterials.add(m);});};
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
 // Brown cuts the shaft flush with the front of the cam series, its hatched
 // section sitting inside the smallest cam. The hatching is engraving
 // notation: the model shows the plain end of the shaft itself. Both ends
 // stop just beyond the keyed hub at its sliding limits (the viewer-side end,
 // local -Z after source presentation, ahead of its forward limit; the rear
 // end behind its rearward limit), so the shaft no longer stands about 0.5
 // proud of the rear of the stack. The shaft radius already matches the
 // plate's hatched circle at source scale (0.56 = 35 plate pixels).
 // The shaft mesh is turned so its geometry Y runs along the parent's Z.
 let shaft;root.traverse(o=>{if(o.userData.role==='long-keyed-shaft-through-sliding-cam-series')shaft=o;});
 // Plain turned steel, so its end reads as the shaft's own face rather than
 // a black cap over the cams.
 shaft.material=matte(PALETTE.muted,{roughness:.5,metalness:.3});shaft.material.fog=false;
 {
  const {radiusTop:radius,radialSegments}=shaft.geometry.parameters,box=new THREE.Box3(),toShaftParent=new THREE.Matrix4();
  let hubFront=Infinity,hubRear=-Infinity;
  for(let i=0;i<=256;i++){legacyUpdate(g.demonstrationPeriod*i/256);root.updateMatrixWorld(true);toShaftParent.copy(shaft.parent.matrixWorld).invert();
   b.slidingCarrier.traverse(o=>{if(o.isMesh&&o.userData.role==='keyed-hub-rigid-with-all-four-cams'){box.setFromObject(o).applyMatrix4(toShaftParent);hubFront=Math.min(hubFront,box.min.z);hubRear=Math.max(hubRear,box.max.z);}});}
  const front=hubFront-.02,rear=hubRear+.02;
  shaft.geometry.dispose();shaft.geometry=new THREE.CylinderGeometry(radius,radius,rear-front,radialSegments).translate(0,(rear+front)/2,0);
  g.shaftFrontZ=front;g.shaftRearZ=rear;
 }
 // Brown outlines each cam; the profile outlines lay only on the faces
 // turned away from the viewer, so the stack read as blurred discs.
 // Presentation-only copies outline the viewer-side faces (no mass).
 for(const record of b.camRecords){
  // The dark cam outlines are retired (no black rims); nothing to mirror.
  if(!record.outline)continue;
  // Mirrored onto the viewer-side face and sunk so it stands only 0.008
  // proud: the lever runs in the 0.06 gap beside a cam's face.
  const copy=record.outline.clone();copy.scale.z=-1;copy.position.z=.016;copy.userData={...record.outline.userData,role:record.outline.userData.role.replace('outline','front-outline'),presentationOnly:true};
  record.outline.parent.add(copy);
  // Brown draws each cam once, by its front edge. The rear-face outlines
  // doubled every cam into a ribbed barrel in the end view; hide them.
  record.outline.visible=false;
 }
 // The keyed hub standing just proud of the stack read as a heavy black ring
 // round the hatched section; Brown draws a plain ring there. Colour it like
 // the cam sleeve it is keyed into.
 {let sleeve,hub;root.traverse(o=>{if(o.userData.role==='continuous-common-heel-selection-sleeve')sleeve=o;if(o.userData.role==='keyed-hub-rigid-with-all-four-cams')hub=o;});
  if(sleeve&&hub)hub.material=sleeve.material;}
 const rod=new THREE.Group(),slider=new THREE.Group();root.add(rod,slider);
 // Pass 93: Brown draws the valve rod as a plain rod running off the plate.
 // The reconstructed lower slide and its guides are not displayed (source
 // presentation removes them), so the rod ends plainly in a round end: no
 // lower eye or cross-pin attached to nothing. The slider body still carries
 // the kinematic lower joint.
 const rodOutline=clip.union(poly(circle([0,0],.17,96)),poly([[-.09,0],[.09,0],[.09,-.34],[.045,-.34],[.045,-rodLength+.045],[-.045,-rodLength+.045],[-.045,-.34],[-.09,-.34]]),poly(circle([0,-rodLength+.045],.045,48)));
 add('pinned-valve-rod',plate(clip.difference(rodOutline,poly(circle([0,0],.074,96))),-.08,.08),rod,'brass');
 add('valve-slide',plate(clip.difference(poly([[-.16,-.14],[.16,-.14],[.16,.14],[-.16,.14]]),poly(circle([0,0],.064,96))),-.29,-.11),slider,'driven');
 const ys=Array.from({length:257},(_,i)=>stateAtTime(g.demonstrationPeriod*i/256).valve.bottom.y),low=Math.min(...ys)-.19,high=Math.max(...ys)+.19;
 // The valve slide runs between two guide bars. Brown draws no guide, so it
 // is kept minimal: the bars stand on a flat bracket behind the rod whose
 // strap runs up to a standoff on the lever's fixed fulcrum, so nothing floats.
 const bracketLow=rodZ+.10,bracketHigh=rodZ+.16,p=g.leverPivot;
 for(const side of [-1,1])add('output-guide-'+side,plate(poly([[side*.205-.025,low],[side*.205+.025,low],[side*.205+.025,high],[side*.205-.025,high]]),rodZ-.32,bracketLow).translate(guideX,0,0),b.fixedFrame,'frame');
 {
  const ux=p.x-guideX,uy=p.y-(high-.12),len=Math.hypot(ux,uy),nx=-uy/len*.13,ny=ux/len*.13;
  const strap=poly([[guideX+nx,high-.12+ny],[p.x+nx,p.y+ny],[p.x-nx,p.y-ny],[guideX-nx,high-.12-ny]]);
  // An open slot in the bracket clears the lower pin's retainer over the stroke.
  const slot=poly([[guideX-.105,low-.01],[guideX+.105,low-.01],[guideX+.105,high-.09],[guideX-.105,high-.09]]);
  add('output-guide-bracket',plate(clip.difference(clip.union(poly([[guideX-.23,low],[guideX+.23,low],[guideX+.23,high],[guideX-.23,high]]),strap,poly(circle([p.x,p.y],.24,96))),slot),bracketLow,bracketHigh),b.fixedFrame,'frame');
  add('fulcrum-standoff',disk(.2,leverPlane+.07,bracketLow,96).translate(p.x,p.y,0),b.fixedFrame,'frame');
 }
 const update=time=>{legacyUpdate(time);const s=stateAtTime(time);rod.position.set(s.valve.top.x,s.valve.top.y,rodZ);rod.rotation.z=s.valve.angle;slider.position.set(s.valve.bottom.x,s.valve.bottom.y,rodZ);root.userData.kinematics=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{stateAtTime,reconstructionStatus:'candidate',reconstructionNote:'The lever uses ordinary pin joints. A reconstructed lower slide guides the valve output vertically while the connecting rod tilts. The minimal lower guide, its bracket and the fulcrum standoff are not shown in the engraving.',valveGeometry:{guideX,rodLength,pinDistance,rodZ,low,high},valveParts:parts,valveBodies:{rod,slider}});
 root.userData.stateAtCyclePhase=phase=>stateAtTime(phase*g.demonstrationPeriod);
 const operatingState=root.userData.operatingStateAtDriveAngle;
 root.userData.operatingStateAtDriveAngle=(index,angle)=>withValve(operatingState(index,angle));
 root.userData.canonicalStates={source:stateAtTime(0),commonHeelByCam:g.configs.map((_,i)=>root.userData.operatingStateAtDriveAngle(i,g.commonHeelDriveAngle))};
 update(0);markShadows(root);
 return {...model,update,reset:()=>update(0),dispose:()=>disposeObject3D(root)};
}
