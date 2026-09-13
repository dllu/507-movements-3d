import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=values=>values.map(v=>Number(v.toPrecision(12))).join(' ');
export function makeInclinedDiskPhysics(mujoco,visual,{timestep=.001,period=4,friction=.3,contactTime=.004,settlingTime=.5,contactSides=8}={}) {
  const u=visual.root.userData,g=u.geometry,names=['input','follower','roller'];
  const mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.input.volume;
  const inertial=n=>`<inertial pos="${vec(mass[n].centroid)}" mass="${mass[n].volume*density}" fullinertia="${vec(mass[n].inertia.map(x=>x*density))}"/>`;
  const omega=-2*Math.PI/period;
  // A finite inscribed prism supplies the working flat face. Its rim is
  // outside the complete roller envelope. A cylinder/cylinder collision pair
  // incorrectly selected a distant disk edge in this MuJoCo version.
  const vertices=[-g.depth/2,g.depth/2].flatMap(z=>Array.from({length:contactSides},(_,i)=>{
    const a=2*Math.PI*i/contactSides,x=g.radius*Math.cos(a),y=g.radius*Math.sin(a);
    return [x*Math.cos(g.tilt)-z*Math.sin(g.tilt),x*Math.sin(g.tilt)+z*Math.cos(g.tilt),-y];
  }).flat());
  const xml=`<mujoco model="095 inclined disk"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <asset><mesh name="disk" vertex="${vec(vertices)}"/></asset><worldbody><body name="input"><joint name="input" type="hinge" axis="0 1 0" damping=".02"/>${inertial('input')}
      <geom name="disk" type="mesh" mesh="disk" contype="1" conaffinity="2"/></body>
      <body name="follower" pos="${g.followerX} 0 0"><joint name="follower" type="slide" axis="0 1 0" damping=".01"/>${inertial('follower')}
        <body name="roller"><joint name="roller" type="hinge" axis="1 0 0" damping=".0000001"/>${inertial('roller')}
          <geom name="roller" type="cylinder" size="${g.rollerRadius} ${g.rollerHalfWidth}" zaxis="1 0 0" contype="2" conaffinity="1"/></body>
      </body></worldbody><actuator><position name="motor" joint="input" kp="10000" kv="200"/></actuator></mujoco>`;
  const physics=createMujocoSimulation(mujoco,{xml,
    initialize:({data,model})=>{data.qpos.set([0,u.expectedHeight(0),0]);data.ctrl[0]=0;
      for(let i=0;i<Math.round(settlingTime/timestep);i++)mujoco.mj_step(model,data);
      data.time=0;data.qvel[0]=omega;data.qvel[1]=0;data.qvel[2]=omega*(g.followerX+g.rollerHalfWidth)/g.rollerRadius;data.ctrl[0]=.02*omega;},
    beforeStep:({data,time})=>{data.ctrl[0]=omega*time+.02*omega;}});
  const bodies=Object.fromEntries(names.map(n=>[n,physics.id('mjOBJ_BODY',n)]));
  return Object.assign(physics,{bodies,description:{xml,mass,density,omega,options:{timestep,period,friction,contactTime,settlingTime,contactSides}}});
}
