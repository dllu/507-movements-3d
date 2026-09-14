import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.flat().map(v=>Number(v.toPrecision(12))).join(' ');
export function makeThreeWiperPhysics(mujoco,visual,{timestep=.0005,period=6,damping=.05,guideFriction=0}={}){
 const u=visual.root.userData,p=u.profile;
 const assets=u.cells.map((c,i)=>`<mesh name="cell${i}" vertex="${vec(c)}"/>`).join('');
 const geoms=u.cells.map((_,i)=>`<geom type="mesh" mesh="cell${i}" contype="1" conaffinity="2"/>`).join('');
 const heads=Array.from({length:3},(_,i)=>{const a=i*2*Math.PI/3;return`<geom type="sphere" pos="${p.radius*Math.cos(a)} ${p.radius*Math.sin(a)} 0" size="${p.headRadius}" contype="2" conaffinity="1"/>`;}).join('');
 const arms=Array.from({length:3},(_,i)=>{const a=i*2*Math.PI/3,r=(p.radius+.25)/2;return`<geom type="box" pos="${r*Math.cos(a)} ${r*Math.sin(a)} 0" quat="${Math.cos(a/2)} 0 0 ${Math.sin(a/2)}" size="${(p.radius-.25)/2} .06 .07" contype="2" conaffinity="1"/>`;}).join('');
 const xml=`<mujoco model="128 source-traced wipers"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast" iterations="80" tolerance="1e-10"><flag multiccd="disable"/></option>
 <default><geom condim="1" friction="0 0 0" solref=".002 1" solimp=".99 .999 .001"/></default><asset>${assets}</asset>
 <worldbody><body name="rotor"><joint name="rotor" type="hinge" axis="0 0 1"/><inertial pos="0 0 0" mass="1" diaginertia=".4 .4 .8"/>${heads}${arms}<geom type="cylinder" size=".41 .12" contype="2" conaffinity="1"/></body>
 <body name="frame"><joint name="frame" type="slide" axis="1 0 0" damping="${damping}" frictionloss="${guideFriction}"/><inertial pos="0 0 0" mass="2" diaginertia="3 3 5"/>${geoms}</body></worldbody>
 <actuator><position joint="rotor" kp="10000" kv="200"/></actuator></mujoco>`;
 const omega=-2*Math.PI/period;
 const input=t=>({angle:p.sourceAngle+omega*(t-.25*(1-Math.exp(-t/.25))),velocity:omega*(1-Math.exp(-t/.25))});
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos[0]=p.sourceAngle;data.qpos[1]=.03;data.ctrl[0]=p.sourceAngle;},beforeStep:({data,time})=>{const s=input(time);data.ctrl[0]=s.angle+.02*s.velocity;}});
 return Object.assign(physics,{description:{xml,input,options:{timestep,period,damping,guideFriction}}});
}
