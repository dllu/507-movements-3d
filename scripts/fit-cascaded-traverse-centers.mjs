import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/125-center-fit',input=process.env.SOURCE_REPORT??'/dev/shm/125-source-a.json',s=JSON.parse(fs.readFileSync(input));
const sources=freezeStudySources([input,'scripts/fit-cascaded-traverse-centers.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/source-circle-fit.mjs','scripts/lib/study-report-io.mjs'],prefix),result={};
const radial=(rs,n,a)=>{const t=(((a/(2*Math.PI/n)+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;};
for(const[name,lo,hi,threshold]of [['left',18,24,54],['middle',22,28,73],['right',26,33,88]]){
 const g=s.gears[name],caps=g.points.filter(p=>Math.hypot(p[0]-g.center[0],p[1]-g.center[1])>threshold),tipCircle=circleFit(caps),rows=[];
 for(let teeth=lo;teeth<=hi;teeth++){
  const geometry=roundedRackGear({teeth,module:1,depth:1,boreRadius:.1,addendum:1,dedendum:1.5,tipRadius:.12,samples:96,cutterSteps:2048}),rs=geometry.userData.outline.slice(0,96).map(p=>p.length());geometry.dispose();let best;
  for(let dx=-14;dx<=14;dx+=2)for(let dy=-14;dy<=14;dy+=2){
   const center=[g.center[0]+dx,g.center[1]+dy],points=g.points.map(([x,y])=>({a:Math.atan2(center[1]-y,x-center[0]),r:Math.hypot(x-center[0],y-center[1])}));
   for(let i=0;i<128;i++){
    const phase=i*2*Math.PI/teeth/128,unit=points.map(p=>radial(rs,teeth,p.a-phase)),module=points.reduce((sum,p,j)=>sum+p.r*unit[j],0)/unit.reduce((sum,r)=>sum+r*r,0),score=points.reduce((sum,p,j)=>sum+(module*unit[j]-p.r)**2,0)/points.length;
    if(!best||score<best.score)best={teeth,center,modulePixels:module,phase,score,rms:Math.sqrt(score)};
   }
  }rows.push(best);
 }
 result[name]={tipCircle,candidates:rows.sort((a,b)=>a.score-b.score)};
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,result,qualification:'Free-center radial fits separate tooth-count evidence from the nonconcentric drawn hubs. Tip-envelope circles include finite tip arcs and are approximate. Final coaxial geometry and compatible profile shifts require separate fitting.'},null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(result).map(([n,r])=>[n,{tipCircle:{center:r.tipCircle.center,radius:r.tipCircle.radius,rms:r.tipCircle.rmsResidual},candidates:r.candidates}])));
