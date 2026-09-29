import * as THREE from 'three';
import {makeSilkTappetSolids} from './solids.js';
import {sampleSilkTappetMotion} from './playback.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {cylindricalWormGeometry} from '../worm-gear-geometry.js';
import {disposeObject3D} from '../dispose-model.js';

// Engraving reconstruction. The source omits bearing depths and the
// nut's internal thread; their constraints are ideal, with explicit clearances.
export function makeSilkTraverseAssembly(bundle) {
 const root=new THREE.Group(),parts={},families={},contact=makeSilkTappetSolids(bundle.parameters);
 const center=[202,283],scale=bundle.parameters.station/Math.hypot(160,96),angle=Math.atan2(96,160);
 // The source pose is taken on the second carrier turn (the first holds the
 // recording's startup), so the looped run below passes through it.
 const revolution=2*Math.PI/bundle.parameters.speed;
 const startTime=(.3-.025)/bundle.parameters.speed+revolution,start=sampleSilkTappetMotion(bundle,startTime);
 const phase=angle-start.carrier,screwZ=.23,lead=.12;
 const nutInitial=(-43*Math.cos(angle)-27*Math.sin(angle))*scale;
 // Loop: seventeen recorded carrier turns from a rest pose with the carrier
 // opposite the tappet (mid-dwell), easing up from rest and back down to it;
 // then, with the carrier at rest and the tappet far from the star wheel, the
 // screw is wound back by hand through the seventeen teeth it was indexed, so
 // the nut returns to its start. The wind-back is a reconstructed reset, not
 // recorded dynamics; the cycle repeats without a jump.
 const restTime=(Math.PI-bundle.parameters.start)/bundle.parameters.speed,runTurns=17,runEnd=restTime+runTurns*revolution,
  ease=1.5,rewind=4.5,runDisplay=runEnd-restTime+ease,cycle=runDisplay+rewind;
 if(runEnd>bundle.duration)throw new RangeError('173 run exceeds the recording');
 const g={center,scale,angle,startTime,phase,screwZ,lead,nutInitial,duration:cycle,restTime,runTurns,runEnd,ease,rewind,runDisplay};
 const easedRun=u=>{const r=w=>w/2-ease/(2*Math.PI)*Math.sin(Math.PI*w/ease);
  if(u<ease)return r(Math.max(0,u));if(u>runDisplay-ease)return runEnd-restTime-r(Math.max(0,runDisplay-u));return u-ease/2;};
 const smootherStep=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(10-15*t+6*t*t);};
 const displayOffset=startTime-restTime+ease/2;
 const raster=p=>[(p[0]-center[0])*scale,(center[1]-p[1])*scale];
 const sourcePoly=points=>poly(points.map(raster));
 const add=(name,geometry,color,family,parent=root)=>{
  const mesh=new THREE.Mesh(geometry,matte(color));mesh.name=name;mesh.material.fog=false;
  parts[name]=mesh;families[name]=family;parent.add(mesh);return mesh;
 };
 const round=(r)=>poly(circle([0,0],r,128));
 const alongX=(geometry)=>geometry.rotateY(Math.PI/2);
 contact.root.rotation.z=phase;contact.root.position.z=screwZ;root.add(contact.root);
 const carrier=contact.root.getObjectByName('carrier'),wheel=contact.root.getObjectByName('wheel');
 for(const [name,mesh]of Object.entries(contact.parts)){parts[name]=mesh;families[name]=name==='tappet'?'fixed':'screw';}
 // The screw frame is secured on the face of the disk: rails and bearing
 // blocks bed on the disk's front face at z -0.19.
 add('disk',plate(round(155*scale),-.4,-.19),PALETTE.driver,'carrier',carrier);
 for(const side of [-1,1]){
  const rail=add('channelRail'+side,new THREE.BoxGeometry(4.02,.10,.37),PALETTE.frame,'carrier',carrier);
  rail.position.set(-.04,side*.21,-.005);
 }
 for(const [name,x]of [['lower',-2.04],['upper',1.96]]){
  const outline=poly([[-.19,-.26],[.19,-.26],[.19,.26],[-.19,.26]]);
  const bearing=add(name+'Bearing',alongX(plate(clip.difference(outline,round(.135)),-.13,.13)),PALETTE.frame,'carrier',carrier);bearing.position.x=x;
 }
 // Solid trapezoidal thread, integral with its root cylinder.
 const screw=new THREE.Group();screw.rotation.y=Math.PI/2;carrier.add(screw);
 add('screwThread',cylindricalWormGeometry({length:3.78,module:lead/Math.PI,
  pitchRadius:.11,rootRadius:.10,tipRadius:.12,rootHalfWidth:.045,
  tipHalfWidth:.025,pressureAngle:Math.PI/9,angularSteps:96}),PALETTE.brass,'screw',screw);
 // No index tooth or painted stripe: Brown draws a plain star wheel.
 for(const [name,low,high]of [['lowerShaft',-2.3,-1.84],['upperShaft',1.84,bundle.parameters.station]]){
  add(name,alongX(plate(round(.066),low,high)),PALETTE.ink,'screw',carrier);
 }
 const nut=new THREE.Group();carrier.add(nut);
 const nutOutline=poly([[-.18,-.153],[.18,-.153],[.18,.153],[-.18,.153]]);
 add('nut',alongX(plate(clip.difference(nutOutline,round(.125)),-.16,.16)),PALETTE.brass,'nut',nut);
 add('wrist',plate(round(.12),.15,1.53),PALETTE.ink,'nut',nut);
 const yoke=new THREE.Group();root.add(yoke);
 const outer=capsule([0,(283-179)*scale],[0,(283-400)*scale],20*scale);
 const inner=capsule([0,(283-180)*scale],[0,(283-399)*scale],9.2*scale);
 add('yoke',plate(clip.difference(outer,inner),1.51,1.69),PALETTE.driven,'yoke',yoke);
 const rodLength=340*scale;
 const rod=add('guideRod',alongX(plate(round(.085),.24,rodLength)),PALETTE.driven,'yoke',yoke);rod.position.z=1.6;
 const guideCenter=raster([367,283]);
 const guide=add('guideBearing',alongX(plate(clip.difference(round(.58),round(.091)),-.11,.11)),PALETTE.frame,'fixed');guide.position.set(guideCenter[0],0,1.6);
 const bracketShape=new THREE.Shape();
 const move=(x,y)=>bracketShape.moveTo(...raster([x,y]));
 const line=(x,y)=>bracketShape.lineTo(...raster([x,y]));
 const curve=(a,b,c)=>bracketShape.bezierCurveTo(...raster(a),...raster(b),...raster(c));
 move(363,289);line(382,289);curve([407,291],[416,308],[422,340]);line(496,340);line(496,328);line(441,328);
 curve([432,291],[418,275],[382,274]);line(363,274);bracketShape.closePath();
 add('guideBracket',plate(poly(bracketShape.getPoints(32).map(p=>p.toArray())),1.8,1.94),PALETTE.frame,'fixed');
 // Brown breaks the fixed blocks off at the right edge. Model them whole as
 // two plain square-ended blocks (pass 101: the undrawn upright and web that
 // joined them into one C-frame are gone; neither block needs a drawn support).
 add('guideFoot',plate(sourcePoly([[386,346],[545,346],[545,391],[386,391]]),1.74,2.01),PALETTE.frame,'fixed');
 // Join the source foot and curved support without inventing an overall base.
 add('footNeck',plate(sourcePoly([[422,336],[496,336],[496,350],[422,350]]),1.8,1.94),PALETTE.frame,'fixed');
 // Pass 101: Brown's stout stud. The shank is the contact capsule itself
 // (solids.js), horizontal in the source view; a hex nut and a turned collar
 // (Brown's collar is about a quarter of the star wheel's diameter) seat it
 // on the striker box's end face. The box is centred on the stud's axis.
 root.updateMatrixWorld(true);
 const stud=contact.parts.tappet,studAxis=new THREE.Vector3(1,0,0).applyQuaternion(stud.getWorldQuaternion(new THREE.Quaternion()));
 const studFar=stud.getWorldPosition(new THREE.Vector3()).addScaledVector(studAxis,bundle.parameters.studLength/2);
 const boxFace=raster([406,179]),studZ=studFar.z,nutLength=.06,collarLength=boxFace[0]-studFar.x-nutLength;
 if(collarLength<.03)throw new RangeError('173 stud does not reach the striker box');
 const hexNut=add('studNut',alongX(new THREE.CylinderGeometry(.16,.16,nutLength,6).rotateY(Math.PI/6).rotateX(Math.PI/2)),PALETTE.ink,'fixed');
 hexNut.position.set(studFar.x+nutLength/2,studFar.y,studZ);
 const collar=add('studCollar',alongX(plate(round(.15),-collarLength/2,collarLength/2)),PALETTE.muted,'fixed');
 collar.position.set(boxFace[0]-collarLength/2,studFar.y,studZ);
 add('tappetSupport',plate(sourcePoly([[406,151],[545,151],[545,199],[406,199]]),studZ-.2,studZ+.2),PALETTE.frame,'fixed');
 const stateAtTime=time=>{
  const c=(((time+displayOffset)%cycle)+cycle)%cycle;
  let q;
  if(c<=runDisplay)q=sampleSilkTappetMotion(bundle,restTime+easedRun(c));
  else{const end=sampleSilkTappetMotion(bundle,runEnd),first=sampleSilkTappetMotion(bundle,restTime);
   q={carrier:end.carrier,wheel:end.wheel-(end.wheel-first.wheel)*smootherStep((c-runDisplay)/rewind)};}
  const a=phase+q.carrier,station=nutInitial-(q.wheel-start.wheel)*lead/(2*Math.PI);
  return {...q,angle:a,nutStation:station,wrist:[station*Math.cos(a),station*Math.sin(a)],time};
 };
 const update=time=>{const s=stateAtTime(time);contact.update(s);screw.rotation.z=s.wheel;
  nut.position.x=s.nutStation;yoke.position.x=s.wrist[0];root.userData.kinematics=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{parts,families,geometry:g,stateAtTime,cameraFov:8,hideGround:true,materialsIgnoreSceneFog:true,
  animationTiming:{authoredCyclePeriod:g.duration,displayCycleDuration:g.duration,playbackTimeScale:1},
  reconstructionNote:'The tappet indexes the screw and gradually changes the traverse. After seventeen carrier turns the carrier comes to rest away from the tappet and the screw is wound back by hand to the starting nut position before the carrier starts again; this wind-back is a reconstructed reset.',
  mechanism:'tappet-indexed-silk-traverse',fidelity:'authored',simulationBackend:'baked-mujoco',reconstructionStatus:'reconstructed'});
 update(0);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.duration*i/128);bounds.union(new THREE.Box3().setFromObject(root));}update(0);
 root.userData.cameraFitBounds=bounds.clone().expandByScalar(.08);
 // Ask the renderer to fit the complete adjustment, not just its source pose.
 root.userData.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
 markShadows(root);
 return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(0,0,1),dispose:()=>disposeObject3D(root)};
}
