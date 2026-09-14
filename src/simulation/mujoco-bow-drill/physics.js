import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

/** Experimental contact-driven cord; not registered for production playback. */
export function makeBowDrillPhysics(mujoco,visual,{timestep=.002,period=4,
  friction=.8,preload=.03,stiffness=200,ropeDensity=null,load=0,gravity=9.81,
  contactTime=.004,edgeTime=.004,impedance=.99999,iterations=60,ccdTolerance=1e-10}={}) {
  if(![timestep,period,stiffness,contactTime,edgeTime,ccdTolerance].every(x=>Number.isFinite(x)&&x>0)
    || ![friction,preload].every(x=>Number.isFinite(x)&&x>=0)
    || ![load,gravity].every(Number.isFinite) || !(impedance>0&&impedance<1)
    || !Number.isInteger(iterations)||iterations<1
    || (ropeDensity!==null&&!(Number.isFinite(ropeDensity)&&ropeDensity>0)))throw new RangeError('Invalid 124 physics options');
  const u=visual.root.userData,{lower,upper,cordPath:path,cordRadius,drumRadius,cordSegments:segments,amplitude}=u.profile;
  const chordLength=Math.hypot(upper[0]-lower[0],upper[1]-lower[1]);
  const direction=[(upper[0]-lower[0])/chordLength,(upper[1]-lower[1])/chordLength,0];
  const masses=Object.fromEntries(['bow','spindle'].map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)]));
  const density=1/masses.bow.volume,cordDensity=ropeDensity??density;
  const inertial=n=>{const m=masses[n];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(x=>x*density))}"/>`;};
  const lengths=path.points.slice(1).map((p,i)=>distance(p,path.points[i]));
  // Nonadjacent capsules must not overlap just because the mesh is too fine.
  // A higher-resolution cord needs a different local self-contact exclusion.
  if(Math.min(...lengths)<2.05*cordRadius)throw new RangeError('124 cord elements are too short for native self contact');
  const vertices=path.points.map((p,i)=>i===0||i===segments?p:[0,0,0]);
  const bodyNames=path.points.map((p,i)=>i===0?'lowerTip':i===segments?'bow':'v'+i);
  const particles=path.points.slice(1,-1).map((p,i)=>{
    const mass=Math.PI*cordRadius**2*cordDensity*(lengths[i]+lengths[i+1])/2;
    return `<body name="v${i+1}" pos="${vec(p)}"><inertial pos="0 0 0" mass="${mass}" diaginertia="1e-8 1e-8 1e-8"/><joint type="slide" axis="1 0 0"/><joint type="slide" axis="0 1 0"/><joint type="slide" axis="0 0 1"/></body>`;
  }).join('\n');
  const contact=`contype="1" conaffinity="2" friction="${friction} .001 .001" condim="${friction?3:1}" solref="${contactTime} 1" solimp=".99 .999 .001"`;
  const xml=`<mujoco model="124 native flex cord"><compiler angle="radian" inertiafromgeom="false"/>
<option timestep="${timestep}" gravity="0 ${-gravity} 0" integrator="implicitfast" solver="Newton" iterations="${iterations}" tolerance="1e-9" ccd_tolerance="${ccdTolerance}" cone="elliptic"/><size memory="64M"/>
<worldbody><body name="spindle"><joint name="spin" axis="0 0 1" damping=".005"/>${inertial('spindle')}
<geom name="drum" type="cylinder" size="${drumRadius} .16" ${contact}/>
<geom name="front" type="cylinder" size="${u.source.circles.outer.radius/100} .02" pos="0 0 .18" ${contact}/>
<geom name="back" type="cylinder" size="${u.source.circles.outer.radius/100} .02" pos="0 0 -.18" ${contact}/></body>
<body name="bow"><joint name="drive" type="slide" axis="${vec(direction)}"/>${inertial('bow')}
<body name="lowerTip"><joint name="tension" type="slide" axis="${vec(direction.map(x=>-x))}" stiffness="${stiffness}" springref="${preload}" damping=".1"/><inertial pos="${vec(lower)}" mass=".01" diaginertia=".00001 .00001 .00001"/></body></body>
${particles}</worldbody><deformable><flex name="cord" dim="1" radius="${cordRadius}" body="${bodyNames.join(' ')}" vertex="${vec(vertices.flat())}" element="${Array.from({length:segments},(_,i)=>i+' '+(i+1)).join(' ')}"><contact contype="2" conaffinity="3" selfcollide="auto" internal="true" condim="${friction?3:1}" friction="${friction} .001 .001" solref="${contactTime} 1" solimp=".99 .999 .001"/></flex></deformable>
<equality><flex flex="cord" solref="${edgeTime} 1" solimp="${impedance} ${impedance} .001"/></equality>
<actuator><position joint="drive" kp="10000" kv="200"/></actuator></mujoco>`;
  const omega=2*Math.PI/period;
  const input=time=>{const a=1-Math.exp(-((time/.25)**2)),da=2*time/.25**2*Math.exp(-((time/.25)**2));return{position:amplitude*Math.sin(omega*time)*a,velocity:amplitude*(omega*Math.cos(omega*time)*a+Math.sin(omega*time)*da)};};
  const p=createMujocoSimulation(mujoco,{xml,initialize:({model,data,id})=>{data.qfrc_applied[model.jnt_dofadr[id('mjOBJ_JOINT','spin')]]=load;},beforeStep:({data,time})=>{const q=input(time);data.ctrl[0]=q.position+.02*q.velocity;}});
  const joints=Object.fromEntries(['spin','drive','tension'].map(n=>{const id=p.id('mjOBJ_JOINT',n);return[n,{q:p.model.jnt_qposadr[id],v:p.model.jnt_dofadr[id]}];}));
  return Object.assign(p,{joints,bodies:Object.fromEntries(['bow','spindle','lowerTip'].map(n=>[n,p.id('mjOBJ_BODY',n)])),description:{xml,input,direction,lengths,masses,density,cordDensity,
    options:{timestep,period,friction,preload,stiffness,ropeDensity,load,gravity,contactTime,edgeTime,impedance,iterations,ccdTolerance},
    assumptions:'One actuated bow slide; passive spindle and lumped elastic lower tip. Native 1D flex with finite capsule contact, edge constraints and translational vertices; no cross-section rotation or bending stiffness. Uniform visible rigid density normalized to unit bow mass, same cord density by default. Shaft support, axial dimensions, pretension and material values are reconstructed. Visible stock follows tip displacement by an approximate smooth deformation. Final source, convergence and hardware checks remain pending.'}});
}
