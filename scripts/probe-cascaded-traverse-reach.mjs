import fs from 'node:fs';
import assert from 'node:assert/strict';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/125-reach',input=process.env.SOURCE_REPORT??'/dev/shm/125-source-b.json',fitFile=process.env.GEAR_REPORT??'/dev/shm/125-gear-fit.json';
const source=JSON.parse(fs.readFileSync(input)),fit=JSON.parse(fs.readFileSync(fitFile));
const sources=freezeStudySources([input,fitFile,'scripts/probe-cascaded-traverse-reach.mjs','scripts/lib/study-report-io.mjs'],prefix);
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),norm=a=>Math.hypot(...a),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=a=>[-a[1],a[0]],rot=(p,a)=>[Math.cos(a)*p[0]-Math.sin(a)*p[1],Math.sin(a)*p[0]+Math.cos(a)*p[1]],point=p=>[p[0]/100,-p[1]/100];
const selected=fit.selected??fit.candidates[0],teeth=selected.teeth,centers=Object.fromEntries(Object.entries(selected.centers).map(([n,p])=>[n,point(p)])),C=Object.fromEntries(['lower','upper'].map(n=>[n,point(source.circles[n+'CenterPin'].center)]));
const arms=Object.fromEntries(['left','middle','right'].map(n=>[n,sub(point(source.circles[n+'Crank'].center),centers[n])])),ends=Object.fromEntries(['lower','upper'].map(n=>[n,['LeftPin','RightPin'].map(end=>sub(point(source.circles[n+end].center),C[n]))]));
const gcd=(a,b)=>b?gcd(b,a%b):a,lcm=(a,b)=>a/gcd(a,b)*b,turns=lcm(teeth.left/gcd(teeth.left,teeth.right),teeth.middle/gcd(teeth.middle,teeth.right));
const configurations=JSON.parse(process.env.REACH_OPTIONS??'[1,0.95,0.9,0.85,0.8]'),stepsPerTurn=Number(process.env.STEPS_PER_TURN??180);assert(Number.isInteger(stepsPerTurn)&&stepsPerTurn>=90);const rows=[];
function evaluate(stage,pins,L,state){
 const center=add(C[stage],[0,state[0]]),vectors=ends[stage].map((e,i)=>sub(add(center,rot(e,state[1])),pins[i])),residual=vectors.map((v,i)=>norm(v)-L[i]);
 const jac=vectors.map((v,i)=>{const n=mul(v,1/norm(v));return[n[1],dot(n,cross(rot(ends[stage][i],state[1])))];});
 return{center,residual,jac,det:jac[0][0]*jac[1][1]-jac[0][1]*jac[1][0]};
}
function solve(stage,pins,L,previous){
 let state=[...previous],result;
 for(let k=0;k<60;k++){
  result=evaluate(stage,pins,L,state);if(Math.max(...result.residual.map(Math.abs))<1e-9)return{...result,state,complete:true};if(Math.abs(result.det)<1e-12)break;
  const[r1,r2]=result.residual,[[a,b],[c,d]]=result.jac,ds=(d*r1-b*r2)/result.det,da=(-c*r1+a*r2)/result.det,f=Math.max(1,Math.abs(ds)/.2,Math.abs(da)/.2);state=[state[0]-ds/f,state[1]-da/f];
 }
 let minimum=Infinity,maximum=-Infinity,best;
 for(let i=0;i<14400;i++){
  const angle=-Math.PI+i*2*Math.PI/14400,u=sub(add(C[stage],rot(ends[stage][0],angle)),pins[0]),D=L[0]**2-u[0]**2;if(D<0)continue;
  for(const sign of [-1,1]){const slide=-u[1]+sign*Math.sqrt(D),r=evaluate(stage,pins,L,[slide,angle]).residual[1];minimum=Math.min(minimum,r);maximum=Math.max(maximum,r);if(!best||Math.abs(r)<Math.abs(best.residual))best={slide,angle,residual:r};}
 }
 return{...result,state,complete:false,globalSweep:{samples:14400,minimum,maximum,best}};
}
for(const crankScale of configurations){
 assert(Number.isFinite(crankScale)&&crankScale>0);const A=Object.fromEntries(Object.entries(arms).map(([n,a])=>[n,mul(a,crankScale)])),P=Object.fromEntries(Object.entries(A).map(([n,a])=>[n,add(centers[n],a)]));
 const L={lower:ends.lower.map((e,i)=>norm(sub(add(C.lower,e),P[i?'right':'middle']))),upper:ends.upper.map((e,i)=>norm(sub(add(C.upper,e),i?C.lower:P.left)))};
 const state={lower:[0,0],upper:[0,0]},range={lower:[0,0],upper:[0,0]},minimumDeterminant={lower:Infinity,upper:Infinity},path=[];let failure;
 for(let i=0;i<=turns*stepsPerTurn;i++){
  const theta=i*2*Math.PI/stepsPerTurn,pins=Object.fromEntries(Object.entries(A).map(([n,a])=>[n,add(centers[n],rot(a,theta*(n==='middle'?-1:1)*teeth.right/teeth[n]))]));
  const lower=solve('lower',[pins.middle,pins.right],L.lower,state.lower),upper=lower.complete?solve('upper',[pins.left,lower.center],L.upper,state.upper):null;
  if(!lower.complete||!upper.complete){failure={theta,inputTurns:theta/(2*Math.PI),stage:lower.complete?'upper':'lower',result:lower.complete?upper:lower};break;}
  for(const[stage,result]of [['lower',lower],['upper',upper]]){state[stage]=result.state;minimumDeterminant[stage]=Math.min(minimumDeterminant[stage],Math.abs(result.det));range[stage][0]=Math.min(range[stage][0],result.state[0]);range[stage][1]=Math.max(range[stage][1],result.state[0]);}
  if(i%6===0)path.push({theta,lower:lower.state,upper:upper.state});
 }
 rows.push({crankScale,teeth,turns,rodLengths:L,range,minimumDeterminant,maximumSourcePinCorrectionPixels:100*Math.max(...Object.values(arms).map(norm))*Math.abs(1-crankScale),complete:!failure,failure,path});console.log({...rows.at(-1),path:path.length});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,stepsPerTurn,rows,qualification:'Independent continuation of the two cascaded planar rod-length loops with both central pins constrained to vertical lines. The actual unequal and noncollinear pin offsets are retained. All-angle two-branch sweeps supplement failed continuation. Sampling is not a continuous proof, source correction selection or native contact validation.'},null,2)+'\n',{flag:'wx'});
