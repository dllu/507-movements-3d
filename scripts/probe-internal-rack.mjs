import fs from 'node:fs';
import {ShapeUtils,Vector2} from 'three';
import loadMujoco from '@mujoco/mujoco';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';
const f=JSON.parse(fs.readFileSync('/dev/shm/139-generated-profile.json'));
const simplify=(p,epsilon)=>{
 if(p.length<=2)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let maximum=0,index=0;
 for(let i=1;i<p.length-1;i++){const t=l?Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dy)/l)):0;const d=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dy);if(d>maximum){maximum=d;index=i;}}
 return maximum<=epsilon?[a,b]:[...simplify(p.slice(0,index+1),epsilon).slice(0,-1),...simplify(p.slice(index),epsilon)];
};
const cells=polygons=>polygons.flatMap(p=>{
 const rings=p.map(r=>{const closed=[...r];if(closed[0][0]!==closed.at(-1)[0]||closed[0][1]!==closed.at(-1)[1])closed.push(closed[0]);return simplify(closed,.00015).slice(0,-1).map(v=>new Vector2(...v));});
 const points=rings.flat();return ShapeUtils.triangulateShape(rings[0],rings.slice(1)).map(tri=>[-.06,.06].flatMap(z=>tri.map(i=>[points[i].x,points[i].y,z])));
});
const pinion=cells([[f.pinion]]),rack=cells(f.body),assets=[];
const vec=a=>a.flat(3).map(v=>Number(v.toPrecision(12))).join(' ');
const geoms=(name,triangles,mask,other)=>triangles.map((v,i)=>{const id=name+i;assets.push(`<mesh name="${id}" vertex="${vec(v)}"/>`);return `<geom type="mesh" mesh="${id}" contype="${mask}" conaffinity="${other}"/>`;}).join('');
const pinionGeoms=geoms('pinion',pinion,1,2),rackGeoms=geoms('rack',rack,2,1);
const settings=JSON.parse(process.env.SIM_OPTIONS??"{}"),counterMass=Number(process.env.COUNTER_MASS??0),period=settings.period??8,timestep=settings.timestep??.0005,contactTime=settings.contactTime??.002;
// A horizontal, parallel coupler translates like its top pin. Lump its mass
// there; its fixed horizontal COM offset does not change velocity or gravity.
const crankMass=.4+counterMass,cx=(.4*.08+counterMass*(-.075))/crankMass,cy=(.4*.205+counterMass*.58)/crankMass;
const inertia=.04+counterMass*((-.075-cx)**2+(.58-cy)**2)+.4*((.08-cx)**2+(.205-cy)**2);
const xml=`<mujoco model="139 passive suspension study"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 -98.1 0" integrator="implicitfast" iterations="100" tolerance="1e-10"><flag multiccd="disable"/></option><default><geom condim="1" solref="${contactTime} 1" solimp=".99 .999 .001"/><joint damping=".01"/></default><asset>${assets.join('')}</asset><worldbody>
<body name="pinion"><joint name="input" axis="0 0 1"/><inertial pos="0 0 0" mass="1" diaginertia=".1 .1 .1"/>${pinionGeoms}</body>
<body name="frame" pos="-.05 0 0"><joint name="frame" type="slide" axis="1 0 0"/><inertial pos="0 0 0" mass="2" diaginertia="1 1 1"/>
<body name="rack" pos="0 ${f.orbit} 0"><joint name="rack" type="slide" axis="0 1 0" limited="true" range="${-2*f.orbit} 0"/><inertial pos="0 0 0" mass="1" diaginertia=".2 .2 .2"/>${rackGeoms}<site name="rack_pin" pos="-1.22 .4685 0"/></body>
<body name="crank" pos="-1.60 1.01 0"><joint name="crank" axis="0 0 1"/><inertial pos="${cx} ${cy} 0" mass="${crankMass}" diaginertia="${inertia} ${inertia} ${inertia}"/>
<body name="rod" pos=".37 .24 0"><joint name="rod" axis="0 0 1"/><inertial pos=".005 -.2875 0" mass=".2" diaginertia=".006 .006 .006"/><site name="rod_end" pos=".01 -.575 0"/></body></body></body></worldbody>
<equality><connect site1="rod_end" site2="rack_pin" solref="${contactTime} 1"/></equality><actuator><position joint="input" kp="50000" kv="1000"/></actuator></mujoco>`;
const omega=f.rotationPerCycle/period,p=createMujocoSimulation(await loadMujoco(),{xml,initialize:({data})=>{data.qpos[0]=-Math.PI/2;},beforeStep:({data,time})=>{data.ctrl[0]=-Math.PI/2+omega*(time-.25*(1-Math.exp(-time/.25)))+.02*omega*(1-Math.exp(-time/.25));}});
try{
 const rows=[[0,...p.data.qpos]],duration=Number(process.env.PROBE_SECONDS??12);let penetration=0,resets=0;
 for(let i=0;i<duration/timestep;i++){
  p.step();if(Math.abs(p.data.time-(i+1)*timestep)>1e-7)resets++;
  const contacts=p.data.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  if((i+1)%Math.round(.01/timestep)===0)rows.push([p.data.time,...p.data.qpos]);
 }
 const report={counterMass,period,timestep,contactTime,cells:{pinion:pinion.length,rack:rack.length},penetration,resets,final:rows.at(-1),rows};
 fs.writeFileSync(process.env.PROBE_REPORT??'/dev/shm/139-native.json',JSON.stringify(report));console.log({...report,rows:rows.length});
}finally{p.dispose();}
