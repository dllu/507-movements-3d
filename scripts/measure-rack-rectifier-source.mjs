import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/116-source',file='public/engravings/mm_116.png',sources=freezeStudySources([file,'scripts/measure-rack-rectifier-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix),bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);assert.equal(bytes.length,525*525);
const black=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]<110;
function strokes(point,direction,lo,hi){let first;const runs=[];for(let t=lo;t<=hi+.01;t+=.25){if(black(point[0]+t*direction[0],point[1]+t*direction[1]))first??=t;else if(first!==undefined){if(first>lo&&t-first<9)runs.push((first+t-.25)/2);first=undefined;}}return runs;}
const points=[];for(let deg=0;deg<360;deg+=4){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],r=strokes([237,288],v,15,25).at(-1);if(r!==undefined)points.push([237+r*v[0],288+r*v[1]]);}const shaft=circleFit(points),axis=shaft.center,gear=[],ratchet=[];
for(let deg=0;deg<360;deg+=2){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)];if(Math.abs(v[1])<.78){const r=strokes(axis,v,41,67).at(-1);if(r!==undefined&&axis[1]+r*v[1]>242&&axis[1]+r*v[1]<331)gear.push({angle:-a,radius:r,point:axis.map((x,i)=>x+r*v[i])});}
 const rs=strokes(axis,v,24,39);if(rs.length&&!(deg>210&&deg<275)){const r=rs.at(-1);ratchet.push({angle:-a,radius:r,point:axis.map((x,i)=>x+r*v[i])});}
}
const frame={};for(const [name,seed,axisIndex,lo,hi,span]of [['top',205,1,114,384,5],['bottom',371,1,114,386,5],['leftRodTop',274,1,11,31,4],['leftRodBottom',312,1,11,31,5],['rightRodTop',273,1,478,503,4],['rightRodBottom',307,1,478,503,4],['leftInner',57,0,277,294,5],['rightInner',456,0,277,294,5]]){
 const points=[];for(let t=lo;t<=hi;t+=2){const p=axisIndex?[t,seed]:[seed,t],v=axisIndex?[0,1]:[1,0],rs=strokes(p,v,-span,span).sort((a,b)=>Math.abs(a)-Math.abs(b));if(rs.length)points.push(p.map((x,i)=>x+rs[0]*v[i]));}assert(points.length>4,name);frame[name]={points,value:points.reduce((s,p)=>s+p[axisIndex]/points.length,0)};
}
const curves={};for(const [name,center,range,angles]of [['outerLeft',[116,288],[77,94],[110,250]],['outerRight',[390,286],[79,92],[-75,75]],['innerLeft',[115,287],[52,67],[100,260]],['innerRight',[390,286],[59,72],[-85,85]]]){
 const points=[];for(let deg=angles[0];deg<=angles[1];deg+=3){const a=deg*Math.PI/180,v=[Math.cos(a),Math.sin(a)],rs=strokes(center,v,...range);if(rs.length){const r=name.startsWith('outer')?rs.at(-1):rs[0];points.push(center.map((x,i)=>x+r*v[i]));}}curves[name]={center,range,angles,points};
}
const teeth=[];for(const [side,seeds,ys]of [['upper',[[109,119],[129,139],[150,160],[171,180],[192,204],[217,230],[244,258],[273,283],[298,309],[325,335],[348,357],[373,381]],[231,233,235]],['lower',[[120,132],[142,154],[164,175],[187,199],[212,225],[237,250],[263,276],[287,299],[308,320],[330,341],[351,363],[374,385]],[337,339,341]]]){
 for(const [index,[left,right]]of seeds.entries())for(const y of ys){const a=strokes([left,y],[1,0],-3.5,3.5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0],b=strokes([right,y],[1,0],-3.5,3.5).sort((a,b)=>Math.abs(a)-Math.abs(b))[0];if(a!==undefined&&b!==undefined)teeth.push({side,index,y,left:left+a,right:right+b,center:(left+a+right+b)/2});}
}
const report={sources,file,sha256:hashStudyFile(file),axis,shaft,gear,ratchet,frame,curves,teeth,qualification:'Bounded ink midpoints from explicit windows at threshold 110. Twelve rack teeth per side are visible. Gear contour readings omit merged rack ink near the top and bottom. The internal six-tooth ratchet and pawl need separate compatible contact reconstruction.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({axis,shaft:{radius:shaft.radius,rms:shaft.rmsResidual,count:points.length},gear:gear.length,ratchet:ratchet.length,frame:Object.fromEntries(Object.entries(frame).map(([n,p])=>[n,{value:p.value,count:p.points.length}])),curves:Object.fromEntries(Object.entries(curves).map(([n,p])=>[n,p.points.length])),teeth:teeth.length});
