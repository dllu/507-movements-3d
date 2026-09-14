import * as THREE from 'three';
import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

/** Experimental contact-driven cord; not registered for production playback. */
export function makeBowDrillPhysics(mujoco,visual,{timestep=.001,period=4,
  friction=.8,preload=.03,stiffness=200,ropeDensity=null,load=0,resistance=0,gravity=9.81,
  contactTime=.004,edgeTime=.004,impedance=.99999,iterations=60,ccdTolerance=1e-10,
  cordModel='linked',integrator='implicitfast',multiccd=false}={}) {
  if(![timestep,period,stiffness,contactTime,edgeTime,ccdTolerance].every(x=>Number.isFinite(x)&&x>0)
    || ![friction,preload,resistance].every(x=>Number.isFinite(x)&&x>=0)
    || ![load,gravity].every(Number.isFinite) || !(impedance>0&&impedance<1)
    || !Number.isInteger(iterations)||iterations<1
    || (ropeDensity!==null&&!(Number.isFinite(ropeDensity)&&ropeDensity>0))
    || !['linked','flex'].includes(cordModel)||!['implicitfast','implicit','discrete'].includes(integrator))throw new RangeError('Invalid 124 physics options');
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
  const sections=[],connections=[],exclusions=[];
  if(cordModel==='linked')for(let i=0;i<segments;i++) {
    const a=new THREE.Vector3(...path.points[i]),b=new THREE.Vector3(...path.points[i+1]),axis=b.clone().sub(a),length=axis.length(),center=a.clone().add(b).multiplyScalar(.5);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),axis.normalize());
    // Cylindrical material partitions avoid counting overlapping end caps as
    // extra cord mass. Caps are only the finite joint collision envelope.
    const mass=Math.PI*cordRadius**2*length*cordDensity,transverse=mass*(3*cordRadius**2+length**2)/12,axial=mass*cordRadius**2/2;
    sections.push(`<body name="cord${i}" pos="${vec(center.toArray())}" quat="${vec([q.w,q.x,q.y,q.z])}"><freejoint name="cordj${i}"/><inertial pos="0 0 0" mass="${mass}" diaginertia="${vec([transverse,transverse,axial])}"/><geom name="cordg${i}" type="capsule" size="${cordRadius} ${length/2}" contype="2" conaffinity="3" condim="${friction?3:1}" friction="${friction} .001 .001" solref="${contactTime} 1" solimp=".99 .999 .001"/><site name="ca${i}" pos="0 0 ${-length/2}"/><site name="cb${i}" pos="0 0 ${length/2}"/></body>`);
    if(i>0){connections.push(`<connect site1="cb${i-1}" site2="ca${i}" solref="${edgeTime} 1" solimp="${impedance} ${impedance} .001"/>`);exclusions.push(`<exclude body1="cord${i-1}" body2="cord${i}"/>`);}
  }
  connections.push(...[['lowerEnd','ca0'],['upperEnd','cb'+(segments-1)]].map(([a,b])=>`<connect site1="${a}" site2="${b}" solref="${edgeTime} 1" solimp="${impedance} ${impedance} .001"/>`));
  const constraints=cordModel==='linked'?`<contact>${exclusions.join('')}</contact><equality>${connections.join('')}</equality>`:
`<deformable><flex name="cord" dim="1" radius="${cordRadius}" body="${bodyNames.join(' ')}" vertex="${vec(vertices.flat())}" element="${Array.from({length:segments},(_,i)=>i+' '+(i+1)).join(' ')}"><contact contype="2" conaffinity="3" selfcollide="auto" internal="true" condim="${friction?3:1}" friction="${friction} .001 .001" solref="${contactTime} 1" solimp=".99 .999 .001"/></flex></deformable><equality><flex flex="cord" solref="${edgeTime} 1" solimp="${impedance} ${impedance} .001"/></equality>`;
  const contact=`contype="1" conaffinity="2" friction="${friction} .001 .001" condim="${friction?3:1}" solref="${contactTime} 1" solimp=".99 .999 .001"`;
  const xml=`<mujoco model="124 native ${cordModel} cord"><compiler angle="radian" inertiafromgeom="false"/>
<option timestep="${timestep}" gravity="0 ${-gravity} 0" integrator="${integrator}" solver="Newton" iterations="${iterations}" tolerance="1e-9" ccd_tolerance="${ccdTolerance}" cone="elliptic"><flag multiccd="${multiccd?'enable':'disable'}"/></option><size memory="64M"/>
<worldbody><body name="spindle"><joint name="spin" axis="0 0 1" damping=".005" frictionloss="${resistance}"/>${inertial('spindle')}
<geom name="drum" type="cylinder" size="${drumRadius} .16" ${contact}/>
<geom name="front" type="cylinder" size="${u.source.circles.outer.radius/100} .02" pos="0 0 .18" ${contact}/>
<geom name="back" type="cylinder" size="${u.source.circles.outer.radius/100} .02" pos="0 0 -.18" ${contact}/></body>
<body name="bow"><joint name="drive" type="slide" axis="${vec(direction)}"/>${inertial('bow')}
<site name="upperEnd" pos="${vec(upper)}"/><body name="lowerTip"><site name="lowerEnd" pos="${vec(lower)}"/><joint name="tension" type="slide" axis="${vec(direction.map(x=>-x))}" stiffness="${stiffness}" springref="${preload}" damping=".1"/><inertial pos="${vec(lower)}" mass=".01" diaginertia=".00001 .00001 .00001"/></body></body>
${cordModel==='linked'?sections.join('\n'):particles}</worldbody>${constraints}
<actuator><position joint="drive" kp="10000" kv="200"/></actuator></mujoco>`;
  const omega=2*Math.PI/period;
  const input=time=>{const a=1-Math.exp(-((time/.25)**2)),da=2*time/.25**2*Math.exp(-((time/.25)**2));return{position:amplitude*Math.sin(omega*time)*a,velocity:amplitude*(omega*Math.cos(omega*time)*a+Math.sin(omega*time)*da)};};
  const p=createMujocoSimulation(mujoco,{xml,initialize:({model,data,id})=>{data.qfrc_applied[model.jnt_dofadr[id('mjOBJ_JOINT','spin')]]=load;},beforeStep:({data,time})=>{const q=input(time);data.ctrl[0]=q.position+.02*q.velocity;}});
  const joints=Object.fromEntries(['spin','drive','tension'].map(n=>{const id=p.id('mjOBJ_JOINT',n);return[n,{q:p.model.jnt_qposadr[id],v:p.model.jnt_dofadr[id]}];}));
  const ends=cordModel==='linked'?Array.from({length:segments},(_,i)=>[p.id('mjOBJ_SITE','ca'+i),p.id('mjOBJ_SITE','cb'+i)]):null;
  const site=id=>Array.from(p.data.site_xpos.slice(3*id,3*id+3));
  const getCordPoints=()=>ends?[site(ends[0][0]),...ends.slice(1).map(([a],i)=>site(a).map((v,k)=>(v+p.data.site_xpos[3*ends[i][1]+k])/2)),site(ends.at(-1)[1])]:Array.from({length:segments+1},(_,i)=>Array.from(p.data.flexvert_xpos.slice(3*i,3*i+3)));
  return Object.assign(p,{joints,ends,getCordPoints,bodies:Object.fromEntries(['bow','spindle','lowerTip'].map(n=>[n,p.id('mjOBJ_BODY',n)])),description:{xml,input,direction,lengths,masses,density,cordDensity,
    options:{timestep,period,friction,preload,stiffness,ropeDensity,load,resistance,gravity,contactTime,edgeTime,impedance,iterations,ccdTolerance,cordModel,integrator,multiccd},
    assumptions:'One actuated bow slide; passive spindle and lumped elastic lower tip. Default cord: rigid material sections with full rotation, native ball connections and finite friction/self contact. Optional flex ablation omits section rotation. No bending stiffness. Uniform visible rigid density normalized to unit bow mass, same cord density by default; section inertia partitions cylindrical material rather than overlapping collision caps. Shaft support, depths, pretension and material values are reconstructed. Visible stock follows tip displacement by an approximate smooth deformation. Tube joins average native section endpoints within the measured connection tolerance. The lower tie enters behind the stock. Native dry spindle resistance is optional and defaults to zero. Source fit, travel sensitivity and sampled finite hardware clearances are documented; material calibration, continuous clearance and arbitrary drilling loads are not established.'}});
}
