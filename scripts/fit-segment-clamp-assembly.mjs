import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/120-assembly-fit',input=process.env.SOURCE_REPORT??'/dev/shm/120-source-a.json',s=JSON.parse(fs.readFileSync(input));
const sources=freezeStudySources([input,'scripts/fit-segment-clamp-assembly.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),a=s.circles.pivotPin.center,b=s.circles.inputShaft.center,distance=Math.hypot(b[0]-a[0],b[1]-a[1]),lineAngle=Math.atan2(a[1]-b[1],b[0]-a[0]);
const inv=r=>{const t=Math.sqrt(Math.max(0,r*r-1));return t-Math.atan(t);};
const generated=n=>{const g=roundedRackGear({teeth:n,module:1,depth:1,boreRadius:.1,addendum:.8,dedendum:1,tipRadius:.12,samples:96,cutterSteps:2048}),r=g.userData.outline.slice(0,96).map(p=>p.length());g.dispose();return r;};
const internal=n=>{const R=n/2,base=R*Math.cos(Math.PI/9),half=r=>Math.PI/(2*n)-.004/R-inv(R/base)+inv(r/base);return Array.from({length:96},(_,i)=>{const angle=Math.abs((i/96-.5)*2*Math.PI/n);let lo=R-.8,hi=R+1;for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(half(mid)<angle)lo=mid;else hi=mid;}return(lo+hi)/2;});};
const radial=(rs,n,a)=>{const t=(((a/(2*Math.PI/n)+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;};
const readings=name=>{const c=s.contours[name];return c.points.map(([x,y])=>({angle:Math.atan2(c.center[1]-y,x-c.center[0]),radius:Math.hypot(x-c.center[0],y-c.center[1])}));};
const result={};for(const [name,pinionName,counts,lo,hi,isInternal]of [['external','small',[12,13,14],44,52,false],['internal','large',[22,23,24],70,82,true]]){
 const pinionPoints=readings(pinionName),sectorPoints=readings(name),rows=[];
 for(const pinionTeeth of counts){const pinion=generated(pinionTeeth);for(let sectorTeeth=lo;sectorTeeth<=hi;sectorTeeth++){
  const sector=isInternal?internal(sectorTeeth):generated(sectorTeeth),module=2*distance/(isInternal?sectorTeeth-pinionTeeth:sectorTeeth+pinionTeeth);let best;
  for(let i=0;i<512;i++){
   const phase=i*2*Math.PI/pinionTeeth/512,sectorPhase=isInternal?((sectorTeeth-pinionTeeth)*lineAngle+pinionTeeth*phase-Math.PI)/sectorTeeth:((sectorTeeth+pinionTeeth)*lineAngle+pinionTeeth*Math.PI-pinionTeeth*phase-Math.PI)/sectorTeeth;
   const error=(points,rs,n,p)=>{const e=points.map(q=>module*radial(rs,n,q.angle-p)-q.radius);return{rms:Math.sqrt(e.reduce((s,v)=>s+v*v,0)/e.length),maximum:Math.max(...e.map(Math.abs))};};
   const p=error(pinionPoints,pinion,pinionTeeth,phase),q=error(sectorPoints,sector,sectorTeeth,sectorPhase),score=p.rms*p.rms+q.rms*q.rms;
   if(!best||score<best.score)best={pinionTeeth,sectorTeeth,modulePixels:module,phase,sectorPhase,pinion:p,sector:q,score};
  }rows.push(best);
 }}result[name]=rows.sort((a,b)=>a.score-b.score);console.log(name,result[name].slice(0,8));
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,distance,lineAngle,candidates:result,qualification:'Compatible unshifted 20-degree meshes at the independently measured shaft spacing. Each pair uses its own module. The ring has analytic internal involute flanks; pinions and external segment use rack generation. Radial scores regularize uneven engraving teeth; final actual-edge comparison and native contact remain necessary.'},null,2)+'\n',{flag:'wx'});
