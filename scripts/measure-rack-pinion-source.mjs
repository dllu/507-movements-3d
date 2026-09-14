import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/113-source',file='public/engravings/mm_113.png';
const sources=freezeStudySources([file,'scripts/measure-rack-pinion-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);
const black=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]<110;
function strokes(point,direction,lo,hi){const runs=[];let first;for(let t=lo;t<=hi+.01;t+=.25){if(black(point[0]+t*direction[0],point[1]+t*direction[1]))first??=t;else if(first!==undefined){if(first>lo&&t-first<8)runs.push((first+t-.25)/2);first=undefined;}}return runs;}
const circles={};
for(const [name,center,radius]of [['hub',[280,425],25],['shaft',[280,425],20],['leftRoller',[60,347],24],['rightRoller',[464,343],24],['leftRim',[60,347],18.5],['rightRim',[464,343],18.5]]){
 const points=[];for(let deg=0;deg<360;deg+=5){if(name.includes('Roller')&&deg>235&&deg<305)continue;const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],choices=strokes(center,v,radius-3.5,radius+3.5).sort((a,b)=>Math.abs(a-radius)-Math.abs(b-radius));if(choices.length)points.push(center.map((x,i)=>x+choices[0]*v[i]));}
 assert(points.length>35,name);circles[name]=circleFit(points);
}
const axis=circles.hub.center,lines={};
for(const [name,seed,start,end]of [['railTop',310,28,503],['railBottom',321,30,499]]){
 const points=[];for(let x=start;x<=end;x+=2){const y=seed-.012*(x-25),s=strokes([x,y],[0,1],-4,4).sort((a,b)=>Math.abs(a)-Math.abs(b));if(s.length)points.push([x,y+s[0]]);}
 const mx=points.reduce((s,p)=>s+p[0]/points.length,0),my=points.reduce((s,p)=>s+p[1]/points.length,0),slope=points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/points.reduce((s,p)=>s+(p[0]-mx)**2,0),intercept=my-slope*mx;
 lines[name]={points,slope,intercept};
}
const teeth=[];
// Central walls merge into pinion ink at lower rows; use upper rows only.
const seeds=[[121,131],[140,151],[159,170],[179,189],[198,209],[219,229],[240,250],[262,273],[286,299],[311,322],[333,344],[355,365],[375,384],[397,405]];
for(const [index,[left,right]]of seeds.entries())for(let y=366;y<=368;y++){
 const a=strokes([left,y],[1,0],-3,3).sort((a,b)=>Math.abs(a)-Math.abs(b))[0],b=strokes([right,y],[1,0],-3,3).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
 if(a!==undefined&&b!==undefined)teeth.push({index,y,left:left+a,right:right+b,center:(left+a+right+b)/2});
}
const gear=[];
for(let deg=0;deg<360;deg+=2){if(deg>220&&deg<320)continue;const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],s=strokes(axis,v,39,65);if(s.length){const radius=s.at(-1);gear.push({angle:-a,radius,point:axis.map((x,i)=>x+radius*v[i])});}}
const report={sources,file,sha256:hashStudyFile(file),axis,circles,lines,teeth,gear,manualEdges:{railLeft:20,railRight:512,rackLeft:102,rackRight:428,rackRootLeft:365,rackRootRight:360,rackTipLeft:377,rackTipRight:373},qualification:'Fixed threshold ink midlines with explicit windows. Fourteen rack teeth are counted; visible pinion spacing is fitted separately because its upper contour joins the rack. Source rack spacing is irregular; circular involute teeth and a uniformly pitched straight rack require correction. Front-view drawing does not specify depth, pressure angle, bearings, guide constraints or drive timing.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({axis,circles:Object.fromEntries(Object.entries(circles).map(([k,v])=>[k,{center:v.center,radius:v.radius,rms:v.rmsResidual,count:v.points.length}])),lines:Object.fromEntries(Object.entries(lines).map(([k,v])=>[k,{slope:v.slope,intercept:v.intercept,count:v.points.length}])),teeth,gearSamples:gear.length});
