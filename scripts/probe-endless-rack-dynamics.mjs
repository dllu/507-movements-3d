import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoEndlessRack} from '../src/simulation/mujoco-endless-rack/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {endlessRackStudySources} from './lib/endless-rack-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/119-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??8),sources=freezeStudySources(endlessRackStudySources('scripts/probe-endless-rack-dynamics.mjs'),prefix),mujoco=await loadMujoco(),v=makeMujocoEndlessRack(mujoco,options),p=v.physics,f=v.root.userData.profile;
try{const rows=[];let maximumPenetrationPixels=0,maximumPathErrorPixels=0,maximumTransmissionErrorPixels=0,timeResets=0,previous=0,phase,travel=0;const range={rack:[Infinity,-Infinity],carrier:[Infinity,-Infinity]},cells=Object.fromEntries(Object.entries(v.root.userData.cells).map(([n,c])=>[n,c.length]));
 for(let i=0;i<Math.ceil(duration/p.model.opt.timestep);i++){
  p.step();const x=p.data.qpos[2]+f.rackOffset,y=p.data.qpos[0]+f.H,error=f.gap(-x,y)*100;maximumPathErrorPixels=Math.max(maximumPathErrorPixels,Math.abs(error));
  const ideal=f.atDistance(-f.rackOffset-f.R*p.data.qpos[1]).point;maximumTransmissionErrorPixels=Math.max(maximumTransmissionErrorPixels,100*Math.hypot(x+ideal[0],y-ideal[1]));
  const angle=Math.atan2(y,-x);if(phase!==undefined)travel+=Math.atan2(Math.sin(angle-phase),Math.cos(angle-phase));phase=angle;
  if(p.data.time<previous)timeResets++;previous=p.data.time;
  for(const [n,value]of [['rack',x],['carrier',y]]){range[n][0]=Math.min(range[n][0],value);range[n][1]=Math.max(range[n][1],value);}
  const contacts=p.data.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{maximumPenetrationPixels=Math.max(maximumPenetrationPixels,-100*c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  if(i%Math.round(.02/p.model.opt.timestep)===0)rows.push({time:p.data.time,x,y,angle:p.data.qpos[1],error,contacts:p.data.ncon});
 }
 const report={sources,options,duration,cells,range,maximumPenetrationPixels,maximumPathErrorPixels,maximumTransmissionErrorPixels,circuits:travel/(2*Math.PI),timeResets,rows,qualification:'Diagnostic candidate. Optional retention is an unpictured normal guide. A passing input shaft or path constraint does not itself qualify transmission or the reconstruction.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:sources.length,rows:rows.length});
}finally{v.dispose();}
