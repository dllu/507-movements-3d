import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {convexPlatePieces} from '../mujoco-treadle/collision.js';
const vec=v=>v.map(x=>Number(x.toPrecision(12))).join(' ');
export function makeHeartCamPhysics(mujoco,visual,{timestep=.0005,period=4,friction=.15,contactTime=.004,settlingTime=.5,stiffness=5,springReference=-1}={}) {
  const u=visual.root.userData,g=u.geometry,names=['input','follower','roller'],mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.input.volume;
  const inertial=n=>`<inertial pos="${vec(mass[n].centroid)}" mass="${mass[n].volume*density}" fullinertia="${vec(mass[n].inertia.map(x=>x*density))}"/>`;
  const collision=convexPlatePieces(u.parts.cam.geometry,0),assets=[];
  const cam=collision.cells.map((cell,i)=>{const name='cam'+i,vertices=[collision.low,collision.high].flatMap(z=>cell.flatMap(xy=>[...xy,z]));assets.push(`<mesh name="${name}" vertex="${vec(vertices)}"/>`);return `<geom name="${name}" type="mesh" mesh="${name}" contype="1" conaffinity="2"/>`;}).join('');
  // The capsule stays inside the roller's outer envelope and shares its
  // working circular boundary. It fills the inaccessible pin bore; ideal
  // planar joints exclude tilt. Rounded remote ends avoid flat-end chatter.
  const xml=`<mujoco model="096 heart cam"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>
      <body name="input"><joint name="input" type="hinge" axis="0 0 1" damping=".02"/>${inertial('input')}${cam}</body>
      <body name="follower"><joint name="follower" type="slide" axis="1 0 0" stiffness="${stiffness}" springref="${springReference}" damping=".02"/>${inertial('follower')}
        <body name="roller"><joint name="roller" type="hinge" axis="0 0 1" damping=".0000001"/>${inertial('roller')}
          <geom name="roller" type="capsule" size="${g.rollerRadius}" fromto="0 0 -.01 0 0 0" contype="2" conaffinity="1"/></body>
      </body></worldbody><actuator><position name="motor" joint="input" kp="10000" kv="200"/></actuator></mujoco>`;
  const omega=-2*Math.PI/period;
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({model,data})=>{
    data.qpos.set([0,u.profile.minimum,0]);data.ctrl[0]=0;
    for(let i=0;i<Math.round(settlingTime/timestep);i++)mujoco.mj_step(model,data);
    data.time=0;data.qvel[0]=omega;data.qvel[1]=0;data.qvel[2]=-omega*(u.profile.minimum-g.rollerRadius)/g.rollerRadius;data.ctrl[0]=.02*omega;
  },beforeStep:({data,time})=>{data.ctrl[0]=omega*time+.02*omega;}});
  const bodies=Object.fromEntries(names.map(n=>[n,physics.id('mjOBJ_BODY',n)]));
  return Object.assign(physics,{bodies,description:{xml,collision,mass,density,omega,options:{timestep,period,friction,contactTime,settlingTime,stiffness,springReference}}});
}
