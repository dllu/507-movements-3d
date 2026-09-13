import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/108-source';
const file='public/engravings/mm_108.png',sources=freezeStudySources([file,'scripts/measure-reverse-thread-source.mjs','scripts/lib/study-report-io.mjs'],prefix);
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runs(p,n,low=-5,high=5) {
 const result=[];let start;
 for(let r=low;r<=high+.01;r+=.2){const ink=pixel(p[0]+r*n[0],p[1]+r*n[1])<110;
  if(ink)start??=r;else if(start!==undefined){if(start>low+.01&&r-start<8)result.push((start+r-.2)/2);start=undefined;}}
 return result;
}
const stats=vs=>({rms:Math.sqrt(vs.reduce((s,v)=>s+v*v,0)/vs.length),maximum:Math.max(...vs.map(Math.abs)),count:vs.length});
const edges={};
for(const [name,seed,n,ranges] of [
 ['barrelLeft',[232,260],[1,0],[[151,183],[201,223],[241,261],[286,303],[329,346],[371,384]]],
 ['barrelRight',[326,260],[1,0],[[157,178],[204,219],[244,260],[286,302],[329,347],[371,384]]],
 ['barrelTop',[280,143],[0,1],[[234,325]]],['barrelBottom',[280,390],[0,1],[[237,321]]],
 ['upperLeft',[119,120],[1,0],[[112,129]]],['upperRight',[317,120],[1,0],[[111,129]]],
 ['upperTop',[210,109],[0,1],[[120,312]]],['upperBottom',[210,132],[0,1],[[121,313]]],
 ['lowerLeft',[118,425],[1,0],[[416,434]]],['lowerRight',[320,425],[1,0],[[416,433]]],
 ['lowerTop',[210,413],[0,1],[[121,315]]],['lowerBottom',[210,438],[0,1],[[122,315]]],
 ['guideLeft',[129,250],[1,0],[[139,250],[290,408]]],['guideRight',[148,250],[1,0],[[139,249],[291,409]]],
 ['shaftLeft',[275,100],[1,0],[[95,104],[440,445]]],['shaftRight',[295,100],[1,0],[[95,104],[440,445]]],
 ['gearLeft',[199,397],[1,0],[[393,401]]],['gearRight',[364,397],[1,0],[[393,401]]],
 ['gearTop',[280,391],[0,1],[[202,357]]],['gearBottom',[280,403],[0,1],[[202,357]]],
 ['sliderLeft',[113,272],[1,0],[[258,285]]],['sliderTop',[134,257],[0,1],[[117,150]]],['sliderBottom',[134,288],[0,1],[[116,143]]],
]) {
 const points=[];for(const [low,high] of ranges)for(let j=low;j<=high;j+=2){const p=n[0]?[seed[0],j]:[j,seed[1]],d=runs(p,n).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(d!==undefined)points.push(p.map((v,i)=>v+d*n[i]));}
 assert(points.length,name);const axis=n[0]?0:1,value=points.reduce((s,p)=>s+p[axis],0)/points.length;
 edges[name]={value,points,...stats(points.map(p=>p[axis]-value))};
}
const groove=[];
for(const [index,centerY] of [171.5,212,253.5,296,339.5].entries())for(const hand of [-1,1])for(const x of [243,247,251,255,259,303,307,311,315,319]) {
 const seed=[x,centerY+hand*.43*(x-280)],n=[-hand*.43,1].map(v=>v/Math.hypot(.43,1)),ink=runs(seed,n,-12,12),candidates=[];
 for(let i=0;i<ink.length-1;i++){const low=ink[i],high=ink[i+1],width=high-low,offset=(low+high)/2;if(width>3&&width<19&&Math.abs(offset)<3)candidates.push({low,high,width,offset});}
 const chosen=candidates.sort((a,b)=>Math.abs(a.offset)-Math.abs(b.offset))[0];
 if(chosen)groove.push({index,hand,seed,normal:n,...chosen,point:seed.map((v,i)=>v+chosen.offset*n[i])});
}
function solve(rows,ys){const n=rows[0].length,a=Array.from({length:n},()=>Array(n+1).fill(0));
 rows.forEach((r,k)=>{for(let i=0;i<n;i++){for(let j=0;j<n;j++)a[i][j]+=r[i]*r[j];a[i][n]+=r[i]*ys[k];}});
 for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;[a[pivot],a[i]]=[a[i],a[pivot]];const d=a[i][i];assert(Math.abs(d)>1e-10);for(let j=i;j<=n;j++)a[i][j]/=d;for(let j=0;j<n;j++)if(i!==j){const q=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=q*a[i][k];}}
 return a.map(r=>r[n]);}
const axisX=(edges.barrelLeft.value+edges.barrelRight.value)/2,radius=(edges.barrelRight.value-edges.barrelLeft.value)/2;
const rows=groove.map(g=>[1,g.index+g.hand*Math.asin((g.point[0]-axisX)/radius)/(2*Math.PI)]),parameters=solve(rows,groove.map(g=>g.point[1]));
const residuals=groove.map((g,i)=>rows[i].reduce((s,x,j)=>s+x*parameters[j],0)-g.point[1]);
const widths=groove.map(g=>g.width).sort((a,b)=>a-b),fit={firstCrossing:parameters[0],pitch:parameters[1],...stats(residuals),residuals};
const result={file,sha256:hashStudyFile(file),sources,edges,groove,axisX,radius,fit,medianInkGap:widths[Math.floor(widths.length/2)],
 assumptions:'Five visible front crossings imply about five turns per traverse for a circular cylinder. The source draws steeper and straighter groove slopes than cylindrical projection permits at that pitch. End joins and the swiveling shoe are reconstructed.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({edges:Object.fromEntries(Object.entries(edges).map(([k,v])=>[k,{value:v.value,rms:v.rms,count:v.count}])),axisX,radius,fit:{...fit,residuals:undefined},groove:groove.length,medianInkGap:result.medianInkGap});
