import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {threadContactCells} from './thread-geometry.js';
const vec=v=>v.map(x=>Number(x.toPrecision(12))).join(' ');

export function makeScrewPhysics(mujoco,visual,{timestep=.002,period=12,friction=0,contactTime=.004,load=0}={}) {
  const u=visual.root.userData,f=u.profile,mass=rigidFamilyInertia(u.parts,u.families,'nut'),density=1/mass.volume;
  const cells={screw:threadContactCells(f.external,f.contactSegments),nut:threadContactCells(f.internal,f.contactSegments)},assets=[];
  const geoms=name=>cells[name].map((vertices,i)=>{
    const id=name+i;assets.push(`<mesh name="${id}" vertex="${vec(vertices.flat())}"/>`);
    return `<geom name="${id}" type="mesh" mesh="${id}" contype="${name==='screw'?1:2}" conaffinity="${name==='screw'?2:1}"/>`;
  }).join('');
  const screw=geoms('screw'),nut=geoms('nut');
  const xml=`<mujoco model="102 threaded screw and nut"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 0 -9.81" integrator="implicitfast" solver="Newton" iterations="40" tolerance="1e-8"/>
    <default><geom friction="${friction} .001 .001" condim="${friction?3:1}" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>${screw}<body name="nut" pos="0 0 ${f.nutBase}">
      <joint name="turn" type="hinge" axis="0 0 1" damping=".02"/><joint name="feed" type="slide" axis="0 0 1" damping=".02"/>
      <inertial pos="${vec(mass.centroid)}" mass="1" fullinertia="${vec(mass.inertia.map(v=>v*density))}"/>${nut}
    </body></worldbody><actuator><position joint="turn" kp="3000" kv="60"/></actuator></mujoco>`;
  const omega=2*Math.PI/period,input=time=>({angle:-Math.PI*f.turns*(1-Math.cos(omega*time)),velocity:-Math.PI*f.turns*omega*Math.sin(omega*time)});
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qfrc_applied[1]=load;},beforeStep:({data,time})=>{const s=input(time);data.ctrl[0]=s.angle+.02*s.velocity;}});
  return Object.assign(physics,{bodies:{nut:physics.id('mjOBJ_BODY','nut')},description:{xml,cells,mass,density,input,options:{timestep,period,friction,contactTime,load}}});
}
