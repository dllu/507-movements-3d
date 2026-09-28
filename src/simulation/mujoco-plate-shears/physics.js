import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.flat().map(v=>Number(v.toPrecision(12))).join(' ');
export function makePlateShearsPhysics(mujoco,visual,{timestep=.0005,period=4}={}){
 const u=visual.root.userData,mass=Object.fromEntries(['jaw','cam'].map(n=>[n,rigidFamilyInertia(u.parts,{jaw:'jaw',cam:'cam'},n)]));
 const density=1/mass.jaw.volume,inertia=n=>{const m=mass[n];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 const assets=u.cells.map((c,i)=>`<mesh name="jaw${i}" vertex="${vec(c)}"/>`).join('');
 const geoms=u.cells.map((_,i)=>`<geom type="mesh" mesh="jaw${i}" contype="1" conaffinity="2"/>`).join('');
 const xml=`<mujoco model="130 gravity-opened shears"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" iterations="80" tolerance="1e-10"><flag multiccd="disable"/></option>
 <default><geom condim="1" solref=".002 1" solimp=".99 .999 .001"/></default><asset>${assets}</asset>
 <worldbody><body name="cam" pos="-2.47 -.66 0"><joint name="cam" type="hinge" axis="0 0 1"/>${inertia('cam')}<geom type="sphere" pos="0 ${-u.profile.eccentricity} .08" size="${u.profile.camRadius}" contype="2" conaffinity="1"/></body>
 <body name="jaw"><joint name="jaw" type="hinge" axis="0 0 1" damping=".002"/>${inertia('jaw')}${geoms}</body></worldbody>
 <actuator><position joint="cam" kp="10000" kv="200"/></actuator></mujoco>`;
 const omega=-2*Math.PI/period,input=t=>({angle:omega*(t-.25*(1-Math.exp(-t/.25))),velocity:omega*(1-Math.exp(-t/.25))});
 const p=createMujocoSimulation(mujoco,{xml,beforeStep:({data,time})=>{const s=input(time);data.ctrl[0]=s.angle+.02*s.velocity;}});
 return Object.assign(p,{description:{xml,mass,density,input,options:{timestep,period}}});
}
