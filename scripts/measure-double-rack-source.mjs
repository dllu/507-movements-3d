import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/114-source',file='public/engravings/mm_114.png',sources=freezeStudySources([file,'scripts/measure-double-rack-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);const black=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]<110;
function strokes(point,direction,lo,hi){let first;const runs=[];for(let t=lo;t<=hi+.01;t+=.25){if(black(point[0]+t*direction[0],point[1]+t*direction[1]))first??=t;else if(first!==undefined){if(first>lo&&t-first<9)runs.push((first+t-.25)/2);first=undefined;}}return runs;}
const circles={};
for(const [name,center,radius,first,last]of [['hub',[267,291],24,0,355],['shaft',[267,291],15,0,355],['root',[267,292],40.5,150,265]]){
 const points=[];for(let deg=first;deg<=last;deg+=5){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],s=strokes(center,v,radius-4,radius+4).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius));if(s.length)points.push(center.map((x,i)=>x+s[0]*v[i]));}assert(points.length>15,name);circles[name]=circleFit(points);
}
const axis=circles.hub.center,frame={};
for(const [name,seed,axisIndex,lo,hi,span]of [['top',212,1,154,375,4],['bottom',373,1,156,373,4],['leftRodTop',282,1,18,79,4],['leftRodBottom',306,1,20,80,4],['rightRodTop',280,1,448,499,4],['rightRodBottom',305,1,448,496,4],['leftInner',116,0,283,303,4],['rightInner',414,0,284,301,4]]){
 const points=[];for(let t=lo;t<=hi;t+=2){const p=axisIndex?[t,seed]:[seed,t],v=axisIndex?[0,1]:[1,0],s=strokes(p,v,-span,span).sort((a,b)=>Math.abs(a)-Math.abs(b));if(s.length)points.push(p.map((x,i)=>x+s[0]*v[i]));}frame[name]={points,value:points.reduce((s,p)=>s+p[axisIndex]/points.length,0)};
}
const curves={};
for(const [name,center,range,angles] of [
 ['outerLeft',[174,292],[72,92],[115,245]],['outerRight',[365,292],[65,85],[-70,70]],
 ['innerLeft',[174,292],[48,64],[115,245]],['innerRight',[365,292],[40,59],[-65,65]],
]){
 const points=[];for(let deg=angles[0];deg<=angles[1];deg+=3){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],runs=strokes(center,v,...range);if(runs.length){const radius=name.startsWith('outer')?runs.at(-1):runs[0];points.push(center.map((x,i)=>x+radius*v[i]));}}
 curves[name]={center,range,angles,points};
}
const teeth=[];
for(const [side,seeds,ys]of [['upper',[[172,183],[194,204],[217,226],[240,250],[263,273],[287,298],[313,322],[337,346],[359,369]],[242,244,247]],['lower',[[166,177],[191,202],[214,224],[238,252],[265,276],[288,299],[313,322],[336,346],[360,370]],[339,343,346]]]){
 for(const [index,[left,right]]of seeds.entries())for(const y of ys){const a=strokes([left,y],[1,0],-3.5,3.5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0],b=strokes([right,y],[1,0],-3.5,3.5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(a!==undefined&&b!==undefined)teeth.push({side,index,y,left:left+a,right:right+b,center:(left+a+right+b)/2});}
}
const gear=[];for(let deg=-70;deg<=140;deg+=2){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],ss=strokes(axis,v,35,62).filter(r=>{const y=axis[1]+r*v[1];return y>252&&y<332;});if(ss.length){const radius=ss.at(-1);gear.push({angle:-a,radius,point:axis.map((x,i)=>x+radius*v[i])});}}
const report={sources,file,sha256:hashStudyFile(file),axis,circles,frame,curves,teeth,gear,qualification:'Fixed threshold midlines within explicit windows; pinion contours touching the upper or lower rack ink are excluded. Nine rack teeth per side are visible. Tooth spacing, half-sector termination, hidden depth and guides require a mechanically compatible reconstruction.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({axis,circles:Object.fromEntries(Object.entries(circles).map(([k,c])=>[k,{radius:c.radius,center:c.center,rms:c.rmsResidual,count:c.points.length}])),frame:Object.fromEntries(Object.entries(frame).map(([k,v])=>[k,{value:v.value,count:v.points.length}])),teeth:teeth.length,gear:gear.length});
