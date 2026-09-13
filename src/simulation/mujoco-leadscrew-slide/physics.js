import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {threadContactCells} from '../mujoco-screw/thread-geometry.js';
const vec=v=>v.map(x=>Number(x.toPrecision(12))).join(' ');
export function makeLeadscrewSlidePhysics(mujoco,visual,{timestep=.002,period=8,friction=0,guideFriction=.05,contactTime=.02,load=0}={}) {
  const u=visual.root.userData,f=u.profile,mass=Object.fromEntries(['screw','carriage'].map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.screw.volume;
  const cells=Object.fromEntries([['screw',f.external],['carriage',f.internal]].map(([n,p])=>[n,threadContactCells(p,f.contactSegments).map(cell=>cell.map(([x,y,z])=>[z,y,-x]))])),assets=[];
  const body=(name,joint)=>{
    const geoms=cells[name].map((vertices,i)=>{const id=name+i;assets.push(`<mesh name="${id}" vertex="${vec(vertices.flat())}"/>`);return `<geom name="${id}" type="mesh" mesh="${id}" contype="${name==='screw'?1:2}" conaffinity="${name==='screw'?2:1}"/>`;}).join(''),m=mass[name];
    return `<body name="${name}" pos="${name==='screw'?0:f.carriageBase} 0 0"><joint name="${name}" type="${joint}" axis="1 0 0" damping=".02" frictionloss="${name==='carriage'?guideFriction*m.volume*density*9.81:0}"/>
      <inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>${geoms}</body>`;
  };
  const bodies=body('screw','hinge')+body('carriage','slide');
  const xml=`<mujoco model="103 screw driven guided slide"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="40" tolerance="1e-8"/>
    <default><geom friction="${friction} .001 .001" condim="${friction?3:1}" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>${bodies}</worldbody><actuator><position joint="screw" kp="3000" kv="60"/></actuator></mujoco>`;
  const omega=2*Math.PI/period,input=time=>({angle:Math.PI*f.turns*(1-Math.cos(omega*time)),velocity:Math.PI*f.turns*omega*Math.sin(omega*time)});
  const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qfrc_applied[1]=load;},beforeStep:({data,time})=>{const s=input(time);data.ctrl[0]=s.angle+.02*s.velocity;}});
  return Object.assign(physics,{bodies:Object.fromEntries(['screw','carriage'].map(n=>[n,physics.id('mjOBJ_BODY',n)])),description:{xml,cells,mass,density,input,options:{timestep,period,friction,guideFriction,contactTime,load}}});
}
