import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './geometry.js';
import {makeTreadlePhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

export function makeMujocoTreadle(mujoco,options={}) {
 const visual=makeTreadleRatchetCandidate({shortFaceFraction:.06}),u=visual.root.userData,p=u.linkage.parameters;
 u.parts.ratchetFace.material.color.set(0x47738a);
 let physics;
 try {physics=makeTreadlePhysics(mujoco,visual,options);}
 catch(error){disposeObject3D(visual.root);throw error;}
 const {model,data}=physics;
 const sourceCable=u.linkage.atTime(0).cable;
 // Both pawls carry the same torsion spring round their pins, between the pawl
 // and its arm. Its leg lies on the pawl's face along the band.
 const initialArms=u.linkage.atTime(0).arms,springs=['lower','upper'].map((name,i)=>{
  const arm=p.arms[i],stiffness=physics.description.options[name+'Spring'],
   spring=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:0x555a5d,metalness:.45,roughness:.45}));
  spring.name=`passive-${name}-pawl-torsion-spring`;spring.position.set(...arm.pawlLocal,0);u.blocks[name+'Arm'].add(spring);
  spring.visible=stiffness>0;
  const outline=u.profiles[name+'Pawl'][0][0],inside=q=>{let c=false;for(let j=0,k=outline.length-1;j<outline.length;k=j++){const a=outline[j],b=outline[k];
   if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
  const hits=Array.from({length:720},(_,k)=>k*Math.PI/360).filter(a=>inside([.16*Math.cos(a),.16*Math.sin(a)]));
  const legAngle=Math.atan2(hits.reduce((t,a)=>t+Math.sin(a),0),hits.reduce((t,a)=>t+Math.cos(a),0));
  const armLow=arm.armPlane-.03,pawlTop=(i===0?-.041:.041)+.03;
  return {name,spring,last:Infinity,legAngle:legAngle-initialArms[i].armAngle,armLow,pawlTop};
 });
 function sync(){
  mujoco.mj_forward(model,data);
  for(const [name,id]of Object.entries(physics.bodies)){
   const b=u.blocks[name],q=data.xquat,x=data.xpos;
   b.position.set(x[id*3],x[id*3+1],x[id*3+2]);b.quaternion.set(q[id*4+1],q[id*4+2],q[id*4+3],q[id*4]);
  }
  const angles=['lower','upper'].map((name,i)=>p.arms[i].sourceTreadleAngle+data.qpos[physics.joints[name+'Treadle'].q]);
  const endAt=a=>[p.fulcrum[0]+p.strapLocal[0]*Math.cos(a)-p.strapLocal[1]*Math.sin(a),p.fulcrum[1]+p.strapLocal[0]*Math.sin(a)+p.strapLocal[1]*Math.cos(a)];
  const front=endAt(angles[0]),rear=endAt(angles[1]),frontLength=p.pulley[1]-front[1],rearLength=p.pulley[1]-rear[1],transverseLength=frontLength+rearLength+Math.PI*p.radius,dx=rear[0]-front[0];
  const points=[[...front,p.radius]];
  for(let i=0;i<=128;i++){const theta=Math.PI*i/128,s=frontLength+p.radius*theta;points.push([front[0]+dx*s/transverseLength,p.pulley[1]+p.radius*Math.sin(theta),p.radius*Math.cos(theta)]);}
  points.push([...rear,-p.radius]);const cable={front,rear,frontLength,rearLength,transverseLength,dx,points,length:Math.hypot(transverseLength,dx)};
  u.setStrap(cable);u.blocks.lowerStrapEye.position.set(...front,0);u.blocks.upperStrapEye.position.set(...rear,0);
  const pulleyAngle=(frontLength-rearLength-sourceCable.frontLength+sourceCable.rearLength)/(2*p.radius);
  u.parts.pulleyBody.rotation.x=pulleyAngle;
  for(const s of springs){
   const springAngle=data.qpos[physics.joints[s.name+'Pawl'].q];
   if(!s.spring.visible||Math.abs(springAngle-s.last)<=1e-6)continue;
   s.last=springAngle;const endAngle=6*Math.PI+s.legAngle+springAngle,top=s.armLow-.03,bottom=s.pawlTop+.04;
   const points=[new THREE.Vector3(.10,0,s.armLow+.03),new THREE.Vector3(.06,0,top)];
   for(let i=1;i<=96;i++){const t=i/96,a=t*endAngle;points.push(new THREE.Vector3(.06*Math.cos(a),.06*Math.sin(a),top+(bottom-top)*t));}
   points.push(new THREE.Vector3(.16*Math.cos(endAngle),.16*Math.sin(endAngle),s.pawlTop));
   s.spring.geometry.dispose();s.spring.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),128,.006,6,false);
  }
  u.kinematics={time:data.time,wheelAngle:data.qpos[physics.joints.wheel.q],treadleAngles:angles,cable,pulleyAngle};visual.root.updateMatrixWorld(true);
  return u.kinematics;
 }
 const {advance,reset,update}=createPhysicsPlayback(physics,sync);
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 Object.assign(u,{mechanism:'mujoco-passive-treadle-ratchet',fidelity:'authored',reconstructionStatus:'integrated',physics,hideGround:true,
  simulationBackend:'mujoco',supportsRestart:true,
  reconstructionNote:'Both pawls are one part and carry the same inferred torsion spring, which holds them against the ratchet; the engraving does not establish the spring. A steady load torque on the wheel stands for the work it drives, so the wheel slips back onto the pawls after each advance. Belt traction is approximated.',
  animationTiming:{authoredCyclePeriod:4,displayCycleDuration:4,playbackTimeScale:1},
  cameraFitBounds:new THREE.Box3(new THREE.Vector3(-1.28,-2.83,-.6),new THREE.Vector3(3.6,1.4,.7)),
  sampledMotionBounds:{min:[-1.28,-2.83,-.6],max:[3.6,1.4,.7]},
  qualification:'MuJoCo advances the passive wheel and hinged pawls. Identical visible torsion springs close both pawls; their presence and stiffness are reconstruction assumptions, as is the steady load torque on the wheel. One motor drives the treadle; rods and the equalizer transmit that input.'});
 sync();return {...visual,physics,sync,advance,update,reset,dispose};
}
