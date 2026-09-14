import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/122-fit',input=process.env.SOURCE_REPORT??'/dev/shm/122-source-a.json',s=JSON.parse(fs.readFileSync(input));
const sources=freezeStudySources([input,'scripts/fit-variable-traverse-source.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix);
const a=s.circles.upperHub.center,b=s.circles.lowerHub.center,distance=Math.hypot(b[0]-a[0],b[1]-a[1]),lineAngle=Math.atan2(a[1]-b[1],b[0]-a[0]);
const contours=Object.fromEntries(Object.entries(s.gears).map(([name,g])=>[name,g.points.map(([x,y])=>({a:Math.atan2(g.center[1]-y,x-g.center[0]),r:Math.hypot(x-g.center[0],y-g.center[1])}))]));
const generated=new Map(),radial=(rs,n,a)=>{const t=(((a/(2*Math.PI/n)+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;};
function outline(n,addendum,dedendum){const key=[n,addendum,dedendum].join('/');if(!generated.has(key)){const g=roundedRackGear({teeth:n,module:1,depth:1,boreRadius:.1,addendum,dedendum,tipRadius:.12,samples:96,cutterSteps:2048});generated.set(key,g.userData.outline.slice(0,96).map(p=>p.length()));g.dispose();}return generated.get(key);}
const independent={},compatible=[];
for(const[name,lo,hi]of [['upper',26,32],['lower',22,28]]){
 const points=contours[name],rows=[];
 for(let teeth=lo;teeth<=hi;teeth++)for(const[addendum,dedendum]of [[.8,1],[1,1],[1,1.25]]){
  const rs=outline(teeth,addendum,dedendum);let best;
  for(let i=0;i<512;i++){
   const phase=i*2*Math.PI/teeth/512,unit=points.map(p=>radial(rs,teeth,p.a-phase)),module=points.reduce((sum,p,j)=>sum+p.r*unit[j],0)/unit.reduce((sum,r)=>sum+r*r,0),errors=points.map((p,j)=>module*unit[j]-p.r),score=errors.reduce((sum,e)=>sum+e*e,0)/errors.length;
   if(!best||score<best.score)best={teeth,modulePixels:module,phase,addendum,dedendum,score,rms:Math.sqrt(score),maximum:Math.max(...errors.map(Math.abs))};
  }rows.push(best);
 }independent[name]=rows.sort((a,b)=>a.score-b.score);
}
for(let upper=26;upper<=32;upper++)for(let lower=22;lower<=28;lower++)for(const[addendum,dedendum]of [[.8,1],[1,1],[1,1.25]]){
 const U=outline(upper,addendum,dedendum),L=outline(lower,addendum,dedendum),module=2*distance/(upper+lower);let best;
 for(let i=0;i<512;i++){
  const upperPhase=i*2*Math.PI/upper/512,lowerPhase=((upper+lower)*lineAngle+lower*Math.PI-upper*upperPhase-Math.PI)/lower;
  const error=(name,rs,n,phase)=>{const es=contours[name].map(p=>module*radial(rs,n,p.a-phase)-p.r);return{rms:Math.sqrt(es.reduce((sum,e)=>sum+e*e,0)/es.length),maximum:Math.max(...es.map(Math.abs))};};
  const u=error('upper',U,upper,upperPhase),l=error('lower',L,lower,lowerPhase),score=u.rms*u.rms+l.rms*l.rms;
  if(!best||score<best.score)best={upper,lower,modulePixels:module,upperPhase,lowerPhase,addendum,dedendum,upperError:u,lowerError:l,score};
 }compatible.push(best);
}
compatible.sort((a,b)=>a.score-b.score);verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({sources,distance,lineAngle,independent,compatible,qualification:'Independent radial fits and compatible unshifted involute gear pairs at measured hub axes. Count, phase and local source irregularity require inspection; actual rendered edge comparison and native contact are separate.'},null,2)+'\n',{flag:'wx'});
console.log({distance,lineAngle,independent:Object.fromEntries(Object.entries(independent).map(([n,r])=>[n,r.slice(0,3)])),compatible:compatible.slice(0,5)});
