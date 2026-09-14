import {variableCamProfile} from './profile.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
export function makeVariableCamPhysics(mujoco,{timestep=.0005,period=8,samplesPerArc=64}={}){
 const {points,initialRadius}=variableCamProfile(samplesPerArc);
 const vec=v=>v.flat(3).map(n=>Number(n.toPrecision(12))).join(' ');
 const prism=p=>[-.15,.15].flatMap(z=>p.map(([x,y])=>[x,y,z]));
 const assets=points.map((p,i)=>`<mesh name="c${i}" vertex="${vec(prism([[0,0],p,points[(i+1)%points.length]]))}"/>`).join('');
 const cells=points.map((_,i)=>`<geom type="mesh" mesh="c${i}" contype="1" conaffinity="2"/>`).join('');
 const xml=`<mujoco model="138 passive pointed follower"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -191.41463414634146 0" integrator="implicitfast" iterations="100" tolerance="1e-10"><flag multiccd="disable"/></option>
 <default><geom condim="1" solref=".001 1" solimp=".99 .999 .001"/></default>
 <asset>${assets}<mesh name="tip" vertex="${vec(prism([[0,0],[.12,.24],[-.12,.24]]))}"/></asset>
 <worldbody><body name="cam"><joint name="cam" axis="0 0 1"/><inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/>${cells}</body>
 <body name="follower"><joint name="follower" type="slide" axis="0 1 0"/><inertial pos="0 3 0" mass="1" diaginertia="3 .01 3"/><geom type="mesh" mesh="tip" contype="2" conaffinity="1"/></body></worldbody>
 <actuator><position joint="cam" kp="500000" kv="10000"/></actuator></mujoco>`;
 const omega=-2*Math.PI/period;
 const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos[1]=initialRadius;},beforeStep:({data,time})=>{
  data.ctrl[0]=omega*(time-.25*(1-Math.exp(-time/.25)))+.02*omega*(1-Math.exp(-time/.25));
 }});
 return Object.assign(p,{description:{options:{timestep,period,samplesPerArc},points,initialRadius}});
}
