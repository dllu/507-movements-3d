import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');
export function makeRackPinionPhysics(mujoco,visual,{timestep=.0005,period=6,contactTime=.002,friction=0,rollerFriction=.5,load=0,mode='pinion'}={}){
 if(![timestep,period,contactTime].every(x=>Number.isFinite(x)&&x>0)||![friction,rollerFriction].every(x=>Number.isFinite(x)&&x>=0)||!Number.isFinite(load)||!['pinion','rack'].includes(mode))throw new RangeError('Invalid 113 physics options');
 const u=visual.root.userData,f=u.profile,names=['pinion','rack','leftRoller','rightRoller'],mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.rack.volume,assets=[];
 const inertia=n=>{const m=mass[n];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 const geoms=(name,mask,other,mu)=>u.cells[name].map((cell,i)=>{const id=name+i;assets.push(`<mesh name="${id}" vertex="${vec(cell.flat())}"/>`);return `<geom name="${id}" type="mesh" mesh="${id}" contype="${mask}" conaffinity="${other}" condim="${mu?3:1}" friction="${mu} .001 .001"/>`;}).join('');
 const pinion=geoms('pinion',1,2,friction),rack=geoms('rack',2,1,friction)+geoms('rail',8,4,rollerFriction);
 const rollers=f.rollers.map(r=>`<body name="${r.name}" pos="${r.x} ${r.y} 0"><joint name="${r.name}" axis="0 0 1" damping=".0001"/>${inertia(r.name)}<geom name="${r.name}" type="cylinder" pos="0 0 ${r.z}" size="${r.radius} ${r.halfDepth}" contype="4" conaffinity="8" friction="${rollerFriction} .001 .001" condim="3"/></body>`).join('');
 const xml=`<mujoco model="113 rack and pinion"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" cone="elliptic" iterations="60" tolerance="1e-10"/><default><geom solref="${contactTime} 1" solimp=".9999 .99999 .0001"/></default><asset>${assets.join('')}</asset><worldbody>
 <body name="pinion"><joint name="pinion" axis="0 0 1" damping=".001"/>${inertia('pinion')}${pinion}</body>
 <body name="rack"><joint name="rack" type="slide" axis="1 0 0" damping=".01"/><joint name="lift" type="slide" axis="0 1 0"/>${inertia('rack')}${rack}</body>${rollers}</worldbody><actuator><position joint="pinion" kp="500" kv="20"/><position joint="rack" kp="2000" kv="40"/></actuator></mujoco>`;
 const omega=2*Math.PI/period,input=time=>{const s=Math.exp(-((time/.25)**2)),ramp=1-s,velocity=2*time/.25**2*s;return{position:f.amplitude*Math.sin(omega*time)*ramp,velocity:f.amplitude*(omega*Math.cos(omega*time)*ramp+Math.sin(omega*time)*velocity)};};
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({model,data})=>{
  data.qfrc_applied[1]=load;
  for(const [i,kp,kv]of [[0,500,20],[1,2000,40]]){const active=(mode==='pinion')===(i===0);model.actuator_gainprm[10*i]=active?kp:0;model.actuator_biasprm[10*i+1]=active?-kp:0;model.actuator_biasprm[10*i+2]=active?-kv:0;}
 },beforeStep:({data,time})=>{const s=input(time),pinionMode=mode==='pinion';data.ctrl[pinionMode?0:1]=pinionMode?-(s.position+.04*s.velocity)/f.pitchRadius:s.position+.02*s.velocity;}});
 return Object.assign(physics,{setMode(value){if(!['pinion','rack'].includes(value))throw new RangeError('Invalid 113 input');mode=value;physics.reset();},bodies:Object.fromEntries(names.map(n=>[n,physics.id('mjOBJ_BODY',n)])),description:{xml,mass,density,input,options:{timestep,period,contactTime,friction,rollerFriction,load},assumptions:'A single selected input drives its mate by native tooth contact. Gravity rests the rack on passive friction rollers. Rack orientation and depth and all shaft axes are ideal. Fifteen shallow involute pinion teeth, fourteen evenly spaced rack teeth, pressure angle, corner relief, depths, roller offset and six-second reversal timing are reconstructed.'}});
}
