import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-source-measurements',image='artifacts/reference/brown-086-detail.png',width=1200,height=1240;
const bytes=execFileSync('convert',[image,'-colorspace','Gray','-depth','8','gray:-'],{maxBuffer:width*height+1024});assert.equal(bytes.length,width*height);
const circles={};
for(const[name,center,radius,band,minimumWidth]of [['wheelOuter',[615,613],333,20,2],['wheelInner',[615,613],249,15,2],
  ['shaft',[614,614],38,9,2],['frontBearing',[614,614],55,9,2],['catchPin',[347,598],15,7,2]]){
  const readings=[],missing=[];
  for(let degrees=0;degrees<360;degrees+=3){const a=degrees*Math.PI/180,runs=[];let run=[];
    for(let r=radius-band;r<=radius+band;r+=.25){const x=Math.round(center[0]+r*Math.cos(a)),y=Math.round(center[1]-r*Math.sin(a));
      if(bytes[y*width+x]<65)run.push(r);else if(run.length){runs.push(run);run=[];}}
    if(run.length)runs.push(run);
    const choices=runs.filter(r=>r[0]>radius-band&&r.at(-1)<radius+band&&r.at(-1)-r[0]>=minimumWidth)
      .sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-radius)-Math.abs((b[0]+b.at(-1))/2-radius));
    if(!choices.length){missing.push(degrees);continue;}
    const stroke=[choices[0][0],choices[0].at(-1)],r=(stroke[0]+stroke[1])/2;
    readings.push({degrees,stroke,point:[center[0]+r*Math.cos(a),center[1]-r*Math.sin(a)]});
  }
  let accepted=readings,fit=circleFit(accepted.map(r=>r.point));
  for(let i=0;i<3;i++){const retained=accepted.filter((r,j)=>Math.abs(fit.residuals[j])<=5);if(retained.length===accepted.length)break;accepted=retained;fit=circleFit(accepted.map(r=>r.point));}
  assert(accepted.length>=30,name);circles[name]={...fit,nominal:{center,radius,band},readings,accepted,missing,rejected:readings.filter(r=>!accepted.includes(r)),maximumAcceptedResidual:5};
}
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
for(const c of Object.values(circles)){svg+=`<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="#00ffff" stroke-width="2"/>`;
  for(const r of c.accepted)svg+=`<circle cx="${r.point[0]}" cy="${r.point[1]}" r="2" fill="#ff00ff"/>`;}
svg+='</svg>';fs.writeFileSync(prefix+'.svg',svg,{flag:'wx'});assert(!fs.existsSync(prefix+'.png'));assert(!fs.existsSync(prefix+'-marks.png'));
execFileSync('convert',['-background','none',prefix+'.svg',prefix+'-marks.png']);execFileSync('convert',[image,prefix+'-marks.png','-compose','Over','-composite',prefix+'.png']);
const sources=freezeStudySources(['scripts/measure-pump-catch-source.mjs','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs',image],prefix);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:86,productionChanged:false,mechanicsPassed:false,inspected:false,circles,sources,
  image:{file:prefix+'.png',sha256:hashStudyFile(prefix+'.png')},qualification:'Bounded dark-stroke circle fits with explicitly retained readings and rejected outliers. Obscured circles and their shared axis require visual assessment; hidden geometry is not measured.'},null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,maximum:c.maximumResidual,readings:c.accepted.length,rejected:c.rejected.length}])));
