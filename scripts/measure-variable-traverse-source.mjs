import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/122-source';
const file='public/engravings/mm_122.png';
const sources=freezeStudySources([file,'scripts/measure-variable-traverse-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
assert.equal(pixels.length,525*525);
const ink=(x,y)=>pixels[Math.round(y)*525+Math.round(x)]<110;
function runs(p,v,lo,hi){
 const result=[];let start;
 for(let t=lo;t<=hi+.01;t+=.25){
  if(ink(p[0]+t*v[0],p[1]+t*v[1]))start??=t;
  else if(start!==undefined){if(start>lo&&t-start<10)result.push((start+t-.25)/2);start=undefined;}
 }
 return result;
}
const circles={};
for(const[name,center,radius,span]of [
 ['upperHub',[165,198],27,6],['lowerHub',[204,394],29,6],
 ['upperShaft',[164,196],19,5],['lowerShaft',[204,394],19,5],
 ['upperCrank',[151,130],8,4],['lowerCrank',[190,333],8,4],
 ['upperEye',[151,130],17,5],['lowerEye',[190,333],17,5],
 ['topPin',[355,85],7,4],['bottomPin',[370,298],8,4],
 ['topEye',[355,85],17,5],['bottomEye',[370,298],17,5],
 ['centerPin',[364,195],14,5],
]){
 const points=[];
 for(let deg=0;deg<360;deg+=3){
  const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)];
  const r=runs(center,v,radius-span,radius+span).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius))[0];
  if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));
 }
 assert(points.length>25,name);circles[name]=circleFit(points);
}
const gears={};
for(const[name,center,lo,hi,excluded]of [
 ['upper',circles.upperHub.center,83,118,[[-114,-47],[44,92]]],
 ['lower',circles.lowerHub.center,70,107,[[-135,-35]]],
]){
 const points=[];
 for(let deg=-180;deg<180;deg+=.4){
  if(excluded.some(([a,b])=>deg>a&&deg<b))continue;
  const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=runs(center,v,lo,hi)[0];
  if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));
 }
 gears[name]={center,points};
}
const rods={};
for(const[name,a,b,lo,hi]of [
 ['upper',[151,130],[355,85],.12,.88],
 ['lower',[190,333],[370,298],.13,.86],
 ['output',[364,195],[500,166],.42,.91],
]){
 const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d),normal=[-d[1]/length,d[0]/length],left=[],right=[];
 for(let t=lo;t<hi;t+=.01){
  const p=a.map((v,i)=>v+t*d[i]),rs=runs(p,normal,-15,15);
  if(rs.length===2){left.push(p.map((v,i)=>v+rs[0]*normal[i]));right.push(p.map((v,i)=>v+rs[1]*normal[i]));}
 }
 rods[name]={left,right};
}
const report={sources,file,sha256:hashStudyFile(file),circles,gears,rods,qualification:'Independent bounded ink midpoint readings. Gear counts, conjugate tooth geometry, floating-link outline, ideal guide direction and native closure require separate reconstruction.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const groups={...circles,...gears,...Object.fromEntries(Object.entries(rods).flatMap(([n,r])=>Object.entries(r).map(([side,points])=>[n+side,{points}])))};
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+Object.entries(groups).flatMap(([name,e])=>e.points.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".65" fill="'+(name==='upper'||name==='lower'?'red':name.endsWith('left')||name.endsWith('right')?'green':'cyan')+'"/>')).join('')+'</svg>';
fs.writeFileSync(prefix+'-points.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'-points.svg',prefix+'-points.png']);
console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,n:c.points.length}])),gears:Object.fromEntries(Object.entries(gears).map(([n,g])=>[n,g.points.length])),rods:Object.fromEntries(Object.entries(rods).map(([n,g])=>[n,g.left.length]))});
