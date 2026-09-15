import fs from 'node:fs';
import {createHash} from 'node:crypto';
const pairs=[['whole-link exclusions','/dev/shm/159-bow-full.json','/dev/shm/159-bow-full-fine.json'],['material-clipped contact','/dev/shm/159-clipped-anchor.json','/dev/shm/159-clipped-anchor-fine.json']];
const results=pairs.map(([name,coarse,fine])=>{
 const a=JSON.parse(fs.readFileSync(coarse)),b=JSON.parse(fs.readFileSync(fine));let maximumPointDifference={distance:0},maximumTreadleDifference=0;
 if(a.length!==b.length)throw Error('Different sample counts');
 for(let i=0;i<a.length;i++){
  if(Math.abs(a[i].time-b[i].time)>1e-8||a[i].points.length!==b[i].points.length)throw Error('Incompatible trajectories');
  maximumTreadleDifference=Math.max(maximumTreadleDifference,Math.abs(a[i].treadle-b[i].treadle));
  for(let j=0;j<a[i].points.length;j++){
   const distance=Math.hypot(...a[i].points[j].map((v,k)=>v-b[i].points[j][k]));
   if(distance>maximumPointDifference.distance)maximumPointDifference={time:a[i].time,vertex:j,distance};
  }
 }
 return {name,samples:a.length,duration:a.at(-1).time,maximumPointDifference,maximumTreadleDifference};
});
const files=['scripts/review-cord-treadle-anchor-refinement.mjs',...pairs.flatMap(p=>p.slice(1))];
const report={movement:159,method:'Compare identical material vertices of the 96-segment rope at matching .02 s samples over one cycle; both timesteps use .02 initial bow. Before/after differs only in anchor-contact selection.',results,sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/159-anchor-refinement.json',JSON.stringify(report,null,2)+'\n');console.log(results);
