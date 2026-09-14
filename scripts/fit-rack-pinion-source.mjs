import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/113-fit',sourceFile=process.env.SOURCE_REPORT??'/dev/shm/113-source-c.json',source=JSON.parse(fs.readFileSync(sourceFile));
const sources=freezeStudySources([sourceFile,'scripts/fit-rack-pinion-source.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),candidates=[],tilt=-Math.atan(source.lines.railTop.slope);
for(const teeth of [14,15,16,17]){
 const g=roundedRackGear({teeth,module:1,depth:1,boreRadius:2,addendum:.8,dedendum:.8,tipRadius:.08,samples:128,cutterSteps:2048}),radii=g.userData.outline.slice(0,128).map(p=>p.length()),pitch=2*Math.PI/teeth;
 const radial=a=>{const t=(((a/pitch+.5)%1+1)%1)*128,i=Math.floor(t),f=t-i;return radii[i]*(1-f)+radii[(i+1)%128]*f;};let best;
 for(let i=0;i<2048;i++){
  const phase=i*pitch/2048,rs=source.gear.map(p=>radial(p.angle-tilt-phase)),module=source.gear.reduce((sum,p,j)=>sum+p.radius*rs[j],0)/rs.reduce((sum,r)=>sum+r*r,0),errors=source.gear.map((p,j)=>module*rs[j]-p.radius),score=errors.reduce((sum,r)=>sum+r*r,0)/errors.length;
  if(!best||score<best.score)best={teeth,phase,modulePixels:module,score,rms:Math.sqrt(score),maximum:Math.max(...errors.map(Math.abs)),residuals:errors};
 }candidates.push(best);g.dispose();
}
candidates.sort((a,b)=>a.score-b.score);
const centers=source.teeth.map(p=>({...p,localX:(p.center-source.axis[0])*Math.cos(tilt)+(source.axis[1]-p.y)*Math.sin(tilt)}));
// Fit the coupled pair against Euclidean distances to actual generated flanks.
// Radial errors overstate displacement near steep tooth walls.
const teeth=candidates[0].teeth,unit=roundedRackGear({teeth,module:1,depth:1,boreRadius:2,addendum:.8,dedendum:.8,tipRadius:.08,samples:128,cutterSteps:2048}),outline=unit.userData.outline,angularPitch=2*Math.PI/teeth;
function distance(point,phase,module){
 const a=point.angle-tilt-phase,x=point.radius*Math.cos(a)/module,y=point.radius*Math.sin(a)/module,base=Math.floor((((a+angularPitch/2)%(2*Math.PI)+2*Math.PI)%(2*Math.PI))/(2*Math.PI)*outline.length);let best=Infinity;
 for(let j=base-40;j<=base+40;j++){
  const p=outline[(j+outline.length)%outline.length],q=outline[(j+1+outline.length)%outline.length],dx=q.x-p.x,dy=q.y-p.y,t=Math.max(0,Math.min(1,((x-p.x)*dx+(y-p.y)*dy)/(dx*dx+dy*dy)));
  best=Math.min(best,(x-p.x-t*dx)**2+(y-p.y-t*dy)**2);
 }return Math.sqrt(best)*module;
}
let chosen;
for(let m=6.4;m<=7.4;m+=.01)for(let i=0;i<256;i++){
 const phase=i*angularPitch/256,pitch=m*Math.PI,radius=m*teeth/2,mean=centers.reduce((s,p)=>s+(p.localX-p.index*pitch)/centers.length,0),base=radius*(Math.PI/2-phase)-pitch/2,origin=base+Math.round((mean-base)/pitch)*pitch;
 const gearErrors=source.gear.map(p=>distance(p,phase,m)),rackErrors=centers.map(p=>origin+p.index*pitch-p.localX),score=gearErrors.reduce((s,e)=>s+e*e,0)/gearErrors.length+rackErrors.reduce((s,e)=>s+e*e,0)/rackErrors.length;
 if(!chosen||score<chosen.score)chosen={teeth,phase,modulePixels:m,score,gearErrors,rackErrors,gearRms:Math.sqrt(gearErrors.reduce((s,e)=>s+e*e,0)/gearErrors.length),rackRms:Math.sqrt(rackErrors.reduce((s,e)=>s+e*e,0)/rackErrors.length)};
}
unit.dispose();const pitch=chosen.modulePixels*Math.PI,radius=chosen.modulePixels*chosen.teeth/2;
const unconstrainedOrigin=centers.reduce((sum,p)=>sum+(p.localX-p.index*pitch)/centers.length,0),base=radius*(Math.PI/2-chosen.phase)-pitch/2,origin=base+Math.round((unconstrainedOrigin-base)/pitch)*pitch;
const report={sources,source,tilt,candidates,chosen,rack:{pitch,unconstrainedOrigin,origin,phaseCorrectionPixels:origin-unconstrainedOrigin,residuals:centers.map(p=>origin+p.index*pitch-p.localX)},assumptions:'Shallow involute teeth use addendum and dedendum 0.8 module with 0.08-module cutter corner radii at 20 degrees. Fifteen teeth best fit the visible gear contour among 14–17. Rack tooth origin is corrected to mesh at the fitted pinion phase; geometry must subsequently be compared using actual surfaces, not radial residuals alone.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({candidates:candidates.map(({teeth,phase,modulePixels,rms,maximum})=>({teeth,phase,modulePixels,rms,maximum})),chosen:{...chosen,gearErrors:undefined,rackErrors:undefined},rack:{...report.rack,residuals:undefined}});
