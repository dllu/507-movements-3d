import * as THREE from 'three';
import {createDiagonalCatchScaffold} from '../authored-diagonal-catches.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {convexProfilePieces} from '../mujoco-bench-clamp/profile.js';
import {poly,circle,polygonClipping as clip} from '../finite-plate-geometry.js';
import {disposeObject3D} from '../dispose-model.js';

// Isolated drive-contact study. The catch is omitted; inferred valve travel
// limits bound the passive handle. Neither handle angle nor contact point is
// prescribed. The input shoe has the narrow width visible in the engraving.
export function makeTappetStudy(m,{side='lower',timestep=.00025,contacts=true,extraTravel=0}={}){
 if(!['lower','upper'].includes(side))throw new RangeError('Unknown handle side');
 if(!Number.isFinite(extraTravel)||extraTravel<0)throw new RangeError('Invalid extra travel');
 const visual=createDiagonalCatchScaffold({id:181}),u=visual.root.userData,g=u.geometry,b=u.blocks;
 const lower=side==='lower',prefix=lower?'lower':'upper';
 const working=b[prefix+'HandleWorkingArm'].children[0],tip=b[prefix+'HandleWorkingTip'];
 const shape=clip.union(working.geometry.userData.plate.polygons,poly(circle([tip.position.x,tip.position.y],.10,64)));
 const pivot=g[prefix+'Pivot'].toArray(),weight=g[prefix+'WeightLocal'].toArray(),limit=g[lower?'source182LowerAngle':'source182UpperAngle'];
 const start=lower?g.source181PistonY:g.source182PistonY,end=lower?g.source182PistonY:g.source181PistonY;
 const initial=lower?0:limit,sourceScale=g.sourceScale,shaftX=g.pistonRodX;
 const range=lower?[limit-extraTravel,0]:[limit,extraTravel];
 let assets='',geoms='',cells=0;
 for(const [outer]of shape){const points=outer.slice(0,-1).map(p=>new THREE.Vector2(...p));
  for(const piece of convexProfilePieces(points,THREE.ShapeUtils.triangulateShape(points,[]))){
   const name='cell'+cells++,vertices=[-.1,.1].flatMap(z=>piece.flatMap(j=>[points[j].x,points[j].y,z]));
   assets+=`<mesh name="${name}" vertex="${vertices.join(' ')}"/>`;geoms+=`<geom type="mesh" mesh="${name}" contype="1" conaffinity="2"/>`;
  }
 }
 const left=(170-271)*sourceScale,right=(193-271)*sourceScale;
 const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="PGS" iterations="100" tolerance="1e-9"/>
 <default><geom friction=".2 .001 .001" margin=".0005" solref=".003 1" solimp=".999 .999 .001"/></default><asset>${assets}</asset><worldbody>
 <body pos="${pivot[0]} ${pivot[1]} 0"><joint name="handle" axis="0 0 1" range="${range.join(' ')}" damping=".1"/><inertial mass=".1" pos="${weight[0]} ${weight[1]} 0" diaginertia=".04 .04 .08"/>${geoms}</body>
 <body><joint name="piston" type="slide" axis="0 1 0"/><geom type="box" pos="${(left+right)/2} 0 0" size="${(right-left)/2} .25 .28" mass="1" contype="${contacts?2:0}" conaffinity="${contacts?1:0}"/></body>
 </worldbody><actuator><position joint="piston" kp="2000" kv="80" forcerange="-200 200"/></actuator></mujoco>`;
 disposeObject3D(visual.root);
 const smooth=x=>{const v=Math.max(0,Math.min(1,x));return v*v*v*(10+v*(-15+6*v));};
 const target=t=>start+(end-start)*smooth((t-.5)/2.5);
 const sim=createMujocoSimulation(m,{xml,initialize:({data})=>{data.qpos[0]=initial;data.qpos[1]=start;data.ctrl[0]=start;},beforeStep:({data,time})=>{data.ctrl[0]=target(time);}});
 return Object.assign(sim,{parameters:{side,timestep,contacts,extraTravel,range,cells,limit,initial,start,end,shoeLeft:left,shoeRight:right,shaftX},state:()=>({time:sim.data.time,angle:sim.data.qpos[0],piston:sim.data.qpos[1],angularSpeed:sim.data.qvel[0],pistonSpeed:sim.data.qvel[1],target:target(sim.data.time),force:sim.data.actuator_force[0],contacts:sim.data.ncon})});
}
