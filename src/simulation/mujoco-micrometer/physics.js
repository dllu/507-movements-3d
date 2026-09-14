import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');
export function makeMicrometerPhysics(mujoco,visual,{timestep=.002,period=16,contactTime=.004,friction=0,load=0,threadModel='ideal'}={}) {
 if(![timestep,period,contactTime].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(load)||!Number.isFinite(friction)||friction<0||!['ideal','contact'].includes(threadModel))throw new RangeError('Invalid micrometer physics options');
 const ideal=threadModel==='ideal';
 const u=visual.root.userData,f=u.profile,assets=[],mass=Object.fromEntries(['outer','inner'].map(name=>[name,rigidFamilyInertia(u.parts,u.families,name)])),density=1/mass.outer.volume;
 const geoms=name=>ideal?'':u.cells[name].map((vertices,i)=>{const id=name+i;assets.push(`<mesh name="${id}" vertex="${vec(vertices.flat())}"/>`);return `<geom name="${id}" type="mesh" mesh="${id}" contype="${name==='outer'?1:2}" conaffinity="${name==='outer'?2:1}"/>`;}).join('');
 const outer=geoms('outer'),inner=geoms('inner'),inertial=name=>{const m=mass[name];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 const xml=`<mujoco model="111 nested differential micrometer"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${timestep}" gravity="0 0 -9.81" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9"/>
 <default><geom friction="${friction} .001 .001" condim="${friction?3:1}" solref="${contactTime} 1" solimp=".9999 .99999 .0001"/></default>
 <asset>${assets.join('')}</asset><worldbody><body name="outer"><joint name="turn" type="hinge" axis="0 0 1" damping=".02"/><joint name="outerFeed" type="slide" axis="0 0 1" damping=".02"/>${inertial('outer')}${outer}${ideal?'':'</body>'}
 <body name="inner"><joint name="innerFeed" type="slide" axis="0 0 1" damping=".02"/>${ideal?'<joint name="innerCounterRotation" type="hinge" axis="0 0 1" damping=".02"/>':''}${inertial('inner')}${inner}</body>${ideal?'</body>':''}</worldbody>
 <equality><joint name="fixedNut" joint1="outerFeed" joint2="turn" polycoef="0 ${f.leadOuter} 0 0 0" solref=".002 1" solimp=".9999 .99999 .0001"/>
 ${ideal?`<joint name="nestedThread" joint1="innerFeed" joint2="turn" polycoef="0 ${-f.leadInner} 0 0 0" solref=".002 1" solimp=".9999 .99999 .0001"/><joint name="antirotation" joint1="innerCounterRotation" joint2="turn" polycoef="0 -1 0 0 0" solref=".002 1" solimp=".9999 .99999 .0001"/>`:''}</equality>
 <actuator><position joint="turn" kp="3000" kv="60"/></actuator></mujoco>`;
 const frequency=2*Math.PI/period,input=time=>({angle:Math.PI*f.turns*(1-Math.cos(frequency*time)),velocity:Math.PI*f.turns*frequency*Math.sin(frequency*time)});
 const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qfrc_applied[2]=load;if(ideal)data.qfrc_applied[1]=load;},beforeStep:({data,time})=>{const s=input(time);data.ctrl[0]=s.angle+.02*s.velocity;}});
 const coordinates=()=>({angle:p.data.qpos[0],sleeve:p.data.qpos[1],output:ideal?p.data.qpos[1]+p.data.qpos[2]:p.data.qpos[2],innerRotation:ideal?p.data.qpos[0]+p.data.qpos[3]:0});
 return Object.assign(p,{coordinates,bodies:Object.fromEntries(['outer','inner'].map(n=>[n,p.id('mjOBJ_BODY',n)])),description:{xml,mass,density,cells:u.cells,input,options:{timestep,period,contactTime,friction,load,threadModel},assumptions:'Only sleeve rotation is actuated. A native ideal screw constraint represents the omitted fixed outer nut. '+(ideal?'A second ideal helical joint and an antirotation constraint couple the passive inner slide. ':'Matching same-hand internal/external thread contact drives the passive inner slide in an ideal axial guide. ')+'Gravity, density, clearance, hidden lengths and the reversing drive are reconstructed.'}});
}
