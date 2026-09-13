import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=v=>v.map(x=>Math.abs(x)<1e-12?0:Number(x.toPrecision(12))).join(' ');

export function makeBarrelCamPhysics(mujoco,visual,{timestep=.0005,period=4,kp=10000,kv=200,friction=.03,contactTime=.004,load=0}={}) {
  const u=visual.root.userData,f=u.profile,mass=Object.fromEntries(['input','follower'].map(name=>[name,rigidFamilyInertia(u.parts,u.families,name)])),density=1/mass.input.volume;
  const inertia=name=>{const m=mass[name];return`<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(x=>x*density))}"/>`;};
  const assets=[],geoms=[];
  for(const [part,cells] of Object.entries(u.collision))cells.forEach((cell,i)=>{
    const name=part+i;assets.push(`<mesh name="${name}" vertex="${vec(cell.flat())}"/>`);geoms.push(`<geom name="${name}" type="mesh" mesh="${name}" contype="1" conaffinity="2"/>`);
  });
  const xml=`<mujoco model="106 reversing groove barrel cam"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="40" tolerance="1e-10"/>
    <default><geom friction="${friction} 0 0" condim="3" solref="${contactTime} 1" solimp=".99 .9999 .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>
      <body name="input"><joint name="input" type="hinge" axis="1 0 0" damping=".01"/>${inertia('input')}${geoms.join('')}</body>
      <body name="follower"><joint name="follower" type="slide" axis="1 0 0" damping=".01"/>${inertia('follower')}
        <geom name="shoe" type="capsule" size="${f.pinRadius} ${(f.pinHigh-f.pinLow)/2}" pos="${f.initialTip} ${(f.pinHigh+f.pinLow)/2} 0" quat=".7071067811865476 .7071067811865476 0 0" contype="2" conaffinity="1"/>
      </body></worldbody><actuator><position joint="input" kp="${kp}" kv="${kv}"/></actuator>
  </mujoco>`;
  const omega=-2*Math.PI/period;
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qvel[0]=omega;data.qvel[1]=-omega*f.law(0).derivative;data.qfrc_applied[1]=load;},
    beforeStep:({data,time})=>{data.ctrl[0]=omega*time+kv/kp*omega;}});
  return Object.assign(physics,{bodies:Object.fromEntries(['input','follower'].map(name=>[name,physics.id('mjOBJ_BODY',name)])),
    description:{mass,density,collision:u.collision,options:{timestep,period,kp,kv,friction,contactTime,load},xml,omega}});
}
