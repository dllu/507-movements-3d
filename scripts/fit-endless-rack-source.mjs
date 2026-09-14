import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/119-fit',input=process.env.SOURCE_REPORT??'/dev/shm/119-source-b.json',sources=freezeStudySources(['scripts/fit-endless-rack-source.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs',input],prefix),s=JSON.parse(fs.readFileSync(input));
const distance=(point,outline)=>{let best=Infinity;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,(point[0]-a[0]-t*dx)**2+(point[1]-a[1]-t*dy)**2);}return Math.sqrt(best);};
const axis=[(s.verticals.slotLeft.x+s.verticals.slotRight.x)/2,320],pinionAxis=[axis[0],s.circles.hub.center[1]],candidates=[];
for(const addendum of [.8,1])for(const dedendum of [1,1.25]){
 const geometry=roundedRackGear({teeth:8,module:1,depth:1,boreRadius:.5,addendum,dedendum,tipRadius:.12,samples:96,cutterSteps:2048}),points=geometry.userData.outline.map(p=>p.toArray());geometry.dispose();let best;
 for(let mi=0;mi<=60;mi++){const module=7+mi*.04;for(let pi=0;pi<128;pi++){const phase=(pi/128-.5)*Math.PI/4,c=Math.cos(phase),q=Math.sin(phase);const residuals=s.contours.pinion.points.map(p=>{const x=p[0]-pinionAxis[0],y=pinionAxis[1]-p[1];return module*distance([(x*c+y*q)/module,(-x*q+y*c)/module],points);});const score=residuals.reduce((a,b)=>a+b*b,0)/residuals.length;if(!best||score<best.score)best={module,phase,addendum,dedendum,score,rms:Math.sqrt(score),maximum:Math.max(...residuals),residuals};}}
 candidates.push(best);console.log({module:best.module,phase:best.phase,addendum,dedendum,rms:best.rms});
}
const report={sources,axis,pinionAxis,candidates,qualification:'Eight-tooth pinion contour fit only. The final common rack/pinion module must also preserve rack tooth spacing and cap dimensions; minimum pinion-only residual is not sufficient.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
