import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');
export function makePersianDrillPhysics(mujoco,visual,{timestep=.004,period=6,contactTime=.008,friction=0,torque=0,cone='elliptic'}={}) {
 if(![timestep,period,contactTime].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(friction)||friction<0||!Number.isFinite(torque)||!['pyramidal','elliptic'].includes(cone))throw new RangeError('Invalid Persian drill physics options');
 const u=visual.root.userData,f=u.profile,mass=Object.fromEntries(['stock','grip'].map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.grip.volume,assets=[];
 const geoms=n=>u.cells[n].map((vertices,i)=>{const name=n+i;assets.push(`<mesh name="${name}" vertex="${vec(vertices.flat())}"/>`);return `<geom name="${name}" type="mesh" mesh="${name}" contype="${n==='stock'?1:2}" conaffinity="${n==='stock'?2:1}"/>`;}).join('');
 const stock=geoms('stock'),grip=geoms('grip'),inertial=n=>{const m=mass[n];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 const xml=`<mujoco model="112 Persian drill"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 0 -9.81" integrator="implicitfast" solver="Newton" cone="${cone}" iterations="60" tolerance="1e-9"/>
 <default><geom friction="${friction} .001 .001" condim="${friction?3:1}" solref="${contactTime} 1" solimp=".9999 .99999 .0001"/></default><asset>${assets.join('')}</asset><worldbody>
 <body name="stock"><joint name="turn" type="hinge" axis="0 0 1" damping=".001"/>${inertial('stock')}${stock}</body>
 <body name="grip"><joint name="feed" type="slide" axis="0 0 1" damping=".02"/>${inertial('grip')}${grip}</body></worldbody><actuator><position joint="feed" kp="5000" kv="100"/></actuator></mujoco>`;
 const omega=2*Math.PI/period,input=time=>{const s=Math.exp(-((time/.25)**2)),ramp=1-s,rampVelocity=2*time/.25**2*s;return {position:f.amplitude*Math.sin(omega*time)*ramp,velocity:f.amplitude*(omega*Math.cos(omega*time)*ramp+Math.sin(omega*time)*rampVelocity)};};
 const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qfrc_applied[0]=torque;},beforeStep:({data,time})=>{const s=input(time);data.ctrl[0]=s.position+.02*s.velocity;}});
 return Object.assign(p,{bodies:Object.fromEntries(['stock','grip'].map(n=>[n,p.id('mjOBJ_BODY',n)])),description:{xml,mass,density,cells:u.cells,input,options:{timestep,period,contactTime,friction,torque,cone},assumptions:'Only the hand grip slide is actuated. Matching multi-start thread contact drives the passive stock hinge. The stationary head bearing and the hand holding the grip against rotation are ideal. Six starts, square groove section, clearances, hidden bore, flat bit depth, inertia and drive timing are reconstructed. Native contact covers the working threads; other solid clearances require an independent surface audit.'}});
}
