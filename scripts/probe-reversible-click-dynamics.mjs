import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoReversibleClick} from '../src/simulation/mujoco-reversible-click/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {reversibleClickStudySources} from './lib/reversible-click-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/121-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??6),sources=freezeStudySources(reversibleClickStudySources('scripts/probe-reversible-click-dynamics.mjs'),prefix),v=makeMujocoReversibleClick(await loadMujoco(),options),p=v.physics,f=v.root.userData.profile;
try{const rows=[],cycleEnds=[],sign=options.mode==='reverse'?1:-1,ranges=Object.fromEntries(Object.keys(p.joints).map(n=>[n,[Infinity,-Infinity]]));let maximumPenetrationPixels=0,timeResets=0,previous=0,contactSteps=0,maximumLinkageErrorPixels=0,maximumRetreatTeeth=0,furthest=0;
 for(let i=0;i<Math.ceil(duration/p.timestep);i++){
  p.step();if(![...p.data.qpos,...p.data.qvel].every(Number.isFinite))throw Error('Nonfinite state');if(p.data.time<previous)timeResets++;previous=p.data.time;
  const q=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qpos[j.q]]));for(const[n,a]of Object.entries(q)){ranges[n][0]=Math.min(ranges[n][0],a);ranges[n][1]=Math.max(ranges[n][1],a);}
  const angle=sign*q.output/f.pitch;furthest=Math.max(furthest,angle);maximumRetreatTeeth=Math.max(maximumRetreatTeeth,furthest-angle);if(Math.abs(p.data.time/p.description.options.period-Math.round(p.data.time/p.description.options.period))<1e-8)cycleEnds.push({time:p.data.time,teeth:q.output/f.pitch});
  const sites=['rodEnd','sliderPin'].map(n=>p.id('mjOBJ_SITE',n));maximumLinkageErrorPixels=Math.max(maximumLinkageErrorPixels,100*Math.hypot(...[0,1,2].map(j=>p.data.site_xpos[3*sites[0]+j]-p.data.site_xpos[3*sites[1]+j])));
  if(p.data.ncon)contactSteps++;const cs=p.data.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{maximumPenetrationPixels=Math.max(maximumPenetrationPixels,-100*c.dist);}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.01/p.timestep)===0)rows.push({time:p.data.time,qpos:q,qvel:Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qvel[j.v]])),contacts:p.data.ncon,torque:p.data.qfrc_actuator[p.joints.slider.v],teeth:q.output/f.pitch});
 }
 const report={sources,options,duration,ranges,maximumRetreatTeeth,cycleEnds,maximumPenetrationPixels,maximumLinkageErrorPixels,timeResets,contactSteps,rows,qualification:'Diagnostic native candidate with inferred ideal top guide and output bearing friction. Source fit, reversal, dwell and full hardware clearance require separate qualification.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:sources.length,rows:rows.length});
}finally{v.dispose();}
