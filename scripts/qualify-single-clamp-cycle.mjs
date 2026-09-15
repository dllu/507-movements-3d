import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeSingleClampPhysics} from '../src/simulation/mujoco-single-clamp/physics.js';
const fields=['jaw','boardX','boardY'],speeds=['jawSpeed','boardXSpeed','boardYSpeed'],m=await loadMujoco(),runs=[];
for(const timestep of [.000125,.0000625]){
 const p=makeSingleClampPhysics(m,{timestep,cyclic:true}),samples=[];let minimumGap=0;
 try{
  for(let i=0;i<=Math.round(22/timestep);i++){
   if(i%Math.round(.002/timestep)===0){const s=p.state();assert.ok(Object.values(s).every(Number.isFinite));samples.push(s);}
   const cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{minimumGap=Math.min(minimumGap,c.dist);}finally{c.delete();}}}finally{cs.delete();}
   if(i<Math.round(22/timestep)){const time=p.data.time;p.step();assert.ok(p.data.time>time&&Array.from(p.data.qvel).every(v=>Number.isFinite(v)&&Math.abs(v)<100),'native integration remains stable');}
  }
  const first=samples[8000],last=samples[11000],seam=Object.fromEntries([...fields,...speeds].map(k=>[k,Math.abs(last[k]-first[k])]));
  const cycleDifference=Object.fromEntries(fields.map(k=>[k,Math.max(...samples.slice(8000).map((s,i)=>Math.abs(s[k]-samples[i+5000][k])))]));
  const finalContacts=[],cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{finalContacts.push({geoms:[c.geom1,c.geom2].map(id=>m.mj_id2name(p.model,m.mjtObj.mjOBJ_GEOM.value,id)),position:[...c.pos],gap:c.dist});}finally{c.delete();}}}finally{cs.delete();}
  runs.push({parameters:p.parameters,minimumGap,seam,cycleDifference,first,last,finalContacts,samples});
 }finally{p.dispose();}
}
fs.writeFileSync('/dev/shm/180-native-cycles.json',JSON.stringify(runs));
const timestepDifference=Object.fromEntries(fields.map(k=>[k,Math.max(...runs[0].samples.slice(8000).map((s,i)=>Math.abs(s[k]-runs[1].samples[8000+i][k])))]));
const qualified=runs.every(r=>r.minimumGap>=-1e-6&&fields.every(k=>r.seam[k]<1e-5)&&speeds.every(k=>r.seam[k]<.001)&&r.finalContacts.some(c=>c.geoms.includes('fixed-side'))&&r.finalContacts.some(c=>c.geoms.some(n=>n.startsWith('jaw'))))&&Object.values(timestepDifference).every(v=>v<.003);
const report={movement:180,status:qualified?'native-cycle-checked':'native-cycle-open',period:6,cycleStart:16,timestepDifference,runs:runs.map(({samples,...r})=>r),scope:'Board Y is force limited; board X and the jaw angle are passive. Orientation held. Native geometry excludes displayed pivot holes and decorative hardware, which require separate checks.',sources:['scripts/qualify-single-clamp-cycle.mjs','src/simulation/mujoco-single-clamp/physics.js','src/simulation/mujoco-single-clamp/profile.js','src/simulation/authored-clamps.js','src/simulation/mujoco-bench-clamp/profile.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/180-native-cycle.json',JSON.stringify(report,null,2)+'\n');console.log({qualified,timestepDifference,seams:runs.map(r=>r.seam),cycleDifferences:runs.map(r=>r.cycleDifference)});assert.ok(qualified);
