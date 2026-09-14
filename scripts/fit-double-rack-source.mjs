import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/114-fit',sourceFile=process.env.SOURCE_REPORT??'/dev/shm/114-source-a.json',source=JSON.parse(fs.readFileSync(sourceFile)),sources=freezeStudySources([sourceFile,'scripts/fit-double-rack-source.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),candidates=[];
for(let teeth=12;teeth<=18;teeth++){
 const g=roundedRackGear({teeth,module:1,depth:1,boreRadius:2,addendum:1,dedendum:1.25,tipRadius:.12,samples:128,cutterSteps:2048}),radii=g.userData.outline.slice(0,128).map(p=>p.length()),pitch=2*Math.PI/teeth;
 const radial=a=>{const t=(((a/pitch+.5)%1+1)%1)*128,i=Math.floor(t),f=t-i;return radii[i]*(1-f)+radii[(i+1)%128]*f;};let best;
 for(let i=0;i<2048;i++){
  const phase=i*pitch/2048,rs=source.gear.map(p=>radial(p.angle-phase)),module=source.gear.reduce((sum,p,j)=>sum+p.radius*rs[j],0)/rs.reduce((sum,r)=>sum+r*r,0),errors=source.gear.map((p,j)=>module*rs[j]-p.radius),score=errors.reduce((sum,r)=>sum+r*r,0)/errors.length;
  if(!best||score<best.score)best={teeth,phase,modulePixels:module,score,rms:Math.sqrt(score),maximum:Math.max(...errors.map(Math.abs)),residuals:errors};
 }candidates.push(best);g.dispose();
}
candidates.sort((a,b)=>a.score-b.score);
const rows={};for(const side of ['upper','lower']){
 const points=source.teeth.filter(p=>p.side===side),mx=points.reduce((s,p)=>s+p.index/points.length,0),my=points.reduce((s,p)=>s+p.center/points.length,0),pitch=points.reduce((s,p)=>s+(p.index-mx)*(p.center-my),0)/points.reduce((s,p)=>s+(p.index-mx)**2,0),origin=my-mx*pitch;
 rows[side]={pitch,origin,rms:Math.sqrt(points.reduce((s,p)=>s+(p.center-origin-p.index*pitch)**2,0)/points.length)};
}
const report={sources,source,candidates,rows,qualification:'Radial full-gear fits are diagnostic only: the source has irregular teeth and a partial sector. Upper/lower rack pitches are measured separately. A coupled half-sector fit and contact test are still required.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({candidates:candidates.map(({teeth,phase,modulePixels,rms,maximum})=>({teeth,phase,modulePixels,rms,maximum})),rows});
