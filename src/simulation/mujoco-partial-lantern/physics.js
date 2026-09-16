import * as THREE from 'three';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import profile from '../baked/partial-lantern-rack.js';
const TAU=2*Math.PI, scale=.48/Math.PI;
export const partialLantern199Pins=[[-2.818037,-3.878695],[-2.818037,3.878695],[-4.559679,1.48153],[-4.559679,-1.48153]].map(p=>p.map(x=>x*scale));
const vec=a=>a.map(x=>Number(x.toPrecision(12))).join(' ');
// Merge earcut triangles only across shared edges when the union is convex.
// Every cell is a closed prism of the actual baked outline, not its hull.
export function lantern199ConvexCells(outline){
 const points=outline.map(p=>new THREE.Vector2(...p));
 let cells=THREE.ShapeUtils.triangulateShape(points,[]);
 const convex=cell=>{let sign=0;for(let i=0;i<cell.length;i++){const a=points[cell[i]],b=points[cell[(i+1)%cell.length]],c=points[cell[(i+2)%cell.length]],z=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(z)<1e-12)continue;if(sign&&sign*z<0)return false;sign=Math.sign(z);}return true;};
 let changed=true;while(changed){changed=false;outer:for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){
  const a=cells[i],b=cells[j];
  for(let k=0;k<a.length;k++){const e=b.findIndex((v,l)=>v===a[(k+1)%a.length]&&b[(l+1)%b.length]===a[k]);if(e<0)continue;
   const joined=[];for(let n=0;n<a.length;n++)joined.push(a[(k+1+n)%a.length]);for(let n=2;n<b.length;n++)joined.push(b[(e+n)%b.length]);
   if(convex(joined)){cells[i]=joined;cells.splice(j,1);changed=true;break outer;}
  }
 }}return cells.map(cell=>cell.map(i=>outline[i]));
}
export function makePartialLantern199Study(mujoco,{timestep=.000125,contact=true,rackDamping=.015,speed=.9,initialX=-2.4,initialVelocity=10*.48/TAU*.9,solref=.0005,margin=.0001}={}){
 const assets=[],parts=[];let count=0;
 for(const tooth of profile.teeth)for(const cell of lantern199ConvexCells(tooth.outline)){
  const name=`tooth-${tooth.side}-${tooth.index}-${count++}`;
  assets.push(`<mesh name="${name}" vertex="${vec([-.145,.195].flatMap(z=>cell.flatMap(p=>[...p,z])))}"/>`);
  parts.push(`<geom name="${name}" type="mesh" mesh="${name}" contype="${contact?1:0}" conaffinity="${contact?2:0}"/>`);
 }
 const xml=`<mujoco model="199 free rack contact study"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast" solver="Newton" iterations="80" tolerance="1e-10" cone="elliptic"><flag multiccd="disable"/></option><default><geom condim="1" friction="0 0 0" margin="${margin}" solref="${solref} 1" solimp=".99 .999 .001"/></default><asset>${assets.join('')}</asset><worldbody><body name="rack"><joint name="rack" type="slide" axis="1 0 0" damping="${rackDamping}"/><inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/>${parts.join('')}</body><body name="pinion"><joint name="input" axis="0 0 1"/><inertial pos="0 0 0" mass="1" diaginertia=".1 .1 .1"/>${partialLantern199Pins.map((p,i)=>`<geom name="pin-${i}" type="cylinder" pos="${vec([...p,0])}" size="${profile.pinRadius} .305" contype="2" conaffinity="${contact?1:0}"/>`).join('')}</body></worldbody><actuator><velocity joint="input" kv="10000"/></actuator></mujoco>`;
 const p=createMujocoSimulation(mujoco,{xml,initialize:({data})=>{data.qpos[0]=initialX;data.qvel[0]=initialVelocity;data.qvel[1]=-speed;data.ctrl[0]=-speed;}});
 return Object.assign(p,{description:{xml,cells:count,options:{timestep,contact,rackDamping,speed,initialX,initialVelocity,solref,margin}},state(){return{time:p.data.time,x:p.data.qpos[0],velocity:p.data.qvel[0],input:-p.data.qpos[1],inputSpeed:-p.data.qvel[1]};}});
}
