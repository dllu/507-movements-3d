import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/109-source',file='public/engravings/mm_109.png';
const sources=freezeStudySources([file,'scripts/measure-thread-cutting-source.mjs','scripts/lib/study-report-io.mjs'],prefix);
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runs(p,n,low=-5,high=5) {
 const values=[];let start;
 for(let r=low;r<=high+.01;r+=.2){const ink=pixel(p[0]+r*n[0],p[1]+r*n[1])<110;
  if(ink)start??=r;else if(start!==undefined){if(start>low+.01&&r-start<8)values.push((start+r-.2)/2);start=undefined;}}
 return values;
}
const stats=v=>({rms:Math.sqrt(v.reduce((s,x)=>s+x*x,0)/v.length),maximum:Math.max(...v.map(Math.abs)),count:v.length});
function fit(rows,values){const n=rows[0].length,a=Array.from({length:n},()=>Array(n+1).fill(0));
 rows.forEach((r,k)=>{for(let i=0;i<n;i++){for(let j=0;j<n;j++)a[i][j]+=r[i]*r[j];a[i][n]+=r[i]*values[k];}});
 for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[p][i]))p=j;[a[i],a[p]]=[a[p],a[i]];const d=a[i][i];assert(Math.abs(d)>1e-10);for(let k=i;k<=n;k++)a[i][k]/=d;for(let j=0;j<n;j++)if(i!==j){const q=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=q*a[i][k];}}
 const parameters=a.map(r=>r[n]),residuals=values.map((v,i)=>v-rows[i].reduce((s,x,j)=>s+x*parameters[j],0));return {parameters,residuals,...stats(residuals)};
}
const edges={};
for(const [name,seed,n,ranges] of [
 ['topLeft',[171,129],[1,0],[[118,140]]],['topRight',[354,129],[1,0],[[116,137]]],
 ['topTop',[263,115],[0,1],[[173,197],[225,299],[325,350]]],['topBottom',[263,141],[0,1],[[176,349]]],
 ['bottomLeft',[177,423],[1,0],[[417,428]]],['bottomRight',[344,422],[1,0],[[415,426]]],
 ['bottomTop',[260,412],[0,1],[[181,340]]],['bottomBottom',[260,430],[0,1],[[182,338]]],
 ['leadCrestLeft',[187,211],[1,0],[[156,244],[285,373]]],['leadCrestRight',[233,211],[1,0],[[156,244],[285,373]]],
 ['workCrestLeft',[289,211],[1,0],[[157,252]]],['workCrestRight',[333,211],[1,0],[[158,279]]],
 ['workBlankLeft',[290,330],[1,0],[[290,372]]],['workBlankRight',[334,330],[1,0],[[295,372]]],
 ['leadShaftLeft',[202,148],[1,0],[[108,114],[144,151],[432,436]]],['leadShaftRight',[219,148],[1,0],[[108,113],[144,151],[431,436]]],
 ['workShaftLeft',[303,147],[1,0],[[108,112],[143,150],[431,436]]],['workShaftRight',[320,147],[1,0],[[108,112],[143,150],[432,436]]],
 ['carriageLeft',[169,264],[1,0],[[251,275]]],['carriageRight',[246,267],[1,0],[[248,254],[269,277]]],
 ['carriageTop',[205,248],[0,1],[[175,242]]],['carriageBottom',[205,278],[0,1],[[174,239]]],
 ['armTop',[270,255],[0,1],[[249,291]]],['armBottom',[270,263],[0,1],[[249,291]]],
 ['gearLeft',[156,393],[1,0],[[382,402]]],['gearRight',[388,393],[1,0],[[382,402]]],
 ['gearTop',[270,379],[0,1],[[160,383]]],['gearBottom',[270,405],[0,1],[[160,383]]],
]) {
 const points=[];for(const [lo,hi]of ranges)for(let j=lo;j<=hi;j+=2){const p=n[0]?[seed[0],j]:[j,seed[1]],d=runs(p,n).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push(p.map((v,i)=>v+d*n[i]));}
 assert(points.length,name);const axis=n[0]?0:1,value=points.reduce((s,p)=>s+p[axis],0)/points.length;
 edges[name]={value,points,...stats(points.map(p=>p[axis]-value))};
}
// These two end faces are filled with ink, so their outer silhouettes are
// more reliable than the midpoint of a thick run or an internal tooth stripe.
for(const [name,x0,x1,y0,y1] of [['gearRight',380,397,382,402],['bottomRight',339,354,415,425]]) {
 const points=[];for(let y=y0;y<=y1;y+=2){let edge;for(let x=x0;x<=x1;x++)if(pixel(x,y)<110)edge=x+.5;assert(edge!==undefined);points.push([edge,y]);}
 const value=points.reduce((s,p)=>s+p[0],0)/points.length;
 edges[name]={value,points,method:'outer ink-to-paper edge of a filled end face',...stats(points.map(p=>p[0]-value))};
}
const threads={};
for(const [name,center,seeds,range] of [['lead',210,[161,180,197.5,216.5,235.5,257,283.5,302.5,325,348,370],[153,374]],['work',312,[161.5,179,194.5,214,234,255.5],[152,280]]]) {
 const points=[],rows=[],values=[];
 for(let turn=0;turn<seeds.length;turn++)for(const face of [0,1])for(let x=center-15;x<=center+15;x+=2){
  const seed=seeds[turn]+.47*(x-center)+face*8;
  if(seed<range[0]||seed>range[1]||name==='lead'&&seed>242&&seed<283||name==='work'&&seed>252&&x<298)continue;
  const d=runs([x,seed],[0,1],-4.5,4.5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
  if(d!==undefined){points.push({point:[x,seed+d],turn,face});rows.push([1,x-center,turn,face]);values.push(seed+d);}
 }
 threads[name]={center,points,...fit(rows,values)};
}
const values=Object.fromEntries(Object.entries(edges).map(([k,v])=>[k,v.value]));
const axes=[(values.leadCrestLeft+values.leadCrestRight)/2,(values.workBlankLeft+values.workBlankRight)/2];
const outerRadii=[axes[0]-values.gearLeft,values.gearRight-axes[1]],spacing=axes[1]-axes[0];
const manual={leadCoreEdges:[200,219],workCoreRadius:11,shaftEnds:[106,437],threadRange:[151,378],cutRange:[152,378]};
const report={sources,file,sha256:hashStudyFile(file),edges,threads,axes,outerRadii,spacing,manual,
 assumptions:'Ink-run centers on manually selected complete edges. Front-view gear radii exceed the projected shaft spacing; depth offset or a source correction is required. Counts, axial depth, hidden bearings and guide, workpiece handedness and cutting process require reconstruction.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({edges:Object.fromEntries(Object.entries(edges).map(([k,v])=>[k,{value:v.value,rms:v.rms,count:v.count}])),threads:Object.fromEntries(Object.entries(threads).map(([k,v])=>[k,{parameters:v.parameters,rms:v.rms,max:v.maximum,count:v.count}])),axes,outerRadii,spacing});
