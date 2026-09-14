import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/115-source',file='public/engravings/mm_115.png',sources=freezeStudySources([file,'scripts/measure-equal-racks-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);const black=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]<110;
function strokes(point,direction,lo,hi){let first;const runs=[];for(let t=lo;t<=hi+.01;t+=.25){if(black(point[0]+t*direction[0],point[1]+t*direction[1]))first??=t;else if(first!==undefined){if(first>lo&&t-first<9)runs.push((first+t-.25)/2);first=undefined;}}return runs;}
const circles={},gear={};
for(const [name,center,ys]of [['upper',[259,227],[184,274]],['lower',[258,343],[302,385]]]){
 const points=[];for(let deg=0;deg<360;deg+=4){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=strokes(center,v,16,26).at(-1);if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}assert(points.length>40,name);circles[name]=circleFit(points);
 const axis=circles[name].center,contour=[];for(let deg=0;deg<360;deg+=2){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],rs=strokes(axis,v,38,73).filter(r=>{const y=axis[1]+r*v[1];return y>ys[0]&&y<ys[1];});if(rs.length){const r=rs.at(-1);contour.push({angle:-a,radius:r,point:axis.map((x,i)=>x+r*v[i])});}}gear[name]=contour;
}
const upper=circles.upper.center,lower=circles.lower.center,axis=upper.map((x,i)=>(x+lower[i])/2),tilt=Math.atan2(-(upper[0]-lower[0]),lower[1]-upper[1]),pitchRadius=Math.hypot(upper[0]-lower[0],upper[1]-lower[1])/2,frame={};
for(const [name,seed,axisIndex,lo,hi,span]of [['top',141,1,147,386,4],['bottom',426,1,144,383,5],['leftEnd',21,0,260,314,4],['rightEnd',505,0,254,312,4],['leftInner',63,0,266,294,5],['rightInner',473,0,266,294,5]]){
 const points=[];for(let t=lo;t<=hi;t+=2){const p=axisIndex?[t,seed]:[seed,t],v=axisIndex?[0,1]:[1,0],runs=strokes(p,v,-span,span).sort((a,b)=>Math.abs(a)-Math.abs(b));if(runs.length)points.push(p.map((x,i)=>x+runs[0]*v[i]));}assert(points.length>5,name);frame[name]={points,value:points.reduce((s,p)=>s+p[axisIndex]/points.length,0)};
}
const curves={};for(const [name,center,range,angles]of [['outerLeft',[170,284],[130,151],[118,242]],['outerRight',[369,284],[119,140],[-68,68]],['innerLeft',[171,284],[97,119],[112,248]],['innerRight',[368,284],[94,115],[-70,70]]]){
 const points=[];for(let deg=angles[0];deg<=angles[1];deg+=3){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],runs=strokes(center,v,...range);if(runs.length){const radius=name.startsWith('outer')?runs.at(-1):runs[0];points.push(center.map((x,i)=>x+radius*v[i]));}}curves[name]={center,range,angles,points};
}
const teeth=[];for(const [side,seeds,ys]of [['upper',[[143,157],[165,181],[190,203],[212,224],[237,248],[263,276],[294,309],[323,336],[349,362],[375,390]],[170,172,175]],['lower',[[139,151],[165,177],[190,203],[215,229],[245,262],[275,291],[304,322],[336,350],[364,380]],[396,398,400]]]){
 for(const [index,[left,right]]of seeds.entries())for(const y of ys){const a=strokes([left,y],[1,0],-4,4).sort((a,b)=>Math.abs(a)-Math.abs(b))[0],b=strokes([right,y],[1,0],-4,4).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(a!==undefined&&b!==undefined)teeth.push({side,index,y,left:left+a,right:right+b,center:(left+a+right+b)/2});}
}
const report={sources,file,sha256:hashStudyFile(file),axis,tilt,pitchRadius,circles,gear,frame,curves,teeth,qualification:'Fixed-threshold midlines in explicit windows. The upper rack has ten teeth and the lower nine. Pinion/rack and pinion/pinion merged ink is omitted from the contour readings. Equal gear size, phase, tooth form, stroke and hidden depth need a compatible reconstruction.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({axis,tilt,pitchRadius,circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])),gear:Object.fromEntries(Object.entries(gear).map(([n,p])=>[n,p.length])),frame:Object.fromEntries(Object.entries(frame).map(([n,v])=>[n,{value:v.value,count:v.points.length}])),curves:Object.fromEntries(Object.entries(curves).map(([n,c])=>[n,c.points.length])),teeth:teeth.length});
