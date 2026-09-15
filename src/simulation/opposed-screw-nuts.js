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

// Source reconstruction candidate. Kept separate from the production loader
// until generated tooth contact and complete assembly clearances are reviewed.
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
 const wheelMesh=makeInstancedWormWheel(f,saddleWheelCut,.135/scale,materials.driven);
 wheelMesh.name='generated-worm-wheel';wheelMesh.rotation.z=Math.PI/2+(f.lead*Math.PI/2-f.phase)/f.pitchRadius;wheel.add(wheelMesh);parts.wheel=wheelMesh;
 const length=.9/scale;
 add('horizontal-input-worm',cylindricalWormGeometry({pitchRadius:f.wormPitchRadius,module:f.pitch/Math.PI,length,pressureAngle:f.pressureAngle,rootRadius:f.wormRoot,tipRadius:f.wormTip,rootHalfWidth:f.rootHalfWidth,tipHalfWidth:f.tipHalfWidth,phase:f.phase,angularSteps:192}).rotateY(Math.PI/2),worm,'driver');
 // Local X becomes world -Z: the input shaft is viewed end-on in Brown's plate.
 add('input-shaft',disk(f.wormRoot,-1.05/scale,.75/scale,96).rotateY(Math.PI/2),worm,'ink');
 const frame=body('frame'),inputY=f.distance*scale;
 add('upper-bearing',ring(.237,.535,.79,.95).translate(0,inputY,0),frame,'frame');
 add('upper-bearing-sleeve',ring(f.wormRoot*scale+.004,.235,.76,.97).translate(0,inputY,0),frame,'accent');
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
 const update=time=>{const state=opposedScrewState(time);wheel.rotation.z=state.wheelAngle;worm.rotation.x=state.wormAngle;screw.rotation.z=state.wheelAngle;state.nutX.forEach((x,i)=>blocks[`nut-${i}`].position.x=x);root.userData.kinematics=state;root.updateMatrixWorld(true);};
 update(0);markShadows(root);Object.values(materials).forEach(m=>m.fog=false);
 Object.assign(root.userData,{parts,blocks,geometry:{...opposedScrewDimensions,wormAxisY:inputY,wheelRadius:1.302,wormScale:scale},hideGround:true,cameraFov:18,materialsIgnoreSceneFog:true,supportsRestart:true,fidelity:'authored',reconstructionStatus:'prototype',
  reconstructionNote:'The upper worm drives an edge-on wheel on the opposite-hand screw. Nuts are constrained against rotation. Tooth count, bearing depth and reversing drive are reconstructed; support and tooth-contact review is in progress.',
  animationTiming:{authoredCyclePeriod:60,displayCycleDuration:60,playbackTimeScale:1}});
 return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(.2,.05,15),dispose:()=>disposeObject3D(root)};
}
