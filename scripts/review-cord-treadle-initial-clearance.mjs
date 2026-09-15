import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {cordTreadleParameters} from '../src/simulation/cord-treadle-motion.js';
const pairs=[['inscribed initial rope','/dev/shm/159-stud-fine.json','/dev/shm/159-stud-finer.json'],['cleared initial rope','/dev/shm/159-initial-clear-fine.json','/dev/shm/159-initial-clear-finer.json']];
const g=cordTreadleParameters(),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const segmentDistance=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((g.guide[0]-a[0])*dx+(g.guide[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(a[0]+t*dx-g.guide[0],a[1]+t*dy-g.guide[1])-g.guideRadius;};
const data=pairs.map(p=>p.slice(1).map(file=>JSON.parse(fs.readFileSync(file)).filter(s=>s.time<=.4+1e-8)));
const comparisons=data.map(([a,b],k)=>{
 let maximumPointDifference={distance:0},maximumTreadleDifference=0;
 if(a.length!==b.length)throw Error('Mismatched sample counts');
 for(let i=0;i<a.length;i++){
  if(Math.abs(a[i].time-b[i].time)>1e-8)throw Error('Mismatched clocks');
  maximumTreadleDifference=Math.max(maximumTreadleDifference,Math.abs(a[i].treadle-b[i].treadle));
  for(let j=0;j<a[i].points.length;j++){const d=distance(a[i].points[j],b[i].points[j]);if(d>maximumPointDifference.distance)maximumPointDifference={time:a[i].time,vertex:j,distance:d};}
 }
 return {name:pairs[k][0],maximumPointDifference,maximumTreadleDifference,runs:[a,b].map(r=>({initialMinimumPulleyClearance:Math.min(...r[0].points.slice(1).map((p,i)=>segmentDistance(r[0].points[i],p))),minimumPulleyClearance:Math.min(...r.flatMap(s=>s.points.slice(1).map((p,i)=>segmentDistance(s.points[i],p))))}))};
});
const old=data[0][0][0].points,corrected=data[1][0][0].points;
const initialChange={maximumVertexDisplacement:Math.max(...old.map((p,i)=>distance(p,corrected[i]))),endpoints:[0,old.length-1].map(i=>distance(old[i],corrected[i])),restLengthBefore:old.slice(1).reduce((sum,p,i)=>sum+distance(p,old[i]),0),restLengthAfter:corrected.slice(1).reduce((sum,p,i)=>sum+distance(p,corrected[i]),0)};
const files=['scripts/review-cord-treadle-initial-clearance.mjs','src/simulation/cord-treadle-motion.js',...pairs.flatMap(p=>p.slice(1))];
const report={movement:159,method:'First .4 s of 96-link native trajectories, matching .02 s samples at .05/.025 ms timesteps. Direct material-vertex comparisons and independent capsule/pulley clearance. Initial radial lift is not a runtime constraint.',initialChange,comparisons,sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/159-initial-clearance.json',JSON.stringify(report,null,2)+'\n');console.log({initialChange,comparisons});
