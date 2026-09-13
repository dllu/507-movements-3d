import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import loadMujoco from '@mujoco/mujoco';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';
import source from '../src/simulation/mujoco-slotted-bar/source.js';
import {makeMujocoSlottedBar} from '../src/simulation/mujoco-slotted-bar/visual.js';

const file='public/engravings/mm_101.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
function runs(p,n,low,high) {
  const values=[];let start;
  for(let r=low;r<=high+.01;r+=.2) {
    const ink=pixel(p[0]+r*n[0],p[1]+r*n[1])<110;
    if(ink&&start===undefined)start=r;
    if(!ink&&start!==undefined){if(start>low+.01&&r-start<7)values.push((start+r-.2)/2);start=undefined;}
  }
  return values;
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
      const r=residual(q,p),row=q.map((_,i)=>{const v=[...q];v[i]+=.00001;return(residual(v,p)-r)/.00001;});
      for(let i=0;i<n;i++){for(let j=0;j<n;j++)a[i][j]+=row[i]*row[j];a[i][n]-=row[i]*r;}
    }
    const step=solve(a);q=q.map((v,i)=>v+step[i]);
  }
  const residuals=points.map(p=>residual(q,p));
  return {parameters:q,points,residuals,rms:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/points.length),maximum:Math.max(...residuals.map(Math.abs))};
}
const circles={};
for(const [name,center,radius,range] of [['pivot',[207,162],17,5],['shaft',[207,162],9,3],['pin',[277,298],8.5,3]]) {
  const points=[];
  for(let deg=0;deg<360;deg+=3) {
    if(name==='pivot'&&deg>35&&deg<115)continue; // neck obscures the lower boss
    const n=rotate([1,0],deg*Math.PI/180),r=runs(center,n,radius-range,radius+range).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius))[0];
    if(r!==undefined)points.push(center.map((v,i)=>v+r*n[i]));
  }
  circles[name]=circleFit(points);
}
const capsules={};
for(const [name,seed] of [['slot',[276,300,1.08,52,8.5]],['body',[278,302,1.08,56,18]]]) {
  const points=[];
  function sample(local,normal) {
    const r=rotate(local,seed[2]),p=r.map((v,i)=>v+seed[i]),n=rotate(normal,seed[2]);
    if(Math.hypot(p[0]-277,p[1]-298)<13||Math.abs(p[1]-282.5)<4||Math.abs(p[1]-314)<4)return;
    const distance=runs(p,n,-6,6).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
    if(distance!==undefined)points.push(p.map((v,i)=>v+distance*n[i]));
  }
  for(let deg=0;deg<360;deg+=3) {
    const n=rotate([1,0],deg*Math.PI/180);
    if(name==='body'&&Math.abs(n[1])<.7)continue; // the stem replaces the axial parts of both caps
    sample([Math.sign(n[0])*seed[3]+seed[4]*n[0],seed[4]*n[1]],n);
  }
  for(const side of [-1,1])for(let x=-seed[3];x<=seed[3];x+=2)sample([x,side*seed[4]],[0,side]);
  capsules[name]=fit(points,seed,(q,p)=>{const [x,y]=rotate(p.map((v,i)=>v-q[i]),-q[2]);return Math.hypot(Math.max(0,Math.abs(x)-q[3]),y)-q[4];});
}
const edges={};
for(const [name,y] of [['top',282.5],['bottom',314]]) {
  const points=[];
  for(let x=18;x<504;x+=3) {
    if((x>40&&x<87)||(x>243&&x<299)||(x>360&&x<405))continue;
    const d=runs([x,y],[0,1],-5,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push([x,y+d]);
  }
  edges[name]=fit(points,[y,0],(q,p)=>p[1]-q[0]-q[1]*(p[0]-260));
}
const result={file,sha256:hashStudyFile(file),circles,...capsules,edges,
  manual:{barEnds:[13,508],guides:[[46,79,245,351],[367,401,244,352]],ceiling:[[59,138],[365,138]],
    stemSides:[[[202,182],[233,239]],[[220,178],[249,232]],[[302,370],[349,457]],[[325,363],[364,440]]]},
  qualification:'Independent ink-run midpoints. Circle masks omit the pivot neck; slot/body masks omit the wrist and horizontal bar edges. Outer-cap axial arcs are replaced by the stems. Hidden depths and the completed lower handle remain inferred.'};
assert.deepEqual(source.axis,circles.shaft.center);assert.deepEqual(source.pin,circles.pin.center);
assert.deepEqual(source.slot,capsules.slot.parameters);assert.deepEqual(source.body,capsules.body.parameters);
const segmentDistance=(p,a,b)=>{const d=b.map((v,i)=>v-a[i]),t=Math.max(0,Math.min(1,p.reduce((s,v,i)=>s+(v-a[i])*d[i],0)/d.reduce((s,v)=>s+v*v,0)));return Math.hypot(...p.map((v,i)=>v-a[i]-t*d[i]));};
const stats=values=>({rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),maximum:Math.max(...values),distances:values});
const visual=makeMujocoSlottedBar(await loadMujoco());
try {
  const u=visual.root.userData,f=u.profile,angle=visual.physics.data.qpos[0],local=p=>rotate(f.world(p),-angle);
  const slot=capsules.slot.points.map(p=>{const [x,y]=local(p);return 100*Math.abs(Math.hypot(Math.max(0,Math.abs(x-f.center[0])-f.halfLength),y-f.center[1])-f.halfWidth);});
  const outlines=u.geometry.outline.map(p=>p[0]);
  const body=capsules.body.points.map(p=>{const point=local(p);return 100*Math.min(...outlines.flatMap(r=>r.slice(0,-1).map((a,i)=>segmentDistance(point,a,r[i+1]))));});
  result.reconstruction={slotPixels:stats(slot),bodyPixels:stats(body),barTopPixels:stats(edges.top.points.map(p=>Math.abs(p[1]-source.barTop))),
    barBottomPixels:stats(edges.bottom.points.map(p=>Math.abs(p[1]-source.barBottom))),slotWideningPixels:f.slotWideningPixels,rightExtensionPixels:f.rightExtensionPixels,
    initialPinShiftPixels:f.initialPinShiftPixels,pivotRecenteringPixels:Math.hypot(...source.axis.map((v,i)=>v-source.pivotCenter[i])),amplitudeDegrees:f.amplitude*180/Math.PI};
}finally{visual.dispose();}
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/101-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])));
for(const [name,f] of Object.entries({...capsules,...edges}))console.log(name,{parameters:f.parameters,rms:f.rms,maximum:f.maximum,count:f.points.length});
console.log(Object.fromEntries(Object.entries(result.reconstruction).map(([k,v])=>[k,typeof v==='object'?{...v,distances:undefined}:v])));
