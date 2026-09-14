import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoReverseThread} from '../src/simulation/mujoco-reverse-thread/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

// Prescribed poses diagnose the machining envelope only. They do not demonstrate
// passive branch selection, force transmission or stable time integration.
const prefix=process.env.PROBE_PREFIX??'/dev/shm/108-envelope';
const sources=freezeStudySources([
 ...['src/simulation/mujoco-reverse-thread','src/simulation/mujoco'].flatMap(dir=>
  fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n)),
 'scripts/probe-reverse-thread-envelope.mjs','scripts/lib/study-report-io.mjs',
 'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
 'src/simulation/primitives.js','src/simulation/coaxial-gear-geometry.js',
 'src/simulation/dispose-model.js','package-lock.json',
],prefix);
const options=JSON.parse(process.env.SIM_OPTIONS??'{}'),mujoco=await loadMujoco();
const v=makeMujocoReverseThread(mujoco,options),p=v.physics,f=v.root.userData.profile;
try {
 const count=Number(process.env.SAMPLES??2400),rows=[];let maximumPenetrationPixels=0,worst;
 for(let i=0;i<=count;i++) {
  const angle=f.period*i/count,s=f.law(f.initialParameter-angle);
  p.data.qpos.set([angle,s.y-f.initialY,f.tilt(f.initialParameter-angle)]);
  p.data.qvel.fill(0);mujoco.mj_forward(p.model,p.data);
  let penetration=0;const contacts=p.data.contact;
  for(let j=0;j<contacts.size();j++){const c=contacts.get(j);penetration=Math.max(penetration,-c.dist);c.delete();}
  contacts.delete();
  const row={angle,penetrationPixels:100*penetration,contacts:p.data.ncon,qpos:Array.from(p.data.qpos)};
  if(row.penetrationPixels>maximumPenetrationPixels){maximumPenetrationPixels=row.penetrationPixels;worst=row;}
  rows.push(row);
 }
 verifyStudySources(sources);
 const result={sources,options,qualification:'Prescribed machining-envelope diagnostic only',maximumPenetrationPixels,worst,rows};
 fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log({...result,sources:undefined,rows:undefined});
}finally{v.dispose();}
