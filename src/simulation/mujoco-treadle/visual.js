import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './geometry.js';
import {makeTreadlePhysics} from './physics.js';

export function makeMujocoTreadle(mujoco,options={}) {
 const visual=makeTreadleRatchetCandidate({shortFaceFraction:.06}),u=visual.root.userData,p=u.linkage.parameters;
 u.parts.ratchetFace.material=u.parts.ratchetFace.material.clone();u.parts.ratchetFace.material.color.set(0x47738a);
 const physics=makeTreadlePhysics(mujoco,visual,options),{model,data}=physics;
 const sourceCable=u.linkage.atTime(0).cable;
 const spring=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:0x555a5d,metalness:.45,roughness:.45}));
 spring.name='passive-lower-pawl-torsion-spring';spring.position.set(...p.arms[0].pawlLocal,0);u.blocks.lowerArm.add(spring);
 spring.visible=physics.description.options.lowerSpring>0;
 let lastSpringAngle=Infinity;
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
  const springAngle=data.qpos[physics.joints.lowerPawl.q];
  if(spring.visible&&Math.abs(springAngle-lastSpringAngle)>1e-6){
   lastSpringAngle=springAngle;const endAngle=6*Math.PI+Math.PI/2-p.arms[0].sourceArmAngle+springAngle;
   const points=[new THREE.Vector3(.10,0,.18),new THREE.Vector3(.06,0,.12)];
   for(let i=1;i<=96;i++){const t=i/96,a=t*endAngle;points.push(new THREE.Vector3(.06*Math.cos(a),.06*Math.sin(a),.12-.09*t));}
   points.push(new THREE.Vector3(.16*Math.cos(endAngle),.16*Math.sin(endAngle),-.011));
   spring.geometry.dispose();spring.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),128,.006,6,false);
  }
  u.kinematics={time:data.time,wheelAngle:data.qpos[physics.joints.wheel.q],treadleAngles:angles,cable,pulleyAngle};visual.root.updateMatrixWorld(true);
  return u.kinematics;
 }
 let accumulator=0;
 const advance=seconds=>{if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid duration');accumulator+=seconds;let steps=0;
  while(accumulator>=physics.timestep){physics.step();accumulator-=physics.timestep;steps++;}sync();return steps;};
 const reset=()=>{accumulator=0;physics.reset();sync();};
 const update=time=>{
  if(!Number.isFinite(time)||time<0)throw Error('Invalid simulation time');
  if(time<data.time+accumulator-1e-10)reset();
  advance(Math.max(0,time-data.time-accumulator));
 };
 const dispose=()=>{physics.dispose();const geometries=new Set(),materials=new Set();visual.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};
 Object.assign(u,{mechanism:'mujoco-passive-treadle-ratchet',fidelity:'authored',reconstructionStatus:'pilot',physics,hideGround:true,
  animationTiming:{authoredCyclePeriod:4,displayCycleDuration:4,playbackTimeScale:1},
  cameraFitBounds:new THREE.Box3(new THREE.Vector3(-1.28,-2.83,-.6),new THREE.Vector3(3.6,1.4,.7)),
  qualification:'MuJoCo advances the passive wheel and hinged pawls. A visible passive torsion spring closes the lower pawl; its presence and stiffness are reconstruction assumptions. One motor drives the treadle; rods and the equalizer transmit that input.'});
 sync();return {...visual,physics,sync,advance,update,reset,dispose};
}
