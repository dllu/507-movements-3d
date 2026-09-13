import fs from 'node:fs';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoBarrelCam} from '../src/simulation/mujoco-barrel-cam/visual.js';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
const mujoco=await loadMujoco(),options=JSON.parse(process.env.SIM_OPTIONS??'{}'),start=performance.now();
const v=makeMujocoBarrelCam(mujoco,options),p=v.physics,u=v.root.userData,f=u.profile,rows=[];
console.log({compiledMilliseconds:performance.now()-start,geoms:p.model.ngeom,nq:p.model.nq});
try {
  let error=0,penetration=0,contacts=0;const n=Math.round(Number(process.env.DURATION??4)/p.timestep),simulationStart=performance.now();
  for(let i=0;i<=n;i++) {
    if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
    error=Math.max(error,Math.abs(p.data.qpos[1]-(f.law(-p.data.qpos[0]).x-f.initialTip)));
    const cs=p.data.contact;for(let j=0;j<cs.size();j++){const c=cs.get(j);contacts++;penetration=Math.max(penetration,-c.dist);c.delete();}cs.delete();
    if(i%Math.round(.25/p.timestep)===0){v.sync();const row={...u.state,expected:f.law(-p.data.qpos[0]).x-f.initialTip};rows.push(row);console.log(row);}
  }
  const millisecondsPerStep=(performance.now()-simulationStart)/n,audits=[];
  console.log({maximumErrorPixels:error*100,nativePenetrationPixels:penetration*100,contacts,millisecondsPerStep});
  v.reset();
  if(process.env.AUDIT)for(const time of [0,.5,1,1.5,2,2.5,3,3.5,4]){v.update(time);const a=auditClutchSourceSolids(v);audits.push({time,...a});console.log({time,issues:a.issues,topology:a.topologyIssues,checks:a.checks});}
  if(process.env.PROBE_PREFIX)fs.writeFileSync(process.env.PROBE_PREFIX+'.json',JSON.stringify({options,rows,audits,errorPixels:error*100,penetrationPixels:penetration*100,contacts,millisecondsPerStep},null,2)+'\n',{flag:'wx'});
}finally{v.dispose();}
