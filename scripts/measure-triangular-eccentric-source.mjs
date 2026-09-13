import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {hashStudyFile} from './lib/study-report-io.mjs';
import {circleFit} from './lib/source-circle-fit.mjs';
import {triangularEccentricProfile} from '../src/simulation/triangular-eccentric-profile.js';

const file='public/engravings/mm_091.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
const circles={};
for(const [name,center,range,nominal] of [['collar',[286,314],[20,29],24],['shaft',[286,316],[12,20],15]]) {
  const points=[],readings=[];
  for(let degrees=0;degrees<360;degrees+=4) {
    const angle=degrees*Math.PI/180,runs=[];let run=[];
    for(let r=range[0];r<=range[1];r+=.25) {
      if(pixel(center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle))<100)run.push(r);
      else if(run.length){runs.push(run);run=[];}
    }
    if(run.length)runs.push(run);
    const choices=runs.filter(r=>r[0]>range[0]&&r.at(-1)<range[1])
      .sort((a,b)=>Math.abs((a[0]+a.at(-1))/2-nominal)-Math.abs((b[0]+b.at(-1))/2-nominal));
    if(!choices.length)continue;
    const r=(choices[0][0]+choices[0].at(-1))/2,p=[center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle)];
    points.push(p);readings.push({degrees,point:p,stroke:[choices[0][0],choices[0].at(-1)]});
  }
  circles[name]={...circleFit(points),readings};
}
const runs=(low,high,at)=>{
  const result=[];let run=[];
  for(let q=low;q<=high;q++){
    if(at(q)<100)run.push(q);else if(run.length){result.push(run);run=[];}
  }
  if(run.length)result.push(run);return result;
};
const points=[];
for(let x=218;x<=353;x+=3) {
  const expected=192+(x-286)**2/290;
  const candidates=runs(191,218,y=>pixel(x,y)).sort((a,b)=>
    Math.abs((a[0]+a.at(-1))/2-expected)-Math.abs((b[0]+b.at(-1))/2-expected));
  if(candidates.length)points.push([x,(candidates[0][0]+candidates[0].at(-1))/2]);
}
for(let y=215;y<=305;y+=3)for(const [low,high,last] of [[205,260,false],[310,365,true]]) {
  const candidates=runs(low,high,x=>pixel(x,y)),chosen=last?candidates.at(-1):candidates[0];
  if(chosen)points.push([(chosen[0]+chosen.at(-1))/2,y]);
}
// The collar is less occluded than the hatched shaft. Keep its measured axis
// fixed while fitting width, large radius and the source rotation.
const axis=circles.collar.center;
const objective=parameters=>{
  const [width,largeRadius,phase]=parameters,smallRadius=width-largeRadius;
  if(width<120||width>180||smallRadius<circles.shaft.radius+1||smallRadius>width/2||Math.abs(phase)>.1)return Infinity;
  const cam=triangularEccentricProfile({width,smallRadius});
  const residuals=points.map(p=>{
    const x=p[0]-axis[0],y=axis[1]-p[1];
    return cam.distance([x*Math.cos(phase)+y*Math.sin(phase),-x*Math.sin(phase)+y*Math.cos(phase)]);
  });
  return residuals.reduce((sum,r)=>sum+r*r,0)/residuals.length;
};
let fit=[147,124,0],steps=[4,4,.02],cost=objective(fit);
for(let iteration=0;iteration<200;iteration++) {
  let improved=false;
  for(let k=0;k<3;k++)for(const sign of [-1,1]) {
    const candidate=[...fit];candidate[k]+=sign*steps[k];const value=objective(candidate);
    if(value<cost){fit=candidate;cost=value;improved=true;}
  }
  if(!improved)steps=steps.map(x=>x/2);
  if(Math.max(...steps)<1e-6)break;
}
const cam=triangularEccentricProfile({width:fit[0],smallRadius:fit[0]-fit[1]});
const result={file,sha256:hashStudyFile(file),circles,cam:{width:fit[0],largeRadius:fit[1],smallRadius:fit[0]-fit[1],phase:fit[2],
  axis,points,rmsPixels:Math.sqrt(cost),dwellDegrees:cam.dwellHalfAngle*360/Math.PI},
  limits:'Fits to visible raster strokes. The small cam arc is hidden by the collar; constant width and concentric dwell arcs are mechanical reconstruction constraints.'};
const prefix=process.env.PROBE_PREFIX??'/dev/shm/091-source';
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({circles:Object.fromEntries(Object.entries(circles).map(([n,c])=>[n,{center:c.center,radius:c.radius,rms:c.rmsResidual,points:c.points.length}])),cam:{...result.cam,points:points.length}});
