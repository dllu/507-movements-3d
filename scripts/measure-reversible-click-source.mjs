import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/121-source',file='public/engravings/mm_121.png',sources=freezeStudySources([file,'scripts/measure-reversible-click-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const pixels=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(pixels.length,525*525);
const ink=(x,y)=>pixels[Math.round(y)*525+Math.round(x)]<110;
function runs(p,v,lo,hi){const r=[];let start;for(let t=lo;t<=hi+.01;t+=.25){if(ink(p[0]+t*v[0],p[1]+t*v[1]))start??=t;else if(start!==undefined){if(start>lo&&t-start<10)r.push((start+t-.25)/2);start=undefined;}}return r;}
const circles={};for(const[name,center,radius,span]of [['disk',[258,275],192,9],['hub',[254,278],47,7],['hubRing',[257,277],29,5],['shaft',[257,277],20,5],['pawlPin',[231,134],11,4],['crankPin',[396,315],12,5],['rodEye',[396,315],28,5]]){
 const points=[];for(let deg=0;deg<360;deg+=3){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=runs(center,v,radius-span,radius+span).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius))[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}assert(points.length>25,name);circles[name]=circleFit(points);
}
const center=circles.shaft.center,points=[];for(let deg=-180;deg<180;deg+=.4){if((deg>-111&&deg<-57)||(deg>-19&&deg<22))continue;const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=runs(center,v,89,130)[0];if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}
const rod={left:[],right:[]};for(let y=86;y<251;y+=2){const rs=runs([0,y],[1,0],380,435);if(rs.length===2){rod.left.push([rs[0],y]);rod.right.push([rs[1],y]);}}
const report={sources,file,sha256:hashStudyFile(file),circles,gear:{center,points},rod,qualification:'Independent bounded ink midpoints; circle fits do not assume exact concentricity in the drawing. Tooth count, source phase, pawl contact and hidden guide geometry require separate reconstruction.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const groups={...circles,gear:{points},rodLeft:{points:rod.left},rodRight:{points:rod.right}},colors={gear:'red',disk:'blue',rodLeft:'green',rodRight:'green'};
const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="525" height="525"><image width="525" height="525" xlink:href="data:image/png;base64,'+fs.readFileSync(file).toString('base64')+'"/>'+Object.entries(groups).flatMap(([name,e])=>e.points.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".65" fill="'+(colors[name]??'cyan')+'"/>')).join('')+'</svg>';
fs.writeFileSync(prefix+'-points.svg',svg,{flag:'wx'});execFileSync('convert',[prefix+'-points.svg',prefix+'-points.png']);console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,n:c.points.length}])),gear:points.length,rod:rod.left.length});
