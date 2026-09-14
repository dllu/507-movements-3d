import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/126-edges',input=process.env.SOURCE_REPORT??'/dev/shm/126-source-a.json',s=JSON.parse(fs.readFileSync(input)),file=s.file;
const sources=freezeStudySources([input,file,'scripts/measure-bell-crank-edges.mjs','scripts/lib/study-report-io.mjs'],prefix),pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(pixels.length,525*525);
const ink=(x,y)=>pixels[Math.round(y)*525+Math.round(x)]<110;
function runs(p,v){const result=[];let start;for(let t=-25;t<=25;t+=.25){if(ink(p[0]+t*v[0],p[1]+t*v[1]))start??=t;else if(start!==undefined){if(start>-25&&t-start<9)result.push((start+t-.25)/2);start=undefined;}}return result;}
const arms={};
for(const[name,from,to,lo,hi]of [['input','inputPin','pivotPin',.15,.84],['output','pivotPin','outputPin',.22,.80]]){
 const a=s.circles[from].center,b=s.circles[to].center,d=b.map((v,i)=>v-a[i]),L=Math.hypot(...d),normal=[-d[1]/L,d[0]/L],left=[],right=[];
 for(let t=lo;t<hi;t+=.01){const p=a.map((v,i)=>v+t*d[i]),rs=runs(p,normal);if(rs.length===2){left.push(p.map((v,i)=>v+rs[0]*normal[i]));right.push(p.map((v,i)=>v+rs[1]*normal[i]));}}
 assert(left.length>30,name);arms[name]={from,to,left,right};
}
const cords={};
for(const[name,xlo,xhi,ylo,yhi]of [['left',64,91,185,312],['right',215,246,184,324]]){
 const stations=[];for(let y=ylo;y<=yhi;y+=2){const points=[];for(let x=xlo;x<=xhi;x+=.25)if(ink(x,y))points.push(x);if(points.length&&points[0]>xlo&&points.at(-1)<xhi)stations.push({y,left:points[0],right:points.at(-1),center:(points[0]+points.at(-1))/2,width:points.at(-1)-points[0]});}
 assert(stations.length>30,name);cords[name]={stations,meanInkWidth:stations.reduce((s,r)=>s+r.width,0)/stations.length};
}
const report={sources,arms,cords,qualification:'Lever contours are paired bounded ink-band midpoints. Cord stations are outer ink envelopes including stroke and hatch thickness, not yet physical rope radii. Attachment occlusion, cut ends, pulley groove and tangent geometry need separate fitting.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const groups=[...Object.values(arms).flatMap(r=>[r.left,r.right].map(points=>({points,color:'cyan'}))),...Object.values(cords).map(c=>({points:c.stations.flatMap(r=>[[r.left,r.y],[r.right,r.y]]),color:'red'}))];const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+groups.flatMap(g=>g.points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".6" fill="${g.color}"/>`)).join('')+'</svg>';fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'.svg',prefix+'.png']);console.log({arms:Object.fromEntries(Object.entries(arms).map(([n,r])=>[n,r.left.length])),cords:Object.fromEntries(Object.entries(cords).map(([n,r])=>[n,{stations:r.stations.length,meanInkWidth:r.meanInkWidth}]))});
