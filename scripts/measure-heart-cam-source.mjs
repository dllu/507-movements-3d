import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';
import {makeHeartCamGeometry} from '../src/simulation/mujoco-heart-cam/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const file='public/engravings/mm_096.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runsAt(center,angle,range,threshold=110) {
  const runs=[];let run=[];
  for(let r=range[0];r<=range[1];r+=.2){if(pixel(center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle))<threshold)run.push(r);else if(run.length){runs.push(run);run=[];}}
  if(run.length)runs.push(run);
  return runs.filter(r=>r[0]>range[0]&&r.at(-1)<range[1]-.1).map(r=>({radius:(r[0]+r.at(-1))/2,width:r.length*.2}));
}
const circles={};
for(const [name,center,range,nominal] of [['construction',[245,282],[151,164],159],['hub',[245,281],[35,45],40],['shaft',[245,282],[15,24],20],['roller',[297,288],[8,14],11],['axle',[297,288],[3,8],5]]){
  const points=[];for(let degrees=0;degrees<360;degrees+=3){const angle=degrees*Math.PI/180,runs=runsAt(center,angle,range).sort((a,b)=>Math.abs(a.radius-nominal)-Math.abs(b.radius-nominal));if(runs.length){const r=runs[0].radius;points.push([center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle)]);}}
  circles[name]=circleFit(points);
}
const axis=circles.hub.center,points=[],excluded=[];
// Manual outline landmarks identify the solid cam stroke among construction
// dashes; the radial scan records the actual ink run near that seed.
const landmarks=[[286,280],[286,252],[280,222],[267,194],[247,178],[220,171],[190,177],[160,190],[131,212],[107,240],[87,282],[106,330],[137,366],[174,387],[211,395],[248,387],[274,368],[286,339],[287,300],[286,280]];
const seedRadius=angle=>{
  const d=[Math.cos(angle),-Math.sin(angle)],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  for(let i=0;i<landmarks.length-1;i++){
    const a=landmarks[i].map((v,j)=>v-axis[j]),b=landmarks[i+1].map((v,j)=>v-axis[j]),v=b.map((x,j)=>x-a[j]);
    const den=cross(d,v);if(Math.abs(den)<1e-10)continue;
    const r=cross(a,v)/den,t=cross(a,d)/den;if(r>0&&t>=0&&t<=1)return r;
  }
  throw Error('Missing manual contour intersection');
};
for(let degrees=6;degrees<360;degrees+=2){
  const theta=degrees*Math.PI/180,angle=Math.min(theta,2*Math.PI-theta),expected=seedRadius(theta);
  if(Math.min(degrees%30,30-degrees%30)<4)continue;
  const runs=runsAt(axis,theta,[expected-6,expected+6]);
  const candidates=runs.filter(r=>r.width>=3&&r.width<=12).sort((a,b)=>Math.abs(a.radius-expected)-Math.abs(b.radius-expected));
  if(candidates.length){const r=candidates[0].radius;points.push({angle:theta,radius:r,width:candidates[0].width,point:[axis[0]+r*Math.cos(theta),axis[1]-r*Math.sin(theta)]});}else excluded.push({degrees,runs});
}
const n=points.length,mx=points.reduce((s,p)=>s+Math.min(p.angle,2*Math.PI-p.angle),0)/n,my=points.reduce((s,p)=>s+p.radius,0)/n;
const slope=points.reduce((s,p)=>{const x=Math.min(p.angle,2*Math.PI-p.angle);return s+(x-mx)*(p.radius-my);},0)/points.reduce((s,p)=>s+(Math.min(p.angle,2*Math.PI-p.angle)-mx)**2,0),intercept=my-slope*mx;
const residuals=points.map(p=>p.radius-intercept-slope*Math.min(p.angle,2*Math.PI-p.angle));
const visual=makeHeartCamGeometry(),u=visual.root.userData;
const outline=u.profile.points.map(p=>[u.source.axis[0]+100*p[0],u.source.axis[1]-100*p[1]]);
const deviations=points.map(({point})=>Math.min(...outline.map((a,i)=>{
  const b=outline[(i+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
})));
const reconstruction={outlineDistancesPixels:deviations,outlineRmsPixels:Math.sqrt(deviations.reduce((s,d)=>s+d*d,0)/n),outlineMaximumPixels:Math.max(...deviations),barAxisShiftUpPixels:circles.roller.center[1]-axis[1],barExtensionPixels:u.geometry.barEnd*100-(u.source.barEnd-u.source.roller[0]),uniformCycleFraction:1-2*u.profile.reversalAngle/Math.PI};
disposeObject3D(visual.root);
const result={file,sha256:hashStudyFile(file),circles,curve:{landmarks,points,excluded,intercept,slope,residuals,rms:Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/n)},manual:{barTop:274,barBottom:299,barEnd:474},reconstruction,qualification:'Complete radial ink runs. The cam outline uses thicker runs near manual outline landmarks and excludes radial construction lines. Circle fits regularize hand-drawn outlines; the fitted radial law is a geometric comparison, not a finite-roller motion law. Reconstruction distances compare those ink samples with the functional roller-envelope cam; they do not claim an exact engraving fit.'};
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/096-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])));console.log({curveCount:n,radialIntercept:intercept,radialSlope:slope,radialRms:result.curve.rms});
console.log({...reconstruction,outlineDistancesPixels:undefined});
