import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.map(v=>Math.abs(v)<1e-12?0:Number(v.toPrecision(12))).join(' ');
export function makeThreadCuttingPhysics(mujoco,visual,{timestep=.001,period=24,kp=1000,kv=100,load=0,workTorque=0}={}) {
 const u=visual.root.userData,f=u.profile,mass=Object.fromEntries(['lead','work','carriage'].map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.lead.volume;
 const inertia=n=>{const m=mass[n];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 const xml=`<mujoco model="109 change-gear thread cutting"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="40" tolerance="1e-10"/>
 <worldbody><body name="lead" pos="${f.leadX} 0 ${f.leadZ}"><joint name="lead" type="hinge" axis="0 1 0" damping=".01"/>${inertia('lead')}</body>
 <body name="work" pos="${f.workX} 0 ${f.workZ}"><joint name="work" type="hinge" axis="0 1 0" damping=".01"/>${inertia('work')}</body>
 <body name="carriage" pos="${f.leadX} 0 ${f.leadZ}"><joint name="carriage" type="slide" axis="0 1 0" damping=".01"/>${inertia('carriage')}</body></worldbody>
 <equality><joint name="gears" joint1="work" joint2="lead" polycoef="0 ${f.ratio} 0 0 0" solref=".002 1" solimp=".9999 .99999 .0001"/>
 <joint name="feed" joint1="carriage" joint2="lead" polycoef="0 ${-f.lead} 0 0 0" solref=".002 1" solimp=".9999 .99999 .0001"/></equality>
 <actuator><position joint="lead" kp="${kp}" kv="${kv}"/></actuator></mujoco>`;
 const half=period/2,d=period*.025,stroke=f.upper-f.lower,speed=stroke/(half-d),phase=f.upper/speed+d/2;
 const end=t=>{const a=t/d;return {distance:speed*d*(a*a*a-a*a*a*a/2),speed:speed*(3*a*a-2*a*a*a)};};
 const input=time=>{const b=((time+phase)%period+period)%period,t=Math.min(b,period-b);let s,v;
  if(t<d){const e=end(t);s=e.distance;v=e.speed;}else if(t>half-d){const e=end(half-t);s=stroke-e.distance;v=e.speed;}else{s=speed*(t-d/2);v=speed;}
  return {angle:(f.upper-s)/(-f.lead),velocity:(b>half?v:-v)/(-f.lead),carriage:f.upper-s};};
 const progress={maximumWorkAngle:0},observe=data=>{progress.maximumWorkAngle=Math.max(progress.maximumWorkAngle,data.qpos[1]);};
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{progress.maximumWorkAngle=0;const v=input(0).velocity;data.qvel[0]=v;data.qvel[1]=f.ratio*v;data.qvel[2]=-f.lead*v;data.qfrc_applied[1]=workTorque;data.qfrc_applied[2]=load;},
  beforeStep:({data,time})=>{observe(data);const p=input(time);data.ctrl[0]=p.angle+kv/kp*p.velocity;}});
 return Object.assign(physics,{bodies:Object.fromEntries(['lead','work','carriage'].map(n=>[n,physics.id('mjOBJ_BODY',n)])),progress,observe,
  description:{xml,mass,density,input,options:{timestep,period,kp,kv,load,workTorque},coupling:'Ideal gears and screw feed; material removal is geometric. Initial workpiece inertia stays fixed; cutting forces, chips, wear and thread/tooth friction are omitted.'}});
}
