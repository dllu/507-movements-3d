import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/110-source',file='public/engravings/mm_110.png';
const sources=freezeStudySources([file,'scripts/measure-half-nut-source.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
assert.equal(pixels.length,525*525);
const pixel=(x,y)=>pixels[Math.round(y)*525+Math.round(x)]??255;
const stats=a=>({count:a.length,rms:Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length),maximum:Math.max(...a.map(Math.abs))});
function runs(p,n,span=5) {
 const values=[];let start;
 for(let d=-span;d<=span+.01;d+=.25){if(pixel(p[0]+n[0]*d,p[1]+n[1]*d)<110)start??=d;else if(start!==undefined){if(start>-span&&d-start<8)values.push((start+d-.25)/2);start=undefined;}}
 return values;
}
const edges={};
for(const [name,seed,axis,ranges] of [
 ['leftFrameLeft',54,0,[[183,361]]],['leftFrameRight',91,0,[[180,188],[243,323],[355,365]]],
 ['leftFrameTop',175,1,[[59,85]]],['leftFrameBottom',370,1,[[58,86]]],
 ['rightFrameLeft',359,0,[[178,187],[244,320],[355,365]]],['rightFrameRight',396,0,[[181,363]]],
 ['rightFrameTop',172,1,[[364,390]]],['rightFrameBottom',370,1,[[364,390]]],
 ['leftThreadTop',195,1,[[96,124],[174,196]]],['leftThreadBottom',235,1,[[96,124],[174,196]]],
 ['rightThreadTop',194,1,[[253,285],[333,353]]],['rightThreadBottom',233,1,[[254,282],[334,354]]],
 ['leftThreadEnd',200,0,[[200,229]]],['rightThreadStart',249,0,[[200,227]]],
 ['coreTop',199,1,[[206,242]]],['coreBottom',226,1,[[206,242]]],
 ['rodTop',332,1,[[96,122],[173,283],[332,352],[404,449]]],['rodBottom',351,1,[[96,122],[175,282],[333,352],[405,449]]],
 ['leftNutLeft',129,0,[[190,238]]],['leftNutRight',165,0,[[190,238]]],
 ['leftNutTop',186,1,[[133,159]]],['leftNutBottom',244,1,[[132,138],[154,162]]],
 ['rightNutLeft',290,0,[[184,191],[238,243]]],['rightNutRight',327,0,[[185,191],[238,243]]],
 ['rightNutTop',184,1,[[297,322]]],['rightNutBottom',242,1,[[292,303],[315,326]]],
 ['leftCollarLeft',129,0,[[320,364]]],['leftCollarRight',167,0,[[320,364]]],
 ['leftCollarTop',318,1,[[133,140],[151,162]]],['leftCollarBottom',368,1,[[134,161]]],
 ['rightCollarLeft',289,0,[[321,363]]],['rightCollarRight',328,0,[[321,363]]],
 ['rightCollarTop',316,1,[[292,300],[314,324]]],['rightCollarBottom',368,1,[[294,324]]],
 ['leftArmLeft',141,0,[[253,307]]],['leftArmRight',151,0,[[253,307]]],
 ['rightArmLeft',304,0,[[251,307]]],['rightArmRight',315,0,[[251,307]]],
 ['leverCollarLeft',456,0,[[313,330],[352,362]]],['leverCollarRight',482,0,[[314,330],[352,362]]],
 ['leverCollarTop',309,1,[[457,464],[475,481]]],['leverCollarBottom',365,1,[[457,464],[475,481]]],
 ['leverLeft',466,0,[[223,303],[370,443]]],['leverRight',473,0,[[223,303],[370,443]]],
]) {
 const points=[],n=axis===0?[1,0]:[0,1];
 for(const [lo,hi]of ranges)for(let t=lo;t<=hi;t+=2){const p=axis===0?[seed,t]:[t,seed],d=runs(p,n).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push(p.map((v,i)=>v+n[i]*d));}
 assert(points.length,name);const value=points.reduce((s,p)=>s+p[axis],0)/points.length;
 edges[name]={value,points,...stats(points.map(p=>p[axis]-value))};
}
// The shaded collar ends are wider than a thin outline. Read their outer
// silhouettes away from the crossing rod instead of a single surviving run.
for(const [name,lo,hi]of [['leftCollarRight',158,173],['rightCollarRight',321,333]]) {
 const points=[];
 for(const [bottom,top]of [[320,327],[356,364]])for(let y=bottom;y<=top;y+=2){let edge;for(let x=lo;x<=hi;x++)if(pixel(x,y)<110)edge=x+.5;assert(edge!==undefined,name);points.push([edge,y]);}
 const value=points.reduce((s,p)=>s+p[0],0)/points.length;
 edges[name]={value,points,method:'outer ink edge of the shaded end face',...stats(points.map(p=>p[0]-value))};
}
function fit(points) {
 const m=Array.from({length:3},()=>Array(4).fill(0));
 for(const {x,y,turn}of points){const r=[1,turn,y-214];for(let i=0;i<3;i++){for(let j=0;j<3;j++)m[i][j]+=r[i]*r[j];m[i][3]+=r[i]*x;}}
 for(let i=0;i<3;i++){const d=m[i][i];assert(Math.abs(d)>1e-10);for(let k=i;k<4;k++)m[i][k]/=d;for(let j=0;j<3;j++)if(j!==i){const q=m[j][i];for(let k=i;k<4;k++)m[j][k]-=q*m[i][k];}}
 const parameters=m.map(r=>r[3]),residuals=points.map(p=>p.x-parameters[0]-parameters[1]*p.turn-parameters[2]*(p.y-214));
 return {parameters,residuals,...stats(residuals)};
}
const threads={};
for(const [name,base,pitch,slope,windows]of [['left',96.5,5.5,.16,[[95,125],[170,195]]],['right',254,5.25,-.10,[[252,354]]]]) {
 const points=[];
 for(let y=201;y<=227;y+=2)for(let turn=-1;turn<=21;turn++){
  const x=base+pitch*turn+slope*(y-214);if(!windows.some(([lo,hi])=>x>=lo&&x<=hi))continue;
  const d=runs([x,y],[1,0],2.5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push({x:x+d,y,turn});
 }
 threads[name]={points,...fit(points)};
}
const values=Object.fromEntries(Object.entries(edges).map(([k,v])=>[k,v.value]));
const axes={rollerY:(values.leftThreadTop+values.leftThreadBottom+values.rightThreadTop+values.rightThreadBottom)/4,rodY:(values.rodTop+values.rodBottom)/2};
const manual={knobs:[{center:[469,205],radii:[8,14]},{center:[473,459],radii:[8,14]}],rodEnds:[54,493],halfNutDepth:32,frameHalfDepth:27};
const report={sources,file,sha256:hashStudyFile(file),edges,threads,axes,manual,
 assumptions:'Ink runs are measured around manually seeded complete outlines and assigned thread turns. Near/far half-nuts follow the source masking; depth, clearance, exact thread section, travel limits and selector swing require reconstruction.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({edges:Object.fromEntries(Object.entries(edges).map(([k,v])=>[k,{value:v.value,count:v.count,rms:v.rms}])),threads:Object.fromEntries(Object.entries(threads).map(([k,v])=>[k,{parameters:v.parameters,count:v.count,rms:v.rms,maximum:v.maximum}])),axes});
