import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/120-fit',input=process.env.SOURCE_REPORT??'/dev/shm/120-source-a.json',s=JSON.parse(fs.readFileSync(input));
const sources=freezeStudySources([input,'scripts/fit-segment-clamp-source.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),candidates={};
for(const [name,counts,range]of [['small',[10,11,12,13,14,15,16],[4.4,7.6]],['large',[20,21,22,23,24,25,26,27,28],[5,8]]]){
 const contour=s.contours[name],points=contour.points.map(([x,y])=>{const dx=x-contour.center[0],dy=contour.center[1]-y;return{angle:Math.atan2(dy,dx),radius:Math.hypot(dx,dy)};}),rows=[];
 for(const teeth of counts)for(const [addendum,dedendum]of [[.8,1],[1,1],[1,1.25]]){
  const g=roundedRackGear({teeth,module:1,depth:1,boreRadius:.1,addendum,dedendum,tipRadius:.12,samples:96,cutterSteps:2048}),rs=g.userData.outline.slice(0,96).map(p=>p.length()),pitch=2*Math.PI/teeth;
  const radial=a=>{const t=(((a/pitch+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;};let best;
  for(let phaseIndex=0;phaseIndex<256;phaseIndex++){
   const phase=phaseIndex*pitch/256,unit=points.map(p=>radial(p.angle-phase)),module=Math.max(range[0],Math.min(range[1],points.reduce((sum,p,i)=>sum+p.radius*unit[i],0)/unit.reduce((sum,r)=>sum+r*r,0))),errors=points.map((p,i)=>module*unit[i]-p.radius),score=errors.reduce((sum,e)=>sum+e*e,0)/errors.length;
   if(!best||score<best.score)best={teeth,modulePixels:module,phase,addendum,dedendum,rms:Math.sqrt(score),maximum:Math.max(...errors.map(Math.abs)),score};
  }rows.push(best);g.dispose();
 }
 candidates[name]=rows.sort((a,b)=>a.score-b.score);console.log(name,candidates[name].slice(0,10));
}
const report={sources,candidates,qualification:'Independent pinion-only radial fits with regular rack-generated involutes. Count and phase minima do not establish compatible sector geometry or native transmission.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
