import * as THREE from 'three';
import {createAuthoredDiagonalCatchMovement} from '../authored-diagonal-catches.js';
import {diagonalCatchProfile,diagonalLatchFinger} from './catch-profile.js';
import {convexProfilePieces} from '../mujoco-bench-clamp/profile.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
import {poly,circle,polygonClipping as clip} from '../finite-plate-geometry.js';

// Both weighted handles and the catch are passive. Only the piston is driven.
// Axial contact layers separate the working arms from the latch fingers.
export function makeDiagonalContactStudy(m,{timestep=.0005,catchMass=.25,contacts=true,period=18,registered=true}={}){
 const visual=createAuthoredDiagonalCatchMovement({id:181}),g=visual.root.userData.geometry,b=visual.root.userData.blocks;
 let assets='',next=0;
 const collision=(rings,mask,affinity,z)=>{
  let geoms='';for(const ring of rings){const points=ring.slice(0,-1).map(p=>new THREE.Vector2(...p));
   for(const piece of convexProfilePieces(points,THREE.ShapeUtils.triangulateShape(points,[]))){
    const name='cell'+next++,vertices=[z-.1,z+.1].flatMap(z=>piece.flatMap(i=>[points[i].x,points[i].y,z]));
    assets+=`<mesh name="${name}" vertex="${vertices.join(' ')}"/>`;
    geoms+=`<geom type="mesh" mesh="${name}" contype="${contacts?mask:0}" conaffinity="${contacts?affinity:0}"/>`;
   }
  }return geoms;
 };
 let handles='';const fits={};
 for(const side of ['upper','lower']){
  const finger=diagonalLatchFinger(side,{registered}),fit=finger.fit;fits[side]=fit;
  const working=b[side+'HandleWorkingArm'].children[0],tip=b[side+'HandleWorkingTip'];
  const shape=clip.union(working.geometry.userData.plate.polygons,poly(circle([tip.position.x,tip.position.y],.10,64)));
  const workingGeoms=collision(shape.map(p=>p[0]),2,1,0);
  const dogGeoms=collision(finger.polygons.map(p=>p[0]),8,4,1);
  const range=[fit.angle,0];
  handles+=`<body pos="${fit.pivot.join(' ')} 0"><joint name="${side}" axis="0 0 1" range="${range.join(' ')}" damping=".05"/><inertial mass=".1" pos="${fit.weight.join(' ')} 0" diaginertia=".04 .04 .08"/>${workingGeoms}${dogGeoms}</body>`;
 }
 const catchGeoms=collision(diagonalCatchProfile().polygons.map(p=>p[0]),4,8,1);
 const start=g.source181PistonY,end=g.source182PistonY;
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="PGS" iterations="100" tolerance="1e-9"/>
 <default><geom friction=".1 .001 .001" margin=".0002" solref=".003 1" solimp=".999 .999 .001"/></default><asset>${assets}</asset><worldbody>${handles}
 <body><joint name="catch" axis="0 0 1" range="${registered?0:-.3} .3" damping=".05"/><inertial mass="${catchMass}" pos="1.2375 -1.5 0" diaginertia=".04 .04 .08"/>${catchGeoms}</body>
 <body><joint name="piston" type="slide" axis="0 1 0"/><geom type="box" pos="${(g.tappetShoeLeftX+g.tappetShoeRightX)/2} 0 0" size="${(g.tappetShoeRightX-g.tappetShoeLeftX)/2} .25 .1" mass="1" contype="1" conaffinity="2"/></body>
 </worldbody><actuator><position joint="piston" kp="2000" kv="80" forcerange="-200 200"/></actuator></mujoco>`;
 disposeObject3D(visual.root);
 const smooth=x=>{const v=Math.max(0,Math.min(1,x));return v*v*v*(10+v*(-15+6*v));};
 const target=time=>{const phase=(time%period)*18/period;return phase<9?start+(end-start)*smooth((phase-1)/6):end+(start-end)*smooth((phase-9)/6);};
 const sim=createMujocoSimulation(m,{xml,initialize:({data})=>{data.qpos[3]=start;data.ctrl[0]=start;},beforeStep:({data,time})=>{data.ctrl[0]=target(time);}});
 return Object.assign(sim,{parameters:{timestep,catchMass,contacts,period,registered,start,end,fits},state:()=>({time:sim.data.time,upper:sim.data.qpos[0],lower:sim.data.qpos[1],catch:sim.data.qpos[2],piston:sim.data.qpos[3],target:target(sim.data.time),force:sim.data.actuator_force[0],speed:Array.from(sim.data.qvel),contacts:sim.data.ncon})});
}
