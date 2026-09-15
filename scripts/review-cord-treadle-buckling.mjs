import fs from 'node:fs';
import {createHash} from 'node:crypto';
const full=process.env.FULL==='1',duration=full?4:.4;
const pairs=[['straight','/dev/shm/159-lower-eye.json','/dev/shm/159-lower-eye-fine.json'],['bow .02',`/dev/shm/159-bow-${full?'full':'short'}.json`,`/dev/shm/159-bow-${full?'full':'short'}-fine.json`]];
const results=pairs.map(([name,left,right])=>{
 const a=JSON.parse(fs.readFileSync(left)),b=JSON.parse(fs.readFileSync(right));
 let firstDifference=null,maximum={distance:0};const windows=[];
 for(const [start,end] of [[0,.1],[.1,.4],...(full?[[.4,1],[1,2],[2,4]]:[])]){
  let maximumPointDifference=0,maximumTreadleDifference=0;
  for(let i=0;i<a.length&&a[i].time<=duration+1e-8;i++){
   if(Math.abs(a[i].time-b[i].time)>1e-8||a[i].points.length!==b[i].points.length)throw Error('Incompatible samples');
   if(a[i].time<start-1e-8||a[i].time>end+1e-8)continue;
   maximumTreadleDifference=Math.max(maximumTreadleDifference,Math.abs(a[i].treadle-b[i].treadle));
   for(let j=0;j<a[i].points.length;j++){
    const distance=Math.hypot(...a[i].points[j].map((v,k)=>v-b[i].points[j][k]));
    if(distance>.01&&!firstDifference)firstDifference={time:a[i].time,link:j,distance};
    if(distance>maximum.distance)maximum={time:a[i].time,link:j,distance};
    maximumPointDifference=Math.max(maximumPointDifference,distance);
   }
  }
  windows.push({start,end,maximumPointDifference,maximumTreadleDifference});
 }
 const near=samples=>{const row=samples.find(r=>Math.abs(r.time-.2)<1e-8);return row.points.at(-3)[0]-row.points.at(-1)[0];};
 return {name,windows,firstDifference,maximum,nearEndLateralOffsetAtPoint2Seconds:{coarse:near(a),fine:near(b)}};
});
const files=['scripts/review-cord-treadle-buckling.mjs',...pairs.flatMap(p=>p.slice(1))];
const report={movement:159,duration,method:'Compare identical material vertices of the 96-link rope at matching .02 s samples, over the reported duration. Initial bow is a starting-shape assumption, not a runtime forcing term. Lateral offset uses the penultimate-but-one vertex relative to the secured end.',results,sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(full?'docs/validation/159-rope-buckling-full.json':'docs/validation/159-rope-buckling.json',JSON.stringify(report,null,2)+'\n');console.log(results);
