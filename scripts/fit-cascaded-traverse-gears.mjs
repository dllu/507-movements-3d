import fs from 'node:fs';
import assert from 'node:assert/strict';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/125-gear-fit',input=process.env.SOURCE_REPORT??'/dev/shm/125-source-c.json',tipFile=process.env.TIP_REPORT??'/dev/shm/125-tips-a.json';
const source=JSON.parse(fs.readFileSync(input)),tips=JSON.parse(fs.readFileSync(tipFile)),teeth=JSON.parse(process.env.TEETH??'{"left":19,"middle":23,"right":29}');
const sources=freezeStudySources([input,tipFile,'scripts/fit-cascaded-traverse-gears.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix);
const names=['left','middle','right'];assert(names.every(n=>Number.isInteger(teeth[n])&&teeth[n]>=8));
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),mean=ps=>ps.reduce((s,p)=>add(s,mul(p,1/ps.length)),[0,0]);
const hubs=names.map(n=>source.circles[n+'Hub'].center),targets=names.map(n=>tips.gears[n].center),directions=[sub(targets[1],targets[0]),sub(targets[2],targets[1])].map(v=>mul(v,1/norm(v))),angles=directions.map(v=>Math.atan2(-v[1],v[0]));
const toothCounts=names.map(n=>teeth[n]),unit=[[0,0],mul(directions[0],(teeth.left+teeth.middle)/2)];unit.push(add(unit[1],mul(directions[1],(teeth.middle+teeth.right)/2)));
const A=mean(unit),B=mean(targets),D=unit.map(u=>sub(u,A)),modulePixels=D.reduce((s,v,i)=>s+dot(v,sub(targets[i],B)),0)/D.reduce((s,v)=>s+dot(v,v),0),origin=sub(B,mul(A,modulePixels)),centers=unit.map(u=>add(origin,mul(u,modulePixels))),corrections=centers.map((c,i)=>norm(sub(c,hubs[i])));
const points=names.map((n,i)=>source.gears[n].points.map(([x,y])=>({a:Math.atan2(centers[i][1]-y,x-centers[i][0]),r:Math.hypot(x-centers[i][0],y-centers[i][1])}))),cache=new Map(),candidates=[];
function outline(n,addendum,dedendum,profileShift,pressureAngle,tipRadius){
 const key=[n,addendum,dedendum,profileShift,pressureAngle,tipRadius].join('/');if(!cache.has(key)){const g=roundedRackGear({teeth:n,module:1,depth:1,boreRadius:.1,addendum,dedendum,profileShift,pressureAngle,tipRadius,samples:96,cutterSteps:2048});cache.set(key,g.userData.outline.slice(0,96).map(p=>p.length()));g.dispose();}return cache.get(key);
}
function radial(rs,n,a){const t=(((a/(2*Math.PI/n)+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;}
for(const middleShift of [0,.25,.5,.75])for(const addendum of [.6,.8,1])for(const dedendum of [1.5,2,2.25,2.5])for(const pressureAngle of [Math.PI/9,14.5*Math.PI/180]){
 const bottomHalf=Math.PI/4-dedendum*Math.tan(pressureAngle);if(bottomHalf<=0)continue;
 const tipRadius=Math.min(.12,.9*bottomHalf/(1/Math.cos(pressureAngle)-Math.tan(pressureAngle))),shifts=[-middleShift,middleShift,-middleShift];
 const R=toothCounts.map(n=>n/2),Rb=R.map(r=>r*Math.cos(pressureAngle)),Ra=R.map((r,i)=>r+addendum+shifts[i]),contactRatios=[0,1].map(i=>(Math.sqrt(Math.max(0,Ra[i]**2-Rb[i]**2))+Math.sqrt(Math.max(0,Ra[i+1]**2-Rb[i+1]**2))-(R[i]+R[i+1])*Math.sin(pressureAngle))/(Math.PI*Math.cos(pressureAngle)));
 if(Math.min(...contactRatios)<1.2)continue;
 const rs=toothCounts.map((n,i)=>outline(n,addendum,dedendum,shifts[i],pressureAngle,tipRadius));let best;
 for(let j=0;j<256;j++){
  const phases=[j*2*Math.PI/teeth.left/256];phases.push(((teeth.left+teeth.middle)*angles[0]+teeth.middle*Math.PI-teeth.left*phases[0]-Math.PI)/teeth.middle);phases.push(((teeth.middle+teeth.right)*angles[1]+teeth.right*Math.PI-teeth.middle*phases[1]-Math.PI)/teeth.right);
  const errors=points.map((ps,i)=>{let sum=0,maximum=0;for(const p of ps){const e=modulePixels*radial(rs[i],toothCounts[i],p.a-phases[i])-p.r;sum+=e*e;maximum=Math.max(maximum,Math.abs(e));}return{rms:Math.sqrt(sum/ps.length),maximum};});const score=errors.reduce((s,e)=>s+e.rms**2,0);
  if(!best||score<best.score)best={teeth,centers:Object.fromEntries(names.map((n,i)=>[n,centers[i]])),modulePixels,phases:Object.fromEntries(names.map((n,i)=>[n,phases[i]])),shifts:Object.fromEntries(names.map((n,i)=>[n,shifts[i]])),addendum,dedendum,pressureAngle,tipRadius,contactRatios,centerCorrections:Object.fromEntries(names.map((n,i)=>[n,corrections[i]])),errors:Object.fromEntries(names.map((n,i)=>[n,errors[i]])),score};
 }candidates.push(best);
}
candidates.sort((a,b)=>a.score-b.score);verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({sources,candidates,qualification:'Default 19:23:29 counts retain the modern reference animation interpretation; the irregular engraving does not uniquely establish them. Tip-envelope circles determine target axes independently of the tooth generator. Least-squares axis adjustment gives a common module, alternating equal-and-opposite profile shifts and both conjugate mesh phases. Nominal analytical contact ratios must exceed 1.2; generated undercut and finite contact still need native validation. Radial errors are not nearest-edge distances.'},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(candidates.slice(0,3),null,2));
