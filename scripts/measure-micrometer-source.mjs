import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/111-source',file='public/engravings/mm_111.png';
const sources=freezeStudySources([file,'scripts/measure-micrometer-source.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(pixels.length,525*525);
const pixel=(x,y)=>pixels[Math.round(y)*525+Math.round(x)]??255;
const stats=a=>({count:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),maximum:Math.max(...a.map(Math.abs))});
const runs=(x,y,axis,span)=>{let first;const values=[];for(let d=-span;d<=span+.01;d+=.25){if(pixel(x+(axis===0?d:0),y+(axis===1?d:0))<110)first??=d;else if(first!==undefined){if(first>-span&&d-first<8)values.push((first+d-.25)/2);first=undefined;}}return values;};
const edges={};
for(const [name,seed,axis,ranges]of [
 ['outerCoreLeft',241,0,[[115,133],[183,190],[209,218]]],['outerCoreRight',285,0,[[114,121],[163,172],[191,203]]],
 ['outerTop',111,1,[[244,281]]],['outerBottom',235.5,1,[[255,280]]],
 ['innerCoreLeft',254,0,[[364,371]]],['innerCoreRight',272,0,[[366,371]]],
 ['innerBottom',376,1,[[259,267]]],
 ['outerCrestLeft',231,0,[[142,150],[167,175],[196,204],[227,233]]],['outerCrestRight',297,0,[[120,129],[148,154],[177,183],[205,213]]],
 ['innerCrestLeft',242,0,[[253,260],[275,281],[298,303],[320,325],[344,349]]],['innerCrestRight',285.5,0,[[253,259],[275,281],[297,302],[319,324],[361,367]]],
]) {
 const points=[];for(const [lo,hi]of ranges)for(let t=lo;t<=hi;t+=1){const p=axis===0?[seed,t]:[t,seed],d=runs(...p,axis,4).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push([p[0]+(axis===0?d:0),p[1]+(axis===1?d:0)]);}
 assert(points.length,name);const value=points.reduce((s,p)=>s+p[axis],0)/points.length;edges[name]={value,axis,points,...stats(points.map(p=>p[axis]-value))};
}
const threads={};
for(const [name,top,pitch,slope,width,x0,x1,count]of [['outer',128,28.6,-.34,11,236,292,4],['inner',242.5,21.7,.42,9,245,281,6]]) {
 const points=[];
 for(let turn=0;turn<count;turn++)for(let x=x0;x<=x1;x+=3)for(let side=0;side<=1;side++) {
  const y=top+pitch*turn+slope*(x-264)+side*width,d=runs(x,y,1,5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
  if(d!==undefined)points.push({x,y:y+d,turn,side});
 }
 const m=Array.from({length:4},()=>Array(5).fill(0));
 for(const p of points){const r=[1,p.turn,p.x-264,p.side];for(let i=0;i<4;i++){for(let j=0;j<4;j++)m[i][j]+=r[i]*r[j];m[i][4]+=r[i]*p.y;}}
 for(let i=0;i<4;i++){const d=m[i][i];assert(Math.abs(d)>1e-10);for(let k=i;k<5;k++)m[i][k]/=d;for(let j=0;j<4;j++)if(i!==j){const q=m[j][i];for(let k=i;k<5;k++)m[j][k]-=q*m[i][k];}}
 const parameters=m.map(r=>r[4]),residuals=points.map(p=>p.y-parameters[0]-parameters[1]*p.turn-parameters[2]*(p.x-264)-parameters[3]*p.side);
 threads[name]={parameters,points,residuals,...stats(residuals)};
}
const report={sources,file,sha256:hashStudyFile(file),edges,threads,assumptions:'Manual outline seeds and assigned thread turns. Diagonal ink strokes are schematic; the inner handedness must be corrected for a nested pitch-difference screw. Hidden lengths, wall thickness, stationary outer nut and output antirotation guide are reconstructed.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({edges:Object.fromEntries(Object.entries(edges).map(([k,v])=>[k,v.value])),threads:Object.fromEntries(Object.entries(threads).map(([k,v])=>[k,{parameters:v.parameters,count:v.count,rms:v.rms}]))});
