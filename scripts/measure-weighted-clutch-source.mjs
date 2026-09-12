import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-source-measurements',image='artifacts/reference/brown-087-detail.png',width=2780,height=1320,
 bytes=execFileSync('convert',[image,'-colorspace','Gray','-depth','8','gray:-'],{maxBuffer:width*height+1024});assert.equal(bytes.length,width*height);
const specifications=[
 ['driverOuter',[711,610],410,22,[[38,142]]],['driverInner',[711,610],303,20,[[38,142]]],
 ['wheelEOuter',[2409,611],281,18,[[0,360]]],['wheelEInner',[2409,611],174,12,[[0,360]]],
 ['wheelEHub',[2409,611],82,12,[[0,360]]],['wheelEShaft',[2409,611],64,10,[[0,360]]],
 ['wheelEStud',[2206,611],43,10,[[0,360]]],['wheelEStudPin',[2206,611],22,8,[[0,360]]],
 ['weight',[1063,806],84,12,[[0,360]]],['leverPivot',[698,1210],74,10,[[0,360]]],
 ['leverRodPin',[815,1094],17,7,[[0,360]]],['bellPivot',[1937,900],57,10,[[0,360]]],
 ['bellPivotPin',[1937,900],33,8,[[0,360]]],['bellRodPin',[2075,1090],21,8,[[0,360]]],
 ];
const circles={};
for(const [name,center,radius,band,arcs]of specifications){
 const readings=[],missing=[];
 for(const [lo,hi]of arcs)for(let degrees=lo;degrees<hi;degrees+=2){
  const angle=degrees*Math.PI/180,runs=[];let run=[];
  for(let r=radius-band;r<=radius+band;r+=.25){const x=Math.round(center[0]+r*Math.cos(angle)),y=Math.round(center[1]-r*Math.sin(angle));
   if(x>=0&&x<width&&y>=0&&y<height&&bytes[y*width+x]<65)run.push(r);else if(run.length){runs.push(run);run=[];}}
  if(run.length)runs.push(run);
  const choices=runs.filter(r=>r[0]>radius-band&&r.at(-1)<radius+band&&r.at(-1)-r[0]>=1)
   .sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-radius)-Math.abs((b[0]+b.at(-1))/2-radius));
  if(!choices.length){missing.push(degrees);continue;}
  const stroke=[choices[0][0],choices[0].at(-1)],r=(stroke[0]+stroke[1])/2;
  readings.push({degrees,stroke,point:[center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle)]});
 }
 let accepted=readings,fit=circleFit(accepted.map(r=>r.point));
 for(let i=0;i<4;i++){
  const retained=accepted.filter((r,j)=>Math.abs(fit.residuals[j])<=5);if(retained.length===accepted.length)break;
  accepted=retained;assert(accepted.length>=16,name+' insufficient unoccluded readings');fit=circleFit(accepted.map(r=>r.point));
 }
 assert(accepted.length>=16,name);circles[name]={...fit,nominal:{center,radius,band,arcs},readings,accepted,missing,
  rejected:readings.filter(r=>!accepted.includes(r)),maximumAcceptedResidual:5};
}
const colors=['#00ffff','#ff00ff','#00ff00'];let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
for(const [i,[name,c]]of Object.entries(circles).entries()){
 const color=colors[i%colors.length];svg+=`<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="${color}" stroke-width="2"/>`;
 for(const r of c.accepted)svg+=`<circle cx="${r.point[0]}" cy="${r.point[1]}" r="2" fill="${color}"/>`;
 svg+=`<text x="${c.center[0]+c.radius+8}" y="${c.center[1]}" font-family="DejaVu-Sans" font-size="18" fill="${color}">${name}</text>`;
}
svg+='</svg>';fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});assert(!fs.existsSync(prefix+'.png'));
execFileSync('convert',['-background','none',prefix+'.svg',prefix+'-marks.png']);execFileSync('convert',[image,prefix+'-marks.png','-compose','Over','-composite',prefix+'.png']);
const sources=freezeStudySources(['scripts/measure-weighted-clutch-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs',image],prefix),
 report={movement:87,productionChanged:false,mechanicsPassed:false,circles,sources,image:{file:prefix+'.png',sha256:hashStudyFile(prefix+'.png'),inspected:false},
  qualification:'Dark-stroke center circle fits with retained radial readings and explicit rejected/missing samples. The input rings use their visible upper arcs; these partial arcs do not alone fix the hidden pitch geometry or tooth ratio. Joint centers and contours require visual assessment.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,max:c.maximumResidual,accepted:c.accepted.length,rejected:c.rejected.length}])));
