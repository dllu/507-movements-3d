import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.map(v=>Math.abs(v)<1e-12?0:Number(v.toPrecision(12))).join(' ');
export function makeReverseThreadPhysics(mujoco,visual,{timestep=.0005,period=33,kp=10000,kv=200,load=0,friction=.03,contactTime=.002,swivelDamping=.003,contactImpedance=[.9,.95,.001],exactInertia=true,integrator='discrete'}={}) {
 const u=visual.root.userData,f=u.profile,mass=Object.fromEntries(['input','follower','shoe'].map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.input.volume;
 const inertia=n=>{const m=mass[n];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 // Body inertias come from the complete rendered solids above. Mesh inertias
 // are unused; shell integration lets very thin intersection cells compile
 // without changing their contact hull or assigning them artificial volume.
 const assets=[],geoms=[];u.collision.lands.forEach((cell,i)=>{assets.push(`<mesh name="land${i}" inertia="shell" vertex="${vec(cell.flat())}"/>`);geoms.push(`<geom name="land${i}" type="mesh" mesh="land${i}" contype="1" conaffinity="2"/>`);});
 const shoeGeoms=[];u.collision.shoe.forEach((cell,i)=>{assets.push(`<mesh name="shoe${i}" inertia="shell" vertex="${vec(cell.flat())}"/>`);shoeGeoms.push(`<geom name="shoe${i}" type="mesh" mesh="shoe${i}" contype="2" conaffinity="1"/>`);});
 const impedance=contactImpedance===undefined?'.99 .9999 .0001':Array.isArray(contactImpedance)?vec(contactImpedance):`${contactImpedance} ${contactImpedance} .001`;
 const xml=`<mujoco model="108 crossing reverse-thread traverse"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="${integrator}" solver="Newton" iterations="40" tolerance="1e-10"><flag diagexact="${exactInertia?'enable':'disable'}"/></option>
 <default><geom friction="${friction} 0 0" condim="${friction===0?1:3}" solref="${contactTime} 1" solimp="${impedance}"/></default><asset>${assets.join('')}</asset><worldbody>
 <body name="input"><joint name="input" type="hinge" axis="0 1 0" damping=".01"/>${inertia('input')}${geoms.join('')}
 <geom name="core" type="cylinder" size="${f.floor} ${(f.ceiling-f.bottom)/2}" pos="0 ${(f.ceiling+f.bottom)/2} 0" quat=".7071067811865476 .7071067811865476 0 0" contype="1" conaffinity="2"/></body>
 <body name="follower"><joint name="follower" type="slide" axis="0 1 0" damping=".01"/>${inertia('follower')}
 <body name="shoe" pos="0 ${f.initialY} 0" quat="${vec([Math.cos(f.contactAngle/2),0,Math.sin(f.contactAngle/2),0])}"><joint name="swivel" type="hinge" axis="0 0 1" damping="${swivelDamping}"/>${inertia('shoe')}${shoeGeoms.join('')}</body></body>
 </worldbody><actuator><position joint="input" kp="${kp}" kv="${kv}"/></actuator></mujoco>`;
 const omega=f.period/period;
 const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos[2]=f.initialTilt;data.qvel[0]=omega;data.qvel[1]=-omega*f.law(f.initialParameter).derivative;data.qfrc_applied[1]=load;},beforeStep:({data,time})=>{data.ctrl[0]=omega*time+kv/kp*omega;}});
 return Object.assign(p,{bodies:Object.fromEntries(['input','follower','shoe'].map(n=>[n,p.id('mjOBJ_BODY',n)])),description:{mass,density,xml,omega,options:{timestep,period,kp,kv,load,friction,contactTime,swivelDamping,contactImpedance,exactInertia,integrator}}});
}
