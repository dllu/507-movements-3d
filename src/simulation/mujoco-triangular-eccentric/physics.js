import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec=values=>values.map(v=>Number(v.toPrecision(12))).join(' ');

export function makeTriangularEccentricPhysics(mujoco,visual,{timestep=.001,period=4,friction=.05,
  contactTime=.004,settlingTime=1,motorStiffness=10000,motorDamping=200}={}) {
  const u=visual.root.userData,g=u.geometry,phase=u.source.phase;
  const mass=Object.fromEntries(['input','yoke'].map(name=>[name,rigidFamilyInertia(u.parts,u.families,name)]));
  const density=1/mass.input.volume;
  const inertial=name=>`<inertial pos="${vec(mass[name].centroid)}" mass="${mass[name].volume*density}" fullinertia="${vec(mass[name].inertia.map(x=>x*density))}"/>`;
  const vertices=[-g.depth/2,g.depth/2].flatMap(z=>u.profiles.cam.map(xy=>[...xy,z]));
  const liners=[0,1].map(i=>{
    const mesh=u.parts['liner'+i],p=mesh.geometry.parameters;
    return `<geom name="liner${i}" type="box" pos="${vec(mesh.position.toArray())}" size="${vec([p.width/2,p.height/2,p.depth/2])}" contype="2" conaffinity="1"/>`;
  }).join('');
  const xml=`<mujoco model="091 triangular eccentric valve motion"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <asset><mesh name="cam" vertex="${vec(vertices.flat())}"/></asset><worldbody>
      <body name="input"><joint name="input" type="hinge" axis="0 0 1" damping=".02"/>${inertial('input')}
        <geom name="cam" type="mesh" mesh="cam" contype="1" conaffinity="2"/></body>
      <body name="yoke"><joint name="yoke" type="slide" axis="0 1 0" damping=".1"/>${inertial('yoke')}${liners}</body>
    </worldbody><actuator><position name="motor" joint="input" kp="${motorStiffness}" kv="${motorDamping}"/></actuator></mujoco>`;
  // A stiff powered shaft approximates the specified steady input speed. The
  // velocity feedforward prevents its damping term from adding a phase lag.
  const omega=-2*Math.PI/period;
  const physics=createMujocoSimulation(mujoco,{xml,
    initialize:({model,data,id})=>{
      const input=id('mjOBJ_JOINT','input'),yoke=id('mjOBJ_JOINT','yoke');
      data.qpos[model.jnt_qposadr[input]]=phase;
      data.qpos[model.jnt_qposadr[yoke]]=u.profile.amplitude-g.clearance;
      data.ctrl[0]=phase;
      for(let i=0;i<Math.round(settlingTime/timestep);i++)mujoco.mj_step(model,data);
      data.time=0;data.qvel[model.jnt_dofadr[input]]=omega;
      data.ctrl[0]=phase+motorDamping/motorStiffness*omega;
    },
    beforeStep:({data,time})=>{data.ctrl[0]=phase+omega*time+motorDamping/motorStiffness*omega;},
  });
  const joints=Object.fromEntries(['input','yoke'].map(name=>{
    const id=physics.id('mjOBJ_JOINT',name);return [name,{q:physics.model.jnt_qposadr[id],v:physics.model.jnt_dofadr[id]}];
  }));
  const bodies=Object.fromEntries(Object.keys(joints).map(name=>[name,physics.id('mjOBJ_BODY',name)]));
  return Object.assign(physics,{joints,bodies,description:{xml,mass,density,vertices,
    options:{timestep,period,friction,contactTime,settlingTime,motorStiffness,motorDamping,omega}}});
}
