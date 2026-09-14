import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoStrokeDoubler} from '../src/simulation/mujoco-stroke-doubler/visual.js';
import {strokeDoublerStudySources} from './lib/stroke-doubler-study-sources.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/118-dynamics',options=JSON.parse(process.env.OPTIONS??'{}'),duration=Number(process.env.DURATION??10);
const sources=freezeStudySources(strokeDoublerStudySources('scripts/probe-stroke-doubler-dynamics.mjs'),prefix),mujoco=await loadMujoco(),v=makeMujocoStrokeDoubler(mujoco,options),p=v.physics,u=v.root.userData;
const rows=[],ranges=Object.fromEntries(Object.keys(p.joints).map(n=>[n,[Infinity,-Infinity]])),contacts={},R=u.profile.pitchRadius;
let timeResets=0,maximumPenetrationPixels=0,maximumMotionErrorPixels=0,maximumRollingErrorPixels=0,maximumInputErrorPixels=0,witness;
try{
 const start=performance.now();for(let i=0;i<Math.ceil(duration/p.timestep);i++){
  const before=p.data.time;p.step();if(p.data.time<before)timeResets++;
  const q=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qpos[j.q]]));
  if(![...p.data.qpos,...p.data.qvel].every(Number.isFinite))throw Error('Nonfinite state');
  for(const n of Object.keys(q)){ranges[n][0]=Math.min(ranges[n][0],q[n]);ranges[n][1]=Math.max(ranges[n][1],q[n]);}
  maximumMotionErrorPixels=Math.max(maximumMotionErrorPixels,100*Math.abs(q.rack-2*q.carrier));maximumRollingErrorPixels=Math.max(maximumRollingErrorPixels,100*Math.abs(q.carrier+R*q.pinion));maximumInputErrorPixels=Math.max(maximumInputErrorPixels,100*Math.abs(q.carrier-p.description.input(p.data.time).position));
  const cs=p.data.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{const ids=Array.from(c.geom),names=ids.map(id=>mujoco.mj_id2name(p.model,mujoco.mjtObj.mjOBJ_GEOM.value,id).replace(/\d+$/,'')),key=names.join('/');contacts[key]=(contacts[key]??0)+1;if(-100*c.dist>maximumPenetrationPixels){maximumPenetrationPixels=-100*c.dist;witness={time:p.data.time,ids,dist:c.dist,pos:Array.from(c.pos)};}}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.02/p.timestep)===0)rows.push({time:p.data.time,q,velocity:Array.from(p.data.qvel),contacts:p.data.ncon});
 }
 const report={sources,options,duration,ranges,rows,timeResets,contacts,maximumPenetrationPixels,maximumMotionErrorPixels,maximumRollingErrorPixels,maximumInputErrorPixels,witness,millisecondsPerStep:(performance.now()-start)/(duration/p.timestep),qualification:'Native diagnostic of pitman translation, loose pinion rotation and passive upper rack. Source comparison, independent surface audit, contact negative controls and visual review remain necessary.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(Object.fromEntries(Object.entries(report).filter(([k])=>!['sources','rows'].includes(k))));
}finally{v.dispose();}
