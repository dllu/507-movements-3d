import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/125-source',file='public/engravings/mm_125.png';
const sources=freezeStudySources([file,'scripts/measure-cascaded-traverse-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(pixels.length,525*525);
const ink=(x,y)=>x>=0&&x<525&&y>=0&&y<525&&pixels[Math.round(y)*525+Math.round(x)]<110;
function runs(p,v,lo,hi,maxWidth=8){
 const result=[];let start;
 for(let t=lo;t<=hi+.01;t+=.25){if(ink(p[0]+t*v[0],p[1]+t*v[1]))start??=t;else if(start!==undefined){if(start>lo&&t-start<maxWidth)result.push((start+t-.25)/2);start=undefined;}}
 return result;
}
const seeds=[
 ['leftHub',[90,382],13,4],['leftShaft',[90,381],5,3],['leftCrank',[61,372],4.5,3],['leftEye',[61,372],10,3],
 ['middleHub',[220,381],16,4],['middleShaft',[220,381],8,3],['middleCrank',[181,380.5],3.5,3],['middleEye',[180,383],10,3],
 ['rightHub',[390,381],20,4],['rightShaft',[389,381],9.5,3],['rightCrank',[350,384],5,3],['rightEye',[350,384],10,3],
 ['lowerLeftPin',[218,201],5.5,3],['lowerRightPin',[338,204],5.5,3],['lowerCenterPin',[277,198],6,3],['lowerCenterEye',[277,198],14,4],
 ['upperLeftPin',[108,96],5.5,3],['upperRightPin',[272,104],5.5,3],['upperCenterPin',[186,91],9,3],['upperCenterEye',[186,91],15,4],
];
const circles={};
for(const[name,center,radius,span]of seeds){
 const points=[];for(let deg=0;deg<360;deg+=3){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=runs(center,v,radius-span,radius+span).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius))[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}
 assert(points.length>25,name);circles[name]=circleFit(points);
}
const gears={};
for(const[name,lo,hi,excluded]of [
 ['left',40,70,[[-173,-89],[-25,25]]],
 ['middle',53,93,[[-180,-94],[-25,25],[152,180]]],
 ['right',65,108,[[-180,-110],[155,180]]],
]){
 const center=circles[name+'Hub'].center,points=[];
 for(let deg=-180;deg<180;deg+=.4){if(excluded.some(([a,b])=>deg>=a&&deg<=b))continue;const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=runs(center,v,lo,hi)[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}
 gears[name]={center,points,excluded};assert(points.length>300,name);
}
const rods={};
for(const[name,from,to,lo,hi]of [
 ['leftRod','leftCrank','upperLeftPin',.10,.91],
 ['middleRod','middleCrank','lowerLeftPin',.12,.87],
 ['rightRod','rightCrank','lowerRightPin',.12,.87],
 ['transferRod','lowerCenterPin','upperRightPin',.22,.81],
]){
 const a=circles[from].center,b=circles[to].center,d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d),normal=[-d[1]/length,d[0]/length],left=[],right=[];
 for(let t=lo;t<hi;t+=.01){const p=a.map((v,i)=>v+t*d[i]),rs=runs(p,normal,-10,10,6);if(rs.length===2&&rs[1]-rs[0]<12){left.push(p.map((v,i)=>v+rs[0]*normal[i]));right.push(p.map((v,i)=>v+rs[1]*normal[i]));}}
 rods[name]={from,to,left,right};assert(left.length>20,name);
}
const links={};
for(const[name,from,to,excluded,lo,hi]of [
 ['lowerLink','lowerLeftPin','lowerRightPin',[[.32,.62]],-24,24],
 ['upperLink','upperLeftPin','upperRightPin',[[.32,.60]],-26,26],
]){
 const a=circles[from].center,b=circles[to].center,d=b.map((v,i)=>v-a[i]),L=Math.hypot(...d),normal=[-d[1]/L,d[0]/L],left=[],right=[];
 for(let t=.10;t<.91;t+=.01){if(excluded.some(([a,b])=>t>=a&&t<=b))continue;const p=a.map((v,i)=>v+t*d[i]),rs=runs(p,normal,lo,hi,8);if(rs.length===2){left.push(p.map((v,i)=>v+rs[0]*normal[i]));right.push(p.map((v,i)=>v+rs[1]*normal[i]));}}
 links[name]={from,to,left,right,excluded};assert(left.length>20,name);
}
const report={sources,file,sha256:hashStudyFile(file),seeds,circles,gears,rods,links,qualification:'Independent bounded ink-band midpoints. Gear and link samples omit rod, mesh, stem and central-eye occlusions. Counts, conjugate tooth geometry, physical axes, depth and both inferred vertical guides require separate reconstruction. Circle fits regularize irregular engraved contours.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const groups=[...Object.values(circles).map(r=>({points:r.points,color:'cyan'})),...Object.values(gears).map(r=>({points:r.points,color:'red'})),...[...Object.values(rods),...Object.values(links)].flatMap(r=>[r.left,r.right].map(points=>({points,color:'green'})))];
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+groups.flatMap(g=>g.points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".6" fill="${g.color}"/>`)).join('')+'</svg>';
fs.writeFileSync(prefix+'-points.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'-points.svg',prefix+'-points.png']);
console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,n:c.points.length}])),gears:Object.fromEntries(Object.entries(gears).map(([n,g])=>[n,g.points.length])),rods:Object.fromEntries(Object.entries(rods).map(([n,g])=>[n,g.left.length])),links:Object.fromEntries(Object.entries(links).map(([n,g])=>[n,g.left.length]))});
