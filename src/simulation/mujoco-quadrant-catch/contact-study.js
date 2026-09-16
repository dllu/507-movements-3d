import * as THREE from 'three';
import {quadrantGeometry} from './geometry.js';
import {convexProfilePieces} from '../mujoco-bench-clamp/profile.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

// Only the piston is actuated. Each circular quadrant retains the other
// handle's axial pin; the rim end releases it as the driven handle turns.
export function makeQuadrantContactStudy(m,{timestep=.00025,contacts=true,period=18,releaseLead=.04,pinRadius=.07,handleMass=.1,upperRetention=true,lowerRetention=true,shoeContacts=true}={}){
 const g=quadrantGeometry({releaseLead,pinRadius});let assets='',next=0;
 const collision=(polygons,mask,affinity,z,label)=>polygons.map(p=>p[0]).map(ring=>{
  const points=ring.slice(0,-1).map(p=>new THREE.Vector2(...p));
  return convexProfilePieces(points,THREE.ShapeUtils.triangulateShape(points,[])).map(piece=>{
   const name='cell'+next++,vertices=[z-.1,z+.1].flatMap(z=>piece.flatMap(i=>[points[i].x,points[i].y,z]));
   assets+=`<mesh name="${name}" vertex="${vertices.join(' ')}"/>`;
   return `<geom name="${label}-${name}" type="mesh" mesh="${name}" contype="${contacts?mask:0}" conaffinity="${contacts?affinity:0}"/>`;
  }).join('');
 }).join('');
 let bodies='';for(const [side,h]of Object.entries(g.handles)){
  const upper=side==='upper',working=collision(h.working,shoeContacts?2:0,shoeContacts?1:0,0,`${side}-working`),band=collision(h.quadrant,upper?(lowerRetention?4:0):(upperRetention?16:0),upper?(lowerRetention?8:0):(upperRetention?32:0),upper?1:2,`${side}-quadrant`);
  const pin=`<geom name="${side}-pin" type="cylinder" pos="${h.pin.join(' ')} ${upper?2:1}" size="${pinRadius} .1" contype="${contacts?(upper?(upperRetention?32:0):(lowerRetention?8:0)):0}" conaffinity="${contacts?(upper?(upperRetention?16:0):(lowerRetention?4:0)):0}"/>`;
  bodies+=`<body pos="${h.fit.pivot.join(' ')} 0"><joint name="${side}" axis="0 0 1" range="${h.fit.angle} 0" damping=".05"/><inertial mass="${handleMass}" pos="${h.fit.weight.join(' ')} 0" diaginertia=".04 .04 .08"/>${working}${band}${pin}</body>`;
 }
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="100" tolerance="1e-10"/>
 <default><geom friction=".05 .001 .001" margin=".0002" solref=".003 1" solimp=".999 .999 .001"/></default><asset>${assets}</asset><worldbody>${bodies}
 <body><joint name="piston" type="slide" axis="0 1 0"/><geom name="piston-shoe" type="box" pos="${(g.shoe.left+g.shoe.right)/2} 0 0" size="${(g.shoe.right-g.shoe.left)/2} ${g.shoe.halfHeight} .1" mass="1" contype="${contacts&&shoeContacts?1:0}" conaffinity="${contacts&&shoeContacts?2:0}"/></body>
 </worldbody><actuator><position joint="piston" kp="2000" kv="80" forcerange="-200 200"/></actuator></mujoco>`;
 const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(10+t*(-15+6*t));};
 const target=time=>{const phase=(time%period)*18/period;return phase<9?g.start+(g.end-g.start)*smooth((phase-1)/6):g.end+(g.start-g.end)*smooth((phase-9)/6);};
 const sim=createMujocoSimulation(m,{xml,initialize:({data})=>{data.qpos[2]=g.start;data.ctrl[0]=g.start;},beforeStep:({data,time})=>{data.ctrl[0]=target(time);}});
 return Object.assign(sim,{geometry:g,parameters:{timestep,contacts,period,releaseLead,pinRadius,handleMass,upperRetention,lowerRetention,shoeContacts},target,state:()=>({time:sim.data.time,q:Array.from(sim.data.qpos),speed:Array.from(sim.data.qvel),contacts:sim.data.ncon})});
}
