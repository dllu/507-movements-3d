import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
const vec=v=>v.map(x=>Number(x.toPrecision(12))).join(' ');

export function makeGroovedHeartPhysics(mujoco,visual,{timestep=.0005,period=4,friction=.03,contactTime=.004,settlingTime=.5,load=0}={}) {
  const u=visual.root.userData,names=['input','follower'],mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.input.volume;
  const inertial=n=>`<inertial pos="${vec(mass[n].centroid)}" mass="${mass[n].volume*density}" fullinertia="${vec(mass[n].inertia.map(x=>x*density))}"/>`;
  const collision=Object.fromEntries(['inner','outer'].map(n=>[n,convexPlateCells(u.parts[n].geometry)])),assets=[];
  const cam=Object.entries(collision).flatMap(([part,c])=>c.cells.map((cell,i)=>{
    const name=part+i,vertices=[c.low,c.high].flatMap(z=>cell.flatMap(p=>[...p,z]));
    assets.push(`<mesh name="${name}" vertex="${vec(vertices)}"/>`);
    return `<geom name="${name}" type="mesh" mesh="${name}" contype="1" conaffinity="2"/>`;
  })).join('');
  // The capsule shares the cylindrical pin's working radius; its remote
  // rounded ends stay inside the finite pin and clear the groove floor.
  const xml=`<mujoco model="097 grooved heart cam"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>
      <body name="input"><joint name="input" type="hinge" axis="0 0 1" damping=".02"/>${inertial('input')}${cam}</body>
      <body name="follower"><joint name="follower" type="slide" axis="1 0 0" damping=".02"/>${inertial('follower')}
        <geom name="pin" type="capsule" size="${u.profile.pinRadius}" fromto="0 0 -.05 0 0 .04" contype="2" conaffinity="1"/>
      </body></worldbody><actuator><position name="motor" joint="input" kp="10000" kv="200"/></actuator></mujoco>`;
  const omega=-2*Math.PI/period;
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({model,data})=>{
    data.qpos.set([0,u.profile.minimum]);data.ctrl[0]=0;data.qfrc_applied[1]=load;
    for(let i=0;i<Math.round(settlingTime/timestep);i++)mujoco.mj_step(model,data);
    data.time=0;data.qvel.set([omega,0]);data.ctrl[0]=.02*omega;
  },beforeStep:({data,time})=>{data.ctrl[0]=omega*time+.02*omega;}});
  const bodies=Object.fromEntries(names.map(n=>[n,physics.id('mjOBJ_BODY',n)]));
  return Object.assign(physics,{bodies,description:{xml,collision,mass,density,omega,options:{timestep,period,friction,contactTime,settlingTime,load}}});
}
