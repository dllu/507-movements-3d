import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/118-source',file='public/engravings/mm_118.png';
const sources=freezeStudySources([file,'scripts/measure-stroke-doubler-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix);
const bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);
const black=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]<110;
function strokes(point,direction,lo,hi){let first;const runs=[];for(let t=lo;t<=hi+.01;t+=.25){if(black(point[0]+t*direction[0],point[1]+t*direction[1]))first??=t;else if(first!==undefined){if(first>lo&&t-first<8)runs.push((first+t-.25)/2);first=undefined;}}return runs;}
const circles={};for(const [name,range]of [['eye',[11,20]],['pin',[3,9]]]){
 const points=[];for(let deg=0;deg<360;deg+=4){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=strokes([258,249],v,...range).at(-1);if(r!==undefined)points.push([258+r*v[0],249+r*v[1]]);}circles[name]={...circleFit(points),points};
}
const axis=circles.eye.center,gear=[];
for(let deg=0;deg<360;deg+=2){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)];if(Math.abs(v[1])>.73||deg>171&&deg<200)continue;const r=strokes(axis,v,38,57).at(-1);if(r!==undefined)gear.push({angle:-a,radius:r,point:axis.map((x,i)=>x+r*v[i])});}
const seeds={upper:[[65,75],[84,94],[104,113],[124,133],[144,152],[164,170],[182,190],[202,212],[224,234],[243,253],[264,275],[286,296],[309,317],[330,338],[351,359],[374,383],[396,405],[418,427],[439,448]],lower:[[60,68],[80,88],[101,108],[120,129],[141,149],[161,169],[180,189],[200,209],[220,230],[241,251],[261,271],[281,292],[303,313],[326,334],[349,357],[371,380],[393,403],[416,426],[439,448],[461,472]]};
const teeth=[];for(const [side,pairs]of Object.entries(seeds))for(const [index,[left,right]]of pairs.entries())for(const y of side==='upper'?[200,202]:[292,294]){
 const a=strokes([left,y],[1,0],-2.5,2.5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0],b=strokes([right,y],[1,0],-2.5,2.5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(a!==undefined&&b!==undefined)teeth.push({side,index,y,left:left+a,right:right+b,center:(left+a+right+b)/2});
}
const lines={};for(const [name,a,b,span]of [['upperTop',[36,176],[495,170],3],['upperRoot',[34,197],[496,191],3],['lowerUnderside',[55,322],[484,320],3],['baseTop',[19,357],[513,356],3],['baseBottom',[19,373],[510,368],4],['rodTop',[29,264],[202,246],3],['rodBottom',[30,274],[202,258],3]]){
 const points=[];for(let x=a[0];x<=b[0];x+=2){const seed=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]),rs=strokes([x,seed],[0,1],-span,span).sort((a,b)=>Math.abs(a)-Math.abs(b));if(rs.length)points.push([x,seed+rs[0]]);}
 const mx=points.reduce((s,p)=>s+p[0]/points.length,0),my=points.reduce((s,p)=>s+p[1]/points.length,0),slope=points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/points.reduce((s,p)=>s+(p[0]-mx)**2,0),intercept=my-slope*mx,rms=Math.sqrt(points.reduce((s,p)=>s+(p[1]-intercept-slope*p[0])**2,0)/points.length);lines[name]={points,slope,intercept,rms};
}
const report={sources,file,sha256:hashStudyFile(file),axis,circles,gear,teeth,lines,qualification:'Bounded ink midpoints from the original engraving. Nineteen upper and twenty lower rack teeth; merged gear/rack ink and the pitman overlap are excluded from the gear contour. Source support and hidden guide construction require interpretation.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({axis,circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{radius:c.radius,rms:c.rmsResidual,count:c.points.length}])),gear:gear.length,teeth:teeth.length,lines:Object.fromEntries(Object.entries(lines).map(([n,l])=>[n,{slope:l.slope,intercept:l.intercept,rms:l.rms,count:l.points.length}]))});
