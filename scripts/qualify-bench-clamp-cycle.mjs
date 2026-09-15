import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import loadMujoco from '@mujoco/mujoco';
import {makeBenchClampPhysics} from '../src/simulation/mujoco-bench-clamp/physics.js';
import {benchClampProfile,convexProfilePieces} from '../src/simulation/mujoco-bench-clamp/profile.js';
const fields=['upper','lower','board','boardY'],speedFields=['upperSpeed','lowerSpeed','boardSpeed','boardYSpeed'];
const decompositions=[0,1].map(side=>{const p=benchClampProfile(side),pieces=convexProfilePieces(p.points,p.triangles);
 const area=ids=>Math.abs(ids.reduce((sum,j,k)=>{const a=p.points[j],b=p.points[ids[(k+1)%ids.length]];return sum+a.x*b.y-a.y*b.x;},0))/2;
 pieces.forEach(ids=>assert.equal(new Set(ids).size,ids.length));
 const original=p.triangles.reduce((s,t)=>s+area(t),0),merged=pieces.reduce((s,t)=>s+area(t),0);assert.ok(Math.abs(original-merged)<1e-12);
 return {side,triangles:p.triangles.length,pieces:pieces.length,areaError:Math.abs(original-merged)};
});
const mujoco=await loadMujoco(),runs=[];
for(const timestep of [.0005,.00025]){
 const p=makeBenchClampPhysics(mujoco,{timestep,cyclic:true}),samples=[];let minimumGap=0;
 try{for(let i=0;i<=Math.round(22/timestep);i++){
  if(i%Math.round(.002/timestep)===0){const s=p.state();assert.ok(Object.values(s).every(Number.isFinite));samples.push(s);}
  const cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{minimumGap=Math.min(minimumGap,c.dist);}finally{c.delete();}}}finally{cs.delete();}
  if(i<Math.round(22/timestep))p.step();
 }
 const first=samples[8000],last=samples[11000];
 const seam=Object.fromEntries([...fields,...speedFields].map(key=>[key,Math.abs(last[key]-first[key])]));
 const cycle=samples.slice(8000,11001),previous=samples.slice(5000,8001);
 const cycleDifference=Object.fromEntries(fields.map(key=>[key,Math.max(...cycle.map((s,i)=>Math.abs(s[key]-previous[i][key])))]));
 const contactJaws=new Set(),cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{for(const id of [c.geom1,c.geom2]){const name=mujoco.mj_id2name(p.model,mujoco.mjtObj.mjOBJ_GEOM.value,id);if(name.startsWith('jaw'))contactJaws.add(name.slice(0,4));}}finally{c.delete();}}}finally{cs.delete();}
 runs.push({parameters:p.parameters,minimumGap,seam,cycleDifference,contactJaws:[...contactJaws],first,last,samples});
 }finally{p.dispose();}
}
fs.writeFileSync('/dev/shm/174-native-cycles.json',JSON.stringify(runs));
const timestepDifference=Object.fromEntries(fields.map(key=>[key,Math.max(...runs[0].samples.slice(8000).map((s,i)=>Math.abs(s[key]-runs[1].samples[8000+i][key])))]));
const report={movement:174,status:'passive-release-reinsertion-study',period:6,cycleStart:16,decompositions,timestepDifference,
 scope:'Only board X is actuated. Passive jaw hinges and free board Y; orientation held. Native collision pieces preserve the source trace. Finite display hardware and bake interpolation remain unqualified.',
 runs:runs.map(({samples,...r})=>r),sources:['scripts/qualify-bench-clamp-cycle.mjs','src/simulation/mujoco-bench-clamp/physics.js','src/simulation/mujoco-bench-clamp/profile.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/174-native-cycle.json',JSON.stringify(report,null,2)+'\n');console.log(report);
for(const r of runs){assert.ok(r.minimumGap>=-1e-6);assert.equal(r.contactJaws.length,2);for(const key of fields)assert.ok(r.seam[key]<1e-5);for(const key of speedFields)assert.ok(r.seam[key]<.001);}
for(const key of fields)assert.ok(timestepDifference[key]<.003,key+' timestep mismatch');
