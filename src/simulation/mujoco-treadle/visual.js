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
 // Both pawls carry the same inferred torsion spring (the hinge stiffness in
 // physics.js). Brown draws no spring, so none is rendered.
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
  qualification:'MuJoCo advances the passive wheel and hinged pawls. Identical torsion springs (not drawn, so not rendered) close both pawls; their presence and stiffness are reconstruction assumptions, as is the steady load torque on the wheel. One motor drives the treadle; rods and the equalizer transmit that input.'});
 sync();return {...visual,physics,sync,advance,update,reset,dispose};
}
