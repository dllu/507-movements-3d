import * as THREE from 'three';
import {makeWormSaddleProfile} from './mujoco-worm-saddle/profile.js';
import {saddleWheelCut} from './mujoco-worm-saddle/wheel-data.js';
import {makeInstancedWormWheel} from './instanced-worm-wheel.js';
import {cylindricalWormGeometry} from './worm-gear-geometry.js';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

const tau=2*Math.PI;
export const opposedScrewDimensions={pitch:.224,period:60,travel:.224,sourceNutX:[-3.136,2.912],sourceScale:.014};
export function opposedScrewState(time){
 const g=opposedScrewDimensions,t=((time%g.period)+g.period)%g.period/g.period;
 const u=t<.45?t/.45:t<.5?1:t<.95?1-(t-.5)/.45:0;
 const fraction=u*u*u*(10+u*(-15+6*u));
 const wheelAngle=-tau*g.travel/g.pitch*fraction;
 return {wheelAngle,wormAngle:18*wheelAngle,nutX:g.sourceNutX.map((x,i)=>x-(i===0?1:-1)*g.pitch/tau*wheelAngle)};
}

// The instanced sectors meet on coincident internal radial faces, and their
// separately rotated boundary vertices leave hairline cracks on the flat end
// faces through which those darker faces read as radial seams. Bake the
// sectors into one welded mesh: every copy is rotated exactly, the internal
// radial closures (the last 12m indices of the sector) are dropped, and
// coincident boundary vertices snap to one position. The sector normals are
// kept, so the end faces stay flat and the tooth flanks keep their edges.
function solidWheel(instanced){
 const sector=instanced.geometry,{teeth,axialSteps:m}=instanced.userData,pitch=2*Math.PI/teeth;
 const position=sector.attributes.position,normal=sector.attributes.normal,count=position.count;
 const index=Array.from(sector.index.array).slice(0,sector.index.count-12*m);
 const positions=new Float32Array(3*count*teeth),normals=new Float32Array(3*count*teeth),indices=[],snap=new Map();
 for(let t=0;t<teeth;t++){
  const c=Math.cos(t*pitch),s=Math.sin(t*pitch),base=t*count;
  for(let i=0;i<count;i++){
   let x=position.getX(i)*c-position.getY(i)*s,y=position.getX(i)*s+position.getY(i)*c,z=position.getZ(i);
   const key=[x,y,z].map(v=>Math.round(v*1e5)).join(','),seen=snap.get(key);
   if(seen)[x,y,z]=seen;else snap.set(key,[x,y,z]);
   positions.set([x,y,z],3*(base+i));
   normals.set([normal.getX(i)*c-normal.getY(i)*s,normal.getX(i)*s+normal.getY(i)*c,normal.getZ(i)],3*(base+i));
  }
  for(const k of index)indices.push(base+k);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();sector.dispose();
 const mesh=new THREE.Mesh(geometry,instanced.material);mesh.userData={...instanced.userData,weldedSectors:true};return mesh;
}

// Ideal gear and screw constraints with generated, independently checked solids.
export function makeOpposedScrewNuts(){
 const root=new THREE.Group(),parts={},blocks={};
 const materials=Object.fromEntries(['driver','driven','accent','frame','ink','white'].map(k=>[k,matte(PALETTE[k],{metalness:.15,roughness:.6})]));
 const body=name=>{const b=new THREE.Group();b.name=name;blocks[name]=b;root.add(b);return b;};
 const add=(name,geometry,parent,color)=>{const m=new THREE.Mesh(geometry,materials[color]);m.name=name;parent.add(m);parts[name]=m;return m;};
 const rect=(l,b,r,t)=>poly([[l,b],[r,b],[r,t],[l,t]]);
 const f=makeWormSaddleProfile(),scale=1.302/f.wheelRadius;
 const transmission=body('transmission');transmission.rotation.y=Math.PI/2;transmission.scale.setScalar(scale);
 const wheel=new THREE.Group(),worm=new THREE.Group();transmission.add(wheel,worm);blocks.wheel=wheel;blocks.worm=worm;
 worm.position.y=f.distance;
 const wheelMesh=solidWheel(makeInstancedWormWheel(f,saddleWheelCut,.135/scale,materials.driven));
 wheelMesh.name='generated-worm-wheel';wheelMesh.rotation.z=Math.PI/2+(f.lead*Math.PI/2-f.phase)/f.pitchRadius;wheel.add(wheelMesh);parts.wheel=wheelMesh;
 const length=.9/scale;
 add('horizontal-input-worm',cylindricalWormGeometry({pitchRadius:f.wormPitchRadius,module:f.pitch/Math.PI,length,pressureAngle:f.pressureAngle,rootRadius:f.wormRoot,tipRadius:f.wormTip,rootHalfWidth:f.rootHalfWidth,tipHalfWidth:f.tipHalfWidth,phase:f.phase,angularSteps:768}).rotateY(Math.PI/2),worm,'driver');
 // Local X becomes world -Z: the input shaft is viewed end-on in Brown's plate.
 add('input-shaft',disk(f.wormRoot*.95,-1.42/scale,.75/scale,96).rotateY(Math.PI/2),worm,'ink');
 for(const [name,low,high] of [['front-input-journal',-1.42,-.45],['rear-input-journal',.45,.75]])add(name,disk(f.wormRoot,low/scale,high/scale,192).rotateY(Math.PI/2),worm,'ink');
 // Flush end-face paint rotates with the camera-facing end of the input shaft.
 const inputMark=new THREE.Mesh(new THREE.PlaneGeometry(.13/scale,.035/scale),materials.white);
 inputMark.name='input-shaft-rotation-mark';inputMark.rotation.y=-Math.PI/2;
 inputMark.position.set(-1.42/scale-.0002,.055/scale,0);worm.add(inputMark);
 inputMark.userData.visualIndicator=true;
 const frame=body('frame'),inputY=f.distance*scale;
 add('upper-bearing',ring(.237,.535,1.18,1.34).translate(0,inputY,0),frame,'frame');
 add('upper-bearing-sleeve',ring(f.wormRoot*scale+.004,.235,1.15,1.36).translate(0,inputY,0),frame,'accent');
 const screw=body('screw');screw.rotation.y=Math.PI/2;
 add('continuous-screw-core',disk(.135,-3.60,3.49,96),screw,'driven');
 const pitch=opposedScrewDimensions.pitch;
 for(const [i,hand,low,high] of [[0,1,-3.60,-1.05],[1,-1,1.00,3.49]]){
  const p={inner:.135,outer:.26,low,high,lead:hand*pitch/tau,phase:0,width:.096};
  add(`external-thread-${i}`,helicalThread(p,threadAngles(p,96)),screw,'driven');
  const nut=body(`nut-${i}`);nut.rotation.y=Math.PI/2;
  add(`nut-body-${i}`,plate(clip.difference(rect(-.33,-.40,.33,.40),poly(circle([0,0],.272,96))),-.28,.28),nut,'accent');
  const n={inner:.143,outer:.272,low:-.28,high:.28,lead:p.lead,phase:-opposedScrewDimensions.sourceNutX[i]+pitch/2,width:.096};
  add(`internal-thread-${i}`,helicalThread(n,threadAngles(n,96)),nut,'accent');
 }
 // Rear supports and nut guides are inferred hardware, kept off the wheel plane.
 const box=(name,x0,x1,y0,y1,z0,z1,parent=frame,color='frame')=>add(name,plate(rect(x0,y0,x1,y1),z0,z1),parent,color);
 for(const [i,x0,x1] of [[0,-3.60,-1.04],[1,1.00,3.49]]){
  const nut=blocks[`nut-${i}`];
  // Nut local +X points toward world -Z; the tongue slides in the rear channel.
  box(`nut-guide-tongue-${i}`,.32,.64,-.12,.12,-.22,.22,nut,'accent');
  box(`guide-back-${i}`,x0,x1,-.22,.22,-.72,-.65);
  box(`guide-upper-${i}`,x0,x1,.15,.22,-.65,-.34);
  box(`guide-lower-${i}`,x0,x1,-.22,-.15,-.65,-.34);
  for(const x of [x0+.12,x1-.12])box(`guide-post-${i}-${x}`,x-.06,x+.06,-1.50,-.22,-.72,-.60);
 }
 for(const x of [-.55,.55]){
  add(`screw-bearing-${x}`,ring(.139,.25,x-.075,x+.075,96).rotateY(Math.PI/2),frame,'frame');
  box(`bearing-post-${x}`,x-.075,x+.075,-1.50,-.245,-.12,.12);
  box(`bearing-foot-${x}`,x-.15,x+.15,-1.58,-1.50,-1.68,.15);
 }
 box('rear-base',-3.65,3.55,-1.58,-1.50,-1.68,-.59);
 box('upper-bearing-arm',.45,.69,inputY-.07,inputY+.07,1.21,1.31);
 box('upper-bearing-rear-tie',.59,.69,inputY-.07,inputY+.07,-1.68,1.31);
 box('upper-bearing-post',.59,.69,-1.50,inputY-.07,-1.68,-1.56);
 const update=time=>{const state=opposedScrewState(time);wheel.rotation.z=state.wheelAngle;worm.rotation.x=state.wormAngle;screw.rotation.z=state.wheelAngle;state.nutX.forEach((x,i)=>blocks[`nut-${i}`].position.x=x);root.userData.kinematics=state;root.updateMatrixWorld(true);};
 update(0);markShadows(root);Object.values(materials).forEach(m=>m.fog=false);
 Object.assign(root.userData,{parts,blocks,geometry:{...opposedScrewDimensions,wormAxisY:inputY,wheelRadius:1.302,wormScale:scale},hideGround:true,cameraFov:18,materialsIgnoreSceneFog:true,supportsRestart:true,fidelity:'authored',reconstructionStatus:'reviewed-ideal-constraints',
  reconstructionNote:'The upper worm drives the wheel on the opposite-hand screw. Rear guides prevent the nuts from turning. The 18:1 reduction makes their travel slow; the drive reverses after one screw turn. Tooth count, bearings and guides are reconstructed. Backlash and friction are omitted.',
  animationTiming:{authoredCyclePeriod:60,displayCycleDuration:60,playbackTimeScale:1}});
 return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(.2,.05,15),dispose:()=>disposeObject3D(root)};
}
