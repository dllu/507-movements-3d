import fs from 'node:fs';
import {createHash} from 'node:crypto';
const files=['/dev/shm/159-stud-coarse.json','/dev/shm/159-stud-fine.json','/dev/shm/159-stud-finer.json'],rows=files.map(file=>JSON.parse(fs.readFileSync(file)));
const comparisons=[0,1].map(k=>{
 const a=rows[k],b=rows[k+1];if(a.length!==b.length)throw Error('Different sample counts');
 const windows=[[0,.4],[.4,2],[2,4]].map(([start,end])=>{
  let rope={distance:0},treadle=0,disk=0;
  for(let i=0;i<a.length;i++){
   if(Math.abs(a[i].time-b[i].time)>1e-8||a[i].points.length!==b[i].points.length)throw Error('Incompatible trajectories');
   if(a[i].time<start-1e-8||a[i].time>end+1e-8)continue;
   treadle=Math.max(treadle,Math.abs(a[i].treadle-b[i].treadle));disk=Math.max(disk,Math.abs(a[i].disk-b[i].disk));
   for(let j=0;j<a[i].points.length;j++){const distance=Math.hypot(...a[i].points[j].map((v,l)=>v-b[i].points[j][l]));if(distance>rope.distance)rope={time:a[i].time,vertex:j,distance};}
  }
  return {start,end,rope,treadle,disk};
 });
 return {timesteps:k===0?[.0001,.00005]:[.00005,.000025],windows};
});
const seams=rows.map((r,i)=>({file:files[i],rope:Math.max(...r[0].points.map((p,j)=>Math.hypot(...p.map((v,k)=>v-r.at(-1).points[j][k])))),treadle:Math.abs(r[0].treadle-r.at(-1).treadle),maximumDiskTrackingError:Math.max(...r.map(s=>Math.abs(s.disk-Math.PI/2*s.time)))}));
const sources=['scripts/review-cord-treadle-stud-refinement.mjs',...files];const report={movement:159,method:'Identical material-vertex comparisons at matching .02 s samples over one native cycle, with crank-stud contact and .02 initial bow. Seams compare positions only and do not establish velocity continuity or a settled orbit.',comparisons,seams,sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/159-stud-refinement.json',JSON.stringify(report,null,2)+'\n');console.log({comparisons,seams});
