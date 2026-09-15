import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {cordTreadleParameters} from '../src/simulation/cord-treadle-motion.js';
const localBow=process.env.LOCAL_BOW==='1';
const pairs=[['inscribed initial rope','/dev/shm/159-stud-fine.json','/dev/shm/159-stud-finer.json'],['cleared initial rope','/dev/shm/159-initial-clear-fine.json','/dev/shm/159-initial-clear-finer.json']];
if(localBow)pairs.push(['localized initial bow','/dev/shm/159-local-bow-fine.json','/dev/shm/159-local-bow-finer.json'],['bending rigidity .005','/dev/shm/159-stiffer-fine.json','/dev/shm/159-stiffer-finer.json']);
const g=cordTreadleParameters(),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const segmentDistance=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((g.guide[0]-a[0])*dx+(g.guide[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(a[0]+t*dx-g.guide[0],a[1]+t*dy-g.guide[1])-g.guideRadius;};
const curvature=rows=>{let maximum=0;for(const s of rows)for(let i=1;i<s.points.length-1;i++){const a=s.points[i].map((v,j)=>v-s.points[i-1][j]),b=s.points[i+1].map((v,j)=>v-s.points[i][j]),la=Math.hypot(...a),lb=Math.hypot(...b),angle=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);maximum=Math.max(maximum,2*Math.sin(Math.abs(angle)/2)/((la+lb)/2));}return maximum;};
const data=pairs.map(p=>p.slice(1).map(file=>JSON.parse(fs.readFileSync(file)).filter(s=>s.time<=.4+1e-8)));
const comparisons=data.map(([a,b],k)=>{
 let maximumPointDifference={distance:0},maximumTreadleDifference=0;
 if(a.length!==b.length)throw Error('Mismatched sample counts');
 for(let i=0;i<a.length;i++){
  if(Math.abs(a[i].time-b[i].time)>1e-8)throw Error('Mismatched clocks');
  maximumTreadleDifference=Math.max(maximumTreadleDifference,Math.abs(a[i].treadle-b[i].treadle));
  for(let j=0;j<a[i].points.length;j++){const d=distance(a[i].points[j],b[i].points[j]);if(d>maximumPointDifference.distance)maximumPointDifference={time:a[i].time,vertex:j,distance:d};}
 }
 return {name:pairs[k][0],maximumPointDifference,maximumTreadleDifference,runs:[a,b].map(r=>({maximumDiscreteCurvature:curvature(r),initialMinimumPulleyClearance:Math.min(...r[0].points.slice(1).map((p,i)=>segmentDistance(r[0].points[i],p))),minimumPulleyClearance:Math.min(...r.flatMap(s=>s.points.slice(1).map((p,i)=>segmentDistance(s.points[i],p))))}))};
});
const old=data[0][0][0].points,corrected=data[1][0][0].points;
const initialChange={maximumVertexDisplacement:Math.max(...old.map((p,i)=>distance(p,corrected[i]))),endpoints:[0,old.length-1].map(i=>distance(old[i],corrected[i])),restLengthBefore:old.slice(1).reduce((sum,p,i)=>sum+distance(p,old[i]),0),restLengthAfter:corrected.slice(1).reduce((sum,p,i)=>sum+distance(p,corrected[i]),0)};
const files=['scripts/review-cord-treadle-initial-clearance.mjs','src/simulation/cord-treadle-motion.js',...pairs.flatMap(p=>p.slice(1))];
const report={movement:159,method:'First .4 s of 96-link native trajectories, matching .02 s samples at .05/.025 ms timesteps. Direct material-vertex comparisons and independent capsule/pulley clearance. Initial radial lift is not a runtime constraint.',initialChange,localBowChange:localBow?Math.max(...data[1][0][0].points.map((p,i)=>distance(p,data[2][0][0].points[i]))):null,comparisons,sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(localBow?'docs/validation/159-local-bow-study.json':'docs/validation/159-initial-clearance.json',JSON.stringify(report,null,2)+'\n');console.log({initialChange,comparisons});
