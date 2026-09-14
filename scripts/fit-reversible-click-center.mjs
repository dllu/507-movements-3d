import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/121-center-fit',input=process.env.SOURCE_REPORT??'/dev/shm/121-source-b.json',s=JSON.parse(fs.readFileSync(input)),sources=freezeStudySources([input,'scripts/fit-reversible-click-center.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),rows=[];
for(let teeth=22;teeth<=30;teeth++){
 const g=roundedRackGear({teeth,module:1,depth:1,boreRadius:.1,addendum:1,dedendum:1,tipRadius:.12,samples:96,cutterSteps:2048}),rs=g.userData.outline.slice(0,96).map(p=>p.length()),pitch=2*Math.PI/teeth;
 const radial=a=>{const t=(((a/pitch+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;};let best;
 for(let x=248;x<=258;x+=2)for(let y=274;y<=282;y+=2){const points=s.gear.points.map(([px,py])=>({a:Math.atan2(y-py,px-x),r:Math.hypot(px-x,y-py)}));
  for(let i=0;i<256;i++){const phase=i*pitch/256,unit=points.map(p=>radial(p.a-phase)),module=points.reduce((sum,p,j)=>sum+p.r*unit[j],0)/unit.reduce((sum,r)=>sum+r*r,0),score=points.reduce((sum,p,j)=>sum+(module*unit[j]-p.r)**2,0)/points.length;
   if(!best||score<best.score)best={teeth,center:[x,y],modulePixels:module,phase,score,rms:Math.sqrt(score)};
  }
 }g.dispose();rows.push(best);console.log(best);
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,candidates:rows.sort((a,b)=>a.score-b.score),qualification:'Free-center radial gear fit checks whether the drawing is concentric and regularly spaced; it does not authorize moving the common axis independently for each visible component.'},null,2)+'\n',{flag:'wx'});
