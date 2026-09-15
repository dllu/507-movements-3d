import {createMujocoSimulation} from '../mujoco/simulation.js';
import {benchClampProfile} from './profile.js';
// Contact study: prescribed board push, passive jaw hinges. No jaw actuators.
export function makeBenchClampPhysics(mujoco,{timestep=.0005,friction=.5,opening=.06,force=10,contacts=true}={}){
 const profiles=[benchClampProfile(0),benchClampProfile(1)];let assets='';
 const bodies=profiles.map((p,side)=>{
  const geoms=p.triangles.map((tri,i)=>{
   const vertices=[-.08,.08].flatMap(z=>tri.flatMap(j=>[p.points[j].x,p.points[j].y,z])).join(' '),name=`jaw${side}part${i}`;
   assets+=`<mesh name="${name}" vertex="${vertices}"/>`;
   return `<geom name="${name}" type="mesh" mesh="${name}"/>`;
  }).join('');
  return `<body pos="${p.pivot[0]} ${p.pivot[1]} ${side===0?.12:-.12}"><joint name="jaw${side}" axis="0 0 1" damping=".03"/>
   <inertial pos="0 0 0" mass=".2" diaginertia=".03 .03 .06"/>${geoms}</body>`;
 }).join('');
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast" iterations="100" tolerance="1e-9"/>
 <default><geom contype="${contacts?1:0}" conaffinity="${contacts?1:0}" condim="${friction>0?3:1}" friction="${friction} .001 .001" margin=".0005" solref=".003 1" solimp=".999 .999 .001"/></default>
 <asset>${assets}</asset><worldbody>${bodies}<body><joint name="board" type="slide" axis="1 0 0"/><joint name="boardY" type="slide" axis="0 1 0" damping=".2"/><geom name="board" type="box" pos="2.382 0 0" size="2.382 .36 .3" mass="1"/></body></worldbody>
 <actuator><position joint="board" kp="1000" kv="50" forcerange="${-force} ${force}"/></actuator></mujoco>`;
 const target=t=>.6-.8*Math.max(0,Math.min(1,(t-.5)/2));
 const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos[0]=opening;data.qpos[1]=-opening;data.qpos[2]=.6;data.ctrl[0]=.6;},beforeStep:({data,time})=>{data.ctrl[0]=target(time);}});
 return Object.assign(p,{parameters:{timestep,friction,opening,force,contacts},state:()=>({time:p.data.time,upper:p.data.qpos[0],lower:p.data.qpos[1],board:p.data.qpos[2],boardY:p.data.qpos[3],boardSpeed:p.data.qvel[2],contacts:p.data.ncon,appliedForce:p.data.actuator_force[0]})});
}
