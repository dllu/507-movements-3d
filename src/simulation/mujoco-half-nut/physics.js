import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
const vec=a=>a.map(v=>Number(v.toPrecision(12))).join(' ');

export function makeHalfNutPhysics(mujoco,visual,{timestep=.002,rpm=60,friction=0,contactTime=.008,load=0,switchTime=.45,automatic=true}={}) {
 if(![timestep,rpm,contactTime,switchTime].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(load)||!Number.isFinite(friction)||friction<0)throw new RangeError('Invalid half-nut physics options');
 const u=visual.root.userData,f=u.profile,assets=[],mass=Object.fromEntries(['roller','carriage'].map(n=>[n,rigidFamilyInertia(u.parts,u.families,n)])),density=1/mass.roller.volume;
 const inertial=name=>{const m=mass[name];return `<inertial pos="${vec(m.centroid)}" mass="${m.volume*density}" fullinertia="${vec(m.inertia.map(v=>v*density))}"/>`;};
 const geoms=name=>u.cells[name].map((vertices,i)=>{const id=name+i;assets.push(`<mesh name="${id}" vertex="${vec(vertices.flat())}"/>`);return `<geom name="${id}" type="mesh" mesh="${id}" contype="${name==='roller'?1:2}" conaffinity="${name==='roller'?2:1}"/>`;}).join('');
 const roller=geoms('roller'),carriage=geoms('carriage');
 const xml=`<mujoco model="110 selectable half-nut traverse"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${timestep}" gravity="0 0 -9.81" integrator="implicitfast" solver="Newton" iterations="40" tolerance="1e-8"/>
 <default><geom friction="${friction} .001 .001" condim="${friction?3:1}" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
 <asset>${assets.join('')}</asset><worldbody>
 <body name="roller" pos="0 ${f.spacing} 0"><joint name="roller" type="hinge" axis="1 0 0" damping=".01"/>${inertial('roller')}${roller}</body>
 <body name="carriage"><joint name="traverse" type="slide" axis="1 0 0" damping=".5" limited="true" range="${-f.travel-.08} ${f.travel+.08}"/>
 <joint name="selector" type="hinge" axis="1 0 0" damping=".05" limited="true" range="${-f.selectorAngle} ${f.selectorAngle}" solreflimit=".004 1" solimplimit=".999 .9999 .0001"/>${inertial('carriage')}${carriage}</body>
 </worldbody><actuator><position joint="roller" kp="5000" kv="100"/><position joint="selector" kp="3000" kv="60"/></actuator></mujoco>`;
 const omega=rpm*Math.PI/30,control={target:-f.selectorAngle,from:-f.selectorAngle,started:-switchTime,transitions:[]};
 const weightMoment=mass.carriage.centroid.map(c=>c*mass.carriage.volume*density*9.81);
 const selection=time=>{const t=Math.max(0,Math.min(1,(time-control.started)/switchTime)),s=t*t*t*(10-15*t+6*t*t),v=30*t*t*(1-t)*(1-t)/switchTime;
  return {angle:control.from+(control.target-control.from)*s,velocity:(control.target-control.from)*v};};
 const select=(target,time)=>{if(!Number.isFinite(target)||Math.abs(target)>f.selectorAngle)throw new RangeError('Selector angle exceeds its working range');control.from=selection(time).angle;control.target=target;control.started=time;control.transitions.push({time,target});};
 const physics=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{
  control.target=control.from=-f.selectorAngle;control.started=-switchTime;control.transitions.length=0;
  data.qpos[2]=-f.selectorAngle;data.qvel[0]=omega;data.qvel[1]=-f.external[0].lead*omega;data.qfrc_applied[1]=load;
 },beforeStep:({data,time})=>{
  if(automatic&&time-control.started>switchTime+.2){if(control.target<0&&data.qpos[1]<=-f.travel)select(f.selectorAngle,time);else if(control.target>0&&data.qpos[1]>=f.travel)select(-f.selectorAngle,time);}
  const s=selection(time);data.ctrl[0]=omega*time+.02*omega;data.ctrl[1]=s.angle+.02*s.velocity;
  // The demonstrated operator supports the selector's weight. This acts only
  // about the selector hinge; translation remains passive thread contact.
  // Evaluate the current pose directly. Cached mjData bias forces can be one
  // step old, depending on whether rendering called mj_forward in between.
  data.qfrc_applied[2]=weightMoment[1]*Math.cos(data.qpos[2])-weightMoment[2]*Math.sin(data.qpos[2]);
 }});
 return Object.assign(physics,{control,selection,select:target=>select(target,physics.data.time),bodies:Object.fromEntries(['roller','carriage'].map(n=>[n,physics.id('mjOBJ_BODY',n)])),
  description:{xml,mass,density,cells:u.cells,omega,options:{timestep,rpm,friction,contactTime,load,switchTime,automatic},
   assumptions:'Thread contact drives the passive rod. The roller motor and an inferred automatic, weight-supported selector are actuated. Bearings, rod guide, selector and travel stops, depths, density and friction are reconstructed; gravity is normal to the engraving plane.'}});
}
