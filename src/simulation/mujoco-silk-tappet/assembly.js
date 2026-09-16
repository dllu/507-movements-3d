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
 const startTime=(.3-.025)/bundle.parameters.speed,start=sampleSilkTappetMotion(bundle,startTime);
 const phase=angle-start.carrier,screwZ=.23,lead=.12;
 const nutInitial=(-43*Math.cos(angle)-27*Math.sin(angle))*scale;
 const g={center,scale,angle,startTime,phase,screwZ,lead,nutInitial,duration:bundle.duration-startTime};
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
 add('disk',plate(round(155*scale),-.4,-.28),PALETTE.driver,'carrier',carrier);
 for(const side of [-1,1]){
  const rail=add('channelRail'+side,new THREE.BoxGeometry(4.02,.10,.36),PALETTE.frame,'carrier',carrier);
  rail.position.set(-.04,side*.21,0);
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
 // A dark index tooth is legible even in the source view, where the cheeks are edge-on.
 contact.parts.tooth2.material.color.set(PALETTE.ink);
 // Paint on both wheel cheeks remains visible as the carrier turns.
 for (const side of [-1,1]) {
  const mark=new THREE.Mesh(new THREE.PlaneGeometry(.32,.055),matte(PALETTE.ink));
  mark.material.fog=false;mark.name='wheel-rotation-mark'+side;
  mark.rotation.y=side*Math.PI/2;mark.rotation.z=Math.PI/2;
  mark.position.set(side*(.055*(bundle.parameters.axialScale??1)+.0002),.27,0);
  mark.userData.visualIndicator=true;wheel.add(mark);
 }
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
 add('guideFoot',plate(sourcePoly([[390,346],[512,346],[500,360],[511,373],[501,391],[385,391],[391,378],[386,365]]),1.74,2.01),PALETTE.frame,'fixed');
 // Join the source foot and curved support without inventing an overall base.
 add('footNeck',plate(sourcePoly([[422,336],[496,336],[496,350],[422,350]]),1.8,1.94),PALETTE.frame,'fixed');
 root.updateMatrixWorld(true);const tip=contact.parts.tappet.getWorldPosition(new THREE.Vector3());
 const stem=add('tappetStem',plate(round(.02),tip.z,1.13),PALETTE.ink,'fixed');stem.position.set(tip.x,tip.y,0);
 const supportEnd=raster([406,179]);
 const bar=add('tappetArm',new THREE.BoxGeometry(supportEnd[0]-tip.x,.06,.08),PALETTE.frame,'fixed');bar.position.set((supportEnd[0]+tip.x)/2,tip.y,1.1);
 add('tappetSupport',plate(sourcePoly([[406,151],[505,151],[499,164],[507,176],[500,187],[506,199],[406,199]]),1.02,1.18),PALETTE.frame,'fixed');
 const stateAtTime=time=>{
  // Repeat the finite adjustment; each replay resets the nut to its source pose.
  const playbackTime=((time%g.duration)+g.duration)%g.duration;
  const q=sampleSilkTappetMotion(bundle,startTime+playbackTime);
  const a=phase+q.carrier,station=nutInitial-(q.wheel-start.wheel)*lead/(2*Math.PI);
  return {...q,angle:a,nutStation:station,wrist:[station*Math.cos(a),station*Math.sin(a)],time};
 };
 const update=time=>{const s=stateAtTime(time);contact.update(s);screw.rotation.z=s.wheel;
  nut.position.x=s.nutStation;yoke.position.x=s.wrist[0];root.userData.kinematics=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{parts,families,geometry:g,stateAtTime,cameraFov:8,hideGround:true,supportsRestart:true,materialsIgnoreSceneFog:true,
  animationTiming:{authoredCyclePeriod:g.duration,displayCycleDuration:g.duration,playbackTimeScale:1},
  reconstructionNote:'The tappet indexes the screw and gradually changes the traverse. At the end of its finite adjustment, playback restarts from the initial nut position.',
  mechanism:'tappet-indexed-silk-traverse',fidelity:'authored',simulationBackend:'baked-mujoco',reconstructionStatus:'reconstructed'});
 update(0);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.duration*i/128);bounds.union(new THREE.Box3().setFromObject(root));}update(0);
 root.userData.cameraFitBounds=bounds.clone().expandByScalar(.08);
 // Ask the renderer to fit the complete adjustment, not just its source pose.
 root.userData.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
 markShadows(root);
 return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(0,0,1),dispose:()=>disposeObject3D(root)};
}
