import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/117-source',file='public/engravings/mm_117.png',sources=freezeStudySources([file,'scripts/measure-roller-yoke-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix),bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,263*525);
const black=(x,y)=>bytes[Math.round(y)*263+Math.round(x)]<110;
function strokes(point,direction,lo,hi){let first;const runs=[];for(let t=lo;t<=hi+.01;t+=.25){if(black(point[0]+t*direction[0],point[1]+t*direction[1]))first??=t;else if(first!==undefined){if(first>lo&&t-first<7)runs.push((first+t-.25)/2);first=undefined;}}return runs;}
const circles={};for(const [name,center,range]of [['shaft',[130,173],[22,30]],['upperRoller',[130,110],[16,23]],['lowerRoller',[129,277],[16,23]],['upperPin',[130,110],[3,8]],['lowerPin',[129,277],[3,8]]]){
 const points=[];for(let deg=0;deg<360;deg+=4){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=strokes(center,v,...range).at(-1);if(r!==undefined)points.push(center.map((x,i)=>x+r*v[i]));}circles[name]=circleFit(points);
}
const cam=[];
const interpolate=(seeds,t)=>{let i=seeds.findIndex(p=>p[0]>=t);if(i<=0)return seeds[0][1];const a=seeds[i-1],b=seeds[i];return a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]);};
for(const [side,seeds]of [['left',[[144,87],[152,80],[164,75],[180,74],[194,75],[207,77],[218,81],[230,80],[241,80],[249,87]]],['right',[[140,191],[148,197],[160,201],[173,202],[185,201],[197,199],[208,192],[218,181],[230,176]]]]){
 for(let y=seeds[0][0];y<=seeds.at(-1)[0];y+=2){const x=interpolate(seeds,y),runs=strokes([x,y],[1,0],-5,5);if(runs.length){const point=[x+(side==='left'?runs[0]:runs.at(-1)),y];if(side==='right'&&y>222&&point[0]<174)continue;cam.push({side,point,seed:[x,y]});}}
}
for(const [side,seeds]of [['top',[[107,134],[117,131],[130,129],[142,131],[152,134]]],['bottom',[[107,257],[112,257],[125,257],[138,255],[150,250]]]])for(let x=seeds[0][0];x<=seeds.at(-1)[0];x+=2){const y=interpolate(seeds,x),runs=strokes([x,y],[0,1],-3,3).sort((a,b)=>Math.abs(a)-Math.abs(b));if(runs.length)cam.push({side,point:[x,y+runs[0]],seed:[x,y]});}
const lines={};for(const [name,seed,axisIndex,lo,hi,span]of [['leftRailLeft',92,0,90,157,4],['leftRailRight',101,0,90,157,4],['rightRailLeft',161,0,90,157,4],['rightRailRight',170,0,90,157,4],['topCrossbarTop',68,1,89,175,3],['topCrossbarBottom',82,1,89,175,3],['bottomCrossbarTop',303,1,89,173,4],['bottomCrossbarBottom',317,1,89,173,4],['leftCheekLeft',87,0,167,225,4],['leftCheekRight',104,0,167,225,4],['rightCheekLeft',157,0,167,225,4],['rightCheekRight',175,0,167,225,4],['lowerGuideTop',400,1,85,171,4],['lowerGuideBottom',418,1,85,171,4]]){
 const points=[];for(let t=lo;t<=hi;t+=2){const p=axisIndex?[t,seed]:[seed,t],v=axisIndex?[0,1]:[1,0],rs=strokes(p,v,-span,span).sort((a,b)=>Math.abs(a)-Math.abs(b));if(rs.length)points.push(p.map((x,i)=>x+rs[0]*v[i]));}lines[name]={points,value:points.reduce((s,p)=>s+p[axisIndex]/points.length,0)};
}
const report={sources,file,sha256:hashStudyFile(file),circles,cam,lines,qualification:'Explicit bounded ink windows on the original engraving. Roller rims and shaft circle are independently fitted. Cam windows omit hidden contours behind the yoke rails; the measured curve must be regularized for conjugate roller contact.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])),cam:cam.length,lines:Object.fromEntries(Object.entries(lines).map(([n,l])=>[n,{value:l.value,count:l.points.length}]))});
