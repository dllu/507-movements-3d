import fs from 'node:fs';import crypto from 'node:crypto';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
import {makeAlternatingPegDynamics,samplePegInputClock} from './lib/alternating-peg-dynamics-study.mjs';
const clockFile='artifacts/review/077-input-clock.json',clock=JSON.parse(fs.readFileSync(clockFile)),candidate=makeAlternatingPegCandidate(),
 physics=makeAlternatingPegDynamics(candidate,{period:4,clock}),errors={phaseJoin:0,rateJoin:0,accelerationJoin:0,rateDerivative:0,accelerationDerivative:0,inputVelocity:0,inputAcceleration:0},failures=[];
const endpoint=(interval,u)=>{const c=interval.coefficients,h=interval.end-interval.start;return[c.reduce((s,v,i)=>s+v*u**i,0),c.slice(1).reduce((s,v,i)=>s+(i+1)*v*u**i,0)/h,c.slice(2).reduce((s,v,i)=>s+(i+2)*(i+1)*v*u**i,0)/h**2];};
for(let i=0;i<clock.intervals.length;i++){
 const a=endpoint(clock.intervals[i],1),b=endpoint(clock.intervals[(i+1)%clock.intervals.length],0);if(i===clock.intervals.length-1)b[0]+=1;
 ['phaseJoin','rateJoin','accelerationJoin'].forEach((k,j)=>{errors[k]=Math.max(errors[k],Math.abs(a[j]-b[j]));});
 if(clock.intervals[i].rateBernstein.some(v=>v<=0))failures.push({i,reason:'nonpositive-rate-bound'});
}
for(let i=0;i<4096;i++){
 const t=(i+.381)/4096,h=1e-7,s=samplePegInputClock(clock,t),p=samplePegInputClock(clock,t+h),m=samplePegInputClock(clock,t-h),
  input=physics.input(t*4),kp=physics.input(t*4+h),km=physics.input(t*4-h);
 errors.rateDerivative=Math.max(errors.rateDerivative,Math.abs((p.phase-m.phase)/(2*h)-s.rate));
 errors.accelerationDerivative=Math.max(errors.accelerationDerivative,Math.abs((p.rate-m.rate)/(2*h)-s.acceleration));
 errors.inputVelocity=Math.max(errors.inputVelocity,Math.abs((kp.q-km.q)/(2*h)-input.v));
 errors.inputAcceleration=Math.max(errors.inputAcceleration,Math.abs((kp.v-km.v)/(2*h)-input.acceleration));
}
const tolerances={phaseJoin:1e-12,rateJoin:1e-9,accelerationJoin:1e-6,rateDerivative:1e-7,accelerationDerivative:1e-4,inputVelocity:1e-7,inputAcceleration:1e-5};
for(const[key,error]of Object.entries(errors))if(error>tolerances[key])failures.push({key,error,tolerance:tolerances[key]});
const files=[clockFile,'scripts/check-alternating-peg-input-clock.mjs','scripts/lib/alternating-peg-dynamics-study.mjs'],
 report={movement:77,passed:failures.length===0,productionChanged:false,mechanicsPassed:false,intervals:clock.intervals.length,samples:4096,errors,tolerances,failures,
 qualification:'Checks C2 periodic joins, positive derivative Bernstein controls, numerical clock derivatives and physical-time derivatives of the prescribed lever. Does not prescribe or certify the output motion.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
const output='artifacts/review/077-input-clock-check.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,passed:report.passed,errors,failures});if(failures.length)process.exitCode=1;
