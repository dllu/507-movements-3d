import * as THREE from 'three';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {convexProfilePieces} from '../mujoco-bench-clamp/profile.js';
import {singleClampProfile} from './profile.js';

// Study only: the board is actuated vertically, with horizontal translation
// free against the fixed side-piece. The jaw has no actuator or prescribed angle.
// A light inferred return spring (Brown draws none; it stands in for the
// workman opening the jaw) turns it about 0.12 rad open once the board is
// withdrawn, so each insertion visibly turns the jaw shut on the board.
export function makeSingleClampPhysics(mujoco,{timestep=.000125,friction=.2,contacts=true,opening=.12,force=10,solver='Newton',cyclic=false,returnStiffness=.5,damping=.25}={}){
 const {points,pivot}=singleClampProfile();
 const pieces=convexProfilePieces(points,THREE.ShapeUtils.triangulateShape(points,[]));
 let assets='';const geoms=pieces.map((piece,i)=>{
  const name=`jaw${i}`,vertices=[-.12,.12].flatMap(z=>piece.flatMap(j=>[points[j].x,points[j].y,z]));
  assets+=`<mesh name="${name}" vertex="${vertices.join(' ')}"/>`;
  return `<geom name="${name}" type="mesh" mesh="${name}" contype="1" conaffinity="2"/>`;
 }).join('');
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast" solver="${solver}" iterations="100" tolerance="1e-9"/>
 <default><geom condim="${friction>0?3:1}" friction="${friction} .001 .001" margin=".0005" solref=".003 1" solimp=".999 .999 .001"/></default>
 <asset>${assets}</asset><worldbody>
 <geom name="fixed-side" type="box" pos="-1.044 2.274 0" size=".396 3.03 .3" contype="1" conaffinity="2"/>
 <body pos="${pivot[0]} ${pivot[1]} 0"><joint name="jaw" axis="0 0 1" damping="${damping}" stiffness="${returnStiffness}" springref="${opening}"/><inertial pos="0 0 0" mass=".2" diaginertia=".03 .03 .06"/>${geoms}</body>
 <body><joint name="boardX" type="slide" axis="1 0 0" damping=".2"/><joint name="boardY" type="slide" axis="0 1 0"/><geom name="board" type="box" pos="-.324 1.5 0" size=".324 2.076 .16" mass="1" contype="${contacts?2:0}" conaffinity="${contacts?1:0}"/></body>
 </worldbody><actuator><position joint="boardY" kp="1000" kv="50" forcerange="${-force} ${force}"/></actuator></mujoco>`;
 const smooth=x=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10+u*(-15+6*u));};
 const target=t=>{
  if(!cyclic||t<=4)return -.78+.88*Math.max(0,Math.min(1,(t-.5)/2));
  const phase=(t-4)%6;
  return phase<2.5?.1-.88*smooth((phase-.5)/1.5):-.78+.88*smooth((phase-3)/2);
 };
 const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos[0]=opening;data.qpos[1]=.001;data.qpos[2]=-.78;data.ctrl[0]=-.78;},beforeStep:({data,time})=>{data.ctrl[0]=target(time);}});
 return Object.assign(p,{parameters:{timestep,friction,contacts,opening,force,solver,cyclic,returnStiffness,damping,cells:pieces.length},state:()=>({time:p.data.time,jaw:p.data.qpos[0],boardX:p.data.qpos[1],boardY:p.data.qpos[2],jawSpeed:p.data.qvel[0],boardXSpeed:p.data.qvel[1],boardYSpeed:p.data.qvel[2],contacts:p.data.ncon,appliedForce:p.data.actuator_force[0]})});
}
