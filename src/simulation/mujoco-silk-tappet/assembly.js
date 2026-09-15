import * as THREE from 'three';
import {makeSilkTappetSolids} from './solids.js';
import {sampleSilkTappetMotion} from './playback.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,makeScrew,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';

// Engraving reconstruction candidate. The source omits bearing depths and the
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
 const screw=makeScrew({length:3.78,radius:.10,threadRadius:.02,pitch:lead,axis:new THREE.Vector3(1,0,0),color:PALETTE.brass});
 carrier.add(screw);let index=0;screw.traverse(o=>{if(o.isMesh){o.name='screw'+index++;parts[o.name]=o;families[o.name]='screw';o.material.fog=false;}});
 for(const [name,low,high]of [['lowerShaft',-2.3,-1.84],['upperShaft',1.84,bundle.parameters.station]]){
  add(name,alongX(plate(round(.066),low,high)),PALETTE.ink,'screw',carrier);
 }
 const nut=new THREE.Group();carrier.add(nut);
 const nutOutline=poly([[-.18,-.153],[.18,-.153],[.18,.153],[-.18,.153]]);
 add('nut',alongX(plate(clip.difference(nutOutline,round(.125)),-.16,.16)),PALETTE.brass,'nut',nut);
 add('wrist',plate(round(.12),.15,.82),PALETTE.ink,'nut',nut);
 const yoke=new THREE.Group();root.add(yoke);
 const outer=capsule([0,(283-179)*scale],[0,(283-400)*scale],20*scale);
 const inner=capsule([0,(283-180)*scale],[0,(283-399)*scale],9.2*scale);
 add('yoke',plate(clip.difference(outer,inner),.82,1.0),PALETTE.driven,'yoke',yoke);
 const rodLength=340*scale;
 const rod=add('guideRod',alongX(plate(round(.085),.24,rodLength)),PALETTE.driven,'yoke',yoke);rod.position.z=.91;
 const guideCenter=raster([367,283]);
 const guide=add('guideBearing',alongX(plate(clip.difference(round(.26),round(.091)),-.11,.11)),PALETTE.frame,'fixed');guide.position.set(guideCenter[0],0,.91);
 const bracketShape=new THREE.Shape();
 const move=(x,y)=>bracketShape.moveTo(...raster([x,y]));
 const line=(x,y)=>bracketShape.lineTo(...raster([x,y]));
 const curve=(a,b,c)=>bracketShape.bezierCurveTo(...raster(a),...raster(b),...raster(c));
 move(363,289);line(382,289);curve([407,291],[416,308],[422,340]);line(496,340);line(496,328);line(441,328);
 curve([432,291],[418,275],[382,274]);line(363,274);bracketShape.closePath();
 add('guideBracket',plate(poly(bracketShape.getPoints(32).map(p=>p.toArray())),1.11,1.25),PALETTE.frame,'fixed');
 add('guideFoot',plate(sourcePoly([[390,346],[512,346],[500,360],[511,373],[501,391],[385,391],[391,378],[386,365]]),1.05,1.32),PALETTE.frame,'fixed');
 // Join the source foot and curved support without inventing an overall base.
 add('footNeck',plate(sourcePoly([[422,336],[496,336],[496,350],[422,350]]),1.11,1.25),PALETTE.frame,'fixed');
 root.updateMatrixWorld(true);const tip=contact.parts.tappet.getWorldPosition(new THREE.Vector3());
 const stem=add('tappetStem',plate(round(.02),tip.z,1.13),PALETTE.ink,'fixed');stem.position.set(tip.x,tip.y,0);
 const supportEnd=raster([406,179]);
 const bar=add('tappetArm',new THREE.BoxGeometry(supportEnd[0]-tip.x,.06,.08),PALETTE.frame,'fixed');bar.position.set((supportEnd[0]+tip.x)/2,tip.y,1.1);
 add('tappetSupport',plate(sourcePoly([[406,151],[505,151],[499,164],[507,176],[500,187],[506,199],[406,199]]),1.02,1.18),PALETTE.frame,'fixed');
 const stateAtTime=time=>{
  const q=sampleSilkTappetMotion(bundle,startTime+Math.max(0,time));
  const a=phase+q.carrier,station=nutInitial-(q.wheel-start.wheel)*lead/(2*Math.PI);
  return {...q,angle:a,nutStation:station,wrist:[station*Math.cos(a),station*Math.sin(a)],time};
 };
 const update=time=>{const s=stateAtTime(time);contact.update(s);screw.userData.rotor.rotation.z=s.wheel;
  nut.position.x=s.nutStation;yoke.position.x=s.wrist[0];root.userData.kinematics=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{parts,families,geometry:g,stateAtTime,hideGround:true,supportsRestart:true,materialsIgnoreSceneFog:true,
  mechanism:'tappet-indexed-silk-traverse',fidelity:'authored',simulationBackend:'baked-mujoco',reconstructionStatus:'candidate'});
 update(0);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.duration*i/128);bounds.union(new THREE.Box3().setFromObject(root));}update(0);
 root.userData.cameraFitBounds=bounds.clone().expandByScalar(.08);markShadows(root);
 return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(0,0,1),dispose:()=>disposeObject3D(root)};
}
