import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';

const file='public/engravings/mm_092.png';
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
const specs=[
  ['wheelOuter',[161,123],[82,91],86],['wheelInner',[161,123],[68,76],72],
  ['hub',[161,122],[21,27],24],['shaft',[161,122],[11,16],13],
  ['crankEye',[185,166],[6,11],8],['crankPin',[185,166],[2,6],4],
  ['wristEye',[346,117],[5,10],7],['wristPin',[346,117],[2,5],3.5],
];
const circles={};
for(const [name,center,range,nominal] of specs) {
  const points=[];
  for(let degrees=0;degrees<360;degrees+=4) {
    if(name.startsWith('wheel')&&degrees>8&&degrees<42)continue;
    const angle=degrees*Math.PI/180,runs=[];let run=[];
    for(let r=range[0];r<=range[1];r+=.2) {
      if(pixel(center[0]+r*Math.cos(angle),center[1]+r*Math.sin(angle))<110)run.push(r);
      else if(run.length){runs.push(run);run=[];}
    }
    if(run.length)runs.push(run);
    const choices=runs.filter(r=>r[0]>range[0]&&r.at(-1)<range[1]-.1)
      .sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-nominal)-Math.abs((b[0]+b.at(-1))/2-nominal));
    if(!choices.length)continue;
    const r=(choices[0][0]+choices[0].at(-1))/2;
    points.push([center[0]+r*Math.cos(angle),center[1]+r*Math.sin(angle)]);
  }
  circles[name]=circleFit(points);
}
// Read the innermost ink boundaries on either side of the clear top opening.
// These scanlines are independent of the subsequently fitted cubic curves.
const openingPoints=[];
for(let y=60;y<=88;y++)for(const [lo,hi,last] of [[132,159,true],[162,190,false]]) {
  const runs=[];let run=[];
  for(let x=lo;x<=hi;x++) {
    if(pixel(x,y)<110)run.push(x);else if(run.length){runs.push(run);run=[];}
  }
  if(run.length)runs.push(run);
  const choices=runs.filter(r=>r[0]>lo&&r.at(-1)<hi),picked=last?choices.at(-1):choices[0];
  if(picked)openingPoints.push([(picked[0]+picked.at(-1))/2,y]);
}
const normalized=openingPoints.map(([x,y])=>[(x-circles.hub.center[0])/100,(circles.hub.center[1]-y)/100]);
const openingCost=p=>{
  const [angle,x1,y1,x2,root,phase]=p;
  if(angle<.3||angle>.46||x1<.08||x1>.32||y1<.3||y1>.65||x2<.03||x2>.2||root<.27||root>.31||Math.abs(phase)>.035)return Infinity;
  const radius=circles.wheelInner.radius/100,a=[radius*Math.sin(angle),radius*Math.cos(angle)],curve=[];
  for(const sign of [-1,1])for(let i=0;i<=80;i++) {
    const t=i/80,s=1-t,x=sign*(a[0]*s*s*s+3*x1*s*s*t+3*x2*s*t*t),y=a[1]*s*s*s+3*y1*s*s*t+3*root*s*t*t+root*t*t*t;
    curve.push([x*Math.cos(phase)-y*Math.sin(phase),x*Math.sin(phase)+y*Math.cos(phase)]);
  }
  return normalized.reduce((sum,p)=>{
    let best=Infinity;
    for(let i=0;i<curve.length-1;i++) {
      if(i===80)continue;
      const a=curve[i],b=curve[i+1],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
      best=Math.min(best,(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2);
    }
    return sum+best;
  },0)/normalized.length;
};
let fit=[.385,.2,.45,.11,.29,.012],step=[.015,.01,.01,.01,.002,.002],cost=openingCost(fit);
for(let i=0;i<350;i++) {
  let improved=false;
  for(let k=0;k<fit.length;k++)for(const sign of [-1,1]) {
    const candidate=[...fit];candidate[k]+=sign*step[k];const value=openingCost(candidate);
    if(value<cost){fit=candidate;cost=value;improved=true;}
  }
  if(!improved)step=step.map(x=>x/2);
  if(Math.max(...step)<1e-7)break;
}
const result={file,sha256:hashStudyFile(file),circles,opening:{points:openingPoints,parameters:fit,rmsPixels:100*Math.sqrt(cost)},
  qualification:'Fits to raster stroke midlines, excluding incomplete radial runs and the rod-obscured wheel sector. Repeated construction and hidden depths require interpretation.'};
const prefix=process.env.PROBE_PREFIX??'/dev/shm/092-source';
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([k,v])=>[k,{center:v.center,radius:v.radius,rms:v.rmsResidual,count:v.points.length}])));
console.log({...result.opening,points:openingPoints.length});
