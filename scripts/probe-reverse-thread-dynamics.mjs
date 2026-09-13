import fs from 'node:fs';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoReverseThread} from '../src/simulation/mujoco-reverse-thread/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/108-native',sources=freezeStudySources([...fs.readdirSync('src/simulation/mujoco-reverse-thread').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco-reverse-thread/'+n),'scripts/probe-reverse-thread-dynamics.mjs'],prefix);
const mujoco=await loadMujoco(),options=JSON.parse(process.env.SIM_OPTIONS??'{}'),start=performance.now(),v=makeMujocoReverseThread(mujoco,options),p=v.physics,f=v.root.userData.profile,rows=[];
console.log({compileMilliseconds:performance.now()-start,geoms:p.model.ngeom,nq:p.model.nq,angles:v.root.userData.angles.length});
try {
 const n=Math.round(Number(process.env.DURATION??10)/p.timestep);let error=0,penetration=0,contacts=0;const start=performance.now();
 for(let i=0;i<=n;i++) {
  if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
  const expected=f.law(f.initialParameter-p.data.qpos[0]).y-f.initialY;error=Math.max(error,Math.abs(p.data.qpos[1]-expected));
  const cs=p.data.contact;for(let j=0;j<cs.size();j++){const c=cs.get(j);penetration=Math.max(penetration,-c.dist);contacts++;c.delete();}cs.delete();
  if(i%Math.round(.25/p.timestep)===0){const row={time:p.data.time,qpos:Array.from(p.data.qpos),expected,errorPixels:100*(p.data.qpos[1]-expected),contacts:p.data.ncon};rows.push(row);console.log(row);}
 }
 const result={sources,options,rows,errorPixels:100*error,penetrationPixels:100*penetration,contacts,millisecondsPerStep:(performance.now()-start)/n};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log({...result,sources:undefined,rows:undefined});
}finally{v.dispose();}
