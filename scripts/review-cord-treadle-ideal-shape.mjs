import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const file='/dev/shm/159-ideal-shaped.json',rows=JSON.parse(fs.readFileSync(file)),radius=.045;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const pointSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const segmentDistance=(a,b,c,d)=>[0,1].every(i=>Math.min(Math.max(a[i],b[i]),Math.max(c[i],d[i]))>=Math.max(Math.min(a[i],b[i]),Math.min(c[i],d[i])))&&cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0?0:Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
assert.equal(segmentDistance([0,0],[1,1],[0,1],[1,0]),0);
assert.ok(Math.abs(segmentDistance([0,0],[1,1],[2,2],[3,3])-Math.SQRT2)<1e-12);
let witness=null;let self=Infinity,maximumCurvature=0,maximumAnalyticCurvature=0,floor=Infinity;
for(const row of rows){
 const [p0,p1,p2,p3]=row.controls;
 for(let j=0;j<=1024;j++){const t=j/1024,u=1-t,d=[0,1].map(i=>3*(u*u*(p1[i]-p0[i])+2*u*t*(p2[i]-p1[i])+t*t*(p3[i]-p2[i]))),dd=[0,1].map(i=>6*(u*(p2[i]-2*p1[i]+p0[i])+t*(p3[i]-2*p2[i]+p1[i])));maximumAnalyticCurvature=Math.max(maximumAnalyticCurvature,Math.abs(d[0]*dd[1]-d[1]*dd[0])/Math.hypot(...d)**3);}
 floor=Math.min(floor,row.points.at(-1)[1]-radius+3.3955555555555557);
 const p=row.points,lengths=p.slice(1).map((q,i)=>Math.hypot(q[0]-p[i][0],q[1]-p[i][1]));const material=[0];lengths.forEach(l=>material.push(material.at(-1)+l));
 for(let i=0;i<p.length-1;i++){
  floor=Math.min(floor,p[i][1]-radius+3.3955555555555557);
  for(let j=i+2;j<p.length-1;j++){if(material[j]-material[i+1]<4*radius)continue;const clearance=segmentDistance(p[i],p[i+1],p[j],p[j+1])-2*radius;if(clearance<self){self=clearance;witness={time:row.time,i,j,points:[p[i],p[i+1],p[j],p[j+1]]};}}
  if(i){const a=p[i].map((v,j)=>v-p[i-1][j]),b=p[i+1].map((v,j)=>v-p[i][j]),angle=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);maximumCurvature=Math.max(maximumCurvature,2*Math.sin(Math.abs(angle)/2)/((lengths[i-1]+lengths[i])/2));}
 }
}
const sources=['scripts/review-cord-treadle-ideal-shape.mjs',file];const report={movement:159,samples:rows.length,method:'Finite polyline capsule-distance checks, excluding local neighbors with less than four rope radii of material gap. Discrete curvature plus 1025 analytic Bezier-curvature samples per pose check local tubular folding. Not a continuous-time proof.',minimumNonlocalSelfClearance:self,witness,maximumRadiusTimesCurvature:radius*maximumCurvature,maximumRadiusTimesAnalyticCurvature:radius*maximumAnalyticCurvature,minimumFloorClearance:floor,sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/159-ideal-shape-self-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(self>=0);assert.ok(radius*maximumCurvature<1);assert.ok(radius*maximumAnalyticCurvature<1);assert.ok(floor>=0);
