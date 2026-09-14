import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSegmentClamp} from '../src/simulation/mujoco-segment-clamp/visual.js';
import {segmentClampStudySources} from './lib/segment-clamp-study-sources.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/120-stall',input=process.env.DYNAMICS_REPORT??'/dev/shm/120-dynamics-b.json',report=JSON.parse(fs.readFileSync(input)),sources=freezeStudySources([...segmentClampStudySources('scripts/inspect-segment-clamp-stall.mjs'),input],prefix),v=makeMujocoSegmentClamp(await loadMujoco(),report.options),p=v.physics;
try{
 const row=report.rows.find(r=>r.time>=2);p.data.qpos.set(row.qpos);p.data.qvel.set(row.qvel);p.data.ctrl[0]=p.description.input(row.time).position;v.sync();const contacts=[],cs=p.data.contact;
 try{for(let i=0;i<cs.size();i++){const c=cs.get(i);try{const point=Array.from(c.pos),a=-p.data.qpos[2],local=[point[0]*Math.cos(a)-point[1]*Math.sin(a),point[0]*Math.sin(a)+point[1]*Math.cos(a)];contacts.push({groups:Array.from(c.geom).map(id=>p.geomGroups[id]),point,penetrationPixels:-100*c.dist,internalLocal:local,internalAngleDegrees:Math.atan2(local[1],local[0])*180/Math.PI,internalRadius:Math.hypot(...local)});}finally{c.delete();}}}finally{cs.delete();}
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,row,contacts,qualification:'Contacts recomputed from the recorded stalled pose. Local position distinguishes intended tooth contact from arm contact; this is not a force-convergence study.'},null,2)+'\n',{flag:'wx'});console.log(contacts);
}finally{v.dispose();}
