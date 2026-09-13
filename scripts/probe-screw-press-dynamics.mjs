import fs from 'node:fs';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoScrewPress} from '../src/simulation/mujoco-screw-press/visual.js';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';
const mujoco=await loadMujoco(),options=JSON.parse(process.env.SIM_OPTIONS??'{}'),v=makeMujocoScrewPress(mujoco,options),p=v.physics,u=v.root.userData,f=u.profile,rows=[];
try {
  let error=0,penetration=0,contacts=0,tracking=0;
  const n=Math.round(Number(process.env.DURATION??8)/p.timestep);
  for(let i=0;i<=n;i++){
    if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
    error=Math.max(error,Math.abs(p.data.qpos[0]-f.lead*p.data.qpos[1]));tracking=Math.max(tracking,Math.abs(p.data.qpos[1]-p.description.input(p.data.time).angle));
    const cs=p.data.contact;for(let j=0;j<cs.size();j++){const c=cs.get(j);contacts++;penetration=Math.max(penetration,-c.dist);c.delete();}cs.delete();
    if(i%Math.round(.5/p.timestep)===0){v.sync();const row={...u.state,torque:p.data.actuator_force[0]};rows.push(row);console.log(row);}
  }
  console.log({phaseErrorPixels:100*error,nativePenetrationPixels:100*penetration,trackingDegrees:tracking*180/Math.PI,contacts});
  const audits=[];
  v.reset();
  if(process.env.AUDIT)for(const time of [0,1,2,3,4,5,6,7,8]){v.update(time);const a=auditClutchSourceSolids(v);audits.push({time,...a});console.log({time,issues:a.issues,topology:a.topologyIssues,checks:a.checks});}
  if(process.env.PROBE_PREFIX)fs.writeFileSync(process.env.PROBE_PREFIX+'.json',JSON.stringify({options,rows,audits,phaseErrorPixels:100*error,nativePenetrationPixels:100*penetration,trackingDegrees:tracking*180/Math.PI,contacts},null,2)+'\n',{flag:'wx'});
}finally{v.dispose();}
