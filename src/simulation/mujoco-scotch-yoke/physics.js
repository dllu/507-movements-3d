import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec=values=>values.map(v=>Number(v.toPrecision(12))).join(' ');
export function makeScotchYokePhysics(mujoco,visual,{timestep=.001,period=4,friction=.05,contactTime=.004,settlingTime=1,motorStiffness=10000,motorDamping=200}={}) {
  const u=visual.root.userData,g=u.geometry,phase=u.source.phase;
  const mass=Object.fromEntries(['input','yoke'].map(name=>[name,rigidFamilyInertia(u.parts,u.families,name)])),density=1/mass.input.volume;
  const inertial=name=>`<inertial pos="${vec(mass[name].centroid)}" mass="${mass[name].volume*density}" fullinertia="${vec(mass[name].inertia.map(x=>x*density))}"/>`;
  const faces=[1,-1].map((sign,i)=>{
    const ys=[g.roots[i],sign*g.slotRadius].sort((a,b)=>a-b);
    return `<geom name="face${i}" type="box" pos="${vec([(g.slotEnds[0]+g.slotEnds[1])/2,(ys[0]+ys[1])/2,.36])}" size="${vec([(g.slotEnds[1]-g.slotEnds[0])/2,(ys[1]-ys[0])/2,.13])}" contype="2" conaffinity="1"/>`;
  }).join('');
  const xml=`<mujoco model="093 Scotch yoke"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <worldbody><body name="input"><joint name="input" type="hinge" axis="0 0 1" damping=".02"/>${inertial('input')}
      <geom name="wrist" type="cylinder" size="${g.wristRadius} .215" pos="${g.crankRadius} 0 .315" contype="1" conaffinity="2"/></body>
      <body name="yoke"><joint name="yoke" type="slide" axis="0 1 0" damping=".1"/>${inertial('yoke')}${faces}</body></worldbody>
    <actuator><position name="motor" joint="input" kp="${motorStiffness}" kv="${motorDamping}"/></actuator></mujoco>`;
  const omega=-2*Math.PI/period;
  const physics=createMujocoSimulation(mujoco,{xml,
    initialize:({data,model})=>{
      data.qpos.set([phase,g.crankRadius*Math.sin(phase)-g.clearance]);data.ctrl[0]=phase;
      for(let i=0;i<Math.round(settlingTime/timestep);i++)mujoco.mj_step(model,data);
      data.time=0;data.qvel[0]=omega;data.qvel[1]=g.crankRadius*Math.cos(data.qpos[0])*omega;
      data.ctrl[0]=phase+motorDamping/motorStiffness*omega;
    },beforeStep:({data,time})=>{data.ctrl[0]=phase+omega*time+motorDamping/motorStiffness*omega;},
  });
  const joints=Object.fromEntries(['input','yoke'].map(name=>{const id=physics.id('mjOBJ_JOINT',name);return [name,{q:physics.model.jnt_qposadr[id],v:physics.model.jnt_dofadr[id]}];}));
  const bodies=Object.fromEntries(Object.keys(joints).map(name=>[name,physics.id('mjOBJ_BODY',name)]));
  return Object.assign(physics,{joints,bodies,description:{xml,mass,density,options:{timestep,period,friction,contactTime,settlingTime,motorStiffness,motorDamping}}});
}
