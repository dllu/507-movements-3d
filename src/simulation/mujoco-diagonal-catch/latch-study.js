import * as THREE from 'three';
import {diagonalCatchProfile,diagonalLatchFinger} from './catch-profile.js';
import {convexProfilePieces} from '../mujoco-bench-clamp/profile.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

export function makeLatchStudy(m,{side='upper',contacts=true,timestep=.00025,friction=.1,catchMass=.17,release=false,registered=true}={}){
 const {fit,raster,polygons,angle:initial}=diagonalLatchFinger(side,{registered});
 // The lower holding face seats with the catch raised by about 0.032 rad,
 // as reached passively in the coupled ascent. Starting it at zero would
 // initialize overlapping solids and inject an unrelated separation impulse.
 const initialCatch=registered&&side==='lower'?.033:0;
 let assets='',next=0;
 const collision=(rings,mask)=>{
  let geoms='';for(const ring of rings){const points=ring.slice(0,-1).map(p=>new THREE.Vector2(...p));
   for(const piece of convexProfilePieces(points,THREE.ShapeUtils.triangulateShape(points,[]))){
    const name='latch'+next++,vertices=[-.1,.1].flatMap(z=>piece.flatMap(i=>[points[i].x,points[i].y,z]));
    assets+=`<mesh name="${name}" vertex="${vertices.join(' ')}"/>`;
    geoms+=`<geom type="mesh" mesh="${name}" contype="${contacts?mask:0}" conaffinity="${contacts?3-mask:0}"/>`;
   }
  }return geoms;
 };
 const catchGeoms=collision(diagonalCatchProfile().polygons.map(p=>p[0]),2);
 const dogGeoms=collision(polygons.map(p=>p[0]),1);
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="PGS" iterations="100" tolerance="1e-9"/>
 <default><geom friction="${friction} ${friction?'.001 .001':'0 0'}" margin=".0002" solref=".003 1" solimp=".999 .999 .001"/></default><asset>${assets}</asset><worldbody>
 <body pos="${fit.pivot.join(' ')} 0"><joint name="handle" axis="0 0 1" range="${fit.angle} 0" damping=".05"/><inertial mass=".1" pos="${fit.weight.join(' ')} 0" diaginertia=".04 .04 .08"/>${dogGeoms}</body>
 <body><joint name="catch" axis="0 0 1" range="${registered?0:-.3} .3" damping=".05"/><inertial mass="${catchMass}" pos="1.2375 -1.5 0" diaginertia=".04 .04 .08"/>${catchGeoms}</body>
 </worldbody><actuator><motor joint="catch"/></actuator></mujoco>`;
 const sim=createMujocoSimulation(m,{xml,initialize:({data})=>{data.qpos[0]=initial;data.qpos[1]=initialCatch;},beforeStep:({data,time})=>{data.ctrl[0]=release&&time>=1.2&&time<1.4?6:0;}});
 return Object.assign(sim,{parameters:{side,contacts,timestep,friction,catchMass,release,registered,initial,initialCatch,fit,raster},state:()=>({time:sim.data.time,handle:sim.data.qpos[0],catch:sim.data.qpos[1],handleSpeed:sim.data.qvel[0],catchSpeed:sim.data.qvel[1],contacts:sim.data.ncon})});
}
