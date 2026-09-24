// Rebakes movement 76's finite-contact trajectory from the production factory
// geometry (stud D, tappet, dog, holding pawl and ratchet) with the same
// implicit contact integrator, convergence check and piecewise-linear
// compression used for the original cache. Writes src/data/jointed-tappet-profile.js
// and a JSON report under artifacts/review/.
import {writeFile} from 'node:fs/promises';
import {makeJointedTappetCounter} from '../src/simulation/jointed-tappet.js';
import {makeJointedTappetDynamics,advanceJointedTappetStep} from './lib/jointed-tappet-dynamics-study.mjs';

const parameters={period:24,load:3,damping:[3,.008,100,.003]},duration=7.2,epsilon=5e-8,steps=[.000125,.0000625,.00003125];
const model=makeJointedTappetCounter(),u=model.root.userData,p=u.geometry,physics=makeJointedTappetDynamics(model,parameters);
const runs=[];let dense;const only=process.env.STEPS?JSON.parse(process.env.STEPS):null;if(only)steps.splice(0,steps.length,...only);
for(const dt of steps){
  let state=physics.initial,minimumGap=Infinity,qMin=Infinity,maxTeeth=0;const samples=[],rows=[[0,...state.x]],stride=Math.round(.001/dt);
  for(let i=1;i<=Math.round(duration/dt);i++){
    const result=advanceJointedTappetStep(physics,state,dt);if(!result.okay)throw new Error(`${result.reason} at ${i*dt} (dt ${dt})`);
    state=result.state;state.time=i*dt;minimumGap=Math.min(minimumGap,result.diagnostic.minimumGap);qMin=Math.min(qMin,state.x[0]);
    maxTeeth=Math.max(maxTeeth,(state.x[2]-p.wheelStart)/p.pitch);
    if(i%stride===0)samples.push([...state.x]);rows.push([state.time,...state.x]);
  }
  const final={q:state.x[0],alpha:state.x[1],teeth:(state.x[2]-p.wheelStart)/p.pitch,holding:state.x[3]};
  if(Math.abs(final.teeth-1)>1e-6||Math.abs(final.q-.3)>1e-6||Math.abs(final.alpha)>1e-6||minimumGap< -2e-9)throw new Error('Endpoint or clearance failure '+JSON.stringify({dt,final,minimumGap}));
  runs.push({dt,samples,minimumGap,qMin,maxTeeth,final});dense=rows;
  console.log({dt,minimumGap,qMin,maxTeeth,final});
}
const comparisons=[];
for(let i=1;i<runs.length;i++){
  const errors=[0,0,0,0],witness=[0,0,0,0];
  for(let j=0;j<Math.min(runs[i-1].samples.length,runs[i].samples.length);j++)for(let k=0;k<4;k++){
    const error=Math.abs(runs[i-1].samples[j][k]-runs[i].samples[j][k]);if(error>errors[k]){errors[k]=error;witness[k]=(j+1)*.001;}
  }
  comparisons.push({coarse:runs[i-1].dt,fine:runs[i].dt,maximumAngleErrors:errors,witnessTimes:witness});
}
if(comparisons.at(-1).maximumAngleErrors.some(v=>v>.0015))throw new Error('Finest step not converged '+JSON.stringify(comparisons));
// Compress the finest trajectory within epsilon per angle.
const selected=[0];let start=0,index=1;const lo=Array(4).fill(-Infinity),hi=Array(4).fill(Infinity);
while(index<dense.length){
  const span=dense[index][0]-dense[start][0],slope=[0,1,2,3].map(k=>(dense[index][k+1]-dense[start][k+1])/span);
  if(slope.some((v,k)=>v<lo[k]||v>hi[k])){selected.push(index-1);start=index-1;lo.fill(-Infinity);hi.fill(Infinity);continue;}
  for(let k=0;k<4;k++){lo[k]=Math.max(lo[k],slope[k]-epsilon/span);hi[k]=Math.min(hi[k],slope[k]+epsilon/span);}index++;
}
if(selected.at(-1)!==dense.length-1)selected.push(dense.length-1);
const first=selected.map(i=>dense[i]),settled=dense.find(r=>r[0]>.1&&Math.abs(r[1]-.3)<1e-10&&Math.abs(r[2])<1e-8&&Math.abs(r[3]-p.wheelStart)<1e-6);
if(!settled)throw new Error('No initial settled interval');
const rest=[.3,0,p.wheelStart+p.pitch,0];first.push([8,...rest],[24,...rest]);
const steady=[[0,.3,0,p.wheelStart,0],[settled[0],.3,0,p.wheelStart,0],...first.filter(r=>r[0]>settled[0])];
const sample=(table,t)=>{let a=0,b=table.length-1;while(b-a>1){const m=(a+b)>>1;if(table[m][0]<=t)a=m;else b=m;}const A=table[a],B=table[b],f=Math.max(0,Math.min(1,(t-A[0])/(B[0]-A[0])));return A.slice(1).map((v,k)=>v+f*(B[k+1]-v));};
let minimumGap=Infinity,worst=null;
for(const [label,table] of [['first',first],['steady',steady]])for(let i=0;i<table.length-1;i++)for(const f of [0,.25,.5,.75,1]){
  const t=table[i][0]+f*(table[i+1][0]-table[i][0]),x=sample(table,t),{gaps}=physics.constraints(x,t);
  for(const [kind,gap] of Object.entries(gaps))if(gap<minimumGap){minimumGap=gap;worst={label,t,kind,gap};}
}
if(minimumGap< -1e-6)throw new Error('Interpolated contact penetration '+JSON.stringify(worst));
const metadata={physics:physics.parameters,geometry:p,physicsPeriod:24,period:12,epsilon,initialSettleTime:settled[0]};
await writeFile('src/data/jointed-tappet-profile.js','// Finite contact dynamics cache baked by scripts/bake-jointed-tappet-motion.mjs.\n// See artifacts/review/076-rebake-report.json.\n// Rows: physical time, tappet angle, dog angle relative to tappet, wheel angle, holding-pawl angle.\nexport default {\n'+Object.entries(metadata).map(([k,v])=>`  ${k}: ${JSON.stringify(v)},`).join('\n')+'\n  first: [\n'+first.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ],\n  steady: [\n'+steady.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ],\n};\n');
const report={movement:76,status:'rebaked-finite-contact-cache',parameters,duration,steps,runs:runs.map(({samples,...r})=>r),comparisons,firstKnots:first.length,steadyKnots:steady.length,initialSettleTime:settled[0],interpolatedMinimumGap:minimumGap,worst,
  studOrbit:p.studOrbit,studOverlap:p.studOverlap};
await writeFile('artifacts/review/076-rebake-report.json',JSON.stringify(report,null,2)+'\n');
console.log({comparisons,firstKnots:first.length,steadyKnots:steady.length,minimumGap});
