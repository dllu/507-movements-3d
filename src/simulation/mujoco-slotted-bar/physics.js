import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=v=>v.map(x=>Number(x.toPrecision(12))).join(' ');

export function makeSlottedBarPhysics(mujoco,visual,{timestep=.0005,period=3,friction=0,contactTime=.002,load=0}={}) {
  const u=visual.root.userData,f=u.profile,names=['lever','bar'];
  const mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.lever.volume;
  const inertial=n=>`<inertial pos="${vec(mass[n].centroid)}" mass="${mass[n].volume*density}" fullinertia="${vec(mass[n].inertia.map(x=>x*density))}"/>`;
  const strips=[-1,1].map(sign=>({name:sign<0?'lower':'upper',center:[f.center[0],f.center[1]+sign*(f.halfWidth+.03),.08],size:[f.halfLength,.03,.08]}));
  const xml=`<mujoco model="101 hanging slotted lever"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <worldbody><body name="lever"><joint name="lever" type="hinge" axis="0 0 1" damping=".02"/>${inertial('lever')}
      ${strips.map(s=>`<geom name="${s.name}" type="box" pos="${vec(s.center)}" size="${vec(s.size)}" contype="1" conaffinity="2"/>`).join('')}</body>
      <body name="bar" pos="0 ${f.barY} 0"><joint name="bar" type="slide" axis="1 0 0" damping=".02"/>${inertial('bar')}
        <geom name="pin" type="sphere" size="${f.pinRadius}" pos="0 0 .08" contype="2" conaffinity="1"/>
      </body></worldbody><actuator><position name="motor" joint="lever" kp="10000" kv="200"/></actuator></mujoco>`;
  const omega=2*Math.PI/period,input=time=>({angle:-Math.PI/2+f.amplitude*Math.cos(omega*time),velocity:-omega*f.amplitude*Math.sin(omega*time)});
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{
    data.qpos.set([f.sourceAngle,f.initialX]);data.qvel.fill(0);data.ctrl[0]=f.sourceAngle;data.qfrc_applied[1]=load;
  },beforeStep:({data,time})=>{const s=input(time);data.ctrl[0]=s.angle+.02*s.velocity;}});
  const bodies=Object.fromEntries(names.map(n=>[n,physics.id('mjOBJ_BODY',n)]));
  return Object.assign(physics,{bodies,description:{xml,strips,mass,density,input,options:{timestep,period,friction,contactTime,load}}});
}
