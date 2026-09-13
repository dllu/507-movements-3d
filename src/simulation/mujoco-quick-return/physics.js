import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=v=>v.map(x=>Number(x.toPrecision(12))).join(' ');

export function makeQuickReturnPhysics(mujoco,visual,{timestep=.0005,period=4,friction=0,contactTime=.002,settlingTime=.5,load=0}={}) {
  const u=visual.root.userData,f=u.profile,names=['input','rocker'];
  const mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.input.volume;
  const inertial=n=>`<inertial pos="${vec(mass[n].centroid)}" mass="${mass[n].volume*density}" fullinertia="${vec(mass[n].inertia.map(x=>x*density))}"/>`;
  // Only the straight slot walls are reached. Each box's working face is the
  // actual rendered plane; a separate finite sweep check covers the end caps.
  const strips=[-1,1].map(sign=>({name:sign<0?'lower':'upper',center:[f.center[0],f.center[1]+sign*(f.halfWidth+.02),.09],size:[f.halfLength,.02,.09]}));
  const xml=`<mujoco model="100 crank and slotted lever"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <worldbody><body name="input"><joint name="input" type="hinge" axis="0 0 1" damping=".02"/>${inertial('input')}
      <geom name="pin" type="sphere" size="${f.pinRadius}" pos="${f.crankRadius} 0 .09" contype="2" conaffinity="1"/></body>
      <body name="rocker" pos="${vec([...f.pivot,0])}"><joint name="rocker" type="hinge" axis="0 0 1" damping=".02"/>${inertial('rocker')}
        ${strips.map(s=>`<geom name="${s.name}" type="box" pos="${vec(s.center)}" size="${vec(s.size)}" contype="1" conaffinity="2"/>`).join('')}
      </body></worldbody><actuator><position name="motor" joint="input" kp="10000" kv="200"/></actuator></mujoco>`;
  const omega=-2*Math.PI/period,initial=f.sourceAngle,derivative=(f.reference(f.phase+.00001)-f.reference(f.phase-.00001))/.00002;
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({model,data})=>{
    data.qpos.set([f.phase,initial]);data.ctrl[0]=f.phase;data.qfrc_applied[1]=load;
    for(let i=0;i<Math.round(settlingTime/timestep);i++)mujoco.mj_step(model,data);
    data.time=0;data.qvel.set([omega,omega*derivative]);data.ctrl[0]=f.phase+.02*omega;
  },beforeStep:({data,time})=>{data.ctrl[0]=f.phase+omega*time+.02*omega;}});
  const bodies=Object.fromEntries(names.map(n=>[n,physics.id('mjOBJ_BODY',n)]));
  return Object.assign(physics,{bodies,description:{xml,strips,mass,density,omega,options:{timestep,period,friction,contactTime,settlingTime,load}}});
}
