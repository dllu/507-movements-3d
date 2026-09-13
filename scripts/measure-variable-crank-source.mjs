import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';

const file='public/engravings/mm_094.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runsAt(center,angle,range,threshold=110) {
  const runs=[];let run=[];
  for(let r=range[0];r<=range[1];r+=.2) {
    if(pixel(center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle))<threshold)run.push(r);
    else if(run.length){runs.push(run);run=[];}
  }
  if(run.length)runs.push(run);
  return runs.filter(r=>r[0]>range[0]&&r.at(-1)<range[1]-.1).map(r=>({radius:(r[0]+r.at(-1))/2,width:r.length*.2}));
}
const circles={};
for(const [name,center,range,nominal] of [
  ['disk',[263,281],[199,212],206],['hub',[263,281],[37,47],43],
  ['shaft',[263,281],[21,30],26],['boltHead',[171,416],[14,24],19],['boltEnd',[171,416],[5,14],10],
  ['spiralEnd',[277,207],[5,16],10],
]) {
  const points=[];
  const [first,last,step]=name==='spiralEnd'?[70,290,5]:[0,357,3];
  for(let degrees=first;degrees<=last;degrees+=step) {
    const angle=degrees*Math.PI/180,runs=runsAt(center,angle,range,name==='spiralEnd'?150:110).sort((a,b)=>Math.abs(a.radius-nominal)-Math.abs(b.radius-nominal));
    if(runs.length){const r=runs[0].radius;points.push([center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle)]);}
  }
  circles[name]=circleFit(points);
}
function solve(rows,values) {
  const n=rows[0].length,a=Array.from({length:n},(_,i)=>[...Array.from({length:n},(_,j)=>rows.reduce((s,r)=>s+r[i]*r[j],0)),rows.reduce((s,r,k)=>s+r[i]*values[k],0)]);
  for(let i=0;i<n;i++) {
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];for(let j=i;j<=n;j++)a[i][j]/=d;
    for(let j=0;j<n;j++)if(i!==j){const f=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=f*a[i][k];}
  }
  return a.map(r=>r[n]);
}
const center=circles.hub.center,points=[];
for(let degrees=0;degrees<360;degrees+=2) {
  if(Math.min(degrees%60,60-degrees%60)<12)continue;
  const theta=degrees*Math.PI/180;
  const runs=runsAt(center,theta,[56,192],140).filter(r=>r.width<=4.5);
  // Pair both visible dashed faces before fitting their centerline. Assigning
  // isolated dashes to a guessed inner/outer face biases the fitted pitch.
  for(let i=0;i<runs.length-1;i++) {
    const a=runs[i],b=runs[i+1],width=b.radius-a.radius;
    if(width<10||width>20)continue;
    const radius=(a.radius+b.radius)/2;
    for(let turn=0;turn<=2;turn++) {
      const angle=theta+2*Math.PI*turn;if(angle<1.4||angle>13.3)continue;
      if(Math.abs(radius-(183-7.8*angle))<12){points.push({angle,radius,width,faces:[a,b]});break;}
    }
  }
}
const row=p=>[1,p.angle,p.angle*p.angle,Math.cos(p.angle),Math.sin(p.angle)],coefficients=solve(points.map(row),points.map(p=>p.radius));
const residuals=points.map(p=>p.radius-row(p).reduce((sum,v,i)=>sum+v*coefficients[i],0));
const widths=points.map(p=>p.width).sort((a,b)=>a-b),spiral={coefficients,points,residuals,
  medianWidth:widths[Math.floor(widths.length/2)],rms:Math.sqrt(residuals.reduce((s,x)=>s+x*x,0)/points.length)};
const slots=[];
for(let slot=0;slot<6;slot++) {
  const nominal=slot*Math.PI/3,points=[];
  for(let r=85;r<=145;r+=3) {
    const origin=[center[0]+r*Math.cos(nominal),center[1]-r*Math.sin(nominal)];
    const runs=runsAt(origin,nominal+Math.PI/2,[-28,28]);
    const pairs=[];
    for(let i=0;i<runs.length-1;i++) {
      const a=runs[i],b=runs[i+1],width=b.radius-a.radius;
      if(width>15&&width<25&&a.width<6&&b.width<6)pairs.push({r,offset:(a.radius+b.radius)/2,width});
    }
    pairs.sort((a,b)=>Math.abs(a.width-19)-Math.abs(b.width-19));if(pairs.length)points.push(pairs[0]);
  }
  const ratios=points.map(p=>p.offset/p.r).sort((a,b)=>a-b),seed=ratios[Math.floor(ratios.length/2)];
  const accepted=points.filter(p=>Math.abs(p.offset-p.r*seed)<3),excluded=points.filter(p=>!accepted.includes(p));
  const tangent=accepted.reduce((s,p)=>s+p.r*p.offset,0)/accepted.reduce((s,p)=>s+p.r*p.r,0),angle=nominal+Math.atan(tangent);
  const rms=Math.sqrt(accepted.reduce((s,p)=>s+(p.offset-p.r*tangent)**2,0)/accepted.length);
  slots.push({angle,halfWidth:accepted.reduce((s,p)=>s+p.width,0)/accepted.length/2,points:accepted,excluded,rms});
}
const result={file,sha256:hashStudyFile(file),circles,spiral,slots,qualification:'Complete radial ink runs. Paired dashed spiral faces exclude radial-slot sectors; quadratic radial progression and a first angular harmonic regularize their midline. Radial slot axes are fitted through the common hub center. Groove endpoints and slot end centers remain manual readings.'};
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/094-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])));
console.log({spiralCoefficients:coefficients,spiralRms:spiral.rms,count:points.length});
console.log(slots.map(s=>({degrees:s.angle*180/Math.PI,halfWidth:s.halfWidth,rms:s.rms,count:s.points.length})));
