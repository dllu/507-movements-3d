import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';
import {makeGroovedHeartGeometry} from '../src/simulation/mujoco-grooved-heart/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const file='public/engravings/mm_097.png',bytes=execFileSync('convert',[file,'-colorspace','Gray','-depth','8','gray:-']);
const pixel=(x,y)=>bytes[Math.round(y)*525+Math.round(x)]??255;
function runsAt(center,angle,range,threshold=110) {
  const runs=[];let run=[];
  for(let r=range[0];r<=range[1];r+=.2){if(pixel(center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle))<threshold)run.push(r);else if(run.length){runs.push(run);run=[];}}
  if(run.length)runs.push(run);
  return runs.filter(r=>r[0]>range[0]&&r.at(-1)<range[1]-.1).map(r=>({radius:(r[0]+r.at(-1))/2,width:r.length*.2}));
}
const circles={};
for(const [name,center,range,nominal] of [['disk',[227,283],[178,191],184],['hub',[227,283],[28,36],32],['shaft',[227,283],[12,20],16],['eye',[272,287],[8,14],11],['pinHead',[272,287],[2,7],4]]){
  const points=[];for(let degrees=0;degrees<360;degrees+=3){
    if(name==='disk'&&Math.min(degrees,360-degrees)<12)continue;
    const angle=degrees*Math.PI/180,runs=runsAt(center,angle,range).sort((a,b)=>Math.abs(a.radius-nominal)-Math.abs(b.radius-nominal));
    if(runs.length){const r=runs[0].radius;points.push([center[0]+r*Math.cos(angle),center[1]-r*Math.sin(angle)]);}
  }
  circles[name]=circleFit(points);
}
const axis=circles.hub.center,points=[],excluded=[];
for(let degrees=14;degrees<=346;degrees+=2){
  if(Math.abs(degrees-180)<8)continue;
  const theta=degrees*Math.PI/180,halfAngle=Math.min(theta,2*Math.PI-theta),seed=44+132*halfAngle/Math.PI;
  const runs=runsAt(axis,theta,[36,circles.disk.radius-3]),pairs=[];
  for(let i=0;i<runs.length-1;i++){
    const a=runs[i],b=runs[i+1],width=b.radius-a.radius;
    if(width>12&&width<40&&a.width<10&&b.width<10)pairs.push({radius:(a.radius+b.radius)/2,width,faces:[a,b]});
  }
  pairs.sort((a,b)=>Math.abs(a.radius-seed)-Math.abs(b.radius-seed));
  if(pairs.length){const pair=pairs[0];points.push({angle:theta,...pair,facePoints:pair.faces.map(f=>[axis[0]+f.radius*Math.cos(theta),axis[1]-f.radius*Math.sin(theta)])});}
  else excluded.push({degrees,runs});
}
const flank=points.filter(p=>Math.min(p.angle,2*Math.PI-p.angle)>.4),mx=flank.reduce((s,p)=>s+Math.min(p.angle,2*Math.PI-p.angle),0)/flank.length,my=flank.reduce((s,p)=>s+p.radius,0)/flank.length;
const slope=flank.reduce((s,p)=>{const x=Math.min(p.angle,2*Math.PI-p.angle);return s+(x-mx)*(p.radius-my);},0)/flank.reduce((s,p)=>s+(Math.min(p.angle,2*Math.PI-p.angle)-mx)**2,0),intercept=my-slope*mx;
const normalWidths=points.map(p=>p.width/Math.hypot(1,slope/p.radius)).sort((a,b)=>a-b),normalWidth=normalWidths[Math.floor(normalWidths.length/2)];
const result={file,sha256:hashStudyFile(file),circles,groove:{points,excluded,intercept,slope,normalWidth,radialRms:Math.sqrt(flank.reduce((s,p)=>s+(p.radius-intercept-slope*Math.min(p.angle,2*Math.PI-p.angle))**2,0)/flank.length)},manual:{barTop:274,barBottom:299,barEnd:480,nose:[52,287]},qualification:'Complete radial ink runs. Both groove faces are paired before fitting a symmetric linear radial centerline, excluding the concealed inner reversal and the outer nose. Normal width compensates the fitted centerline slope. Depth, running fits and reversal blends remain reconstruction choices.'};
result.qualification='Paired ink-run midpoints independently measure both groove faces, excluding concealed reversals. The reconstructed pitch curve uses two Archimedean spiral flanks for uniform travel, with short smooth reversals. Measured stroke endpoints and groove width are retained; departures from the drawn faces are reported without fitting their irregularities into the motion law.';
const visual=makeGroovedHeartGeometry(),u=visual.root.userData;
const outlines=['inner','outer'].map(n=>u.profile[n].map(p=>[u.source.axis[0]+100*p[0],u.source.axis[1]-100*p[1]]));
const distances=points.flatMap(s=>s.facePoints.map((p,n)=>Math.min(...outlines[n].map((a,i)=>{
  const b=outlines[n][(i+1)%outlines[n].length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}))));
result.reconstruction={faceDistancesPixels:distances,faceRmsPixels:Math.sqrt(distances.reduce((s,d)=>s+d*d,0)/distances.length),faceMaximumPixels:Math.max(...distances),barAxisShiftUpPixels:circles.eye.center[1]-axis[1],diskRadiusIncreasePixels:u.geometry.diskRadius*100-circles.disk.radius,
  uniformTravelFraction:1-2*u.profile.reversalAngle/Math.PI,reversalHalfAngle:u.profile.reversalAngle,
  spiralSlopePixelsPerRadian:100*u.profile.slope,grooveWidthPixels:200*u.profile.halfWidth};
disposeObject3D(visual.root);
fs.writeFileSync((process.env.PROBE_PREFIX??'/dev/shm/097-source')+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c])=>[name,{center:c.center,radius:c.radius,rms:c.rmsResidual,count:c.points.length}])));console.log({...result.groove,points:points.length,excluded:excluded.length});
console.log({...result.reconstruction,faceDistancesPixels:undefined});
