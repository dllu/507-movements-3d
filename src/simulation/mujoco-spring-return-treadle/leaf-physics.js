import {createMujocoSimulation} from '../mujoco/simulation.js';
import {sourceLeaf} from './source.js';

// Isolated bending study. Fixed-length links approximate an inextensible,
// naturally curved leaf; hinge energy tends to integral EI*(delta curvature)^2/2.
// This does not yet include the treadle, band, gravity or visible spring solids.
export function makeReturnLeafPhysics(mujoco,{segments=32,tailSegments=6,timestep=.0005,EI=2000,viscosity=200,mass=.2,load=10,ramp=1,release=Infinity}={}){
 if(!(EI>0&&mass>0&&timestep>0&&viscosity>=0&&ramp>0&&load>=0))throw new RangeError('Invalid leaf properties');
 const source=sourceLeaf({segments,tailSegments}),points=source.points,lengths=points.slice(1).map((p,i)=>p.distanceTo(points[i])),angles=points.slice(1).map((p,i)=>Math.atan2(p.y-points[i].y,p.x-points[i].x));
 let bodies='';
 for(let i=0;i<lengths.length;i++){
  const angle=angles[i]-(i?angles[i-1]:0),pos=i?`${lengths[i-1]} 0 0`:points[0].toArray().join(' '),dual=i?(lengths[i-1]+lengths[i])/2:1;
  bodies+=`<body name="leaf-${i}" pos="${pos}" euler="0 0 ${angle}">${i?`<joint name="bend-${i}" axis="0 0 1" stiffness="${EI/dual}" damping="${viscosity/dual}" springref="0"/>`:''}<geom type="box" pos="${lengths[i]/2} 0 0" size="${lengths[i]/2} .015 .06" mass="${mass*lengths[i]/source.length}"/><site name="end-${i}" pos="${lengths[i]} 0 0"/>`;
  if(i===source.eyeIndex-1){const d=source.tie.clone().sub(points[i]),c=Math.cos(angles[i]),s=Math.sin(angles[i]);bodies+=`<site name="tie" pos="${c*d.x+s*d.y} ${-s*d.x+c*d.y} 0"/>`;}
 }
 bodies+='</body>'.repeat(lengths.length);
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast" solver="Newton" iterations="80" tolerance="1e-10"/><default><geom contype="0" conaffinity="0"/><site size=".01"/></default><worldbody>${bodies}</worldbody></mujoco>`;
 let tieId;
 const p=createMujocoSimulation(mujoco,{xml,initialize:({id})=>{tieId=id('mjOBJ_SITE','tie');},beforeStep:({model,data,time})=>{
  // mj_step integrates qpos after computing Cartesian positions. Refresh them
  // before applying a point force to the newly integrated configuration.
  mujoco.mj_kinematics(model,data);
  data.qfrc_applied.fill(0);const force=time>=release?0:-load*(.5-.5*Math.cos(Math.PI*Math.min(1,time/ramp)));
  const x=data.site_xpos[3*tieId];
  // Point force on the tie. Each ancestor Z hinge receives r cross F;
  // the free tail's hinges receive no externally applied torque.
  for(let i=0;i<source.eyeIndex-1;i++)data.qfrc_applied[i]=(x-data.xanchor[3*i])*force;
 }});
 const endIds=lengths.map((_,i)=>p.id('mjOBJ_SITE',`end-${i}`));
 return Object.assign(p,{source,description:{segments,tailSegments,timestep,EI,viscosity,mass,load,ramp,release:Number.isFinite(release)?release:null,assumptions:'Isolated inextensible curved leaf, fixed root direction, distributed mass and linear hinge bending energy, smoothly applied downward tie load. No gravity, band or treadle yet. Effective bending stiffness and damping are inferred, not measured steel properties.'},state:()=>{mujoco.mj_kinematics(p.model,p.data);return {time:p.data.time,qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel),tie:Array.from(p.data.site_xpos.slice(3*tieId,3*tieId+3)),points:[points[0].toArray(),...endIds.map(id=>Array.from(p.data.site_xpos.slice(3*id,3*id+3)))]};}});
}
