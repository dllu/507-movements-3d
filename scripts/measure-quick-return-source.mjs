import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import loadMujoco from '@mujoco/mujoco';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';
import source from '../src/simulation/mujoco-quick-return/source.js';
import {makeMujocoQuickReturn} from '../src/simulation/mujoco-quick-return/visual.js';

const file='public/engravings/mm_100.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function inkRuns(p,n,low,high) {
  const runs=[];let start;
  for(let r=low;r<=high+.01;r+=.2) {
    const ink=pixel(p[0]+r*n[0],p[1]+r*n[1])<110;
    if(ink&&start===undefined)start=r;
    if(!ink&&start!==undefined){if(start>low+.01&&r-start<7)runs.push((start+r-.2)/2);start=undefined;}
  }
  return runs;
}
const circles={};
for(const [name,center,lo,hi,nominal] of [
  ['disk',[157,300],93,104,99],['hub',[157,299],32,43,38],['shaft',[157,299],16,24,20],
  ['pivot',[350,278],32,42,38],['pivotShaft',[350,278],17,25,21],['pin',[121,203],11,22,17],
]) {
  const points=[];
  for(let deg=0;deg<360;deg+=3) {
    if(name==='disk'&&deg>216&&deg<351)continue;
    if(name==='hub'&&deg>208&&deg<316)continue;
    if(name==='pivot'&&((deg>165&&deg<211)||(deg>0&&deg<38)))continue;
    const a=deg*Math.PI/180,n=[Math.cos(a),Math.sin(a)],runs=inkRuns(center,n,lo,hi).sort((a,b)=>Math.abs(a-nominal)-Math.abs(b-nominal));
    if(runs.length)points.push(center.map((v,i)=>v+runs[0]*n[i]));
  }
  circles[name]=circleFit(points);
}
const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const segmentDistance=(p,a,b)=>{const d=b.map((v,i)=>v-a[i]),t=Math.max(0,Math.min(1,p.reduce((s,v,i)=>s+(v-a[i])*d[i],0)/d.reduce((s,v)=>s+v*v,0)));return Math.hypot(...p.map((v,i)=>v-a[i]-t*d[i]));};
function occluded(p) {
  return Math.hypot(p[0]-121,p[1]-203)<23||
    Math.abs(Math.hypot(...p.map((v,i)=>v-circles.disk.center[i]))-circles.disk.radius)<3||
    segmentDistance(p,[105,203],[121,302])<3||segmentDistance(p,[136,203],[192,282])<3;
}
function sample(center,angle,local,normal,points,mask=false) {
  const r=rotate(local,angle),p=r.map((v,i)=>v+center[i]),n=rotate(normal,angle);
  if(mask&&occluded(p))return;
  const runs=inkRuns(p,n,-7,7).sort((a,b)=>Math.abs(a)-Math.abs(b));
  if(runs.length){const point=p.map((v,i)=>v+runs[0]*n[i]);if(!mask||!occluded(point))points.push(point);}
}
function solve(a) {
  for(let i=0;i<a.length;i++) {
    let pivot=i;for(let j=i+1;j<a.length;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];for(let j=i;j<=a.length;j++)a[i][j]/=d;
    for(let j=0;j<a.length;j++)if(i!==j){const f=a[j][i];for(let k=i;k<=a.length;k++)a[j][k]-=f*a[i][k];}
  }
  return a.map(r=>r.at(-1));
}
function fit(points,seed,residual) {
  let q=[...seed];
  for(let iteration=0;iteration<15;iteration++) {
    const n=q.length,a=Array.from({length:n},()=>Array(n+1).fill(0));
    for(const p of points) {
      const r=residual(q,p),row=q.map((_,i)=>{const shifted=[...q];shifted[i]+=.00001;return(residual(shifted,p)-r)/.00001;});
      for(let i=0;i<n;i++){for(let j=0;j<n;j++)a[i][j]+=row[i]*row[j];a[i][n]-=row[i]*r;}
    }
    const step=solve(a);q=q.map((v,i)=>v+step[i]);
  }
  const residuals=points.map(p=>residual(q,p));
  return {parameters:q,points,residuals,rms:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/points.length),maximum:Math.max(...residuals.map(Math.abs))};
}
const slotSeed=[160,217,.309,128,16.5],slotPoints=[];
for(let deg=0;deg<360;deg+=3){const a=deg*Math.PI/180,n=[Math.cos(a),Math.sin(a)];sample(slotSeed,.309,[Math.sign(n[0])*128+16.5*n[0],16.5*n[1]],n,slotPoints,true);}
for(const sign of [-1,1])for(let x=-125;x<128;x+=3)sample(slotSeed,.309,[x,sign*16.5],[0,sign],slotPoints,true);
const slot=fit(slotPoints,slotSeed,(q,p)=>{const [x,y]=rotate(p.map((v,i)=>v-q[i]),-q[2]);return Math.hypot(Math.max(0,Math.abs(x)-q[3]),y)-q[4];});
// The outer lever has a round left end and parallel sides; the right end
// joins its separately measured pivot boss and is not another exposed cap.
const bodySeed=[35,177,.309,30],bodyPoints=[];
for(let deg=90;deg<=270;deg+=3){const a=deg*Math.PI/180,n=[Math.cos(a),Math.sin(a)];sample(bodySeed,.309,n.map(v=>v*30),n,bodyPoints);}
for(const sign of [-1,1])for(let x=3;x<292;x+=3)sample(bodySeed,.309,[x,sign*30],[0,sign],bodyPoints,true);
const body=fit(bodyPoints,bodySeed,(q,p)=>{const [x,y]=rotate(p.map((v,i)=>v-q[i]),-q[2]);return Math.hypot(Math.min(0,x),y)-q[3];});
const result={file,sha256:hashStudyFile(file),circles,slot,body,
  manual:{output:[[375,270],[483,309],[493,315],[500,323],[505,332],[507,342],[504,345],[493,343],[374,307]]},
  qualification:'Circle ink-run midpoints and independent normal scans fit the slot capsule and round-ended lever. Masks exclude the pin, crank edges, wheel-outline crossings and the outer lever’s pivot boss. Full depth and bearing construction remain inferred.'};
assert.deepEqual(source.axis,circles.shaft.center);assert.deepEqual(source.pivot,circles.pivotShaft.center);
assert.deepEqual(source.pin,circles.pin.center);assert.deepEqual(source.slot,slot.parameters);assert.deepEqual(source.body,body.parameters);
const visual=makeMujocoQuickReturn(await loadMujoco());
try {
  const u=visual.root.userData,f=u.profile,b=visual.physics.data.qpos[1];
  const local=p=>rotate(f.world(p).map((v,i)=>v-f.pivot[i]),-b);
  const slotDistances=slot.points.map(p=>{const[x,y]=local(p);return 100*Math.abs(Math.hypot(Math.max(0,Math.abs(x-f.center[0])-f.halfLength),y-f.center[1])-f.halfWidth);});
  const outlines=u.geometry.outline.map(p=>p[0]);
  const bodyDistances=body.points.map(p=>{const point=local(p);return 100*Math.min(...outlines.flatMap(ring=>ring.slice(0,-1).map((a,i)=>segmentDistance(point,a,ring[i+1]))));});
  const stats=values=>({rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),maximum:Math.max(...values),distances:values});
  result.reconstruction={settledSlotPixels:stats(slotDistances),settledBodyPixels:stats(bodyDistances),
    initialLeverAdjustmentDegrees:(b-f.sourceAngle)*180/Math.PI,diskRecenteringPixels:Math.hypot(...source.axis.map((v,i)=>v-source.diskCenter[i])),
    crankRadiusPixels:100*f.crankRadius,pivotDistancePixels:100*f.pivotDistance,clearancePixels:100*f.clearance,idealQuickReturnRatio:f.quickReturnRatio};
}finally{visual.dispose();}
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/100-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])));
for(const [n,f] of Object.entries({slot,body}))console.log(n,{parameters:f.parameters,rms:f.rms,maximum:f.maximum,count:f.points.length});
console.log({...result.reconstruction,settledSlotPixels:{...result.reconstruction.settledSlotPixels,distances:undefined},settledBodyPixels:{...result.reconstruction.settledBodyPixels,distances:undefined}});
