import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');
export function makeEndlessRackPhysics(mujoco,visual,{timestep=.0005,period=8,contactTime=.002,friction=0,load=0,gravity=-9.81,guideDamping=.01,retention=10000,retentionDamping=100}={}){
 if(![timestep,period,contactTime].every(v=>Number.isFinite(v)&&v>0)||![friction,guideDamping,retention,retentionDamping].every(v=>Number.isFinite(v)&&v>=0)||![load,gravity].every(Number.isFinite))throw new RangeError('Invalid 119 physics options');
 const u=visual.root.userData,f=u.profile,names=['carrier','pinion','rack'],mass=Object.fromEntries(names.map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.rack.volume,assets=[];
 const inertia=n=>{const m=mass[n];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 const geoms=(name,mask,other)=>u.cells[name].map((cell,i)=>{const id=name+i;assets.push(`<mesh name="${id}" vertex="${vec(cell.flat())}"/>`);return `<geom name="${id}" type="mesh" mesh="${id}" contype="${mask}" conaffinity="${other}"/>`;}).join('');
 const pinion=geoms('pinion',1,2),rack=geoms('rack',2,1),omega=-f.length/(f.R*period);
 const xml=`<mujoco model="119 endless rack"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 ${gravity} 0" integrator="discrete" solver="Newton" iterations="80" tolerance="1e-10" cone="elliptic"><flag multiccd="disable" diagexact="enable"/></option><default><geom condim="${friction?3:1}" friction="${friction} .001 .001" solref="${contactTime} 1" solimp=".99 .999 .001"/></default><asset>${assets.join('')}</asset><worldbody><body name="carrier" pos="0 ${f.H} 0"><joint name="carrier" type="slide" axis="0 1 0" limited="true" range="${-2*f.H-.00245} .00245" solreflimit=".002 1" solimplimit=".99 .999 .001" damping="${guideDamping}"/>${inertia('carrier')}<body name="pinion"><joint name="pinion" axis="0 0 1" damping=".001"/>${inertia('pinion')}${pinion}</body></body><body name="rack" pos="${f.rackOffset} 0 0"><joint name="rack" type="slide" axis="1 0 0" damping="${guideDamping}"/>${inertia('rack')}${rack}</body></worldbody><actuator><position joint="pinion" kp="2000" kv="40"/></actuator></mujoco>`;
 const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qvel[1]=omega;data.qvel[2]=omega*f.R;data.qfrc_applied[2]=load;},beforeStep:({data,time})=>{
  data.ctrl[0]=omega*time+.02*omega;
  // Ideal mesh retention represents unpictured engagement support. Its
  // normal spring depends only on current geometry, never input phase.
  const x=-data.qpos[2]-f.rackOffset,y=data.qpos[0]+f.H,dx=x-Math.max(-f.L,Math.min(f.L,x)),r=Math.hypot(dx,y),nx=r>1e-12?dx/r:0,ny=r>1e-12?y/r:0;
  const normalSpeed=-nx*data.qvel[2]+ny*data.qvel[0],force=retention?retention*(r-f.H)+retentionDamping*normalSpeed:0;
  data.qfrc_applied[0]=-force*ny;data.qfrc_applied[2]=load+force*nx;
 }});
 return Object.assign(p,{bodies:Object.fromEntries(names.map(n=>[n,p.id('mjOBJ_BODY',n)])),description:{xml,mass,density,omega,options:{timestep,period,contactTime,friction,load,gravity,guideDamping,retention,retentionDamping},assumptions:'Uniform pinion input with native tooth-driven rack travel and shaft lift. Horizontal bearings and finite vertical slot limits are ideal. A geometric normal spring represents additional unpictured engagement support; it applies no tangential force and does not prescribe output phase. Hidden depths and the flattened rear rod attachment are reconstructed.'}});
}
