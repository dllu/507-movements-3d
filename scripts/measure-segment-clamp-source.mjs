import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/120-source',file='public/engravings/mm_120.png';
const sources=freezeStudySources([file,'scripts/measure-segment-clamp-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);
const black=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]<110;
function strokes(p,v,lo,hi,firstOnly=false){let first;const runs=[];for(let t=lo;t<=hi+.01;t+=.25){if(black(p[0]+t*v[0],p[1]+t*v[1]))first??=t;else if(first!==undefined){if(first>lo&&t-first<10)runs.push((first+t-.25)/2);if(firstOnly)return runs;first=undefined;}}return runs;}
const circles={};for(const [name,center,radius,span]of [['pivotPin',[255,214],12,4],['pivotHub',[255,214],21,4],['pivotEye',[255,216],33,6],['inputShaft',[274,396],18,4]]){
 const points=[];for(let deg=0;deg<360;deg+=4){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=strokes(center,v,radius-span,radius+span).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius))[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}assert(points.length>30,name);circles[name]=circleFit(points);
}
const contours={};for(const [name,center,lo,hi,ranges]of [
 ['small',circles.inputShaft.center,27,48,[[-35,210]]],
 ['large',circles.inputShaft.center,67,91,[[-10,42],[135,207],[243,297]]],
 ['external',circles.pivotPin.center,133,161,[[43,121]]],
 ['internal',circles.pivotPin.center,240,274,[[60,69],[104,118]]],
 ['outerRim',circles.pivotPin.center,270,289,[[63,115]]],
 ]){
  const points=[];for(const [start,end]of ranges)for(let deg=start;deg<=end;deg+=.5){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],rs=strokes(center,v,lo,hi,name==='external'),r=['internal','external'].includes(name)?rs[0]:rs.at(-1);if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}assert(points.length>20,name);contours[name]={center,points};
 }
const report={sources,file,sha256:hashStudyFile(file),circles,contours,qualification:'Independent bounded ink midpoints. Gear contours omit explicit overlap windows; count, pitch compatibility, jaw outlines and native contact require further reconstruction.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+Object.entries({...circles,...contours}).flatMap(([name,e])=>e.points.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".7" fill="'+({small:'red',large:'orange',external:'blue',internal:'green',outerRim:'purple'}[name]??'cyan')+'"/>')).join('')+'</svg>';
fs.writeFileSync(prefix+'-points.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'-points.svg',prefix+'-points.png']);
console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,n:c.points.length}])),contours:Object.fromEntries(Object.entries(contours).map(([n,c])=>[n,c.points.length]))});
