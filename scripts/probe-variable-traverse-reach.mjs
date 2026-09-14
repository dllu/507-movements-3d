import fs from 'node:fs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/122-reach',input=process.env.SOURCE_REPORT??'/dev/shm/122-source-a.json',centersFile=process.env.CENTER_REPORT??'/dev/shm/122-center-fit-a.json',s=JSON.parse(fs.readFileSync(input)),fit=JSON.parse(fs.readFileSync(centersFile));
const sources=freezeStudySources([input,centersFile,'scripts/probe-variable-traverse-reach.mjs','scripts/lib/study-report-io.mjs'],prefix);
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),norm=a=>Math.hypot(...a),rot=(p,a)=>[Math.cos(a)*p[0]-Math.sin(a)*p[1],Math.sin(a)*p[0]+Math.cos(a)*p[1]],cross=p=>[-p[1],p[0]],scale=(p,s)=>p.map(v=>v*s),point=p=>[p[0]/100,-p[1]/100];
const sourceDirection=scale([136,29],1/Math.hypot(136,29)),C=point(s.circles.centerPin.center),centers=Object.fromEntries(Object.entries(fit.result).map(([n,r])=>[n,point(r.candidates[0].center)]));
const arms=['upper','lower'].map(n=>sub(point(s.circles[n+'Crank'].center),centers[n])),ends=['topPin','bottomPin'].map(n=>sub(point(s.circles[n].center),C));
const configurations=JSON.parse(process.env.REACH_OPTIONS??'[1,0.95,0.9,0.85,0.8,0.75,0.7,0.65,0.6,0.5]').map(v=>typeof v==='number'?{crankScale:v,guideDegrees:0}:{crankScale:1,guideDegrees:0,...v}),rows=[];
for(const options of configurations){
 const E=rot(sourceDirection,options.guideDegrees*Math.PI/180),A=arms.map(a=>scale(a,options.crankScale)),L=A.map((a,i)=>norm(sub(add(C,ends[i]),add(centers[i?'lower':'upper'],a)))),path=[];let state=[0,0],failure,minimumDeterminant=Infinity;
 const evaluate=(theta,state)=>{
  const pins=A.map((a,i)=>add(centers[i?'lower':'upper'],rot(a,i?theta:-23/29*theta))),vectors=ends.map((e,i)=>sub(add(add(C,scale(E,state[0])),rot(e,state[1])),pins[i])),residual=vectors.map((v,i)=>norm(v)-L[i]),jac=vectors.map((v,i)=>{const n=scale(v,1/norm(v));return[dot(n,E),dot(n,cross(rot(ends[i],state[1])))];}),det=jac[0][0]*jac[1][1]-jac[0][1]*jac[1][0];return{residual,jac,det,pins};
 };
 for(let i=0;i<=29*180;i++){
  const theta=i*2*Math.PI/180;let result,converged=false;
  for(let k=0;k<60;k++){
   result=evaluate(theta,state);if(Math.max(...result.residual.map(Math.abs))<1e-9){converged=true;break;}if(Math.abs(result.det)<1e-12)break;
   const[r1,r2]=result.residual,[[a,b],[c,d]]=result.jac,ds=(d*r1-b*r2)/result.det,da=(-c*r1+a*r2)/result.det,factor=Math.max(1,Math.abs(ds)/.2,Math.abs(da)/.2);state=[state[0]-ds/factor,state[1]-da/factor];
  }
  if(!converged){
   // Independently sweep the floating-link angle. Each top-rod circle has
   // two possible intersections with the output slide; test both against
   // the lower rod, without selecting the Newton continuation branch.
   let minimum=Infinity,maximum=-Infinity,best;
   for(let j=0;j<14400;j++){
    const angle=-Math.PI+2*Math.PI*j/14400,U=sub(add(C,rot(ends[0],angle)),result.pins[0]),projection=dot(E,U),radicand=L[0]**2-norm(U)**2+projection**2;if(radicand<0)continue;
    for(const sign of [-1,1]){const slide=-projection+sign*Math.sqrt(radicand),r=evaluate(theta,[slide,angle]).residual[1];minimum=Math.min(minimum,r);maximum=Math.max(maximum,r);if(!best||Math.abs(r)<Math.abs(best.residual))best={slide,angle,residual:r};}
   }
   failure={theta,inputTurns:theta/(2*Math.PI),state,residual:result.residual,globalSweep:{samples:14400,minimum,maximum,best}};break;
  }
  minimumDeterminant=Math.min(minimumDeterminant,Math.abs(result.det));if(i%6===0)path.push({theta,slide:state[0],angle:state[1],determinant:result.det});
 }
 rows.push({options,rodLengths:L,crankRadii:A.map(norm),maximumBarEndCorrectionPixels:2*norm(sub(point([508,169]),C))*100*Math.sin(Math.abs(options.guideDegrees)*Math.PI/360),maximumSourcePinCorrectionPixels:100*Math.max(...arms.map(norm))*(1-options.crankScale),minimumDeterminant,complete:!failure,failure,path});
 console.log({...rows.at(-1),path:path.length});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,rows,qualification:'Independent planar loop-closure continuation through all 29 lower-gear turns. Failed continuation also receives a full-angle two-branch circle/line sweep. Sampling does not prove continuous reach or select a mechanically acceptable source correction; native contact and visible geometry remain separate.'},null,2)+'\n',{flag:'wx'});
