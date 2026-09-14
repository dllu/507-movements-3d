import fs from 'node:fs';
import assert from 'node:assert/strict';
import {freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/126-fit';
const circleFile=process.env.SOURCE_REPORT??'/dev/shm/126-source-a.json';
const edgeFile=process.env.EDGE_REPORT??'/dev/shm/126-edges-a.json';
const source=JSON.parse(fs.readFileSync(circleFile)), edges=JSON.parse(fs.readFileSync(edgeFile));
const sources=freezeStudySources([circleFile,edgeFile,'scripts/fit-bell-crank-source.mjs','scripts/lib/study-report-io.mjs'],prefix);
function leastSquares(rows,n){
 const a=Array.from({length:n},(_,i)=>[...Array.from({length:n},(_,j)=>rows.reduce((s,r)=>s+r.x[i]*r.x[j],0)),rows.reduce((s,r)=>s+r.x[i]*r.y,0)]);
 for(let i=0;i<n;i++){let best=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[best][i]))best=j;[a[i],a[best]]=[a[best],a[i]];const v=a[i][i];assert(Math.abs(v)>1e-12);for(let j=i;j<=n;j++)a[i][j]/=v;for(let k=0;k<n;k++)if(k!==i){const f=a[k][i];for(let j=i;j<=n;j++)a[k][j]-=f*a[i][j];}}
 return a.map(r=>r[n]);
}
const stats=errors=>({rms:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),maximum:Math.max(...errors.map(Math.abs)),samples:errors.length});
const arms={};
for(const[name,a]of Object.entries(edges.arms)){
 const from=source.circles[a.from].center,to=source.circles[a.to].center,delta=to.map((v,i)=>v-from[i]),length=Math.hypot(...delta),normal=[-delta[1]/length,delta[0]/length],contours={};
 for(const side of ['left','right']){
  const rows=a[side].map(p=>{const d=p.map((v,i)=>v-from[i]),t=d.reduce((s,v,i)=>s+v*delta[i],0)/length**2;return{x:[1,t,t*t,t*t*t],y:d.reduce((s,v,i)=>s+v*normal[i],0)};}),coefficients=leastSquares(rows,4);
  contours[side]={coefficients,...stats(rows.map(r=>r.y-r.x.reduce((s,v,i)=>s+v*coefficients[i],0)))};
 }
 arms[name]={from,to,length,normal,contours};
}
const left=edges.cords.left.stations,right=edges.cords.right.stations,C=source.circles.pulleyRim.center,P=source.circles.inputPin.center;
const line=leastSquares(left.map(p=>({x:[1,p.y-C[1]],y:p.center})),2),slope=line[1];
function tangents(radius){
 const dx=P[0]-C[0],dy=P[1]-C[1],angle=Math.atan2(dy,dx)-Math.acos(radius/Math.hypot(dx,dy));
 const tangent=[C[0]+radius*Math.cos(angle),C[1]+radius*Math.sin(angle)];
 const rightSlope=(P[0]-tangent[0])/(P[1]-tangent[1]);
 const leftAt=y=>C[0]-radius*Math.hypot(1,slope)+slope*(y-C[1]);
 const rightAt=y=>tangent[0]+rightSlope*(y-tangent[1]);
 const errors=[...left.map(p=>(p.center-leftAt(p.y))/Math.hypot(1,slope)),...right.map(p=>(p.center-rightAt(p.y))/Math.hypot(1,rightSlope))];
 return{radius,tangent,rightSlope,leftEnd:[leftAt(326),326],leftNormal:[1,-slope].map(v=>v/Math.hypot(1,slope)),...stats(errors)};
}
let cord;for(let radius=72;radius<=79;radius+=.001){const candidate=tangents(radius);if(!cord||candidate.rms<cord.rms)cord=candidate;}
cord.leftSlope=slope;cord.ropeRadiusPixels=[...left,...right].reduce((s,p)=>s+p.width,0)/(2*(left.length+right.length));
cord.outerInkQualification='Constant circular rope radius inferred from mean hatched ink-envelope width; visible stripe edges are not calibrated material boundaries.';
const report={sources,arms,cord,qualification:'Cubic normal offsets fit the independent lever contours. A common hidden pulley pitch circle fits both cord centerlines while retaining the measured input pin. Left support follows its source tangent; right cord attaches at the measured pin. Bearings, groove depth and end loads remain inferred.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...report,sources:sources.length},null,2));
