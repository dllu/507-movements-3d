import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec=values=>values.map(v=>Number(v.toPrecision(12))).join(' ');

export function makeCrankSliderPhysics(mujoco,visual,{timestep=.001,period=4,motorStiffness=10000,motorDamping=200,closureTime=.003}={}) {
  const u=visual.root.userData,g=u.geometry,initial=u.atAngle(g.phase);
  const mass=Object.fromEntries(['input','rod','slider'].map(name=>[name,rigidFamilyInertia(u.parts,u.families,name)])),density=1/mass.input.volume;
  const inertial=name=>`<inertial pos="${vec(mass[name].centroid)}" mass="${mass[name].volume*density}" fullinertia="${vec(mass[name].inertia.map(x=>x*density))}"/>`;
  const xml=`<mujoco model="092 ordinary crank motion"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-10"/>
    <default><joint damping=".01"/><equality solref="${closureTime} 1" solimp=".999 .9999 .0001"/></default>
    <worldbody><body name="input"><joint name="input" type="hinge" axis="0 0 1"/>${inertial('input')}
      <body name="rod" pos="${g.r} 0 0"><joint name="rod" type="hinge" axis="0 0 1"/>${inertial('rod')}
        <site name="rodEnd" pos="${g.length} 0 .26"/></body></body>
      <body name="slider" pos="0 ${g.offset} 0"><joint name="slider" type="slide" axis="1 0 0" damping=".1"/>${inertial('slider')}
        <site name="wrist" pos="0 0 .26"/></body></worldbody>
    <equality><connect name="wrist" site1="rodEnd" site2="wrist"/></equality>
    <actuator><position name="motor" joint="input" kp="${motorStiffness}" kv="${motorDamping}"/></actuator></mujoco>`;
  const omega=-2*Math.PI/period;
  const physics=createMujocoSimulation(mujoco,{xml,
    initialize:({data})=>{
      data.qpos.set([g.phase,initial.rodAngle-g.phase,initial.slider]);
      const dy=g.offset-initial.pin[1],dx=initial.slider-initial.pin[0],rodSpeed=-g.r*Math.cos(g.phase)/dx*omega;
      data.qvel.set([omega,rodSpeed-omega,(-g.r*Math.sin(g.phase)+dy*g.r*Math.cos(g.phase)/dx)*omega]);
      data.ctrl[0]=g.phase+motorDamping/motorStiffness*omega;
    },
    beforeStep:({data,time})=>{data.ctrl[0]=g.phase+omega*time+motorDamping/motorStiffness*omega;},
  });
  const names=['input','rod','slider'];
  const joints=Object.fromEntries(names.map(name=>{const id=physics.id('mjOBJ_JOINT',name);return [name,{q:physics.model.jnt_qposadr[id],v:physics.model.jnt_dofadr[id]}];}));
  const bodies=Object.fromEntries(names.map(name=>[name,physics.id('mjOBJ_BODY',name)]));
  return Object.assign(physics,{joints,bodies,description:{xml,mass,density,options:{timestep,period,motorStiffness,motorDamping,closureTime}}});
}
