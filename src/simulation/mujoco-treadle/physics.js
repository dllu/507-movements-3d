import {familyMass} from '../finite-plate-geometry.js';
import {convexPlatePieces} from './collision.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec = values => values.map(v=>Number(v.toPrecision(12))).join(' ');
const quat = a => [Math.cos(a/2),0,0,Math.sin(a/2)];
function fitEqualizer(linkage) {
 const p=linkage.parameters,origin=-p.sourceAngle,rows=[];
 for(let i=0;i<=32;i++){const angle=-p.amplitude+2*p.amplitude*i/32,x=angle-origin;rows.push({a:[1,x,x*x,x**3,x**4],b:linkage.atAngle(angle).rearAngle-p.sourceAngle});}
 const A=Array.from({length:5},(_,i)=>[...Array.from({length:5},(_,j)=>rows.reduce((s,r)=>s+r.a[i]*r.a[j],0)),rows.reduce((s,r)=>s+r.a[i]*r.b,0)]);
 for(let i=0;i<5;i++){let best=i;for(let j=i+1;j<5;j++)if(Math.abs(A[j][i])>Math.abs(A[best][i]))best=j;[A[i],A[best]]=[A[best],A[i]];
  const pivot=A[i][i];for(let k=i;k<=5;k++)A[i][k]/=pivot;for(let j=0;j<5;j++)if(j!==i){const f=A[j][i];for(let k=i;k<=5;k++)A[j][k]-=f*A[i][k];}}
 const coefficients=A.map(r=>r[5]);let maximumError=0;
 for(let i=0;i<=256;i++){const angle=-p.amplitude+2*p.amplitude*i/256,x=angle-origin;
  maximumError=Math.max(maximumError,Math.abs(coefficients.reduce((s,c,j)=>s+c*x**j,0)+p.sourceAngle-linkage.atAngle(angle).rearAngle));}
 return {coefficients,maximumError};
}

export function buildTreadleMjcf(visual,{timestep=.0005,lowerSpring=10,upperSpring=10,springReference=.45,load=300,friction=.35,contactTime=.001}={}) {
 const u=visual.root.userData,p=u.linkage.parameters,initial=u.linkage.atTime(0),assets=[],collision={},bodyNames=[],density=1/familyMass(u.parts,u.families,'lowerPawl').volume;
 const inertial=family=>{const raw=familyMass(u.parts,u.families,family),mass=raw.volume*density,I=raw.centralPolar*density;
  return `<inertial pos="${vec(raw.centroid)}" mass="${mass}" diaginertia="${I*.51} ${I*.51} ${I}"/>`;};
 const colliders=(name,mesh,mask)=>{
  const shape=convexPlatePieces(mesh.geometry);collision[name]=shape;
  return shape.cells.map((cell,i)=>{
   const id=name+'_'+i,vertices=[shape.low,shape.high].flatMap(z=>cell.flatMap(q=>[...q,z]));
   assets.push(`<mesh name="${id}" vertex="${vec(vertices)}"/>`);
   return `<geom name="${id}" type="mesh" mesh="${id}" contype="${mask}" conaffinity="${mask===1?2:1}"/>`;
  }).join('');
 };
 bodyNames.push('wheel');
 let bodies=`<body name="wheel"><joint name="wheel" type="hinge" axis="0 0 1" damping=".2" frictionloss=".02"/>${inertial('wheel')}${colliders('wheel',u.parts.ratchetBody,1)}</body>`;
 for(let i=0;i<2;i++){
  const arm=p.arms[i],s=initial.arms[i],name=arm.name,rodAngle=Math.atan2(s.bottom[1]-s.top[1],s.bottom[0]-s.top[0]);
  bodyNames.push(name+'Arm',name+'Pawl',name+'Rod',name+'Treadle');
  bodies+=`<body name="${name}Arm" quat="${vec(quat(s.armAngle))}"><joint name="${name}Arm" type="hinge" axis="0 0 1" damping=".01"/>${inertial(name+'Arm')}
   <body name="${name}Pawl" pos="${vec([...arm.pawlLocal,0])}" quat="${vec(quat(-s.armAngle))}"><joint name="${name}Pawl" type="hinge" axis="0 0 1" damping=".008" stiffness="${i===0?lowerSpring:upperSpring}" springref="${springReference}"/>${inertial(name+'Pawl')}${colliders(name+'Pawl',u.parts[name+'PawlBody'],2)}</body>
   <body name="${name}Rod" pos="${vec([...arm.armRodLocal,0])}" quat="${vec(quat(rodAngle-s.armAngle))}"><joint name="${name}Rod" type="hinge" axis="0 0 1" damping=".01"/>${inertial(name+'Rod')}<site name="${name}RodEnd" pos="${arm.rodLength} 0 0"/></body>
  </body>
  <body name="${name}Treadle" pos="${vec([...p.fulcrum,0])}" quat="${vec(quat(s.treadleAngle))}"><joint name="${name}Treadle" type="hinge" axis="0 0 1" damping=".1"/>${inertial(name+'Treadle')}<site name="${name}TreadlePin" pos="${vec([...arm.rodLocal,0])}"/></body>`;
 }
 const equalizer=fitEqualizer(u.linkage);
 const xml=`<mujoco model="082 passive treadle ratchet"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic" impratio="10"/>
 <default><geom friction="${friction} .001 .001" condim="3" margin=".00002" solref="${contactTime} 1" solimp=".999 .9999 .0001"/><joint limited="false"/><equality solref=".003 1" solimp=".99 .999 .0001"/></default>
 <asset>${assets.join('')}</asset><worldbody>${bodies}</worldbody>
 <equality><connect site1="lowerRodEnd" site2="lowerTreadlePin"/><connect site1="upperRodEnd" site2="upperTreadlePin"/><joint joint1="upperTreadle" joint2="lowerTreadle" polycoef="${vec(equalizer.coefficients)}"/></equality>
 <actuator><position name="foot" joint="lowerTreadle" kp="1000000" kv="2000"/></actuator></mujoco>`;
 return {xml,collision,equalizer,bodyNames,options:{timestep,lowerSpring,upperSpring,springReference,load,friction,contactTime},density};
}

// Pawl angles resting on the wheel at its start angle (scripts/lib/treadle-ratchet-contact.mjs).
export const initialPawlAngles=[-.0204,-.0164];

export function makeTreadlePhysics(mujoco,visual,options={}) {
 const description=buildTreadleMjcf(visual,options),p=visual.root.userData.linkage.parameters,{load}=description.options;
 let wheelDof=0;
 const simulation=createMujocoSimulation(mujoco,{
  xml:description.xml,
  initialize:({model,data,id})=>{
   const set=(name,value)=>{data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT',name)]]=value;};
   wheelDof=model.jnt_dofadr[id('mjOBJ_JOINT','wheel')];
   set('wheel',.03);set('lowerPawl',initialPawlAngles[0]);set('upperPawl',initialPawlAngles[1]);
  },
  beforeStep:({data,time})=>{data.ctrl[0]=p.amplitude*Math.cos(time*2*Math.PI/p.period+p.sourcePhase)+p.sourceAngle;data.qfrc_applied[wheelDof]=-load;},
 });
 const {model,data,id}=simulation;
 const joints=Object.fromEntries(description.bodyNames.map(name=>{const j=id('mjOBJ_JOINT',name);return [name,{q:model.jnt_qposadr[j],v:model.jnt_dofadr[j]}];}));
 const bodies=Object.fromEntries(description.bodyNames.map(name=>[name,id('mjOBJ_BODY',name)]));
 const state=()=>{mujoco.mj_forward(model,data);return {time:data.time,wheelAngle:data.qpos[joints.wheel.q],wheelSpeed:data.qvel[joints.wheel.v],
  pawlAngles:['lower','upper'].map(name=>{const b=bodies[name+'Pawl'],q=data.xquat;return 2*Math.atan2(q[4*b+3],q[4*b]);}),
  pawlRelativeAngles:['lower','upper'].map(name=>data.qpos[joints[name+'Pawl'].q]),
  qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),contacts:data.ncon};};
 return Object.assign(simulation,{description,joints,bodies,state});
}
