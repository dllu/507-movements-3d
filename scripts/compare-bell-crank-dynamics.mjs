import fs from 'node:fs';
import assert from 'node:assert/strict';
import source from '../src/simulation/mujoco-bell-crank/source.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/126-motion-comparison';
const files=JSON.parse(process.env.REPORTS??'["/dev/shm/126-dynamics-j.json","/dev/shm/126-dynamics-k.json"]');
assert(Array.isArray(files)&&files.length===2);
const sources=freezeStudySources(['scripts/compare-bell-crank-dynamics.mjs','scripts/lib/study-report-io.mjs','src/simulation/mujoco-bell-crank/source.js',...files],prefix);
const [a,b]=files.map(file=>JSON.parse(fs.readFileSync(file)));
for(const report of[a,b]){assert.equal(report.failure,null);assert.equal(report.timeResets,0);assert(report.completedTime>=report.duration-1e-8);}
const scales={drive:100,output:100,bell:source.arms.input.length,spin:source.cord.pitchRadiusPixels,inputGrip:14,outputGrip:14};
const stats=Object.fromEntries(Object.keys(scales).map(n=>[n,{maximumPixels:0,sumSquares:0}]));
let index=0,count=0;
for(const row of a.rows){
 while(index+1<b.rows.length&&b.rows[index+1].time<row.time)index++;
 if(index+1===b.rows.length||b.rows[index].time>row.time)continue;
 const lo=b.rows[index],hi=b.rows[index+1],t=(row.time-lo.time)/(hi.time-lo.time);count++;
 for(const[name,scale]of Object.entries(scales)){
  const error=scale*(row.qpos[name]-lo.qpos[name]-t*(hi.qpos[name]-lo.qpos[name]));
  stats[name].maximumPixels=Math.max(stats[name].maximumPixels,Math.abs(error));stats[name].sumSquares+=error**2;
 }
}
assert(count>0);
const comparison=Object.fromEntries(Object.entries(stats).map(([name,s])=>[name,{maximumPixels:s.maximumPixels,rmsPixels:Math.sqrt(s.sumSquares/count)}]));
const report={sources,files,count,comparison,qualification:'Same-time comparison by linear interpolation of 20 ms native samples. Hinge angles are scaled by measured input-arm length, pulley pitch radius, or reconstructed 14-pixel grip offset. Grip measures are relative pin rotations, not world endpoint displacement. This compares motion, not force convergence; interpolation can conceal faster differences.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({count,comparison});
