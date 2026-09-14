import { expansionEccentricProfile, expansionForkLimits } from '../expansion-eccentric-profile.js';
import { createMujocoSimulation } from '../mujoco/simulation.js';

export function makeExpansionEccentricPhysics(mujoco, {timestep=.0005,period=8,spread=12,samples=192}={}) {
  const profile=expansionEccentricProfile(samples),scale=.01;
  const vec=values=>values.flat().map(v=>Number(v.toPrecision(12))).join(' ');
  const assets=profile.map((p,i)=>{
    const q=profile[(i+1)%profile.length];
    const vertices=[-.2,.2].flatMap(z=>[[0,0,z],[p[0]*scale,p[1]*scale,z],[q[0]*scale,q[1]*scale,z]]);
    return `<mesh name="cam${i}" vertex="${vec(vertices)}"/>`;
  }).join('');
  const geoms=profile.map((_,i)=>`<geom type="mesh" mesh="cam${i}" contype="1" conaffinity="2"/>`).join('');
  const rollers=[['upper',-3.67,1.10+spread*scale,.31],['lower',-3.69,-1.02-spread*scale,.32]].map(([name,x,y,r])=>
    `<body name="${name}" pos="${x} ${y} 0"><joint type="hinge" axis="0 0 1" damping=".0001"/><inertial pos="0 0 0" mass=".1" diaginertia=".003 .003 .005"/><geom type="sphere" size="${r}" contype="2" conaffinity="1"/></body>`).join('');
  const xml=`<mujoco model="137 shaped expansion eccentric prototype"><compiler angle="radian" inertiafromgeom="false"/>
<option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" iterations="100" tolerance="1e-10"><flag multiccd="disable"/></option>
<default><geom condim="3" friction=".5 .001 .0001" solref=".003 1" solimp=".99 .999 .001"/></default>
<asset>${assets}</asset><worldbody>
<body name="cam"><joint name="cam" type="hinge" axis="0 0 1"/><inertial pos="0 0 0" mass="1" diaginertia=".2 .2 .3"/>${geoms}</body>
<body name="fork" pos="3.67 -.04 0"><joint name="fork" type="hinge" axis="0 0 1" damping=".1"/><inertial pos="-2.5 -.5 0" mass="1" diaginertia="1 1 2"/>${rollers}</body>
</worldbody><actuator><position joint="cam" kp="10000" kv="200"/></actuator></mujoco>`;
  const omega=2*Math.PI/period;
  const initial=expansionForkLimits(profile,0,{spread});
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos[1]=initial.upper;},beforeStep:({data,time})=>{
    const velocity=omega*(1-Math.exp(-time/.25));
    const angle=omega*(time-.25*(1-Math.exp(-time/.25)));
    data.ctrl[0]=angle+.02*velocity;
  }});
  return Object.assign(physics,{description:{xml,options:{timestep,period,spread,samples},initial,profile}});
}
