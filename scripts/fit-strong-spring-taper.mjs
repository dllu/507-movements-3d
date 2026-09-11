import { readFile, writeFile } from 'node:fs/promises';
import { makeElasticRatchetStudy } from './lib/spring-pressed-ratchet-elastic.mjs';
import { springRatchetSource } from './lib/spring-pressed-ratchet-source.mjs';

const measured=JSON.parse(await readFile('artifacts/review/073-strong-spring-taper.json','utf8'));
const rod=makeElasticRatchetStudy({segments:512}).rods[1],cumulative=[0];
for(const length of rod.lengths)cumulative.push(cumulative.at(-1)+length);
const rows=measured.rows.filter(row=>row.y<=measured.clampY).map(row=>{
  const point=[(row.center[0]-springRatchetSource.center[0])/springRatchetSource.scale,
    (springRatchetSource.center[1]-row.center[1])/springRatchetSource.scale];
  let closest;
  for(let i=0;i<rod.lengths.length;i++){
    const a=rod.points[i],b=rod.points[i+1],edge=[b[0]-a[0],b[1]-a[1]],delta=[point[0]-a[0],point[1]-a[1]];
    const t=Math.max(0,Math.min(1,(delta[0]*edge[0]+delta[1]*edge[1])/rod.lengths[i]**2));
    const distance=Math.hypot(delta[0]-t*edge[0],delta[1]-t*edge[1]);
    if(!closest||distance<closest.distance)closest={distance,fraction:(cumulative[i]+t*rod.lengths[i])/rod.length};
  }
  const normalFactor=row.normalWidth/row.horizontalWidth;
  return{y:row.y,fraction:closest.fraction,measured:row.normalWidth,
    widthInterval:[(row.right[0]-row.left[1])*normalFactor,(row.right[1]-row.left[0])*normalFactor]};
});
const n=rows.length,sx=rows.reduce((s,r)=>s+r.fraction,0),sy=rows.reduce((s,r)=>s+r.measured,0),
  sxx=rows.reduce((s,r)=>s+r.fraction**2,0),sxy=rows.reduce((s,r)=>s+r.fraction*r.measured,0);
const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx),root=(sy-slope*sx)/n,tip=root+slope;
for(const row of rows){row.fitted=root+slope*row.fraction;row.residual=row.fitted-row.measured;
  row.insideStrokeInterval=row.fitted>=row.widthInterval[0]&&row.fitted<=row.widthInterval[1];}
const report={movement:73,strongRootPixels:root,strongTipPixels:tip,rows,
  rms:Math.sqrt(rows.reduce((sum,row)=>sum+row.residual**2,0)/rows.length),
  qualification:'Least-squares linear taper in free-leaf arclength, fitted to manually measured boundary-stroke centers. Stroke intervals use the observed stroke edges; they express engraving ambiguity rather than statistical confidence. No production geometry changed.'};
await writeFile('artifacts/review/073-linear-taper-fit.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(report);
if(rows.some(r=>!r.insideStrokeInterval))process.exitCode=1;
